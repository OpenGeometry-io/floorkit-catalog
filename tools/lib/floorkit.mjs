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
  if (boot) {
    const kernelEntry = require.resolve('opengeometry');
    const { OpenGeometry } = await import(pathToFileURL(kernelEntry).href);
    globalThis.document ??= { createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
    // Booted from the .wasm BYTES, as Floorkit's own tests/helpers/kernel.mjs does.
    const wasm = readFileSync(path.join(path.dirname(kernelEntry), 'opengeometry', 'pkg', 'opengeometry_bg.wasm'));
    if (!OpenGeometry.instance) await OpenGeometry.create({ wasmURL: wasm });
  }
  return { dir: path.resolve(dir), entry, floorkit, require, THREE };
}

/**
 * The blocks a tool works on: the files named on the command line, or the
 * whole catalog. `out` is where the tool writes for that file:
 * `<renders>/<publisher>/<slug>/<version>/` for a block in `blocks/`,
 * `<renders>/files/<name>/` for any other file.
 */
export function targets(args, renders) {
  const files = args.filter((arg) => !arg.startsWith('--'));
  const listed = files.length > 0 ? files.map((file) => path.resolve(file)) : listBlocks(ROOT).blocks.map((b) => path.join(ROOT, b.file));
  return listed.map((file) => {
    const rel = path.relative(path.join(ROOT, 'blocks'), file).split(path.sep);
    const inBlocks = rel.length === 3 && !rel[0].startsWith('..');
    const name = inBlocks ? `${rel[0]}.${rel[1]}@${rel[2].replace(/\.op$/, '')}` : path.relative(ROOT, file);
    const out = inBlocks ? path.join(renders, rel[0], rel[1], rel[2].replace(/\.op$/, '')) : path.join(renders, 'files', path.basename(file).replace(/\.\w+$/, ''));
    return { file, name, out, text: readFileSync(file, 'utf8') };
  });
}

/** A one-instance BuildingModel that places the block at the origin. */
export function placedModel(uri, scale = [1, 1, 1]) {
  const instance = { id: 'block', assetRef: 'block', position: [0, 0, 0], scale };
  const storey = { id: 'level', name: 'Level', elevation: 0, height: 3, walls: [], spaces: [], instances: [instance] };
  return { schema: 'floorkit.building-model', version: 3, units: 'meters', upAxis: 'y', id: 'catalog-block',
    assets: { block: { kind: 'external-op', uri } }, buildings: [{ id: 'building', storeys: [storey] }] };
}

/** World-space triangles of each 3D node of a built element, named as Floorkit names them. */
export function bodyParts(element) {
  element.updateWorldMatrix(true, true);
  return element.getPhysicalParts().map((part) => {
    const tris = [];
    let color = null;
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
    });
    return { name: part.name, color, tris };
  });
}
