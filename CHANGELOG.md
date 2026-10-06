# Changelog

Notable changes to floorkit-catalog, in the style of [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

- **A catalog release is an annotated git tag `vX.Y.Z`** ([GOVERNANCE.md](GOVERNANCE.md#releases)). Each version section below is one tag.
- **Each block has its own version** as well, in its file name and in `catalog:version`. A changed block is a new file, listed under the release that first contains it.
- **A deprecation is recorded here**, naming the replacement. A revocation is recorded in [`revocations.json`](revocations.json) ([GOVERNANCE.md](GOVERNANCE.md#deprecate-or-revoke)).

## [Unreleased]

## [0.1.0] - not yet tagged

The first release. The owner tags it at launch ([docs/LAUNCH.md](docs/LAUNCH.md), item 4), and the date goes here in the last pull request before the tag.

### Added

#### Format and schema

- **`schema/op/v1.schema.json`**: JSON Schema 2020-12 for a block (`.op` v1). It is strict: closed objects, exact-length tuples, per-kind bounds, `#rrggbb` colours, and a closed root `metadata` vocabulary: the listed `catalog:`, `ifc:` and `class:` keys, `mat:<node>`, and the legacy `ifcClass`. The catalog rejects anything Floorkit would silently repair.
- **`tools/lib/op.mjs`**: the rules a schema cannot express.
  - References resolve by own property, to the right kind, with no cycles, and every definition is reachable.
  - Limits: 256 KB, 400 nodes, and 1,000 nodes once references are expanded.
  - Geometry the kernel cannot build: a polygon that encloses no area or crosses itself, a line or sweep without enough distinct points, a sweep used as a boolean operand.
  - No key that exists on `Object.prototype`.
  - One canonical byte form.
- **`schema/index/v1.schema.json`**: the generated index, `"schema": "floorkit.catalog/v1"`.
- **[docs/format-v1.md](docs/format-v1.md)**: the format reference.

#### Catalog files

| File | At 0.1.0 |
| --- | --- |
| `publishers.json` | One publisher: `floorkit` (Floorkit), tier `official` |
| `categories.json` | 13 categories, the same list Parti uses; must equal the schema's `catalog:category` enum |
| `revocations.json` | Empty |
| `index.json` | Generated: 26 entries. Each entry has the file's `sha256` (raw bytes) and a `contentHash` (SHA-256 of the canonical JSON, keys sorted, no whitespace) |

`contentHash` uses the same algorithm as Parti's `hash.ts`. Measured: it reproduces Parti's recorded hash for 26 of 26 of Parti's system blocks.

#### Tools

Node 22 or later. The only dependency is `ajv` ^8.

| Command | What it does |
| --- | --- |
| `npm run check` | `npm test && npm run validate && npm run index:check` |
| `node tools/validate.mjs [file.op ...]` | Validates the whole catalog, or the files given. A file inside `blocks/` is also held to its path |
| `node tools/format.mjs <file.op>` | Rewrites a block into the canonical bytes: 2-space JSON, LF, one final newline |
| `node tools/build-index.mjs [--check]` | The only author of `index.json`. `--check` exits 1 if the file is stale or hand-edited |
| `node tools/immutable.mjs` | Fails if any file under `blocks/` in any `v*` tag was modified or deleted at HEAD, if anything under `blocks/` is a symbolic link, or if the clone is shallow. Prints `NOT ENFORCED` before the first tag |
| `node tools/dco.mjs <base> <head>` | Every non-merge commit needs a `Signed-off-by:` naming its author email |
| `FLOORKIT_DIR=<dir> node tools/parity.mjs [--build]` | Maintainers only: holds every block to a Floorkit build |
| `node tools/import-floorkit-examples.mjs <OpenPlans checkout> [--check]` | The one-off import of the seed blocks, below |

`tools/parity.mjs` needs a Floorkit build, so CI does not run it. Measured against Floorkit built from OpenPlans `681e4f1`:
- accepted 26/26;
- unrepaired 26/26: Floorkit changes none of the authored values;
- kernel-reject fixtures refused 15/15;
- built by the real WASM kernel 26/26.

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
- **It does not verify a signature over the index** yet ([RFC 0001](docs/rfcs/0001-catalog-and-loader.md)).

#### Tests

- **Four `node:test` suites** in `test/`: `op`, `repo`, `loader` (against a local HTTP server) and `gates` (the two git gates, in a throwaway repository).
- **Fixtures:** one valid block, `test/fixtures/valid/chair.op`, and 15 definitions under `test/fixtures/kernel-rejects/` that Floorkit's own parser rejects.
- **Measured:** `npm test` reports 27 tests, 26 passing and 1 skipped. The skipped test hands loaded blocks to Floorkit and needs `FLOORKIT_DIR`. With it set, that test passes for 26 of 26 blocks.

#### Documentation

- `README.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE.md` and `AGENTS.md`.
- [RFC 0001](docs/rfcs/0001-catalog-and-loader.md): the catalog and the loader.
- [RFC 0002](docs/rfcs/0002-parametric-families.md): parametric families.
- [docs/LAUNCH.md](docs/LAUNCH.md): the checklist for going public.

#### Licensing and repository

- **Two licences:** blocks, `index.json` and `test/fixtures/**` are CC BY 4.0, and everything else is Apache-2.0 ([LICENSE.md](LICENSE.md)).
- **`LICENSES/`** holds both licence texts, and [`REUSE.toml`](REUSE.toml) classifies every path for `reuse lint` (REUSE 3.3).
- **`.github/`:**
  - the `validate` workflow: tests, every block, the index, and on pull requests immutability and DCO sign-off; plus `reuse lint`;
  - a pull request template with a provenance section;
  - issue forms for block requests and takedowns;
  - `CODEOWNERS`, which requests reviews only.
- **`.gitattributes`** keeps git from rewriting block files and `index.json`, which are hashed byte for byte.

#### 26 seed blocks

Every block is `blocks/floorkit/<slug>/1.0.0.op`, published by `floorkit` (tier `official`), licensed CC BY 4.0 with `catalog:attribution` "Vishwajeet Mane". They span 10 of the 13 categories.

**Where they come from.**
- **The source** is the Floorkit SDK's example catalog, `examples/src/catalog/assets/` in OpenGeometry-io/OpenPlans, as released in Floorkit v0.6.1 (commit `8a964fb`).
  - The importer reads it out of git, not from the working tree.
  - It refuses any tree but `ea7f7f86cc11e9130934462b1be4e32ef71ca6c6`. That tree is byte-identical on OpenPlans `main` at `681e4f1`.
- **OpenPlans is a private repository,** so the `catalog:basedOn` reference in each block cannot be followed by the public.
- **14 of the 26 source files came from commits authored by an AI assistant.** Whether such content is protected by copyright is unsettled. This is not legal advice.
- **The import is reproducible:** `node tools/import-floorkit-examples.mjs <path/to/OpenPlans> --check` writes nothing, and exits 1 if any block would change. It needs a checkout of the private OpenPlans repository.

**What changed on the way in, for every file.** All of it is in the importer, and is asserted against the source. An unknown key in a source file's metadata or at its top level, or a legacy key on any other kind of node, stops the import, so nothing is dropped silently.
- **`id`** becomes `floorkit.<slug>`. The source id is kept after the `#` in `catalog:basedOn`.
- **Dropped where present:** `catalogCategory`, `catalogId` and `authoringMode`. The path and `catalog:category` say the same now.
- **`note` becomes `catalog:note`.** 13 files have one.
- **Stamped:**
  - `catalog:version` `1.0.0`, `catalog:license` `CC-BY-4.0` and `catalog:attribution` `Vishwajeet Mane`;
  - `catalog:category`, `catalog:placement` (`hosted` for `glazed-door`, `free` for the rest) and `catalog:tags`;
  - `catalog:basedOn` `OpenGeometry-io/OpenPlans@8a964fb:examples/src/catalog/assets/<file>#<sourceId>`;
  - `ifc:class`, and `ifc:predefinedType`, only where the IFC entity is certain;
  - a `mat:<node>` material role for each node the table lists, from the same table Parti uses.
- **Everything else is carried over unchanged:** dimensions, type, placement, anchors, ports and every node apart from the translations in the table below. Measured by comparing each block with its source file in that tree, key by key.

**Per file.** The source files are under `examples/src/catalog/assets/`.

| Block | From | Notes |
| --- | --- | --- |
| `bathtub` | `sanitary/bathtub.op` | None beyond the above |
| `cabinet` | `furnishing/sketch-cabinet.op` | Label "Sketch Cabinet" becomes "Cabinet" |
| `cafe-counter` | `furnishing/cafe-counter.op` | None beyond the above |
| `chiller` | `datacenter/chiller.op` | `segments` dropped from 2 cylinders (`chiller-fan-a`, `chiller-fan-b`). `ifcClass` `IfcChiller` kept |
| `counter-run` | `kitchen/counter-run.op` | None beyond the above |
| `crah` | `datacenter/crah.op` | Label "CRAH-01" becomes "CRAH Unit". Arc `crah-fan`: `endAngle` 6.2831853 becomes `sweepAngle` 6.2831853 (its `startAngle` is 0), and `segments` 24 is dropped. `ifcClass` `IfcUnitaryEquipment` kept |
| `glazed-door` | `openings/glazed-door-assembly.op` | `catalog:placement` `hosted` (a `DOOR`) |
| `hob` | `kitchen/hob.op` | No IFC class: a hob may be gas or electric |
| `kitchen-counter` | `furnishing/kitchen-counter.op` | None beyond the above |
| `kitchen-sink` | `kitchen/sink.op` | None beyond the above |
| `minimal-sofa` | `furnishing/minimal-sofa.op` | None beyond the above |
| `office-desk` | `furnishing/office-desk.op` | `segments` dropped from 2 cylinders (`chair-post`, `chair-base`) |
| `parked-car` | `landscape/car.op` | No IFC class |
| `pdu` | `datacenter/pdu.op` | `ifcClass` `IfcElectricDistributionBoard` kept |
| `planter` | `landscape/planter.op` | `segments` dropped from 3 cylinders (`shrub-left`, `shrub-mid`, `shrub-right`). No IFC class |
| `rear-door-heat-exchanger` | `datacenter/rdhx.op` | `ifcClass` `IfcCoil` kept |
| `rectangular-bathtub` | `furnishing/bed.op` | Renamed: the file is a bathtub, not a bed. Drain height 0.006 becomes 0.01. Source metadata dropped. See below |
| `shower-tray` | `sanitary/shower-tray.op` | None beyond the above |
| `simple-chair` | `furnishing/simple-chair.op` | None beyond the above |
| `table` | `furnishing/sketch-table.op` | Label "Sketch Table" becomes "Table" |
| `tree` | `landscape/tree.op` | `segments` dropped from 2 cylinders (`trunk`, `canopy`) |
| `ups` | `datacenter/ups.op` | `ifcClass` `IfcElectricFlowStorageDevice` kept |
| `wash-basin` | `sanitary/wash-basin.op` | `segments` dropped from 1 cylinder (`bowl`) |
| `washing-machine` | `sanitary/washing-machine.op` | `segments` dropped from 1 cylinder (`door`) |
| `wc` | `sanitary/wc.op` | None beyond the above |
| `wc-and-basin` | `furnishing/wc-fixture.op` | Label "WC Fixtures" becomes "WC and Basin". `segments` dropped from 1 cylinder (`basin-bowl`) |

**Relabels.** Four labels were authoring artefacts, and are replaced: the same four Parti replaced.

**Legacy geometry keys.** Floorkit 0.6 does not read two keys, and the strict schema refuses them. 8 source files had one:
- **`cylinder.segments`:** dropped, 12 occurrences in 7 files. Floorkit already ignored it.
- **An arc's `endAngle`:** becomes `sweepAngle = endAngle − startAngle`, and the arc's `segments` is dropped. One occurrence, in `crah`.

**`rectangular-bathtub`, from `bed.op`.**
- **It is a bathtub, not a bed.** The file's own id is `bathtub-rect-01`, its label is "Rectangular Bathtub", and its type is `FIXTURE`. It is imported as `floorkit.rectangular-bathtub`, category `sanitary`, with `ifc:class` `IfcSanitaryTerminal` and `ifc:predefinedType` `BATH`.
- **It is a different block from `floorkit.bathtub`:**

  | | `bathtub` | `rectangular-bathtub` |
  | --- | --- | --- |
  | Size (width × depth × height) | 1.65 × 0.7 × 0.55 m | 1.7 × 0.75 × 0.6 m |
  | Anchors | `base`, `wallFace` | `drainCenter`, `faucetMount`, `backWall`, `floorContact` |

- **It was generated from an image of unknown origin.** Its source metadata says `"sourceWorkflow": "image-to-op"`.
- **Its source metadata is dropped,** and recorded here instead:

  | Key | Value |
  | --- | --- |
  | `authoringMode` | `generic-op` |
  | `aecoFamily` | `FIXTURE` |
  | `aecoCategory` | `sanitary` |
  | `aecoSubtype` | `bathtub` |
  | `sourceWorkflow` | `image-to-op` |

- **Its 6 mm drain is written as 10 mm.** The cylinder `drain` has height 0.006 in the source and 0.01 here.
  - Floorkit clamps every cylinder height to at least 0.01 m, so the drain was always built 10 mm tall. Writing what Floorkit draws changes nothing on screen, and lets the strict schema hold.
  - Measured: restoring 0.006 makes `tools/parity.mjs` report `REPAIRED … 0.006 became 0.01`.

**`ifcClass` kept on five blocks.** `chiller`, `crah`, `pdu`, `rear-door-heat-exchanger` and `ups` keep the unprefixed `ifcClass` from their source.
- Floorkit 0.6's IFC export reads exactly that key for assets with ports.
- `ifc:class` is set beside it, and validation requires the two to be equal.

<!-- These links resolve once the repository is public and v0.1.0 is tagged. -->
[Unreleased]: https://github.com/OpenGeometry-io/floorkit-catalog/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OpenGeometry-io/floorkit-catalog/releases/tag/v0.1.0
