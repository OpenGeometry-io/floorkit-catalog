// SPDX-License-Identifier: Apache-2.0
// The rules that tie a file to its path and the catalog files to each other,
// checked against a throwaway catalog built in a temp directory.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { buildIndex } from '../tools/lib/catalog-index.mjs';
import { formatBlock } from '../tools/lib/op.mjs';
import { ROOT, checkListedBlock, compareSemver, listBlocks, readPublishers } from '../tools/lib/repo.mjs';

let root;
const chair = () => JSON.parse(readFileSync(path.join(ROOT, 'blocks/floorkit/simple-chair/1.0.0.op'), 'utf8'));
const put = (file, definition) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), typeof definition === 'string' ? definition : formatBlock(definition));
};
const issuesFor = (file) => {
  const block = listBlocks(root).blocks.find((item) => item.file === file);
  assert.ok(block, `${file} was not listed`);
  return checkListedBlock(root, block, readPublishers(root)).issues.map((issue) => `${issue.path} ${issue.message}`);
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'floorkit-catalog-repo-'));
  for (const file of ['publishers.json', 'categories.json', 'revocations.json']) cpSync(path.join(ROOT, file), path.join(root, file));
  mkdirSync(path.join(root, 'blocks'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test('a block whose id or version disagrees with its path is refused', () => {
  put('blocks/floorkit/stool/1.0.0.op', chair());
  assert.ok(issuesFor('blocks/floorkit/stool/1.0.0.op').some((issue) => issue.includes('/id must be "floorkit.stool"')));
  put('blocks/floorkit/simple-chair/2.0.0.op', chair());
  assert.ok(issuesFor('blocks/floorkit/simple-chair/2.0.0.op').some((issue) => issue.includes('must be "2.0.0" to match the file name')));
});

test('a publisher must be listed', () => {
  const definition = { ...chair(), id: 'acme.simple-chair' };
  put('blocks/acme/simple-chair/1.0.0.op', definition);
  assert.ok(issuesFor('blocks/acme/simple-chair/1.0.0.op').some((issue) => issue.includes('publisher "acme" is not in publishers.json')));
});

test('stray files, bad names and symlinks under blocks/ are reported', () => {
  put('blocks/floorkit/simple-chair/1.0.0.op', chair());
  put('blocks/floorkit/simple-chair/latest.op', chair());
  put('blocks/floorkit/README.md', '# no\n');
  // A bad-case publisher folder; not a case of an existing one, which collides on a case-insensitive disk.
  put('blocks/Acme/chair/1.0.0.op', chair());
  symlinkSync('1.0.0.op', path.join(root, 'blocks/floorkit/simple-chair/1.0.1.op'));
  const { blocks, misplaced } = listBlocks(root);
  assert.deepEqual(blocks.map((block) => block.file), ['blocks/floorkit/simple-chair/1.0.0.op']);
  assert.deepEqual(misplaced.map((item) => item.file).sort(), [
    'blocks/Acme/chair/1.0.0.op',
    'blocks/floorkit/README.md',
    'blocks/floorkit/simple-chair/1.0.1.op',
    'blocks/floorkit/simple-chair/latest.op',
  ]);
});

test('versions sort numerically, not as text', () => {
  assert.ok(compareSemver('1.10.0', '1.9.0') > 0);
  for (const version of ['1.10.0', '1.9.0', '1.0.0']) {
    put(`blocks/floorkit/simple-chair/${version}.op`, {
      ...chair(),
      metadata: { ...chair().metadata, 'catalog:version': version },
    });
  }
  assert.deepEqual(listBlocks(root).blocks.map((block) => block.version), ['1.0.0', '1.9.0', '1.10.0']);
});

test('publishers.json is checked', () => {
  writeFileSync(path.join(root, 'publishers.json'), JSON.stringify([{ id: 'Acme', name: '', tier: 'gold', url: 'http://x' }]));
  assert.throws(() => readPublishers(root), /lowercase-hyphenated[\s\S]*name is required[\s\S]*tier must be one of[\s\S]*https URL/);
});

test('the index refuses an invalid block, and carries a revocation', () => {
  put('blocks/floorkit/simple-chair/1.0.0.op', chair());
  writeFileSync(
    path.join(root, 'revocations.json'),
    JSON.stringify([{ publisher: 'floorkit', slug: 'simple-chair', version: '1.0.0', at: '2026-10-05', reason: 'test' }]),
  );
  const index = buildIndex(root);
  assert.deepEqual(index.entries[0].revoked, { at: '2026-10-05', reason: 'test' });

  writeFileSync(
    path.join(root, 'revocations.json'),
    JSON.stringify([{ publisher: 'floorkit', slug: 'sofa', version: '1.0.0', at: '2026-10-05', reason: 'test' }]),
  );
  assert.throws(() => buildIndex(root), /floorkit\/sofa@1\.0\.0 names no block/);

  writeFileSync(path.join(root, 'revocations.json'), '[]');
  put('blocks/floorkit/simple-chair/1.0.0.op', { ...chair(), labelName: '' });
  assert.throws(() => buildIndex(root), /simple-chair\/1\.0\.0\.op: \/labelName/);
});
