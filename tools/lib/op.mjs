// SPDX-License-Identifier: Apache-2.0
/**
 * One block, judged: the schema, then everything a JSON Schema cannot say.
 *
 * Floorkit's own parser (`validateOpenElementDefinition`) normalises as much as
 * it validates — unknown keys vanish, a missing size becomes 1 m, an unknown
 * `type` becomes FURNITURE. That is right for an SDK loading whatever it is
 * handed and wrong for a shared catalog, where a silently repaired block is a
 * defect nobody sees until it is on someone's drawing. So the catalog REJECTS
 * anything Floorkit would repair, and `tools/parity.mjs` holds the other half:
 * every block here also passes Floorkit's own parser.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { definitionBox, geometryIssues, revolveAxis, sweepIssue } from './geometry.mjs';
import { parseNote } from './note.mjs';
import { areaAndCentroid, outlineEdges, outlinePolygon, support } from './outline.mjs';
import { ANCHOR_ROLES, KEPT_PORT_IDS, PORTS } from './roles.mjs';

/** The block formats this catalog reads, each with its own schema. */
export const FORMATS = Object.freeze([1, 2]);
const schemaUrl = (format) => new URL(`../../schema/op/v${format}.schema.json`, import.meta.url);

/**
 * A block's format: 2 when its root metadata says `"catalog:format": "2"`,
 * else 1 (the key absent or "1"). Any other value is judged by the format 1
 * schema, which refuses it. The root `version` is 1 in every format.
 */
export const formatOf = (definition) => (definition?.metadata?.['catalog:format'] === '2' ? 2 : 1);

export const LIMITS = Object.freeze({
  /** Bytes per file, as Parti's marketplace profile. */
  maxBytes: 256 * 1024,
  /** profileView + modelView + definitions. */
  maxNodes: 400,
  /**
   * Nodes BUILT, counting a definition once per use. Floorkit rebuilds a
   * referenced subtree every time it is used, so a chain of booleans that each
   * use the previous one twice costs 2^n while validating in linear time.
   */
  maxExpandedNodes: 1_000,
});

const KIND_RESULT = {
  polygon: 'profile2d',
  polyline: 'profile2d',
  arc: 'profile2d',
  offset2d: 'profile2d',
  polyline3d: 'curve3d',
  cuboid: 'solid3d',
  cylinder: 'solid3d',
  sweep: 'solid3d',
  boolean3d: 'solid3d',
  // Format v2.
  sphere: 'solid3d',
  cone: 'solid3d',
  torus: 'solid3d',
  revolve: 'solid3d',
  shell: 'solid3d',
};

const compiled = new Map();
/** The compiled schema of one format (1 by default). */
export function opSchemaValidator(format = 1) {
  if (!compiled.has(format)) {
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    compiled.set(format, ajv.compile(JSON.parse(readFileSync(schemaUrl(format), 'utf8'))));
  }
  return compiled.get(format);
}

/** Keys sorted at every depth, no whitespace — the same canonical form Parti hashes. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('canonical JSON cannot encode a non-finite number');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item ?? null)).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

export const sha256Hex = (input) => createHash('sha256').update(input).digest('hex');

/** The one byte form a block file may have: 2-space JSON, LF, one final newline. */
export const formatBlock = (definition) => `${JSON.stringify(definition, null, 2)}\n`;

const pointer = (path) => (path.length === 0 ? '/' : `/${path.join('/')}`);

/** Every value with its path, depth-first. Iterative, so hostile nesting cannot overflow the stack. */
function* walk(root) {
  const stack = [[root, []]];
  while (stack.length > 0) {
    const [value, path] = stack.pop();
    yield [value, path];
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) stack.push([value[index], [...path, index]]);
    } else if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value);
      for (let index = keys.length - 1; index >= 0; index -= 1) stack.push([value[keys[index]], [...path, keys[index]]]);
    }
  }
}

function schemaIssues(definition) {
  const validate = opSchemaValidator(formatOf(definition));
  if (validate(definition)) return [];
  // An if/then pair reports the leaf error AND a "must match then schema"
  // wrapper; the wrapper says nothing the leaf does not.
  return validate.errors
    .filter((error) => error.keyword !== 'if')
    .map((error) => {
      const extra =
        error.keyword === 'additionalProperties'
          ? ` "${error.params.additionalProperty}"`
          : error.keyword === 'enum'
            ? ` (${error.params.allowedValues.join(', ')})`
            : error.keyword === 'const'
              ? ` (${JSON.stringify(error.params.allowedValue)})`
              : '';
      return { path: error.instancePath || '/', message: `${error.message}${extra}` };
    });
}

