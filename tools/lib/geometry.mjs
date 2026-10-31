// SPDX-License-Identifier: Apache-2.0
/**
 * Geometry gates, computed from the JSON alone (no kernel), so CI runs them on
 * every pull request. Each solid is reduced to its axis-aligned bounding box in
 * block space, with every node rotation, scale and ref placement applied:
 *
 * (a) the body's bounds equal `dimensions` within 0.005 m on each axis;
 * (b) nothing goes below y = 0 by more than 0.001 m unless the note says `recess`;
 * (c) the plan (polygons, polylines, offsets and arcs, bounded exactly) spans
 *     the body's x and z bounds within 0.005 m; arcs are left out on a DOOR
 *     or WINDOW, or when the note says `swing`, since a swing draws outside;
 * (d) every solid is joined to a ground through solids whose boxes touch within
 *     0.001 m; grounds are the floor, the wall plane at `wallFace`, and the
 *     planes the note names with `ceiling <m>` and `at <m>`;
 * (e) for `catalog:lod` "300" only: at least 3 solids, filling under 95 % of
 *     their box (the note's `carcass` or `slab` waives the ratio only);
 * (f) every anchor and port lies on a solid's surface within 0.005 m; only
 *     `base` and `wallFace` may instead stand on the floor under the body;
 * (g) `seat`, `rim`, `top` and `ceiling` match an exposed top face, and
 *     `bottom`, `underside` and `at` an exposed bottom face, within 0.005 m;
 * (h) every model node has a `mat:` role; a ref may take its definition's.
 *
 * Boxes are conservative for rotated parts. A boolean's box is its base's (a
 * union's spans all its parts); its volume is the base's, a union's the base's
 * plus its operands'. A sweep's profile, drawn facing +y as in the glazed-door
 * frame, is turned along each path segment; its corners are not mitred. A surface is a box face, so (f) is exact for
 * cuboids and lenient elsewhere.
 *
 * Format v2 kinds: the boxes of a sphere, a torus, a cylinder sector, an outline
 * sweep and a revolve are exact before any turn (an arc's extremes are taken
 * exactly, `outline.mjs`); a cone is bounded as a cylinder of its larger radius,
 * exact upright; a shell takes its source's box. Volumes are exact except a
 * revolve's and an outline's area (arcs cut into 10° chords, within 0.6 %) and a
 * shell of anything but a cuboid, sphere or full cylinder, which counts its
 * source's whole volume.
 */
import { areaAndCentroid, outlineEdges, outlinePolygon, support } from './outline.mjs';

const DIMENSION_TOLERANCE = 0.005;
const CONTACT_TOLERANCE = 0.001;
const MIN_SOLIDS = 3;
const MAX_FILL = 0.95;
const AXES = ['x', 'y', 'z'];

/** A placement as an affine map: 3 × 3 matrix `m` (rows) and translation `t`. */
function placementMap(placement) {
  if (!placement) return { m: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], t: [0, 0, 0] };
  const [rx, ry, rz] = placement.rotation.map((deg) => (deg * Math.PI) / 180);
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  // three.js Euler order 'XYZ': R = Rx · Ry · Rz.
  const r = [
    [cy * cz, -cy * sz, sy],
    [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy],
    [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy],
  ];
  const m = r.map((row) => row.map((v, j) => v * placement.scale[j]));
  const a = placement.anchor ?? [0, 0, 0];
  // T(position) · T(anchor) · R · S · T(−anchor)
  const t = [0, 1, 2].map((i) => placement.position[i] + a[i] - (m[i][0] * a[0] + m[i][1] * a[1] + m[i][2] * a[2]));
  return { m, t };
}
const compose = (outer, inner) => ({
  m: outer.m.map((row) => [0, 1, 2].map((j) => row[0] * inner.m[0][j] + row[1] * inner.m[1][j] + row[2] * inner.m[2][j])),
  t: [0, 1, 2].map((i) => outer.m[i][0] * inner.t[0] + outer.m[i][1] * inner.t[1] + outer.m[i][2] * inner.t[2] + outer.t[i]),
});
const apply = (map, p) => [0, 1, 2].map((i) => map.m[i][0] * p[0] + map.m[i][1] * p[1] + map.m[i][2] * p[2] + map.t[i]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const det = ({ m }) => Math.abs(m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]));
const boxOf = (points) => ({
  min: [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i]))),
  max: [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i]))),
});
const cornersOf = (min, max) => {
  const corners = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z]);
  return corners;
};

