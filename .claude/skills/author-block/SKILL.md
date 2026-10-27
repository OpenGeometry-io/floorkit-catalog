---
name: author-block
description: Author a floorkit-catalog block (a Floorkit `.op` element definition) from start to pull request. Use when someone asks to add, create, draw, design, contribute or publish a catalog block or `.op` file (a chair, a basin, a door), to add themselves as a publisher, or to make a new version of an existing block.
---

# Author a catalog block

A block is one `.op` JSON file under `blocks/`. This skill is the order of work; the rules live in the repository docs, which win if they disagree with this page:

- [docs/drafting-standard.md](../../../docs/drafting-standard.md): how a block must look: origin, heights, the body at LOD 300, the plan symbol, roles, colours, anchors, ports, IFC, per category.
- [CONTRIBUTING.md](../../../CONTRIBUTING.md): the steps, provenance, licence and sign-off.
- [docs/format-v1.md](../../../docs/format-v1.md): every field, unit and limit.
- [AGENTS.md](../../../AGENTS.md): the non-negotiables for agents.

Run everything from the repository root, with Node 22 or later, after `npm ci`.

## 0. Read the standard

Read [docs/drafting-standard.md](../../../docs/drafting-standard.md) before drawing, and keep its section 10 row for the block's category open: it lists what the plan must show and which parts the body must have. Every question about a height, a role, a colour, an anchor name, a port id or an IFC class is answered there.

**Numbers.** Key dimensions (the overall size and the named heights) come from the standard's key-dimension table ([§11](../../../docs/drafting-standard.md#key-dimensions)) or a source you name in `catalog:basedOn`; a "verify" number may be drawn, and the pull request says it is unverified. Secondary sizes (thicknesses, insets, rails) are yours to choose within the standard's minima and the parts of §10. Stop and ask only for a key dimension with no source.

## 1. Check the request first

