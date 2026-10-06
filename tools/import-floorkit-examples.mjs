#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * The catalog's 26 seed blocks, imported from the Floorkit SDK's example
 * catalog, reproducibly.
 *
 *   node tools/import-floorkit-examples.mjs <path/to/OpenPlans> [--check]
 *
 * It reads `examples/src/catalog/assets/**\/*.op` OUT OF GIT, never the
 * working tree, and first proves that tree is the one released as Floorkit
 * v0.6.1 (commit 8a964fb): its hash must be EXPECTED_TREE below. The same
 * tree is still on main at 681e4f1, so the result does not depend on which
 * of those two commits you check out.
 *
 * `--check` writes nothing and exits 1 if any file would change.
 *
 * Per file, from the table and never by guessing:
 * - `id` becomes `floorkit.<slug>`, and four authoring-artefact labels are
 *   replaced (the same four Parti replaced);
 * - legacy geometry Floorkit 0.6 no longer reads is translated:
 *   `cylinder.segments` is dropped (it was already ignored), and an arc's
 *   `endAngle` becomes `sweepAngle = endAngle - startAngle` (its `segments`
 *   dropped). Any other legacy key is an error;
 * - source metadata maps to the catalog vocabulary: `note` becomes
 *   `catalog:note`; `catalogCategory`, `catalogId` and `authoringMode` are
 *   dropped (the path and `catalog:category` now say it); bed.op's
 *   `aeco*` / `sourceWorkflow` keys are dropped and recorded in CHANGELOG.md;
 *   `ifcClass` is KEPT on the five assets that have it, because Floorkit
 *   0.6's IFC export reads that exact key, and `ifc:class` is set beside it.
 *   An unknown source key is an error, so nothing is lost silently;
 * - a value Floorkit would silently clamp is written as the value Floorkit
 *   actually builds, listed per row in `fixes` and asserted against the
 *   source (one today: bed.op's 6 mm drain, built 10 mm tall);
 * - the catalog keys are stamped: version 1.0.0, CC-BY-4.0, attribution,
 *   category, placement, tags, `catalog:basedOn` (source file and id), IFC
 *   class only where certain, and a material ROLE per node.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { formatBlock } from './lib/op.mjs';
import { ROOT } from './lib/repo.mjs';

const EXPECTED_TREE = 'ea7f7f86cc11e9130934462b1be4e32ef71ca6c6';
const RELEASE = '8a964fb';
const ASSETS = 'examples/src/catalog/assets';
const VERSION = '1.0.0';
const PUBLISHER = 'floorkit';
const ATTRIBUTION = 'Vishwajeet Mane';

/**
 * One row per source file. `ifc` is [class, predefinedType?], set only where
 * the IFC4 entity is certain: a hob could be gas or electric, so it has none.
 * `materials` gives a node's role. A node not listed has no role.
 */
const TABLE = {
  'datacenter/chiller.op': {
    slug: 'chiller',
    category: 'equipment',
    tags: ['data centre', 'cooling'],
    ifc: ['IfcChiller'],
    materials: { 'chiller-fan-a': 'metal', 'chiller-fan-b': 'metal' },
  },
  'datacenter/crah.op': {
    slug: 'crah',
    label: 'CRAH Unit',
    category: 'equipment',
    tags: ['data centre', 'air handler', 'cooling'],
    ifc: ['IfcUnitaryEquipment'],
    materials: { 'crah-grille': 'metal' },
  },
  'datacenter/pdu.op': {
    slug: 'pdu',
    category: 'equipment',
    tags: ['data centre', 'power'],
    ifc: ['IfcElectricDistributionBoard'],
    materials: {},
  },
  'datacenter/rdhx.op': {
    slug: 'rear-door-heat-exchanger',
    category: 'equipment',
    tags: ['data centre', 'cooling', 'rdhx'],
    ifc: ['IfcCoil', 'WATERCOOLINGCOIL'],
    materials: { 'rdhx-body': 'metal' },
  },
  'datacenter/ups.op': {
    slug: 'ups',
    category: 'equipment',
    tags: ['data centre', 'power'],
    ifc: ['IfcElectricFlowStorageDevice', 'UPS'],
    materials: { 'ups-panel': 'frame' },
  },
  // Named bed.op in the source; labelled, shaped and dimensioned as a bathtub.
  'furnishing/bed.op': {
    slug: 'rectangular-bathtub',
    category: 'sanitary',
    tags: ['bath', 'bathroom'],
    ifc: ['IfcSanitaryTerminal', 'BATH'],
    // Floorkit clamps every cylinder height to at least 0.01 m, so this 6 mm
    // drain was always BUILT 10 mm tall. Writing what Floorkit draws changes
    // nothing on screen and lets the strict schema hold.
    fixes: [{ node: 'drain', field: 'height', from: 0.006, to: 0.01 }],
    materials: {
      'rim-deck': 'ceramic',
      'tub-basin-floor': 'ceramic',
      'basin-wall-back': 'ceramic',
      'basin-wall-front': 'ceramic',
      'basin-wall-left': 'ceramic',
      'basin-wall-right': 'ceramic',
      drain: 'metal',
      'faucet-base': 'metal',
      'faucet-body': 'metal',
      'spout-arm': 'metal',
      'spout-outlet': 'metal',
    },
  },
  'furnishing/cafe-counter.op': {
    slug: 'cafe-counter',
    category: 'tables',
    tags: ['counter', 'cafe', 'hospitality'],
    ifc: ['IfcFurniture'],
    materials: { kick: 'frame' },
  },
  'furnishing/kitchen-counter.op': {
    slug: 'kitchen-counter',
    category: 'kitchen',
    tags: ['counter', 'worktop'],
    ifc: ['IfcFurniture'],
    materials: { kick: 'frame', hob: 'frame', splashback: 'ceramic' },
  },
  'furnishing/minimal-sofa.op': {
    slug: 'minimal-sofa',
    category: 'seating',
    tags: ['sofa', 'couch', 'living'],
    ifc: ['IfcFurniture', 'SOFA'],
    materials: {
      'base-plinth': 'frame',
      'seat-deck': 'soft',
      backrest: 'soft',
      'arm-left': 'soft',
      'arm-right': 'soft',
      'seat-left': 'soft',
      'seat-right': 'soft',
    },
  },
  'furnishing/office-desk.op': {
    slug: 'office-desk',
    category: 'tables',
    tags: ['desk', 'workstation', 'office'],
    ifc: ['IfcFurniture', 'DESK'],
    materials: {
      'leg-left': 'frame',
      'leg-right': 'frame',
      'monitor-stand': 'frame',
      'monitor-screen': 'frame',
      'chair-seat': 'soft',
      'chair-back': 'soft',
      'chair-post': 'metal',
      'chair-base': 'metal',
    },
  },
  'furnishing/simple-chair.op': {
    slug: 'simple-chair',
    category: 'seating',
    tags: ['chair', 'dining'],
    ifc: ['IfcFurniture', 'CHAIR'],
    materials: {
      'leg-front-left': 'frame',
      'leg-front-right': 'frame',
      'leg-back-left': 'frame',
      'leg-back-right': 'frame',
    },
  },
  'furnishing/sketch-cabinet.op': {
    slug: 'cabinet',
    label: 'Cabinet',
    category: 'storage',
    tags: ['cupboard', 'sideboard'],
    ifc: ['IfcFurniture'],
    materials: {
      'handle-top-left': 'metal',
      'handle-top-right': 'metal',
      'handle-bottom-left': 'metal',
      'handle-bottom-right': 'metal',
    },
  },
  'furnishing/sketch-table.op': {
    slug: 'table',
    label: 'Table',
    category: 'tables',
    tags: ['dining', 'table'],
    ifc: ['IfcFurniture', 'TABLE'],
    materials: {
      'leg-front-left': 'frame',
      'leg-front-right': 'frame',
      'leg-back-left': 'frame',
      'leg-back-right': 'frame',
      'stretcher-left': 'frame',
      'stretcher-right': 'frame',
      'center-support': 'frame',
    },
  },
  // A WC and a basin in one: two terminals, so no single predefined type.
  'furnishing/wc-fixture.op': {
    slug: 'wc-and-basin',
    label: 'WC and Basin',
    category: 'sanitary',
    tags: ['wc', 'toilet', 'basin', 'cloakroom'],
    ifc: ['IfcSanitaryTerminal'],
    materials: {
      'wc-pan': 'ceramic',
      'wc-cistern': 'ceramic',
      'basin-bowl': 'ceramic',
      'basin-pedestal': 'ceramic',
    },
  },
  'kitchen/counter-run.op': {
    slug: 'counter-run',
    category: 'kitchen',
    tags: ['counter', 'worktop', 'base units'],
    ifc: ['IfcFurniture'],
    materials: { kick: 'frame' },
  },
  'kitchen/hob.op': {
    slug: 'hob',
    category: 'appliances',
    tags: ['kitchen', 'cooktop'],
    materials: { plate: 'frame' },
  },
  'kitchen/sink.op': {
    slug: 'kitchen-sink',
    category: 'kitchen',
    tags: ['sink'],
    ifc: ['IfcSanitaryTerminal', 'SINK'],
    materials: { bowl: 'metal', tap: 'metal' },
  },
  'landscape/car.op': {
    slug: 'parked-car',
    category: 'vehicles',
    tags: ['car', 'parking'],
    materials: {
      'glass-front': 'glass',
      'glass-rear': 'glass',
      'wheel-fl': 'frame',
      'wheel-fr': 'frame',
      'wheel-rl': 'frame',
      'wheel-rr': 'frame',
    },
  },
  'landscape/planter.op': {
    slug: 'planter',
    category: 'planting',
    tags: ['planter', 'shrub'],
    materials: {
      soil: 'frame',
      'shrub-left': 'planting',
      'shrub-mid': 'planting',
      'shrub-right': 'planting',
    },
  },
  'landscape/tree.op': {
    slug: 'tree',
    category: 'planting',
    tags: ['tree', 'landscape'],
    ifc: ['IfcGeographicElement'],
    materials: { trunk: 'frame', canopy: 'planting' },
  },
  'openings/glazed-door-assembly.op': {
    slug: 'glazed-door',
    category: 'openings',
    placement: 'hosted',
    tags: ['door', 'vision panel'],
    ifc: ['IfcDoor', 'DOOR'],
    materials: { frameSolid: 'frame', glassInset: 'glass' },
  },
  'sanitary/bathtub.op': {
    slug: 'bathtub',
    category: 'sanitary',
    tags: ['bath', 'bathroom'],
    ifc: ['IfcSanitaryTerminal', 'BATH'],
    materials: { shell: 'ceramic', basin: 'ceramic' },
  },
  'sanitary/shower-tray.op': {
    slug: 'shower-tray',
    category: 'sanitary',
    tags: ['shower', 'bathroom'],
    ifc: ['IfcSanitaryTerminal', 'SHOWER'],
    materials: { tray: 'ceramic' },
  },
  'sanitary/wash-basin.op': {
    slug: 'wash-basin',
    category: 'sanitary',
    tags: ['basin', 'sink', 'bathroom'],
    ifc: ['IfcSanitaryTerminal', 'WASHHANDBASIN'],
    materials: { bowl: 'ceramic', pedestal: 'ceramic', tap: 'metal' },
  },
  'sanitary/washing-machine.op': {
    slug: 'washing-machine',
    category: 'appliances',
    tags: ['laundry', 'utility'],
    ifc: ['IfcElectricAppliance', 'WASHINGMACHINE'],
    materials: { door: 'glass' },
  },
  'sanitary/wc.op': {
    slug: 'wc',
    category: 'sanitary',
    tags: ['toilet', 'wc', 'bathroom'],
    ifc: ['IfcSanitaryTerminal', 'TOILETPAN'],
    materials: { pan: 'ceramic', cistern: 'ceramic' },
  },
};

/** Source metadata keys this import knows what to do with. Anything else stops it. */
const DROPPED = new Set(['catalogCategory', 'catalogId', 'authoringMode', 'aecoFamily', 'aecoCategory', 'aecoSubtype', 'sourceWorkflow']);
const KNOWN = new Set([...DROPPED, 'note', 'ifcClass']);

function translateNode(node, context) {
  if (node === null || typeof node !== 'object') return node;
  const { endAngle, segments, ...rest } = node;
  if (node.kind === 'arc') {
    if (endAngle !== undefined && rest.sweepAngle !== undefined) {
      throw new Error(`${context} carries both endAngle and sweepAngle`);
    }
    if (endAngle === undefined) return rest;
    const translated = {};
    // Keep the author's key order, with sweepAngle where endAngle was.
    for (const [key, value] of Object.entries(node)) {
      if (key === 'segments') continue;
      if (key === 'endAngle') translated.sweepAngle = endAngle - (node.startAngle ?? 0);
      else translated[key] = value;
    }
    return translated;
  }
  if (node.kind === 'cylinder') return rest;
  if (endAngle !== undefined || segments !== undefined) {
    throw new Error(`${context} carries a legacy key on a ${String(node.kind)}`);
  }
  return node;
}

function applyFixes(file, definition, fixes = []) {
  for (const fix of fixes) {
    const nodes = [...definition.profileView.elements, ...definition.modelView.elements, ...Object.values(definition.definitions ?? {})];
    const matches = nodes.filter((node) => node.id === fix.node);
    if (matches.length !== 1) throw new Error(`${file}: fix names node "${fix.node}", found ${matches.length}`);
    const [node] = matches;
    if (node[fix.field] !== fix.from) {
      throw new Error(`${file}: fix expects ${fix.node}.${fix.field} = ${fix.from}, found ${node[fix.field]}`);
    }
    node[fix.field] = fix.to;
  }
  return definition;
}

function translateView(view, name) {
  return { ...view, elements: view.elements.map((node, index) => translateNode(node, `${name}.elements[${index}]`)) };
}

function seed(file, source) {
  const row = TABLE[file];
  const sourceMeta = source.metadata ?? {};
  const unknown = Object.keys(sourceMeta).filter((key) => !KNOWN.has(key));
  if (unknown.length > 0) throw new Error(`${file}: unhandled source metadata ${unknown.join(', ')}`);
  if (sourceMeta.ifcClass !== undefined && sourceMeta.ifcClass !== row.ifc?.[0]) {
    throw new Error(`${file}: source ifcClass "${sourceMeta.ifcClass}" disagrees with the table's ${row.ifc?.[0]}`);
  }
  for (const node of Object.keys(row.materials)) {
    const ids = new Set([
      ...Object.keys(source.definitions ?? {}),
      ...source.profileView.elements.map((element) => element.id),
      ...source.modelView.elements.map((element) => element.id),
    ]);
    if (!ids.has(node)) throw new Error(`${file}: material row names "${node}", which the source does not have`);
  }

  const metadata = {
    'catalog:version': VERSION,
    'catalog:license': 'CC-BY-4.0',
    'catalog:attribution': ATTRIBUTION,
    'catalog:category': row.category,
    'catalog:placement': row.placement ?? 'free',
    'catalog:tags': row.tags.join(', '),
    'catalog:basedOn': `OpenGeometry-io/OpenPlans@${RELEASE}:${ASSETS}/${file}#${source.id}`,
    ...(sourceMeta.note !== undefined ? { 'catalog:note': sourceMeta.note } : {}),
    ...(row.ifc?.[0] ? { 'ifc:class': row.ifc[0] } : {}),
    ...(row.ifc?.[1] ? { 'ifc:predefinedType': row.ifc[1] } : {}),
    ...(sourceMeta.ifcClass !== undefined ? { ifcClass: sourceMeta.ifcClass } : {}),
    ...Object.fromEntries(Object.entries(row.materials).map(([node, role]) => [`mat:${node}`, role])),
  };

  // Floorkit's own serialisation order.
  const definition = {
    version: source.version,
    id: `${PUBLISHER}.${row.slug}`,
    labelName: row.label ?? source.labelName,
    type: source.type,
    dimensions: source.dimensions,
    ...(source.placement ? { placement: source.placement } : {}),
    metadata,
    ...(source.anchors ? { anchors: source.anchors } : {}),
    ...(source.ports ? { ports: source.ports } : {}),
    ...(source.definitions
      ? {
          definitions: Object.fromEntries(
            Object.entries(source.definitions).map(([key, node]) => [key, translateNode(node, `definitions.${key}`)]),
          ),
        }
      : {}),
    profileView: translateView(source.profileView, 'profileView'),
    modelView: translateView(source.modelView, 'modelView'),
  };
  applyFixes(file, definition, row.fixes);
  const known = new Set(['version', 'id', 'labelName', 'type', 'dimensions', 'placement', 'metadata', 'anchors', 'ports', 'definitions', 'profileView', 'modelView']);
  const extra = Object.keys(source).filter((key) => !known.has(key));
  if (extra.length > 0) throw new Error(`${file}: unhandled top-level key(s) ${extra.join(', ')}`);
  return { row, definition };
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const source = args.find((arg) => !arg.startsWith('--'));
  if (!source) {
    console.error('usage: node tools/import-floorkit-examples.mjs <path/to/OpenPlans> [--check]');
    process.exit(2);
  }
  const git = (...gitArgs) => execFileSync('git', ['-C', source, ...gitArgs], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const tree = git('rev-parse', `HEAD:${ASSETS}`).trim();
  if (tree !== EXPECTED_TREE) {
    throw new Error(
      `${ASSETS} at HEAD is tree ${tree}, not the v0.6.1 tree ${EXPECTED_TREE}. ` +
        'Check out a commit whose example catalog is unchanged since 8a964fb.',
    );
  }
  const files = git('ls-tree', '-r', '--name-only', `HEAD:${ASSETS}`)
    .split('\n')
    .filter((name) => name.endsWith('.op'))
    .sort();
  const unknown = files.filter((file) => !TABLE[file]);
  const missing = Object.keys(TABLE).filter((file) => !files.includes(file));
  if (unknown.length > 0 || missing.length > 0) {
    throw new Error(`table and source disagree — unlisted: ${unknown.join(', ') || 'none'}; gone: ${missing.join(', ') || 'none'}`);
  }

  let changed = 0;
  for (const file of files) {
    const { row, definition } = seed(file, JSON.parse(git('show', `HEAD:${ASSETS}/${file}`)));
    const out = path.join(ROOT, 'blocks', PUBLISHER, row.slug, `${VERSION}.op`);
    const rel = path.relative(ROOT, out).split(path.sep).join('/');
    const text = formatBlock(definition);
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    if (!same) changed += 1;
    if (!check && !same) {
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, text);
    }
    console.log(`${same ? 'same   ' : check ? 'DIFFERS' : 'wrote  '} ${rel.padEnd(52)} ← ${file}`);
  }
  console.log(`\n${files.length} seed block(s) from tree ${EXPECTED_TREE.slice(0, 7)} (Floorkit v0.6.1, ${RELEASE}); ${changed} changed.`);
  if (check && changed > 0) process.exitCode = 1;
}

main();