/** A cylinder sector: its centre line, both ends of the arc and every axis the arc crosses, the point at angle a at (cx + r cos a, cz − r sin a). */
function sectorBox(node, own) {
  const start = node.startAngle ?? 0;
  const [a0, a1] = [start, start + node.angle];
  const angles = [a0, a1];
  for (let k = Math.ceil(a0 / (Math.PI / 2)); k * (Math.PI / 2) < a1; k += 1) angles.push((k * Math.PI) / 2);
  const plan = [[0, 0], ...angles.map((a) => [node.radius * Math.cos(a), -node.radius * Math.sin(a)])];
  const [cx, cy, cz] = node.center;
  const corners = plan.flatMap(([x, z]) => [-1, 1].map((s) => apply(own, [cx + x, cy + (s * node.height) / 2, cz + z])));
  return { ...boxOf(corners), volume: (node.radius ** 2 * node.angle * node.height * det(own)) / 2 };
}

/**
 * A revolve's outline against its axis: `rho(q)` is the signed distance of an outline point from
 * the axis, and `nearest`/`farthest` its least and greatest value over the whole outline, arcs
 * included. The outline clears the axis when both have one sign.
 */
export function revolveAxis(node) {
  const point = node.axis?.point ?? [0, 0];
  const [dx, dy] = node.axis?.direction ?? [0, 1];
  const length = Math.hypot(dx, dy);
  const d = [dx / length, dy / length];
  const g = [-d[1], d[0]];
  const edges = outlineEdges(node.profile, (arc) => arc.counterClockwise);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const max = (h, k) => support(edges, h) + k;
  const min = (h, k) => -support(edges, [-h[0], -h[1]]) + k;
  return { point, d, g, edges, dot, max, min, nearest: min(g, -dot(g, point)), farthest: max(g, -dot(g, point)) };
}

/** A revolve's exact box and its volume by Pappus's theorem, before its placement. */
function revolveBox(node) {
  const { point: p, d, g, edges, dot, max, min, nearest } = revolveAxis(node);
  const s = nearest >= -1e-9 ? 1 : -1; // the side the outline is on; an edge may lie on the axis
  // Each outline point turns on a circle about the axis: centre p + t·d with t = d·(q − p), radius s·rho(q).
  // Along x that circle reaches centre_x ± |d_y|·radius, along y centre_y ± |d_x|·radius, along z ± radius.
  // Each bound is affine in q, h·q + k, so its extreme over the outline is a support value.
  const bound = (axis, sign) => {
    const k = Math.abs(d[1 - axis]) * s * sign;
    const h = [d[axis] * d[0] + k * g[0], d[axis] * d[1] + k * g[1]];
    return [h, p[axis] - d[axis] * dot(d, p) - k * dot(g, p)];
  };
  const box = {
    min: [min(...bound(0, -1)), min(...bound(1, -1)), -max([s * g[0], s * g[1]], -s * dot(g, p))],
    max: [max(...bound(0, 1)), max(...bound(1, 1)), max([s * g[0], s * g[1]], -s * dot(g, p))],
  };
  const { area, centroid } = areaAndCentroid(outlinePolygon(edges));
  return { ...box, volume: 2 * Math.PI * Math.abs(area) * Math.abs(dot(g, centroid) - dot(g, p)) };
}

/** The box of a definition in definition space, for the format v2 gates of `op.mjs`. */
export const definitionBox = (node, definitions) => solidBox(node, placementMap(), definitions, true);

