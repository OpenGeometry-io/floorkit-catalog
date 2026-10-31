// SPDX-License-Identifier: Apache-2.0
/**
 * Pictures of a built block for `render.mjs`. The 3D views are NOT Floorkit's
 * OpenThree viewer: they are the kernel's own mesh (`bodyParts`, no coarser
 * than the 2 mm drawing deflection), coloured by each node's `mat:` role, drawn either by
 * Floorkit's own copy of three.js in headless Chromium (PNG, shaded with the
 * kernel's per-vertex normals) or, when no Chromium starts, as SVG with
 * painter's-order hidden faces (flat-shaded). Orthographic; +z is the front of
 * a block.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const ROLE = { surface: '#d8d2c4', soft: '#9fb0c4', frame: '#7a5c3e', metal: '#9aa3ab', glass: '#a8d0e6', ceramic: '#f2f1ec', planting: '#5e8f4e' };
export const VIEWS = { iso: [1, 0.8165, 1], 'iso-ne': [1, 0.8165, -1], front: [0, 0, 1], side: [1, 0, 0] };

/** Each part's colour: its `mat:` role, else the node's own colour, else Floorkit's model grey. */
export function colourParts(parts, metadata = {}) {
  return parts.map((part) => ({ ...part, color: ROLE[metadata[`mat:${part.name}`]] ?? part.color ?? '#c4c4c4' }));
}

const norm = (v) => v.map((x) => x / Math.hypot(...v));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const range = (values) => values.reduce(([lo, hi], v) => [Math.min(lo, v), Math.max(hi, v)], [Infinity, -Infinity]);
const shade = (hex, k) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).join(',')})`;

/** One view as SVG: back faces culled, the rest painted far to near, Lambert-shaded. */
export function meshSvg(parts, view, caption) {
  const d = norm(VIEWS[view]);
  const right = norm(cross([0, 1, 0], d));
  const up = cross(d, right);
  const light = norm([0.4, 1, 0.6]);
  // Split long triangles so painting far to near orders small pieces, not whole faces.
  const flat = parts.flatMap((part) => part.tris).flat();
  const limit = Math.hypot(...[0, 1, 2].map((i) => range(flat.map((p) => p[i]))).map(([lo, hi]) => hi - lo)) / 12;
  const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  const split = (t, n = 0) => (n > 2 || Math.max(...t.map((p, i) => Math.hypot(...sub(p, t[(i + 1) % 3])))) <= limit ? [t]
    : [[t[0], mid(t[0], t[1]), mid(t[0], t[2])], [mid(t[0], t[1]), t[1], mid(t[1], t[2])], [mid(t[0], t[2]), mid(t[1], t[2]), t[2]], [mid(t[0], t[1]), mid(t[1], t[2]), mid(t[0], t[2])]].flatMap((q) => split(q, n + 1)));
  const faces = parts.flatMap((part) => part.tris.flatMap((whole) => split(whole)).flatMap((t) => {
    const n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    if (!(Math.hypot(...n) > 0) || dot(n, d) <= 0) return [];
    const k = 0.55 + 0.45 * Math.max(0, dot(norm(n), light));
    return [{ uv: t.map((p) => [dot(p, right), -dot(p, up)]), depth: t.reduce((s, p) => s + dot(p, d), 0) / 3, fill: shade(part.color, k) }];
  }));
  faces.sort((a, b) => a.depth - b.depth);
  const all = faces.flatMap((f) => f.uv);
  const [[x0, x1], [y0, y1]] = [range(all.map((p) => p[0])), range(all.map((p) => p[1]))];
  const span = Math.max(x1 - x0, y1 - y0, 0.2);
  const s = 560 / span;
  const pts = (uv) => uv.map(([u, v]) => `${((u - x0) * s + 20).toFixed(1)},${((v - y0) * s + 40).toFixed(1)}`).join(' ');
  const body = faces.map((f) => `<polygon points="${pts(f.uv)}" fill="${f.fill}" stroke="${f.fill}" stroke-width="1"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${Math.ceil((y1 - y0) * s + 60)}">\n<rect width="100%" height="100%" fill="#fff"/><text x="10" y="18" font-family="sans-serif" font-size="11">${caption}</text>\n<g shape-rendering="crispEdges">${body}</g>\n</svg>\n`;
}

