# Instructions for coding agents

This file is for automated coding agents working in this repository. It is self-contained; [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) and [docs/format-v1.md](docs/format-v1.md) have the detail.

## What this repository is

A catalog of Floorkit `.op` element definitions ("blocks"): plain JSON files, each describing one element (a chair, a basin, a door) with a plan symbol, a 3D body, anchors and optional MEP ports. The repository also holds:
- the JSON Schemas a block and the index are held to;
- the tools that validate blocks and generate `index.json`;
- a reference loader that verifies a block against the index before handing it over.

Blocks are CC BY 4.0. Everything else is Apache-2.0 ([LICENSE.md](LICENSE.md)).

**Authoring a block?** Follow the [`author-block` skill](.claude/skills/author-block/SKILL.md), from choosing the path to the pull request, and draw to [docs/drafting-standard.md](docs/drafting-standard.md): origin, true heights, the body at LOD 300, the plan symbol, roles, colours, anchors, ports and IFC class.

## Layout

| Path | What | Who writes it |
| --- | --- | --- |
| `blocks/<publisher>/<slug>/<x.y.z>.op` | One block version per file | Contributors. Immutable once in a `v*` tag |
| `index.json` | The catalog index, schema `floorkit.catalog/v1` | **Only** `tools/build-index.mjs` |
| `publishers.json` | `[{ id, name, tier, url }]`; tiers `official`, `verified`, `community` | Contributors add themselves at `community`; maintainers change tiers |
| `categories.json` | The 13 categories; must equal the schema's `catalog:category` enum | Maintainers, through an RFC |
| `revocations.json` | `[{ publisher, slug, version, at, reason }]` | Maintainers |
| `schema/op/v1.schema.json`, `schema/op/v2.schema.json`, `schema/index/v1.schema.json` | JSON Schema 2020-12, strict and closed: a block in format 1, a block in format v2 (`"catalog:format": "2"`, the Floorkit 3.0 node kinds), the index | Maintainers |
| `tools/` | CLIs (`validate`, `format`, `build-index`, `immutable`, `dco`, `parity`, `render`) and `loader.mjs` | |
| `tools/lib/op.mjs` | One block: the schema of its format, then references, limits, canonical bytes and the format v2 gates | |
| `tools/lib/geometry.mjs`, `tools/lib/outline.mjs` | The geometry gates: each solid's box, format v2 outlines included | |
| `tools/lib/repo.mjs` | Paths, publishers, ordering | |
| `tools/lib/floorkit.mjs`, `tools/lib/mesh.mjs` | Loading a Floorkit build from `FLOORKIT_DIR`; the mesh check of `parity.mjs --build --mesh` | |
| `tools/lib/pictures.mjs` | The pictures of `render.mjs`: plan overlay, 3D views in Chromium or as SVG | |
| `tools/lib/views.mjs` | The Floorkit section and elevation of `render.mjs`; the card shows the elevation only | |
| `tools/lib/note.mjs` | The keywords a `catalog:note` carries for the tools (`overlap <nodeA>+<nodeB>`) | |
| `tools/lib/catalog-index.mjs` | Building the index | |
| `test/*.test.mjs` | `node:test` suites: `op`, `repo`, `loader`, `gates`, `render` (its Floorkit cases skip without `FLOORKIT_DIR`) | |
| `test/fixtures/` | Valid blocks (format 1, and format v2 as `v2-*.op`), fixtures Floorkit itself rejects (`kernel-rejects/`, format v2 ones as `v2-*.json`), and bodies for the mesh check (`mesh-rejects/`: one it rejects, one it accepts only because `catalog:note` lists the overlap) | |
| `.claude/skills/author-block/` | The authoring skill, its `starter.op` and the LOD 300 review checklist | Maintainers |
| `docs/` | The formats (`format-v1.md`, `format-v2.md`), the drafting standard, the RFCs (`docs/rfcs/`), the launch checklist | |
| `.github/` | The `validate` workflow (jobs `catalog` and `reuse`), the pull request template, issue forms, `CODEOWNERS` | Maintainers |
| `LICENSES/`, `REUSE.toml` | Licence texts, and the licence of every path | |

## Commands

Node 22 or later. The only dependency is `ajv`.

