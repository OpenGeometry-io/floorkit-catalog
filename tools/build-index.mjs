#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Regenerate index.json from blocks/, publishers.json and revocations.json.
 *
 *   node tools/build-index.mjs           # write index.json
 *   node tools/build-index.mjs --check   # exit 1 if index.json is not exactly that
 *
 * Never edit index.json by hand; this is its only author.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';
import { buildIndex, formatIndex } from './lib/catalog-index.mjs';
import { ROOT } from './lib/repo.mjs';

const target = path.join(ROOT, 'index.json');
let index;
try {
  index = buildIndex(ROOT);
} catch (error) {
  console.error(`cannot build the index:\n${error.message}`);
  process.exit(1);
}

const ajv = new Ajv2020({ strict: true, allErrors: true });
const validateIndex = ajv.compile(JSON.parse(readFileSync(path.join(ROOT, 'schema/index/v1.schema.json'), 'utf8')));
if (!validateIndex(index)) {
  console.error('the built index does not match schema/index/v1.schema.json:');
  for (const error of validateIndex.errors) console.error(`  ${error.instancePath || '/'} ${error.message}`);
  process.exit(1);
}

const text = formatIndex(index);
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== text) {
    console.error('index.json is stale or hand-edited. Run `node tools/build-index.mjs` and commit the result.');
    process.exit(1);
  }
  console.log(`index.json is current: ${index.entries.length} entr(ies).`);
} else {
  writeFileSync(target, text);
  console.log(`index.json written: ${index.entries.length} entr(ies).`);
}
