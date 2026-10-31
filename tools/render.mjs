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
 * the top-down projection of the body), and `iso`, `iso-ne`, `front` and `side`.
 * Those four are the kernel's triangles coloured by `mat:` role, NOT Floorkit's
 * OpenThree viewer: PNG drawn by Floorkit's three.js in headless Chromium, or
 * SVG from the mesh when no Chromium starts (`lib/pictures.mjs`). The tool says
 * which. `renders/gallery.html` shows every block rendered, by category, with a
 * "before" column for each block found under `renders/baseline/`, which
 * `--baseline=<dir>` fills from a tree laid out as `<publisher>/<slug>/<version>/`.
 * Exits 1 when any block fails to parse, build or draw, or a 3D node of it has
 * no kernel triangles (an unmeshed body would draw as a blank picture).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { bodyParts, loadFloorkit, placedModel, targets } from './lib/floorkit.mjs';
import { VIEWS, colourParts, findChromium, meshSvg, openChromium, overlaySvg } from './lib/pictures.mjs';
import { ROOT } from './lib/repo.mjs';

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
  ? `3D views: PNG, kernel triangles drawn by Floorkit's three.js r${THREE.REVISION} in headless Chromium ${chromium.version} (${executable}); not the OpenThree viewer`
  : `3D views: SVG from the kernel triangles, painter's order (${why}); not the OpenThree viewer`);

const cards = [];
let failed = 0;
for (const block of targets(args, renders)) {
  try {
    const definition = floorkit.parseOpenElementDefinition(block.text);
    const built = floorkit.buildFromBuildingModel(placedModel('block.op'), new THREE.Group(), { assetSources: { 'block.op': block.text } });
    const element = built.elementsById.get('block');
    const parts = colourParts(bodyParts(element), definition.metadata);
    const empty = parts.filter((part) => part.tris.length === 0).map((part) => part.name);
    if (parts.length === 0 || empty.length > 0) throw new Error(`no kernel triangles for ${parts.length === 0 ? 'any 3D node' : empty.join(', ')}`);
    mkdirSync(block.out, { recursive: true });
    const put = (file, data) => writeFileSync(path.join(block.out, file), data);
    put('plan-1-50.svg', planSvg(element, 0.02));
    put('plan-1-100.svg', planSvg(element, 0.01));
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
const groups = Map.groupBy(cards, (card) => card.category);
const sections = [...groups.keys()].sort().map((category) => `<h2>${esc(category)}</h2>\n${groups.get(category).map((card) => {
  const rel = path.relative(renders, card.out).split(path.sep).join('/');
  const before = existsSync(path.join(renders, 'baseline', rel)) ? `<div class="before"><h4>Before</h4>${shown(`baseline/${rel}`, ['plan-1-50.svg', 'iso.png'])}</div>` : '';
  const now = shown(rel, ['plan-1-50.svg', `iso.${ext}`, `front.${ext}`, `side.${ext}`, 'overlay.svg']);
  return `<section class="card"><h3>${esc(card.name)} <small>${esc(card.label)}</small></h3><div class="row">${before}<div class="now"><h4>Now</h4>${now}</div></div></section>`;
}).join('\n')}`);
writeFileSync(path.join(renders, 'gallery.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Catalog renders</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;background:#fafafa}.card{background:#fff;border:1px solid #ddd;border-radius:6px;margin:12px 0;padding:8px}
.row,.now,.before{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}.before{background:#f3efe6;padding:4px;border-radius:4px}h4{margin:4px;writing-mode:vertical-rl}
figure{margin:0}img{width:220px;height:170px;object-fit:contain;background:#fff;border:1px solid #eee}figcaption{font-size:11px;color:#666}</style>
<h1>Catalog renders</h1><p>${cards.length} block(s). 3D views are kernel triangles coloured by <code>mat:</code> role, not Floorkit's OpenThree viewer.</p>
${sections.join('\n')}\n</html>\n`);
console.log(`rendered ${cards.length}/${cards.length + failed} block(s) to ${path.relative(process.cwd(), renders) || '.'}; gallery ${path.join(path.relative(process.cwd(), renders), 'gallery.html')}`);
process.exitCode = failed === 0 ? 0 : 1;
