// SPDX-License-Identifier: Apache-2.0
/**
 * A format v2 outline (`{ start, segments, closed: true }`) as plane geometry,
 * for the gates. Points are `[u, v]`; an arc turns counter-clockwise in the
 * mathematical sense (from +u towards +v) when `mathCcw(arc)` says so:
 *
 * - in a revolve, `[u, v]` is the model `[x, y]` seen from +z, so an arc's
 *   `counterClockwise` is the mathematical sense;
 * - in a sweep, `[u, v]` is the plan `[x, z]` seen from above with +z down
 *   the page, so `counterClockwise` (+x towards −z) is the mathematical
 *   clockwise sense.
 *
 * Extremes (`support`) are exact. Areas and centroids are taken from the
 * outline with each arc cut into chords of at most 10°, which is within 0.6 %
 * of the exact area: the gates use them only for the volume ratio.
 */
const TURN = 2 * Math.PI;
const mod = (a) => ((a % TURN) + TURN) % TURN;

/** Edges in order, the closing line included: `{ from, to }`, plus `{ c, r, a0, sweep }` for an arc. */
export function outlineEdges(outline, mathCcw) {
  const edges = [];
  let from = outline.start;
  const push = (to, arc) => {
    if (!arc) edges.push({ from, to });
    else {
      const c = arc.center;
      const r = Math.hypot(from[0] - c[0], from[1] - c[1]);
      const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
      const a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
      const ccw = mathCcw(arc);
      const turn = ccw ? mod(a1 - a0) : mod(a0 - a1);
      const sweep = (turn === 0 ? TURN : turn) * (ccw ? 1 : -1);
      edges.push({ from, to, c, r, a0, sweep });
    }
    from = to;
  };
  for (const segment of outline.segments) push(segment.to, segment.arc);
  if (Math.hypot(from[0] - outline.start[0], from[1] - outline.start[1]) > 1e-12) push(outline.start);
  return edges;
}

const within = (angle, edge) => (edge.sweep > 0 ? mod(angle - edge.a0) : mod(edge.a0 - angle)) <= Math.abs(edge.sweep);

/** The largest g · q over every point q of the outline, exactly. */
export function support(edges, g) {
  let best = -Infinity;
  for (const edge of edges) {
    best = Math.max(best, g[0] * edge.from[0] + g[1] * edge.from[1], g[0] * edge.to[0] + g[1] * edge.to[1]);
    if (edge.c && within(Math.atan2(g[1], g[0]), edge)) {
      best = Math.max(best, g[0] * edge.c[0] + g[1] * edge.c[1] + edge.r * Math.hypot(g[0], g[1]));
    }
  }
  return best;
}

/** The outline as a polygon, each arc cut into chords of at most 10° (4 at least). */
export function outlinePolygon(edges) {
  const points = [];
  for (const edge of edges) {
    points.push(edge.from);
    if (!edge.c) continue;
    const steps = Math.max(4, Math.ceil(Math.abs(edge.sweep) / (Math.PI / 18)));
    for (let k = 1; k < steps; k += 1) {
      const a = edge.a0 + (edge.sweep * k) / steps;
      points.push([edge.c[0] + edge.r * Math.cos(a), edge.c[1] + edge.r * Math.sin(a)]);
    }
  }
  return points;
}

/** Signed area (positive when the polygon turns counter-clockwise) and centroid of a polygon. */
export function areaAndCentroid(points) {
  let twice = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const w = x1 * y2 - x2 * y1;
    twice += w;
    cx += (x1 + x2) * w;
    cy += (y1 + y2) * w;
  }
  const area = twice / 2;
  return { area, centroid: area === 0 ? [0, 0] : [cx / (6 * area), cy / (6 * area)] };
}

// ── Exact plane distances between outlines, for the boolean gates of `op.mjs` ──
// Every edge is a line or a circular arc, so each distance below is exact (to floating point):
// the nearest pair of two edges that do not meet is an end of one, or a point where both
// normals lie on one line, which for a line and an arc is the arc point c ± r·n and for two
// arcs a point on the line through both centres.

