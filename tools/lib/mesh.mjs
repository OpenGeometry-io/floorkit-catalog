// SPDX-License-Identifier: Apache-2.0
/**
 * Is a built body a set of proper solids? Checked on the kernel's triangles
 * (`bodyParts` in `floorkit.mjs`), one report per block:
 *
 * - each node is closed (every edge in exactly two triangles, after welding
 *   vertices to 0.01 mm), wound consistently (each edge once each way), faces
 *   outward (signed volume > 0), has area, and is one shell;
 * - no two nodes interpenetrate by more than 1 mm, unless `catalog:note` lists
 *   the pair (`overlap <a>+<b>`, `note.mjs`). Depth is measured from points
 *   sampled over each face (a 6-step grid) against the other node's face
 *   planes; an edge of one node that crosses a face of the other, with both
 *   ends more than 1 mm from that face's plane, counts as an overlap too, with
 *   its depth not measured. Limits that remain: depth is exact for a convex
 *   node (a cuboid, a cylinder) and under-reports inside a concave one (a
 *   boolean's notch); a penetration of 1 mm or less by an edge is not seen; a
 *   node wholly inside a concave node's notch region can be missed.
 */
const WELD = 1e5;
const TOLERANCE = 0.001;
const key = (p) => p.map((v) => Math.round(v * WELD)).join(',');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A triangle's unit normal and a point on it, or null for a degenerate triangle. */
function plane(t) {
  const n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
  const length = Math.hypot(...n);
  return length < 1e-12 ? null : [n.map((v) => v / length), t[0]];
}

function shell(tris) {
  const edges = new Map();
  const parent = new Map();
  const find = (k) => (parent.get(k) === k ? k : (parent.set(k, find(parent.get(k))), parent.get(k)));
  let volume = 0;
  let area = 0;
  for (const t of tris) {
    const keys = t.map(key);
    for (const k of keys) if (!parent.has(k)) parent.set(k, k);
    parent.set(find(keys[0]), find(keys[1]));
    parent.set(find(keys[1]), find(keys[2]));
    for (let i = 0; i < 3; i += 1) {
      const edge = `${keys[i]}|${keys[(i + 1) % 3]}`;
      edges.set(edge, (edges.get(edge) ?? 0) + 1);
    }
    volume += dot(t[0], cross(t[1], t[2])) / 6;
    area += Math.hypot(...cross(sub(t[1], t[0]), sub(t[2], t[0]))) / 2;
  }
  // Directed: a closed, consistently wound shell has every edge once each way.
  let openEdges = 0;
  let windingEdges = 0;
  for (const [edge, count] of edges) {
    const [from, to] = edge.split('|');
    const back = edges.get(`${to}|${from}`) ?? 0;
    if (from > to && edges.has(`${to}|${from}`)) continue;
    if (count + back !== 2) openEdges += 1;
    else if (count !== 1) windingEdges += 1;
  }
  const shells = new Set([...parent.keys()].map(find)).size;
  return { triangles: tris.length, openEdges, windingEdges, volume, area, shells };
}

function box(tris) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (const p of t) for (let i = 0; i < 3; i += 1) [min[i], max[i]] = [Math.min(min[i], p[i]), Math.max(max[i], p[i])];
  return { min, max };
}

/** How far points sampled over A's faces reach inside B, in metres (0 when none does). */
function depthInside(a, b) {
  const planes = b.tris.map(plane).filter(Boolean);
  let deepest = 0;
  const steps = 6;
  for (const t of a.tris) {
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; i + j <= steps; j += 1) {
        const [u, v, w] = [i / steps, j / steps, (steps - i - j) / steps];
        const p = [0, 1, 2].map((ax) => u * t[0][ax] + v * t[1][ax] + w * t[2][ax]);
        let depth = Infinity;
        for (const [n, q] of planes) depth = Math.min(depth, dot(n, sub(q, p)));
        deepest = Math.max(deepest, depth);
      }
    }
  }
  return deepest;
}

/** Does an edge of A pass through a face of B, both ends more than 1 mm from the face's plane? */
function crosses(a, b) {
  const faces = b.tris.map((t) => [t, plane(t)]).filter(([, p]) => p);
  for (const t of a.tris) {
    for (let i = 0; i < 3; i += 1) {
      const [p, q] = [t[i], t[(i + 1) % 3]];
      for (const [f, [n, o]] of faces) {
        const [dp, dq] = [dot(n, sub(p, o)), dot(n, sub(q, o))];
        if (!((dp > TOLERANCE && dq < -TOLERANCE) || (dp < -TOLERANCE && dq > TOLERANCE))) continue;
        const x = p.map((v, k) => v + ((q[k] - v) * dp) / (dp - dq));
        const inside = [0, 1, 2].every((k) => dot(cross(sub(f[(k + 1) % 3], f[k]), sub(x, f[k])), n) >= -1e-12);
        if (inside) return true;
      }
    }
  }
  return false;
}

/** The mesh report of one block: per node, per overlapping pair, and every defect in words. */
export function meshReport(parts, allowedOverlaps = new Set()) {
  const nodes = parts.map((part) => ({ name: part.name, ...shell(part.tris) }));
  const defects = [];
  for (const node of nodes) {
    if (node.openEdges > 0) defects.push(`${node.name}: open shell, ${node.openEdges} edge(s) not in exactly two triangles`);
    if (node.windingEdges > 0) defects.push(`${node.name}: inconsistent winding, ${node.windingEdges} edge(s)`);
    if (!(node.volume > 0)) defects.push(`${node.name}: signed volume ${node.volume.toExponential(3)} m³, faces not outward`);
    if (!(node.area > 0)) defects.push(`${node.name}: zero area`);
    if (node.shells > 1) defects.push(`${node.name}: ${node.shells} shells, expected one`);
  }
  const boxes = parts.map((part) => box(part.tris));
  const overlaps = [];
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const [a, b] = [boxes[i], boxes[j]];
      if (![0, 1, 2].every((ax) => Math.min(a.max[ax], b.max[ax]) - Math.max(a.min[ax], b.min[ax]) > TOLERANCE)) continue;
      const depth = Math.max(depthInside(parts[i], parts[j]), depthInside(parts[j], parts[i]));
      const crossing = depth <= TOLERANCE && (crosses(parts[i], parts[j]) || crosses(parts[j], parts[i]));
      if (depth <= TOLERANCE && !crossing) continue;
      const pair = [parts[i].name, parts[j].name].sort().join('+');
      const allowed = allowedOverlaps.has(pair);
      const depthMm = crossing ? null : Math.round(depth * 1e4) / 10;
      overlaps.push({ pair, depthMm, crossing, allowed });
      const how = crossing ? 'edges cross faces, depth not measured' : `interpenetrate by ${depthMm} mm`;
      if (!allowed) defects.push(`${pair}: ${how}, not listed in catalog:note`);
    }
  }
  return { nodes, overlaps, defects };
}
