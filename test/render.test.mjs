// SPDX-License-Identifier: Apache-2.0
// The maintainer tools that need a Floorkit build: `render.mjs` and the mesh
// check of `parity.mjs --mesh`. The pure checks always run; the runs against
// Floorkit skip unless FLOORKIT_DIR names a build, because CI has none.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { meshReport, shellNodes } from '../tools/lib/mesh.mjs';
import { parseNote } from '../tools/lib/note.mjs';
import { ROOT } from '../tools/lib/repo.mjs';

/** A closed, outward box as triangles, from `min` to `max`. */
function cuboid(min, max) {
  const c = (i) => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
  const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  return quads.flatMap(([a, b, d, e]) => [[c(a), c(b), c(d)], [c(a), c(d), c(e)]]);
}

test('a closed outward box is clean, and each mesh defect names its node', () => {
  assert.deepEqual(meshReport([{ name: 'box', tris: cuboid([0, 0, 0], [1, 1, 1]) }]).defects, []);
  const inverted = cuboid([0, 0, 0], [1, 1, 1]).map(([a, b, d]) => [a, d, b]);
  assert.match(meshReport([{ name: 'flipped', tris: inverted }]).defects.join('\n'), /^flipped: signed volume -1\.000e\+0 m³, faces not outward$/);
  assert.match(meshReport([{ name: 'lid', tris: cuboid([0, 0, 0], [1, 1, 1]).slice(2) }]).defects.join('\n'), /^lid: open shell, 4 edge\(s\)/m);
  const twin = [...cuboid([0, 0, 0], [1, 1, 1]), ...cuboid([2, 0, 0], [3, 1, 1])];
  assert.match(meshReport([{ name: 'twin', tris: twin }]).defects.join('\n'), /twin: 2 shells, expected one/);
});

test('a shell node (format v2) is two shells, its outside and its void, and nothing else is', () => {
  const inner = cuboid([0.1, 0.1, 0.1], [0.9, 0.9, 0.9]).map(([a, b, d]) => [a, d, b]);
  const hollow = [{ name: 'ball', tris: [...cuboid([0, 0, 0], [1, 1, 1]), ...inner] }];
  const definition = { definitions: { ballSolid: { kind: 'cuboid' }, ball: { kind: 'shell', sourceRef: 'ballSolid' } }, modelView: { elements: [{ ref: 'ball' }, { id: 'box', kind: 'cuboid' }] } };
  assert.deepEqual([...shellNodes(definition)], ['ball']);
  assert.deepEqual(meshReport(hollow, new Set(), shellNodes(definition)).defects, []);
  assert.deepEqual(meshReport(hollow).defects, ['ball: 2 shells, expected one']);
  const solid = [{ name: 'ball', tris: cuboid([0, 0, 0], [1, 1, 1]) }];
  assert.deepEqual(meshReport(solid, new Set(), new Set(['ball'])).defects, ['ball: 1 shell(s), expected two (a shell node: its outside and its void)']);
});

test('a shell node\'s second shell must be an inward void inside the first', () => {
  const outward = cuboid([0.1, 0.1, 0.1], [0.9, 0.9, 0.9]);
  const hollow = new Set(['ball']);
  const report = (inner) => meshReport([{ name: 'ball', tris: [...cuboid([0, 0, 0], [1, 1, 1]), ...inner] }], new Set(), hollow).defects;
  assert.deepEqual(report(outward.map(([a, b, d]) => [a, d, b])), []);
  assert.match(report(outward).join('\n'), /^ball: its second shell is not an inward void inside the first/m);
  const beside = cuboid([2, 0, 0], [2.5, 0.5, 0.5]).map(([a, b, d]) => [a, d, b]);
  assert.match(report(beside).join('\n'), /^ball: its second shell is not an inward void inside the first/m);
});

