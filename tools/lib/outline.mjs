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
