#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * A released block never changes: fix it by publishing a new version.
 *
 *   node tools/immutable.mjs
 *
 * "Released" means "present in ANY v* tag in this clone". Every file under
 * blocks/ in any such tag must still exist at HEAD, with the same bytes and
 * mode; a symbolic link anywhere under blocks/ fails too. Checking every tag,
 * not only the nearest one, means a block released in a newer or unrelated
 * tag is covered as well.
 *
 * It fails CLOSED: a shallow clone, or a git error, is a failure rather than
 * a quiet pass. Only a clone with no v* tag at all reports NOT ENFORCED, since
 * then nothing has been released. CI must fetch tags (fetch-depth: 0).
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26 });
const problems = [];

/** path → "mode blob" for every file under blocks/ in a tree-ish. */
function blocksIn(treeish) {
  const files = new Map();
  for (const line of git('ls-tree', '-r', '--full-tree', treeish, '--', 'blocks').split('\n').filter(Boolean)) {
    const [meta, file] = line.split('\t');
    const [mode, , blob] = meta.split(' ');
    files.set(file, `${mode} ${blob}`);
  }
  return files;
}

try {
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
    throw new Error('this is a shallow clone, so released tags may be missing; fetch with full history and tags (fetch-depth: 0)');
  }
  const head = blocksIn('HEAD');
  for (const [file, entry] of head) {
    if (entry.startsWith('120000 ')) problems.push(`${file}: is a symbolic link`);
  }
  const tags = git('tag', '--list', 'v[0-9]*').split('\n').filter(Boolean);
  if (tags.length === 0) {
    console.log('immutability: NOT ENFORCED — no v* tag yet, so no block has been released.');
  } else {
    const released = new Map();
    for (const tag of tags) {
      for (const [file, entry] of blocksIn(tag)) {
        const seen = released.get(file);
        if (seen && seen.entry !== entry) problems.push(`${file}: differs between ${seen.tag} and ${tag}; a released block must never change`);
        if (!seen) released.set(file, { entry, tag });
      }
    }
    for (const [file, { entry, tag }] of released) {
      const now = head.get(file);
      if (now === undefined) problems.push(`${file}: deleted, but it was released in ${tag}; publish a new version instead`);
      else if (now !== entry) problems.push(`${file}: modified since ${tag}; publish a new version instead`);
    }
    console.log(`immutability: ${released.size} released file(s) across ${tags.length} tag(s) checked against HEAD.`);
  }
} catch (error) {
  problems.push(`could not check: ${error.message.split('\n')[0]}`);
}

for (const problem of problems) console.log(`FAIL ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
