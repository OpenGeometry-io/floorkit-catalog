#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * A two-bedroom flat and a four-desk office on one storey, furnished with
 * blocks from this repository's `blocks/` and built with Floorkit. Run by a
 * maintainer, against a Floorkit build, like tools/render.mjs:
 *
 *   FLOORKIT_DIR=<dir containing dist/index.js> node examples/demo.mjs [--break=height|plan|ifc|roundtrip|omissions]
 *
 * Writes `examples/out/`: the plan at 1:50, a section through the kitchen and
 * the bathroom, an elevation of the kitchen wall and one of the office desk
 * wall (SVG, through Floorkit's paper emitter, no title block), the semantic
 * IFC request (`ifc-request.json`) and the save, reopen and rebuild check
 * (`roundtrip.json`). Exits 1 when a height is off by more than 5 mm, a placed
 * block is missing from the plan, a block's IFC class is missing or wrong, or
 * the round trip differs, or a view does not draw. Blocks on NOT_DRAWN (filed
 * Floorkit faults) are left out of the section and elevations only, and the
 * run says so. `--break=<check>` breaks one input on purpose, so that each
 * check can be seen to fail.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'examples', 'out');
const broken = process.argv.find((arg) => arg.startsWith('--break='))?.slice(8) ?? null;
const TOLERANCE = 0.005;
// Blocks Floorkit cannot draw in a section or an elevation, each with its filed fault. A placed block on
// this list is left out of those views only; any other drawing error fails the run.
const NOT_DRAWN = {
  ...Object.fromEntries(['basin-accessible', 'bicycle', 'chiller', 'cloakroom-basin', 'crah', 'hot-water-cylinder', 'kitchen-sink', 'parked-car',
    'pdu', 'rear-door-heat-exchanger', 'tumble-dryer', 'ups', 'wash-basin', 'washing-machine', 'wheelchair'].map((slug) => [slug, 'FLO-238'])),
  ...Object.fromEntries(['bidet', 'wc', 'wc-accessible', 'wc-wall-hung'].map((slug) => [slug, 'FLO-239'])),
};
if (broken === 'omissions') delete NOT_DRAWN['kitchen-sink'];

// The same steps as loadFloorkit in tools/lib/floorkit.mjs, copied so that this
// script imports nothing but Node built-ins and the build in FLOORKIT_DIR.
if (!process.env.FLOORKIT_DIR) {
  console.error('Set FLOORKIT_DIR to a Floorkit checkout or package with a built dist/index.js.');
  process.exit(2);
}
const entry = path.resolve(process.env.FLOORKIT_DIR, 'dist', 'index.js');
const F = await import(pathToFileURL(entry).href);
const require = createRequire(entry);
const THREE = await import(pathToFileURL(path.join(path.dirname(require.resolve('three')), 'three.module.js')).href);
const kernelEntry = require.resolve('opengeometry');
const { OpenGeometry } = await import(pathToFileURL(kernelEntry).href);
globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
if (!OpenGeometry.instance) {
  await OpenGeometry.create({ wasmURL: readFileSync(path.join(path.dirname(kernelEntry), 'opengeometry', 'pkg', 'opengeometry_bg.wasm')) });
}

