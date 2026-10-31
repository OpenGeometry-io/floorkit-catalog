// SPDX-License-Identifier: Apache-2.0
/**
 * A Floorkit section and a Floorkit elevation of one block, for `render.mjs`:
 * the block alone at the origin of a one-storey project with no walls and no
 * rooms, drawn by `drawProjectView` and written by `exportProjectSheet` at
 * 1:50, so the pens are Floorkit's own, as in `examples/demo.mjs`.
 *
 * - `section-1-50.svg`: the line runs along x through the centre of the
 *   body's plan box, beyond both sides, and looks towards the back of the
 *   block (-z), deep enough to reach the back of the body; level label at
 *   datum 0, as the demo's section has.
 * - `elevation-1-50.svg`: looks at the front (+z is the front of a block,
 *   `lib/pictures.mjs`), from 1 m in front of the body.
 *
 * Each view is cropped to the body's height with a margin of `MARGIN`. The
 * section is drawn and checked but not shown on the gallery card: Floorkit
 * draws a block in a section as seen lines, not cut (FLO-308), so it equals
 * the elevation until FLO-272.
 */

/** The margin around the body, in metres, of each view's crop. */
export const MARGIN = 0.1;

/** The box of the body's kernel triangles (`bodyParts`), in the world: `{ min: [x, y, z], max: [x, y, z] }`. */
export function partsBox(parts) {
  const [min, max] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const part of parts) {
    for (const triangle of part.tris) {
      for (const point of triangle) {
        for (let i = 0; i < 3; i += 1) {
          min[i] = Math.min(min[i], point[i]);
          max[i] = Math.max(max[i], point[i]);
        }
      }
    }
  }
  return { min, max };
}

/** The two saved views of a block whose body box is `box`, in Floorkit's view definitions. */
export function blockViews(box, id = 'block') {
  const [[x0, y0, z0], [x1, y1, z1]] = [box.min, box.max];
  const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const half = (x1 - x0) / 2 + MARGIN;
  return [
    { id: 'section', name: 'Section', kind: 'section', line: { start: [cx - half, cz], end: [cx + half, cz] },
      lookSide: 'left', depth: cz - z0 + MARGIN, elementIds: [id], verticalCrop: { minY: y0 - MARGIN, maxY: y1 + MARGIN },
      settings: { levelLabels: { datum: 0, unit: 'm' } } },
    // In an elevation, height is -y: `bottom` is minus the top of the crop, `top` minus its foot.
    { id: 'elevation', name: 'Elevation', kind: 'elevation', origin: [cx, z1 + 1], lookDirection: [0, -1],
      crop: { left: -half, right: half, bottom: -(y1 + MARGIN), top: -(y0 - MARGIN) }, elementIds: [id] },
  ];
}

/**
 * Draw the section and the elevation of a block. Returns `{ section, elevation }`,
 * each `{ svg }` or `{ error }`: an error when Floorkit refuses the view (it
 * refuses one that sees nothing with `empty-view`), and when the drawing has no
 * primitive of the block (it would print as a blank page).
 */
export function sectionAndElevation(floorkit, text, box) {
  const views = blockViews(box);
  const instance = { id: 'block', assetRef: 'block', position: [0, 0, 0] };
  const storey = { id: 'level', name: 'Level', elevation: 0, height: 3, walls: [], spaces: [], instances: [] };
  const model = { schema: 'floorkit.building-model', version: 3, units: 'meters', upAxis: 'y', id: 'catalog-block', assets: {},
    buildings: [{ id: 'building', storeys: [storey] }] };
  const project = { schema: 'floorkit.project', version: 3, buildingModel: model, views, paper: { version: 1, unitSystem: 'metric', sheets: [] } };
  const manager = new floorkit.ProjectManager(project, { build: { assetSources: { 'block.op': text } } });
  try {
    manager.apply({ kind: 'batch', commands: [
      { kind: 'add-asset', assetId: 'block', asset: { kind: 'external-op', uri: 'block.op' } },
      { kind: 'add-element', buildingId: 'building', storeyId: 'level', list: 'instances', element: instance },
    ] });
    const snapshot = manager.snapshot();
    const out = {};
    const sheets = [];
    for (const { id } of views) {
      try {
        const drawing = floorkit.drawProjectView(snapshot, id, { session: manager.session });
        if (!drawing.primitives.some((p) => p.sourceRef?.elementId === 'block')) throw new Error('Floorkit draws nothing of the block');
        const { min, max } = drawing.bounds;
        const [width, height] = [(max.x - min.x) * 20 + 20, (max.y - min.y) * 20 + 20];
        sheets.push({ id, name: id, page: { format: 'Custom', orientation: width >= height ? 'landscape' : 'portrait', size: { width, height }, margin: 0 },
          viewports: [{ id: `${id}-vp`, viewId: id, frame: { x: 0, y: 0, width, height }, scale: 0.02, rotationDeg: 0, clip: true,
            viewCenter: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 } }], annotations: [] });
      } catch (error) {
        out[id] = { error: `${error.code ? `${error.code}: ` : ''}${String(error?.message ?? error).split('\n')[0]}` };
      }
    }
    const withSheets = { ...snapshot, paper: { ...snapshot.paper, sheets } };
    for (const { id } of sheets) out[id] = { svg: floorkit.exportProjectSheet(withSheets, id, 'svg', { session: manager.session }) };
    return out;
  } finally {
    manager.dispose();
  }
}
