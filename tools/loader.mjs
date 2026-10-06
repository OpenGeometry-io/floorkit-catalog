// SPDX-License-Identifier: Apache-2.0
/**
 * A reference catalog loader: index → entry → verified bytes → definition.
 *
 * Works unchanged in a browser and in Node 22 (fetch, streams, WebCrypto), and
 * imports nothing. It is written to be lifted into the Floorkit SDK, whose
 * own `loadOPBaseAssetSources` today is a bare fetch with no integrity check,
 * size cap or timeout.
 *
 *   import { openCatalog } from './tools/loader.mjs';
 *   const catalog = await openCatalog({ baseUrl: 'https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0/' });
 *   const { text } = await catalog.load('floorkit.simple-chair');
 *   const chair = new OpenElement(text);                    // Floorkit
 *
 * What it refuses, and why:
 * - a path that leaves the catalog root: the index is data, not instructions;
 * - any redirect: a mirror that answers somewhere else is not this catalog;
 * - more bytes than the index promised, while still streaming: a host that
 *   never stops sending cannot exhaust memory;
 * - bytes whose SHA-256 differs from the index: a swapped file;
 * - a revoked entry: withdrawn for a reason the index states;
 * - a file whose own id or version disagrees with its entry.
 *
 * What it does NOT do yet (docs/rfcs/0001-catalog-and-loader.md): verify a
 * signature over the index itself. Integrity here is only as good as the
 * channel the index arrived over.
 */

export const INDEX_SCHEMA = 'floorkit.catalog/v1';

export class CatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CatalogError';
    this.code = code;
  }
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) if (pa[index] !== pb[index]) return pa[index] - pb[index];
  return 0;
}

const ENTRY_PATH = /^blocks\/[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*\/(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.op$/;
const MAX_BLOCK_BYTES = 256 * 1024;

async function readCapped(response, cap, label, deadline) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap) {
    await response.body?.cancel();
    throw new CatalogError('too-large', `${label} declares ${declared} bytes; at most ${cap} were expected`);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    // A host that keeps sending slowly must not outlive the deadline.
    const remaining = deadline - Date.now();
    let timer;
    let step;
    try {
      step = await Promise.race([
        reader.read(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new CatalogError('fetch-failed', `${label}: timed out while reading`)), Math.max(0, remaining));
        }),
      ]);
    } catch (error) {
      await reader.cancel().catch(() => {});
      if (error instanceof CatalogError) throw error;
      throw new CatalogError('fetch-failed', `${label}: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }
    const { done, value } = step;
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new CatalogError('too-large', `${label} is larger than the ${cap} bytes expected`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function sha256Hex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Open a catalog at `baseUrl` (the directory holding index.json).
 *
 * @param {object} options
 * @param {string|URL} options.baseUrl
 * @param {typeof fetch} [options.fetch]   injectable, for tests and custom transports
 * @param {number} [options.maxIndexBytes] default 4 MB
 * @param {number} [options.timeoutMs]     per request, default 10 s
 */
export async function openCatalog({ baseUrl, fetch = globalThis.fetch, maxIndexBytes = 4 * 1024 * 1024, timeoutMs = 10_000 }) {
  const base = new URL(baseUrl);
  if (!base.pathname.endsWith('/')) base.pathname += '/';

  const get = async (url, cap, label) => {
    let response;
    const deadline = Date.now() + timeoutMs;
    try {
      response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      // fetch rejects on a redirect when redirect is 'error' (Node says why in `cause`).
      const why = `${error.message} ${error.cause?.message ?? ''}`;
      if (/redirect/i.test(why)) {
        throw new CatalogError('redirected', `${label} redirected; the catalog must answer from its own URL`);
      }
      throw new CatalogError('fetch-failed', `${label}: ${why.trim()}`);
    }
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new CatalogError('redirected', `${label} redirected (${response.status}); the catalog must answer from its own URL`);
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new CatalogError('fetch-failed', `${label}: HTTP ${response.status}`);
    }
    return readCapped(response, cap, label, deadline);
  };

  const decode = (bytes, label) => {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new CatalogError('malformed', `${label} is not UTF-8`);
    }
  };

  const indexText = decode(await get(new URL('index.json', base), maxIndexBytes, 'index.json'), 'index.json');
  let index;
  try {
    index = JSON.parse(indexText);
  } catch (error) {
    throw new CatalogError('malformed', `index.json is not JSON: ${error.message}`);
  }
  if (index?.schema !== INDEX_SCHEMA || !Array.isArray(index.entries)) {
    throw new CatalogError('malformed', `index.json is not a ${INDEX_SCHEMA} index`);
  }

  const resolve = (entryPath) => {
    // The index schema's own pattern: no '%', '\\', '..', query or fragment can pass.
    if (typeof entryPath !== 'string' || !ENTRY_PATH.test(entryPath)) {
      throw new CatalogError('outside-root', `entry path ${JSON.stringify(entryPath)} is not blocks/<publisher>/<slug>/<x.y.z>.op`);
    }
    const url = new URL(entryPath, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
      throw new CatalogError('outside-root', `entry path ${JSON.stringify(entryPath)} leaves the catalog root`);
    }
    return url;
  };

  const find = (id, version) => {
    const matches = index.entries.filter((entry) => entry.id === id && (version === undefined || entry.version === version));
    if (matches.length === 0) {
      throw new CatalogError('not-found', `${id}${version ? `@${version}` : ''} is not in this catalog`);
    }
    if (version !== undefined) return matches[0];
    const live = matches.filter((entry) => !entry.revoked).sort((a, b) => compareSemver(b.version, a.version));
    return live[0] ?? matches[0];
  };

  return {
    baseUrl: base.href,
    index,
    /** Every entry, revoked ones left out unless asked for. */
    list({ includeRevoked = false } = {}) {
      return index.entries.filter((entry) => includeRevoked || !entry.revoked);
    },
    /** The newest live version, or exactly `version`. */
    find,
    /**
     * Fetch and verify one block. Returns `{ entry, text, definition }`;
     * `text` is what Floorkit's `new OpenElement(text)` or
     * `parseOpenElementDefinition(text)` takes.
     */
    async load(id, { version } = {}) {
      const entry = find(id, version);
      if (entry.revoked) {
        throw new CatalogError('revoked', `${entry.id}@${entry.version} was revoked on ${entry.revoked.at}: ${entry.revoked.reason}`);
      }
      const label = entry.path;
      if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > MAX_BLOCK_BYTES || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) {
        throw new CatalogError('malformed', `index entry for ${entry.id}@${entry.version} has no usable bytes or sha256`);
      }
      const bytes = await get(resolve(entry.path), entry.bytes, label);
      if (bytes.byteLength !== entry.bytes) {
        throw new CatalogError('integrity', `${label} is ${bytes.byteLength} bytes; the index says ${entry.bytes}`);
      }
      const digest = await sha256Hex(bytes);
      if (digest !== entry.sha256) {
        throw new CatalogError('integrity', `${label} does not match the SHA-256 in index.json`);
      }
      const text = decode(bytes, label);
      let definition;
      try {
        definition = JSON.parse(text);
      } catch (error) {
        throw new CatalogError('malformed', `${label} is not JSON: ${error.message}`);
      }
      if (definition?.id !== entry.id || definition?.metadata?.['catalog:version'] !== entry.version) {
        throw new CatalogError('integrity', `${label} says it is ${definition.id}@${definition.metadata?.['catalog:version']}, not ${entry.id}@${entry.version}`);
      }
      return { entry, text, definition };
    },
  };
}