/** The plan primitives (red) over the top-down projection of the body (grey), at 1:50, +z down. */
export function overlaySvg(primitives, parts, caption) {
  const tris = parts.flatMap((part) => part.tris);
  const lines = primitives.flatMap((p) => {
    if (p.kind === 'region') return [p.outer, ...(p.holes ?? [])].map((ring) => [...ring, ring[0]]);
    if (p.kind === 'line') return [[p.start, p.end]];
    if (p.kind === 'polyline') return [p.points];
    if (p.kind !== 'arc') return [];
    return [Array.from({ length: 49 }, (_, i) => {
      const a = ((p.startAngleDeg + ((p.endAngleDeg - p.startAngleDeg) * i) / 48) * Math.PI) / 180;
      return { x: p.center.x + p.radius * Math.cos(a), y: p.center.y + p.radius * Math.sin(a) };
    })];
  });
  const xs = [...tris.flat().map((p) => p[0]), ...lines.flat().map((q) => q.x), 0];
  const zs = [...tris.flat().map((p) => p[2]), ...lines.flat().map((q) => q.y), 0];
  const [[x0, x1], [z0, z1], mm] = [range(xs), range(zs), 20];
  const X = (x) => ((x - x0) * mm + 10).toFixed(2);
  const Z = (z) => ((z - z0) * mm + 10).toFixed(2);
  const [w, h] = [Math.max((x1 - x0) * mm + 20, 110), (z1 - z0) * mm + 28];
  const grey = tris.map((t) => `<path d="M${t.map((p) => `${X(p[0])} ${Z(p[2])}`).join('L')}Z"/>`).join('');
  const red = lines.map((run) => `<polyline points="${run.map((q) => `${X(q.x)},${Z(q.y)}`).join(' ')}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}mm" height="${h.toFixed(1)}mm" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}">\n<rect width="100%" height="100%" fill="#fff"/>
<g opacity="0.35" fill="#555" stroke="#555" stroke-width="0.05">${grey}</g>\n<g fill="none" stroke="#d00" stroke-width="0.25">${red}</g>
<path d="M${X(-0.05)} ${Z(0)}H${X(0.05)}M${X(0)} ${Z(-0.05)}V${Z(0.05)}" stroke="#06c" stroke-width="0.2"/>
<text x="10" y="${(h - 4).toFixed(1)}" font-family="sans-serif" font-size="2.2">${caption}</text>\n</svg>\n`;
}

/** Chromium for the PNG views: FLOORKIT_CHROMIUM (`none` turns it off), else the newest Playwright headless shell. */
export function findChromium() {
  if (process.env.FLOORKIT_CHROMIUM) return process.env.FLOORKIT_CHROMIUM === 'none' ? null : process.env.FLOORKIT_CHROMIUM;
  for (const cache of [path.join(homedir(), 'Library/Caches/ms-playwright'), path.join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(cache)) continue;
    const builds = readdirSync(cache).filter((name) => /^chromium_headless_shell-\d+$/.test(name)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const build of builds) {
      for (const dir of readdirSync(path.join(cache, build)).filter((name) => name.startsWith('chrome-headless-shell'))) {
        const exe = path.join(cache, build, dir, 'chrome-headless-shell');
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

const PAGE = `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:12px sans-serif}#c{position:absolute;left:10px;top:6px}</style>
<script type="importmap">{"imports":{"three":"http://render.local/three.module.js"}}</script><div id="c"></div><script type="module">
import * as THREE from 'three';
const gl = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
gl.setSize(900, 700); gl.setClearColor(0xffffff, 1); document.body.appendChild(gl.domElement);
window.draw = (parts, dir, caption) => {
  document.getElementById('c').textContent = caption;
  const scene = new THREE.Scene(), box = new THREE.Box3();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 5, 4); scene.add(sun);
  for (const part of parts) {
    if (!part.tris.length) continue;
    // The kernel's own index and per-vertex normals, so a round body shades smooth; edges from the triangles as before.
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(part.mesh.positions, 3)); g.setIndex(part.mesh.indices);
    if (part.mesh.normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(part.mesh.normals, 3)); else g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: part.color, side: THREE.DoubleSide })));
    const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute(part.tris.flat(2), 3));
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(t, 25), new THREE.LineBasicMaterial({ color: 0x222222 })));
    g.computeBoundingBox(); box.union(g.boundingBox);
  }
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3()), span = Math.max(size.x, size.z) + 0.4;
  const grid = new THREE.GridHelper(Math.ceil(span * 10) / 10, Math.ceil(span * 10), 0xc8c8c8, 0xe2e2e2);
  grid.position.set(Math.round(centre.x * 10) / 10, 0, Math.round(centre.z * 10) / 10); scene.add(grid);
  const r = Math.max(size.length() / 2, 0.2) * 1.15, cam = new THREE.OrthographicCamera(-r * 9 / 7, r * 9 / 7, r, -r, 0.01, 100);
  cam.position.copy(centre).addScaledVector(new THREE.Vector3(...dir).normalize(), 20); cam.lookAt(centre);
  gl.render(scene, cam);
};
window.ready = true;
</script>`;

/** A headless Chromium page that draws parts with Floorkit's three.js; `null` when it cannot start. */
export async function openChromium(executablePath, require) {
  if (!executablePath) return null;
  const { chromium } = await import(pathToFileURL(path.join(path.dirname(require.resolve('playwright')), 'index.mjs')).href);
  const browser = await chromium.launch({ executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const three = path.dirname(require.resolve('three'));
  await page.route('http://render.local/**', (route) => {
    const file = path.basename(new URL(route.request().url()).pathname);
    return route.fulfill(file ? { contentType: 'text/javascript', body: readFileSync(path.join(three, file)) } : { contentType: 'text/html', body: PAGE });
  });
  await page.goto('http://render.local/');
  await page.waitForFunction(() => window.ready === true);
  return {
    version: browser.version(),
    picture: async (parts, view, caption) => {
      await page.evaluate(([p, d, c]) => window.draw(p, d, c), [parts, VIEWS[view], caption]);
      return page.screenshot();
    },
    close: () => browser.close(),
  };
}