// ── The blocks: index.json says where each one is and what its bytes hash to ──
const index = JSON.parse(readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
const blocks = new Map();
function block(slug) {
  const id = `floorkit.${slug}`;
  if (!blocks.has(id)) {
    const found = index.entries.find((e) => e.id === id);
    if (!found) throw new Error(`${id} is not in index.json`);
    const text = readFileSync(path.join(ROOT, found.path), 'utf8');
    if (createHash('sha256').update(text).digest('hex') !== found.sha256) throw new Error(`${found.path} does not match its sha256 in index.json`);
    blocks.set(id, { id, slug, uri: found.path.replace(/^blocks\//, ''), text, ifcClass: JSON.parse(text).metadata?.['ifc:class'] });
  }
  return blocks.get(id);
}

// ── The building: a flat (x 0 to 10) and an office (x 11 to 21), both z 0 to 8, ceiling 2.40 ──
const H = 2.4;
const wall = (id, points, thickness, openings = []) => ({ id, points, thickness, height: H, openings });
const door = (id, offset, width, doorQuadrant) => ({ id, kind: 'door', offset, width, height: 2.1, doorQuadrant, swingAngleDegrees: 90 });
const win = (id, offset, width, sillHeight, height) => ({ id, kind: 'window', offset, width, height, sillHeight });
const walls = [
  wall('flat-n', [[0, 0], [10, 0]], 0.2, [win('win-kitchen', 1.2, 0.8, 1.05, 1.1), win('win-bath', 5.5, 0.6, 1.2, 0.8), win('win-bed2', 8.2, 1.2, 0.9, 1.3)]),
  wall('flat-e', [[10, 0], [10, 8]], 0.2),
  wall('flat-s', [[10, 8], [0, 8]], 0.2, [win('win-bed1', 1.4, 1.2, 0.9, 1.3), win('win-living-2', 5.3, 1.2, 0.9, 1.3), win('win-living-1', 8.2, 1.2, 0.9, 1.3)]),
  wall('flat-w', [[0, 8], [0, 0]], 0.2, [door('door-entry', 4.4, 0.9, 3)]),
  wall('hall-n', [[0, 3], [10, 3]], 0.1, [door('door-kitchen', 3.0, 0.8, 2), door('door-bath', 4.1, 0.8, 1), door('door-bed2', 7.0, 0.8, 1)]),
  wall('hall-s', [[0, 4.2], [10, 4.2]], 0.1, [door('door-living', 2.0, 0.9, 3), door('door-bed1', 8.0, 0.8, 3)]),
  wall('kitchen-bath', [[3.6, 0], [3.6, 3]], 0.1),
  wall('bath-bed2', [[6.4, 0], [6.4, 3]], 0.1),
  wall('living-bed1', [[6.4, 4.2], [6.4, 8]], 0.1),
  wall('office-n', [[11, 0], [21, 0]], 0.2, [win('win-office-1', 1.8, 1.2, 1.0, 1.2), win('win-office-2', 4.9, 1.2, 1.0, 1.2), win('win-meeting', 8.45, 1.2, 1.0, 1.2)]),
  wall('office-e', [[21, 0], [21, 8]], 0.2, [win('win-meeting-2', 2.25, 1.2, 1.0, 1.2)]),
  wall('office-s', [[21, 8], [11, 8]], 0.2, [door('door-office', 4.0, 0.9, 3)]),
  wall('office-w', [[11, 8], [11, 0]], 0.2),
  wall('meeting-w', [[18, 0], [18, 4.5]], 0.1, [door('door-meeting', 3.6, 0.9, 2)]),
  wall('meeting-s', [[18, 4.5], [21, 4.5]], 0.1),
];
const room = (id, name, number, x0, z0, x1, z1) => ({ id, name, number, profile: { outerRing: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] } });
const spaces = [
  room('r-kitchen', 'Kitchen', '0.01', 0.1, 0.1, 3.55, 2.95), room('r-bath', 'Bathroom', '0.02', 3.65, 0.1, 6.35, 2.95),
  room('r-bed2', 'Bedroom 2', '0.03', 6.45, 0.1, 9.9, 2.95), room('r-hall', 'Hall', '0.04', 0.1, 3.05, 9.9, 4.15),
  room('r-living', 'Living', '0.05', 0.1, 4.25, 6.35, 7.9), room('r-bed1', 'Bedroom 1', '0.06', 6.45, 4.25, 9.9, 7.9),
  { id: 'r-office', name: 'Office', number: '1.01', profile: { outerRing: [[11.1, 0.1], [17.95, 0.1], [17.95, 4.55], [20.9, 4.55], [20.9, 7.9], [11.1, 7.9]] } },
  room('r-meeting', 'Meeting', '1.02', 18.05, 0.1, 20.9, 4.45),
];

// [instance id, block slug, x, z, rotationYDeg, y]. A block's back is at -z: 0 puts it on a north wall,
// 180 on a south wall, 90 on a west wall, -90 on an east wall (docs/drafting-standard.md §1).
const desks = [12.0, 13.6, 15.2, 16.8];
const placed = [
  ['k-fridge', 'fridge-freezer', 0.4, 0.425], ['k-base-sink', 'base-unit-1000', 1.2, 0.4], ['k-sink', 'kitchen-sink', 1.2, 0.35],
  ['k-base-hob', 'base-unit-600', 2.0, 0.4], ['k-hob', 'hob', 2.0, 0.36], ['k-hood', 'extractor-hood', 2.0, 0.35],
  ['k-washer', 'washing-machine', 2.6, 0.4], ['k-wall-unit', 'wall-unit-600', 2.6, 0.275], ['k-dishwasher', 'dishwasher', 3.2, 0.4],
  ['k-pendant', 'pendant-light', 1.8, 1.4],
  ['b-shower', 'shower-enclosure', 4.1, 0.55], ['b-bath', 'bathtub', 5.5, 0.45], ['b-wc', 'wc', 5.8, 2.625, 180],
  ['b-basin', 'wash-basin', 4.9, 2.725, 180], ['b-light', 'downlight', 5.0, 1.5],
  ['r2-bed', 'single-bed', 8.85, 1.2, -90], ['r2-bedside', 'bedside-table', 9.7, 2.0, -90], ['r2-wardrobe', 'wardrobe', 6.75, 1.0, 90],
  ['r2-radiator', 'radiator', 8.2, 0.15], ['r2-pendant', 'pendant-light', 8.0, 1.9],
  ['h-light-1', 'downlight', 1.5, 3.6], ['h-light-2', 'downlight', 5.5, 3.6], ['h-light-3', 'downlight', 8.8, 3.6], ['h-wall-light', 'wall-light', 6.0, 3.1],
  ['l-sofa', 'minimal-sofa', 0.55, 6.0, 90], ['l-coffee', 'coffee-table', 1.6, 6.0, 90], ['l-armchair', 'armchair', 2.75, 6.0, -90],
  ['l-table', 'dining-table-4', 4.7, 6.1], ['l-chair-1', 'simple-chair', 4.4, 5.55], ['l-chair-2', 'simple-chair', 5.0, 5.55],
  ['l-chair-3', 'simple-chair', 4.4, 6.65, 180], ['l-chair-4', 'simple-chair', 5.0, 6.65, 180],
  ['l-sideboard', 'sideboard', 4.7, 4.475], ['l-tv', 'television', 4.7, 4.28], ['l-floor-lamp', 'floor-lamp', 0.4, 7.5],
  ['l-radiator-1', 'radiator', 1.8, 7.85, 180], ['l-radiator-2', 'radiator', 4.7, 7.85, 180],
  ['l-pendant-1', 'pendant-light', 1.6, 6.0], ['l-pendant-2', 'pendant-light', 4.7, 6.1],
  ['r1-bed', 'double-bed', 8.85, 6.0, -90], ['r1-bedside-1', 'bedside-table', 9.7, 5.0, -90], ['r1-bedside-2', 'bedside-table', 9.7, 7.0, -90],
  ['r1-lamp-1', 'table-lamp', 9.7, 5.0, 0, 0.55], ['r1-lamp-2', 'table-lamp', 9.7, 7.0, 0, 0.55],
  ['r1-wardrobe-1', 'wardrobe', 6.75, 5.6, 90], ['r1-wardrobe-2', 'wardrobe', 6.75, 6.6, 90], ['r1-chest', 'chest-of-drawers', 7.3, 7.675, 180],
  ['r1-radiator', 'radiator', 8.6, 7.85, 180], ['r1-pendant', 'pendant-light', 7.6, 6.0],
  ...desks.flatMap((x, i) => [[`o-desk-${i + 1}`, 'office-desk', x, 0.5], [`o-pedestal-${i + 1}`, 'desk-pedestal', x + 0.525, 0.51],
    [`o-chair-${i + 1}`, 'office-chair', x, 1.25, 180], [`o-light-${i + 1}`, 'ceiling-luminaire-1200', x, 1.0]]),
  ['o-light-5', 'ceiling-luminaire-1200', 13.0, 4.5], ['o-light-6', 'ceiling-luminaire-1200', 16.0, 4.5],
  ['o-filing-1', 'filing-cabinet', 11.5, 7.59, 180], ['o-filing-2', 'filing-cabinet', 12.0, 7.59, 180],
  ['o-copier', 'photocopier', 13.2, 7.55, 180], ['o-cooler', 'water-cooler', 14.2, 7.725, 180],
  ['o-radiator-1', 'radiator', 15.5, 7.85, 180], ['o-radiator-2', 'radiator', 19.3, 7.85, 180],
  ['o-plant', 'potted-plant', 20.55, 7.55], ['o-bookshelf', 'bookshelf', 20.75, 6.2, -90], ['o-cabinet', 'cabinet', 11.325, 4.5, 90],
  ['m-table', 'meeting-table', 19.45, 2.25, 90], ['m-light', 'ceiling-luminaire-1200', 19.45, 2.25, 90],
  ['m-chair-1', 'stacking-chair', 18.65, 1.75, 90], ['m-chair-2', 'stacking-chair', 18.65, 2.75, 90],
  ['m-chair-3', 'stacking-chair', 20.25, 1.75, -90], ['m-chair-4', 'stacking-chair', 20.25, 2.75, -90],
].map(([id, slug, x, z, rotationYDeg = 0, y = 0]) => ({ id, block: block(slug), x, y, z, rotationYDeg }));
if (broken === 'height') placed.find((p) => p.id === 'k-hood').y = 0.01; // the hood 10 mm too high

// ── The project: one storey, the four views; the blocks go in through the session's commands ──
const omitted = placed.filter((p) => NOT_DRAWN[p.block.slug]);
const drawn = (ids) => ids.filter((id) => !omitted.some((p) => p.id === id));
const kitchenIds = drawn(placed.filter((p) => p.id.startsWith('k-')).map((p) => p.id));
const deskIds = drawn(placed.filter((p) => /^o-(desk|pedestal|chair|light-[1-4])/.test(p.id)).map((p) => p.id));
const allIds = [...walls.map((w) => w.id), ...spaces.map((s) => s.id), ...placed.map((p) => p.id)];
// Rooms cannot be listed in a section's ids (Floorkit: SPACECONTAINER has no physical drawing), so the section lists walls and blocks.
const sectionIds = drawn([...walls.map((w) => w.id), ...placed.map((p) => p.id)]);
const views = [
  { id: 'plan', name: 'Ground floor plan', kind: 'plan', storeyId: 'ground', cutHeightAboveStorey: 1.2,
    ...(broken === 'plan' ? { elementIds: allIds.filter((id) => id !== 'l-floor-lamp') } : {}) },
  { id: 'section-a', name: 'Section A, kitchen and bathroom', kind: 'section', line: { start: [-1, 1.65], end: [10.5, 1.65] },
    lookSide: 'left', depth: 1.65, elementIds: sectionIds, verticalCrop: { minY: -0.3, maxY: 2.8 }, settings: { levelLabels: { datum: 0, unit: 'm' } } },
  { id: 'elevation-kitchen', name: 'Kitchen wall', kind: 'elevation', origin: [1.8, 2.8], lookDirection: [0, -1],
    crop: { left: -1.9, right: 1.9, bottom: -2.7, top: 0.2 }, elementIds: ['flat-n', ...kitchenIds] },
  { id: 'elevation-office', name: 'Office desk wall', kind: 'elevation', origin: [14.4, 2.6], lookDirection: [0, -1],
    crop: { left: -3.5, right: 3.7, bottom: -2.7, top: 0.2 }, elementIds: ['office-n', ...deskIds] },
];
const model = { schema: 'floorkit.building-model', version: 3, units: 'meters', upAxis: 'y', id: 'catalog-demo', assets: {},
  buildings: [{ id: 'building', storeys: [{ id: 'ground', name: 'Ground floor', elevation: 0, height: H, walls, spaces, instances: [] }] }] };
const project = { schema: 'floorkit.project', version: 3, buildingModel: model, views, paper: { version: 1, unitSystem: 'metric', sheets: [] } };

const used = [...blocks.values()];
const assetSources = Object.fromEntries(used.map((b) => [b.uri, b.text]));
const manager = new F.ProjectManager(project, { build: { assetSources } });
const where = { buildingId: 'building', storeyId: 'ground' };
manager.apply({ kind: 'batch', commands: [
  ...used.map((b) => ({ kind: 'add-asset', assetId: b.slug, asset: { kind: 'external-op', uri: b.uri } })),
  ...placed.map((p) => ({ kind: 'add-element', ...where, list: 'instances',
    element: { id: p.id, assetRef: p.block.slug, position: [p.x, p.y, p.z], ...(p.rotationYDeg ? { rotationYDeg: p.rotationYDeg } : {}) } })),
] });
const live = (id, m = manager) => m.session.currentBuild.elementsById.get(id);
const failures = [];
const fail = (line) => { failures.push(line); console.log(`FAIL ${line}`); };
console.log(`placed ${placed.length} instance(s) of ${used.length} distinct block(s): ${used.map((b) => b.id).join(', ')}`);
if (used.length < 30) fail(`only ${used.length} distinct blocks; the demo needs at least 30`);

// ── Drawings: each view on a bare page fitted to it, at 1:50, through Floorkit's paper emitter ──
mkdirSync(OUT, { recursive: true });
const snapshot = manager.snapshot();
for (const p of omitted) console.log(`not drawn in the section and elevations: ${p.id} (${p.block.id}), ${NOT_DRAWN[p.block.slug]}`);
const drawings = {};
for (const v of views) {
  try {
    drawings[v.id] = F.drawProjectView(snapshot, v.id);
  } catch (error) {
    fail(`${v.id} does not draw: ${error.code ?? error.name}: ${String(error.message).split('\n')[0]}`);
  }
}
const sheets = views.filter((v) => drawings[v.id]).map((v) => {
  const { min, max } = drawings[v.id].bounds;
  const [width, height] = [(max.x - min.x) * 20 + 20, (max.y - min.y) * 20 + 20];
  return { id: v.id, name: v.name, page: { format: 'Custom', orientation: width >= height ? 'landscape' : 'portrait', size: { width, height }, margin: 0 },
    viewports: [{ id: `${v.id}-vp`, viewId: v.id, frame: { x: 0, y: 0, width, height }, scale: 0.02, rotationDeg: 0, clip: true,
      viewCenter: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 } }], annotations: [] };
});
const withSheets = { ...snapshot, paper: { ...snapshot.paper, sheets } };
for (const { id } of sheets) writeFileSync(path.join(OUT, `${id}-1-50.svg`), F.exportProjectSheet(withSheets, id, 'svg'));
console.log(`wrote ${sheets.map(({ id }) => `${id}-1-50.svg`).join(', ')}`);

// ── Every placed block draws in the plan ──
const inPlan = new Set((drawings.plan?.primitives ?? []).map((p) => p.sourceRef?.elementId).filter(Boolean));
const missing = placed.filter((p) => !inPlan.has(p.id)).map((p) => p.id);
if (missing.length > 0) fail(`missing from the plan: ${missing.join(', ')}`);
else console.log(`plan: all ${placed.length} placed blocks draw (1:50)`);

// ── The four heights, from the built bodies and from the section ──
const box = (object) => new THREE.Box3().setFromObject(object);
// The bodies' own parts: a box of the whole element also holds its anchors, which sit on the floor.
const parts = (id, prefix = '') => live(id).getPhysicalParts().filter((p) => p.name.startsWith(prefix)).map(box);
const top = (id, prefix) => Math.max(...parts(id, prefix).map((b) => b.max.y));
const bottom = (id) => Math.min(...parts(id).map((b) => b.min.y));
// In the section, height is -y; a block's level edge at height h is a horizontal line of that block.
const sectionLevels = (id) => (drawings['section-a']?.primitives ?? [])
  .filter((p) => p.kind === 'line' && p.sourceRef?.elementId === id && Math.abs(p.start.y - p.end.y) < 1e-6).map((p) => -p.start.y);
const near = (levels, h) => levels.reduce((best, y) => (Math.abs(y - h) < Math.abs(best - h) ? y : best), Infinity);
const heights = [
  ['counter top', 0.90, 'k-base-hob', top('k-base-hob', 'worktop')],
  ['bath rim', 0.55, 'b-bath', top('b-bath', 'rim')],
  ['hood underside', 1.55, 'k-hood', bottom('k-hood')],
  ['pendant bottom', 2.00, 'k-pendant', bottom('k-pendant')],
];
const wallLevels = (drawings['section-a']?.primitives ?? []).filter((p) => p.style?.ogType === 'WALL' && p.kind === 'line').flatMap((p) => [-p.start.y, -p.end.y]);
const [wallBottom, wallTop] = [Math.min(...wallLevels), Math.max(...wallLevels)]; // no lines: Infinity and -Infinity, which fail
const wallLine = `section A: wall lines from ${wallBottom.toFixed(3)} to ${wallTop.toFixed(3)}`;
if (!(Math.abs(wallBottom) <= TOLERANCE && Math.abs(wallTop - H) <= TOLERANCE)) fail(wallLine);
else console.log(wallLine);
for (const [name, want, id, built] of heights) {
  const cut = near(sectionLevels(id), want);
  const off = Math.max(Math.abs(built - want), Math.abs(cut - want));
  const line = `${name} ${want.toFixed(2)}: built ${built.toFixed(3)}, section ${Number.isFinite(cut) ? cut.toFixed(3) : 'no line'} (${id})`;
  if (!(off <= TOLERANCE)) fail(line);
  else console.log(line);
}

// ── The semantic IFC request: one class per block, the class its .op names ──
if (broken === 'ifc') { // the sofa's definition naming IfcFurnishingElement, as if its class were lost on the way
  const definition = JSON.parse(block('minimal-sofa').text);
  definition.metadata['ifc:class'] = 'IfcFurnishingElement';
  manager.apply({ kind: 'replace-asset', assetId: 'minimal-sofa', asset: { kind: 'embedded-op', definition } });
}
const built = [...manager.session.currentBuild.elementsById.values()];
// Floorkit refuses wall-network walls in this request ("does not yet support WallNetwork walls"), so walls are left out.
const { request, warnings } = new F.SemanticIfc.SemanticIfcExtractor().extract(built.filter((e) => e.ogType !== 'WALL'));
writeFileSync(path.join(OUT, 'ifc-request.json'), `${JSON.stringify(request, null, 2)}\n`);
const byId = new Map(request.elements.map((e) => [e.id, e]));
const classes = {};
for (const p of placed) {
  const got = byId.get(p.id)?.ifcClass;
  classes[got ?? 'none'] = (classes[got ?? 'none'] ?? 0) + 1;
  if (got && got === p.block.ifcClass) continue;
  if (!got && p.block.ifcClass === 'IfcDoor') console.log(`FLO-235: ${p.id} (${p.block.id}) reaches the request with no class`);
  else fail(`IFC class of ${p.id} (${p.block.id}): ${got ?? 'none'}, the block names ${p.block.ifcClass ?? 'none'}`);
}
const kinds = {};
for (const e of request.elements) kinds[e.type] = (kinds[e.type] ?? 0) + 1;
console.log(`IFC request: ${request.elements.length} element(s) by type ${JSON.stringify(kinds)}; ${warnings.length} warning(s); walls left out`);
console.log(`IFC classes of the ${placed.length} blocks: ${Object.entries(classes).map(([k, n]) => `${k} ${n}`).join(', ')}`);
// Floorkit's distribution path takes a ported block's class from the .op's legacy metadata.ifcClass, not from ifc:class.
const ported = placed.filter((p) => byId.get(p.id)?.type === 'DISTRIBUTION_EQUIPMENT');
console.log(`FLO-236: ${ported.length} ported block(s) take their class from the legacy ifcClass key`);

// ── Save, open again with no sources, rebuild: the same ids and boxes ──
const text = manager.save();
const reopened = F.ProjectManager.open(text);
if (broken === 'roundtrip') {
  const sofa = reopened.snapshot().buildingModel.buildings[0].storeys[0].instances.find((i) => i.id === 'l-sofa');
  reopened.apply({ kind: 'replace-element', ...where, list: 'instances', elementId: 'l-sofa', element: { ...sofa, position: [sofa.position[0] + 0.01, 0, sofa.position[2]] } });
}
const boxes = (m) => Object.fromEntries([...m.session.currentBuild.elementsById].map(([id, e]) => {
  const b = box(e);
  return [id, b.isEmpty() ? null : [...b.min.toArray(), ...b.max.toArray()].map((v) => Math.round(v * 1e6) / 1e6)];
}));
const [before, after] = [boxes(manager), boxes(reopened)];
const idsEqual = JSON.stringify(Object.keys(before).sort()) === JSON.stringify(Object.keys(after).sort());
const differ = Object.keys(before).filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]));
const roundtrip = { savedBytes: text.length, savedSources: Object.keys(JSON.parse(text).assetSources ?? {}).length,
  elements: Object.keys(before).length, idsEqual, boxesDiffer: differ, equal: idsEqual && differ.length === 0, boxes: before };
writeFileSync(path.join(OUT, 'roundtrip.json'), `${JSON.stringify(roundtrip, null, 2)}\n`);
const summary = `round trip: saved ${text.length} bytes with ${roundtrip.savedSources} block source(s); reopened without sources; ${roundtrip.elements} element ids ${idsEqual ? 'equal' : 'DIFFER'}, ${differ.length} box(es) differ`;
if (!roundtrip.equal) fail(`${summary}: ${differ.join(', ')}`);
else console.log(summary);
reopened.dispose();
manager.dispose();

console.log(failures.length === 0 ? `\ndemo holds; pictures in ${path.relative(process.cwd(), OUT) || '.'}` : `\n${failures.length} check(s) failed.`);
process.exitCode = failures.length === 0 ? 0 : 1;
