#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Hold the catalog to Floorkit itself. Run by maintainers, against a Floorkit
 * build; CI cannot run it until @opengeometry/floorkit is on npm.
 *
 *   FLOORKIT_DIR=<dir containing dist/index.js> node tools/parity.mjs [--build]
 *
 * Three claims, each counted, none assumed:
 *
 * 1. ACCEPTED: every block parses with Floorkit's own
 *    `parseOpenElementDefinition`.
 * 2. UNREPAIRED: Floorkit keeps every value the block states. Floorkit may ADD
 *    keys (a default placement, an arc's tessellation) but must not CHANGE
 *    one, because a changed value means the file says something Floorkit does
 *    not draw. Checked leaf by leaf against Floorkit's normalised output.
 * 3. NOT VACUOUS: every fixture in test/fixtures/kernel-rejects/ is REJECTED
 *    by Floorkit. If that ever drops below all of them, the parser has
 *    loosened and the catalog's schema must be re-read against it.
 *
 * `--build` additionally boots the kernel and constructs a full OpenElement
 * per block. That catches build-time failures parsing cannot (a boolean whose
 * operand is not an analytic solid, for example).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ROOT, listBlocks } from './lib/repo.mjs';

const dir = process.env.FLOORKIT_DIR;
if (!dir) {
  console.error('Set FLOORKIT_DIR to a Floorkit checkout or package with a built dist/index.js.');
  process.exit(2);
}
const entry = path.resolve(dir, 'dist', 'index.js');
const floorkit = await import(pathToFileURL(entry).href);
const { parseOpenElementDefinition } = floorkit;
if (typeof parseOpenElementDefinition !== 'function') {
  console.error(`${entry} does not export parseOpenElementDefinition.`);
  process.exit(2);
}

/** Every leaf of `authored` must survive into `normalised` unchanged. */
function changedLeaves(authored, normalised, at = '') {
  if (authored === null || typeof authored !== 'object') {
    return Object.is(authored, normalised) ? [] : [`${at || '/'}: ${JSON.stringify(authored)} became ${JSON.stringify(normalised)}`];
  }
  if (normalised === null || typeof normalised !== 'object' || Array.isArray(authored) !== Array.isArray(normalised)) {
    return [`${at || '/'}: became ${JSON.stringify(normalised)}`];
  }
  if (Array.isArray(authored) && authored.length !== normalised.length) {
    return [`${at}: ${authored.length} item(s) became ${normalised.length}`];
  }
  return Object.keys(authored).flatMap((key) =>
    Object.hasOwn(normalised, key)
      ? changedLeaves(authored[key], normalised[key], `${at}/${key}`)
      : [`${at}/${key}: dropped`],
  );
}

let failures = 0;
const { blocks } = listBlocks(ROOT);
let accepted = 0;
let unrepaired = 0;
for (const block of blocks) {
  const text = readFileSync(path.join(ROOT, block.file), 'utf8');
  let normalised;
  try {
    normalised = parseOpenElementDefinition(text);
    accepted += 1;
  } catch (error) {
    failures += 1;
    console.log(`REJECTED ${block.file}: ${String(error?.message ?? error)}`);
    continue;
  }
  const changed = changedLeaves(JSON.parse(text), normalised);
  if (changed.length === 0) unrepaired += 1;
  else {
    failures += 1;
    console.log(`REPAIRED ${block.file}`);
    for (const line of changed.slice(0, 10)) console.log(`         ${line}`);
  }
}
console.log(`accepted by Floorkit:   ${accepted}/${blocks.length}`);
console.log(`unrepaired by Floorkit: ${unrepaired}/${blocks.length}`);

const rejectsDir = path.join(ROOT, 'test', 'fixtures', 'kernel-rejects');
const rejects = readdirSync(rejectsDir).filter((name) => name.endsWith('.json')).sort();
let refused = 0;
for (const name of rejects) {
  try {
    parseOpenElementDefinition(readFileSync(path.join(rejectsDir, name), 'utf8'));
    failures += 1;
    console.log(`ACCEPTED test/fixtures/kernel-rejects/${name}, which Floorkit is expected to reject`);
  } catch {
    refused += 1;
  }
}
console.log(`kernel-reject fixtures refused by Floorkit: ${refused}/${rejects.length}`);

if (process.argv.includes('--build')) {
  // Resolved from Floorkit's own location, so this is the SAME kernel module
  // instance Floorkit uses; a second copy leaves it unbooted. Booted from the
  // .wasm BYTES, as Floorkit's own tests/helpers/kernel.mjs does.
  const require = createRequire(entry);
  const kernelEntry = require.resolve('opengeometry');
  const { OpenGeometry } = await import(pathToFileURL(kernelEntry).href);
  globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
  const wasm = readFileSync(path.join(path.dirname(kernelEntry), 'opengeometry', 'pkg', 'opengeometry_bg.wasm'));
  if (!OpenGeometry.instance) await OpenGeometry.create({ wasmURL: wasm });
  let built = 0;
  for (const block of blocks) {
    try {
      const element = new floorkit.OpenElement(readFileSync(path.join(ROOT, block.file), 'utf8'));
      element.dispose?.();
      built += 1;
    } catch (error) {
      failures += 1;
      console.log(`BUILD FAILED ${block.file}: ${String(error?.message ?? error)}`);
    }
  }
  console.log(`built by Floorkit:      ${built}/${blocks.length}`);
}

console.log(failures === 0 ? '\nparity holds.' : `\n${failures} parity failure(s).`);
process.exitCode = failures === 0 ? 0 : 1;
