# The `.op` format v2

Format v2 is [format 1](format-v1.md) plus the node kinds that Floorkit 3.0 reads: `sphere`, `cone`, `torus`, `revolve`, `shell`, the cylinder sector and the outline sweep. Everything that this page does not change is as format 1 says: units, placements, anchors, ports, root metadata, canonical bytes, limits and the drafting standard. [RFC 0004](rfcs/0004-format-v2.md) records why the format is shaped this way.

The rules are enforced in the same two places:

- [`schema/op/v2.schema.json`](../schema/op/v2.schema.json) is a strict JSON Schema (draft 2020-12), next to `v1.schema.json`. It covers the structure.
- [`tools/lib/op.mjs`](../tools/lib/op.mjs) checks what a schema cannot express. Its format v2 gates are in `formatTwoIssues`, and the boxes of the new kinds are in [`tools/lib/geometry.mjs`](../tools/lib/geometry.mjs) and [`tools/lib/outline.mjs`](../tools/lib/outline.mjs).

`node tools/validate.mjs` picks the schema from the block's own marker and runs both. If this page and the code disagree, the code is what runs; please report the difference.

## Where the Floorkit facts come from

- **Read.** Floorkit 3.0's parser is `src/packages/openplans-core/src/elements/generic-element.ts` (here "GE") at OpenPlans-3.0 commit `7bc2d595`, kernel `opengeometry` 3.0.0. The node placement rule is `src/packages/openplans-core/src/shapes/base-type.ts` (`transformBody`, `:51-63`); the mirror is `open-element-mirror.ts`. Floorkit's own page for the kinds is `docs/snippets/api/open-element.mdx`, sections "Model node kinds" and "For the catalog format v2". Where that page and the code disagree, this page follows the code; the list is in [§8](#8-where-floorkits-page-and-its-code-disagree).
- **Measured on 2026-10-31** against a build of OpenPlans-3.0 `7bc2d595` (package 1.2.0, kernel 3.0.0), with `tools/parity.mjs --build --mesh` and `tools/render.mjs`:
  - the 80 format 1 blocks: accepted, unrepaired, built, mirrored and mesh clean, 80/80 each; kernel-reject fixtures refused 27/27, each of the 12 format v2 ones with the code this page names;
  - [`v2-sampler.op`](../test/fixtures/valid/v2-sampler.op), [`v2-sweep-arc-profile.op`](../test/fixtures/valid/v2-sweep-arc-profile.op), [`v2-pedestal.op`](../test/fixtures/valid/v2-pedestal.op) and [`v2-revolve-collinear.op`](../test/fixtures/valid/v2-revolve-collinear.op): accepted, unrepaired, built, mirrored and mesh clean, 4/4 each; with [`v2-sweep-through-cut.op`](../test/fixtures/valid/v2-sweep-through-cut.op) added, 5/5 each on Floorkit `68604c67` (FLO-330 part A);
  - the statements below marked *measured*.
  Anything else about building is read from the code, not measured.
- **Measured on 2026-10-31 for booleans and revolve arcs** (the [amendment to RFC 0004](rfcs/0004-format-v2.md#amendment-2026-10-31-an-outline-sweep-as-a-through-cut)), against Floorkit `68604c67` and kernel 3.0.0 at `053b471`: the FLO-330 scratch blocks with `tools/parity.mjs --build --mesh` and a raw-kernel script, `rim-booleans.mjs`; and BIM review 070's probes. The kernel issues OPE-107, OPE-108 and OPE-109 come from FLO-330.

## Contents

1. [The marker](#1-the-marker)
2. [Node kinds](#2-node-kinds)
3. [Outlines](#3-outlines)
4. [Shells](#4-shells)
5. [Placements](#5-placements)
6. [What the catalog refuses that Floorkit 3.0 accepts](#6-what-the-catalog-refuses-that-floorkit-30-accepts)
7. [The geometry gates on the new kinds](#7-the-geometry-gates-on-the-new-kinds)
8. [Where Floorkit's page and its code disagree](#8-where-floorkits-page-and-its-code-disagree)
9. [The index and the loader](#9-the-index-and-the-loader)

## 1. The marker

- **A format v2 block says `"catalog:format": "2"`** in its root `metadata`. The key is required in format v2 and is a string, as every root metadata value is.
- **Without the key, a block is format 1.** A format 1 block may also say `"catalog:format": "1"`. Any other value is refused by the format 1 schema.
- **The root `version` stays `1`.** Floorkit never reads `version` and always writes `1` (GE `:1125-1126`), so any other value would be a repair.
- **A move to format v2 is a MAJOR block version** on its own ([drafting standard §14](drafting-standard.md#14-labels-attribution-and-versions)): a reader of format 1 cannot load the new file.

## 2. Node kinds

Every format 1 kind keeps its format 1 rules, with the changes below. The "Floorkit code" column is the `code` of Floorkit 3.0's refusal (`modelError`, GE `:2092-2094`), where there is one.

| Kind | May appear in | Fields (**required**) | Type and catalog limits | Floorkit 3.0 | Floorkit code |
| --- | --- | --- | --- | --- | --- |
| `cylinder` | `modelView`, `definitions` | **`center`**, **`radius`**, **`height`**, `angle`, `startAngle` | `radius`, `height` 0.01–100 m. `angle` is present only for a sector: a number in (0, 6.2831] rad, less than a full turn. `startAngle` radians within ±6.2832, and only with `angle`. | `angle` defaults to 2π, `startAngle` to 0; neither is clamped (GE `:816-826`). An `angle` within 64·ε of 2π builds a full cylinder (GE `:2246-2263`). | none: sizes take defaults |
| `sweep` | `modelView`, `definitions` | as format 1, and **`capStart`**, **`capEnd`** | `capStart` and `capEnd` are both `true`. `profile` is a list of 3–1024 model points, or an outline ([§3](#3-outlines)). With an outline, `path` is 2 points: the same x and z, the second at least 0.01 m higher. | Caps default to `false` (GE `:911-912`, `:937-938`). An outline sweep needs a vertical 2-point path and both caps `true` (GE `:720-735`, `:916-930`). An open point-list sweep with unequal caps is refused when built (GE `:2154-2156`). | `bad-sweep`, `bad-profile` |
| `sphere` | `modelView`, `definitions` | **`center`** `[x, y, z]`, **`radius`** | `radius` 0.01–100 m. | `radius` above 4e-8 (GE `:833-840`). | `bad-sphere` |
| `cone` | `modelView`, `definitions` | **`center`**, **`radiusBottom`**, **`radiusTop`**, **`height`** | Each radius is `0` or 0.01–100 m, and not both `0`. `height` 0.01–100 m. Upright; `center` is mid-height. | Each radius above 4e-8 or exactly 0, one of them 0.01 or more; `height` above 4e-8 (GE `:842-855`). | `bad-cone` |
| `torus` | `modelView`, `definitions` | **`center`**, **`majorRadius`**, **`minorRadius`** | Both 0.01–100 m, and `minorRadius < majorRadius − 0.001` (`op.mjs`). Lying flat, axis upright; `center` is the middle of its box. | Both above 4e-8 and the same inequality (GE `:857-869`). | `bad-torus` |
| `revolve` | `modelView`, `definitions` | **`profile`** (an outline), `axis` | `axis` is `{ point: [x, y], direction: [x, y] }`, direction not zero. The outline stays on one side of the axis: one run of line edges may lie on the axis (a solid revolve), and every other vertex and edge stays more than 0.001 m from it (`op.mjs`). An arc is centred on the axis (within 1e-8 m), or its whole circle clears the axis by more than 1e-8 m (`op.mjs`, from the kernel). No `angle`: always a full turn. Never in a `boolean3d` ([§6](#6-what-the-catalog-refuses-that-floorkit-30-accepts)). | Outline as [§3](#3-outlines); `axis.direction` longer than 4e-8 (GE `:871-895`). The outline is not checked against the axis. | `bad-revolve`, `bad-profile` |
| `shell` | `definitions` only | **`sourceRef`**, **`thickness`** | `sourceRef` names a solid; `thickness` 0.01–100 m and under half the smallest extent of the source's box (`op.mjs`). See [§4](#4-shells). | `thickness` above 4e-8 (GE `:1022-1028`); a source that is not a solid is refused when built (GE `:2542-2560`). | `bad-shell` |

A `modelView` element of any other kind, `shell` included, is refused by Floorkit with a plain error, `… has unsupported kind …` (GE `:942-944`), which has no code. The catalog refuses it in the schema.

**Where each kind sits.**

- `center` is the middle of the body's box for a cuboid, a cylinder, a sphere, a cone and a torus. A cylinder or a cone stands half its height below `center`; a torus lies one `minorRadius` below it (GE `:2246-2290`).
- A cylinder sector turns from `startAngle` by `angle`, from +x towards −z, as every `.op` angle does ([format 1 §1](format-v1.md#1-units-and-coordinates)): the point at angle `a` is `(cx + r·cos a, cz − r·sin a)`. The sector includes its centre line.
- A revolve's outline is upright: the outline point `[x, y]` is the model point `(x, y, 0)`. Without `axis`, the axis is the model y axis, so the solid stands upright about the origin; move it with its `placement` (GE `:2213-2231`).

## 3. Outlines

An outline is the kernel's `Profile` shape: `{ start, segments, closed: true }`.

| Field | Type and catalog limits | Floorkit 3.0 (GE `:768-795`), refused as `bad-profile` |
| --- | --- | --- |
| `start` | a point `[u, v]`, each within ±1000 | 2 finite numbers |
| `segments` | 1–256 segments. A segment is `{ to }` for a line or `{ to, arc: { center, counterClockwise } }` for an arc; no other key | at least one; each an object |
| `segments[i].to` | a point at least 0.001 m from the point before it, end to end for an arc (`op.mjs`) | 2 finite numbers |
| `segments[i].arc.center` | a point as far from the segment's start as from its end, within 1e-9 of the radius, and more than 4e-8 from the start (`op.mjs`) | the same rule |
| `segments[i].arc.counterClockwise` | `true` or `false` | a boolean |
| `closed` | `true` | `true` |

- **The outline closes with a line** when its last segment does not end at `start` (GE `:2199-2211`, more than 1e-12 away). That closing line is a segment too: the last point is either exactly `start`, or at least 0.001 m from it (`op.mjs`). *Measured*: a gap of 1e-10 m fails to build, `profile has a zero-length segment` ([`geometry-rejects/v2-outline-closing-gap.op`](../test/fixtures/geometry-rejects/v2-outline-closing-gap.op)).
- **Whole-outline gates** (`op.mjs`): it encloses at least 1e-6 m², and it does not cross itself. Both are judged on the outline with each arc cut into chords of at most 10°.
- **What the points mean depends on the node.**
  - In a **sweep**, a point is a plan point `[x, z]`, and its `[0, 0]` is the path's lower end. `counterClockwise` reads seen from above: from +x towards −z, as every `.op` angle (GE `:2176-2183`).
  - In a **revolve**, a point is `[x, y]` on the upright plane, and `counterClockwise` reads seen from the front (+z).
- **A worked case.** In [`test/fixtures/valid/v2-sweep-arc-profile.op`](../test/fixtures/valid/v2-sweep-arc-profile.op) an arc runs from `[-0.2, 0.05]` to `[0.2, 0.05]` about `[0, 0.05]`. Seen from above, counter-clockwise carries −x through +z to +x, so with `counterClockwise: true` the arc passes `[0, 0.25]` and closes a D-shape 0.5 m deep. With `false` it passes `[0, -0.15]`, inside the rectangle, and `validate.mjs` reports a body 0.300 m deep against `dimensions.depth` 0.5.

## 4. Shells

A `shell` hollows the solid that `sourceRef` names, leaving one closed void `thickness` inside every face. It is built as two shells (its outside and its void), and `parity.mjs --mesh` allows exactly two for a model node that is a ref to a `shell` (`shellNodes`, `tools/lib/mesh.mjs`): the larger winds outward, and the second winds inward (negative signed volume) and lies inside the first's box.

- **No revolve and no cylinder sector.** OpenGeometry 3.0.0 cannot shell either: the kernel refuses with `CoverageGap`, which is not a Floorkit code (Floorkit's page, "Model node kinds"). *Measured* for a sector behind a boolean ([`geometry-rejects/v2-shell-of-sector.op`](../test/fixtures/geometry-rejects/v2-shell-of-sector.op)): the build fails with `CoverageGap { families: ["canonical full cylinder", "canonical full cylinder"] }`. *Measured* for a revolve too, directly (a ring, and the solid pedestal) and as an operand of a union: each build fails with `CoverageGap { families: ["restricted analytic shell", "arc-edged profile extrusion"] }` (`revolve-shell.mjs` in the FLO-279 evidence). - **No shell of a shell.** *Measured*: a shell of a shelled sphere fails with `CoverageGap { families: ["full sphere input", "full sphere input"] }` ([`geometry-rejects/v2-shell-of-shell.op`](../test/fixtures/geometry-rejects/v2-shell-of-shell.op)), and the review measured a shell of a shelled cuboid failing with `canonical planar profile extrusion`.
- `op.mjs` refuses a shell statically when its source is a revolve, a sector or another shell, and also when one is reached through a `boolean3d` (its base or an operand).
- **A source that is not a solid** (an uncapped sweep is a sheet) is refused by Floorkit when built (`bad-shell`, GE `:2552-2553`). In format v2 every sweep is capped, so this cannot arise.
- **Room for the void.** `thickness` must be under half the smallest extent of the source's box. This is a necessary rule only: a pointed cone, for example, can still be too thin for its thickness. A maintainer's `parity.mjs --build --mesh` run is the real check.
- **A shell of a sphere** builds as two shells (*measured*: `v2-sampler.op`'s `ball`, 2 shells, volume 0.00113 m³, the exact 4/3·π·(0.1³ − 0.09³)).
- **A shell of an outline sweep minus a cylinder** that opens the void through the top face builds as one shell (*measured* on Floorkit `7bc2d595`, mirrored included, mesh clean: the pans of `floorkit.wc` and `floorkit.wc-wall-hung` 2.0.0, 1,054 and 1,034 triangles). This is how a format v2 WC pan is hollowed. The shell is the boolean's base. Since 2026-10-31 an outline sweep may also cut the shell's top face, as [§6.1](#61-an-outline-sweep-in-a-boolean) says (*measured*: FLO-330 case 3a, an oval opening). A shell of a boolean that holds an outline sweep is refused (not measured).
- **Measured by Floorkit, not by this catalog.** Floorkit's page says that on OpenGeometry 3.0.0 a shell builds for a cuboid, a full cylinder, a sphere, a pointed cone, a frustum, a torus, an outline sweep, a capped point-list sweep, and a cuboid minus a cylinder. This catalog has not run those builds.

## 5. Placements

- **A body's placement is a turn, a move and one scale factor.** Floorkit 3.0 places every built body through `transformBody`, which refuses any other matrix as `bad-scale` (`base-type.ts:51-63`). `op.mjs` refuses a `placement.scale` whose three numbers differ on any `modelView` element and on any solid definition, in format v2 and in format 1 alike (`bodyScaleIssues`).
- No block in the catalog had an uneven node scale when the gate came in (checked over the 80 blocks on 2026-10-31), so no block changed.
- An uneven **block** scale (a project's placement of the whole block) is Floorkit's own matter: it stretches cuboids, and cylinders and cones with equal x and z scales, and refuses the other kinds (Floorkit's page, "Model node kinds").

## 6. What the catalog refuses that Floorkit 3.0 accepts

Each row is a catalog rule stricter than Floorkit, with its reason. The owner accepted these on 2026-10-31.

| The catalog refuses | Floorkit 3.0 | Why |
| --- | --- | --- |
| A sphere, cone, torus, revolve, shell or outline size from 4e-8 up to 0.01 m | Accepts | The catalog's floor for every size is 0.01 m ([format 1 §3](format-v1.md#3-nodes); [drafting standard §3](drafting-standard.md#3-the-body-at-lod-300)). |
| A cylinder `angle` above 6.2831 (so 2π or more), 0 or less; `startAngle` without `angle` | Builds a full cylinder for any `angle` within 64·ε of 2π or above, or a sector of a negative or zero turn | A full cylinder leaves `angle` out, and a sector is visibly less than a full turn: 6.2831 keeps it at least 0.00008 rad short, so no file is a full cylinder in disguise. A sector says both its turn and its start. |
| A sweep without `capStart` and `capEnd`, or with either `false` | Defaults the caps to `false` and builds a sheet | A sheet is not a solid: a boolean or a shell refuses it (`bad-boolean`, `bad-shell`), and the mesh gate refuses its open edges. |
| An outline sweep whose path goes down | Builds it from its lower end | One direction, one reading. |
| A revolve outline that crosses its axis, touches it at a point, or comes within 0.001 m of it anywhere but along an edge lying on the axis | Accepts. The kernel refuses an outline that crosses the axis (`revolved profile crosses the revolve axis`) or touches it at one point (`… touches the revolve axis at a point`), and builds one that lies along the axis by an edge, a solid knob, mesh clean (all *measured*, `revolve-axis.mjs` in the FLO-279 evidence) | Crossing and a point touch do not build. An edge lying on the axis builds, so the catalog allows it: a solid revolve (a knob, a pedestal, `test/fixtures/valid/v2-pedestal.op`). Everywhere else 0.001 m is the catalog's contact tolerance: closer than that, a point beside the axis cannot be told from one on it. Lead's choice on 2026-10-31, from the measurement. |
| An outline of more than 256 segments | Accepts any number | The whole-outline gates compare every pair of chords; 256 segments of arcs cut at 10° keep that within a second, and no piece of furniture needs more. |
| A shell `thickness` of half the smallest extent of its source's box or more | Accepts; the kernel's shell fails or leaves no void | The void needs room. A necessary rule only: parity is the real check ([§4](#4-shells)). |
| An outline that repeats a point, encloses no area or crosses itself | Accepts | A degenerate outline. |
| A shell of a revolve, a sector or another shell, also through a boolean | Accepts; the kernel refuses with `CoverageGap` (measured for each, [§4](#4-shells)) | A refusal at the kernel is a block that does not build. |
| An outline segment shorter than 0.001 m, the closing line included; a last point within 0.001 m of `start` but not on it | Accepts; the kernel refuses a zero-length segment (measured at 1e-10 m) | 0.001 m is the catalog's contact tolerance, far above the kernel's 1e-9: a detail smaller than that is not drawn, and a near-closed outline is a typing slip. The 0.01 m size floor would be too coarse for a short chamfer or a fillet edge. |
| An outline sweep less than 0.01 m high | Refuses 1e-9 m or less as `bad-sweep` (GE `:726`; measured at 1e-10) | The catalog's floor for every size. |
| A revolve outline on its axis along two or more separate runs of edges | Accepts; the kernel refuses (`revolved profile meets the revolve axis along more than one segment`, measured) | Two runs enclose a void at the axis. Adjacent collinear edges are one run and pass ([`valid/v2-revolve-collinear.op`](../test/fixtures/valid/v2-revolve-collinear.op)). |
| A point-list sweep as a boolean operand or base | Accepts a capped sweep | Kept from format 1; not measured ([format 1 §4](format-v1.md#4-definitions-and-references)). |
| An outline sweep in a boolean, except as a through cut ([§6.1](#61-an-outline-sweep-in-a-boolean)) | Accepts any; the kernel fails on some (`CoverageGap`, OPE-109) and leaves open edges on others (OPE-107, OPE-108), all *measured* | Allowed only where the measurement found a clean mesh. Owner's decision, 2026-10-31. |
| A revolve as a boolean's base or operand | Accepts; as the tool, the kernel fails with `CoverageGap` for a revolve with chords, against a sweep or a cuboid (OPE-109, *measured*), and a revolved rectangle leaves open edges (OPE-107). As the base, a revolve less a cuboid left 96 open edges and a revolve less a sweep built clean (FLO-330 review A, p29 and p29b) | A refusal at the kernel is a block that does not build. No released block used one (2026-10-31). |
| A union as an operand of a subtract | Accepts; the kernel refuses a WC pan's shell less a union of cylinders: `InvalidTopology("pcurve on halfedge 9 leaves face 2 UV bounds …")` (*measured*, BIM review 070 G17, probes R2, R2b, R2c) | The cause is not traced, so the whole pattern is refused. No released block or valid fixture used it (2026-10-31). Cut with one solid of the opening's shape, for example an outline sweep. |
| A revolve arc off the axis whose circle reaches the axis, or centred between 1e-9 and 1e-8 m from it | Accepts; the kernel refuses it: `revolved profile arc circle meets the revolve axis` (*measured*, BIM review 070 G11, probes P3 and P4) | The kernel's own rule, at its own tolerance, copied: see [§6.2](#62-revolve-arcs). |
| A body placement with an uneven scale | Refuses as `bad-scale` when built | Statically, before the build. |
| Unknown keys anywhere, `catalog:format` absent or other than `"2"` | Drops unknown keys; metadata is any string record | Format 1's rule: nothing Floorkit would repair or drop. |

### 6.1 An outline sweep in a boolean

The owner lifted format v2's refusal of an outline sweep in a `boolean3d` on 2026-10-31, with a narrow rule that matches what FLO-330 measured ([RFC 0004, amendment](rfcs/0004-format-v2.md#amendment-2026-10-31-an-outline-sweep-as-a-through-cut)). The rule holds for a boolean that has an outline sweep as its base or as an operand, and for one whose base is a shell of an outline sweep, whatever its operands (a cuboid pocket in such a shell left two shells: FLO-330 review A, probe p14). Such a boolean passes `op.mjs` (`sweepBooleanIssues`) only when all of these hold:

1. **The operation is `subtract`.** A union or an intersect with a sweep is not measured.
2. **The base is an outline sweep, a cuboid, or a shell whose source is one of those two.**
3. **Each operand is an outline sweep, a cuboid or a full cylinder.** A cylinder through an outline-sweep base is refused: the kernel leaves open edges round the hole (OPE-107; 1b and 4a). Cut that hole with an outline sweep of a circle (two half arcs) instead (1c, 4b). A cylinder through a shell's top skin stays allowed: the pan of `floorkit.wc-accessible` 2.0.0 is a shell of an outline sweep less a cylinder, as the first `wc` and `wc-wall-hung` 2.0.0 pans were, measured clean ([§4](#4-shells)); since FLO-330 those two pans are opened by an oval outline sweep. Any other operand kind is not measured.
4. **Each operand cuts through.**
   - A sweep or cuboid base: the operand reaches at least 0.005 m below the base's bottom face and at least 0.005 m above its top face.
   - A shell base, **across the top face only**: with the source from `y0` to `y1` and the shell `thickness` `t`, the operand's top is at least `y1 + 0.005`, and its bottom is in the void, at most `y1 − t − 0.005` (at least 0.005 m below the underside of the top skin) and at least `y0 + t + 0.005` (at least 0.005 m above the void's floor). So the cut opens the top skin and nothing else. The measured WC opening, case 3a: source 0.18 to 0.40, `t` 0.015, opening 0.35 to 0.41. This holds for a cuboid or cylinder operand too.
   - A pocket is refused: an extrusion pocket of another shape fails with `CoverageGap` (OPE-109).
5. **Each operand's outline lies inside the base's outline**, at least 0.001 m clear. For a cuboid, its outline is its rectangle; for a cylinder, its circle. For a shell, the operand lies inside the **void's outline**, at least 0.001 m clear: the source's outline with each line moved `t` inwards and each arc's radius changed by `t`, the moved edges meeting at their crossing points. At a concave corner of the source that crossing is more than `t` from the source's corner (`t / sin(θ/2)` for a corner of angle θ), so a cut `t + 0.0015` m from a concave corner reached the wall and left 12 open edges (review A, p26; the same cut at a convex corner, p26b, was clean). Where a moved edge turns round (an edge shorter than the shell is thick), the void cannot be drawn this way, and the cut is refused.
6. **Nothing of one outline lies on the line through a straight edge of the other** (OPE-108): no vertex, and no point of an arc, within 0.001 m of that line. The line is the whole line, not only the edge: the measured fault (2b, 2c) is a base vertex at (−0.45, −0.4) on the line z = −0.4 of the opening's side, 0.05 m beyond the side's end. The same fault comes at a point inside an arc (review A, p17a and p17b): the kernel draws an arc in a cap as chords, and an opening side on z = −0.440451 through the chord point (±0.429389, −0.440451) of an r 0.05 corner (5 chords of 18°) left 3 open edges. The chord points move with the display deflection (`tessellate`, `tessellation/tessellate.rs` at `053b471`: each edge's count comes from the deflection the caller asks for, raised to match the side walls' grid), so a static gate cannot know them. The catalog therefore counts every point of an arc. For a shell, the void's outline is held to this too.
7. **Each part may only be moved**: the base, a shell's source and each operand have no `placement`, or one with no turn and a scale of 1, so that the outlines can be compared.
8. **Several operands** are held to rules 3 to 7 each, and stay at least 0.001 m apart, neither inside the other, with nothing of one on the line of a straight edge of another. Several cuts in one subtract are *not measured*.

Also refused: a revolve as any boolean's base or operand, a boolean whose base or operand is a boolean that holds an outline sweep, and a shell of one (both not measured). As the tool, a revolve with chords fails with `CoverageGap` (OPE-109, *measured*). As the base, a revolve less a cuboid left 96 open edges (review A, p29) and a revolve less a sweep was clean (p29b); one clean case is not enough, so the refusal stands.

**Exact where it can be, and refused where it cannot.** Every outline edge is a line or an arc, so the distances of rules 5, 6 and 8 are computed exactly (`outline.mjs`: end points, the points where both normals meet, and crossings), and the inside test uses chords within 0.0005 m of each arc, below the 0.001 m clearance. Rule 6 does not reproduce the kernel's chord points; it refuses any arc that the line comes within 0.001 m of, which is stricter than the fault. A block is refused where a check cannot be made: a turned part (rule 7), and a shell whose void cannot be drawn as a simple offset (rule 5).

**Stricter than the measurement.** Some refused cases built clean when tried:
- FLO-330 case 2b2 (a tray opening with corners of radius 0.03): its base vertex (−0.45, −0.4) is on the line z = −0.4 of the opening's side, as in the failing 2b. The kernel's cap triangulation fails on one and not on the other; the catalog cannot tell why, so it refuses both. The same opening moved 0.005 m in (0.79 m, corners 0.03) passes the rule and builds mesh clean (*measured*, see the amendment).
- The cut sides of the cases 2a and 4b, which run, extended, into an arc of the outer outline. They built clean at the deflection measured; at another, a chord point may fall on the line (rule 6).
- The pocket fixture [`v2-sweep-pocket.op`](../test/fixtures/geometry-rejects/v2-sweep-pocket.op) (a circular pocket), and [`v2-sweep-line-meets-arc.op`](../test/fixtures/geometry-rejects/v2-sweep-line-meets-arc.op), each clean plain and mirrored on x and on z.
- The fixture [`v2-sweep-collinear-opening.op`](../test/fixtures/geometry-rejects/v2-sweep-collinear-opening.op): clean plain and mirrored on x, but mirrored on z it leaves 3 open edges (review A, `mirror-mesh.mjs`). So "clean when tried" holds only for the placements tried.

**The volume.** For gate (e), such a subtract's volume is the base's less each operand's outline area times the height it shares with the base, and for a shell base with its top skin (`geometry.mjs`).

### 6.2 Revolve arcs

Kernel 3.0.0 builds each arc of a revolve's outline as a sphere when its centre is on the axis, and otherwise as a torus (`arc_lateral`, `src/primitives/internal/revolved_profile.rs` at `053b471`). The kernel counts a centre within its accuracy, 1e-8 m (`Accuracy::STANDARD.geometric`), as on the axis. The torus needs its whole circle off the axis: the centre's distance from the axis less the radius must be more than 1e-8 m. Otherwise the build fails with `revolved profile arc circle meets the revolve axis`, even when the arc itself stays clear of the axis.

`op.mjs` (`revolveArcIssue`) is stricter at the edge of the kernel's tolerance:
- An arc counts as centred on the axis only when its centre is within **1e-9 m** of it. A centre exactly 1e-8 m off the axis passes the kernel's test, but the build then fails with `InvalidTopology("pcurve does not lie on edge support")` (review A, p20; also at −1e-8, p25). A centre 1e-9 m off the axis builds, mesh clean plain and mirrored on x and on z (p25, `mirror-mesh.mjs` of review A); 0.9e-8 builds too (p21) but is refused, to stay clear of the failing 1e-8.
- Any other arc whose circle comes within 1e-8 m of the axis, or crosses it, is refused.
- An arc centred on the axis that runs past a pole crosses the axis, which the outline gate refuses first.

*Measured*: BIM review 070 probes P3 and P4 fail to build with that message, and P3b (torus arcs clear of the axis) builds. [`geometry-rejects/v2-revolve-arc-circle-meets-axis.op`](../test/fixtures/geometry-rejects/v2-revolve-arc-circle-meets-axis.op) is the catalog's case.

## 7. The geometry gates on the new kinds

The gates of [format 1 §9](format-v1.md#9-limits-and-why) and [drafting standard §3](drafting-standard.md#3-the-body-at-lod-300) apply to every kind. They bound each solid by a box (`geometry.mjs`):

| Kind | Box | Volume (for the LOD 300 ratio) |
| --- | --- | --- |
| `sphere` | exact | exact |
| `torus` | exact | exact |
| `cone` | a cylinder of its larger radius: exact upright, sound when turned | exact |
| cylinder sector | its centre line, both arc ends and every axis the arc crosses: exact before any turn | exact |
| outline sweep | exact: each arc's extremes are taken exactly (`support`, `outline.mjs`) | the outline's area from 10° chords (within 0.6 %), times the height |
| `revolve` | exact before any turn, for any axis in the outline's plane | Pappus's theorem on the 10°-chord outline |
| `shell` | the source's box | the source's volume less the void, exact for a cuboid, a sphere or a full cylinder source without a placement of its own; for any other source, the source's whole volume, so the ratio errs towards refusing |
| a subtract with an outline sweep ([§6.1](#61-an-outline-sweep-in-a-boolean)) | the base's box | the base's volume less each cut's outline area (10° chords) times the height it shares with the base, or with a shell's top skin. Any other subtract keeps its base's volume, so the ratio errs towards refusing |

As in format 1, a box is conservative for a part turned by other than a right angle. *Measured*: the kernel's volumes for the fixtures agree with these to 0.2 % (the probe's pan 0.07307 m³ against 0.07313; the plinth 0.02054 against 0.02057; the sector 0.00627 against 0.00628).

**Two facts of the kernel's meshes** (*measured* on the fixtures):

- **An arc-edged outline sweep has slivers.** Kernel 3.0.0 emits two zero-area triangles per arc step on the side wall (the probe's pan: 48 of 160); fixed in kernel bd44f13 (OPE-101), 2026-10-31. `tools/lib/mesh.mjs` drops a triangle whose corners fall in one 0.01 mm weld cell before its shell checks, and counts it as `collapsed` in the mesh report; `parity.mjs --mesh` prints a `SLIVERS` line per block and a `slivers dropped` total. Without that, every arc-edged sweep reads as an open shell. None of the 80 format 1 blocks has a collapsed triangle. The drop stays for older kernels; against kernel bd44f13 `parity.mjs --mesh` prints no `SLIVERS` line and `slivers dropped: 0 triangle(s) in 0 block(s)`.
- **A sphere is heavy.** The shell of a sphere of radius 0.1 m is 83,636 triangles. A drawing caps a block at 20,000 (Floorkit `exporter/project-block-mesh.ts:22`, read by the seam audit; not measured here). No schema limit is set; the mesh report gives each node's count.

The format 1 rule against a partial cylinder ([drafting standard §3](drafting-standard.md#3-the-body-at-lod-300)) does not apply in format v2. Floorkit 3.0 reflects a sector's arc when the block is mirrored (`open-element-mirror.ts:81-89`). *Measured* on [`v2-pedestal.op`](../test/fixtures/valid/v2-pedestal.op), whose sector runs from 0.3 rad, not symmetric about x: built with the block scale `[-1, 1, 1]`, the shelf's mesh box is x −0.1911 to 0.0591, the drawn box (−0.0591 to 0.1911) reflected, and the pedestal's is unchanged (`sector-mirror.mjs` in the FLO-279 evidence). `render.mjs` draws a block unplaced, so it cannot show a mirror.

## 8. Where Floorkit's page and its code disagree

Floorkit's `docs/snippets/api/open-element.mdx` against the code at `7bc2d595`; the code wins.

1. **"Any other kind is refused as `unsupported kind`."** The code throws a plain `Error` (`… has unsupported kind …`, GE `:942-944`, `:1033-1035`) with no `code`.
2. **The list of refusal codes omits `bad-boolean`**, which the code throws when a boolean's base or operand is not a solid (GE `:2352-2366`).
3. **A shell of a sector or a revolve "is refused by the kernel with `CoverageGap`".** Floorkit itself does not check it; the error comes from the kernel when the body is built.
4. **"An outline that crosses the axis or touches it at one point is refused by the kernel."** True when built (*measured*), but Floorkit's parser does not check it (GE `:871-895`), so `parseOpenElementDefinition` accepts the block.
5. **A cylinder `angle`.** The page says a sector is an `angle` "below a full turn". The code also builds a sector for a zero or negative `angle`, and a full cylinder for any `|angle|` within 64·ε of 2π or above (GE `:2246-2263`).
6. **Caps of a point-list sweep.** The page does not say that an open path with unequal `capStart` and `capEnd` is refused (`bad-sweep`, GE `:2154-2156`).
7. **A node placement.** The page gives the `bad-scale` rule for a block scale only. The code refuses an uneven scale on every body's own placement too, cuboids included (`base-type.ts:51-63`).

## 9. The index and the loader

- **Every index entry has `format`**, the integer 1 or 2, from the block's marker (`tools/lib/catalog-index.mjs`, `schema/index/v1.schema.json`). The index schema keeps its name, `floorkit.catalog/v1` ([RFC 0004](rfcs/0004-format-v2.md#the-index)).
- **The loader reads up to `maxFormat`**, 1 by default: `openCatalog({ baseUrl, maxFormat: 2 })`. With the default, picking a block's newest version skips a format v2 entry, `list()` leaves it out, and asking for it by version, through `find(id, version)` or `load(id, { version })`, is refused with the code `unsupported-format` (`tools/loader.mjs`).
- **The loader checks the file's own marker** against its entry: a file whose `catalog:format` disagrees with the entry's `format` is refused with the code `integrity`.
