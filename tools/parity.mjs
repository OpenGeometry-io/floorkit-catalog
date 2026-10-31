#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Hold the catalog to Floorkit itself. Run by maintainers, against a Floorkit
 * build; CI cannot run it until @opengeometry/floorkit is on npm.
 *
 *   FLOORKIT_DIR=<dir containing dist/index.js> node tools/parity.mjs [--build] [--mesh] [--out=<dir>] [file.op ...]
 *
 * The whole catalog by default, or the files named; with files named, the
 * kernel-reject fixtures are skipped and the exit code covers only those files.
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
 * per block, which catches build-time failures parsing cannot (a boolean whose
 * operand is not an analytic solid, for example), and builds it again placed
 * in a project mirrored (`scale [-1, 1, 1]`). `--mesh` then checks each built
 * body (`lib/mesh.mjs`) and writes `renders/<publisher>/<slug>/<version>/mesh-report.json`
 * (or under `--out`); it implies `--build`.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadFloorkit, bodyParts, placedModel, targets } from './lib/floorkit.mjs';
import { meshReport, shellNodes } from './lib/mesh.mjs';
import { parseNote } from './lib/note.mjs';
import { ROOT } from './lib/repo.mjs';

const args = process.argv.slice(2);
const build = args.includes('--build') || args.includes('--mesh');
let floorkit, THREE;
try {
  ({ floorkit, THREE } = await loadFloorkit({ boot: build }));
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exit(2);
}
const { parseOpenElementDefinition } = floorkit;
if (typeof parseOpenElementDefinition !== 'function') {
  console.error('Floorkit does not export parseOpenElementDefinition.');
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
const renders = path.resolve(args.find((arg) => arg.startsWith('--out='))?.slice(6) ?? path.join(ROOT, 'renders'));
const blocks = targets(args, renders);
let accepted = 0;
let unrepaired = 0;
for (const block of blocks) {
  const { text } = block;
  let normalised;
  try {
    normalised = parseOpenElementDefinition(text);
    accepted += 1;
  } catch (error) {
    failures += 1;
    console.log(`REJECTED ${block.name}: ${String(error?.message ?? error)}`);
    continue;
  }
  const changed = changedLeaves(JSON.parse(text), normalised);
  if (changed.length === 0) unrepaired += 1;
  else {
    failures += 1;
    console.log(`REPAIRED ${block.name}`);
    for (const line of changed.slice(0, 10)) console.log(`         ${line}`);
  }
}
console.log(`accepted by Floorkit:   ${accepted}/${blocks.length}`);
console.log(`unrepaired by Floorkit: ${unrepaired}/${blocks.length}`);

const named = args.some((arg) => !arg.startsWith('--'));
const rejectsDir = path.join(ROOT, 'test', 'fixtures', 'kernel-rejects');
const rejects = named ? [] : readdirSync(rejectsDir).filter((name) => name.endsWith('.json')).sort();
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
if (!named) console.log(`kernel-reject fixtures refused by Floorkit: ${refused}/${rejects.length}`);

if (build) {
  const mesh = args.includes('--mesh');
  let built = 0;
  let mirrored = 0;
  let clean = 0;
  let slivers = 0;
  let sliverBlocks = 0;
  for (const block of blocks) {
    try {
      const element = new floorkit.OpenElement(block.text);
      if (mesh) {
        // docs/drafting-standard.md §4 says which pairs a block may list; the list itself is the block's note.
        const { overlaps } = parseNote(JSON.parse(block.text).metadata?.['catalog:note']);
        const report = meshReport(bodyParts(element), overlaps, shellNodes(JSON.parse(block.text)));
        mkdirSync(block.out, { recursive: true });
        writeFileSync(path.join(block.out, 'mesh-report.json'), `${JSON.stringify({ block: block.name, ...report }, null, 2)}\n`);
        const dropped = report.nodes.reduce((sum, node) => sum + node.collapsed, 0);
        if (dropped > 0) {
          slivers += dropped;
          sliverBlocks += 1;
          console.log(`SLIVERS ${block.name}: ${dropped} triangle(s) collapse under the 0.01 mm weld and were dropped (${report.nodes.filter((node) => node.collapsed).map((node) => `${node.name} ${node.collapsed}`).join(', ')})`);
        }
        if (report.defects.length === 0) clean += 1;
        else failures += 1;
        for (const defect of report.defects) console.log(`MESH ${block.name}: ${defect}`);
      }
      element.dispose?.();
      built += 1;
    } catch (error) {
      failures += 1;
      console.log(`BUILD FAILED ${block.name}: ${String(error?.message ?? error)}`);
      continue;
    }
    try {
      // Placed as a project places it, so the project's own rule on scale applies.
      const model = placedModel('block.op', [-1, 1, 1]);
      const { errors } = floorkit.validateBuildingModel(model);
      if (errors.length > 0) throw new Error(errors.map((issue) => `${issue.code}: ${issue.message}`).join('; '));
      const result = floorkit.buildFromBuildingModel(model, new THREE.Group(), { validated: true, assetSources: { 'block.op': block.text } });
      floorkit.disposeBuildResult?.(result);
      mirrored += 1;
    } catch (error) {
      failures += 1;
      console.log(`MIRROR FAILED ${block.name}: ${String(error?.message ?? error)}`);
    }
  }
  console.log(`built by Floorkit:      ${built}/${blocks.length}`);
  console.log(`mirrored by Floorkit:   ${mirrored}/${blocks.length}`);
  if (mesh) console.log(`mesh clean:             ${clean}/${blocks.length} (reports in ${path.relative(process.cwd(), renders) || '.'})`);
  if (mesh) console.log(`slivers dropped:        ${slivers} triangle(s) in ${sliverBlocks} block(s)`);
}

console.log(failures === 0 ? '\nparity holds.' : `\n${failures} parity failure(s).`);
process.exitCode = failures === 0 ? 0 : 1;
