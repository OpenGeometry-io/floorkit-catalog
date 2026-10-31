// SPDX-License-Identifier: Apache-2.0
// One rule, one case: each mutation of a valid block must fail, and fail FOR
// ITS OWN REASON — an assertion on "it failed" alone passes for the wrong cause.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { parseNote } from '../tools/lib/note.mjs';
import { LIMITS, checkBlockText, formatBlock } from '../tools/lib/op.mjs';
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
        const result = checkBlockText(readFileSync(new URL(`${publisher}/${slug}/${file}`, root), 'utf8'));
        assert.deepEqual(result.issues, [], `${publisher}/${slug}/${file}`);
        count += 1;
      }
    }
  }
  const index = JSON.parse(readFileSync(new URL('../index.json', import.meta.url), 'utf8'));
  assert.equal(count, index.entries.length, 'blocks/ and index.json list different numbers of blocks');
});

test('every valid fixture passes, format v2 included', () => {
  const dir = new URL('fixtures/valid/', import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith('.op'));
  assert.ok(['v2-sampler.op', 'v2-sweep-arc-profile.op', 'v2-pedestal.op', 'v2-revolve-collinear.op'].every((name) => names.includes(name)));
  for (const name of names) assert.deepEqual(checkBlockText(readFileSync(new URL(name, dir), 'utf8')).issues, [], name);
});

test('the author-block skill\'s starter template passes', () => {
  const starter = readFileSync(new URL('../.claude/skills/author-block/starter.op', import.meta.url), 'utf8');
  assert.deepEqual(checkBlockText(starter).issues, []);
});

