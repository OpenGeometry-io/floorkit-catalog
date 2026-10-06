#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Every commit in a pull request carries a Developer Certificate of Origin
 * sign-off from its author (https://developercertificate.org/).
 *
 *   node tools/dco.mjs <base> <head>
 *
 * A commit passes when one of its `Signed-off-by: Name <email>` trailers
 * names the commit's author email, which is what `git commit -s` writes.
 * Merge commits are skipped, as the DCO GitHub app skips them.
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error('usage: node tools/dco.mjs <base> <head>');
  process.exit(2);
}

const log = execFileSync('git', ['log', '--no-merges', '--format=%H%x00%ae%x00%B%x1e', `${base}..${head}`], {
  encoding: 'utf8',
});
const commits = log.split('\x1e').map((chunk) => chunk.trim()).filter(Boolean);
const failures = [];
for (const commit of commits) {
  const [sha, email, body] = commit.split('\x00');
  const signers = [...body.matchAll(/^Signed-off-by: .+ <([^<>\s]+)>\s*$/gm)].map((match) => match[1].toLowerCase());
  if (!signers.includes(email.toLowerCase())) {
    failures.push(
      signers.length === 0
        ? `${sha.slice(0, 10)} has no Signed-off-by line`
        : `${sha.slice(0, 10)} is signed off by ${signers.join(', ')}, not by its author ${email}`,
    );
  }
}

for (const failure of failures) console.log(`FAIL ${failure}`);
console.log(
  failures.length === 0
    ? `DCO: ${commits.length} commit(s) signed off.`
    : `\nDCO: ${failures.length} of ${commits.length} commit(s) lack a sign-off. Fix with \`git commit --amend -s\` or \`git rebase --signoff ${base}\`.`,
);
process.exitCode = failures.length === 0 ? 0 : 1;
