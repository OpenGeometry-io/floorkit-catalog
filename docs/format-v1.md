# The `.op` v1 format

This page describes the `.op` v1 format in two ways: as Floorkit implements it, and as this catalog accepts it. It is written for two readers: someone authoring a block by hand, and someone writing a tool that reads blocks.

A block is one JSON file that describes one element: a plan symbol (`profileView`), a 3D body (`modelView`), named mount points (`anchors`) and, optionally, MEP connectors (`ports`).

The rules are enforced in two places:

- [`schema/op/v1.schema.json`](../schema/op/v1.schema.json) is a strict JSON Schema (draft 2020-12). It covers the structure.
- [`tools/lib/op.mjs`](../tools/lib/op.mjs) checks what a schema cannot express: references, uniqueness, rules that tie one field to another, limits and canonical bytes.

`node tools/validate.mjs` runs both. If this page and the code disagree, the code is what runs; please report the difference.

A block whose root metadata says `"catalog:format": "2"` is format v2: format 1 plus the Floorkit 3.0 node kinds, described in [`format-v2.md`](format-v2.md). Every other block is format 1, described here.

## Where the Floorkit facts come from

- **Read.** Floorkit's `.op` parser is `src/packages/openplans-core/src/elements/generic-element.ts` in the OpenPlans repository. This page calls it "Floorkit `generic-element.ts`" and cites line numbers from OpenPlans `origin/main` at `b0a084c7`, whose package `@opengeometry/floorkit` declares version 1.2.0 and depends on the `opengeometry` kernel `^2.0.18` (2.0.18 installed). That repository is not public, so this page names files rather than linking to them.
- **Measured at `b0a084c7`.** The parity counts in [§8](#8-what-floorkit-repairs-and-what-the-catalog-rejects), the IFC export paths in [§11](#11-advisory-notes), the example in [§12](#12-a-complete-example), and every statement that names `b0a084c7`.
- **Measured earlier.** The other statements marked *measured* were checked by running Floorkit built from OpenPlans `681e4f1` (package version 0.6.1, kernel 2.0.16), and were not run again at `b0a084c7`. Between the two commits the parser is unchanged: `git diff 681e4f1 b0a084c7` on `generic-element.ts` adds imports and changes only the `OpenElement` class (an `ifcClass` getter, live editing, `getPhysicalParts`, and building a mirrored placement as mirrored data). So a parser fact measured at `681e4f1` holds at `b0a084c7` by reading the code. A fact about the kernel (a boolean that builds or fails, a build time) is unverified on kernel 2.0.18.
- **Read, not executed.** Statements marked *read* come from the source alone.

CI cannot run Floorkit: the tools need a Floorkit build in `FLOORKIT_DIR`, and CI has none.

## Contents

1. [Units and coordinates](#1-units-and-coordinates)
2. [Top-level fields](#2-top-level-fields)
3. [Nodes](#3-nodes)
4. [Definitions and references](#4-definitions-and-references)
5. [Anchors](#5-anchors)
6. [Ports](#6-ports)
7. [Root metadata](#7-root-metadata)
8. [What Floorkit repairs, and what the catalog rejects](#8-what-floorkit-repairs-and-what-the-catalog-rejects)
9. [Limits, and why](#9-limits-and-why)
10. [Canonical bytes](#10-canonical-bytes)
11. [Advisory notes](#11-advisory-notes)
12. [A complete example](#12-a-complete-example)
13. [Checking a block](#13-checking-a-block)

## 1. Units and coordinates

| Quantity | Unit | Where it is used |
| --- | --- | --- |
| Lengths, positions, sizes | metres | everywhere, including port profile sizes |
| Geometry angles | **radians** | an arc's `startAngle` and `sweepAngle`; a cylinder's `angle` |
| Placement rotations | **degrees** | `placement.rotation` on any node, anchor or port |

Geometry angles and placement rotations use different units. This is easy to get wrong.

**Model space** is `[x, y, z]` in metres, with y up, and `y = 0` is the level the block is placed at. Floorkit's own fallback body stands on `y = 0` (it is centred at half its height, `:1490-1507`), and so do most blocks. A block set into or onto a counter keeps its origin on the floor and starts higher ([drafting standard §1](drafting-standard.md#1-origin-axes-and-grounds)): `floorkit.hob` starts at 0.90 m, on a worktop at 0.90, and the bowl of `floorkit.kitchen-sink` at 0.73 m.

The block's origin is its insertion point: a project places a block by moving its origin. Moving the geometry relative to the origin therefore moves every placed instance, which makes it a MAJOR version change.

**Plan space** is the floor plane. A plan point is written `[x, z]`, and **its second number is model z, not model y**. Floorkit turns a profile point `[a, b]` into the model point `(a, 0, b)` (`createProfileObject`, `generic-element.ts:1559-1582`). The plan symbol therefore lies in the plane `y = 0`, directly under the body.

**Angle direction.** Angles are measured from +x, and a positive angle turns towards −z:

- a cylinder with `radius: 1` and `angle: π/2` occupies `x ∈ [0, 1]`, `z ∈ [−1, 0]` (*measured*);
- Floorkit's own arc-bounds code puts the point at angle `a` at `(cx + r·cos a, cz − r·sin a)` (`getProfileBounds`, `:1353-1407`; *read*);
- Floorkit's plan export reports an arc with `startAngle: 0, sweepAngle: π/2` as running from 0° to −90° (*measured*).

This is the same sense as a positive rotation about +y under the right-hand rule, which carries +x towards −z.

**Placement.** A placement is `{ anchor?, position, rotation, scale }`. Floorkit composes it as `T(position) · T(anchor) · R · S · T(−anchor)`, so rotation and scale pivot about `anchor` (`createPlacementMatrix`, `generic-element.ts:1296-1317`). `rotation` is a set of Euler angles in degrees. Floorkit builds a `THREE.Euler` without passing an order, so three.js's default order `'XYZ'` applies; the rotation matrix is then `Rx · Ry · Rz`. If one axis is enough (usually y), rotate about that axis alone and the order stops mattering.

Catalog bounds on every placement:

- every coordinate (`position`, `anchor`) is within ±1000 m;
- each rotation component is within ±360°;
- each scale component is in (0, 100];
- on a body (a `modelView` element or a solid definition), the three scale components are equal: Floorkit 3.0 places a body by a turn, a move and one scale factor and refuses any other as `bad-scale` (`shapes/base-type.ts:51-63` in a Floorkit 3.0 build; read). `op.mjs` checks it; see [format-v2 §5](format-v2.md#5-placements).

`position`, `rotation` and `scale` are all required whenever a placement is given; `anchor` is optional.

## 2. Top-level fields

| Field | Catalog | Floorkit |
| --- | --- | --- |
| `version` | Required, exactly `1`. | Never read by the parser. The output is always `1` (`generic-element.ts:838-839`; *measured*: `2` became `1`). |
| `id` | Required, `<publisher>.<slug>`, lowercase and hyphenated, e.g. `floorkit.simple-chair`. Inside `blocks/` it must match the path. | Missing or empty: replaced by a generated `op-asset-…` id (`:840-842`). |
| `labelName` | Required, 1–80 characters, with no `<`, `>`, control characters or `://`. | Missing: `"Generic Element"` (`:843-845`). |
| `type` | Required, one of `FURNITURE`, `FIXTURE`, `APPLIANCE`, `LANDSCAPE`, `MEP_EQUIPMENT`, `DOOR`, `WINDOW`. | Any of Floorkit's element types is kept, including `WALL`. An unknown or missing value becomes `FURNITURE` (`:300-304`; *measured*). |
| `dimensions` | Required, `{ width, depth, height }`, each 0.01–100 m. | Missing or non-finite values become 1; anything below 0.01 is raised to 0.01 (`:476-485`; *measured*). |
| `placement` | Optional. When present, it must be the identity. | Applied to the whole element. At the root, `anchor` is ignored (`:2438`, `:2474-2479`). |
| `metadata` | Required. A closed vocabulary ([§7](#7-root-metadata)). | Any string record. Empty keys are dropped and values pass through `String()` (`:337-347`). |
| `anchors` | Optional; at least one anchor if present ([§5](#5-anchors)). | A value that is not an object is dropped; an anchor that is not an object throws (`:349-374`). |
| `ports` | Optional; an array of 1–64 ports ([§6](#6-ports)). | Strict (`:376-474`). |
| `definitions` | Optional; at least one definition if present, and every definition must be used ([§4](#4-definitions-and-references)). | A value that is not an object is dropped; each entry is normalised as a node (`:785-799`). |
| `profileView` | Required: `{ elements: [...] }` with 1–400 elements. | Missing or empty: a `width × depth` rectangle is drawn instead (`:1475-1488`). |
| `modelView` | Required: `{ elements: [...] }` with 1–400 elements. | Missing or empty: a bounding cuboid `dimensions.height` tall is built instead (`:1490-1507`). |
| any other key | Rejected, including `propertySets`, `ogid` and `$schema`. | Dropped silently (`:833-859`). |

**`dimensions`** gives the block's nominal size: `width` along x, `depth` along z and `height` along y. That is the orientation of Floorkit's fallback rectangle.

- In `generic-element.ts` the numbers only drive fallbacks: the two above, and a plan-export outline drawn when the plan yields nothing (`:2200-2213`; *read*). A catalog block always has both views, so none of these fallbacks applies to it.
- The catalog copies them into `index.json`.
- `validate.mjs` compares them with the body's bounding box, within 0.005 m ([§9](#9-limits-and-why)).

**Why the root placement must be the identity:** a project or an `.opbase` places the block; the block never places itself.

## 3. Nodes

A node is one piece of geometry. Every node may carry three fields:

- **`id`** matches `^[A-Za-z][A-Za-z0-9_-]{0,63}$`.
  - In a view, every node that is not a ref must have one, and ids must be unique within that view. A ref's own `id` counts towards uniqueness.
  - The same id may appear once in `profileView` and once in `modelView`; the chair's `seat` does.
  - Floorkit would otherwise invent `<kind>-<n>` ids (`:805-831`; *measured*: a cuboid with no id became `cuboid-0`). Those ids change whenever a node is inserted above, which breaks every `mat:` key that names them.
- **`color`** is `#rrggbb`, in either case. If it is omitted, Floorkit uses `#cfcfcf` in plan and `#c4c4c4` in the model (`:285-286`).
- **`placement`** is as in [§1](#1-units-and-coordinates).

| Kind | May appear in | Fields (**required**) | Catalog bounds | Floorkit defaults and repairs |
| --- | --- | --- | --- | --- |
| `polygon` | `profileView`, `definitions` | **`vertices`**: `[x, z][]` | 3–1024 points | Accepts any non-empty list (`:487-502`). |
| `polyline` | `profileView`, `definitions` | **`points`**: `[x, z][]` | 2–1024 points | as polygon |
| `arc` | `profileView`, `definitions` | **`center`** `[x, z]`, **`radius`**, **`startAngle`**, **`sweepAngle`**, `deflection` | `radius` 0.01–100 m. Angles within ±6.2832 rad. `sweepAngle` ≠ 0. `deflection` (tessellation tolerance) 0.0005–0.05 m. | `radius` defaults to 1, minimum 0.01. `sweepAngle` defaults to 2π. `deflection` defaults to 0.002, minimum 1e-6 (`:570-582`). |
| `polyline3d` | `definitions` only | **`points`**: `[x, y, z][]` | 2–1024 points | `:589-602` |
| `cuboid` | `modelView`, `definitions` | **`center`** `[x, y, z]`, **`width`** (x), **`height`** (y), **`depth`** (z) | sizes 0.01–100 m | Each size defaults to 1, minimum 0.01 (`:615-624`). `center` is the centre of the box (*measured*). |
| `cylinder` | `modelView`, `definitions` | **`center`**, **`radius`**, **`height`**, `angle` | `radius`, `height` 0.01–100 m. `angle` in (0, 6.2832] rad. | `angle` defaults to 2π and is not clamped (`:626-635`). The axis is y and `center` is mid-height (*measured*). |
| `sweep` | `modelView`, `definitions` | Either **`path`** + **`profile`** (inline) or **`pathRef`** + **`profileRef`** (by reference); `capStart`, `capEnd` | inline `path` 2–1024 points and `profile` 3–1024 points, both `[x, y, z]` | Caps default to `false` (`:637-664`). See [§4](#4-definitions-and-references). |
| `offset2d` | `definitions` only | **`sourceRef`**, **`distance`**, **`output`** (`polyline` or `polygon`), `acuteThresholdDegrees`, `bevel` | `distance` −10 to 10 m and ≠ 0. `acuteThresholdDegrees` in (0, 180). | `:671-693` |
| `boolean3d` | `definitions` only | **`operation`** (`subtract`, `union` or `intersect`), **`baseRef`**, **`operandRefs`** | 1–16 operands, no repeats | `:695-723`. See [§4](#4-definitions-and-references). |
| ref | `profileView`, `modelView` | **`ref`**, `id`, `color`, `placement` | It must not have a `kind`. | A ref that also has a `kind` throws (`:530-545`). |

Floorkit enforces the same "may appear in" split. A view element of any other kind throws `unsupported kind` (`:547-587`, `:608-669`), and a definition can never be a ref.

**Points have exactly the right length.** A plan point has two numbers and a model point three. Floorkit reads the first two or three and ignores the rest (`:487-520`); the catalog rejects a point with more.

## 4. Definitions and references

`definitions` is a map from a name to a node. Views use a definition by naming it; definitions name each other through `sourceRef`, `pathRef`, `profileRef`, `baseRef` and `operandRefs`. A definition is a piece of geometry written once in the file and used in several places (Floorkit still builds it again for every use; see [§9](#9-limits-and-why)). It cannot come from another `.op` file: v1 has no cross-file references.

What each reference must resolve to, in Floorkit and in the catalog alike:

| The reference | Field | Must name a definition of kind |
| --- | --- | --- |
| a ref in `profileView` | `ref` | a 2D profile: `polygon`, `polyline`, `arc` or `offset2d` |
| a ref in `modelView` | `ref` | a solid: `cuboid`, `cylinder`, `sweep` or `boolean3d` |
| a sweep, in a view or a definition | `pathRef`, `profileRef` | `polyline3d` |
| `offset2d` | `sourceRef` | a `polyline`, or an `offset2d` whose `output` is `polyline` |
| `boolean3d` | `baseRef`, each of `operandRefs` | a solid |

Further rules:

- **Own properties only.** A name resolves only to a key the file itself defines. `"ref": "constructor"` is refused by Floorkit (`hasOwnProperty`, `:1078`; *measured*) and by the catalog. A tool that looks names up with `definitions[ref]` would find `Object.prototype.constructor` instead. The catalog also rejects any key that exists on `Object.prototype`, such as `__proto__`, anywhere in the file.
- **No cycles.** Floorkit throws `Cyclic generic element definition detected` (`:1088`), and the catalog reports the loop.
- **Every definition is used** (catalog only). Each one must be reachable from `profileView` or `modelView`. Floorkit validates an unused definition but never draws it.
- **A definition's `id`, if present, equals its key.** Floorkit sets `id = key` when it is absent (`:827`).

**What a ref may override.** A ref may override `id`, `color` and `placement`. Placement behaves differently in the two views (*measured*):

| View | The ref's `placement` | The ref's `color` |
| --- | --- | --- |
| `profileView` | **Replaces** the definition's own placement (`applyRefOverridesToProfileNode`, `:1694-1704`). | Replaces the definition's colour. |
| `modelView` | **Is applied on top of** the definition's own placement (`buildModelViewObject`, `:1891-1923`). | Recolours the whole built solid. |

So to reuse one solid in several places, author it at the origin and position each ref, as the example in [§12](#12-a-complete-example) does with its legs.

**Sweep: inline or by reference.** Floorkit treats a sweep as a by-reference sweep as soon as it has `pathRef` **or** `profileRef`. It then requires both, and silently drops any inline `path` and `profile` (`isSweepRefCandidate`, `:604-606`). The catalog accepts only two forms: both refs and no inline geometry, or both inline lists and no refs.

When the sweep is by reference, each `polyline3d` has its own `placement` applied to its points before the sweep uses them (`:1781`).

Floorkit does not document how the kernel orients the profile along the path. `op.mjs` accepts only the case the geometry gates model on OpenGeometry's `sweep.rs`: the profile centred on its vertex average at the origin and facing +y, the path starting straight up, in one vertical plane, with no turn over 90° ([drafting standard §3](drafting-standard.md#3-the-body-at-lod-300)). Two blocks use a sweep, `floorkit.glazed-door` and `floorkit.shower-enclosure`. Beyond that case, profile orientation is unverified.

**`offset2d`** offsets a polyline by `distance` and produces a polyline or a polygon. Floorkit first applies the source's own placement, then calls the kernel's `Polyline.getOffset(distance, acuteThresholdDegrees, bevel)` (`:1815`). If the offset has no colour, it takes the source's.

The sign of `distance` chooses the side. `floorkit.glazed-door` uses `+0.03` for its outer frame line and `-0.03` for its inner one, both on the same centreline. The meaning of `acuteThresholdDegrees` and `bevel` is the kernel's and is unverified here.

Offsetting a polygon is refused by both Floorkit and the catalog (`test/fixtures/kernel-rejects/offset-of-polygon.json`).

**`boolean3d`** starts from `baseRef` and applies `operation` with each operand in turn (`executeBooleanChain`, `:1650-1676`). The result takes the boolean's `color` if it has one, otherwise the base's (`:1845`).

There are two build-time conditions. **Floorkit's parser checks neither; `validate.mjs` checks only the first:**

- **Every base and operand must be a kernel analytic solid**: a `cuboid`, a `cylinder` or the result of another `boolean3d`.
  - A `sweep` is not one: the kernel declares `Sweep` as a `THREE.Mesh`.
  - A block that subtracts a sweep parses in Floorkit, and building it then throws `Boolean model definitions require strict analytic solid operands.` (`:1661`; *measured*). `validate.mjs` refuses a sweep as a base or an operand.
- **The kernel does not cover every arrangement of solids.** Whether a pair builds depends on how the solids meet, not only on their kinds (*measured*, subtraction only):
  - built: a vertical through-hole cut from a cylinder by a cuboid, from a cuboid by a cylinder, from a cuboid by a cuboid, and from a cylinder by a narrower coaxial cylinder;
  - failed: a cuboid minus a cylinder that crosses one of its side faces threw `AnalyticGeometryError` with code `coverage_gap`: "Analytic boolean coverage is unavailable for generic analytic solid and intersecting analytic solid."
  - In `blocks/`, 10 blocks use a boolean, every one a subtraction: a cuboid minus a cuboid, a cuboid minus a cylinder, or a cylinder minus a cylinder. All of them build at `b0a084c7` (§8). The `coverage_gap` case above was not run again there.

Only `FLOORKIT_DIR=<dir> node tools/parity.mjs --build` catches the second. It needs a Floorkit build; name a file to build that file alone, inside `blocks/` or not. If you cannot run it, keep to cuboid and cylinder operands, and say in your pull request that the block has not been built, so that a maintainer runs it.

## 5. Anchors

An anchor is a named mount point: a placement in the block's local space, plus optional free-form metadata.

```json
"anchors": {
  "seatCenter": {
    "placement": { "position": [0, 0.52, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1] },
    "metadata": { "role": "seating-point" }
  }
}
```

- **Names** match `^[A-Za-z][A-Za-z0-9_-]{0,63}$`, and come from the closed table of the [drafting standard §7](drafting-standard.md#7-anchors): 17 names, each with the roles it may take. A new name or role is added to the standard first. `op.mjs` checks every anchor against that table (`tools/lib/roles.mjs`).
- **`placement`** is required, with `position`, `rotation` and `scale`. Floorkit turns it into a matrix with `getAnchorMatrix(name)` (`generic-element.ts:2116-2123`).
- **`metadata`** is open: string keys matching `^[A-Za-z][A-Za-z0-9:_-]{0,63}$` and string values of at most 200 characters.
  - Every anchor has a `role` from that table, for example `floor-contact`, `wall-contact`, `seating-point` or `tap-mount`.
  - Floorkit reads none of these values. They are conventions for applications.
  - An anchor lies on the body's surface; only `base` and `wallFace` may instead stand on the floor under the body ([§9](#9-limits-and-why)).
- **Floorkit's handling.** An anchor that is not an object, or an empty anchor name, makes Floorkit throw (`:349-374`).
- **Changing anchors.** Anchors are what projects attach to. Removing or renaming one is a MAJOR version change for the block; adding one is MINOR.

Floorkit's `.opbase` attachment relations name a host anchor and a child anchor (*read*, `projects/op-base.ts`; not exercised here). Anchors are mount points, not constraints.

## 6. Ports

A port is a connector for distribution systems: ducts, pipes, cables, cable trays and conduit. Floorkit models ports on IFC4's `IfcDistributionPort` (`mep/ports.ts`), and its parser is strict about them (`generic-element.ts:376-474`).

`ports` is an **array**: order matters, and IFC export nests the ports in order. Floorkit throws if `ports` is an object (`test/fixtures/kernel-rejects/ports-as-record.json`). Removing or renaming a port is a MAJOR version change for the block; adding one is MINOR.

```json
"ports": [
  {
    "id": "in",
    "domain": "electrical",
    "systemType": "power",
    "flowDirection": "sink",
    "placement": { "position": [0, 0.15, 0.38], "rotation": [0, 180, 0], "scale": [1, 1, 1] },
    "profile": { "shape": "electrical", "poles": 3, "amperage": 400 }
  }
]
```

(From `floorkit.pdu`.)

| Field | Catalog | Floorkit |
| --- | --- | --- |
| `id` | Required. A name, unique among the block's ports. | Must be non-empty and unique, or it throws. |
| `domain` | Required: `hvac`, `piping`, `electrical`, `cableCarrier` or `conduit`. | The same list; anything else throws. |
| `systemType` | Required. camelCase, matching `^[a-z][A-Za-z0-9]{0,63}$`. | Any non-empty string. `ports.ts` calls it "free-form but conventional" and gives `supplyAir`, `chilledWaterSupply` and `power` as examples. |
| `flowDirection` | Required: `source`, `sink` or `bidirectional`. | The same list; anything else throws. |
| `placement` | Required. | Missing: the identity. |
| `profile` | Required. See the next table. | Unknown `shape` throws. |
| `metadata` | Optional open string record, as for anchors. | Kept; empty keys are dropped and values pass through `String()`. |

| `profile.shape` | Fields | Catalog bounds | Floorkit |
| --- | --- | --- | --- |
| `round` | `diameter` | (0, 10] m | Must be a positive finite number. |
| `rectangular`, `tray` | `width`, `height` | (0, 10] m each | Must be positive finite numbers. |
| `electrical` | `poles`, optional `voltage` and `amperage` | `poles` is an integer 1–12. `voltage` and `amperage` are in (0, 10000]. | `poles` must be a positive integer. |

Notes on ports:

- **Sizes.** Port sizes are in metres; Floorkit compares two profiles "within `eps` meters" (`ports.ts`).
- **Electrical units.** Floorkit does not state units for `voltage` and `amperage`. The `floorkit.pdu` note reads its `amperage` as amperes, but Floorkit itself is silent, so the units are unverified.
- **Orientation.** Floorkit's routing code gives the ports of a generated run a local +z along the run (`placementFromDirection`, `mep/routing.ts`). It does not say which way an element's own port should face, so that is unverified here.
- **Connections.** Two ports may connect only if their `systemType` values agree and their flow directions are opposite; `bidirectional` matches either direction (`ports.ts`). The connection itself is held by Floorkit's distribution graph, not by the block.

## 7. Root metadata

Root `metadata` is a **closed vocabulary**: any key not listed below is rejected.

- Every value is a string.
- "Text" in the table means 1 or more characters, with no `<`, `>` or control characters (so no line breaks either). The upper length is given per key.
- Floorkit reads two of these keys, `ifc:class` and `ifcClass`, each on its own IFC export path ([§11](#11-advisory-notes)). Everything else is for the catalog, its index and the applications that load blocks.
- Every key travels with the definition when a project embeds it. That is why the licence and the credit live here.

| Key | Required? | Format | Meaning |
| --- | --- | --- | --- |
| `catalog:version` | yes | Strict semver `x.y.z`: no leading zeros, no pre-release or build part. | The block's own version. Inside `blocks/`, it must equal the file name. |
| `catalog:license` | yes | Exactly `CC-BY-4.0` | The block's licence, as an SPDX id. |
| `catalog:attribution` | yes | text, ≤ 200 | Who to credit. |
| `catalog:category` | yes | One of `seating`, `tables`, `beds`, `storage`, `kitchen`, `sanitary`, `appliances`, `lighting`, `planting`, `vehicles`, `equipment`, `openings`, `other` | The browsing category. [`categories.json`](../categories.json) must equal this list. |
| `catalog:placement` | yes for `DOOR` and `WINDOW`; otherwise optional | `hosted` or `free`. It must be `hosted` for a `DOOR` or `WINDOW`, and `free` (if present) for every other type. | Whether the block sits in a wall. This is metadata only ([§11](#11-advisory-notes)). |
| `catalog:defaultSill` | no; `WINDOW` only | A decimal number of metres as a string, e.g. `"0.9"` | The suggested sill height above the floor. |
| `catalog:lod` | yes | `100`, `200` or `300`; a `floorkit` block must be `300` ([§9](#9-limits-and-why)) | The level of detail the block is drawn to. Nothing in Floorkit reads it. |
| `catalog:format` | no | Exactly `1` when present | The block format. Absent means format 1. A block that says `2` is format v2 and is held to [`format-v2.md`](format-v2.md) and its own schema; any other value is refused. |
| `catalog:tags` | no | Lowercase tags joined by `", "`, e.g. `"chair, dining"`. Each tag is 1–32 characters of `a-z`, `0-9`, space and `-`, and starts with a letter or digit. At most 12 tags, none repeated. | Search terms. |
| `catalog:author` | no | text, ≤ 200 | Who drew it, if different from the attribution. |
| `catalog:note` | no | text, ≤ 500, with the keywords below | An authoring note. The tools read the keywords in it. |
| `catalog:basedOn` | no | text, ≤ 300 | Provenance: the standard, data sheet or reference the dimensions come from, or the source file of a derived block. |
| `ifc:class` | yes, checked by `op.mjs` ([§9](#9-limits-and-why)) | `^Ifc[A-Z][A-Za-z0-9]*$`, e.g. `IfcFurniture` | The IFC entity the block represents. Floorkit's freeform export reads it ([§11](#11-advisory-notes)). |
| `ifc:predefinedType` | no; requires `ifc:class` | `^[A-Z][A-Z0-9_]*$`, e.g. `CHAIR` | The IFC predefined type. |
| `class:uniclass2015` | no | text, ≤ 64 | A Uniclass 2015 code. |
| `class:omniclass` | no | text, ≤ 64 | An OmniClass code. |
| `ifcClass` | yes on a block with a port or of type `MEP_EQUIPMENT` (not a `DOOR` or `WINDOW`), and only there; it must equal `ifc:class` | as `ifc:class` | The legacy, unprefixed key. Floorkit's distribution-equipment path reads only this key ([§11](#11-advisory-notes)). |
| `mat:<nodeId>` | no | `surface`, `soft`, `frame`, `metal`, `glass`, `ceramic` or `planting` | What a node is made of: a role, never a colour. `<nodeId>` must name something in the block (a view element's id, a ref's target, or a definition key). |

The `catalog:` keys follow the `parti:` keys that Parti's block library uses, and the `mat:` roles are the same table Parti uses.

**Note keywords.** `catalog:note` stays free text for people, but the tools read these keywords in it (`tools/lib/note.mjs`). A keyword stands anywhere in the text, set apart by a space, a comma or a full stop. The grammar, as [`docs/drafting-standard.md`](drafting-standard.md#2-dimensions-heights-and-note-keywords) §2 states it:

```text
<height keyword> <metres>      at | ceiling | seat | rim | top | bottom | underside, then metres with two decimals: "seat 0.45"
overlap <nodeA>+<nodeB>        two node names joined by "+", no spaces: "overlap carcass+kick"
<marker>                       recess | carcass | slab | swing, as a whole word
```

`at` and `ceiling` name the grounds of [§9](#9-limits-and-why)'s connectivity check, every height must be an exposed face of the body (a top face for `seat`, `rim`, `top` and `ceiling`, a bottom face for `bottom`, `underside` and `at`) and is written with two decimals, `recess` allows a body below the floor, `carcass` and `slab` waive the volume ratio, `swing` leaves a block's arcs out of the plan check (a door swing drawn outside the body), and `overlap` lets `parity.mjs --build --mesh` accept an interpenetrating pair. What each keyword means is the standard's §2.

A marker counts wherever it stands as a whole word, prose included: a note that says "the carcass" waives the volume ratio. Write the word only when you mean it.

## 8. What Floorkit repairs, and what the catalog rejects

Floorkit's parser normalises as much as it validates. That is reasonable for an SDK loading whatever it is handed, but wrong for a shared catalog: a block that was silently repaired draws something its file does not say. So **the catalog rejects anything Floorkit would have to repair**.

`tools/parity.mjs` holds the other half of the bargain. Measured with `parity.mjs --build --mesh` against Floorkit main `b0a084c7`, on the 80 blocks of this catalog:

- 80 of 80 are accepted;
- 80 of 80 are unrepaired (Floorkit changes none of their authored values);
- 15 of 15 kernel-reject fixtures are refused;
- 80 of 80 are built by the real kernel, and 80 of 80 built mirrored (`scale [-1, 1, 1]`);
- 80 of 80 have a clean mesh: closed, consistently wound, outward single shells, with no interpenetration that `catalog:note` does not list.

| Input | Floorkit does | Evidence | The catalog |
| --- | --- | --- | --- |
| An unknown key at any level: a cylinder's `segments`, an arc's `endAngle`, a root `propertySets` | Drops it | *measured*; `:833-859` | Rejects it: every object is closed. |
| A missing size (`dimensions`, a cuboid's `width`, …) | Uses 1 m | *measured*; `:476-485`, `:615-624` | Requires it. |
| An unknown or missing `type` | Uses `FURNITURE` | *measured*; `:300-304` | Requires one of seven types. |
| `type: "WALL"` (or any other Floorkit element type outside the seven) | Keeps it | *measured* | Rejects it. |
| A size below 0.01 m | Raises it to 0.01 | *measured*: 0.006 became 0.01 | Rejects it (minimum 0.01). |
| `version: 2` | Ignores it, and writes `1` | *measured*; `:838-839` | Requires exactly `1`. |
| An arc without `sweepAngle` | Draws a full circle (2π) | *measured*; `:579` | Requires `sweepAngle`, and requires it to be ≠ 0. |
| A colour written as `#abc`, `0xff0000`, bare hex or a number | Accepts it | *measured*; `toColorNumber`, `:1270-1294` | Accepts only `#rrggbb`. |
| A view node with no `id` | Invents `<kind>-<n>` | *measured*; `:805-831` | Requires `id`. |
| A non-numeric or non-finite coordinate | Uses 0 | *measured*; `:487-520` | Rejects it. |
| A non-string metadata value | Converts it with `String()`, so an object becomes `"[object Object]"` | *measured*; `:337-347` | Accepts strings from a closed vocabulary only. |
| A missing `id` or `labelName` | Generates `op-asset-…` or uses `"Generic Element"` | *read*; `:840-845` | Requires both. |
| A missing or empty view | Draws a fallback rectangle or cuboid | *read*; `:1475-1507` | Requires both views, with 1–400 elements each. |
| A non-identity root placement | Applies it, ignoring a root `anchor` | *read*; `:2438`, `:2474-2479` | Requires the identity. |
| A placement with parts missing | Fills them with defaults | *measured*; `:306-335` | Requires `position`, `rotation` and `scale`. |
| A polygon with 1 or 2 vertices | Accepts it | *measured* (2 vertices); `:487-502` | Requires at least 3. |
| A point with extra coordinates | Ignores them | *read*; `:487-520` | Requires exact length. |
| Size and complexity | No limits of any kind | *read* | See [§9](#9-limits-and-why). |

Some inputs Floorkit itself refuses. The catalog refuses each of them too: [`test/fixtures/kernel-rejects/`](../test/fixtures/kernel-rejects/) holds one fixture per case, and `test/op.test.mjs` checks every one.

- an unknown `kind`;
- a ref that also has a `kind`;
- a ref to nothing;
- a ref to the wrong kind;
- a ref to a prototype member;
- a cycle;
- a by-reference sweep without `profileRef`;
- an offset of a polygon;
- a polygon without vertices;
- an unreadable colour;
- an anchor that is not an object;
- ports given as an object;
- duplicate port ids;
- an unknown port domain;
- an unknown port shape.

## 9. Limits, and why

Floorkit has no size or complexity limits. A catalog serves files to people who did not write them, so it needs some.

| Limit | Value | Checked by |
| --- | --- | --- |
| File size | 256 KB (262,144 bytes) | `op.mjs`, before parsing |
| Nodes: `profileView` + `modelView` + `definitions` | 400 | `op.mjs` |
| Elements per view | 400 | schema |
| Points per list | 1,024 | schema |
| Nodes built once references are expanded | 1,000 | `op.mjs` |
| Ports | 64 | schema |
| Operands per boolean | 16, no repeats | schema |
| Numeric ranges | per field, as in [§1](#1-units-and-coordinates), [§3](#3-nodes) and [§6](#6-ports) | schema |

**Byte and node caps.** The 256 KB and 400-node caps are the ones Parti's marketplace profile uses. They leave plenty of room: the largest block, `floorkit.cot`, is 22,690 bytes with 63 nodes, and no point list in `blocks/` has more than 20 points.

**Why expanded nodes are counted (2^n).**

- Floorkit validates references in linear time, because its validation resolver caches what each definition resolves to (`:1082`).
- **Building** does not cache: every use of a definition builds that definition's whole subtree again (`createObject`, `:1797-1801` and `:1851-1870`).
- Take a chain of `boolean3d` definitions in which each level uses the previous one as both base and operand. It validates instantly, but n levels build about 2^n solids.

Measured in two runs in the same Linux sandbox, against Floorkit `681e4f1` with kernel 2.0.16, with `union` at every level (timings are machine-dependent; not run again at `b0a084c7`):

| Levels | Parse | Construct, run 1 | Construct, run 2 |
| --- | --- | --- | --- |
| 6 | under 1 ms | 379 ms | 613 ms |
| 8 | under 1 ms | 1,051 ms | 990 ms |
| 10 | under 1 ms | 4,424 ms | 4,179 ms |

From 8 to 10 levels the construction time grew about fourfold in both runs, as two more doublings predict; the shorter chains are too noisy to show the trend. The catalog therefore counts the nodes a block would build, counting each definition once per use, and refuses more than 1,000. `test/op.test.mjs` checks that a 22-level chain, which would build about 4 million solids, is refused.

**Geometry gates.** `op.mjs` also holds the body to the [drafting standard](drafting-standard.md), from the JSON alone (`tools/lib/geometry.mjs`), so CI runs them. Each solid is reduced to its bounding box with every rotation, scale and ref placement applied; a boolean counts as its base. Each failure names the node and the two numbers that disagree.

| Gate | Rule | Tolerance |
| --- | --- | --- |
| Dimensions | The body's extent in x, y and z equals `width`, `height` and `depth` | 0.005 m |
| Floor | No solid goes below `y = 0`, unless the note says `recess` | 0.001 m |
| Plan | The plan's polygons, polylines, offsets and arcs span the body's x and z extent; an arc is bounded by its ends and the axes it crosses. A `DOOR` or `WINDOW`, or a block whose note says `swing`, leaves its arcs out (a swing draws outside the body). A positive `offset2d` distance lies to the left of its source's direction (x right, z up), so an inner line stays inside | 0.005 m |
| Connected | Every solid reaches a ground through solids whose boxes touch: the floor, the wall plane at the `wallFace` anchor, the ceiling at `ceiling <m>`, the counter at `at <m>` | 0.001 m |
| Level of detail | A block with `catalog:lod` `300` (and only such a block) has at least 3 solids, filling under 95 % of their bounding box; `carcass` or `slab` in the note waives the ratio only. A boolean's volume is its base's; a union's is its base's plus its operands' | 0.95 |
| On the body | Every anchor and port lies on a solid's box surface; only `base` and `wallFace` may instead stand on the floor under the body | 0.005 m |
| Heights | `seat`, `rim`, `top` and `ceiling` are an exposed top face, `bottom`, `underside` and `at` an exposed bottom face (one no other solid wholly covers); a height keyword needs two decimals | 0.005 m |
| Materials | Every model node has a `mat:` role; a ref may take its definition's | none |
| Full cylinders | A cylinder's `angle`, if given, is a full turn: Floorkit mirrors only the centre of a partial cylinder | 0.0001 rad |
| `catalog:lod` | `300` for a `floorkit` block (the schema requires the key on every block) | none |
| Anchors | Every anchor name and role is in the drafting standard's table (§7) | none |
| Ports | Every port's id, domain, `systemType`, direction, profile and size is in the standard's table (§8); the five data-centre blocks (`chiller`, `crah`, `pdu`, `rear-door-heat-exchanger`, `ups`) keep their own port ids | none |
| IFC | Every block sets `ifc:class`; a block with a port or of type `MEP_EQUIPMENT`, other than a `DOOR` or `WINDOW`, also sets `ifcClass` to the same value, and no other block sets it | none |

These run after the reference and limit checks pass, on every block. A surface is a box face, so the on-the-body gate is exact for cuboids and lenient for cylinders and rotated parts.

**Other checks**, which are plain-data rules rather than size limits:

- every number must be finite: `1e400` parses to `Infinity`;
- no key may exist on `Object.prototype`, so `__proto__`, `constructor` and the like are refused;
- the file must be in canonical bytes ([§10](#10-canonical-bytes)).

## 10. Canonical bytes

A block file has exactly one acceptable byte form. Parse the file, then serialise it again:

```js
JSON.stringify(definition, null, 2) + "\n"
```

The file's text must equal the result character for character (`formatBlock` in [`tools/lib/op.mjs`](../tools/lib/op.mjs)). In practice that means:

- two-space indentation;
- LF line endings;
- exactly one final newline;
- no byte-order mark;
- **keys in the order you wrote them**: the rule does not sort keys;
- numbers as JavaScript prints them, so `1.0` becomes `1` and `0.50` becomes `0.5`;
- no duplicate keys. `JSON.parse` keeps the last one, so a duplicate can never survive the round trip.

To produce canonical bytes:

```sh
node tools/format.mjs path/to/block.op
```

[`tools/format.mjs`](../tools/format.mjs) changes formatting only. It strips a byte-order mark, and where a key is duplicated it keeps the last value, as `JSON.parse` does. Check the diff before committing.

**Why:**

- `index.json` records each block's `sha256` over its raw bytes, so a block must have one byte form.
- `.gitattributes` marks `blocks/**/*.op` as `-text` so that git never rewrites line endings.
- The index also records a `contentHash`: SHA-256 over the canonical JSON, with keys sorted at every depth and no whitespace. That is the same algorithm as Parti's `hash.ts`, and it does not depend on formatting. See [`schema/index/v1.schema.json`](../schema/index/v1.schema.json).

## 11. Advisory notes

These are facts about Floorkit at `b0a084c7` that no block can change. Write blocks, and tools, with them in mind.

**`hosted` is metadata only.**

- `catalog:placement: "hosted"` says that a door or window belongs in a wall. Floorkit never cuts a wall for an `.op` element.
- In Floorkit's `BuildingModel`, "an OPBase relation resolves to a placement transform and never to a boolean" (*read*, `projects/building/model.ts:8-9`). Its troubleshooting guide (`docs/floorkit/troubleshooting.mdx:62-66`) says a door cuts its wall only as an entry in that wall's `openings`, and that "A door in `unhostedOpenings` is a free door and cuts nothing."
- An application that wants the hole has to make it. Parti adds its own `WallOpening`. Floorkit reads neither `catalog:placement` nor `catalog:defaultSill`.

**IFC export reads the block's class on one path and the legacy key on another** (*read* in `exporter/semantic-ifc/SemanticIfcExtractor.ts` at Floorkit main `b0a084c7`; the class of each path *measured* there with ported, MEP and door probes). Floorkit chooses the export path from the block's `type` and from whether it has ports:

| Block | Export path | Class in the request | Lines |
| --- | --- | --- | --- |
| `DOOR` (with or without ports) | Floorkit's native door | none; a door at the native defaults, 0.9 m × 2.1 m | `:265`, `:813-834` |
| `WINDOW` (with or without ports) | Floorkit's native window | none; a window at the native defaults, 1.2 m × 1.2 m, sill 0.9 m | `:267`, `:836-860` |
| `MEP_EQUIPMENT`; or `FURNITURE`, `FIXTURE`, `APPLIANCE` or `LANDSCAPE` with at least one port | distribution equipment, with its ports | `metadata.ifcClass`, else a data-centre default, else `IfcDistributionElement` | `:271-279`, `:383-400` |
| `FURNITURE`, `FIXTURE`, `APPLIANCE` without ports | freeform | `ifc:class`, else `IfcFurnishingElement` | `:862-866`, `:1023-1031` |
| `LANDSCAPE` without ports | freeform | `ifc:class`, else `IfcBuildingElementProxy` | `:1023-1031` |

What follows from that table:

- **A `DOOR` block does not export its own geometry or size.** It goes through Floorkit's native door path, which reads native door properties that an `.op` element does not have.
- **`ifc:class` is read on the freeform path**, through the element's `ifcClass` getter, which takes `ifc:class` and falls back to the legacy key (`generic-element.ts:2018-2022`, added after `681e4f1`).
- **The distribution path reads only the legacy `ifcClass`.** Measured: a ported block with `ifc:class` alone exports as `IfcDistributionElement`; with both keys, as its own class. So a block with a port, or of type `MEP_EQUIPMENT`, sets `ifcClass` equal to `ifc:class`, and no other block sets it ([§9](#9-limits-and-why); [drafting standard §9](drafting-standard.md#9-ifc-class)). `ifc:predefinedType` is not read on either path.
- **`IfcFurnishingElement` is deprecated for direct use in IFC4**, according to [buildingSMART's IFC4 ADD2 documentation](https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifcfurnishingelement.htm). That statement comes from the project's research notes; the page could not be re-read for this document, so treat it as unverified. A block avoids the fallback by setting `ifc:class`.

**Property sets cannot live in a v1 file.**

- `OpenElementConfig` has a runtime `propertySets` field, but the parser never reads one from a file and the serialiser never writes one (`:1253-1268`; *measured*: dropped on parse). The catalog rejects the key.
- Root `metadata` does not reach IFC either: Floorkit's `Pset_Floorkit` carries only primitive top-level values (*read*).
- Property sets come from the application at run time.

**A placed block may be mirrored or scaled, not stretched.** In a building model, a block's scale has one size on all three axes; X or Z may be negative, which mirrors the block, and Y stays positive. Anything else is refused as `bad-scale` (*read*, `projects/building/validate.ts:813-829`; `docs/floorkit/guides/place-furniture.mdx:124-145`). Floorkit builds a mirrored block as mirrored data under a positive scale (`generic-element.ts:2438-2442`). `parity.mjs --build` builds every block mirrored (§8); a block authored to be stretched along one axis cannot be placed.

**A section or an elevation draws the body, in projection.** A plan draws each block's plan symbol; a section or an elevation draws its 3D body, mirrored or scaled as placed, and the section line does not cut it: no cut line and no poché (*read*, `docs/floorkit/guides/place-furniture.mdx:174-184`; `getPhysicalParts`, `generic-element.ts:2153-2160`). Measured with [`examples/demo.mjs`](../examples/demo.mjs): at `b0a084c7`, Floorkit refuses to draw 19 blocks in a section or an elevation (`NOT_DRAWN` in that script). 15 fail with "Legacy planar body: requires upright proper world placement of one positive scale size", and 4 with "Physical cylinder: only an original full cylinder is certified". The same blocks pass parity, and draw in a plan.

**Not checked by `validate.mjs`.** This failure only shows when the block is built ([§4](#4-definitions-and-references)):

- arrangements of solids the kernel's booleans do not cover.

`validate.mjs` does compare `dimensions` with the geometry, and the plan with the body ([§9](#9-limits-and-why)), but from bounding boxes only.

## 12. A complete example

This block is [`test/fixtures/valid/chair.op`](../test/fixtures/valid/chair.op) cut down:

- the `id` is `example.simple-chair` rather than `fixture.chair`;
- the root `placement` is dropped;
- the leg symbols are taken out of the plan (the seat and backrest cover them);
- the four leg cuboids are replaced by one `leg` definition that four refs place, so the four legs' `mat:` keys become one.

It passes `node tools/validate.mjs` as it stands, geometry gates included: its `dimensions` are the body's extent (0.52 × 0.94 × 0.48 m), its plan lies under the body, and `seat 0.52` is the seat's top face. Floorkit main `b0a084c7` parses it with nothing repaired, builds it and its mirror, and `parity.mjs --build --mesh` finds the mesh clean (*measured*).

Outside `blocks/`, a file is judged on its content alone. To publish it, its `id` would have to match a path under `blocks/` and a listed publisher.

```json
{
  "version": 1,
  "id": "example.simple-chair",
  "labelName": "Simple Chair",
  "type": "FURNITURE",
  "dimensions": {
    "width": 0.52,
    "depth": 0.48,
    "height": 0.94
  },
  "metadata": {
    "catalog:version": "1.0.0",
    "catalog:license": "CC-BY-4.0",
    "catalog:attribution": "Vishwajeet Mane",
    "catalog:category": "seating",
    "catalog:placement": "free",
    "catalog:lod": "300",
    "catalog:tags": "chair, dining",
    "catalog:note": "seat 0.52",
    "catalog:basedOn": "Drafting standard key dimensions (practice, Neufert / Metric Handbook), unverified",
    "ifc:class": "IfcFurniture",
    "ifc:predefinedType": "CHAIR",
    "mat:seat": "surface",
    "mat:backrest": "surface",
    "mat:leg": "frame"
  },
  "anchors": {
    "base": {
      "placement": {
        "position": [
          0,
          0,
          0
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "metadata": {
        "role": "floor-contact"
      }
    },
    "seatCenter": {
      "placement": {
        "position": [
          0,
          0.52,
          0
        ],
        "rotation": [
          0,
          0,
          0
        ],
        "scale": [
          1,
          1,
          1
        ]
      },
      "metadata": {
        "role": "seating-point"
      }
    }
  },
  "definitions": {
    "leg": {
      "kind": "cuboid",
      "color": "#5A5A5A",
      "center": [
        0,
        0.23,
        0
      ],
      "width": 0.06,
      "height": 0.46,
      "depth": 0.06
    }
  },
  "profileView": {
    "elements": [
      {
        "id": "seat",
        "kind": "polygon",
        "color": "#D8D8D8",
        "vertices": [
          [
            -0.26,
            -0.24
          ],
          [
            -0.26,
            0.24
          ],
          [
            0.26,
            0.24
          ],
          [
            0.26,
            -0.24
          ]
        ]
      },
      {
        "id": "backrest",
        "kind": "polygon",
        "color": "#C6C6C6",
        "vertices": [
          [
            -0.24,
            -0.24
          ],
          [
            -0.24,
            -0.18
          ],
          [
            0.24,
            -0.18
          ],
          [
            0.24,
            -0.24
          ]
        ]
      }
    ]
  },
  "modelView": {
    "elements": [
      {
        "id": "seat",
        "kind": "cuboid",
        "color": "#D8D8D8",
        "center": [
          0,
          0.49,
          0
        ],
        "width": 0.52,
        "height": 0.06,
        "depth": 0.48
      },
      {
        "id": "backrest",
        "kind": "cuboid",
        "color": "#C6C6C6",
        "center": [
          0,
          0.73,
          -0.21
        ],
        "width": 0.48,
        "height": 0.42,
        "depth": 0.06
      },
      {
        "id": "leg-front-left",
        "ref": "leg",
        "placement": {
          "position": [
            -0.22,
            0,
            0.2
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "scale": [
            1,
            1,
            1
          ]
        }
      },
      {
        "id": "leg-front-right",
        "ref": "leg",
        "placement": {
          "position": [
            0.22,
            0,
            0.2
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "scale": [
            1,
            1,
            1
          ]
        }
      },
      {
        "id": "leg-back-left",
        "ref": "leg",
        "placement": {
          "position": [
            -0.22,
            0,
            -0.2
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "scale": [
            1,
            1,
            1
          ]
        }
      },
      {
        "id": "leg-back-right",
        "ref": "leg",
        "placement": {
          "position": [
            0.22,
            0,
            -0.2
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "scale": [
            1,
            1,
            1
          ]
        }
      }
    ]
  }
}
```

What to notice in the example:

- **Seat and backrest** appear in both views under the same ids, as plan polygons and as model cuboids.
- **The legs.** The `leg` cuboid is authored around the origin. Each ref moves it into place, and in `modelView` a ref's placement is applied on top of the definition's own ([§4](#4-definitions-and-references)).
- **`mat:leg`** names the definition key, so all four refs take that role; `mat:seat` and `mat:backrest` name view elements.
- **Anchor roles** come from the closed table of the drafting standard: `base` is `floor-contact`, `seatCenter` is `seating-point`.
- **There is no root `placement`.** It is optional; when present it must be the identity.

## 13. Checking a block

The tools need Node 22 or later. Install once, then validate:

```sh
npm ci
node tools/validate.mjs path/to/block.op   # content only, for a file outside blocks/
node tools/format.mjs path/to/block.op     # rewrite into canonical bytes
node tools/validate.mjs                    # every block under blocks/, paths included
npm run check                              # tests, validation and the index check; CI runs the same three
```

Run with no arguments, `validate.mjs` also checks every file under `blocks/` against its place:

- it must be at `blocks/<publisher>/<slug>/<x.y.z>.op` and be a regular file, not a symbolic link;
- its `id` must be `<publisher>.<slug>`;
- `catalog:version` must equal the file name;
- the publisher must be listed in `publishers.json`.

A file you name on the command line is held to these rules too when it is under `blocks/`: a misplaced file or a symbolic link there is reported, not judged on its content alone. Run `node tools/validate.mjs` with no arguments before opening a pull request, so every file is checked.

A failure prints the file's path relative to the repository root, then one JSON pointer and message per problem, and exits with code 1. For example, a copy of the example above saved as `my-chair.op` at the repository root, with four mistakes in it (`type` set to `WALL`, a `segments` key added to `leg`, and the seat's `color` written `#abc` and its `height` 0.006):

```text
INVALID my-chair.op
        /type  must be equal to one of the allowed values (FURNITURE, FIXTURE, APPLIANCE, LANDSCAPE, MEP_EQUIPMENT, DOOR, WINDOW)
        /definitions/leg  must NOT have additional properties "segments"
        /modelView/elements/0/color  must match pattern "^#[0-9a-fA-F]{6}$"
        /modelView/elements/0/height  must be >= 0.01

1 of 1 file(s) invalid.
```

The checks run in this order:

1. byte size;
2. byte-order mark, reserved keys and non-finite numbers;
3. canonical form;
4. the schema;
5. the reference and limit checks, which run only once the schema passes.

A failure at step 1 stops the check, and so does one at step 2 (or a file that is not JSON). Steps 3 and 4 are reported together. Because of that order, fixing one round of errors can reveal the next.

Maintainers with a Floorkit build can also hold the catalog to Floorkit itself:

```sh
FLOORKIT_DIR=<dir containing dist/index.js> node tools/parity.mjs --build --mesh
```

That command is the only check that builds every block with the real kernel, mirrored too, and checks the built solids ([§4](#4-definitions-and-references), [§8](#8-what-floorkit-repairs-and-what-the-catalog-rejects), [§11](#11-advisory-notes)).
