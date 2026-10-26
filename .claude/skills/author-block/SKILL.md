---
name: author-block
description: Author a floorkit-catalog block (a Floorkit `.op` element definition) from start to pull request. Use when someone asks to add, create, draw, design, contribute or publish a catalog block or `.op` file (a chair, a basin, a door), to add themselves as a publisher, or to make a new version of an existing block.
---

# Author a catalog block

A block is one `.op` JSON file under `blocks/`. This skill is the order of work; the rules live in the repository docs, which win if they disagree with this page:

- [CONTRIBUTING.md](../../../CONTRIBUTING.md): the steps, provenance, licence and sign-off.
- [docs/format-v1.md](../../../docs/format-v1.md): every field, unit and limit.
- [AGENTS.md](../../../AGENTS.md): the non-negotiables for agents.

Run everything from the repository root, with Node 22 or later, after `npm ci`.

## 1. Check the request first

Stop and ask before drawing if any of these is true ([CONTRIBUTING.md, Provenance rules](../../../CONTRIBUTING.md#provenance-rules)):

- the geometry would come from manufacturer CAD or BIM files, or a BIM portal. Never copy it. Dimensions from a public data sheet are facts and are fine;
- it is an iconic or named designer piece, or the label would carry a brand name, and the publisher is `community`;
- it is manufacturer content and the publisher is not `verified` with the rights.

## 2. Choose publisher, slug and version

- **Publisher.** The person's own id. If it is not in [`publishers.json`](../../../publishers.json), append one entry with exactly `id`, `name`, `tier`, `url`, in the file's existing 2-space style; `tier` is `"community"`, `url` is `https://`. Never set another tier, and never add blocks to another publisher's folder ([CONTRIBUTING.md, Add a publisher](../../../CONTRIBUTING.md#add-a-publisher)).
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

[`starter.op`](starter.op) is a valid one-box block. Replace its `id`, `labelName`, `dimensions`, metadata and geometry; for a shape that is not a box it is just as good to write the file from scratch, since `format.mjs` fixes the layout. Larger references: [`test/fixtures/valid/chair.op`](../../../test/fixtures/valid/chair.op) and [format §12](../../../docs/format-v1.md#12-a-complete-example). Do not edit the seed blocks under `blocks/floorkit/`; the importer generates them.

## 4. Get units and axes right

[Format §1](../../../docs/format-v1.md#1-units-and-coordinates):

- Lengths in **metres**. Geometry angles (arc, cylinder `angle`) in **radians**. Placement `rotation` in **degrees**.
- Model space is `[x, y, z]`, y up; the block stands on `y = 0` unless it sits on something.
- A plan point `[x, z]` is model `(x, 0, z)`: the second number is model **z**, not y.
- `dimensions`: `width` along x, `depth` along z, `height` along y. `validate.mjs` does not compare them with the geometry; reviewers do, so make them match.
- The origin is the insertion point.
- A placement needs all of `position`, `rotation`, `scale`. A root `placement` is optional and must be the identity.

## 5. Draw both views, then anchors

Each kind's fields and bounds are in [format §3](../../../docs/format-v1.md#3-nodes).

- **`profileView`** (plan symbol): `polygon`, `polyline`, `arc`, or a ref to a 2D definition. A full circle is an `arc` with `startAngle: 0` and `sweepAngle: 6.2831853`, as in `floorkit.crah`.
- **`modelView`** (3D body): `cuboid`, `cylinder`, `sweep`, or a ref to a solid. A cuboid's and a cylinder's `center` is mid-height.
- Every view node has an `id`, unique within its view. The same id may name a part in both views.
- Colours are `#` plus six hex digits, either case. Sizes are at least 0.01 m.
- Reuse geometry through `definitions` and refs ([format §4](../../../docs/format-v1.md#4-definitions-and-references)). Every definition must be used.
- `boolean3d` operands: keep to `cuboid`, `cylinder` or another `boolean3d`. A sweep operand, or an arrangement the kernel does not cover, passes `validate.mjs` and fails only when built.
- **Anchors** ([§5](../../../docs/format-v1.md#5-anchors)): name the points people attach to (`base`, `wallFace`) and give each `metadata.role` (seeds use `floor-contact`, `wall-contact`, `seating-point`, `work-surface`).
- **Ports** are optional, for MEP connectors ([§6](../../../docs/format-v1.md#6-ports)).

## 6. Fill in metadata, type and category

Root `metadata` is a closed vocabulary and every value is a string ([format §7](../../../docs/format-v1.md#7-root-metadata); table in [CONTRIBUTING.md step 3](../../../CONTRIBUTING.md#3-fill-in-the-metadata)).

- Required: `catalog:version`, `catalog:license` (exactly `"CC-BY-4.0"`), `catalog:attribution`, `catalog:category`.
- `catalog:category` is one of the 13 in [`categories.json`](../../../categories.json).
- `type` is one of `FURNITURE`, `FIXTURE`, `APPLIANCE`, `LANDSCAPE`, `MEP_EQUIPMENT`, `DOOR`, `WINDOW`. A `DOOR` or `WINDOW` needs `catalog:placement: "hosted"`; every other type `"free"` or nothing.
- Optional and common: `catalog:tags` (lowercase, joined by `", "`, at most 12), and `ifc:class` with `ifc:predefinedType` where you are certain (`IfcFurniture` / `CHAIR` in the chair fixture).
- `mat:<nodeId>` gives a role (`surface`, `soft`, `frame`, `metal`, `glass`, `ceramic`, `planting`) to a node that exists.
- `labelName`: 1–80 characters, plain words, no brand.
- If you think a new key is needed, stop: it is a schema change, not part of a block.

## 7. Limits

256 KB per file, 400 nodes, 1,000 nodes once refs are expanded, 1,024 points per list, 64 ports ([format §9](../../../docs/format-v1.md#9-limits-and-why)). The largest seed is 8,474 bytes with 22 nodes; stay near that.

## 8. Format, validate, index, check

```sh
node tools/format.mjs blocks/<publisher>/<slug>/1.0.0.op     # canonical bytes; never an editor's formatter
node tools/validate.mjs blocks/<publisher>/<slug>/1.0.0.op   # repeat until "ok" and "1 file(s) valid."; a fix can reveal the next round
npm run index                                                # regenerates index.json; never hand-edit it
npm run check                                                # tests, every block, index check
```

Re-run `npm run index` after any change to a block or `publishers.json`, and commit `index.json`. `npm run check` must end with `N block(s) valid.` and `index.json is current: N entr(ies).`; quote both in the pull request.

**Parity is maintainer-only.** `FLOORKIT_DIR=<Floorkit build> node tools/parity.mjs --build` is the only check that builds the block with the real kernel; CI cannot run it. Unless it was actually run, write that the block is not verified in Floorkit and ask a maintainer to run it.

## 9. A new version of an existing block

Never modify, rename or delete a released block (any file under `blocks/` in a `v*` tag); `node tools/immutable.mjs` fails the pull request. Add a new file beside it ([CONTRIBUTING.md](../../../CONTRIBUTING.md#publish-a-new-version-of-a-block)):

| Bump | When |
| --- | --- |
| MAJOR | An anchor, port or id is removed or renamed, or the footprint or insertion point moves |
| MINOR | Anchors, ports or types are added |
| PATCH | The label, a colour or metadata |

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
  - **Verification:** the `npm run check` output, how the plan, body, dimensions and insertion point were checked (for example, the bounding box of the solids against `dimensions`), and whether parity was run.
  - **Checklist:** tick only what is true. If the commits are not signed off yet, say so.
- One block, or one family of closely related blocks, per pull request.
