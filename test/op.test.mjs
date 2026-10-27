// SPDX-License-Identifier: Apache-2.0
// One rule, one case: each mutation of a valid block must fail, and fail FOR
// ITS OWN REASON — an assertion on "it failed" alone passes for the wrong cause.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { parseNote } from '../tools/lib/note.mjs';
import { LIMITS, checkBlockText, formatBlock, sha256Hex } from '../tools/lib/op.mjs';
import { PENDING_REDRAW } from '../tools/lib/pending-redraw.mjs';
import { ANCHOR_ROLES, PORTS } from '../tools/lib/roles.mjs';

const fixture = (name) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const base = () => JSON.parse(fixture('valid/chair.op'));
const check = (definition) => checkBlockText(formatBlock(definition));

/** Fails, and some issue matches `path` exactly and `message` as a substring. */
function rejects(definition, path, message) {
  const result = typeof definition === 'string' ? checkBlockText(definition) : check(definition);
  assert.equal(result.ok, false, 'expected the block to be rejected');
  const hit = result.issues.find((issue) => issue.path === path && issue.message.includes(message));
  assert.ok(hit, `no issue at ${path} containing "${message}"; got:\n${JSON.stringify(result.issues, null, 2)}`);
}

const box = (id, extra = {}) => ({ id, kind: 'cuboid', center: [0, 0.5, 0], width: 0.2, height: 0.2, depth: 0.2, ...extra });

test('the valid fixture and every seed block pass', () => {
  assert.deepEqual(checkBlockText(fixture('valid/chair.op')).issues, []);
  const root = new URL('../blocks/', import.meta.url);
  let count = 0;
  for (const publisher of readdirSync(root)) {
    for (const slug of readdirSync(new URL(`${publisher}/`, root))) {
      for (const file of readdirSync(new URL(`${publisher}/${slug}/`, root))) {
        const listed = { publisher, slug, version: file.replace(/\.op$/, '') };
        const result = checkBlockText(readFileSync(new URL(`${publisher}/${slug}/${file}`, root), 'utf8'), { listed });
        assert.deepEqual(result.issues, [], `${publisher}/${slug}/${file}`);
        count += 1;
      }
    }
  }
  const index = JSON.parse(readFileSync(new URL('../index.json', import.meta.url), 'utf8'));
  assert.equal(count, index.entries.length, 'blocks/ and index.json list different numbers of blocks');
});

test('the author-block skill\'s starter template passes', () => {
  const starter = readFileSync(new URL('../.claude/skills/author-block/starter.op', import.meta.url), 'utf8');
  assert.deepEqual(checkBlockText(starter).issues, []);
});

