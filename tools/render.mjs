#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/**
 * Render blocks to pictures a reviewer can tick. Run by maintainers, against
 * a Floorkit build, like parity.mjs:
 *
 *   FLOORKIT_DIR=<dir containing dist/index.js> node tools/render.mjs [--out=<dir>] [--baseline=<dir>] [file.op ...]
 *
 * Per block, in `renders/<publisher>/<slug>/<version>/` (or under `--out`):
 * `plan-1-50.svg` and `plan-1-100.svg` (Floorkit's plan extractor and paper
 * emitter, so the pens are Floorkit's own), `overlay.svg` (the plan symbol over
 * the top-down projection of the body), `section-1-50.svg` and
 * `elevation-1-50.svg` (Floorkit's own section and front elevation of the block
 * alone, through its paper emitter, `lib/views.mjs`), and `iso`, `iso-ne`, `front` and `side`.
 * The section is drawn and checked but not shown on the card: Floorkit draws a
 * block in a section as seen lines, not cut (FLO-308), so it equals the
 * elevation until FLO-272.
 * Those four are the kernel's mesh, no coarser than Floorkit's 2 mm drawing
 * deflection, coloured by `mat:` role, NOT Floorkit's OpenThree viewer: PNG
 * drawn by Floorkit's three.js in headless Chromium with the kernel's normals,
 * or SVG from the mesh when no Chromium starts (`lib/pictures.mjs`). The tool says
 * which. `renders/gallery.html` shows one card per block, by category, at its
 * newest version rendered. Its "before" column shows the older version that
 * the card's version replaces (a 1.0.0 beside its 2.0.0), and the card's own
 * version found under `renders/baseline/`, which `--baseline=<dir>` fills from
 * a tree laid out as `<publisher>/<slug>/<version>/`.
 * Exits 1 when any block fails to parse, build or draw, a 3D node of it has
 * no kernel triangles (an unmeshed body would draw as a blank picture), or
 * Floorkit draws nothing of it in the section or the elevation.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { PICTURE_DEFLECTION, bodyParts, loadFloorkit, placedModel, targets } from './lib/floorkit.mjs';
import { VIEWS, colourParts, findChromium, meshSvg, openChromium, overlaySvg } from './lib/pictures.mjs';
import { partsBox, sectionAndElevation } from './lib/views.mjs';
import { ROOT, compareSemver } from './lib/repo.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const message = (error) => String(error?.message ?? error).split('\n')[0];
let floorkit, THREE, require;
try {
  ({ floorkit, THREE, require } = await loadFloorkit({ boot: true }));
} catch (error) {
  console.error(message(error));
  process.exit(2);
}
const renders = path.resolve(option('out') ?? path.join(ROOT, 'renders'));
if (option('baseline')) {
  const from = path.resolve(option('baseline'));
  if (!existsSync(from)) {
    console.error(`--baseline: ${from} does not exist.`);
    process.exit(1);
  }
  const dirs = (dir) => readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const publisher of dirs(from)) {
    for (const slug of dirs(path.join(from, publisher))) {
      for (const version of dirs(path.join(from, publisher, slug)).filter((name) => /^\d+\.\d+\.\d+$/.test(name))) {
        cpSync(path.join(from, publisher, slug, version), path.join(renders, 'baseline', publisher, slug, version), { recursive: true });
      }
    }
  }
}

/** One plan-only page at `ratio`, fitted to the symbol with a 10 mm margin, through Floorkit's paper emitter. */
function planSvg(element, ratio) {
  const extractor = new floorkit.PlanDrawingExtractor([element]);
  const { min, max } = extractor.extract({ view: 'top', entities: [element.ogid] }).bounds;
  const [width, height] = [(max.x - min.x) * 1000 * ratio + 20, (max.y - min.y) * 1000 * ratio + 20];
  const viewport = { id: 'vp', source: { kind: 'plan', levelId: 'level', entities: [element.ogid] }, frame: { x: 0, y: 0, width, height },
    scale: ratio, rotationDeg: 0, clip: true, viewCenter: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 } };
  const page = { format: 'Custom', orientation: width >= height ? 'landscape' : 'portrait', size: { width, height }, margin: 0 };
  const doc = { version: 1, unitSystem: 'metric', sheets: [{ id: 'plan', name: 'Plan', page, viewports: [viewport], annotations: [] }] };
  return new floorkit.PaperExporter(doc, { extractor }).toSVG('plan');
}

const executable = findChromium();
let chromium = null;
let why = process.env.FLOORKIT_CHROMIUM === 'none' ? 'FLOORKIT_CHROMIUM=none' : executable ? '' : 'no Chromium found; set FLOORKIT_CHROMIUM to its executable';
try {
  chromium = await openChromium(executable, require);
} catch (error) {
  why = `Chromium did not start: ${message(error)}`;
}
const ext = chromium ? 'png' : 'svg';
console.log(chromium
  ? `3D views: PNG, kernel triangles (no coarser than ${PICTURE_DEFLECTION * 1000} mm) and normals drawn by Floorkit's three.js r${THREE.REVISION} in headless Chromium ${chromium.version} (${executable}); not the OpenThree viewer`
  : `3D views: SVG from the kernel triangles, painter's order (${why}); not the OpenThree viewer`);