```sh
npm ci
npm run check                            # npm test && npm run validate && npm run index:check
npm test                                 # node --test --test-reporter=spec "test/*.test.mjs"
node tools/validate.mjs [file.op ...]    # whole catalog, or given files (files in blocks/ are also held to their path)
node tools/format.mjs <file.op> [...]    # rewrite into canonical bytes
npm run index                            # node tools/build-index.mjs: regenerate index.json
npm run index:check                      # node tools/build-index.mjs --check: exit 1 if index.json is stale
node tools/immutable.mjs                 # released blocks unchanged; needs full history and tags
node tools/dco.mjs <base> <head>         # every non-merge commit signed off by its author
```

Need a Floorkit build (`parity.mjs` and `render.mjs`). Anyone with a Floorkit build runs them; CI cannot; a maintainer runs them before merging when the author could not.
- `FLOORKIT_DIR=<dir with dist/index.js> node tools/parity.mjs [--build] [--mesh] [file.op ...]` needs a Floorkit build. `--build` also builds each block mirrored and prints `mirrored by Floorkit: N/N`; `--mesh` checks the built bodies and writes `renders/<publisher>/<slug>/<version>/mesh-report.json` (`renders/` is gitignored).
- `FLOORKIT_DIR=<dir with dist/index.js> node tools/render.mjs [--baseline=<dir>] [file.op ...]` renders each block to `renders/<publisher>/<slug>/<version>/` (two plans, a Floorkit section and elevation, an overlay, four 3D views) and `renders/gallery.html`. The section is drawn and checked but not shown on the card: Floorkit draws a block in a section as seen lines, not cut, so it equals the elevation until Floorkit cuts blocks in sections. The 3D views are the kernel's triangles coloured by `mat:` role, drawn by Floorkit's three.js in headless Chromium or as SVG; they are not Floorkit's OpenThree viewer. Say which path it printed.

## Non-negotiables

1. **Never hand-edit `index.json`.** Change the inputs (`blocks/`, `publishers.json`, `revocations.json`), run `npm run index`, and commit the result. `npm run index:check` fails on any hand edit.
2. **Never modify, rename or delete a released block.** A released block is any file under `blocks/` that is in a `v*` tag. A change is a new file with a new version:
   - MAJOR when an anchor, port or id is removed or renamed, or the footprint or insertion point moves;
   - MINOR when anchors, ports or types are added, or for a drawing-only change (a plan line, a body part, a `mat:` or anchor role) that moves no anchor, port or insertion point;
   - PATCH for the label, a colour or other metadata.

   The blocks under `blocks/floorkit/` are drawn by hand to [docs/drafting-standard.md](docs/drafting-standard.md). Before the first `v*` tag one may still change in place at `1.0.0`; from that tag on, this rule holds for them as for any block.