test('every Floorkit kernel-reject fixture is rejected by the catalog too', () => {
  const dir = new URL('fixtures/kernel-rejects/', import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  assert.ok(names.length >= 15, 'the kernel-reject set shrank');
  for (const name of names) {
    const result = checkBlockText(formatBlock(JSON.parse(readFileSync(new URL(name, dir), 'utf8'))));
    assert.equal(result.ok, false, `${name} passed the catalog but Floorkit rejects it`);
  }
});

test('legacy geometry Floorkit silently drops is refused', () => {
  const legacy = base();
  legacy.modelView.elements.push({ id: 'post', kind: 'cylinder', center: [0, 0.2, 0], radius: 0.02, height: 0.4, segments: 12 });
  rejects(legacy, '/modelView/elements/6', 'must NOT have additional properties "segments"');
  const arc = base();
  arc.profileView.elements.push({ id: 'swing', kind: 'arc', center: [0, 0], radius: 0.4, startAngle: 0, endAngle: 1.5 });
  rejects(arc, '/profileView/elements/6', 'additional properties "endAngle"');
});

test('values Floorkit would repair are refused', () => {
  const tiny = base();
  tiny.modelView.elements[0].height = 0.006;
  rejects(tiny, '/modelView/elements/0/height', 'must be >= 0.01');
  const wall = base();
  wall.type = 'WALL';
  rejects(wall, '/type', 'must be equal to one of the allowed values');
  const noId = base();
  delete noId.modelView.elements[0].id;
  rejects(noId, '/modelView/elements/0', "must have required property 'id'");
  const colour = base();
  colour.modelView.elements[0].color = '#abc';
  rejects(colour, '/modelView/elements/0/color', 'must match pattern');
  const moved = base();
  moved.placement.position = [1, 0, 0];
  rejects(moved, '/placement/position', 'must be equal to constant');
  const v2 = base();
  v2.version = 2;
  rejects(v2, '/version', 'must be equal to constant');
  const extra = base();
  extra.propertySets = {};
  rejects(extra, '/', 'additional properties "propertySets"');
  const twoPoints = base();
  twoPoints.profileView.elements[0].vertices = [[0, 0], [1, 0]];
  rejects(twoPoints, '/profileView/elements/0/vertices', 'must NOT have fewer than 3 items');
  const plan3d = base();
  plan3d.profileView.elements[0].vertices[0] = [0, 0, 0];
  rejects(plan3d, '/profileView/elements/0/vertices/0', 'must NOT have more than 2 items');
  const zeroSweep = base();
  zeroSweep.profileView.elements.push({ id: 'a', kind: 'arc', center: [0, 0], radius: 0.4, startAngle: 0, sweepAngle: 0 });
  rejects(zeroSweep, '/profileView/elements/6/sweepAngle', 'must NOT be valid');
});

test('the metadata vocabulary is closed and complete', () => {
  const note = base();
  note.metadata.note = 'free text';
  rejects(note, '/metadata', 'additional properties "note"');
  const noLicence = base();
  delete noLicence.metadata['catalog:license'];
  rejects(noLicence, '/metadata', "must have required property 'catalog:license'");
  const cc0 = base();
  cc0.metadata['catalog:license'] = 'CC0-1.0';
  rejects(cc0, '/metadata/catalog:license', 'must be equal to constant');
  const category = base();
  category.metadata['catalog:category'] = 'chairs';
  rejects(category, '/metadata/catalog:category', 'must be equal to one of the allowed values');
  const semver = base();
  semver.metadata['catalog:version'] = '01.0.0';
  rejects(semver, '/metadata/catalog:version', 'must match pattern');
  const tags = base();
  tags.metadata['catalog:tags'] = 'chair, dining, chair';
  rejects(tags, '/metadata/catalog:tags', 'repeats a tag');
  const html = base();
  html.labelName = '<b>Chair</b>';
  rejects(html, '/labelName', 'must match pattern');
  const link = base();
  link.labelName = 'Chair https://example.com';
  rejects(link, '/labelName', 'must match pattern');
  const role = base();
  role.metadata['mat:seat'] = 'oak';
  rejects(role, '/metadata/mat:seat', 'must be equal to one of the allowed values');
  const ghost = base();
  ghost.metadata['mat:armrest'] = 'frame';
  rejects(ghost, '/metadata/mat:armrest', 'names node "armrest"');
});

test('hosting, sills and IFC keys hold together', () => {
  const door = base();
  door.type = 'DOOR';
  rejects(door, '/metadata/catalog:placement', 'must be equal to constant');
  const hostedChair = base();
  hostedChair.metadata['catalog:placement'] = 'hosted';
  rejects(hostedChair, '/metadata/catalog:placement', 'must be equal to constant');
  const sill = base();
  sill.metadata['catalog:defaultSill'] = '0.9';
  rejects(sill, '/metadata', 'must NOT be valid');
  const mismatch = base();
  mismatch.metadata.ifcClass = 'IfcChiller';
  rejects(mismatch, '/metadata/ifcClass', 'must equal ifc:class');
  const orphan = base();
  delete orphan.metadata['ifc:class'];
  delete orphan.metadata['ifc:predefinedType'];
  orphan.metadata.ifcClass = 'IfcFurniture';
  rejects(orphan, '/metadata', 'must have property ifc:class when property ifcClass is present');
});

test('references resolve by own property, to the right kind, without loops or waste', () => {
  const proto = base();
  proto.modelView.elements.push({ ref: 'constructor' });
  rejects(proto, '/modelView/elements/6/ref', 'references unknown definition "constructor"');
  const unused = base();
  unused.definitions = { spare: box('spare') };
  rejects(unused, '/definitions/spare', 'is never used');
  const renamed = base();
  renamed.definitions = { leg: box('stool') };
  renamed.modelView.elements.push({ ref: 'leg' });
  rejects(renamed, '/definitions/leg/id', "id must equal its key");
  const dup = base();
  dup.modelView.elements.push(box('seat'));
  rejects(dup, '/modelView/elements/6/id', 'duplicates the id "seat"');
  const sweepBoth = base();
  sweepBoth.definitions = { p: { kind: 'polyline3d', points: [[0, 0, 0], [0, 1, 0]] } };
  sweepBoth.modelView.elements.push({ id: 's', kind: 'sweep', pathRef: 'p', profileRef: 'p', path: [[0, 0, 0], [0, 1, 0]] });
  rejects(sweepBoth, '/modelView/elements/6', 'must NOT be valid');
});

test('limits: nodes, expanded booleans, bytes', () => {
  const many = base();
  for (let index = 0; index < 400; index += 1) many.modelView.elements.push(box(`b${index}`));
  rejects(many, '/modelView/elements', 'must NOT have more than 400 items');

  // Each level uses the previous one twice: 22 levels validate in linear time
  // and would build 2^22 solids.
  const bomb = base();
  bomb.definitions = { l0: box('l0') };
  for (let level = 1; level <= 22; level += 1) {
    bomb.definitions[`l${level}`] = { kind: 'boolean3d', operation: 'union', baseRef: `l${level - 1}`, operandRefs: [`l${level - 1}`] };
  }
  bomb.modelView.elements.push({ ref: 'l22' });
  rejects(bomb, '/', `builds more than ${LIMITS.maxExpandedNodes} nodes`);

  const heavy = base();
  heavy.metadata['catalog:note'] = 'x'.repeat(500);
  heavy.profileView.elements.push({ id: 'big', kind: 'polyline', points: Array.from({ length: 1024 }, (_, i) => [i / 1000, 0.123456789]) });
  for (let index = 0; index < 8; index += 1) heavy.profileView.elements.push({ id: `big${index}`, kind: 'polyline', points: Array.from({ length: 1024 }, (_, i) => [i / 1000, 0.123456789]) });
  rejects(heavy, '/', `the limit is ${LIMITS.maxBytes}`);
});

test('the byte form is canonical and the text is plain data', () => {
  const text = fixture('valid/chair.op');
  rejects(text.replace(/\n/g, '\r\n'), '/', 'not in canonical form');
  rejects(`﻿${text}`, '/', 'byte-order mark');
  rejects(text.replace('"version": 1,', '"version": 1,\n  "version": 1,'), '/', 'not in canonical form');
  rejects(text.replace('"width": 0.52', '"width": 1e400'), '/dimensions/width', 'not a finite number');
  rejects(text.replace('"role": "seating-point"', '"constructor": "seating-point"'), '/anchors/seatCenter/metadata/constructor', 'reserved key');
  rejects(text.replace('"version": 1,', '"__proto__": {},\n  "version": 1,'), '/__proto__', 'reserved key');
  rejects('{ not json', '/', 'is not JSON');
});

test('review regressions: deep chains, sweep operands, degenerate geometry, empty metadata, totals', () => {
  // A 2^n chain hidden behind 65 cheap links must still be counted.
  const deep = base();
  deep.definitions = { l0: box('l0') };
  for (let level = 1; level <= 22; level += 1) {
    deep.definitions[`l${level}`] = { kind: 'boolean3d', operation: 'union', baseRef: `l${level - 1}`, operandRefs: [`l${level - 1}`] };
  }
  let previous = 'l22';
  for (let link = 0; link < 65; link += 1) {
    deep.definitions[`p${link}`] = { kind: 'boolean3d', operation: 'union', baseRef: previous, operandRefs: ['l0'] };
    previous = `p${link}`;
  }
  deep.modelView.elements.push({ ref: previous });
  rejects(deep, '/', `builds more than ${LIMITS.maxExpandedNodes} nodes`);

  const sweepOperand = base();
  sweepOperand.definitions = {
    body: box('body'),
    rail: { kind: 'sweep', path: [[0, 0, 0], [0, 1, 0]], profile: [[0, 0, 0], [0.1, 0, 0], [0.1, 0, 0.1]] },
    cut: { kind: 'boolean3d', operation: 'subtract', baseRef: 'body', operandRefs: ['rail'] },
  };
  sweepOperand.modelView.elements.push({ ref: 'cut' });
  rejects(sweepOperand, '/definitions/cut/operandRefs/0', 'is a sweep');

  const flat = base();
  flat.profileView.elements[0].vertices = [[0, 0], [1, 0], [2, 0]];
  rejects(flat, '/profileView/elements/0/vertices', 'encloses no area');
  const bowtie = base();
  bowtie.profileView.elements[0].vertices = [[0, 0], [2, 2], [2, 0], [0, 1]];
  rejects(bowtie, '/profileView/elements/0/vertices', 'crosses itself');

  const emptyMeta = base();
  emptyMeta.anchors.seatCenter.metadata = {};
  rejects(emptyMeta, '/anchors/seatCenter/metadata', 'must NOT have fewer than 1 properties');

  const turned = base();
  turned.placement.rotation = [0, 90, 0];
  rejects(turned, '/placement/rotation', 'must be equal to constant');

  const total = base();
  for (let index = 0; index < 200; index += 1) total.profileView.elements.push({ id: `p${index}`, kind: 'polygon', vertices: [[0, 0], [0.1, 0], [0, 0.1]] });
  for (let index = 0; index < 200; index += 1) total.modelView.elements.push(box(`m${index}`));
  rejects(total, '/', 'nodes; the limit is 400');
});

test('each geometry-reject fixture fails exactly its own gate, naming the node and the numbers', () => {
  const expected = {
    'anchor-on-floor.op': ['/anchors/seatCenter', /^anchor "seatCenter" at \(0\.000, 0\.000, 0\.000\) is 0\.\d{3} m from the nearest body surface/],
    'arc-plan.op': ['/profileView/elements/0', /^the plan's min x is -2\.000 at "rim-a", but the body's is -0\.260/],
    'anchor-off-body.op': ['/anchors/topCenter', /^anchor "topCenter" at \(0\.000, 0\.470, 0\.000\) is 0\.020 m from the nearest body surface, on "top"/],
    'anchor-role.op': ['/anchors/topCenter/metadata/role', /^is "work-surface"; "topCenter" takes "top-surface"$/],
    'below-floor.op': ['/modelView/elements/1', /^"leg-front-left" goes down to y = -0\.010, below the floor at 0\.000/],
    'dimensions.op': ['/dimensions/width', /^is 0\.480 m but the body spans 0\.400 m in x, from "top"/],
    'height-bottom-face.op': ['/metadata/catalog:note', /^"seat 0\.46" matches no top face; the nearest is 0\.520 on "seat"/],
    'floating-tap.op': ['/modelView/elements/5', /^"tap" floats: .* "top", is 0\.002 m away \(tolerance 0\.001\)$/],
    'missing-ifcclass.op': ['/metadata', /^needs "ifcClass": "IfcFurniture", since a ported or MEP_EQUIPMENT block/],
    'missing-lod.op': ['/metadata', /^needs "catalog:lod"$/],
    'missing-mat.op': ['/modelView/elements/1', /^"leg-front-left" has no mat: role; set "mat:leg-front-left" or "mat:leg" on its definition$/],
    'note-decimals.op': ['/metadata/catalog:note', /^"seat 0\.5" needs metres with two decimals/],
    'note-height.op': ['/metadata/catalog:note', /^"top 0\.47" matches no top face; the nearest is 0\.450 on "top"/],
    'partial-cylinder.op': ['/modelView/elements/5/angle', /^is 3\.1416; a cylinder must be a full turn/],
    'plan-off-body.op': ['/profileView/elements/0', /^the plan's min x is -0\.210 at "top", but the body's is -0\.200 at "top"/],
    'port-id.op': ['/ports/0', /^port "cold" is not a port id of the drafting standard/],
    'too-few-solids.op': ['/modelView', /^has 2 solid\(s\); LOD 300 needs at least 3$/],
    'too-full.op': ['/modelView', /^the solids fill 1\.000 of their bounding box/],
    'union-volume.op': ['/modelView', /^the solids fill 1\.0\d\d of their bounding box/],
  };
  const family = { 'missing-mat.op': /has no mat: role/, 'arc-plan.op': /^the plan's (min|max) [xz] is/ };
  const dir = new URL('fixtures/geometry-rejects/', import.meta.url);
  assert.deepEqual(readdirSync(dir).sort(), Object.keys(expected).sort());
  for (const [name, [path, message]] of Object.entries(expected)) {
    const { issues } = checkBlockText(readFileSync(new URL(name, dir), 'utf8'));
    const ownGate = (issue) => issue.path === path || family[name]?.test(issue.message);
    assert.ok(issues.length > 0 && issues.every(ownGate), `${name}: ${JSON.stringify(issues)}`);
    assert.ok(issues.some((issue) => issue.path === path && message.test(issue.message)), `${name}: ${JSON.stringify(issues)}`);
  }
});

test('a stacking chair of tubular legs and a shell seat passes every gate', () => {
  const tube = (id, x, z, height) => ({ id, kind: 'cylinder', center: [x, height / 2, z], radius: 0.011, height });
  const chair = base();
  Object.assign(chair, { id: 'fixture.stacking-chair', dimensions: { width: 0.48, depth: 0.48, height: 0.8 } });
  chair.metadata = { ...chair.metadata, 'catalog:note': 'Shell seat on tubular legs. seat 0.45' };
  for (const key of Object.keys(chair.metadata)) if (key.startsWith('mat:')) delete chair.metadata[key];
  Object.assign(chair.metadata, { 'mat:seat': 'surface', 'mat:back': 'surface' });
  for (const leg of ['leg-front-left', 'leg-front-right', 'post-left', 'post-right']) chair.metadata[`mat:${leg}`] = 'frame';
  chair.anchors.seatCenter.placement.position = [0, 0.45, 0];
  chair.profileView.elements = [{ id: 'seat', kind: 'polygon', vertices: [[-0.24, -0.24], [0.24, -0.24], [0.24, 0.24], [-0.24, 0.24]] }];
  chair.modelView.elements = [
    { id: 'seat', kind: 'cuboid', center: [0, 0.435, 0], width: 0.48, height: 0.03, depth: 0.48 },
    { id: 'back', kind: 'cuboid', center: [0, 0.675, -0.23], width: 0.44, height: 0.25, depth: 0.02 },
    tube('leg-front-left', -0.21, 0.21, 0.42),
    tube('leg-front-right', 0.21, 0.21, 0.42),
    tube('post-left', -0.21, -0.21, 0.8),
    tube('post-right', 0.21, -0.21, 0.8),
  ];
  assert.deepEqual(check(chair).issues, []);
});

test('a floorkit block not on the pending list is drawn to LOD 300', () => {
  const block = { ...base(), id: 'floorkit.example' };
  block.metadata = { ...block.metadata, 'catalog:lod': '200' };
  rejects(block, '/metadata/catalog:lod', 'a floorkit block is drawn to LOD 300');
});

test('only the listed seed file itself skips the new gates: its path, version and bytes', () => {
  const seed = readFileSync(new URL('../blocks/floorkit/simple-chair/1.0.0.op', import.meta.url), 'utf8');
  const listed = { publisher: 'floorkit', slug: 'simple-chair', version: '1.0.0' };
  assert.deepEqual(checkBlockText(seed, { listed }).issues, []);
  const gated = (text, place) => assert.ok(checkBlockText(text, place).issues.some((issue) => issue.message === 'needs "catalog:lod"'));
  gated(seed);
  gated(seed, { listed: { ...listed, version: '1.1.0' } });
  gated(seed.replace('"Simple Chair"', '"Simple Chaix"'), { listed });
  gated(seed, { listed: { ...listed, slug: 'stool' } });
});

test('a block outside blocks/ that claims a seed id gets every gate', () => {
  const fake = base();
  Object.assign(fake, { id: 'floorkit.simple-chair', dimensions: { width: 3, depth: 3, height: 3 } });
  delete fake.metadata['catalog:lod'];
  fake.anchors.seatCenter.metadata.role = 'nonsense';
  const result = check(fake);
  for (const message of ['needs "catalog:lod"', 'is "nonsense"', 'is 3.000 m but the body spans']) {
    assert.ok(result.issues.some((issue) => issue.message.includes(message)), message);
  }
});

test('each pending hash is the sha256 of that seed as it is on disk', () => {
  for (const [slug, hash] of Object.entries(PENDING_REDRAW)) {
    const bytes = readFileSync(new URL(`../blocks/floorkit/${slug}/1.0.0.op`, import.meta.url));
    assert.equal(sha256Hex(bytes), hash, `${slug} changed: redraw it, then take its line off the pending list`);
  }
});

test('arcs are in the plan: a full circle of two half arcs under the body passes', () => {
  const chair = base();
  chair.profileView.elements.push(
    { id: 'ring-a', kind: 'arc', center: [0, 0], radius: 0.2, startAngle: 0, sweepAngle: 3.14159265 },
    { id: 'ring-b', kind: 'arc', center: [0, 0], radius: 0.2, startAngle: 3.14159265, sweepAngle: 3.14159265 },
  );
  assert.deepEqual(check(chair).issues, []);
  chair.profileView.elements.push({ id: 'swing', kind: 'arc', center: [0.26, 0.24], radius: 0.5, startAngle: 0, sweepAngle: -1.5707963 });
  rejects(chair, '/profileView/elements/8', 'the plan');
  chair.metadata['catalog:note'] = 'A door swing. seat 0.52 swing';
  assert.deepEqual(check(chair).issues, []);
});

test('an inward offset2d line stays inside its source; an outward one grows', () => {
  const basin = base();
  basin.definitions = { rim: { kind: 'polyline', points: [[-0.26, -0.24], [-0.26, 0.24], [0.26, 0.24], [0.26, -0.24], [-0.26, -0.24]] }, inner: { kind: 'offset2d', sourceRef: 'rim', distance: -0.04, output: 'polyline' } };
  basin.profileView.elements.push({ ref: 'inner' });
  assert.deepEqual(check(basin).issues, []);
  basin.definitions.inner.distance = 0.04;
  rejects(basin, '/profileView/elements/6', "the plan's");
});

test('the pending list names only the 26 seeds, each once, each present', () => {
  const seeds = ['bathtub', 'cabinet', 'cafe-counter', 'chiller', 'counter-run', 'crah', 'glazed-door', 'hob', 'kitchen-counter', 'kitchen-sink',
    'minimal-sofa', 'office-desk', 'parked-car', 'pdu', 'planter', 'rear-door-heat-exchanger', 'rectangular-bathtub', 'shower-tray',
    'simple-chair', 'table', 'tree', 'ups', 'wash-basin', 'washing-machine', 'wc', 'wc-and-basin'];
  for (const slug of Object.keys(PENDING_REDRAW)) {
    assert.ok(seeds.includes(slug), `${slug} is not one of the 26 seeds`);
    assert.ok(readdirSync(new URL(`../blocks/floorkit/${slug}/`, import.meta.url)).length > 0, `${slug} has no block`);
  }
});

test('the note grammar reads exactly the keywords of drafting standard section 2', () => {
  const note = parseNote('Wall-hung basin. rim 0.85, underside 0.68. Waste at the back; overlap counter+tap. recess, top 0.9, seat 0.450, slab.');
  assert.deepEqual([...note.overlaps], ['counter+tap']);
  assert.deepEqual(note.heights, { at: [], ceiling: [], seat: [], rim: [0.85], top: [], bottom: [], underside: [0.68] });
  assert.deepEqual([...note.markers], ['recess', 'slab']);
  assert.deepEqual([...parseNote('overlap carcass+kick').markers], [], 'a node name is not a marker');
});

test('IFC: every block sets ifc:class, and ifcClass only on a ported or MEP_EQUIPMENT block', () => {
  const none = base();
  delete none.metadata['ifc:class'];
  delete none.metadata['ifc:predefinedType'];
  rejects(none, '/metadata', 'needs "ifc:class"');
  const extra = base();
  extra.metadata.ifcClass = extra.metadata['ifc:class'];
  rejects(extra, '/metadata/ifcClass', 'is only for a ported or MEP_EQUIPMENT block');
});

test('carcass or slab in the note waives the volume ratio, and only the ratio', () => {
  const text = readFileSync(new URL('fixtures/geometry-rejects/too-full.op', import.meta.url), 'utf8');
  const waived = JSON.parse(text);
  waived.metadata['catalog:note'] = 'A carcass. top 0.45';
  assert.deepEqual(check(waived).issues, []);
  const few = JSON.parse(readFileSync(new URL('fixtures/geometry-rejects/too-few-solids.op', import.meta.url), 'utf8'));
  few.metadata['catalog:note'] = 'A slab. top 0.45';
  rejects(few, '/modelView', 'LOD 300 needs at least 3');
});

test('the anchor and port constants equal the drafting standard\'s tables', () => {
  const standard = readFileSync(new URL('../docs/drafting-standard.md', import.meta.url), 'utf8');
  const section = (n) => standard.slice(standard.indexOf(`## ${n}. `), standard.indexOf(`## ${n + 1}. `));
  const cells = (line) => line.split('|').slice(1, -1).map((cell) => cell.trim());
  const ticks = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  // Every body row of a section's first table, after its "| ---" line; each must name something in backticks.
  const rows = (n) => {
    const lines = section(n).split('\n');
    const start = lines.findIndex((l) => l.startsWith('| ---')) + 1;
    const body = lines.slice(start, lines.findIndex((l, i) => i >= start && !l.startsWith('|')));
    for (const line of body) assert.ok(ticks(cells(line)[0]).length > 0, `a row with no ticked name: ${line}`);
    return body;
  };
  const anchors = {};
  for (const line of rows(7)) {
    const [names, role] = cells(line);
    for (const name of ticks(names)) (anchors[name] ??= []).push(...ticks(role));
  }
  assert.deepEqual(anchors, Object.fromEntries(Object.entries(ANCHOR_ROLES).map(([k, v]) => [k, [...v]])));
  const ports = {};
  for (const line of rows(8)) {
    const [id, domain, systemType, direction, profile] = cells(line);
    const shape = profile.split(/[ ,]/)[0];
    const port = { domain: ticks(domain)[0], systemType: ticks(systemType)[0], directions: [...new Set(ticks(direction))], shape };
    if (shape === 'round') port.sizes = [...profile.matchAll(/0\.\d+/g)].map((m) => Number(m[0]));
    if (shape === 'electrical') Object.assign(port, { poles: Number(profile.match(/(\d+) pole/)[1]), voltage: Number(profile.match(/(\d+) V/)[1]) });
    if (profile === 'as `flow`') Object.assign(port, { shape: 'round', sizes: ports.flow.sizes });
    ports[ticks(id)[0]] = port;
  }
  const sorted = (o) => JSON.parse(JSON.stringify(o, (k, v) => (Array.isArray(v) ? [...v].sort() : v)));
  assert.deepEqual(sorted(ports), sorted(PORTS));
});

test('a sweep is bounded with its profile turned along each segment, as the kernel builds it', () => {
  // The glazed-door frame: a parity --mesh run against Floorkit main measured the kernel's frameSolid
  // box as 0.98 x 2.11 x 0.14 m (x -0.49..0.49, y 0..2.11, z -0.07..0.07).
  const door = JSON.parse(readFileSync(new URL('../blocks/floorkit/glazed-door/1.0.0.op', import.meta.url), 'utf8'));
  door.id = 'fixture.glazed-door';
  assert.deepEqual(check(door).issues, []);
  door.dimensions.height = 2.08;
  rejects(door, '/dimensions/height', 'is 2.080 m but the body spans 2.110 m in y');
});

test('a sweep outside the case the catalog can bound is refused, naming the rule', () => {
  // Inputs from a port of the kernel's sweep (OpenGeometry sweep.rs), where the box above would be wrong.
  const door = () => {
    const d = JSON.parse(readFileSync(new URL('../blocks/floorkit/glazed-door/1.0.0.op', import.meta.url), 'utf8'));
    d.id = 'fixture.glazed-door';
    return d;
  };
  const tri = [[-0.02, 0, -0.03], [0.04, 0, -0.03], [-0.02, 0, 0.06]];
  const cases = {
    'its profile is not centred on its vertex average at the origin': (d) => { d.definitions.frameSection.points = [[0, 0, 0], [0, 0, 0.1], [0.05, 0, 0.1], [0.05, 0, 0]]; },
    'its profile does not face +y': (d) => { d.definitions.frameSection.points = tri; },
    'its path does not start straight up': (d) => { d.definitions.framePath.points = [[0, 2.08, 0], [0, 0, 0]]; },
    'its path is not in one vertical plane': (d) => { d.definitions.framePath.points = [[-0.46, 0, 0], [-0.46, 2.08, 0], [0.46, 2.08, 0], [0.46, 2.08, 0.5]]; },
    'its path turns by more than 90°': (d) => { d.definitions.framePath.points = [[-0.46, 0, 0], [-0.46, 2.08, 0], [0, 1, 0]]; },
  };
  for (const [rule, edit] of Object.entries(cases)) {
    const d = door();
    edit(d);
    rejects(d, '/definitions/frameSolid', rule);
  }
  assert.deepEqual(check(door()).issues, []);
});