const cards = [];
let failed = 0;
for (const block of targets(args, renders)) {
  try {
    const definition = floorkit.parseOpenElementDefinition(block.text);
    const built = floorkit.buildFromBuildingModel(placedModel('block.op'), new THREE.Group(), { assetSources: { 'block.op': block.text } });
    const element = built.elementsById.get('block');
    const parts = colourParts(bodyParts(element, { maxDeflection: PICTURE_DEFLECTION }), definition.metadata);
    const empty = parts.filter((part) => part.tris.length === 0).map((part) => part.name);
    if (parts.length === 0 || empty.length > 0) throw new Error(`no kernel triangles for ${parts.length === 0 ? 'any 3D node' : empty.join(', ')}`);
    const drawn = sectionAndElevation(floorkit, block.text, partsBox(parts));
    const blank = Object.entries(drawn).filter(([, view]) => view.error).map(([name, view]) => `${name}: ${view.error}`);
    if (blank.length > 0) throw new Error(blank.join('; '));
    mkdirSync(block.out, { recursive: true });
    const put = (file, data) => writeFileSync(path.join(block.out, file), data);
    put('plan-1-50.svg', planSvg(element, 0.02));
    put('plan-1-100.svg', planSvg(element, 0.01));
    put('section-1-50.svg', drawn.section.svg);
    put('elevation-1-50.svg', drawn.elevation.svg);
    put('overlay.svg', overlaySvg(element.toDrawing('top'), parts, `${block.name}: plan symbol (red) over the top-down projection of the body (grey), 1:50`));
    for (const view of Object.keys(VIEWS)) {
      const caption = `${block.name} · ${view} · kernel triangles coloured by mat: role, orthographic`;
      put(`${view}.${ext}`, chromium ? await chromium.picture(parts, view, caption) : meshSvg(parts, view, caption));
    }
    floorkit.disposeBuildResult(built);
    cards.push({ ...block, label: definition.labelName, category: definition.metadata?.['catalog:category'] ?? 'other' });
  } catch (error) {
    failed += 1;
    console.log(`RENDER FAILED ${block.name}: ${message(error)}`);
  }
}
await chromium?.close();

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const shown = (dir, files) => files.map((file) => `<figure><img src="${dir}/${file}" alt="${file}" loading="lazy"><figcaption>${file}</figcaption></figure>`).join('');
const relOf = (card) => path.relative(renders, card.out).split(path.sep).join('/');
// The elevation of a "before" version, when its folder has one (older renders and baselines may not). The section is
// not shown: it equals the elevation until FLO-272 (see the header).
const drawings = (dir) => ['elevation-1-50.svg'].filter((file) => existsSync(path.join(dir, file)));
// One card per block, at its newest version rendered. The "before" column shows the version it
// replaces (the newest older one rendered, a 1.0.0 beside its 2.0.0), then the baseline pictures
// of the shown version from `--baseline`, each under its own heading; a block with neither has none.
const blocks = [...Map.groupBy(cards, (card) => card.block).values()].map((versions) => versions.sort((a, b) => compareSemver(b.version ?? '0.0.0', a.version ?? '0.0.0')));
const groups = Map.groupBy(blocks, ([card]) => card.category);
const sections = [...groups.keys()].sort().map((category) => `<h2>${esc(category)}</h2>\n${groups.get(category).map(([card, older]) => {
  const rel = relOf(card);
  const befores = [
    older ? `<h5>${esc(older.version)}</h5>${shown(relOf(older), ['plan-1-50.svg', `iso.${ext}`, ...drawings(older.out)])}` : '',
    existsSync(path.join(renders, 'baseline', rel)) ? `<h5>baseline</h5>${shown(`baseline/${rel}`, ['plan-1-50.svg', 'iso.png', ...drawings(path.join(renders, 'baseline', rel))])}` : '',
  ].join('');
  const before = befores ? `<div class="before"><h4>Before</h4>${befores}</div>` : '';
  const now = shown(rel, ['plan-1-50.svg', 'elevation-1-50.svg', `iso.${ext}`, `front.${ext}`, `side.${ext}`, 'overlay.svg']);
  return `<section class="card"><h3>${esc(card.name)} <small>${esc(card.label)}</small></h3><div class="row">${before}<div class="now"><h4>Now</h4>${now}</div></div></section>`;
}).join('\n')}`);
writeFileSync(path.join(renders, 'gallery.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Catalog renders</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fafafa}.card{background:#fff;border:1px solid #ddd;border-radius:6px;margin:12px 0;padding:8px}
.row,.now,.before{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}.before{background:#f3efe6;padding:4px;border-radius:4px}h4,h5{margin:4px;writing-mode:vertical-rl}h5{font-weight:normal;color:#666}
figure{margin:0}img{width:220px;height:170px;object-fit:contain;background:#fff;border:1px solid #eee}figcaption{font-size:11px;color:#666}</style>
<h1>Catalog renders</h1><p>${blocks.length} block(s), one card each at its newest version; ${cards.length} block version(s) rendered. 3D views are kernel triangles coloured by <code>mat:</code> role, not Floorkit's OpenThree viewer.</p>
${sections.join('\n')}\n</html>\n`);
console.log(`rendered ${cards.length}/${cards.length + failed} block(s) to ${path.relative(process.cwd(), renders) || '.'}; gallery ${path.join(path.relative(process.cwd(), renders), 'gallery.html')}`);
process.exitCode = failed === 0 ? 0 : 1;