test('every Floorkit kernel-reject fixture is rejected by the catalog too', () => {
  const dir = new URL('fixtures/kernel-rejects/', import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith('.json'));
  assert.ok(names.length >= 27, 'the kernel-reject set shrank');
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
    'missing-lod.op': ['/metadata', /^must have required property 'catalog:lod'$/],
    'missing-mat.op': ['/modelView/elements/1', /^"leg-front-left" has no mat: role; set "mat:leg-front-left" or "mat:leg" on its definition$/],
    'note-decimals.op': ['/metadata/catalog:note', /^"seat 0\.5" needs metres with two decimals/],
    'note-height.op': ['/metadata/catalog:note', /^"top 0\.47" matches no top face; the nearest is 0\.450 on "top"/],
    'partial-cylinder.op': ['/modelView/elements/5/angle', /^is 3\.1416; a cylinder must be a full turn/],
    'plan-off-body.op': ['/profileView/elements/0', /^the plan's min x is -0\.210 at "top", but the body's is -0\.200 at "top"/],
    'port-id.op': ['/ports/0', /^port "cold" is not a port id of the drafting standard/],
    'too-few-solids.op': ['/modelView', /^has 2 solid\(s\); LOD 300 needs at least 3$/],
    'too-full.op': ['/modelView', /^the solids fill 1\.000 of their bounding box/],
    'union-volume.op': ['/modelView', /^the solids fill 1\.0\d\d of their bounding box/],
    'uneven-scale.op': ['/modelView/elements/0/placement/scale', /^is \[1,1,1\.5\]; a body's placement must be a turn, a move and one scale factor, else Floorkit 3\.0 refuses it as bad-scale$/],
    'v2-revolve-touches-axis-at-point.op': ['/modelView/elements/3/profile', /^touches its axis at a point, \[0, 0\]; a revolve's outline stays more than 0\.001 m to one side of its axis, except along one run of line edges that lies on the axis/],
    'v2-revolve-two-axis-runs.op': ['/definitions/ballSolid/profile', /^lies on its axis along 2 separate runs of edges; at most one run of edges may lie on the axis/],
    'v2-shell-of-shell.op': ['/definitions/ball2/sourceRef', /^hollows the shell "ball"; OpenGeometry 3\.0\.0 cannot shell a revolve, a cylinder sector or another shell/],
    'v2-outline-closing-gap.op': ['/modelView/elements/0/profile/segments/3/to', /^is 1\.0\d*e-10 m from start, so the closing line would be that short; end exactly at start, or leave a closing line of at least 0\.001 m$/],
    'v2-outline-sweep-too-low.op': ['/modelView/elements/3/path', /^rises 1e-10 m; an outline sweep is at least 0\.01 m high$/],
    'v2-shell-of-sector.op': ['/definitions/top/sourceRef', /^hollows the cylinder sector "topSolid"; OpenGeometry 3\.0\.0 cannot shell/],
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

test('a floorkit block is drawn to LOD 300', () => {
  const block = { ...base(), id: 'floorkit.example' };
  block.metadata = { ...block.metadata, 'catalog:lod': '200' };
  rejects(block, '/metadata/catalog:lod', 'a floorkit block is drawn to LOD 300');
});

test('the schema requires catalog:lod on every block, whatever its publisher', () => {
  for (const id of ['fixture.chair', 'floorkit.example', 'acme.example']) {
    const block = { ...base(), id };
    block.metadata = { ...block.metadata };
    delete block.metadata['catalog:lod'];
    rejects(block, '/metadata', "must have required property 'catalog:lod'");
  }
});

test('gate (f) allows float noise on its 0.005 m tolerance, and nothing more', () => {
  const chair = base();
  const seat = chair.modelView.elements.find((node) => node.id === 'seat');
  const face = seat.center[2] + seat.depth / 2;
  const top = seat.center[1] + seat.height / 2;
  const inside = (depth) => {
    chair.anchors.seatCenter.placement.position = [0, top - 0.01, face - depth];
    return check(chair).issues.filter((issue) => issue.path === '/anchors/seatCenter');
  };
  assert.deepEqual(inside(0.425 - 0.42), []); // 0.005000000000000004, as a port 0.005 inside a face at 0.425
  assert.deepEqual(inside(0.005 + 1e-12), []);
  assert.equal(inside(0.005 + 1e-6).length, 1);
  assert.match(inside(0.006)[0]?.message ?? '', /^anchor "seatCenter" at .* is 0\.006 m from the nearest body surface/);
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

test('gate (e) binds only a block drawn to LOD 300 (owner decision 2026-10-27); every other gate binds all', () => {
  const box = (lod) => {
    const block = base();
    Object.assign(block, { id: 'acme.storage-box', dimensions: { width: 0.5, depth: 0.5, height: 0.5 } });
    block.metadata = Object.fromEntries(Object.entries(block.metadata).filter(([key]) => !key.startsWith('mat:') && key !== 'catalog:note'));
    Object.assign(block.metadata, { 'catalog:lod': lod, 'mat:box': 'surface' });
    block.anchors = { base: block.anchors.base };
    block.profileView.elements = [{ id: 'box', kind: 'polygon', vertices: [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]] }];
    block.modelView.elements = [{ id: 'box', kind: 'cuboid', center: [0, 0.25, 0], width: 0.5, height: 0.5, depth: 0.5 }];
    return block;
  };
  assert.deepEqual(check(box('200')).issues, []);
  rejects(box('300'), '/modelView', 'LOD 300 needs at least 3');
  rejects(box('300'), '/modelView', 'the solids fill 1.000 of their bounding box');
  const wrong = box('200');
  wrong.dimensions.height = 0.6;
  rejects(wrong, '/dimensions/height', 'is 0.600 m but the body spans 0.500 m');
});

// ── Format v2 (docs/format-v2.md) ──
const v2 = () => JSON.parse(fixture('valid/v2-sampler.op'));
const v2Node = (d, id) => d.modelView.elements.find((node) => node.id === id);
const P = (position, scale = [1, 1, 1]) => ({ position, rotation: [0, 0, 0], scale });

test('the format marker: absent or "1" is format 1, "2" is format v2, the root version stays 1', () => {
  const one = base();
  one.metadata['catalog:format'] = '1';
  assert.deepEqual(check(one).issues, []);
  const three = base();
  three.metadata['catalog:format'] = '3';
  rejects(three, '/metadata/catalog:format', 'must be equal to constant ("1")');
  const sphere = base();
  sphere.modelView.elements.push({ id: 'ball', kind: 'sphere', center: [0, 0.5, 0], radius: 0.1 });
  rejects(sphere, '/modelView/elements/6/kind', 'must be equal to one of the allowed values');
  const version = v2();
  version.version = 2;
  rejects(version, '/version', 'must be equal to constant');
  const unmarked = v2();
  delete unmarked.metadata['catalog:format'];
  rejects(unmarked, '/modelView/elements/0/profile', 'must be array');
});

test('format v2 refuses what Floorkit 3.0 would repair, default or drop', () => {
  const key = v2();
  key.definitions.ballSolid.segments = 32;
  rejects(key, '/definitions/ballSolid', 'additional properties "segments"');
  const full = v2();
  v2Node(full, 'top').angle = 2 * Math.PI;
  rejects(full, '/modelView/elements/1/angle', 'must be <= 6.2831');
  const start = v2();
  delete v2Node(start, 'top').angle;
  rejects(start, '/modelView/elements/1', 'must have property angle when property startAngle is present');
  const caps = v2();
  delete v2Node(caps, 'plinth').capStart;
  rejects(caps, '/modelView/elements/0', "must have required property 'capStart'");
  const flat = v2();
  flat.modelView.elements.push({ id: 'cap', kind: 'cone', center: [0, 0.35, 0], radiusBottom: 0, radiusTop: 0, height: 0.1 });
  rejects(flat, '/modelView/elements/3', 'must NOT be valid');
  const shell = v2();
  shell.modelView.elements[2] = { id: 'ball', kind: 'shell', sourceRef: 'ballSolid', thickness: 0.01 };
  delete shell.definitions.ball;
  rejects(shell, '/modelView/elements/2/kind', 'must be equal to one of the allowed values');
});

test('format v2 gates: outlines, the torus, the revolve axis, the outline sweep path; one scale factor in both formats', () => {
  const offCentre = v2();
  v2Node(offCentre, 'plinth').profile.segments[1].arc.center = [0.1, 0.01];
  rejects(offCentre, '/modelView/elements/0/profile/segments/1/arc/center', 'an arc\'s centre must be as far from both');
  const repeat = v2();
  v2Node(repeat, 'plinth').profile.segments.splice(1, 0, { to: [0.1, -0.2] });
  rejects(repeat, '/modelView/elements/0/profile/segments/1/to', 'repeats the point before it');
  const crossing = v2();
  for (const segment of v2Node(crossing, 'plinth').profile.segments) if (segment.arc) segment.arc.counterClockwise = true;
  rejects(crossing, '/modelView/elements/0/profile', 'crosses itself');
  const shortSegment = v2();
  v2Node(shortSegment, 'plinth').profile.segments.splice(1, 0, { to: [0.1005, -0.2] });
  v2Node(shortSegment, 'plinth').profile.segments[2].arc.center = [0.1, 0];
  rejects(shortSegment, '/modelView/elements/0/profile/segments/1/to', 'a segment is at least 0.001 m long');
  const shortClose = v2();
  v2Node(shortClose, 'plinth').profile.segments.at(-1).to = [-0.1, -0.1995];
  v2Node(shortClose, 'plinth').profile.segments.at(-1).arc.center = [-0.1, 0.00025];
  rejects(shortClose, '/modelView/elements/0/profile/segments/3/to', 'the closing line would be that short');
  const low = v2();
  v2Node(low, 'plinth').path = [[0, 0, 0], [0, 0.005, 0]];
  rejects(low, '/modelView/elements/0/path', 'an outline sweep is at least 0.01 m high');
  const down = v2();
  v2Node(down, 'plinth').path = [[0, 0.1, 0], [0, 0, 0]];
  rejects(down, '/modelView/elements/0/path', 'must be one segment straight up');
  const slant = v2();
  v2Node(slant, 'plinth').path = [[0, 0, 0], [0.01, 0.1, 0]];
  rejects(slant, '/modelView/elements/0/path', 'must be one segment straight up');
  const torus = v2();
  torus.modelView.elements.push({ id: 'ring', kind: 'torus', center: [0, 0.21, 0], majorRadius: 0.05, minorRadius: 0.0495 });
  torus.metadata['mat:ring'] = 'metal';
  rejects(torus, '/modelView/elements/3/minorRadius', 'must be below majorRadius - 0.001');
  const crosses = v2();
  crosses.modelView.elements.push({ id: 'knob', kind: 'revolve', profile: { start: [-0.01, 0.2], segments: [{ to: [0.03, 0.2] }, { to: [0.03, 0.24] }], closed: true } });
  crosses.metadata['mat:knob'] = 'metal';
  rejects(crosses, '/modelView/elements/3/profile', 'crosses its axis');
  // Measured on kernel 3.0.0: an edge ON the axis builds (a solid revolve); a point touch or a crossing does not.
  const knob = (profile) => {
    const d = v2();
    d.modelView.elements.push({ id: 'knob', kind: 'revolve', placement: P([0, 0.2, -0.1]), profile });
    d.metadata['mat:knob'] = 'metal';
    return d;
  };
  assert.deepEqual(check(knob({ start: [0, 0], segments: [{ to: [0.03, 0] }, { to: [0.03, 0.04] }, { to: [0, 0.04] }], closed: true })).issues, []);
  assert.deepEqual(check(knob({ start: [0, 0], segments: [{ to: [0, 0.04], arc: { center: [0, 0.02], counterClockwise: true } }], closed: true })).issues, [], 'a half-disc on the axis: a ball');
  rejects(knob({ start: [0, 0], segments: [{ to: [0.03, 0.02] }, { to: [0.03, 0.04] }], closed: true }), '/modelView/elements/3/profile', 'touches its axis at a point, [0, 0]');
  rejects(knob({ start: [0, 0], segments: [{ to: [0.03, 0] }, { to: [0.03, 0.04] }, { to: [0.0005, 0.04] }, { to: [0, 0.03] }], closed: true }), '/modelView/elements/3/profile', 'comes within 0.0005 m of its axis');
  rejects(knob({ start: [0.0005, 0], segments: [{ to: [0.03, 0] }, { to: [0.03, 0.04] }, { to: [0.0005, 0.04] }], closed: true }), '/modelView/elements/3/profile', 'comes within 0.0005 m of its axis');
  rejects(knob({ start: [0.02, 0], segments: [{ to: [0.02, 0.04], arc: { center: [0.02, 0.02], counterClockwise: false } }, { to: [0.02, 0], arc: { center: [0.02, 0.02], counterClockwise: false } }], closed: true }), '/modelView/elements/3/profile', 'touches its axis at a point');
  const zero = v2();
  zero.modelView.elements.push({ id: 'knob', kind: 'revolve', axis: { point: [0, 0], direction: [0, 0] }, profile: { start: [0.01, 0.2], segments: [{ to: [0.03, 0.2] }, { to: [0.03, 0.24] }], closed: true } });
  zero.metadata['mat:knob'] = 'metal';
  rejects(zero, '/modelView/elements/3/axis/direction', 'must not be zero');
  const stretchedOne = base();
  stretchedOne.modelView.elements[1].placement = P([0, 0, 0], [2, 1, 1]);
  rejects(stretchedOne, '/modelView/elements/1/placement/scale', 'one scale factor');
  const stretched = v2();
  v2Node(stretched, 'top').placement = P([0, 0, 0], [1, 1, 1.5]);
  rejects(stretched, '/modelView/elements/1/placement/scale', 'one scale factor');
  const operand = v2();
  operand.definitions.base = { kind: 'cuboid', center: [0, 0.5, 0], width: 0.1, height: 0.1, depth: 0.1 };
  operand.definitions.rail = { ...v2Node(operand, 'plinth') };
  delete operand.definitions.rail.id;
  operand.definitions.cut = { kind: 'boolean3d', operation: 'subtract', baseRef: 'base', operandRefs: ['rail'] };
  operand.modelView.elements.push({ ref: 'cut' });
  rejects(operand, '/definitions/cut/operandRefs/0', 'is a sweep');
});

test('format v2 shells: not of a revolve or a sector, through any chain; room for the void; counted when expanded', () => {
  const revolve = v2();
  revolve.definitions.knobSolid = { kind: 'revolve', profile: { start: [0.01, 0.2], segments: [{ to: [0.03, 0.2] }, { to: [0.03, 0.24] }], closed: true } };
  revolve.definitions.inner = { kind: 'shell', sourceRef: 'knobSolid', thickness: 0.01 };
  revolve.definitions.ball.sourceRef = 'outer';
  revolve.definitions.outer = { kind: 'boolean3d', operation: 'union', baseRef: 'ballSolid', operandRefs: ['inner'] };
  rejects(revolve, '/definitions/ball/sourceRef', 'the revolve "knobSolid"');
  rejects(revolve, '/definitions/ball/sourceRef', 'hollows the shell "inner"');
  rejects(revolve, '/definitions/inner/sourceRef', 'hollows the revolve "knobSolid"');
  const thick = v2();
  thick.definitions.ball.thickness = 0.1;
  rejects(thick, '/definitions/ball/thickness', 'must be under half the smallest extent of its source\'s box (0.200 m)');
  const bomb = v2();
  bomb.definitions.l0 = box('l0');
  for (let level = 1; level <= 22; level += 1) {
    bomb.definitions[`l${level}`] = { kind: 'boolean3d', operation: 'union', baseRef: `l${level - 1}`, operandRefs: [`l${level - 1}`] };
  }
  bomb.definitions.hollow = { kind: 'shell', sourceRef: 'l22', thickness: 0.01 };
  bomb.modelView.elements.push({ ref: 'hollow' });
  rejects(bomb, '/', `builds more than ${LIMITS.maxExpandedNodes} nodes`);
});

test('format v2 boxes are exact: sphere, cone, torus, sector, revolve and outline sweep', () => {
  // One solid per block, LOD 200; each must pass at its exact box and fail 0.01 m off it.
  const single = (node, dimensions, plan) => {
    const d = v2();
    d.id = 'fixture.v2-single';
    d.metadata = { ...d.metadata, 'catalog:lod': '200', 'catalog:note': 'One solid.', 'mat:solid': 'surface' };
    for (const k of ['mat:plinth', 'mat:top', 'mat:ball']) delete d.metadata[k];
    delete d.definitions;
    d.dimensions = dimensions;
    d.profileView.elements = [{ id: 'outline', kind: 'polygon', vertices: plan }];
    d.modelView.elements = [{ id: 'solid', ...node }];
    assert.deepEqual(check(d).issues, [], JSON.stringify(node));
    d.dimensions = { ...dimensions, height: dimensions.height + 0.01 };
    rejects(d, '/dimensions/height', 'but the body spans');
  };
  const square = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  single({ kind: 'sphere', center: [0, 0.2, 0], radius: 0.2 }, { width: 0.4, depth: 0.4, height: 0.4 }, square(-0.2, 0.2, -0.2, 0.2));
  single({ kind: 'cone', center: [0, 0.15, 0], radiusBottom: 0.2, radiusTop: 0, height: 0.3 }, { width: 0.4, depth: 0.4, height: 0.3 }, square(-0.2, 0.2, -0.2, 0.2));
  single({ kind: 'torus', center: [0, 0.05, 0], majorRadius: 0.2, minorRadius: 0.05 }, { width: 0.5, depth: 0.5, height: 0.1 }, square(-0.25, 0.25, -0.25, 0.25));
  // A quarter sector from 0 turns +x towards −z: x 0..r, z −r..0.
  single({ kind: 'cylinder', center: [0, 0.05, 0], radius: 0.3, height: 0.1, angle: Math.PI / 2 }, { width: 0.3, depth: 0.3, height: 0.1 }, square(0, 0.3, -0.3, 0));
  // A ring of square section 0.1 to 0.2 from the y axis, 0 to 0.1 high, plus a half-round bead on its outside.
  const ring = { start: [0.1, 0], segments: [{ to: [0.2, 0] }, { to: [0.2, 0.1], arc: { center: [0.2, 0.05], counterClockwise: true } }, { to: [0.1, 0.1] }], closed: true };
  single({ kind: 'revolve', profile: ring }, { width: 0.5, depth: 0.5, height: 0.1 }, square(-0.25, 0.25, -0.25, 0.25));
  const stadium = v2Node(v2(), 'plinth').profile;
  single({ kind: 'sweep', path: [[0, 0, 0], [0, 0.1, 0]], profile: stadium, capStart: true, capEnd: true }, { width: 0.6, depth: 0.4, height: 0.1 }, square(-0.3, 0.3, -0.2, 0.2));
  // A solid revolve: its outline lies along the y axis by an edge.
  const solid = { start: [0, 0], segments: [{ to: [0.1, 0] }, { to: [0.1, 0.2] }, { to: [0, 0.2] }], closed: true };
  single({ kind: 'revolve', profile: solid }, { width: 0.2, depth: 0.2, height: 0.2 }, square(-0.1, 0.1, -0.1, 0.1));
  // A square ring 0.1 to 0.2 from a horizontal axis along x at y 0.2: it stands on its rim.
  const lying = { start: [0, 0.1], segments: [{ to: [0.1, 0.1] }, { to: [0.1, 0] }, { to: [0, 0] }], closed: true };
  single({ kind: 'revolve', profile: lying, axis: { point: [0, 0.2], direction: [1, 0] } }, { width: 0.1, depth: 0.4, height: 0.4 }, square(0, 0.1, -0.2, 0.2));
});