const hyp = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** The distance from a point to one edge. */
export function pointEdgeDistance(p, edge) {
  if (!edge.c) {
    const [dx, dy] = [edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]];
    const length2 = dx * dx + dy * dy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - edge.from[0]) * dx + (p[1] - edge.from[1]) * dy) / length2));
    return hyp(p, [edge.from[0] + t * dx, edge.from[1] + t * dy]);
  }
  const d = hyp(p, edge.c);
  if (d < 1e-15) return edge.r;
  if (within(Math.atan2(p[1] - edge.c[1], p[0] - edge.c[0]), edge)) return Math.abs(d - edge.r);
  return Math.min(hyp(p, edge.from), hyp(p, edge.to));
}

/** The points where a line through a and b (as a full line) meets the circle (c, r), with their line parameter t. */
function lineCircle(a, b, c, r) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const [fx, fy] = [a[0] - c[0], a[1] - c[1]];
  const A = dx * dx + dy * dy;
  const B = 2 * (fx * dx + fy * dy);
  const C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (A === 0 || disc < 0) return [];
  const root = Math.sqrt(disc);
  return [(-B - root) / (2 * A), (-B + root) / (2 * A)].map((t) => ({ t, q: [a[0] + t * dx, a[1] + t * dy] }));
}

/** The points where two full circles meet. */
function circleCircle(c1, r1, c2, r2) {
  const d = hyp(c1, c2);
  if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const [ux, uy] = [(c2[0] - c1[0]) / d, (c2[1] - c1[1]) / d];
  const m = [c1[0] + a * ux, c1[1] + a * uy];
  return [[m[0] - h * uy, m[1] + h * ux], [m[0] + h * uy, m[1] - h * ux]];
}

const onArc = (q, edge) => within(Math.atan2(q[1] - edge.c[1], q[0] - edge.c[0]), edge);
const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** True when two edges cross at an inner point of both (a touch at an end is found by the distances). */
function edgesCross(e1, e2) {
  if (!e1.c && !e2.c) {
    return turn(e1.from, e1.to, e2.from) * turn(e1.from, e1.to, e2.to) < 0 && turn(e2.from, e2.to, e1.from) * turn(e2.from, e2.to, e1.to) < 0;
  }
  if (e1.c && !e2.c) return edgesCross(e2, e1);
  if (!e1.c) return lineCircle(e1.from, e1.to, e2.c, e2.r).some(({ t, q }) => t > 0 && t < 1 && onArc(q, e2));
  return circleCircle(e1.c, e1.r, e2.c, e2.r).some((q) => onArc(q, e1) && onArc(q, e2));
}

/** The distance between two edges: 0 when they meet. */
export function edgeDistance(e1, e2) {
  if (edgesCross(e1, e2)) return 0;
  let best = Math.min(
    pointEdgeDistance(e1.from, e2), pointEdgeDistance(e1.to, e2),
    pointEdgeDistance(e2.from, e1), pointEdgeDistance(e2.to, e1),
  );
  const normals = (arc, other) => {
    // Points of `arc` whose normal also stands on `other`.
    let dir;
    if (!other.c) {
      const [dx, dy] = [other.to[0] - other.from[0], other.to[1] - other.from[1]];
      const n = Math.hypot(dx, dy);
      if (n === 0) return;
      dir = [-dy / n, dx / n];
    } else {
      const d = hyp(arc.c, other.c);
      if (d < 1e-12) return; // concentric: an end of one arc is nearest, already counted
      dir = [(other.c[0] - arc.c[0]) / d, (other.c[1] - arc.c[1]) / d];
    }
    for (const s of [1, -1]) {
      const q = [arc.c[0] + s * arc.r * dir[0], arc.c[1] + s * arc.r * dir[1]];
      if (onArc(q, arc)) best = Math.min(best, pointEdgeDistance(q, other));
    }
  };
  if (e1.c) normals(e1, e2);
  if (e2.c) normals(e2, e1);
  return best;
}

