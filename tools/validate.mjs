#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Validate the catalog: every block under blocks/, plus the files that
 * describe it.
 *
 *   node tools/validate.mjs            # the whole catalog
 *   node tools/validate.mjs <file.op>  # one or more files, wherever they are
 *
 * A file inside blocks/ is also held to its path, including a misplaced file
 * or a symbolic link. A file elsewhere (a draft, a fixture) is judged on its
 * content alone. Exit code 1 if anything is wrong.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { checkBlockText } from './lib/op.mjs';
import { ROOT, checkListedBlock, listBlocks, readJson, readPublishers } from './lib/repo.mjs';

function report(file, issues) {
  if (issues.length === 0) {
    console.log(`ok      ${file}`);
    return 0;
  }
  console.log(`INVALID ${file}`);
  for (const issue of issues) console.log(`        ${issue.path}  ${issue.message}`);
  return 1;
}

function checkCatalogFiles() {
  const problems = [];
  let publishers = new Map();
  try {
    publishers = readPublishers(ROOT);
  } catch (error) {
    problems.push(error.message);
  }
  const categories = readJson(ROOT, 'categories.json');
  const schema = readJson(ROOT, 'schema/op/v1.schema.json');
  const schemaCategories = schema.$defs.rootMetadata.properties['catalog:category'].enum;
  if (JSON.stringify(categories) !== JSON.stringify(schemaCategories)) {
    problems.push('categories.json and the schema\'s catalog:category enum disagree');
  }
  const revocations = readJson(ROOT, 'revocations.json');
  if (!Array.isArray(revocations)) problems.push('revocations.json must be an array');
  return { publishers, problems };
}

const files = process.argv.slice(2);
let failed = 0;

if (files.length > 0) {
  const { publishers } = checkCatalogFiles();
  const { blocks, misplaced } = listBlocks(ROOT);
  const listed = new Map(blocks.map((block) => [block.file, block]));
  const astray = new Map(misplaced.map((item) => [item.file, item.message]));
  for (const file of files) {
    const rel = path.relative(ROOT, path.resolve(file)).split(path.sep).join('/');
    const block = listed.get(rel);
    const issues = astray.has(rel)
      ? [{ path: '', message: astray.get(rel) }]
      : block
        ? checkListedBlock(ROOT, block, publishers).issues
        : checkBlockText(readFileSync(file, 'utf8')).issues;
    failed += report(rel, issues);
  }
  console.log(failed === 0 ? `\n${files.length} file(s) valid.` : `\n${failed} of ${files.length} file(s) invalid.`);
} else {
  const { publishers, problems } = checkCatalogFiles();
  for (const problem of problems) console.log(`INVALID ${problem}`);
  const { blocks, misplaced } = listBlocks(ROOT);
  for (const item of misplaced) failed += report(item.file, [{ path: '', message: item.message }]);
  for (const block of blocks) failed += report(block.file, checkListedBlock(ROOT, block, publishers).issues);
  failed += problems.length;
  console.log(
    failed === 0
      ? `\n${blocks.length} block(s) valid.`
      : `\n${failed} problem file(s) among ${blocks.length + misplaced.length} file(s) under blocks/.`,
  );
}

process.exitCode = failed === 0 ? 0 : 1;