/** The block-space box of one solid node under `map`, or null for a node that is not a solid. */
function solidBox(node, map, definitions, v2 = false) {
  const own = compose(map, placementMap(node.placement));
  if (node.ref !== undefined) {
    // In modelView a ref's placement applies on top of the definition's own.
    return definitions[node.ref] ? solidBox(definitions[node.ref], own, definitions, v2) : null;
  }
  if (node.kind === 'cuboid') {
    const [w, h, d] = [node.width / 2, node.height / 2, node.depth / 2];
    const corners = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      corners.push(apply(own, [node.center[0] + sx * w, node.center[1] + sy * h, node.center[2] + sz * d]));
    }
    return { ...boxOf(corners), volume: node.width * node.height * node.depth * det(own) };
  }
  if (node.kind === 'cylinder' && node.angle !== undefined && v2) {
    // A format v2 sector. A format 1 partial cylinder is bounded as a full one below: the
    // drafting standard refuses it on its own (§3), and its box must not add a second issue.
    return sectorBox(node, own);
  }
  if (node.kind === 'cylinder' || node.kind === 'cone') {
    // Exact for a full cylinder and an upright cone: the axis is the mapped y direction. A cone is
    // bounded as a cylinder of its larger radius: exact upright, sound when turned.
    const radius = node.kind === 'cone' ? Math.max(node.radiusBottom, node.radiusTop) : node.radius;
    const c = apply(own, node.center);
    const axis = [0, 1, 2].map((i) => own.m[i][1]);
    const radial = (i) => Math.hypot(own.m[i][0], own.m[i][2]) * radius;
    const half = [0, 1, 2].map((i) => Math.abs(axis[i]) * (node.height / 2) + radial(i));
    const volume = node.kind === 'cone'
      ? (Math.PI * node.height * (node.radiusBottom ** 2 + node.radiusBottom * node.radiusTop + node.radiusTop ** 2)) / 3
      : Math.PI * node.radius ** 2 * node.height;
    return { min: c.map((v, i) => v - half[i]), max: c.map((v, i) => v + half[i]), volume: volume * det(own) };
  }
  if (node.kind === 'sphere' || node.kind === 'torus') {
    // Exact under a turn and one scale factor, the only placements format v2 allows: a sphere
    // reaches r·|row| along each block axis, a flat torus R·|row in x–z| + r·|row|.
    const c = apply(own, node.center);
    const row = (i) => Math.hypot(...own.m[i]);
    const half = node.kind === 'sphere'
      ? [0, 1, 2].map((i) => row(i) * node.radius)
      : [0, 1, 2].map((i) => Math.hypot(own.m[i][0], own.m[i][2]) * node.majorRadius + row(i) * node.minorRadius);
    const volume = node.kind === 'sphere' ? (4 / 3) * Math.PI * node.radius ** 3 : 2 * Math.PI ** 2 * node.majorRadius * node.minorRadius ** 2;
    return { min: c.map((v, i) => v - half[i]), max: c.map((v, i) => v + half[i]), volume: volume * det(own) };
  }
  if (node.kind === 'revolve') {
    const { min, max, volume } = revolveBox(node);
    return { ...boxOf(cornersOf(min, max).map((p) => apply(own, p))), volume: volume * det(own) };
  }
  if (node.kind === 'sweep' && node.profile && !Array.isArray(node.profile)) {
    // An outline sweep: the plan outline extruded straight up from the path's lower end, bounded exactly.
    const edges = outlineEdges(node.profile, (arc) => !arc.counterClockwise);
    const [low, high] = node.path[0][1] <= node.path[1][1] ? node.path : [node.path[1], node.path[0]];
    const min = [low[0] - support(edges, [-1, 0]), low[1], low[2] - support(edges, [0, -1])];
    const max = [low[0] + support(edges, [1, 0]), high[1], low[2] + support(edges, [0, 1])];
    const { area } = areaAndCentroid(outlinePolygon(edges));
    return { ...boxOf(cornersOf(min, max).map((p) => apply(own, p))), volume: Math.abs(area) * (high[1] - low[1]) * det(own) };
  }
  if (node.kind === 'shell') {
    // The source's box. The volume takes off the void exactly for a cuboid, a sphere or a full
    // cylinder source without a placement of its own; for any other source it is the source's
    // whole volume, an over-estimate, so the volume ratio of gate (e) errs towards refusing.
    const source = definitions[node.sourceRef];
    const box = source ? solidBox(source, own, definitions, v2) : null;
    if (!box) return null;
    const t = node.thickness;
    const inner = (v) => Math.max(0, v);
    const hollow = source.placement ? 0
      : source.kind === 'cuboid' ? inner(source.width - 2 * t) * inner(source.height - 2 * t) * inner(source.depth - 2 * t)
        : source.kind === 'sphere' ? (4 / 3) * Math.PI * inner(source.radius - t) ** 3
          : source.kind === 'cylinder' && source.angle === undefined ? Math.PI * inner(source.radius - t) ** 2 * inner(source.height - 2 * t)
            : 0;
    return { ...box, volume: box.volume - hollow * det(own) };
  }
  if (node.kind === 'sweep') {
    const { path, profile } = sweepCurves(node, definitions);
    // Profile area (in x-z, as the glazed-door orientation has it) times path length.
    const area = Math.abs(profile.reduce((sum, q, i) => sum + q[0] * profile[(i + 1) % profile.length][2] - profile[(i + 1) % profile.length][0] * q[2], 0)) / 2;
    const length = path.slice(1).reduce((sum, q, i) => sum + Math.hypot(q[0] - path[i][0], q[1] - path[i][1], q[2] - path[i][2]), 0);
    // Only the case sweepIssue admits: along each segment the profile is turned so that +y points
    // down the segment (Rodrigues' rotation about y × t), which matches OpenGeometry's sweep.rs there.
    const turned = path.slice(1).flatMap((q, i) => {
      const t = sub(q, path[i]).map((v, _, d) => v / (Math.hypot(...d) || 1));
      const k = [t[2], 0, -t[0]];
      const sin = Math.hypot(...k);
      const turn = sin < 1e-9
        ? (v) => (t[1] >= 0 ? v : [-v[0], -v[1], v[2]])
        : (v) => {
          const u = k.map((c) => c / sin);
          const [kv, kdv] = [cross(u, v), u[0] * v[0] + u[1] * v[1] + u[2] * v[2]];
          return [0, 1, 2].map((j) => v[j] * t[1] + kv[j] * sin + u[j] * kdv * (1 - t[1]));
        };
      return [path[i], q].flatMap((p) => profile.map((v) => turn(v)).map((v) => apply(own, [p[0] + v[0], p[1] + v[1], p[2] + v[2]])));
    });
    return { ...boxOf(turned.length ? turned : path.map((p) => apply(own, p))), volume: area * length * det(own) };
  }
  if (node.kind === 'boolean3d') {
    const box = (ref) => (definitions[ref] ? solidBox(definitions[ref], own, definitions, v2) : null);
    const base = box(node.baseRef);
    if (!base || node.operation === 'subtract') return base;
    const parts = node.operandRefs.map(box).filter(Boolean);
    const pick = node.operation === 'union' ? [Math.min, Math.max] : [Math.max, Math.min];
    const volume = node.operation === 'union' ? parts.reduce((sum, b) => sum + b.volume, base.volume) : base.volume;
    return parts.reduce((acc, b) => ({ min: acc.min.map((v, i) => pick[0](v, b.min[i])), max: acc.max.map((v, i) => pick[1](v, b.max[i])), volume }), base);
  }
  return null;
}

