// SPDX-License-Identifier: Apache-2.0
// The loader against a real HTTP server serving the real catalog, then against
// the same server lying in each way the loader claims to catch.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { after, before, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { CatalogError, openCatalog } from '../tools/loader.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const realIndex = JSON.parse(readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
const liveCount = realIndex.entries.filter((entry) => !entry.revoked).length;
const chairPath = 'blocks/floorkit/simple-chair/1.0.0.op';
const chairBytes = readFileSync(path.join(ROOT, chairPath));
const chairLabel = JSON.stringify(JSON.parse(chairBytes.toString('utf8')).labelName);
// The same length, one letter changed: a tampered file that only the hash can catch.
const tamperedLabel = `${chairLabel.slice(0, -2)}${chairLabel.at(-2) === 'x' ? 'y' : 'x'}"`;

/** Variants of the catalog, each served under its own prefix. */
const variants = {
  good: { index: realIndex, files: {} },
  tampered: {
    index: realIndex,
    files: { [chairPath]: Buffer.from(chairBytes.toString('utf8').replace(chairLabel, tamperedLabel)) },
  },
  oversize: { index: realIndex, files: { [chairPath]: Buffer.concat([chairBytes, Buffer.alloc(4096, 32)]) } },
  revoked: {
    index: {
      ...realIndex,
      entries: realIndex.entries.map((entry) =>
        entry.id === 'floorkit.simple-chair' ? { ...entry, revoked: { at: '2026-10-05', reason: 'test revocation' } } : entry,
      ),
    },
    files: {},
  },
  escape: {
    index: {
      ...realIndex,
      entries: realIndex.entries.map((entry) => (entry.id === 'floorkit.simple-chair' ? { ...entry, path: '../good/index.json' } : entry)),
    },
    files: {},
  },
  impostor: {
    index: realIndex,
    files: { [chairPath]: readFileSync(path.join(ROOT, 'blocks/floorkit/table/1.0.0.op')) },
  },
};

variants.encoded = {
  index: { ...realIndex, entries: realIndex.entries.map((entry) => (entry.id === 'floorkit.simple-chair' ? { ...entry, path: 'blocks/floorkit/..%2F..%2Fgood/index.json' } : entry)) },
  files: {},
};
variants.unbounded = {
  index: { ...realIndex, entries: realIndex.entries.map((entry) => (entry.id === 'floorkit.simple-chair' ? { ...entry, bytes: 10 ** 12 } : entry)) },
  files: {},
};
variants.notjson = { index: realIndex, files: {} };
{
  const junk = Buffer.from('not json at all\n');
  variants.notjson.files[chairPath] = junk;
  const { createHash } = await import('node:crypto');
  variants.notjson.index = {
    ...realIndex,
    entries: realIndex.entries.map((entry) =>
      entry.id === 'floorkit.simple-chair' ? { ...entry, bytes: junk.length, sha256: createHash('sha256').update(junk).digest('hex') } : entry,
    ),
  };
}

let server;
let origin;

before(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/stall/') && url.pathname.endsWith('.op')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{');
      return; // never ends
    }
    if (url.pathname.startsWith('/stall/')) {
      response.writeHead(200).end(JSON.stringify(realIndex));
      return;
    }
    if (url.pathname.startsWith('/broken/')) {
      response.writeHead(500).end('no');
      return;
    }
    if (url.pathname.startsWith('/redirect/')) {
      response.writeHead(302, { location: url.pathname.replace('/redirect/', '/good/') });
      response.end();
      return;
    }
    const [, name, ...rest] = url.pathname.split('/');
    const variant = variants[name];
    const file = rest.join('/');
    if (!variant) {
      response.writeHead(404).end();
      return;
    }
    if (file === 'index.json') {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(variant.index));
      return;
    }
    const body = variant.files[file] ?? (file.startsWith('blocks/') ? readFileSync(path.join(ROOT, file)) : null);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    // Chunked, no content-length: the cap must hold while streaming.
    response.writeHead(200, { 'content-type': 'application/json' });
    response.write(body.subarray(0, 100));
    response.end(body.subarray(100));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.closeAllConnections?.();
  server.close();
});

