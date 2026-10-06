// SPDX-License-Identifier: Apache-2.0
// The two git gates, run for real in a throwaway repository.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const TOOLS = path.resolve(import.meta.dirname, '..', 'tools');
let repo;

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(TOOLS, tool), ...args], { cwd: repo, encoding: 'utf8' });
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), text);
};
const commit = (message, { signoff = true, author = 'Ada <ada@example.com>' } = {}) => {
  git('add', '-A');
  git('-c', 'user.name=Ada', '-c', 'user.email=ada@example.com', 'commit', '-q', '--allow-empty', '--author', author, ...(signoff ? ['-s'] : []), '-m', message);
  return git('rev-parse', 'HEAD').trim();
};

before(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'floorkit-catalog-gates-'));
  git('init', '-q', '-b', 'main');
});
after(() => rmSync(repo, { recursive: true, force: true }));

test('immutability: not enforced before the first tag, and says so', () => {
  write('blocks/acme/chair/1.0.0.op', '{}\n');
  commit('add chair');
  const result = run('immutable.mjs');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /NOT ENFORCED/);
});

test('immutability: after a tag, adding passes and modifying, deleting or renaming fails', () => {
  git('tag', 'v0.1.0');
  const tagged = git('rev-parse', 'HEAD').trim();

  write('blocks/acme/chair/1.1.0.op', '{}\n');
  commit('add chair 1.1.0');
  assert.equal(run('immutable.mjs').status, 0, 'adding a version must pass');

  write('blocks/acme/chair/1.0.0.op', '{"changed":true}\n');
  commit('edit a released file');
  let result = run('immutable.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /blocks\/acme\/chair\/1\.0\.0\.op: modified since v0\.1\.0/);

  git('reset', '-q', '--hard', tagged);
  git('rm', '-q', 'blocks/acme/chair/1.0.0.op');
  commit('delete a released file');
  result = run('immutable.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /deleted, but it was released in v0\.1\.0/);

  git('reset', '-q', '--hard', tagged);
  git('mv', 'blocks/acme/chair/1.0.0.op', 'blocks/acme/chair/2.0.0.op');
  commit('rename a released file');
  result = run('immutable.mjs');
  assert.equal(result.status, 1, 'a rename is a delete plus an add, and the delete must fail');
  assert.match(result.stdout, /1\.0\.0\.op: deleted/);

  // A block released only in a tag that is NOT an ancestor of HEAD is still released.
  git('reset', '-q', '--hard', tagged);
  write('blocks/acme/stool/1.0.0.op', '{}\n');
  commit('stool on a side line');
  git('tag', 'v0.2.0');
  git('reset', '-q', '--hard', tagged);
  write('blocks/acme/stool/1.0.0.op', '{"different":true}\n');
  commit('a different stool 1.0.0');
  result = run('immutable.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /stool\/1\.0\.0\.op: modified since v0\.2\.0/);
  git('tag', '-d', 'v0.2.0');

  git('reset', '-q', '--hard', tagged);
  symlinkSync('1.0.0.op', path.join(repo, 'blocks/acme/chair/1.2.0.op'));
  commit('add a symlink');
  result = run('immutable.mjs');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /symbolic link/);
  git('reset', '-q', '--hard', tagged);
});

test('immutability fails closed on a shallow clone', () => {
  const shallow = mkdtempSync(path.join(tmpdir(), 'floorkit-catalog-shallow-'));
  execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo}`, shallow]);
  const result = spawnSync(process.execPath, [path.join(TOOLS, 'immutable.mjs')], { cwd: shallow, encoding: 'utf8' });
  rmSync(shallow, { recursive: true, force: true });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /shallow clone/);
});

test('dco: a signed-off series passes; a missing or foreign sign-off fails', () => {
  const base = git('rev-parse', 'HEAD').trim();
  commit('signed', { signoff: true, author: 'Ada <ada@example.com>' });
  let result = run('dco.mjs', base, 'HEAD');
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /1 commit\(s\) signed off/);

  commit('unsigned', { signoff: false });
  result = run('dco.mjs', base, 'HEAD');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /has no Signed-off-by line/);

  git('reset', '-q', '--hard', base);
  // Signed off by the committer (Ada) but AUTHORED by Bob: Bob never certified it.
  commit('authored by someone else', { signoff: true, author: 'Bob <bob@example.com>' });
  result = run('dco.mjs', base, 'HEAD');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /not by its author bob@example\.com/);
});
