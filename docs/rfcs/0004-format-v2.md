# RFC 0004: format v2, the Floorkit 3.0 node kinds

| | |
| --- | --- |
| **Status** | Accepted by the owner (2026-10-31); built in FLO-279 |
| **Covers** | The block format that adds Floorkit 3.0's node kinds: its marker, its schema, the index field and the loader option that keep an old reader off it, its version rule, and the name "format v2" |
| **Maintainer** | [@aka-blackboots](https://github.com/aka-blackboots) |
| **Date** | 2026-10-31 |
| **Builds on** | [RFC 0001](0001-catalog-and-loader.md), [RFC 0002](0002-parametric-families.md), [docs/format-v1.md](../format-v1.md), [docs/format-v2.md](../format-v2.md) |

How to read this document:
- **Read** means taken from Floorkit's source at OpenPlans-3.0 `7bc2d595` (kernel `opengeometry` 3.0.0). That repository is private. `generic-element.ts` is `src/packages/openplans-core/src/elements/generic-element.ts`.
- **Measured** means a command was run, here `tools/parity.mjs --build --mesh` and `tools/render.mjs` against a build of OpenPlans-3.0 `7bc2d595` on 2026-10-31 ([format-v2, where the facts come from](../format-v2.md#where-the-floorkit-facts-come-from)). **Unverified** means neither read nor measured.

## Summary

- **Format v2 is format 1 plus seven things Floorkit 3.0 reads:** `sphere`, `cone`, `torus`, `revolve`, `shell`, the cylinder sector (`cylinder` with `angle` and `startAngle`) and the outline sweep. Field names and limits are Floorkit's own ([format-v2 §2](../format-v2.md#2-node-kinds)).
- **The marker is root metadata `"catalog:format": "2"`.** A block without it is format 1, so the 80 blocks in the catalog do not change. The root `version` stays `1`.
- **The schema is `schema/op/v2.schema.json`**, beside v1, strict and closed like it. `tools/lib/op.mjs` chooses the schema per block and adds the format v2 gates.
- **Each index entry gets `format`**, the integer 1 or 2. The index schema keeps the name `floorkit.catalog/v1`.
- **The loader reads up to `maxFormat`**, default 1, so an old reader never gets a format v2 block.
- **Moving a block to format v2 is a MAJOR version** on its own.
- **The parametric-family format of RFC 0002 moves to a later format number.**

## Motivation

Floorkit 3.0 builds on OpenGeometry 3.0, which adds kernel primitives and operations that format 1 cannot say: a sphere, a cone, a torus, a revolved outline, a hollowed solid, a cylinder sector that mirrors correctly, and an extruded outline with arc edges. The drafting standard's §13 lists "No sphere, revolve, cone or fillet" and "No partial cylinders" among the things the format cannot draw; basins, bowls, knobs and round tops are approximated with cylinders and boxes.

Format 1 must not change to take them: released blocks are immutable, and a reader that knows only format 1 (Floorkit 2.x, the catalog's own `v0.1.0` tools) must not be handed a block it would refuse or, worse, repair. So the new kinds are a new format with its own schema, and the index tells a reader which format each file is.

## Where Floorkit stands

| Fact | Evidence |
| --- | --- |
| The parser reads `cuboid`, `cylinder`, `sweep`, `sphere`, `cone`, `torus` and `revolve` as model kinds, and `shell` in `definitions` only | Read: `generic-element.ts:706-714`, `:1022-1028` |
| The 3.0 kinds are read strictly: each size given, finite and above `KERNEL_MIN_SIZE` (4e-8), with a refusal code | Read: `:738-762`, `:833-895` |
| `cuboid` and `cylinder` keep the lenient 2.0 rule: missing sizes default, `angle` defaults to 2π | Read: `:805-826` |
| An outline sweep extrudes only along one vertical path segment, both caps `true` | Read: `:720-735`, `:916-930` |
| A shell of a revolve or a sector fails in the kernel (`CoverageGap`), not in Floorkit | Floorkit's `open-element.mdx`, "Model node kinds". Measured for a sector behind a boolean, and for a revolve directly and behind a boolean |
| A revolve outline that crosses its axis or touches it at a point fails in the kernel; one along the axis by an edge builds | Measured |
| `version` is never read; the output is always `1` | Read: `:1125-1126` |
| A body placement must be a turn, a move and one scale factor | Read: `shapes/base-type.ts:51-63` |

## Design

### The marker

- **`"catalog:format": "2"` in root metadata.** Root metadata is the catalog's closed vocabulary, travels with the definition when a project embeds it, and is a string record in Floorkit, which keeps it unchanged. A new top-level key would be dropped by Floorkit and is refused by the format 1 schema.
- **Absent means format 1.** The 80 blocks keep their bytes; no released file changes.
- **In format 1 the key is optional and, when present, must be `"1"`.** Optional, so that no block changes. Allowed, so that a tool may write the marker on every block it emits, whatever the format. Fixed to `"1"`, so that a misspelled or future value (`"3"`) is refused rather than read as format 1. The format 1 schema, [format-v1 §7](../format-v1.md#7-root-metadata) and `test/op.test.mjs` change together for it, as AGENTS.md requires for a new root key.
- **The root `version` stays `1`.** Floorkit writes `1` whatever the file says, so `"version": 2` would be a repair, which the catalog refuses. The format number therefore cannot live in `version`.

### The schema and the gates

- **`schema/op/v2.schema.json`** sits beside `v1.schema.json`; v1 is never removed ([GOVERNANCE.md](../../GOVERNANCE.md)). It is derived from v1: the same `$defs`, the new kinds, the cylinder sector, the outline, and `catalog:format` required as `"2"`. Its `catalog:category` enum equals `categories.json`; `tools/validate.mjs` checks both schemas against it.
- **The catalog stays stricter than Floorkit.** The schema refuses every value Floorkit would default or drop, and `op.mjs` refuses statically what the kernel cannot build: a shell of a revolve, a sector or another shell (also through a boolean), a revolve outline that crosses its axis or touches it at a point, an outline sweep that is not one segment straight up, and an uneven body scale. [format-v2 §6](../format-v2.md#6-what-the-catalog-refuses-that-floorkit-30-accepts) lists each refusal and its reason.
- **Catalog rules stricter than Floorkit**, accepted by the owner on 2026-10-31, each with its reason:
  - **every size at least 0.01 m** (Floorkit: above 4e-8; a cone radius may be 0 in both): the catalog's floor for every part, as in format 1 and drafting standard §3;
  - **both sweep caps `true`** (Floorkit defaults them to `false`): an uncapped sweep is a sheet, which a boolean and a shell refuse and the mesh gate fails;
  - **a revolve outline on one side of its axis, more than 0.001 m from it except along a line edge lying on the axis** (Floorkit does not check; the kernel, measured, refuses a crossing or a point touch and builds an edge lying on the axis). **Lead choice, owner asleep, measured** (2026-10-31): the rule matches the kernel for an edge on the axis, so a solid revolve (a knob, a pedestal) is allowed; everywhere else 0.001 m is the catalog's contact tolerance;
  - **a sector `angle` at most 6.2831** (Floorkit builds a full cylinder within 64·ε of 2π): a sector is visibly short of a full turn, and a full cylinder leaves `angle` out;
  - **at most 256 outline segments** (Floorkit: any number): keeps the pairwise crossing test fast, and is far above what a block needs;
  - **every outline segment at least 0.001 m long, the closing line included** (Floorkit: any length above 0; the kernel refuses a zero-length one, measured at 1e-10 m): the contact tolerance, far above the kernel's 1e-9; the 0.01 m size floor would be too coarse for a short chamfer;
  - **an outline sweep at least 0.01 m high** (Floorkit: above 1e-9): the size floor;
  - **at most one run of revolve edges on the axis** (Floorkit does not check; the kernel refuses two, measured): two runs enclose a void at the axis;
  - **no shell of a shell** (Floorkit accepts; the kernel refuses with `CoverageGap`, measured);
  - **a shell `thickness` under half the smallest extent of its source's box** (Floorkit: above 4e-8): the void needs room; a necessary rule, with parity as the real check;
  - **one scale factor on every body placement, in both formats** (Floorkit refuses others when built): refused before the build, in format 1 too, since the catalog must not accept a block Floorkit 3.0 refuses.
- **A sweep stays out of booleans**, as in format 1, until a build of one is measured. Amended on 2026-10-31: an outline sweep may be a through cut ([amendment](#amendment-2026-10-31-an-outline-sweep-as-a-through-cut)).
- **The geometry gates bound the new kinds** exactly where it is cheap (sphere, torus, sector, outline sweep, revolve) and soundly elsewhere (a turned cone, a shell's volume) ([format-v2 §7](../format-v2.md#7-the-geometry-gates-on-the-new-kinds)).

### The index

- **Each entry has `format`**, an integer, 1 or 2, taken from the block's marker by `tools/lib/catalog-index.mjs`. `schema/index/v1.schema.json` requires it.
- **The index schema keeps the name `floorkit.catalog/v1`.** A new required field is a breaking change for a reader of a closed index schema. The catalog has no `v*` tag and no reader outside this repository yet, so its first release can carry the field from the start, and no reader breaks. This is the one exception, recorded here: after `v0.1.0`, a change of this kind needs a new index schema name.
- **`index.json` regenerates** with `"format": 1` on all 80 entries.

### The loader

- **`openCatalog({ …, maxFormat })`**, default 1, is the highest block format the caller reads.
- Picking a block's newest version skips entries above `maxFormat`; `list()` leaves them out; asking for one by `version` (in `find` or `load`) is refused with the code `unsupported-format`, as is a block that has no readable version.
- `load()` checks the file's `catalog:format` against the entry's `format`, and refuses a mismatch with the code `integrity`.
- An entry without `format` is read as format 1, so the loader also reads an index built before this change.
- `tools/loader.mjs` still imports nothing.

### Versioning

- **A move to format v2 is a MAJOR block version on its own**, even when the drawing does not change: a reader of format 1 cannot load the new file, and the loader's newest-version rule would otherwise hand such a reader the older file silently under a MINOR or PATCH label that promises compatibility. The drafting standard's §14 says the same.
- The format 1 file of the block stays as it is and stays in the index.

### The name

- **This node-kind format is "format v2".** RFC 0002 used ".op v2" for a parametric-family format; that plan moves to a later format number (3 or above), unchanged in substance. RFC 0002 gets a one-line pointer to this RFC, and nothing else in it changes.

## Not proposed

- **No block is redrawn here.** Blocks move to format v2 in later changes, each as a new MAJOR version.
- **No 14th category, and no new port rows.**
- **No change to the parametric-family design** of RFC 0002, beyond its format number.

## Alternatives considered

### `"version": 2`: rejected

Floorkit writes `version: 1` whatever the file says (read: `generic-element.ts:1125-1126`), so a block with `2` is repaired on load, which the catalog refuses by rule.

### A new index schema `floorkit.catalog/v2` now: not chosen

It would cost every reader a second schema name before any reader exists. With no tag and no outside reader, adding the field to `floorkit.catalog/v1` before the first release breaks nobody.

### Read the format from the file at load time only: rejected

A reader would fetch and parse a file it cannot use, and the loader's newest-version rule would still pick it. The format must be in the index, before the fetch.

## Open questions

1. **Parity on format v2.** Measured on 2026-10-31: the four valid fixtures build, mirror and are mesh clean, and the 27 kernel rejects are refused. An asymmetric sector (`v2-pedestal.op`, from 0.3 rad) mirrors onto its mirrored box, measured by mesh boxes; `render.mjs` draws unplaced, so no mirrored picture.
2. **Uneven node scale in format 1** is now refused in both formats (lead's call, 2026-10-31): Floorkit 3.0 refuses it on every body (read: `base-type.ts:51-63`). No block had one, so no block changed.
3. **Triangle counts.** Measured: the shell of a 0.1 m sphere is 83,636 triangles. A maintainer's audit (2026-10-31) reports 54,288 for a 0.5 m sphere and a drawing cap of 20,000 triangles per block (unverified here), so a sphere alone may pass that cap. No schema limit is proposed; `parity.mjs --mesh` records each node's triangle count in its mesh report.

## Amendment 2026-10-31: an outline sweep as a through cut

| | |
| --- | --- |
| **Status** | Accepted by the owner (2026-10-31); built in FLO-330 part A |
| **Changes** | [format-v2 §2](../format-v2.md#2-node-kinds) (revolve row), [§4](../format-v2.md#4-shells), [§6](../format-v2.md#6-what-the-catalog-refuses-that-floorkit-30-accepts) with [§6.1](../format-v2.md#61-an-outline-sweep-in-a-boolean) and [§6.2](../format-v2.md#62-revolve-arcs), [§7](../format-v2.md#7-the-geometry-gates-on-the-new-kinds); `tools/lib/op.mjs`, `tools/lib/outline.mjs`, `tools/lib/geometry.mjs`. No schema change. No block changes |

### Decision

- **An outline sweep may be in a `boolean3d` only as a through cut**: a subtract of outline sweeps or cuboids, each through the base and inside its outline, from an outline sweep, a cuboid, or a shell of either (through its top face only), with no vertex on the line of the other's straight edge. [Format-v2 §6.1](../format-v2.md#61-an-outline-sweep-in-a-boolean) has the rule. The owner approved this on 2026-10-31.
- **No revolve in a boolean** (OPE-109).
- **No union as the operand of a subtract** (BIM review 070, G17).
- **A revolve arc off the axis keeps its whole circle off the axis**, the kernel's own rule (BIM review 070, G11).

### The measurement (FLO-330, 2026-10-31)

Floorkit `68604c67`, kernel 3.0.0 at `053b471`, on 27 scratch blocks, each a released block with only the rim (or the part named) redrawn, with the refusal turned off for the run (`FLO-330/REPORT.md` in the review evidence, not in this repository):

- `FLOORKIT_DIR=… node tools/parity.mjs --build --mesh --out=<evidence>/parity <evidence>/blocks/*.op`: "accepted by Floorkit: 27/27", "built by Floorkit: 24/27", "mirrored by Floorkit: 24/27", "mesh clean: 18/27".
- `OG_DIR=… node rim-booleans.mjs`, the kernel alone:
  - **OPE-107.** An outline extrusion less a cylinder through both caps: "264 open edges" (A1, the basin rim; A2 with straight edges too). A cuboid less the same cylinder: "0 open edges" (A3). The rim less a circle extrusion of two half arcs: "0 open edges" (A8).
  - **OPE-108.** A rounded square less a 0.8 square, whose side lies on the line through the outer vertex (−0.45, −0.4): "3 open edges" in the bottom cap (B1). A 0.79 square: "0 open edges" (B2).
  - **OPE-109.** The rim less the bowl's revolve (6 chords): "FAILED: CoverageGap { families: ["generic analytic solid", "intersecting analytic solid"] }" (C1, and C3 against a cuboid). An egg extrusion less a pocket of another egg: the same failure (D1); through both caps it builds, "0 open edges" (D2).
- Clean through cuts: the basins' rims less a circle sweep (1c), the shower tray less its exact offset (2a), the bath less a rounded opening from a sweep or a cuboid (2b, 2b3), the WC shell less an oval sweep through its top (3a, 3d), the quadrant tray less a circle sweep (4b).

### BIM review 070 (2026-10-31)

- **G11.** The probes P3 and P4 (a wash-basin bowl whose arcs are centred 0.08 and 0.06 m from the axis, radii 0.105 and 0.09) passed `validate.mjs` (`logs/probes-validate.log`) and failed to build: `revolved profile arc circle meets the revolve axis` (`logs/probes.log`). P3b, with arcs whose circles clear the axis, built. The rule is read from the kernel at `053b471`, `src/primitives/internal/revolved_profile.rs` (`arc_lateral`): centred within 1e-8 m of the axis, a sphere; else the centre's distance less the radius must be more than 1e-8 m.
- **G17.** The WC pan's shell less a union of two cylinders, or of cylinders and a cuboid (refuter probes R2, R2b, R2c), passed `validate.mjs` and failed to build: `InvalidTopology("pcurve on halfedge 9 leaves face 2 UV bounds at [-0.0948683298050514, 0.1334846922834953])` (`refuter/logs/r2.json`, `r2bc.json`). The cause is not traced, so every union operand of a subtract is refused. No released block and no valid fixture used one (checked over `blocks/` and `test/fixtures/` on 2026-10-31).

### Checked here (FLO-330 part A, 2026-10-31)

- `node tools/validate.mjs` on the 27 FLO-330 scratch blocks: every case that failed to build or left open edges is refused (1a, 1b, 2b and 2c tray, 4a), each with its kernel issue. Every clean case passes except 2b2 ([format-v2 §6.1](../format-v2.md#61-an-outline-sweep-in-a-boolean), "Stricter than the measurement"). 3c fails on its note only.
- `FLOORKIT_DIR=… node tools/parity.mjs --build --mesh` on the catalog: "accepted by Floorkit: 92/92", "built by Floorkit: 92/92", "mirrored by Floorkit: 92/92", "mesh clean: 92/92", "kernel-reject fixtures refused by Floorkit: 27/27". On the five valid format v2 fixtures, `v2-sweep-through-cut.op` among them: 5/5 each.
- The new reject fixtures through the same command: `v2-revolve-operand.op` fails with `CoverageGap`, `v2-revolve-arc-circle-meets-axis.op` with `revolved profile arc circle meets the revolve axis`, `v2-union-operand.op` with the `InvalidTopology` above; `v2-sweep-minus-through-cylinder.op` leaves "264 edge(s)" open, and `v2-sweep-cut-outside-base.op` leaves two shells. `v2-sweep-pocket.op` (a circle pocket) and `v2-sweep-collinear-opening.op` built mesh clean: those two rules are stricter than the faults they guard.
- The 2b2 tray opening moved 0.005 m in (0.79 m, corners 0.03): passes `validate.mjs`, and parity gives "built by Floorkit: 1/1", "mesh clean: 1/1".

### Review A fixes (2026-10-31)

A review of the first version of this rule (FLO-330 review A, probes `p01` to `p29b`) found three cases that passed `validate.mjs` and did not build clean. The rule now covers them ([format-v2 §6.1](../format-v2.md#61-an-outline-sweep-in-a-boolean), [§6.2](../format-v2.md#62-revolve-arcs)):

- **A chord point of an arc on a straight edge's line** (p17a, p17b: 3 open edges, plain and mirrored). The kernel's chord points follow the display deflection, so the catalog does not reproduce them: a straight edge's line may not come within 0.001 m of any point of an arc of the other outline. This also refuses cuts like 2a and 4b, which built clean at the deflection measured.
- **A shell's concave corner** (p26: 12 open edges). A cut of a shell is now measured against the void's own outline, whose concave corners lie more than `t` inside the source's.
- **An arc centred 1e-8 m from the axis** (p20, p25: `InvalidTopology("pcurve does not lie on edge support")`). A centre counts as on the axis only within 1e-9 m. Measured: 1e-9 builds clean, plain and mirrored on x and on z.
- **A shell of an outline sweep** is held to the rule whatever its operands (p14, a cuboid pocket: two shells). A full cylinder through the shell's top skin stays allowed, as in the released WC pans.
- **Measured after the fix**, with `node tools/validate.mjs`, `tools/parity.mjs --build --mesh` and review A's `mirror-mesh.mjs` (builds plain and mirrored on x and on z): 16 of review A's probes pass `validate.mjs`, and all 16 are accepted, built and mesh clean in parity ("mesh clean: 16/16"), and clean plain and in both mirrors.
- **The 11 redrawn blocks of the FLO-330 author branches**, checked without changing them: 9 pass. `shower-enclosure-quadrant` 1.0.0 is refused by the chord-point rule (its opening's side z = −0.4 runs into the tray's arc of radius 0.9), and `wc-accessible` 2.0.0 by the void rule (its opening comes within 0.0005 m of the void). All 11 built mesh clean in parity.

### Unverified

- The mirrored mesh beyond the blocks and probes listed: parity checks only that the mirrored build succeeds; review A's `mirror-mesh.mjs` checks the mirrored meshes, and was run only where this amendment says.
- Whether a straight edge of an outline is ever cut into chords in a cap, which would add more points on a line.
- Several cuts in one subtract; a cuboid cut of a sweep away from the measured 2c and B2 shapes; a straight-edged cut in a shell; a shell of a cuboid with a sweep cut.
- Why the kernel's cap triangulation fails on B1 and not on 2b2 (OPE-108), and the cause of G17.
- Kernels after 3.0.0 at `053b471`: when OPE-107, OPE-108 or OPE-109 is fixed, this rule can be loosened, with a new measurement.

## Sources

- Floorkit 3.0, OpenPlans-3.0 `7bc2d595`: `generic-element.ts`, `shapes/base-type.ts`, `open-element-mirror.ts`, `docs/snippets/api/open-element.mdx` (private).
- [docs/format-v2.md](../format-v2.md), [docs/format-v1.md](../format-v1.md), [docs/drafting-standard.md](../drafting-standard.md).