test('interpenetration beyond 1 mm is reported unless the note lists the pair', () => {
  const parts = [{ name: 'carcass', tris: cuboid([0, 0, 0], [1, 1, 1]) }, { name: 'kick', tris: cuboid([0.2, 0, 0.2], [0.8, 0.1, 0.8]) }];
  assert.deepEqual(meshReport(parts).defects, ['carcass+kick: interpenetrate by 100 mm, not listed in catalog:note']);
  assert.deepEqual(meshReport(parts, parseNote('Kick inside: overlap kick+carcass.').overlaps).defects, []);
  const touching = [parts[0], { name: 'top', tris: cuboid([0, 1, 0], [1, 1.04, 1]) }];
  assert.deepEqual(meshReport(touching).overlaps, []);
});

test('a sliver that collapses under the weld is dropped and counted, not reported as an open shell', () => {
  const box = cuboid([0, 0, 0], [1, 1, 1]);
  const sliver = [[1, 0, 0], [1, 0, 0.000001], [1, 1, 0]];
  const [node] = meshReport([{ name: 'box', tris: [...box, sliver, sliver.slice().reverse()] }]).nodes;
  assert.equal(node.collapsed, 2);
  assert.equal(node.openEdges, 0);
  assert.equal(node.triangles, box.length + 2);
});

test('a degenerate triangle in one node does not hide an overlap with it', () => {
  const outer = [...cuboid([0, 0, 0], [1, 1, 1]), [[0, 0, 0], [0, 0, 0], [1, 0, 0]]];
  const report = meshReport([{ name: 'inner', tris: cuboid([0.2, 0.2, 0.2], [0.8, 0.8, 0.8]) }, { name: 'outer', tris: outer }]);
  assert.deepEqual(report.overlaps, [{ pair: 'inner+outer', depthMm: 200, crossing: false, allowed: false }]);
});

test('one reversed triangle is reported as inconsistent winding', () => {
  const tris = cuboid([0, 0, 0], [1, 1, 1]);
  tris[0] = [tris[0][0], tris[0][2], tris[0][1]];
  assert.ok(meshReport([{ name: 'box', tris }]).defects.includes('box: inconsistent winding, 3 edge(s)'));
});

test('a thin rod through a thin panel is reported even off the sample grid', () => {
  const parts = [{ name: 'panel', tris: cuboid([-0.5, 0, -0.5], [0.5, 1, -0.48]) }, { name: 'rod', tris: cuboid([0.07, 0.41, -1], [0.09, 0.43, 1]) }];
  assert.deepEqual(meshReport(parts).defects, ['panel+rod: edges cross faces, depth not measured, not listed in catalog:note']);
});

const floorkit = process.env.FLOORKIT_DIR;
/** Run a tool with its output under a fresh directory; `look` reads that directory before it is removed. */
const tool = (name, args, look = () => undefined, env = {}) => {
  const out = mkdtempSync(path.join(tmpdir(), 'floorkit-catalog-tool-'));
  try {
    const run = { status: 0, stdout: '' };
    try {
      run.stdout = execFileSync(process.execPath, [path.join(ROOT, 'tools', name), `--out=${out}`, ...args], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ...env } });
    } catch (error) {
      Object.assign(run, { status: error.status, stdout: String(error.stdout) });
    }
    return { ...run, seen: look(out) };
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
};
const parity = (...args) => tool('parity.mjs', args);

test('parity --mesh fails on an open shell and names the node', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  const run = parity('--mesh', path.join(ROOT, 'test/fixtures/mesh-rejects/open-sweep.op'));
  assert.equal(run.status, 1);
  assert.match(run.stdout, /MESH test\/fixtures\/mesh-rejects\/open-sweep\.op: tube: open shell/);
});

