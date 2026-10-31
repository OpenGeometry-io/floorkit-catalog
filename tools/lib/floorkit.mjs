// SPDX-License-Identifier: Apache-2.0
/**
 * Floorkit, loaded from the build a maintainer names in FLOORKIT_DIR, for the
 * maintainer tools (`parity.mjs`, `render.mjs`). Nothing here is a dependency
 * of the catalog: Floorkit, its kernel and three.js all come from that build's
 * own `dist/` and `node_modules/`.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ROOT, listBlocks } from './repo.mjs';

let booting = null; // the boot, started once
let kernel = null; // OpenGeometry, once booted

/**
 * Boot kernel 3.0 once, as Floorkit's own tests/helpers/kernel.mjs does. The
 * package exports only `import`, so it is found by its package.json; its
 * index.js is the SAME module instance Floorkit's dist imports, else a second
 * kernel copy would stay unbooted. Node has no Worker: tessellate inline.
 */
function bootKernel(require) {
  booting ??= (async () => {
    const pkg = path.dirname(require.resolve('opengeometry/package.json'));
    const { OpenGeometry } = await import(pathToFileURL(path.join(pkg, 'index.js')).href);
    const wasmModule = await WebAssembly.compile(readFileSync(path.join(pkg, 'opengeometry_bg.wasm')));
    await OpenGeometry.create({ wasmModule }, { tessellation: 'inline' });
    kernel = OpenGeometry;
  })();
  return booting;
}

/** Import Floorkit's `dist/index.js`, and boot its kernel when `boot` is set. */
export async function loadFloorkit({ boot = false } = {}) {
  const dir = process.env.FLOORKIT_DIR;
  if (!dir) throw new Error('Set FLOORKIT_DIR to a Floorkit checkout or package with a built dist/index.js.');
  const entry = path.resolve(dir, 'dist', 'index.js');
  const floorkit = await import(pathToFileURL(entry).href);
  // Resolved from Floorkit's own location, so these are the SAME module
  // instances Floorkit uses; a second kernel copy would stay unbooted.
  const require = createRequire(entry);
  const three = path.join(path.dirname(require.resolve('three')), 'three.module.js'); // the ESM build dist imports
  const THREE = await import(pathToFileURL(three).href);
  if (boot) await bootKernel(require);
  return { dir: path.resolve(dir), entry, floorkit, require, THREE };
}

/**
 * The blocks a tool works on: the files named on the command line, or the
 * whole catalog. `out` is where the tool writes for that file:
 * `<renders>/<publisher>/<slug>/<version>/` for a block in `blocks/`,
 * `<renders>/files/<name>/` for any other file. `block` and `version` say
 * which block and version a file in `blocks/` is (`version` null elsewhere).
 */
export function targets(args, renders) {
  const files = args.filter((arg) => !arg.startsWith('--'));
  const listed = files.length > 0 ? files.map((file) => path.resolve(file)) : listBlocks(ROOT).blocks.map((b) => path.join(ROOT, b.file));
  return listed.map((file) => {
    const rel = path.relative(path.join(ROOT, 'blocks'), file).split(path.sep);
    const inBlocks = rel.length === 3 && !rel[0].startsWith('..');
    const name = inBlocks ? `${rel[0]}.${rel[1]}@${rel[2].replace(/\.op$/, '')}` : path.relative(ROOT, file);
    const out = inBlocks ? path.join(renders, rel[0], rel[1], rel[2].replace(/\.op$/, '')) : path.join(renders, 'files', path.basename(file).replace(/\.\w+$/, ''));
    // `block` names the block across its versions (`<publisher>/<slug>`); a file outside blocks/ is its own block.
    const [block, version] = inBlocks ? [`${rel[0]}/${rel[1]}`, rel[2].replace(/\.op$/, '')] : [file, null];
    return { file, name, out, block, version, text: readFileSync(file, 'utf8') };
  });
}

/** A one-instance BuildingModel that places the block at the origin. */
export function placedModel(uri, scale = [1, 1, 1]) {
  const instance = { id: 'block', assetRef: 'block', position: [0, 0, 0], scale };
  const storey = { id: 'level', name: 'Level', elevation: 0, height: 3, walls: [], spaces: [], instances: [instance] };
  return { schema: 'floorkit.building-model', version: 3, units: 'meters', upAxis: 'y', id: 'catalog-block',
    assets: { block: { kind: 'external-op', uri } }, buildings: [{ id: 'building', storeys: [storey] }] };
}