/** The least distance between two outlines' edges: 0 when they meet or cross. */
export function outlineDistance(edgesA, edgesB) {
  let best = Infinity;
  for (const a of edgesA) for (const b of edgesB) best = Math.min(best, edgeDistance(a, b));
  return best;
}

/**
 * True when `p` is inside the outline. The arcs are cut into chords whose sagitta is at most
 * 0.0005 m, so the answer is exact for a point more than 0.0005 m from the outline, which the
 * gates check first.
 */
export function insideOutline(p, edges) {
  const points = [];
  for (const edge of edges) {
    points.push(edge.from);
    if (!edge.c) continue;
    const step = edge.r <= 0.0005 ? Math.PI / 2 : 2 * Math.acos(1 - 0.0005 / edge.r);
    const steps = Math.max(4, Math.ceil(Math.abs(edge.sweep) / step));
    for (let k = 1; k < steps; k += 1) {
      const a = edge.a0 + (edge.sweep * k) / steps;
      points.push([edge.c[0] + edge.r * Math.cos(a), edge.c[1] + edge.r * Math.sin(a)]);
    }
  }
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The distance from a point to the full line through a straight edge. */
export function lineDistance(p, edge) {
  const [dx, dy] = [edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]];
  return Math.abs(dx * (p[1] - edge.from[1]) - dy * (p[0] - edge.from[0])) / Math.hypot(dx, dy);
}

/**
 * The outline moved `t` inwards, as a shell's void sees it: each line edge on its line moved
 * `t` along its inward normal, each arc on its circle with the radius less or more `t`.
 * Returns `{ lines, vertices }`: the moved lines (as two-point edges) and the corners where the
 * moved edges meet, each the meeting point of the two moved curves nearest the old corner, or
 * null when two moved curves do not meet.
 */