Stop and ask before drawing if any of these is true ([CONTRIBUTING.md, Provenance rules](../../../CONTRIBUTING.md#provenance-rules)):

- the geometry would come from manufacturer CAD or BIM files, or a BIM portal. Never copy it. Dimensions from a public data sheet are facts and are fine;
- it is an iconic or named designer piece, or the label would carry a brand name, and the publisher is `community`;
- it is manufacturer content and the publisher is not `verified` with the rights.

## 2. Choose publisher, slug and version

- **Publisher.** The person's own id; if they have not given it, or the name to credit in `catalog:attribution`, ask once. Never add blocks to another publisher's folder.
- **First block?** A new contributor adds themselves to [`publishers.json`](../../../publishers.json) in the same pull request: one entry with exactly `id`, `name`, `tier`, `url`, in the file's 2-space style, `tier` `"community"` and an `https://` url ([CONTRIBUTING.md, Add a publisher](../../../CONTRIBUTING.md#add-a-publisher)). Never set another tier. Until that entry exists, `validate`, `npm run index` and `npm run check` fail on the path; check the block meanwhile as a copy outside `blocks/` (`node tools/validate.mjs /tmp/draft.op`), which checks everything except the path and the publisher.
- **Slug.** Lowercase letters, digits and single hyphens: `stacking-chair`.
- **Version.** A new block is `1.0.0`. For a change to an existing block, see [§9](#9-a-new-version-of-an-existing-block).

The path is identity:

```text
blocks/<publisher>/<slug>/<x.y.z>.op
id                  = "<publisher>.<slug>"
catalog:version     = "<x.y.z>"   (equals the file name)
```

## 3. Start from the starter

```sh
mkdir -p blocks/<publisher>/<slug>
cp .claude/skills/author-block/starter.op blocks/<publisher>/<slug>/1.0.0.op
```

[`starter.op`](starter.op) is a minimal side table drawn to the standard: a top and four legs (one `definitions` entry and four refs) and nothing else, no aprons or rails, so a real table adds the parts its category row lists. It has `catalog:lod` 300, a `mat:` role and palette colour on every part, `base` and `topCenter` anchors with roles, a `top 0.45` height in the note, `mat:leg` once on the definition, and a `catalog:basedOn` to replace. Copy the starter. The blocks under `blocks/floorkit/` are drawn to the same standard, and show what each category's body and plan look like. Replace its `id`, `labelName`, `dimensions`, metadata and geometry; it is just as good to write the file from scratch, since `format.mjs` fixes the layout. Another reference: [format §12](../../../docs/format-v1.md#12-a-complete-example). Never edit a released block; make a new version ([§9](#9-a-new-version-of-an-existing-block)).

## 4. Get units and axes right

[Format §1](../../../docs/format-v1.md#1-units-and-coordinates):

- Lengths in **metres**. Geometry angles (arc, cylinder `angle`) in **radians**. Placement `rotation` in **degrees**.
- Model space is `[x, y, z]`, y up; the block stands on `y = 0` unless it sits on something.
- A plan point `[x, z]` is model `(x, 0, z)`: the second number is model **z**, not y.
- `dimensions`: `width` along x, `depth` along z, `height` along y, equal to the body's overall extent within 0.005 m ([standard §2](../../../docs/drafting-standard.md#2-dimensions-heights-and-note-keywords)); `validate.mjs` checks it, with the plan, the floor and that no part floats ([format §9](../../../docs/format-v1.md#9-limits-and-why)). Seat, rim and underside heights go in `catalog:note` as keywords (`seat 0.45`).
- The origin is the insertion point: on the floor at the centre of the footprint, with the back at −z ([standard §1](../../../docs/drafting-standard.md#1-origin-axes-and-grounds)).
- A placement needs all of `position`, `rotation`, `scale`. A root `placement` is optional and must be the identity.

## 5. Draw both views, then anchors

Each kind's fields and bounds are in [format §3](../../../docs/format-v1.md#3-nodes).

- **`profileView`** (plan symbol): the top-down silhouette of the body as a `polygon`, plus at most two interior lines that read at 1:100, nothing finer than 0.03 m ([standard §5](../../../docs/drafting-standard.md#5-the-plan-symbol)). A full circle is two `arc`s of π each (`sweepAngle: 3.14159265`); one 2π arc does not print.
- **`modelView`** (3D body), at least 3 solids that meet face to face ([standard §3 and §4](../../../docs/drafting-standard.md#3-the-body-at-lod-300)). Recipe per primitive:
  - `cuboid`: `center` is the middle of the box, so a part from `y0` to `y1` has `center[1] = (y0 + y1) / 2` and `height = y1 − y0`. Panels, tops, legs, plinths.
  - `cylinder`: axis along y, `center` at mid-height, always a full turn (no `angle`). For a part lying down set `placement.rotation` to `[90, 0, 0]` (axis along z: a porthole) or `[0, 0, 90]` (axis along x: a wheel), with a radius that gives an even side count ([standard §3](../../../docs/drafting-standard.md#3-the-body-at-lod-300)). Tubular legs are upright cylinders; a round part under radius 0.04 is drawn at true size and builds as a prism.
  - `boolean3d`: only a through-hole (cuboid or cylinder cut by a cuboid or cylinder, the cutter 0.01 past each face) or a cylinder minus a narrower coaxial one exactly as tall as it and level with it. A bowl is a rim plate with a through-hole plus separate thin walls and floor below it. A half cylinder (a full cylinder minus a cuboid) is unverified: a maintainer builds it, mirror included, with `parity.mjs --build --mesh` before it merges.
  - `sweep`: only as in `floorkit.glazed-door` (profile in the x–z plane, path starting vertically).
  - Repeated parts: one entry in `definitions` and one ref per copy, each ref with its own `id` and `placement`.
- Every view node has an `id`, unique within its view. The same id may name a part in both views.
- Every model node has a `mat:` role and the palette colour of that role ([standard §6](../../../docs/drafting-standard.md#6-material-roles-and-colours)): steel or timber legs and rails are `frame`, a shell seat `surface`, upholstery `soft`. Refs take their definition's role: one `mat:<definitionKey>` for all of them. Sizes are at least 0.01 m.
- Reuse geometry through `definitions` and refs ([format §4](../../../docs/format-v1.md#4-definitions-and-references)). Every definition must be used.
- `boolean3d` operands: keep to `cuboid`, `cylinder` or another `boolean3d`. A sweep operand, or an arrangement the kernel does not cover, passes `validate.mjs` and fails only when built.
- **Anchors**: names and roles only from the table in [standard §7](../../../docs/drafting-standard.md#7-anchors); `base` is `floor-contact`; `surface-contact` for an item placed on furniture ([standard §7](../../../docs/drafting-standard.md#7-anchors)). `wallFace` with `wall-contact` for anything placed against a wall. "At its centre" is the centre of that face as drawn.
- **Ports** are optional, for MEP connectors: ids, `systemType`, direction and size from [standard §8](../../../docs/drafting-standard.md#8-ports). A block with a port sets `ifcClass` equal to `ifc:class` ([standard §9](../../../docs/drafting-standard.md#9-ifc-class)).

## 6. Fill in metadata, type and category

Root `metadata` is a closed vocabulary and every value is a string ([format §7](../../../docs/format-v1.md#7-root-metadata); table in [CONTRIBUTING.md step 3](../../../CONTRIBUTING.md#3-fill-in-the-metadata)).

- Required: `catalog:version`, `catalog:license` (exactly `"CC-BY-4.0"`), `catalog:attribution`, `catalog:category`.
- `catalog:category` is one of the 13 in [`categories.json`](../../../categories.json).
- `type` is one of `FURNITURE`, `FIXTURE`, `APPLIANCE`, `LANDSCAPE`, `MEP_EQUIPMENT`, `DOOR`, `WINDOW`. A `DOOR` or `WINDOW` needs `catalog:placement: "hosted"`; every other type `"free"` or nothing.
- Also set: `catalog:lod` `"300"`; `catalog:tags` (lowercase, joined by `", "`, at most 12; the common name, then type and use: `"chair, stacking, dining"`); `ifc:class` and `ifc:predefinedType` from the category's row in [standard §10](../../../docs/drafting-standard.md#10-per-category); `catalog:note` with the height keywords in the grammar of [standard §2](../../../docs/drafting-standard.md#2-dimensions-heights-and-note-keywords) (`seat 0.45`); `catalog:basedOn` naming the dimension source ([standard §11](../../../docs/drafting-standard.md#11-where-the-numbers-come-from)).
- `mat:<nodeId>` gives a role (`surface`, `soft`, `frame`, `metal`, `glass`, `ceramic`, `planting`) to a node that exists.
- `labelName`: 1–80 characters, plain British English, no brand ("Wash Basin").
- If you think a new key is needed, stop: it is a schema change, not part of a block.

## 7. Limits

256 KB per file, 400 nodes, 1,000 nodes once refs are expanded, 1,024 points per list, 64 ports ([format §9](../../../docs/format-v1.md#9-limits-and-why)). The largest block in the catalog, `floorkit.cot`, is 22,690 bytes with 63 nodes; stay near that.

## 8. Format, validate, index, check

```sh
node tools/format.mjs blocks/<publisher>/<slug>/1.0.0.op     # canonical bytes; never an editor's formatter
node tools/validate.mjs blocks/<publisher>/<slug>/1.0.0.op   # repeat until "ok" and "1 file(s) valid."; a fix can reveal the next round
npm run index                                                # regenerates index.json; never hand-edit it
npm run check                                                # tests, every block, index check
```

Re-run `npm run index` after any change to a block or `publishers.json`, and commit `index.json`. `npm run check` must end with `N block(s) valid.` and `index.json is current: N entr(ies).`; quote both in the pull request.

**Parity and render need a Floorkit build.** Anyone with a Floorkit build runs them; CI cannot; a maintainer runs them before merging when the author could not. With a build:

```sh
FLOORKIT_DIR=<Floorkit build> node tools/parity.mjs --build --mesh blocks/<publisher>/<slug>/1.0.0.op    # builds it, and its mirror; checks the solids
FLOORKIT_DIR=<Floorkit build> node tools/render.mjs blocks/<publisher>/<slug>/1.0.0.op          # pictures in renders/<publisher>/<slug>/1.0.0/
```

`parity.mjs` must end with `parity holds.`; a reported overlap is either redrawn or, if [standard §4](../../../docs/drafting-standard.md#4-overlapping-parts) allows it, listed in the note as `overlap <a>+<b>`. Without a build, write in the pull request that the block is not verified in Floorkit and ask a maintainer to run both.

## 8a. Review your own pictures

Open `renders/<publisher>/<slug>/1.0.0/` (or `renders/gallery.html`) and tick every line of [references/lod300-checklist.md](references/lod300-checklist.md) against `plan-1-50.svg`, `plan-1-100.svg`, `iso`, `front`, `side` and `overlay.svg`. Fix and re-render until every line is ticked. The 3D pictures are the kernel's triangles coloured by `mat:` role, not Floorkit's OpenThree viewer.

## 9. A new version of an existing block

Never modify, rename or delete a released block (any file under `blocks/` in a `v*` tag); `node tools/immutable.mjs` fails the pull request. Add a new file beside it ([CONTRIBUTING.md](../../../CONTRIBUTING.md#publish-a-new-version-of-a-block)):

| Bump | When |
| --- | --- |
| MAJOR | An anchor, port or id is removed or renamed, or the footprint or insertion point moves |
| MINOR | Anchors, ports or types are added; or a drawing-only change (a plan line, a body part, a `mat:` or anchor role) that moves no anchor, port or insertion point |
| PATCH | The label, a colour or other metadata |

```sh
cp blocks/<publisher>/<slug>/1.0.0.op blocks/<publisher>/<slug>/1.1.0.op
# edit 1.1.0.op and set "catalog:version": "1.1.0", then step 8
```

If the change fits no row, say so in the pull request.

## 10. Commit and open the pull request

- **Commit only when the person asks.** Stage the block, `index.json`, and `publishers.json` if you added a publisher.
- **Sign-off (DCO).** Every non-merge commit needs `Signed-off-by:` naming the commit's author email (`git commit -s`); `node tools/dco.mjs <base> HEAD` checks it. The sign-off is the human contributor's own certification of the [DCO](https://developercertificate.org/): add it only when they have asked you to, and never in anyone else's name.
- **Pull request.** Use [the template](../../../.github/PULL_REQUEST_TEMPLATE.md):
  - **Summary:** the id and version, for example `your-name.stacking-chair` 1.0.0.
  - **Provenance:** tick where the geometry and dimensions came from; link any data sheet.
  - **AI assistance:** if you, an agent, wrote or changed any part, tick the box and say which parts (geometry, metadata, text) and how they were checked.
  - **Verification:** the `npm run check` output, the `parity.mjs --build --mesh` result or the statement that it was not run, and the ticked checklist.
  - **Pictures:** attach `plan-1-50`, `iso`, `front`, `side` and `overlay` from `renders/` to the pull request. Never commit `renders/`.
  - **Checklist:** tick only what is true. If the commits are not signed off yet, say so.
- One block, or one family of closely related blocks, per pull request.
