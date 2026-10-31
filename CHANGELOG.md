# Changelog

Notable changes to floorkit-catalog, in the style of [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

- **A catalog release is an annotated git tag `vX.Y.Z`** ([GOVERNANCE.md](GOVERNANCE.md#releases)). Each version section below is one tag.
- **Each block has its own version** as well, in its file name and in `catalog:version`. A changed block is a new file, listed under the release that first contains it.
- **A deprecation is recorded here**, naming the replacement. A revocation is recorded in [`revocations.json`](revocations.json) ([GOVERNANCE.md](GOVERNANCE.md#deprecate-or-revoke)).

## [Unreleased]

## [0.1.0] - not yet tagged

The first release, tagged at the public launch ([docs/LAUNCH.md](docs/LAUNCH.md), item 4).

### Added

#### 81 blocks

Every block has a `blocks/floorkit/<slug>/1.0.0.op`, published by `floorkit` (tier `official`), licensed CC BY 4.0 with `catalog:attribution` "Vishwajeet Mane", and drawn by hand to LOD 300 (`catalog:lod` `"300"`) to the [drafting standard](docs/drafting-standard.md). Per category, counted from `index.json`:

| Category | Blocks | Slugs |
| --- | --- | --- |
| `seating` | 8 | `armchair`, `bar-stool`, `bench`, `minimal-sofa`, `office-chair`, `simple-chair`, `sofa-2-seat`, `stacking-chair` |
| `tables` | 7 | `cafe-counter`, `coffee-table`, `dining-table-4`, `meeting-table`, `office-desk`, `round-table`, `table` |
| `beds` | 6 | `bedside-table`, `bunk-bed`, `cot`, `double-bed`, `king-bed`, `single-bed` |
| `storage` | 7 | `bookshelf`, `cabinet`, `chest-of-drawers`, `desk-pedestal`, `filing-cabinet`, `sideboard`, `wardrobe` |
| `kitchen` | 7 | `base-unit-1000`, `base-unit-600`, `corner-base-unit`, `kitchen-counter`, `kitchen-sink`, `tall-unit-600`, `wall-unit-600` |
| `sanitary` | 13 | `basin-accessible`, `bathtub`, `bidet`, `cloakroom-basin`, `shower-enclosure`, `shower-enclosure-quadrant`, `shower-level-access`, `shower-tray`, `urinal`, `wash-basin`, `wc`, `wc-accessible`, `wc-wall-hung` |
| `appliances` | 8 | `cooker`, `dishwasher`, `extractor-hood`, `fridge-freezer`, `hob`, `television`, `tumble-dryer`, `washing-machine` |
| `lighting` | 6 | `ceiling-luminaire-1200`, `downlight`, `floor-lamp`, `pendant-light`, `table-lamp`, `wall-light` |
| `planting` | 3 | `planter`, `potted-plant`, `tree` |
| `vehicles` | 2 | `bicycle`, `parked-car` |
| `equipment` | 10 | `boiler`, `chiller`, `crah`, `hot-water-cylinder`, `pdu`, `photocopier`, `radiator`, `rear-door-heat-exchanger`, `ups`, `water-cooler` |
| `openings` | 1 | `glazed-door` |
| `other` | 3 | `turning-circle-1500`, `wheelchair`, `wheelchair-space` |
| | **81** | |

- **Format v2 versions.** 11 of the 80 format 1 blocks also have a `2.0.0.op` drawn on [format v2](docs/format-v2.md), beside their unchanged `1.0.0.op`, and `shower-enclosure-quadrant` is in format v2 only, so `index.json` has 92 entries. The 11 are `basin-accessible`, `bathtub`, `bidet`, `cloakroom-basin`, `shower-level-access`, `shower-tray`, `urinal`, `wash-basin`, `wc`, `wc-accessible` and `wc-wall-hung`.

- **Where they come from.** The catalog was seeded by importing the 26 files of the Floorkit SDK's example catalog. Before this tag, 23 of them were redrawn in place at `1.0.0` to the drafting standard, and three were deleted:
  - `rectangular-bathtub`: `bathtub` absorbs it, and keeps its drain and tap anchors;
  - `wc-and-basin`: a bundle of two fixtures, replaced by the separate WCs and basins;
  - `counter-run`: it was authored to be stretched along x, which a Floorkit building model refuses (`bad-scale`).

  The other 58 blocks are new. The importer that wrote the seeds is not part of this release: a tool that regenerated them would undo the redraw.
- **Six sanitary blocks redrawn inside format v1** (FLO-278), in place at `1.0.0`, before the tag. Each change was drafted by an AI assistant and checked with `validate.mjs`, `parity.mjs --build --mesh` and `render.mjs`:
  - `bathtub`: end panels carry the rim to the floor; the taps are 0.18 apart (180 mm hole centres), with their ports;
  - `bidet`: the rim and bowl are a D ring of two straight sweeps on a pedestal, with no open space under the rim; the bowl centre, `drainCenter` and the waste port move to z 0.095, on one axis;
  - `shower-enclosure`: the riser stands on the valve on its axis and carries the head; the gully sits flush in a hole through the tray floor;
  - `urinal`: the hood steps back above the rim; the plan shows the hood front and the open bowl;
  - `wash-basin`: a rim slab 0.04 thick with rounded front corners over a bowl body, bowl 0.13 deep, on a pedestal from the wall to under the bowl; `drainCenter` moves up to the new bowl floor, and the `dcw` and `dhw` ports to the pedestal's back face;
  - `wc-accessible`: the pan is a D of two straight sweeps, with no crevices; a D seat with a hinge bar replaces the full-width seat back, and the lid pad is gone.
- **`catalog:basedOn`** names the standard, data sheet or reference a block's dimensions come from, and says "unverified" where a size was not checked against a published source.
- **Ports and IFC.** 31 blocks have ports. Each of them also sets the legacy `ifcClass`, equal to `ifc:class`, because Floorkit's distribution export reads only that key ([format §11](docs/format-v1.md#11-advisory-notes)).
- **AI assistance.** The blocks, tools and documents of this release were drafted with an AI assistant (Claude) and reviewed against the standard. The commits up to 2026-10-27 say so in a `Co-Authored-By:` trailer: 24 of the first 25 (the one without is a merge). The commits of 2026-10-31 (FLO-277, FLO-278, FLO-279, FLO-280, FLO-281, FLO-328, FLO-330) carry no trailer, by the owner's rule for that run, and are AI-assisted too; each pull request says which parts the AI drafted. Whether such content is protected by copyright is unsettled. This is not legal advice.
- **Redrawn on format v2 (FLO-280).** `wc`, `wc-wall-hung`, `cloakroom-basin` and `basin-accessible` have a `2.0.0.op` beside their `1.0.0.op`, which stays unchanged:
  - the WC pans are oval outline sweeps, hollowed by a `shell` 0.015 thick whose top is opened by a round cylinder cut; the floor-standing WC stands on an oval pedestal that follows the pan, and each seat is two half rings that meet on the centre line;
  - the basin rims are D-shaped outline sweeps, drawn as two half rims, over a bowl that is a `revolve` of an outline with its 0.012 wall in chords, the waste hole the gap at its axis, filled by a metal waste;
  - overall sizes, anchor names and port ids are as in 1.0.0. Both basins' `drainCenter` anchors moved to the new bowl floors, and the cloakroom basin's `dcw` and `dhw` ports to its thicker rim's underside; the WCs' anchors and ports did not move.
- **Redrawn on format v2 (FLO-281, part A).** `shower-tray` and `shower-level-access` have a `2.0.0.op` beside their `1.0.0.op`, which stays unchanged. Each was drafted by an AI assistant and checked with `validate.mjs`, `parity.mjs --build --mesh` and `render.mjs`:
  - `shower-tray`: the rim is two outline sweeps with outer corners rounded to radius 0.05, meeting on the centre line; the floor plate has a round cut through it, and the gully grating sits in the cut, flush with the floor, no longer proud. `drainCenter` moves down to the floor at 0.025; the `waste` port does not move;
  - `shower-level-access`: the floor finish is let into the floor (`recess`), its face level with the room floor, with the gully flush in a cut; the seat has rounded front corners; the valve moves down to 0.90, inside the 750 to 1000 mm of Approved Document M Volume 2, 5.18(q). `faucetMount`, `dcw` and `dhw` move down with it, and the `waste` port to the gully's underside at −0.010; overall height 2.01. Falls are drawn in plan.
- **Redrawn on format v2 (FLO-280, part B).** `bidet`, `urinal`, `wash-basin` and `wc-accessible` have a `2.0.0.op` beside their `1.0.0.op`, which stays unchanged. Each was drafted by an AI assistant and checked with `validate.mjs`, `parity.mjs --build --mesh` and `render.mjs`:
  - the bidet and accessible WC pans are oval outline sweeps of true arcs, each drawn as two halves with a round bowl between them, over a bowl floor of the full oval, on an oval pedestal or foot set in from the pan; the accessible WC's seat is an oval ring in two halves on a hinge bar. The floor-standing WC (part A) instead uses a shelled pan opened by a cylinder cut; the bidet and the accessible WC use this two-half drum; reviewers accepted both;
  - the urinal's bowl is half-round: its wall a U-shaped outline sweep, its floor a box and a half-round cylinder sector; the hood above stays stepped;
  - the wash basin's rim is a D-shaped outline sweep in two halves over a `revolve` bowl whose outline has its wall in chords, with a metal waste in its centre hole, on a tapered `cone` pedestal;
  - overall sizes, anchor names and port ids are as in 1.0.0. The accessible WC's `flushSide` moved to z 0.05, where the oval's side is straight; the wash basin's `drainCenter` moved to the new bowl floor, its `dcw` and `dhw` ports to the rim's back face, and its `waste` port to the foot of the pedestal.
- **Redrawn on format v2 (FLO-281, part B).** `bathtub` has a `2.0.0.op` beside its `1.0.0.op`, which stays unchanged. An AI assistant drafted it, and it was checked with `validate.mjs`, `parity.mjs --build --mesh` and `render.mjs`. The tub keeps 1.52 x 0.56 inside, now with corners of radius 0.08. It is drawn as a floor slab and two wall halves whose inner faces are outline sweeps with arcs, under a rim of two halves, and the plan's inner line follows the rounded corners. A metal waste sits on the tub floor under `drainCenter`. No anchor or port moves.
- **New block on format v2 (FLO-281, part B).** `shower-enclosure-quadrant` 1.0.0: a quadrant of radius 0.90 in a 0.90 x 0.90 corner. The tray stands on a quarter cylinder sector, with its floor and rim as outline-sweep halves, the gully flush in a hole, and falls drawn in plan. Curved glass forms two fixed panels and a sliding door. An AI assistant drafted it, and it was checked with `validate.mjs`, `parity.mjs --build --mesh` and `render.mjs`.
- **Redrawn as one piece (FLO-330, BIM review 070).** The 11 `2.0.0.op` files and `shower-enclosure-quadrant` 1.0.0 were fixed in place before the tag, so the five bullets above describe their first drawing. Parts that were drawn as two halves or as stacked layers are now one piece, most of them cut with format v2's new outline-sweep through-cut (below), and the seam lines in sections and elevations are gone. Each change was drafted by an AI assistant and checked with `validate.mjs`, `parity.mjs --build --mesh` and `render.mjs`:
  - `wash-basin`, `cloakroom-basin` and `basin-accessible`: each D-shaped rim is one outline sweep less a circle sweep for the bowl opening. The bowls are drawn with true arcs instead of chords: spheres on the axis for the cloakroom and accessible basins, and tori clear of the axis for the wash basin;
  - `bathtub`: the walls and the rim are each one cuboid less the rounded tub opening, with the floor slab inside the walls;
  - `shower-tray`: one rim less a rounded opening 0.79 wide (corners of radius 0.03), the floor plate inside it, and the gully hole a circle sweep; the plan's rim and falls follow the new opening;
  - `shower-enclosure-quadrant` 1.0.0: the tray is one flat slab 0.04 high, with the gully flush in a hole through it, and `drainCenter` moves up to the slab top at 0.04. The sliding door is now drawn in plan;
  - `wc` and `wc-wall-hung`: the seat is one piece, and the pan opening is an oval outline sweep instead of a round cylinder;
  - `wc-accessible`: the pan is one hollow body, a `shell` 0.015 thick less the bowl cut, and the seat is one piece;
  - `bidet` and `urinal`: the bidet's bowl is one ring less a circle sweep, and the urinal's bowl wall runs full height; each bowl floor is set into its bowl wall, the overlap that drafting standard §4 now allows. The urinal's bowl wall arcs are split so that it builds closed when mirrored (kernel OPE-111);
  - the false side lines on the `wc` and `wc-accessible` pans (kernel OPE-112) are gone;
  - overall sizes, anchors and ports are as before, except the quadrant's `drainCenter`. Node ids changed where parts were merged: for example `rimLeft` and `rimRight` are now `rim`, and `seatLeft` and `seatRight` are now `seat`.

  Measured on 2026-10-31 at `cc7a791` against Floorkit `68604c67` (kernel 3.0.0), `parity.mjs --build --mesh` on the catalog: accepted, unrepaired, built, mirrored and mesh clean, 92/92 each; kernel-reject fixtures refused 27/27; `slivers dropped: 2480 triangle(s) in 12 block(s)`; `parity holds.`

#### The drafting standard and the authoring skill

- **[docs/drafting-standard.md](docs/drafting-standard.md):** how a block is drawn. The origin and grounds, true heights and the note keywords, the body at LOD 300, overlapping parts, the plan symbol, material roles and colours, the closed tables of anchor names and port ids, the IFC class, a row per category, and where each key dimension comes from.
- **[`.claude/skills/author-block/`](.claude/skills/author-block/SKILL.md):** the order of work from the request to the pull request, for Claude Code or another coding agent, with `starter.op` and the LOD 300 review checklist (`references/lod300-checklist.md`).
- **A sixth allowed overlap** in the drafting standard's §4 (FLO-330, owner's decision): a bowl floor set into its bowl wall, by no more than the wall's thickness. The `bidet` and `urinal` 2.0.0 use it. An AI assistant drafted the row.

#### Format and schema

- **`schema/op/v1.schema.json`**: JSON Schema 2020-12 for a block (`.op` v1). It is strict: closed objects, exact-length tuples, per-kind bounds, `#rrggbb` colours, and a closed root `metadata` vocabulary: the listed `catalog:`, `ifc:` and `class:` keys, `mat:<node>`, and the legacy `ifcClass`. `catalog:version`, `catalog:license`, `catalog:attribution`, `catalog:category` and `catalog:lod` are required. The catalog rejects anything Floorkit would silently repair.
- **`tools/lib/op.mjs`**: the rules a schema cannot express.
  - References resolve by own property, to the right kind, with no cycles, and every definition is reachable.
  - Limits: 256 KB, 400 nodes, and 1,000 nodes once references are expanded.
  - Geometry the kernel cannot build: a polygon that encloses no area or crosses itself, a line or sweep without enough distinct points, a sweep used as a boolean operand, and any sweep outside the one case modelled on OpenGeometry's `sweep.rs`.
  - No key that exists on `Object.prototype`.
  - One canonical byte form.
- **The geometry gates** (`tools/lib/geometry.mjs`, `tools/lib/note.mjs`, `tools/lib/roles.mjs`) hold every block to the drafting standard from its JSON alone, so CI runs them ([format §9](docs/format-v1.md#9-limits-and-why)): dimensions equal to the body's extent; nothing below the floor unless the note says `recess`; the plan under the body; every solid connected to a ground; at LOD 300, at least 3 solids filling under 95 % of their bounding box; anchors and ports on the body; note heights on exposed faces; a `mat:` role for every model node; full cylinders only; `catalog:lod` `300` for a `floorkit` block; anchor names and roles, and port ids, from the standard's tables; and `ifc:class` on every block.
- **`schema/index/v1.schema.json`**: the generated index, `"schema": "floorkit.catalog/v1"`.
- **[docs/format-v1.md](docs/format-v1.md)**: the format reference, with the Floorkit facts at OpenPlans `main` `b0a084c7` (package 1.2.0).
- **Format v2** ([docs/format-v2.md](docs/format-v2.md), [RFC 0004](docs/rfcs/0004-format-v2.md)): the Floorkit 3.0 node kinds `sphere`, `cone`, `torus`, `revolve`, `shell` (in `definitions`), the cylinder sector (`angle`, `startAngle`) and the outline sweep, with Floorkit's field names and limits. A block opts in with root metadata `"catalog:format": "2"`; without it a block is format 1, and in format 1 the key may only be `"1"`. The root `version` stays `1`. Eleven blocks use it, each in a 2.0.0 version: `basin-accessible`, `bathtub`, `bidet`, `cloakroom-basin`, `shower-level-access`, `shower-tray`, `urinal`, `wash-basin`, `wc`, `wc-accessible` and `wc-wall-hung` (FLO-280, FLO-281).
- **`schema/op/v2.schema.json`** beside v1, as strict and closed. `tools/lib/op.mjs` picks the schema per block and adds the format v2 gates: outlines (arc centres, repeated points, area, crossing), the torus radii, a revolve outline clear of its axis by 0.001 m, an outline sweep straight up, one scale factor per body, and no shell of a revolve or a cylinder sector, also through a boolean or another shell. `tools/lib/geometry.mjs` and `tools/lib/outline.mjs` bound the new kinds for the geometry gates. The format 1 refusal of partial cylinders and of sweeps in booleans stays.
- **An outline sweep as a through-cut** (FLO-330, [format v2 §6.1](docs/format-v2.md#61-an-outline-sweep-in-a-boolean), [the RFC 0004 amendment](docs/rfcs/0004-format-v2.md#amendment-2026-10-31-an-outline-sweep-as-a-through-cut)). Format v2 no longer refuses every outline sweep in a `boolean3d`. A sweep may be in a `subtract` whose base is an outline sweep, a cuboid or a shell of one, when each cut runs through, lies inside the base 0.001 clear, and no straight edge's line comes within 0.001 of the other outline (kernel OPE-108). The subtract's volume now takes off each cut. Also refused, each from a kernel measurement: a cylinder through an outline-sweep base (OPE-107), a revolve in any boolean (OPE-109), an off-axis revolve arc whose circle reaches the axis ([§6.2](docs/format-v2.md#62-revolve-arcs)), and a union as an operand of a subtract. An AI assistant drafted the rule, its fixtures and its tests, and an adversarial review found three cases the kernel refused or meshed open, which the rule now refuses.
- **Each index entry has `format`** (1 or 2), required by `schema/index/v1.schema.json`, which keeps the name `floorkit.catalog/v1` ([RFC 0004](docs/rfcs/0004-format-v2.md#the-index)). Of the 92 entries, 80 are format 1 and 12 are format 2.

#### Catalog files

| File | At 0.1.0 |
| --- | --- |
| `publishers.json` | One publisher: `floorkit` (Floorkit), tier `official` |
| `categories.json` | 13 categories, the same list Parti uses; must equal the schema's `catalog:category` enum |
| `revocations.json` | Empty |
| `index.json` | Generated: 92 entries, for 81 blocks. Each entry has the file's `sha256` (raw bytes) and a `contentHash` (SHA-256 of the canonical JSON, keys sorted, no whitespace) |

`contentHash` uses the same algorithm as Parti's `hash.ts`. Measured when the seeds were imported: it reproduced Parti's recorded hash for 26 of 26 of Parti's system blocks.

#### Tools

Node 22 or later. The only dependency is `ajv` ^8.

| Command | What it does |
| --- | --- |
| `npm run check` | `npm test && npm run validate && npm run index:check` |
| `node tools/validate.mjs [file.op ...]` | Validates the whole catalog, or the files given, geometry gates included. A file inside `blocks/` is also held to its path |
| `node tools/format.mjs <file.op>` | Rewrites a block into the canonical bytes: 2-space JSON, LF, one final newline |
| `node tools/build-index.mjs [--check]` | The only author of `index.json`. `--check` exits 1 if the file is stale or hand-edited |
| `node tools/immutable.mjs` | Fails if any file under `blocks/` in any `v*` tag was modified or deleted at HEAD, if anything under `blocks/` is a symbolic link, or if the clone is shallow. Prints `NOT ENFORCED` before the first tag |
| `node tools/dco.mjs <base> <head>` | Every non-merge commit needs a `Signed-off-by:` naming its author email |
| `FLOORKIT_DIR=<dir> node tools/parity.mjs [--build] [--mesh] [file.op ...]` | Holds blocks to a Floorkit build: accepted and unrepaired; with `--build`, built by the kernel and built mirrored; with `--mesh`, every built node a closed, outward single shell, and no interpenetration that `catalog:note` does not list |
| `FLOORKIT_DIR=<dir> node tools/render.mjs [--baseline=<dir>] [file.op ...]` | Draws each block to `renders/`: two plans through Floorkit's paper emitter, an overlay of the plan on the body, and four 3D views of the kernel's triangles coloured by `mat:` role, plus `renders/gallery.html` |

`parity.mjs` and `render.mjs` need a Floorkit build, so CI does not run them; a maintainer does. Measured against Floorkit built from OpenPlans `main` `b0a084c7` (package 1.2.0), with `parity.mjs --build --mesh` on the 80 blocks:
- accepted 80/80;
- unrepaired 80/80: Floorkit changes none of the authored values;
- kernel-reject fixtures refused 15/15;
- built by the real WASM kernel 80/80, and mirrored 80/80;
- mesh clean 80/80.

`render.mjs` drew 80/80 blocks against the same build. After that run the `catalog:basedOn` text of `glazed-door`, `chiller`, `crah`, `pdu`, `rear-door-heat-exchanger` and `ups` was rewritten (metadata only), and those six blocks were checked again against the same build: accepted 6/6, unrepaired 6/6, built 6/6, mirrored 6/6, mesh clean 6/6, `parity holds.`; `render.mjs` drew 6/6.

`render.mjs` since FLO-330 (BIM review 070): the 3D pictures keep the kernel's normals, so round bodies shade smooth, and a body the kernel meshes coarser than 2 mm is meshed again at 2 mm for the pictures only; the mesh that `parity.mjs` checks is unchanged. The gallery has one card per block at its newest version, with the older version's picture in the "before" column. An AI assistant drafted the change.

#### Reference loader

- **`tools/loader.mjs`**: `openCatalog({ baseUrl, fetch?, maxIndexBytes?, timeoutMs? })`, with `list({ includeRevoked })`, `find(id, version?)` and `load(id, { version })`. It runs in a browser and in Node, and imports nothing.
- **What it refuses:**
  - a path that leaves the catalog root;
  - any redirect;
  - more bytes than the index promised, while streaming;
  - a SHA-256 mismatch;
  - a revoked entry;
  - a file whose `id` or version disagrees with its entry.
- **Errors** are `CatalogError` with `.code` one of `fetch-failed`, `redirected`, `too-large`, `malformed`, `outside-root`, `not-found`, `revoked` or `integrity`.
- **It does not verify a signature over the index** ([RFC 0001](docs/rfcs/0001-catalog-and-loader.md)).
- **`maxFormat`** (default 1) is the highest block format the caller reads. The newest-version pick and `list()` skip entries above it; asking for one by version, or for a block with no readable version, is refused with the code `unsupported-format`. `load()` refuses a file whose `catalog:format` disagrees with its entry (`integrity`).

#### Demo

- **[`examples/demo.mjs`](examples/README.md)** furnishes a two-bedroom flat and a four-desk office on one storey with 43 blocks, and draws a plan, a section and two elevations through Floorkit. It checks the heights, the IFC classes and a save-and-reopen round trip, and needs a Floorkit build.

#### Tests

- **Five `node:test` suites** in `test/`: `op`, `repo`, `loader` (against a local HTTP server), `gates` (the two git gates, in a throwaway repository) and `render` (the mesh check, and `parity.mjs` and `render.mjs` against a Floorkit build).
- **Fixtures:** one valid block, `test/fixtures/valid/chair.op`; 15 definitions under `test/fixtures/kernel-rejects/` that Floorkit's own parser rejects; 19 blocks under `test/fixtures/geometry-rejects/`, each failing its own check; and 2 bodies under `test/fixtures/mesh-rejects/` for the mesh check.
- **Measured:** `npm test` reports 55 tests, 49 passing and 6 skipped. The skipped tests need `FLOORKIT_DIR`.
- **Format v2 fixtures:** 4 valid blocks under `test/fixtures/valid/`: `v2-sampler.op` (an outline sweep, a cylinder sector and a shell of a sphere), `v2-sweep-arc-profile.op` (the Plan047 probe, its arc sense corrected to `counterClockwise: true`), `v2-pedestal.op` (a solid revolve on its axis and a sector from 0.3 rad, not symmetric about x) and `v2-revolve-collinear.op` (a revolve on its axis along two adjacent collinear edges). 12 `kernel-rejects/v2-*.json`, for 27 in all. 6 `geometry-rejects/v2-*.op` and `geometry-rejects/uneven-scale.op`, for 26 in all.
- **Measured after the format v2 change:** `npm test` reports 68 tests, 61 passing and 7 skipped without `FLOORKIT_DIR`; with it, 68 tests, 68 passing.
- **Measured against Floorkit 3.0** (OpenPlans-3.0 `7bc2d595`, kernel 3.0.0), `parity.mjs --build --mesh` on the catalog:

  ```text
  accepted by Floorkit:   80/80
  unrepaired by Floorkit: 80/80
  kernel-reject fixtures refused by Floorkit: 27/27
  built by Floorkit:      80/80
  mirrored by Floorkit:   80/80
  mesh clean:             80/80
  slivers dropped:        0 triangle(s) in 0 block(s)
  parity holds.
  ```

  and on the 4 valid format v2 fixtures:

  ```text
  accepted by Floorkit:   4/4
  unrepaired by Floorkit: 4/4
  built by Floorkit:      4/4
  mirrored by Floorkit:   4/4
  mesh clean:             4/4
  slivers dropped:        240 triangle(s) in 3 block(s)
  parity holds.
  ```

  Each shell node is two shells, the second an inward void. The 6 format v2 geometry-reject fixtures each fail in Floorkit or the kernel: 1 refused by the parser (`bad-sweep`), 5 that fail to build. `render.mjs` drew the valid fixtures. The mesh check drops and counts triangles that collapse under its 0.01 mm weld; the kernel emits them on the side wall of an arc-edged outline sweep. `parity.mjs` prints them as `SLIVERS` lines and a `slivers dropped` total.
- **One scale factor per body, in format 1 too**: `op.mjs` refuses an uneven node `placement.scale`, which Floorkit 3.0 refuses as `bad-scale`; `test/fixtures/geometry-rejects/uneven-scale.op`. No block had one.
- **Outline and shell limits from the review:** every outline segment, the implicit closing line included, is at least 0.001 m; an outline sweep is at least 0.01 m high; at most one run of revolve edges lies on the axis; no shell of a shell. Each rule is set where the kernel was measured to refuse: a 1e-10 m closing line, a 1e-10 m sweep, two axis runs, a shell of a shell.
- **Format v2 fixtures after FLO-330:** a fifth valid block, `v2-sweep-through-cut.op`, and 10 more `geometry-rejects/v2-*.op` for the through-cut rule, the revolve and union refusals and the revolve arcs, for 36 geometry-reject fixtures in all. Measured at `cc7a791`: `npm test` reports 72 tests, 64 passing and 8 skipped without `FLOORKIT_DIR`; with it, 72 tests, 72 passing.
- **A revolve may lie on its axis along one run of straight edges** (a solid revolve), as kernel 3.0.0 builds it (measured); crossing the axis or touching it at a point is refused, as the kernel refuses it. `test/fixtures/valid/v2-pedestal.op` has a solid revolve and an asymmetric sector, measured to mirror onto its reflected box. The shell of a revolve is measured to fail in the kernel (`CoverageGap`).

#### Documentation

- `README.md`, with one picture per category under `docs/images/`; `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE.md` and `AGENTS.md`.
- [RFC 0001](docs/rfcs/0001-catalog-and-loader.md): the catalog and the loader.
- [RFC 0002](docs/rfcs/0002-parametric-families.md): parametric families.
- [RFC 0003](docs/rfcs/0003-plan-line-roles.md): plan line roles.
- [RFC 0004](docs/rfcs/0004-format-v2.md): format v2, the Floorkit 3.0 node kinds. The parametric-family format of RFC 0002 moves to a later format number.
- Format v2 in the drafting standard (§3, §13, §14), `AGENTS.md`, `CONTRIBUTING.md` and the `author-block` skill (step 7a); `starter.op` stays format 1.
- [docs/LAUNCH.md](docs/LAUNCH.md): the checklist for going public.

#### Licensing and repository

- **Two licences:** blocks, `index.json`, `test/fixtures/**` and the pictures in `docs/images/` are CC BY 4.0, and everything else is Apache-2.0 ([LICENSE.md](LICENSE.md)).
- **`LICENSES/`** holds both licence texts, and [`REUSE.toml`](REUSE.toml) classifies every path for `reuse lint` (REUSE 3.3).
- **`.github/`:**
  - the `validate` workflow: tests, every block, the index, and on pull requests immutability and DCO sign-off; plus `reuse lint`;
  - a pull request template with a provenance section;
  - issue forms for block requests and takedowns;
  - `CODEOWNERS`, which requests reviews only.
- **`.gitattributes`** keeps git from rewriting block files and `index.json`, which are hashed byte for byte.

<!-- These links resolve once the repository is public and v0.1.0 is tagged. -->
[Unreleased]: https://github.com/OpenGeometry-io/floorkit-catalog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OpenGeometry-io/floorkit-catalog/releases/tag/v0.1.0