test('parity --mesh honours an overlap listed in catalog:note, and only then', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  const listed = path.join(ROOT, 'test/fixtures/mesh-rejects/overlap.op');
  assert.match(parity('--mesh', listed).stdout, /mesh clean:\s+1\/1/);
  const dir = mkdtempSync(path.join(tmpdir(), 'floorkit-catalog-note-'));
  try {
    const definition = JSON.parse(readFileSync(listed, 'utf8'));
    delete definition.metadata['catalog:note'];
    const unlisted = path.join(dir, 'unlisted.op');
    writeFileSync(unlisted, `${JSON.stringify(definition, null, 2)}\n`);
    const run = parity('--mesh', unlisted);
    assert.equal(run.status, 1);
    assert.match(run.stdout, /carcass\+kick: interpenetrate by \d+(\.\d)? mm/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parity --mesh prints the slivers it drops', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  // Kernel bd44f13 (OPE-101) emits no slivers here; older kernels emit some on the arc wall.
  const run = parity('--mesh', path.join(ROOT, 'test/fixtures/valid/v2-sweep-arc-profile.op'));
  assert.equal(run.status, 0, run.stdout);
  const total = run.stdout.match(/^slivers dropped:\s+(\d+) triangle\(s\) in (\d+) block\(s\)$/m);
  assert.ok(total, run.stdout);
  const lines = run.stdout.match(/^SLIVERS .*$/gm) ?? [];
  assert.equal(lines.length, Number(total[2]));
  assert.equal(Number(total[1]) === 0, lines.length === 0);
  for (const line of lines) {
    assert.match(line, /^SLIVERS test\/fixtures\/valid\/v2-sweep-arc-profile\.op: \d+ triangle\(s\) collapse under the 0\.01 mm weld and were dropped \(pan \d+\)$/);
  }
});

test('parity fails on every kernel-reject fixture named on its own', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  const dir = path.join(ROOT, 'test/fixtures/kernel-rejects');
  for (const name of readdirSync(dir).filter((file) => file.endsWith('.json'))) {
    const run = parity('--build', path.join(dir, name));
    assert.equal(run.status, 1, `${name} passed parity`);
    assert.match(run.stdout, /^REJECTED /m, name);
  }
});

test('render fails on every kernel-reject fixture', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  const dir = path.join(ROOT, 'test/fixtures/kernel-rejects');
  const files = readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => path.join(dir, file));
  const run = tool('render.mjs', files, undefined, { FLOORKIT_CHROMIUM: 'none' });
  assert.equal(run.status, 1);
  assert.equal(run.stdout.match(/^RENDER FAILED /gm)?.length, files.length);
  assert.match(run.stdout, new RegExp(`^rendered 0/${files.length} block`, 'm'));
});

test('render draws the seven pictures as SVG from the kernel mesh when Chromium is off', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  const names = ['plan-1-50.svg', 'plan-1-100.svg', 'overlay.svg', 'iso.svg', 'iso-ne.svg', 'front.svg', 'side.svg'];
  const run = tool('render.mjs', [path.join(ROOT, 'test/fixtures/valid/chair.op')], (out) => ({
    files: names.filter((name) => existsSync(path.join(out, 'files', 'chair', name))),
    cards: readFileSync(path.join(out, 'gallery.html'), 'utf8').match(/class="card"/g)?.length,
  }), { FLOORKIT_CHROMIUM: 'none' });
  assert.equal(run.status, 0, run.stdout);
  assert.match(run.stdout, /^3D views: SVG from the kernel triangles, painter's order \(FLOORKIT_CHROMIUM=none\); not the OpenThree viewer$/m);
  assert.deepEqual(run.seen, { files: names, cards: 1 });
});

test('render draws one gallery card per block, with its older version in the "before" column', { skip: !floorkit && 'FLOORKIT_DIR is not set' }, () => {
  const files = ['1.0.0', '2.0.0'].map((version) => path.join(ROOT, `blocks/floorkit/wash-basin/${version}.op`));
  const run = tool('render.mjs', files, (out) => readFileSync(path.join(out, 'gallery.html'), 'utf8'), { FLOORKIT_CHROMIUM: 'none' });
  assert.equal(run.status, 0, run.stdout);
  assert.equal(run.seen.match(/class="card"/g)?.length, 1);
  assert.match(run.seen, /<h3>floorkit\.wash-basin@2\.0\.0 /);
  assert.match(run.seen, /<div class="before"><h4>Before<\/h4><h5>1\.0\.0<\/h5><figure><img src="floorkit\/wash-basin\/1\.0\.0\/plan-1-50\.svg"/);
});