/**
 * The coarsest chord error of the review pictures, in metres: Floorkit's own
 * drawing deflection (`BLOCK_MESH_DEFLECTION` in its `project-block-mesh.ts`),
 * which the kernel rounds down to 1.953 mm. In Node the kernel picks a chord
 * bucket per body by its size: 0.06 mm to 7.8 mm on the catalog. A body it
 * meshes coarser than this is meshed at this; a finer one keeps its mesh, so a
 * small tap is not made coarser than before.
 */
export const PICTURE_DEFLECTION = 0.002;

/**
 * World-space triangles of each 3D node of a built element, named as Floorkit
 * names them. Kernel 3.0 meshes only the bodies shown since the last flush:
 * show them (`updateMatrixWorld`), flush synchronously, then show them again so
 * that each new mesh is placed (Floorkit's kernel-display.ts does the same).
 *
 * Each part has `tris` (three corners per triangle, as `mesh.mjs` reads them)
 * and `mesh`, the kernel's own indexed mesh in the world: `positions`,
 * `normals` (the kernel's per-vertex normals, so a round body shades smooth)
 * and `indices`. `maxDeflection` (metres) meshes again, as Floorkit's drawing
 * does (`body.setAppearance({ deflection })`), each body the kernel meshed
 * coarser than that, and throws when one stays coarser; leave it unset for the
 * kernel's own mesh, as `parity.mjs` does.
 */
export function bodyParts(element, { maxDeflection } = {}) {
  if (!kernel) throw new Error('bodyParts needs the kernel: loadFloorkit({ boot: true }) first.');
  const bodies = element.getPhysicalParts();
  const show = () => {
    element.updateMatrixWorld(true);
    kernel.flush({ geometry: 'sync' });
    element.updateMatrixWorld(true);
  };
  show();
  // The kernel meshes in body units: the chord bucket of the deflection over the body's scale.
  const limit = (body) => 2 ** Math.floor(Math.log2(maxDeflection / Math.cbrt(Math.abs(body.matrixWorld.determinant()))));
  if (maxDeflection !== undefined) {
    const coarse = bodies.filter((body) => !(body.record?.bucket <= limit(body)));
    for (const body of coarse) body.setAppearance({ deflection: maxDeflection });
    if (coarse.length > 0) show();
    for (const body of coarse) {
      if (!(body.record?.bucket <= limit(body))) throw new Error(`${body.name}: meshed at ${body.record?.bucket} m, coarser than the ${limit(body)} m bucket of ${maxDeflection} m`);
    }
  }
  return bodies.map((part) => {
    const tris = [];
    const [positions, normals, indices] = [[], [], []];
    let color = null;
    let unnormalled = false;
    part.traverse((object) => {
      const position = object.isMesh ? object.geometry?.attributes?.position : undefined;
      if (!position) return;
      color ??= object.material?.color ? `#${object.material.color.getHexString()}` : null;
      const m = object.matrixWorld.elements;
      const index = object.geometry.index;
      const at = (i) => {
        const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
        return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
      };
      const count = index ? index.count : position.count;
      for (let k = 0; k + 2 < count; k += 3) tris.push([0, 1, 2].map((j) => at(index ? index.getX(k + j) : k + j)));
      // The normal matrix (inverse transpose of the 3x3, up to scale) is the cofactor matrix; a mirror flips its sign.
      const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
      const cof = [e * i - f * h, f * g - d * i, d * h - e * g, c * h - b * i, a * i - c * g, b * g - a * h, b * f - c * e, c * d - a * f, a * e - b * d];
      const sign = Math.sign(a * cof[0] + b * cof[1] + c * cof[2]) || 1;
      const normal = object.geometry.attributes.normal;
      const first = positions.length / 3;
      for (let v = 0; v < position.count; v += 1) {
        positions.push(...at(v));
        const n = normal ? [normal.getX(v), normal.getY(v), normal.getZ(v)] : [0, 0, 0];
        const w = [0, 1, 2].map((r) => sign * (cof[3 * r] * n[0] + cof[3 * r + 1] * n[1] + cof[3 * r + 2] * n[2]));
        const length = Math.hypot(...w) || 1;
        normals.push(...w.map((x) => x / length));
      }
      for (let k = 0; k + 2 < count; k += 3) for (let j = 0; j < 3; j += 1) indices.push(first + (index ? index.getX(k + j) : k + j));
      unnormalled ||= !normal;
    });
    return { name: part.name, color, tris, mesh: { positions, normals: unnormalled ? null : normals, indices } };
  });
}