async function refusal(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CatalogError, `expected a CatalogError, got ${error}`);
    assert.equal(error.code, code, error.message);
    return true;
  });
}

test('loads and verifies every block in the real catalog', async () => {
  const catalog = await openCatalog({ baseUrl: `${origin}/good/` });
  assert.equal(catalog.list().length, liveCount);
  for (const entry of catalog.list()) {
    const { text, definition } = await catalog.load(entry.id);
    assert.equal(definition.id, entry.id);
    assert.equal(Buffer.byteLength(text), entry.bytes);
  }
  const { text } = await catalog.load('floorkit.simple-chair', { version: '1.0.0' });
  assert.equal(text, chairBytes.toString('utf8'));
});

test('refuses a file that does not match its SHA-256', async () => {
  const catalog = await openCatalog({ baseUrl: `${origin}/tampered/` });
  await refusal(catalog.load('floorkit.simple-chair'), 'integrity');
});

test('refuses more bytes than the index promised, while streaming', async () => {
  const catalog = await openCatalog({ baseUrl: `${origin}/oversize/` });
  await refusal(catalog.load('floorkit.simple-chair'), 'too-large');
});

test('refuses a revoked entry, and hides it from list()', async () => {
  const catalog = await openCatalog({ baseUrl: `${origin}/revoked/` });
  await refusal(catalog.load('floorkit.simple-chair'), 'revoked');
  assert.equal(catalog.list().length, liveCount - 1);
  assert.equal(catalog.list({ includeRevoked: true }).length, realIndex.entries.length);
});

test('refuses an entry path that leaves the catalog root', async () => {
  const catalog = await openCatalog({ baseUrl: `${origin}/escape/` });
  await refusal(catalog.load('floorkit.simple-chair'), 'outside-root');
});

test('refuses a file that claims to be a different block', async () => {
  const table = realIndex.entries.find((entry) => entry.id === 'floorkit.table');
  const index = {
    ...realIndex,
    entries: realIndex.entries.map((entry) =>
      entry.id === 'floorkit.simple-chair' ? { ...entry, bytes: table.bytes, sha256: table.sha256 } : entry,
    ),
  };
  variants.impostor.index = index;
  const catalog = await openCatalog({ baseUrl: `${origin}/impostor/` });
  await refusal(catalog.load('floorkit.simple-chair'), 'integrity');
});

test('review regressions: encoded paths, unbounded entries, non-JSON, stalls, server errors', async () => {
  await refusal((await openCatalog({ baseUrl: `${origin}/encoded/` })).load('floorkit.simple-chair'), 'outside-root');
  await refusal((await openCatalog({ baseUrl: `${origin}/unbounded/` })).load('floorkit.simple-chair'), 'malformed');
  await refusal((await openCatalog({ baseUrl: `${origin}/notjson/` })).load('floorkit.simple-chair'), 'malformed');
  await refusal((await openCatalog({ baseUrl: `${origin}/stall/`, timeoutMs: 300 })).load('floorkit.simple-chair'), 'fetch-failed');
  await refusal(openCatalog({ baseUrl: `${origin}/broken/` }), 'fetch-failed');
});

test('refuses a redirect', async () => {
  await refusal(openCatalog({ baseUrl: `${origin}/redirect/` }), 'redirected');
});

test('an unknown id is not found', async () => {
  const catalog = await openCatalog({ baseUrl: `${origin}/good/` });
  await refusal(catalog.load('floorkit.sofa-bed'), 'not-found');
});

// The hand-off to Floorkit itself needs a Floorkit build, which CI does not
// have until @opengeometry/floorkit is on npm. A skip is reported, not passed.
test('a loaded block parses in Floorkit', { skip: process.env.FLOORKIT_DIR ? false : 'FLOORKIT_DIR is not set' }, async () => {
  const floorkit = await import(pathToFileURL(path.resolve(process.env.FLOORKIT_DIR, 'dist', 'index.js')).href);
  const catalog = await openCatalog({ baseUrl: `${origin}/good/` });
  for (const entry of catalog.list()) {
    const { text } = await catalog.load(entry.id);
    const parsed = floorkit.parseOpenElementDefinition(text);
    assert.equal(parsed.id, entry.id);
  }
});
