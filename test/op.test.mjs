// SPDX-License-Identifier: Apache-2.0
// One rule, one case: each mutation of a valid block must fail, and fail FOR
// ITS OWN REASON — an assertion on "it failed" alone passes for the wrong cause.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { LIMITS, checkBlockText, formatBlock } from '../tools/lib/op.mjs';

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
  rejects(text.replace('"width": 0.64', '"width": 1e400'), '/dimensions/width', 'not a finite number');
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