function refsOf(node) {
  if (node.kind === 'sweep' && node.pathRef !== undefined) {
    return [
      ['pathRef', node.pathRef, 'curve3d'],
      ['profileRef', node.profileRef, 'curve3d'],
    ];
  }
  if (node.kind === 'offset2d') return [['sourceRef', node.sourceRef, 'profile2d']];
  if (node.kind === 'shell') return [['sourceRef', node.sourceRef, 'solid3d']];
  if (node.kind === 'boolean3d') {
    return [
      ['baseRef', node.baseRef, 'solid3d'],
      ...node.operandRefs.map((ref, index) => [`operandRefs/${index}`, ref, 'solid3d']),
    ];
  }
  return [];
}

/** Plane polygons: the shoelace area and a test for two edges that properly cross. */
const area2 = (points) => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
};
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const properlyCross = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
const selfIntersects = (points) => {
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (properlyCross(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
};

function semanticIssues(definition) {
  const issues = [];
  const add = (path, message) => issues.push({ path: pointer(path), message });
  const definitions = definition.definitions ?? {};
  const has = (ref) => Object.hasOwn(definitions, ref);
  const settled = new Map();

  // ── references: every ref names a definition of the right KIND, no loops ──
  const resolve = (ref, path, stack) => {
    if (!has(ref)) {
      add(path, `references unknown definition "${ref}"`);
      return null;
    }
    if (stack.includes(ref)) {
      add(path, `cyclic definition: ${[...stack, ref].join(' → ')}`);
      return null;
    }
    if (settled.has(ref)) return settled.get(ref);
    const node = definitions[ref];
    for (const [field, child, want] of refsOf(node)) {
      expect(child, want, ['definitions', ref, ...field.split('/')], [...stack, ref]);
    }
    if (node.kind === 'offset2d' && has(node.sourceRef)) {
      const source = definitions[node.sourceRef];
      const sourceKind = source.kind === 'offset2d' ? source.output : source.kind;
      if (sourceKind !== 'polyline') {
        add(['definitions', ref, 'sourceRef'], 'an offset2d source must be a polyline');
      }
    }
    if (node.kind === 'boolean3d') {
      for (const [field, child] of refsOf(node)) {
        if (has(child) && definitions[child].kind === 'sweep') {
          add(['definitions', ref, ...field.split('/')], `"${child}" is a sweep; Floorkit can only cut cuboids, cylinders and other booleans`);
        }
      }
    }
    const result = KIND_RESULT[node.kind];
    settled.set(ref, result);
    return result;
  };
  function expect(ref, want, path, stack) {
    const got = resolve(ref, path, stack);
    if (got !== null && got !== want) add(path, `"${ref}" is ${got}, expected ${want}`);
  }

  for (const [key, node] of Object.entries(definitions)) {
    if (node.id !== undefined && node.id !== key) {
      add(['definitions', key, 'id'], `a definition's id must equal its key ("${key}")`);
    }
  }
  definition.profileView.elements.forEach((element, index) => {
    if (element.ref !== undefined) expect(element.ref, 'profile2d', ['profileView', 'elements', index, 'ref'], []);
  });
  definition.modelView.elements.forEach((element, index) => {
    const at = ['modelView', 'elements', index];
    if (element.ref !== undefined) expect(element.ref, 'solid3d', [...at, 'ref'], []);
    else for (const [field, child, want] of refsOf(element)) expect(child, want, [...at, field], []);
  });
  // Resolve every definition, so an unused one still has its own refs checked.
  for (const key of Object.keys(definitions)) resolve(key, ['definitions', key], []);
  // Reachability, from the views alone.
  const used = new Set();
  const visit = (ref) => {
    if (!has(ref) || used.has(ref)) return;
    used.add(ref);
    for (const [, child] of refsOf(definitions[ref])) visit(child);
  };
  for (const element of [...definition.profileView.elements, ...definition.modelView.elements]) {
    if (element.ref !== undefined) visit(element.ref);
    else for (const [, child] of refsOf(element)) visit(child);
  }
  for (const key of Object.keys(definitions)) {
    if (!used.has(key)) add(['definitions', key], 'is never used by profileView or modelView');
  }

  // ── geometry the kernel cannot build ──
  const distinct = (points) => new Set(points.map((point) => point.join(','))).size;
  const checkGeometry = (node, path) => {
    if (node.kind === 'polygon') {
      if (Math.abs(area2(node.vertices)) < 1e-9) add([...path, 'vertices'], 'encloses no area');
      else if (selfIntersects(node.vertices)) add([...path, 'vertices'], 'crosses itself');
    }
    if ((node.kind === 'polyline' || node.kind === 'polyline3d') && distinct(node.points) < 2) {
      add([...path, 'points'], 'needs at least two distinct points');
    }
    if (node.kind === 'sweep' && node.path) {
      if (distinct(node.path) < 2) add([...path, 'path'], 'needs at least two distinct points');
      if (Array.isArray(node.profile) && distinct(node.profile) < 3) add([...path, 'profile'], 'needs at least three distinct points');
    }
  };
  definition.profileView.elements.forEach((element, index) => checkGeometry(element, ['profileView', 'elements', index]));
  definition.modelView.elements.forEach((element, index) => checkGeometry(element, ['modelView', 'elements', index]));
  for (const [key, node] of Object.entries(definitions)) checkGeometry(node, ['definitions', key]);

  // ── uniqueness ──
  for (const view of ['profileView', 'modelView']) {
    const seen = new Map();
    definition[view].elements.forEach((element, index) => {
      if (element.id === undefined) return;
      if (seen.has(element.id)) {
        add([view, 'elements', index, 'id'], `duplicates the id "${element.id}" of ${view}/elements/${seen.get(element.id)}`);
      } else seen.set(element.id, index);
    });
  }
  const portIds = new Set();
  (definition.ports ?? []).forEach((port, index) => {
    if (portIds.has(port.id)) add(['ports', index, 'id'], `duplicates port id "${port.id}"`);
    portIds.add(port.id);
  });

  // ── metadata that names something else in the file ──
  const metadata = definition.metadata;
  const nodeIds = new Set(Object.keys(definitions));
  for (const element of [...definition.profileView.elements, ...definition.modelView.elements]) {
    if (element.id !== undefined) nodeIds.add(element.id);
    if (element.ref !== undefined) nodeIds.add(element.ref);
  }
  for (const key of Object.keys(metadata)) {
    if (key.startsWith('mat:') && !nodeIds.has(key.slice(4))) {
      add(['metadata', key], `names node "${key.slice(4)}", which this block does not have`);
    }
  }
  if (metadata.ifcClass !== undefined && metadata.ifcClass !== metadata['ifc:class']) {
    add(['metadata', 'ifcClass'], `must equal ifc:class ("${metadata['ifc:class']}")`);
  }
  if (metadata['catalog:tags'] !== undefined) {
    const tags = metadata['catalog:tags'].split(', ');
    if (new Set(tags).size !== tags.length) add(['metadata', 'catalog:tags'], 'repeats a tag');
  }

  // ── limits ──
  const nodes =
    definition.profileView.elements.length + definition.modelView.elements.length + Object.keys(definitions).length;
  if (nodes > LIMITS.maxNodes) add([], `has ${nodes} nodes; the limit is ${LIMITS.maxNodes}`);
  const cap = LIMITS.maxExpandedNodes + 1;
  const memo = new Map();
  // No depth cut-off: an undercounted deep chain is exactly how a 2^n block
  // would slip through. Cycles are excluded before this runs, the memo keeps
  // it linear, and a chain is at most maxNodes long.
  const expanded = (ref) => {
    if (!has(ref)) return 1;
    if (memo.has(ref)) return memo.get(ref);
    let total = 1;
    for (const [, child] of refsOf(definitions[ref])) total = Math.min(cap, total + expanded(child));
    memo.set(ref, total);
    return total;
  };
  if (issues.every((issue) => !issue.message.startsWith('cyclic'))) {
    let built = 0;
    for (const element of [...definition.profileView.elements, ...definition.modelView.elements]) {
      if (element.ref !== undefined) built += expanded(element.ref);
      else {
        built += 1;
        for (const [, child] of refsOf(element)) built += expanded(child);
      }
      built = Math.min(cap, built);
    }
    if (built > LIMITS.maxExpandedNodes) {
      add([], `builds more than ${LIMITS.maxExpandedNodes} nodes once references are expanded`);
    }
  }
  return issues;
}

/** Four times OpenGeometry's tolerance: Floorkit 3.0 refuses a size at or below it (`KERNEL_MIN_SIZE`). */
const KERNEL_MIN_SIZE = 4e-8;
/**
 * The shortest outline segment, the closing line included, in metres: the catalog's contact
 * tolerance. Kernel 3.0 refuses a segment of 1e-10 m ("profile has a zero-length segment",
 * measured); 1 mm is far above its 1e-9 tolerance, and a detail smaller than that is not drawn.
 */
const MIN_SEGMENT = 0.001;
/** The lowest outline sweep, in metres: the catalog's floor for every size (Floorkit refuses <= 1e-9). */
const MIN_EXTRUSION = 0.01;
/** How far a revolve's outline must stay from its axis, in metres: the catalog's contact tolerance. */
const AXIS_CLEARANCE = 0.001;

/**
 * Why a revolve's outline is wrong against its axis, or null. Measured on kernel 3.0.0
 * (FLO-279): it refuses an outline that crosses the axis or touches it at a point, and builds
 * one with an edge lying on the axis (a solid revolve). So an outline stays on one side; a line
 * edge whose two ends are on the axis may lie on it; every other vertex stays more than
 * AXIS_CLEARANCE from it, and so does every edge that does not end on the axis.
 */
function revolveAxisIssue(node) {
  const ON = 1e-9;
  const { point: p, g, edges, nearest, farthest } = revolveAxis(node);
  if (nearest < -ON && farthest > ON) return 'crosses its axis';
  const s = farthest > ON ? 1 : -1;
  const distance = (q) => s * (g[0] * (q[0] - p[0]) + g[1] * (q[1] - p[1]));
  const on = (q) => Math.abs(distance(q)) <= ON;
  const onAxis = edges.filter((edge) => !edge.c && on(edge.from) && on(edge.to));
  const ends = new Set(onAxis.flatMap((edge) => [edge.from.join(','), edge.to.join(',')]));
  // One connected run of edges on the axis at most: two runs enclose a void at the axis, which the
  // kernel refuses ("meets the revolve axis along more than one segment", measured).
  const runs = edges.filter((edge, i) => onAxis.includes(edge) && !onAxis.includes(edges[(i + edges.length - 1) % edges.length])).length;
  if (runs > 1) return `lies on its axis along ${runs} separate runs of edges; at most one run of edges may lie on the axis`;
  for (const edge of edges) {
    if (onAxis.includes(edge)) continue;
    const touching = [edge.from, edge.to].filter(on);
    const lone = touching.find((q) => !ends.has(q.join(',')));
    if (lone) return `touches its axis at a point, [${lone.join(', ')}]`;
    if (!on(edge.from) && distance(edge.from) <= AXIS_CLEARANCE) return `comes within ${distance(edge.from).toFixed(4)} m of its axis at [${edge.from.join(', ')}]`;
    if (touching.length === 0) {
      const low = -support([edge], [-s * g[0], -s * g[1]]) - s * (g[0] * p[0] + g[1] * p[1]);
      if (low <= AXIS_CLEARANCE) return low <= ON ? 'touches its axis at a point' : `comes within ${low.toFixed(4)} m of its axis`;
    }
  }
  return null;
}

/**
 * Every format: Floorkit 3.0 places each built body by a turn, a move and one
 * scale factor (`transformBody`), and refuses any other node placement as
 * `bad-scale`, whatever the kind.
 */
function bodyScaleIssues(definition) {
  const issues = [];
  const nodes = [
    ...definition.modelView.elements.map((node, index) => [node, ['modelView', 'elements', index]]),
    ...Object.entries(definition.definitions ?? {}).map(([key, node]) => [node, ['definitions', key]]),
  ];
  for (const [node, path] of nodes) {
    const solid = node.ref !== undefined || KIND_RESULT[node.kind] === 'solid3d';
    const scale = node.placement?.scale;
    if (solid && scale && !(scale[0] === scale[1] && scale[1] === scale[2])) {
      issues.push({ path: pointer([...path, 'placement', 'scale']), message: `is ${JSON.stringify(scale)}; a body's placement must be a turn, a move and one scale factor, else Floorkit 3.0 refuses it as bad-scale` });
    }
  }
  return issues;
}

/**
 * Format v2: what the schema cannot say about the new kinds, and what the
 * kernel cannot build although Floorkit 3.0 parses it. Runs once the schema
 * and the references pass.
 */
function formatTwoIssues(definition) {
  const issues = [];
  const add = (path, message) => issues.push({ path: pointer(path), message });
  const definitions = definition.definitions ?? {};
  const nodes = [
    ...definition.modelView.elements.map((node, index) => [node, ['modelView', 'elements', index]]),
    ...Object.entries(definitions).map(([key, node]) => [node, ['definitions', key]]),
  ];

  // A closed outline: no repeated point, arcs whose centre is as far from both ends, an area, no crossing.
  const outlineIssues = (outline, path, mathCcw) => {
    const before = issues.length;
    let from = outline.start;
    outline.segments.forEach((segment, index) => {
      const at = [...path, 'segments', index];
      const length = Math.hypot(segment.to[0] - from[0], segment.to[1] - from[1]);
      if (length <= 1e-9) add([...at, 'to'], 'repeats the point before it');
      else if (length < MIN_SEGMENT) add([...at, 'to'], `is ${length} m from the point before it; a segment is at least ${MIN_SEGMENT} m long (an arc, end to end)`);
      else if (segment.arc) {
        const [cx, cy] = segment.arc.center;
        const near = Math.hypot(from[0] - cx, from[1] - cy);
        const far = Math.hypot(segment.to[0] - cx, segment.to[1] - cy);
        if (near <= KERNEL_MIN_SIZE || Math.abs(near - far) > 1e-9 * Math.max(near, far)) {
          add([...at, 'arc', 'center'], `is ${near} m from the segment's start and ${far} m from its end; an arc's centre must be as far from both (within 1e-9 of the radius), else Floorkit refuses it as bad-profile`);
        }
      }
      from = segment.to;
    });
    // The closing line Floorkit adds when the last point is not the start (more than 1e-12 away) is a segment too.
    const gap = Math.hypot(outline.start[0] - from[0], outline.start[1] - from[1]);
    if (gap > 0 && gap < MIN_SEGMENT) {
      add([...path, 'segments', outline.segments.length - 1, 'to'], `is ${gap} m from start, so the closing line would be that short; end exactly at start, or leave a closing line of at least ${MIN_SEGMENT} m`);
    }
    if (issues.length > before) return false;
    const polygon = outlinePolygon(outlineEdges(outline, mathCcw));
    if (Math.abs(areaAndCentroid(polygon).area) < 1e-6) add(path, 'encloses no area (less than 1e-6 m²)');
    else if (selfIntersects(polygon)) add(path, 'crosses itself');
    return issues.length === before;
  };

  for (const [node, path] of nodes) {
    if (node.kind === 'sweep' && node.profile && !Array.isArray(node.profile)) {
      const [a, b] = node.path;
      if (!(a[0] === b[0] && a[2] === b[2] && b[1] > a[1])) {
        add([...path, 'path'], 'must be one segment straight up, from the lower end of the extrusion to its upper end: an outline sweeps only as an extrusion (Floorkit bad-sweep for any bent path)');
      } else if (b[1] - a[1] < MIN_EXTRUSION) {
        add([...path, 'path'], `rises ${b[1] - a[1]} m; an outline sweep is at least ${MIN_EXTRUSION} m high`);
      }
      outlineIssues(node.profile, [...path, 'profile'], (arc) => !arc.counterClockwise);
    }
    if (node.kind === 'torus' && !(node.minorRadius < node.majorRadius - 0.001)) {
      add([...path, 'minorRadius'], `is ${node.minorRadius}; it must be below majorRadius - 0.001 (${node.majorRadius - 0.001}), else Floorkit refuses it as bad-torus`);
    }
    if (node.kind === 'revolve') {
      if (node.axis && Math.hypot(...node.axis.direction) <= KERNEL_MIN_SIZE) {
        add([...path, 'axis', 'direction'], 'must not be zero (Floorkit bad-revolve)');
      } else if (outlineIssues(node.profile, [...path, 'profile'], (arc) => arc.counterClockwise)) {
        const why = revolveAxisIssue(node);
        if (why) {
          add([...path, 'profile'], `${why}; a revolve's outline stays more than ${AXIS_CLEARANCE} m to one side of its axis, except along one run of line edges that lies on the axis (a solid revolve), since the kernel refuses an outline that crosses the axis, touches it at a point or meets it along more than one run`);
        }
      }
    }
  }

  // A shell: OpenGeometry 3.0.0 cannot hollow a revolve, a cylinder sector or a shell (CoverageGap,
  // measured), also when one is an operand of a boolean the shell hollows.
  for (const [key, node] of Object.entries(definitions)) {
    if (node.kind !== 'shell') continue;
    const found = [];
    const seen = new Set();
    const reach = (ref) => {
      if (seen.has(ref) || !Object.hasOwn(definitions, ref)) return;
      seen.add(ref);
      const source = definitions[ref];
      if (source.kind === 'shell') found.push(`the shell "${ref}"`);
      if (source.kind === 'revolve') found.push(`the revolve "${ref}"`);
      if (source.kind === 'cylinder' && source.angle !== undefined) found.push(`the cylinder sector "${ref}"`);
      for (const [, child] of refsOf(source)) reach(child);
    };
    reach(node.sourceRef);
    if (found.length > 0) {
      add(['definitions', key, 'sourceRef'], `hollows ${found.join(' and ')}; OpenGeometry 3.0.0 cannot shell a revolve, a cylinder sector or another shell (CoverageGap, measured), also behind a boolean`);
      continue;
    }
    const box = definitionBox(definitions[node.sourceRef], definitions);
    const smallest = box && Math.min(...[0, 1, 2].map((i) => box.max[i] - box.min[i]));
    if (box && 2 * node.thickness >= smallest) {
      add(['definitions', key, 'thickness'], `is ${node.thickness}; it must be under half the smallest extent of its source's box (${smallest.toFixed(3)} m), or the void has no room`);
    }
  }
  return issues;
}

/**
 * The checks a block drawn to `docs/drafting-standard.md` must pass. The schema
 * already requires `catalog:lod`; a `floorkit` block must be drawn to LOD 300.
 */
function standardIssues(definition) {
  const publisher = definition.id.split('.')[0];
  const issues = [];
  const lod = definition.metadata['catalog:lod'];
  if (publisher === 'floorkit' && lod !== '300') issues.push({ path: '/metadata/catalog:lod', message: `is "${lod}"; a floorkit block is drawn to LOD 300` });
  const nodes = [
    ...definition.modelView.elements.map((node, index) => [node, `/modelView/elements/${index}`]),
    ...Object.entries(definition.definitions ?? {}).map(([key, node]) => [node, `/definitions/${key}`]),
  ];
  for (const [node, path] of nodes) {
    // An outline sweep (format v2) is bounded exactly; a point-list sweep only in sweep.rs's case.
    const sweep = node.kind === 'sweep' && (Array.isArray(node.profile) || node.profileRef !== undefined) && sweepIssue(node, definition.definitions ?? {});
    if (sweep) issues.push({ path, message: sweep });
    // Format 1: Floorkit 2.0 mirrors only the centre of a partial cylinder (drafting standard §3).
    // Format v2 draws a sector on purpose: Floorkit 3.0 reflects its arc when it mirrors it.
    if (formatOf(definition) === 1 && node.kind === 'cylinder' && node.angle !== undefined && node.angle < 2 * Math.PI - 1e-4) {
      issues.push({ path: `${path}/angle`, message: `is ${node.angle}; a cylinder must be a full turn (${(2 * Math.PI).toFixed(4)}), since a mirrored partial cylinder does not match its plan` });
    }
  }
  // Anchors and ports from the standard's closed tables (§7, §8).
  for (const [name, anchor] of Object.entries(definition.anchors ?? {})) {
    const roles = ANCHOR_ROLES[name];
    const role = anchor.metadata?.role;
    if (!roles) issues.push({ path: `/anchors/${name}`, message: `is not an anchor name of the drafting standard (§7)` });
    else if (!roles.includes(role)) issues.push({ path: `/anchors/${name}/metadata/role`, message: `is ${role === undefined ? 'missing' : `"${role}"`}; "${name}" takes ${roles.map((r) => `"${r}"`).join(' or ')}` });
  }
  if (!KEPT_PORT_IDS.includes(definition.id)) {
    (definition.ports ?? []).forEach((port, index) => {
      const want = PORTS[port.id];
      const size = port.profile.diameter;
      const wrong = !want ? 'is not a port id of the drafting standard (§8)'
        : port.domain !== want.domain || port.systemType !== want.systemType ? `must be ${want.domain} / ${want.systemType}`
        : !want.directions.includes(port.flowDirection) ? `must flow ${want.directions.join(' or ')}`
        : port.profile.shape !== want.shape ? `must have a ${want.shape} profile`
        : want.sizes && !want.sizes.includes(size) ? `has diameter ${size}; "${port.id}" takes ${want.sizes.join(' or ')}`
        : want.poles && (port.profile.poles !== want.poles || port.profile.voltage !== want.voltage) ? `must be ${want.poles} pole at ${want.voltage} V`
        : null;
      if (wrong) issues.push({ path: `/ports/${index}`, message: `port "${port.id}" ${wrong}` });
    });
  }
  // IFC (§9): Floorkit's distribution path reads only the legacy ifcClass.
  const metadata = definition.metadata;
  const distribution = ((definition.ports ?? []).length > 0 || definition.type === 'MEP_EQUIPMENT') && !['DOOR', 'WINDOW'].includes(definition.type);
  if (metadata['ifc:class'] === undefined) issues.push({ path: '/metadata', message: 'needs "ifc:class"' });
  else if (distribution && metadata.ifcClass === undefined) issues.push({ path: '/metadata', message: `needs "ifcClass": "${metadata['ifc:class']}", since a ported or MEP_EQUIPMENT block exports through Floorkit's distribution path` });
  else if (!distribution && metadata.ifcClass !== undefined) issues.push({ path: '/metadata/ifcClass', message: 'is only for a ported or MEP_EQUIPMENT block; set ifc:class alone' });
  const note = parseNote(metadata['catalog:note']);
  issues.push(...note.problems.map((message) => ({ path: '/metadata/catalog:note', message })));
  issues.push(...geometryIssues(definition, note));
  return issues;
}

/**
 * Judge one block file's TEXT. Returns `{ ok, issues, definition? }`; an issue
 * is `{ path, message }` with `path` a JSON pointer into the definition.
 */
export function checkBlockText(text) {
  const issues = [];
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > LIMITS.maxBytes) {
    return { ok: false, issues: [{ path: '/', message: `is ${bytes} bytes; the limit is ${LIMITS.maxBytes}` }] };
  }
  if (text.charCodeAt(0) === 0xfeff) issues.push({ path: '/', message: 'starts with a byte-order mark' });
  let definition;
  try {
    definition = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error) {
    return { ok: false, issues: [...issues, { path: '/', message: `is not JSON: ${error.message}` }] };
  }
  for (const [value, path] of walk(definition)) {
    if (path.length > 0 && typeof path.at(-1) === 'string' && path.at(-1) in Object.prototype) {
      issues.push({ path: pointer(path), message: `uses the reserved key "${path.at(-1)}"` });
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      issues.push({ path: pointer(path), message: 'is not a finite number' });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  if (text !== formatBlock(definition)) {
    issues.push({
      path: '/',
      message: 'is not in canonical form (2-space JSON, LF, one final newline, no duplicate keys); run `node tools/format.mjs <file>`',
    });
  }
  const structural = schemaIssues(definition);
  issues.push(...structural);
  if (structural.length === 0) issues.push(...semanticIssues(definition));
  if (structural.length === 0 && issues.length === 0) issues.push(...bodyScaleIssues(definition));
  if (structural.length === 0 && issues.length === 0 && formatOf(definition) === 2) issues.push(...formatTwoIssues(definition));
  if (structural.length === 0 && issues.length === 0) issues.push(...standardIssues(definition));
  return issues.length === 0 ? { ok: true, issues, definition } : { ok: false, issues, definition };
}