3. **The catalog stays stricter than Floorkit.** Floorkit's parser silently repairs input: it drops unknown keys, fills defaults and clamps sizes. The catalog **rejects** anything Floorkit would repair, so a valid block is drawn exactly as written. Never loosen the schema or `tools/lib/op.mjs` so that a block Floorkit would change becomes valid.
4. **Every change runs `npm run check`** before you call it done. Quote the result, for example `N block(s) valid.` and `index.json is current: N entr(ies).` CI also runs `reuse lint`, the immutability gate and the DCO gate ([CONTRIBUTING.md](CONTRIBUTING.md#what-ci-checks)). If you did not run something, say so.
5. **Parity needs a Floorkit build.** CI cannot run `tools/parity.mjs`, because `@opengeometry/floorkit` is not on npm. Anyone with a Floorkit build runs it; a maintainer runs it before merging when the author could not. Never claim a block or a schema change "works in Floorkit" unless parity was actually run against a Floorkit build. Otherwise say it is unverified.
6. **No new dependencies without a reason.**
   - The tools depend on `ajv` and nothing else; use Node built-ins.
   - `tools/loader.mjs` imports nothing at all, because it must run unchanged in browsers and in Node 22 (`fetch`, streams, WebCrypto).
   - Tests use `node:test` and `node:assert`.
   <!-- REUSE-IgnoreStart -->
7. **Licence headers.** Every file in `tools/` and every test file starts with `// SPDX-License-Identifier: Apache-2.0`, after the `#!/usr/bin/env node` line where there is one. A new file that no pattern in `REUSE.toml` covers (for example a new top-level folder) must be added to it, or `reuse lint` fails. A doc that quotes an SPDX tag, as this line does, must wrap it in `REUSE-IgnoreStart` / `REUSE-IgnoreEnd` comments, or `reuse lint` reads it as the file's own licence.
   <!-- REUSE-IgnoreEnd -->
8. **British spelling** in docs, comments and messages: "licence" as a noun, "license" as the verb and in SPDX ids, "colour", "metres", "authorise". The product word is "catalog".

## Rules that are easy to break

- **Blocks are byte-exact.** A block must equal `JSON.stringify(definition, null, 2) + "\n"`: 2-space JSON, LF, one final newline, no BOM, keys in authored order. Write blocks with `node tools/format.mjs`, never with an editor's own formatter. `.gitattributes` marks blocks and `index.json` as `-text` so that git never rewrites them.
- **Path is identity.** `id` is `<publisher>.<slug>`, `metadata["catalog:version"]` equals the file name, and the publisher must be in `publishers.json`.
- **Root metadata is a closed vocabulary.** Adding a key means changing both block schemas, `docs/format-v1.md`, `docs/format-v2.md` and `test/op.test.mjs` together. Every value is a string.
- **Formats.** A block without `catalog:format` is format 1; `"catalog:format": "2"` makes it format v2. The root `version` is `1` in both. Moving a block to format v2 is a MAJOR version ([RFC 0004](docs/rfcs/0004-format-v2.md)).
- **Units.** Lengths in metres, geometry angles in radians, placement rotations in degrees. A plan point `[x, z]` is model `(x, 0, z)`.
- **The index schema is closed.** A new index field, a 14th category or a new tier breaks existing readers, so it needs an RFC in `docs/rfcs/`. A new major version of a format gets a new schema path beside the old one (`schema/op/v2.schema.json`); v1 is never removed.
- **Tiers and revocations are maintainer decisions.** Do not change a publisher's tier or `revocations.json` unless a maintainer asked for it.

## Where to make a change

| Change | Files |
| --- | --- |
| A structural rule for blocks | `schema/op/v1.schema.json`, `test/op.test.mjs`, `docs/format-v1.md`; for format v2, `schema/op/v2.schema.json` and `docs/format-v2.md` (a rule for both formats changes both schemas) |
| A format v2 kind, or a gate on one | `schema/op/v2.schema.json`, `tools/lib/op.mjs` (`formatTwoIssues`), `tools/lib/geometry.mjs` and `tools/lib/outline.mjs` (boxes), `test/op.test.mjs`, `docs/format-v2.md`, `test/fixtures/kernel-rejects/v2-*.json` |
| A rule a schema cannot express (references, limits, canonical bytes) | `tools/lib/op.mjs`, `test/op.test.mjs` |
| Path, publisher or ordering rules | `tools/lib/repo.mjs`, `test/repo.test.mjs` |
| Index contents | `tools/lib/catalog-index.mjs`, `schema/index/v1.schema.json` (closed: RFC first; `format` came in by [RFC 0004](docs/rfcs/0004-format-v2.md)), `test/repo.test.mjs` |
| The loader | `tools/loader.mjs`, `test/loader.test.mjs` |
| The git gates | `tools/immutable.mjs`, `tools/dco.mjs`, `test/gates.test.mjs` |

## Provenance, when you author a block

- **Never copy geometry or linework** from manufacturer CAD or BIM files or from BIM portals. Dimensions from public data sheets are facts and are fine.
- **Community blocks are generic designs only:** no iconic or named designer pieces, and no brand names in labels.
- **AI-assisted authoring must be disclosed in the pull request.** If you, an agent, wrote or changed a block, say so in the pull request description, and say which parts.

## Git

- **Do not commit or push unless asked.**
- **Every commit needs `Signed-off-by:` naming its author** (`git commit -s`). The sign-off is the human contributor's personal certification of the [Developer Certificate of Origin](https://developercertificate.org/). Add it only when the person you work for has asked you to commit with a sign-off, and never in anyone else's name.
- **`tools/immutable.mjs` reads every `v*` tag.** Run it in a full clone with tags fetched. It fails on a shallow clone instead of passing; only a clone with no `v*` tag at all reports `NOT ENFORCED`.

## Writing docs

- **Say what was measured and what is unverified.** Quote the command and its output for any number you state.
- **Do not invent** facts, email addresses, URLs or version numbers.
- **Keep to the layout and words already used:** short sections, real commands, real paths.