/** A sweep's path (repeated points dropped) and profile (a closing repeat dropped), in definition space. */
function sweepCurves(node, definitions) {
  const curve = (inline, ref) => inline ?? definitions[ref]?.points.map((p) => apply(placementMap(definitions[ref].placement), p)) ?? [[0, 0, 0]];
  const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  const path = curve(node.path, node.pathRef).filter((p, i, all) => i === 0 || !same(p, all[i - 1]));
  const profile = curve(node.profile, node.profileRef);
  return { path, profile: profile.length > 1 && same(profile[0], profile.at(-1)) ? profile.slice(0, -1) : profile };
}

/**
 * Why a sweep is outside the one case the gates bound exactly, or null. OpenGeometry's sweep.rs centres
 * the profile on its vertex average and orients it from its normal and the path's first direction.
 */
export function sweepIssue(node, definitions) {
  const { path, profile } = sweepCurves(node, definitions);
  const centre = [0, 1, 2].map((i) => profile.reduce((sum, p) => sum + p[i], 0) / profile.length);
  const newell = profile.reduce((n, a, i) => { const b = profile[(i + 1) % profile.length]; return [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }, [0, 0, 0]);
  const dirs = path.slice(1).map((q, i) => sub(q, path[i]).map((v, _, d) => v / Math.hypot(...d)));
  const across = path.map((p) => [p[0] - path[0][0], p[2] - path[0][2]]).find(([x, z]) => Math.hypot(x, z) > 1e-9);
  const why = centre.some((v) => Math.abs(v) > 0.001) ? `its profile is not centred on its vertex average at the origin (it is at ${centre.map(mm).join(', ')}; tolerance 0.001)`
    : !(newell[1] > 0 && Math.hypot(newell[0], newell[2]) < 1e-9 * Math.abs(newell[1])) ? 'its profile does not face +y (wind it the other way, in the x–z plane)'
    : !(dirs[0]?.[1] > 1 - 1e-9) ? 'its path does not start straight up (+y)'
    : across && path.some((p) => Math.abs(across[0] * (p[2] - path[0][2]) - across[1] * (p[0] - path[0][0])) > 1e-9) ? 'its path is not in one vertical plane'
    : dirs.slice(1).some((d, i) => d[0] * dirs[i][0] + d[1] * dirs[i][1] + d[2] * dirs[i][2] < -1e-9) ? 'its path turns by more than 90°'
    : null;
  return why && `is a sweep the gates cannot bound: ${why}. A sweep must match OpenGeometry's sweep.rs case: profile centred at the origin and facing +y, path starting straight up, in one vertical plane, no turn over 90°`;
}

/** Plan points of one profile node in block space (x, z), in drawing order; arcs only when `arcs`. */
function planPoints(node, definitions, arcs, placement = node.placement) {
  if (node.ref !== undefined) {
    // In profileView a ref's placement REPLACES the definition's own.
    const def = definitions[node.ref];
    return def ? planPoints(def, definitions, arcs, node.placement ?? def.placement) : [];
  }
  const map = placementMap(placement);
  const lift = (points) => points.map(([x, z]) => apply(map, [x, 0, z])).map((p) => [p[0], p[2]]);
  if (node.kind === 'polygon') return lift(node.vertices);
  if (node.kind === 'polyline') return lift(node.points);
  if (node.kind === 'arc' && arcs) {
    // The point at angle a is (cx + r cos a, cz − r sin a) (format §1): the ends, plus each axis the sweep crosses.
    const [a0, a1] = [Math.min(node.startAngle, node.startAngle + node.sweepAngle), Math.max(node.startAngle, node.startAngle + node.sweepAngle)];
    const angles = [a0, a1];
    for (let k = Math.ceil(a0 / (Math.PI / 2)); k * (Math.PI / 2) < a1; k += 1) angles.push((k * Math.PI) / 2);
    return lift(angles.map((a) => [node.center[0] + node.radius * Math.cos(a), node.center[1] - node.radius * Math.sin(a)]));
  }
  if (node.kind === 'offset2d') {
    // A positive distance is to the left of the source's direction, with x right and z up: the glazed-door
    // frame's +0.03 line runs outside its centreline. Each segment is moved along its own normal.
    const source = definitions[node.sourceRef];
    const pts = source ? planPoints(source, definitions, arcs) : [];
    const moved = pts.slice(1).flatMap((q, i) => {
      const [dx, dz] = [q[0] - pts[i][0], q[1] - pts[i][1]];
      const n = Math.hypot(dx, dz) || 1;
      const [ox, oz] = [(-dz / n) * node.distance, (dx / n) * node.distance];
      return [[pts[i][0] + ox, pts[i][1] + oz], [q[0] + ox, q[1] + oz]];
    });
    return lift(moved);
  }
  return [];
}

const mm = (v) => v.toFixed(3);

/**
 * Gates (a) to (d) for one schema-valid block. `note` is `parseNote` of its
 * `catalog:note`. Issues are `{ path, message }`, each naming the node and the
 * two numbers that disagree.
 */
export function geometryIssues(definition, note) {
  const issues = [];
  const definitions = definition.definitions ?? {};
  const v2 = definition.metadata['catalog:format'] === '2';
  const solids = definition.modelView.elements
    .map((node, index) => ({ name: node.id ?? node.ref, path: `/modelView/elements/${index}`, box: solidBox(node, placementMap(), definitions, v2) }))
    .filter((solid) => solid.box);
  if (solids.length === 0) return issues;
  const extreme = (axis, end) => solids.reduce((best, s) => ((end === 'min' ? s.box.min[axis] < best.box.min[axis] : s.box.max[axis] > best.box.max[axis]) ? s : best));

  // (a) bounds against dimensions
  const sizes = { x: definition.dimensions.width, y: definition.dimensions.height, z: definition.dimensions.depth };
  const field = { x: 'width', y: 'height', z: 'depth' };
  AXES.forEach((axis, i) => {
    const [lo, hi] = [extreme(i, 'min'), extreme(i, 'max')];
    const extent = hi.box.max[i] - lo.box.min[i];
    if (Math.abs(extent - sizes[axis]) > DIMENSION_TOLERANCE) {
      issues.push({ path: `/dimensions/${field[axis]}`, message: `is ${mm(sizes[axis])} m but the body spans ${mm(extent)} m in ${axis}, from "${lo.name}" at ${mm(lo.box.min[i])} to "${hi.name}" at ${mm(hi.box.max[i])} (tolerance ${DIMENSION_TOLERANCE})` });
    }
  });

  // (b) nothing below the floor
  const lowest = extreme(1, 'min');
  if (lowest.box.min[1] < -CONTACT_TOLERANCE && !note.markers.has('recess')) {
    issues.push({ path: lowest.path, message: `"${lowest.name}" goes down to y = ${mm(lowest.box.min[1])}, below the floor at 0.000; say "recess" in catalog:note if that is meant` });
  }

  // (c) the plan sits under the body
  const arcs = !['DOOR', 'WINDOW'].includes(definition.type) && !note.markers.has('swing');
  const plan = definition.profileView.elements.flatMap((node, index) => planPoints(node, definitions, arcs).map((p) => ({ p, index })));
  if (plan.length > 0) {
    for (const [i, axis] of [[0, 'x'], [2, 'z']]) {
      const k = i === 0 ? 0 : 1;
      for (const end of ['min', 'max']) {
        const point = plan.reduce((best, q) => ((end === 'min' ? q.p[k] < best.p[k] : q.p[k] > best.p[k]) ? q : best));
        const body = extreme(i, end);
        const want = end === 'min' ? body.box.min[i] : body.box.max[i];
        if (Math.abs(point.p[k] - want) > DIMENSION_TOLERANCE) {
          const plannode = definition.profileView.elements[point.index];
          issues.push({ path: `/profileView/elements/${point.index}`, message: `the plan's ${end} ${axis} is ${mm(point.p[k])} at "${plannode.id ?? plannode.ref}", but the body's is ${mm(want)} at "${body.name}" (tolerance ${DIMENSION_TOLERANCE})` });
        }
      }
    }
  }

  // (d) every solid reaches a ground
  const wall = definition.anchors?.wallFace?.placement.position[2];
  const grounded = (box) =>
    box.min[1] <= CONTACT_TOLERANCE || // on or through the floor; (b) judges the part below it
    (wall !== undefined && Math.abs(box.min[2] - wall) <= CONTACT_TOLERANCE) ||
    note.heights.ceiling.some((y) => Math.abs(box.max[1] - y) <= CONTACT_TOLERANCE) ||
    note.heights.at.some((y) => Math.abs(box.min[1] - y) <= CONTACT_TOLERANCE);
  const gap = (a, b) => Math.max(0, ...[0, 1, 2].map((i) => Math.max(a.min[i] - b.max[i], b.min[i] - a.max[i])));
  const reached = new Set(solids.filter((s) => grounded(s.box)));
  for (let grew = true; grew; ) {
    grew = false;
    for (const s of solids) {
      if (!reached.has(s) && [...reached].some((r) => gap(s.box, r.box) <= CONTACT_TOLERANCE)) {
        reached.add(s);
        grew = true;
      }
    }
  }
  for (const s of solids.filter((solid) => !reached.has(solid))) {
    const near = [...reached].sort((a, b) => gap(s.box, a.box) - gap(s.box, b.box))[0];
    const detail = near ? `the nearest grounded part, "${near.name}", is ${mm(gap(s.box, near.box))} m away` : `nothing is grounded; its lowest point is at ${mm(s.box.min[1])}`;
    issues.push({ path: s.path, message: `"${s.name}" floats: it reaches no ground through touching parts; ${detail} (tolerance ${CONTACT_TOLERANCE})` });
  }

  // (e) the LOD floor
  const body = { min: [0, 1, 2].map((i) => extreme(i, 'min').box.min[i]), max: [0, 1, 2].map((i) => extreme(i, 'max').box.max[i]) };
  // (e) binds only a block drawn to LOD 300 (owner decision 2026-10-27).
  const lod300 = definition.metadata['catalog:lod'] === '300';
  if (lod300 && solids.length < MIN_SOLIDS) issues.push({ path: '/modelView', message: `has ${solids.length} solid(s); LOD 300 needs at least ${MIN_SOLIDS}` });
  const fill = solids.reduce((sum, s) => sum + s.box.volume, 0) / body.max.reduce((v, hi, i) => v * (hi - body.min[i]), 1);
  if (lod300 && fill >= MAX_FILL && !note.markers.has('carcass') && !note.markers.has('slab')) {
    issues.push({ path: '/modelView', message: `the solids fill ${fill.toFixed(3)} of their bounding box; below ${MAX_FILL} is LOD 300 unless the note says "carcass" or "slab"` });
  }

  // (f) anchors and ports on the body
  const away = (p, box) => {
    const outside = Math.hypot(...[0, 1, 2].map((i) => Math.max(box.min[i] - p[i], 0, p[i] - box.max[i])));
    return outside > 0 ? outside : Math.min(...[0, 1, 2].flatMap((i) => [p[i] - box.min[i], box.max[i] - p[i]]));
  };
  const onFloorUnder = (p) => Math.abs(p[1]) <= DIMENSION_TOLERANCE && [0, 2].every((i) => p[i] >= body.min[i] - DIMENSION_TOLERANCE && p[i] <= body.max[i] + DIMENSION_TOLERANCE);
  const where = (p) => `(${p.map(mm).join(', ')})`;
  const points = [
    ...Object.entries(definition.anchors ?? {}).map(([name, a]) => [`anchor "${name}"`, `/anchors/${name}`, a.placement.position, ['base', 'wallFace'].includes(name)]),
    ...(definition.ports ?? []).map((port, index) => [`port "${port.id}"`, `/ports/${index}`, port.placement.position, false]),
  ];
  for (const [label, path, p, mayStandOnFloor] of points) {
    const nearest = solids.reduce((best, s) => (away(p, s.box) < away(p, best.box) ? s : best));
    if (away(p, nearest.box) > DIMENSION_TOLERANCE + 1e-9 && !(mayStandOnFloor && onFloorUnder(p))) { // float slack: 0.425 - 0.42 is 0.005000000000000004
      issues.push({ path, message: `${label} at ${where(p)} is ${mm(away(p, nearest.box))} m from the nearest body surface, on "${nearest.name}" (tolerance ${DIMENSION_TOLERANCE})` });
    }
  }

  // (g) note heights are faces
  for (const [keyword, values] of Object.entries(note.heights)) {
    for (const value of values) {
      const side = ['bottom', 'underside', 'at'].includes(keyword) ? 'bottom' : 'top';
      // An exposed face only: not wholly covered by another solid that meets it there (a leg's top under a seat).
      const [own, other] = side === 'top' ? ['max', 'min'] : ['min', 'max'];
      const covered = (s) => solids.some((o) => o !== s && Math.abs(o.box[other][1] - s.box[own][1]) <= CONTACT_TOLERANCE
        && [0, 2].every((i) => o.box.min[i] <= s.box.min[i] + CONTACT_TOLERANCE && o.box.max[i] >= s.box.max[i] - CONTACT_TOLERANCE));
      const faces = solids.filter((s) => !covered(s)).map((s) => [s.box[own][1], s]);
      const [y, s] = faces.reduce((best, face) => (Math.abs(face[0] - value) < Math.abs(best[0] - value) ? face : best));
      if (Math.abs(y - value) > DIMENSION_TOLERANCE) {
        issues.push({ path: '/metadata/catalog:note', message: `"${keyword} ${value.toFixed(2)}" matches no ${side} face; the nearest is ${mm(y)} on "${s.name}" (tolerance ${DIMENSION_TOLERANCE})` });
      }
    }
  }

  // (h) a material role on every model node
  const metadata = definition.metadata;
  definition.modelView.elements.forEach((node, index) => {
    const name = node.id ?? node.ref;
    if (metadata[`mat:${name}`] === undefined && (node.ref === undefined || metadata[`mat:${node.ref}`] === undefined)) {
      issues.push({ path: `/modelView/elements/${index}`, message: `"${name}" has no mat: role; set "mat:${name}"${node.ref ? ` or "mat:${node.ref}" on its definition` : ''}` });
    }
  });
  return issues;
}