export function insetOutline(edges, t) {
  const o = Math.sign(areaAndCentroid(outlinePolygon(edges)).area) || 1;
  const moved = edges.map((edge) => {
    if (!edge.c) {
      const [dx, dy] = [edge.to[0] - edge.from[0], edge.to[1] - edge.from[1]];
      const n = Math.hypot(dx, dy);
      const normal = [(-o * dy) / n, (o * dx) / n];
      const shift = (p) => [p[0] + t * normal[0], p[1] + t * normal[1]];
      return { from: shift(edge.from), to: shift(edge.to), normal };
    }
    const centreInside = edge.sweep > 0 === o > 0;
    return { c: edge.c, r: centreInside ? edge.r - t : edge.r + t };
  });
  const vertices = edges.map((edge, i) => {
    const v = edge.from;
    const a = moved[(i + edges.length - 1) % edges.length];
    const b = moved[i];
    let points;
    if (!a.c && !b.c) {
      const cross = a.normal[0] * b.normal[1] - a.normal[1] * b.normal[0];
      if (Math.abs(cross) < 1e-12) return [v[0] + t * b.normal[0], v[1] + t * b.normal[1]];
      // Solve n_a · x = n_a · a.from and n_b · x = n_b · b.from.
      const [ka, kb] = [a.normal[0] * a.from[0] + a.normal[1] * a.from[1], b.normal[0] * b.from[0] + b.normal[1] * b.from[1]];
      points = [[(ka * b.normal[1] - kb * a.normal[1]) / cross, (a.normal[0] * kb - b.normal[0] * ka) / cross]];
    } else if (!a.c || !b.c) {
      const [line, arc] = a.c ? [b, a] : [a, b];
      points = arc.r > 0 ? lineCircle(line.from, line.to, arc.c, arc.r).map(({ q }) => q) : [];
      // A line tangent to the arc: the moved line still touches the moved circle, at the foot from its centre.
      if (points.length === 0 && arc.r > 0 && Math.abs(lineDistance(arc.c, line) - arc.r) < 1e-9) {
        const s = (arc.c[0] - line.from[0]) * line.normal[0] + (arc.c[1] - line.from[1]) * line.normal[1];
        points = [[arc.c[0] - s * line.normal[0], arc.c[1] - s * line.normal[1]]];
      }
    } else if (hyp(a.c, b.c) < 1e-12 && Math.abs(a.r - b.r) < 1e-12) {
      // Two arcs of one circle: the corner moves along the radius.
      points = a.r > 0 ? [[a.c[0] + ((v[0] - a.c[0]) * a.r) / hyp(a.c, v), a.c[1] + ((v[1] - a.c[1]) * a.r) / hyp(a.c, v)]] : [];
    } else {
      points = a.r > 0 && b.r > 0 ? circleCircle(a.c, a.r, b.c, b.r) : [];
      // Two arcs that meet tangentially: their moved circles touch at one point, on the normal.
      if (points.length === 0 && a.r > 0 && b.r > 0) {
        const d = hyp(a.c, b.c);
        const u = [(b.c[0] - a.c[0]) / d, (b.c[1] - a.c[1]) / d];
        points = [1, -1].map((k) => [a.c[0] + k * a.r * u[0], a.c[1] + k * a.r * u[1]]).filter((q) => Math.abs(hyp(q, b.c) - b.r) < 1e-9);
      }
    }
    if (points.length === 0) return null;
    return points.reduce((best, q) => (hyp(q, v) < hyp(best, v) ? q : best));
  });
  // The void's own outline: each moved edge between its two corners, or null when an edge would
  // turn round (a line whose moved length reverses, an arc whose radius goes to 0 or whose turn
  // changes by half a turn or more), where the void is not this simple offset.
  let outline = vertices.every(Boolean) ? [] : null;
  for (let i = 0; outline && i < edges.length; i += 1) {
    const [from, to] = [vertices[i], vertices[(i + 1) % edges.length]];
    const edge = edges[i];
    if (!edge.c) {
      const dot = (to[0] - from[0]) * (edge.to[0] - edge.from[0]) + (to[1] - from[1]) * (edge.to[1] - edge.from[1]);
      outline = dot > 0 ? [...outline, { from, to }] : null;
      continue;
    }
    const { c, r } = moved[i];
    if (!(r > 0)) { outline = null; continue; }
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    const a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
    const ccw = edge.sweep > 0;
    const turnBy = ccw ? mod(a1 - a0) : mod(a0 - a1);
    const sweep = (turnBy === 0 && Math.abs(edge.sweep) > Math.PI ? TURN : turnBy) * (ccw ? 1 : -1);
    outline = Math.abs(Math.abs(sweep) - Math.abs(edge.sweep)) < Math.PI ? [...outline, { from, to, c, r, a0, sweep }] : null;
  }
  return { lines: moved.filter((edge) => !edge.c), vertices, edges: outline };
}

/**
 * The distance from the full line through a straight edge to an arc: 0 when the line meets the
 * arc. The kernel draws an arc in a cap as chords whose end points move with the display
 * deflection, so a line within this distance of any point of the arc may meet a chord point.
 */
export function lineArcDistance(line, arc) {
  const [dx, dy] = [line.to[0] - line.from[0], line.to[1] - line.from[1]];
  const length = Math.hypot(dx, dy);
  const [ux, uy] = [dx / length, dy / length];
  const n = [-uy, ux];
  const s = n[0] * (arc.c[0] - line.from[0]) + n[1] * (arc.c[1] - line.from[1]);
  if (Math.abs(s) <= arc.r) {
    const foot = [arc.c[0] - s * n[0], arc.c[1] - s * n[1]];
    const half = Math.sqrt(arc.r * arc.r - s * s);
    if ([1, -1].some((k) => onArc([foot[0] + k * half * ux, foot[1] + k * half * uy], arc))) return 0;
  }
  let best = Math.min(lineDistance(arc.from, line), lineDistance(arc.to, line));
  for (const k of s === 0 ? [1, -1] : [-Math.sign(s)]) {
    const q = [arc.c[0] + k * arc.r * n[0], arc.c[1] + k * arc.r * n[1]];
    if (onArc(q, arc)) best = Math.min(best, lineDistance(q, line));
  }
  return best;
}
