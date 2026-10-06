#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Rewrite .op files into the catalog's one byte form: 2-space JSON, LF line
 * endings, one final newline. It changes formatting only. A duplicate key
 * keeps its last value, as JSON.parse does, so check the diff before you commit.
 *
 *   node tools/format.mjs <file.op> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { formatBlock } from './lib/op.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node tools/format.mjs <file.op> [...]');
  process.exit(2);
}
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const formatted = formatBlock(JSON.parse(text.replace(/^﻿/, '')));
  if (formatted === text) {
    console.log(`unchanged  ${file}`);
  } else {
    writeFileSync(file, formatted);
    console.log(`formatted  ${file}`);
  }
}
