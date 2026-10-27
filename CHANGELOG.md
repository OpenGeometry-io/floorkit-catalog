# Changelog

Notable changes to floorkit-catalog, in the style of [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

- **A catalog release is an annotated git tag `vX.Y.Z`** ([GOVERNANCE.md](GOVERNANCE.md#releases)). Each version section below is one tag.
- **Each block has its own version** as well, in its file name and in `catalog:version`. A changed block is a new file, listed under the release that first contains it.
- **A deprecation is recorded here**, naming the replacement. A revocation is recorded in [`revocations.json`](revocations.json) ([GOVERNANCE.md](GOVERNANCE.md#deprecate-or-revoke)).

## [Unreleased]

## [0.1.0] - not yet tagged

The first release, tagged at the public launch ([docs/LAUNCH.md](docs/LAUNCH.md), item 4).

### Added

#### 80 blocks

Every block is `blocks/floorkit/<slug>/1.0.0.op`, published by `floorkit` (tier `official`), licensed CC BY 4.0 with `catalog:attribution` "Vishwajeet Mane", and drawn by hand to LOD 300 (`catalog:lod` `"300"`) to the [drafting standard](docs/drafting-standard.md). Per category, counted from `index.json`:

| Category | Blocks | Slugs |
| --- | --- | --- |
| `seating` | 8 | `armchair`, `bar-stool`, `bench`, `minimal-sofa`, `office-chair`, `simple-chair`, `sofa-2-seat`, `stacking-chair` |
| `tables` | 7 | `cafe-counter`, `coffee-table`, `dining-table-4`, `meeting-table`, `office-desk`, `round-table`, `table` |
| `beds` | 6 | `bedside-table`, `bunk-bed`, `cot`, `double-bed`, `king-bed`, `single-bed` |
| `storage` | 7 | `bookshelf`, `cabinet`, `chest-of-drawers`, `desk-pedestal`, `filing-cabinet`, `sideboard`, `wardrobe` |
| `kitchen` | 7 | `base-unit-1000`, `base-unit-600`, `corner-base-unit`, `kitchen-counter`, `kitchen-sink`, `tall-unit-600`, `wall-unit-600` |
| `sanitary` | 12 | `basin-accessible`, `bathtub`, `bidet`, `cloakroom-basin`, `shower-enclosure`, `shower-level-access`, `shower-tray`, `urinal`, `wash-basin`, `wc`, `wc-accessible`, `wc-wall-hung` |
| `appliances` | 8 | `cooker`, `dishwasher`, `extractor-hood`, `fridge-freezer`, `hob`, `television`, `tumble-dryer`, `washing-machine` |
| `lighting` | 6 | `ceiling-luminaire-1200`, `downlight`, `floor-lamp`, `pendant-light`, `table-lamp`, `wall-light` |
| `planting` | 3 | `planter`, `potted-plant`, `tree` |
| `vehicles` | 2 | `bicycle`, `parked-car` |
| `equipment` | 10 | `boiler`, `chiller`, `crah`, `hot-water-cylinder`, `pdu`, `photocopier`, `radiator`, `rear-door-heat-exchanger`, `ups`, `water-cooler` |
| `openings` | 1 | `glazed-door` |
| `other` | 3 | `turning-circle-1500`, `wheelchair`, `wheelchair-space` |
| | **80** | |

- **Where they come from.** The catalog was seeded by importing the 26 files of the Floorkit SDK's example catalog. Before this tag, 23 of them were redrawn in place at `1.0.0` to the drafting standard, and three were deleted:
  - `rectangular-bathtub`: `bathtub` absorbs it, and keeps its drain and tap anchors;
  - `wc-and-basin`: a bundle of two fixtures, replaced by the separate WCs and basins;
  - `counter-run`: it was authored to be stretched along x, which a Floorkit building model refuses (`bad-scale`).

  The other 57 blocks are new. The importer that wrote the seeds is not part of this release: a tool that regenerated them would undo the redraw.
- **`catalog:basedOn`** names the standard, data sheet or reference a block's dimensions come from, and says "unverified" where a size was not checked against a published source.
- **Ports and IFC.** 31 blocks have ports. Each of them also sets the legacy `ifcClass`, equal to `ifc:class`, because Floorkit's distribution export reads only that key ([format §11](docs/format-v1.md#11-advisory-notes)).
- **AI assistance.** Every commit that drew or redrew blocks for this release is co-authored by an AI assistant (Claude), as its `Co-Authored-By:` trailer says, and was reviewed against the standard. Whether such content is protected by copyright is unsettled. This is not legal advice.

#### The drafting standard and the authoring skill

- **[docs/drafting-standard.md](docs/drafting-standard.md):** how a block is drawn. The origin and grounds, true heights and the note keywords, the body at LOD 300, overlapping parts, the plan symbol, material roles and colours, the closed tables of anchor names and port ids, the IFC class, a row per category, and where each key dimension comes from.
- **[`.claude/skills/author-block/`](.claude/skills/author-block/SKILL.md):** the order of work from the request to the pull request, for Claude Code or another coding agent, with `starter.op` and the LOD 300 review checklist (`references/lod300-checklist.md`).

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

#### Catalog files

| File | At 0.1.0 |
| --- | --- |
| `publishers.json` | One publisher: `floorkit` (Floorkit), tier `official` |
| `categories.json` | 13 categories, the same list Parti uses; must equal the schema's `catalog:category` enum |
| `revocations.json` | Empty |
| `index.json` | Generated: 80 entries. Each entry has the file's `sha256` (raw bytes) and a `contentHash` (SHA-256 of the canonical JSON, keys sorted, no whitespace) |

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

#### Demo

- **[`examples/demo.mjs`](examples/README.md)** furnishes a two-bedroom flat and a four-desk office on one storey with 43 blocks, and draws a plan, a section and two elevations through Floorkit. It checks the heights, the IFC classes and a save-and-reopen round trip, and needs a Floorkit build.

#### Tests

- **Five `node:test` suites** in `test/`: `op`, `repo`, `loader` (against a local HTTP server), `gates` (the two git gates, in a throwaway repository) and `render` (the mesh check, and `parity.mjs` and `render.mjs` against a Floorkit build).
- **Fixtures:** one valid block, `test/fixtures/valid/chair.op`; 15 definitions under `test/fixtures/kernel-rejects/` that Floorkit's own parser rejects; 19 blocks under `test/fixtures/geometry-rejects/`, each failing its own check; and 2 bodies under `test/fixtures/mesh-rejects/` for the mesh check.
- **Measured:** `npm test` reports 55 tests, 49 passing and 6 skipped. The skipped tests need `FLOORKIT_DIR`.

#### Documentation

- `README.md`, with one picture per category under `docs/images/`; `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE.md` and `AGENTS.md`.
- [RFC 0001](docs/rfcs/0001-catalog-and-loader.md): the catalog and the loader.
- [RFC 0002](docs/rfcs/0002-parametric-families.md): parametric families.
- [RFC 0003](docs/rfcs/0003-plan-line-roles.md): plan line roles.
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
