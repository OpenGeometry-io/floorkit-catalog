# Contributing to floorkit-catalog

Thank you for helping. This repository takes two kinds of contribution: **blocks**, which are `.op` files that each describe one element, such as a chair, a basin or a door; and fixes to the tools, the schema and the docs.

| You want to | Read |
| --- | --- |
| Add a block | [What makes a good block](#what-makes-a-good-block), then [Add a block](#add-a-block) |
| Publish for the first time | [Add a publisher](#add-a-publisher) |
| Change a block that is already here | [Publish a new version](#publish-a-new-version-of-a-block) |
| Check what you may contribute | [Provenance rules](#provenance-rules) and [Licence and sign-off](#licence-and-sign-off) |
| Change tools, schema or docs | [Changing tools, schema or docs](#changing-tools-schema-or-docs) |

The format itself is documented in [docs/format-v1.md](docs/format-v1.md). Tiers, releases, revocation and takedowns are in [GOVERNANCE.md](GOVERNANCE.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

**You need Node 22 or later** for the tools (`"engines": { "node": ">=22" }` in `package.json`).

## What makes a good block

A good block is something a designer would place in a plan without checking it first.

- **Generic and self-authored.** You drew it, from your own measurements or public data-sheet dimensions. See [Provenance rules](#provenance-rules).
- **It says exactly what it draws.** The catalog rejects anything Floorkit would silently repair ([format §8](docs/format-v1.md#8-what-floorkit-repairs-and-what-the-catalog-rejects)), so a valid block is drawn as written.
- **Both views agree.** The plan symbol (`profileView`) lies directly under the 3D body (`modelView`). A plan point `[x, z]` is model `(x, 0, z)` ([format §1](docs/format-v1.md#1-units-and-coordinates)).
- **Right units.** Lengths in metres, geometry angles in radians, placement rotations in degrees.
- **A sensible insertion point.** The origin is where the block is placed from. Most blocks stand on `y = 0`; a block that sits on something starts higher (the seed `floorkit.hob` starts at 0.91 m).
- **Honest `dimensions`.** They should match the geometry. `validate.mjs` does not compare them, so reviewers do.
- **Useful anchors.** Name the points people attach to, such as `base` or `wallFace`, and give them a `role` in their metadata ([format §5](docs/format-v1.md#5-anchors)).
- **Material roles.** Say what a node is made of with `mat:<nodeId>` and one of `surface`, `soft`, `frame`, `metal`, `glass`, `ceramic` or `planting`: a role, never a colour. A node's `color` is only how it is drawn.
- **A plain label.** `labelName` describes the object ("Stacking Chair"), in 1–80 characters, with no brand name in the community tier.
- **The right type and category.** A `DOOR` or `WINDOW` has `catalog:placement: "hosted"`. That is metadata only: Floorkit 0.6 never cuts a wall for an `.op` element ([format §11](docs/format-v1.md#11-advisory-notes)).
- **Small.** The limits are 256 KB, 400 nodes, and 1,000 nodes once references are expanded ([format §9](docs/format-v1.md#9-limits-and-why)). The largest seed block is 8,474 bytes with 22 nodes.

## Add a block

### 1. Set up

Fork the repository on GitHub, then:

```sh
git clone https://github.com/<your-login>/floorkit-catalog.git
cd floorkit-catalog
npm ci
git switch -c add-<slug>
```

### 2. Create the file

A block lives at exactly one path:

```text
blocks/<publisher>/<slug>/1.0.0.op
```

- `<publisher>` is your publisher id. If you are new, [add yourself to `publishers.json`](#add-a-publisher) in the same pull request.
- `<slug>` names the block: lowercase letters, digits and single hyphens, for example `stacking-chair`.
- A new block starts at version `1.0.0`.
- The block's `id` must be `<publisher>.<slug>`, for example `your-name.stacking-chair`.

Use [docs/format-v1.md](docs/format-v1.md) (§12 is a complete example) and [`test/fixtures/valid/chair.op`](test/fixtures/valid/chair.op) as references for the structure.

### 3. Fill in the metadata

Root `metadata` is a **closed vocabulary**: a key the schema does not list fails validation, so a typo such as `catalog:licence` cannot pass quietly. Every value is a string.

| Key | Required | What to write |
| --- | --- | --- |
| `catalog:version` | yes | `"1.0.0"`; it must equal the file name |
| `catalog:license` | yes | Exactly `"CC-BY-4.0"` |
| `catalog:attribution` | yes | Who the block credits: your name, or the name you contribute under |
| `catalog:category` | yes | One of the 13 in [`categories.json`](categories.json) |
| `catalog:placement` | for `DOOR` and `WINDOW` | `"hosted"` for a door or window; `"free"` (or nothing) otherwise |
| `catalog:tags` | no | Lowercase, joined by `", "`, at most 12, no repeats |
| `catalog:lod`, `catalog:defaultSill`, `catalog:author`, `catalog:note`, `catalog:basedOn` | no | See [format §7](docs/format-v1.md#7-root-metadata) |
| `ifc:class`, `ifc:predefinedType`, `class:uniclass2015`, `class:omniclass` | no | Only where you are certain |
| `mat:<nodeId>` | no | The material role of a node that exists in the block |

An example for a chair whose nodes include `seat`, `backrest` and `leg-front-left`:

```json
"metadata": {
  "catalog:version": "1.0.0",
  "catalog:license": "CC-BY-4.0",
  "catalog:attribution": "Your Name",
  "catalog:category": "seating",
  "catalog:placement": "free",
  "catalog:lod": "200",
  "catalog:tags": "chair, stacking",
  "catalog:note": "Seat height 450 mm.",
  "ifc:class": "IfcFurniture",
  "ifc:predefinedType": "CHAIR",
  "mat:seat": "soft",
  "mat:backrest": "soft",
  "mat:leg-front-left": "metal"
}
```

This object was checked: placed in a copy of the chair fixture, it passes `node tools/validate.mjs`, and the same file with `catalog:license` misspelt fails with `/metadata  must NOT have additional properties "catalog:licence"`.

### 4. Format, validate and index

```sh
node tools/format.mjs blocks/<publisher>/<slug>/1.0.0.op     # rewrite into the one accepted byte form
node tools/validate.mjs blocks/<publisher>/<slug>/1.0.0.op   # content, plus the rules tied to its path
npm run index                                                # regenerate index.json (node tools/build-index.mjs)
npm run check                                                # the tests, every block, and the index check
```

- **`format.mjs`** writes 2-space JSON with LF line endings and one final newline. It changes formatting only, but a duplicate key keeps its last value, so check the diff.
- **`validate.mjs`** prints `ok` or `INVALID` followed by one JSON pointer and message per problem. Fixing one round of errors can reveal the next, because the reference and limit checks run only once the schema passes ([format §13](docs/format-v1.md#13-checking-a-block)).
- **`npm run index`** must be re-run after every change to any block, `publishers.json` or `revocations.json`, because `index.json` is built from all three and records each file's byte count and SHA-256. **Commit `index.json`**, and never edit it by hand.
- **`npm run check`** is `npm test && npm run validate && npm run index:check`. With no file named, `validate` checks every block against its path and its publisher, which a single named file outside `blocks/` does not get. CI runs more than this; see [What CI checks](#what-ci-checks).

### 5. Commit with a sign-off

```sh
git add blocks/<publisher>/<slug>/1.0.0.op index.json   # and publishers.json, if you added yourself
git commit -s -m "Add <publisher>.<slug> 1.0.0"
git push -u origin add-<slug>
```

`-s` adds the `Signed-off-by:` line. **Every commit needs one**, naming the commit's author email ([Licence and sign-off](#licence-and-sign-off)).

### 6. Open a pull request

Open it against `main` and fill in the template, including:

- **provenance:** where the geometry and the dimensions came from;
- **AI assistance:** whether any part was AI-assisted, and which part.

Keep one block, or one family of closely related blocks, per pull request.

## Add a publisher

If this is your first block, add yourself to [`publishers.json`](publishers.json) in the same pull request:

```json
{
  "id": "your-name",
  "name": "Your Name",
  "tier": "community",
  "url": "https://github.com/<your-login>"
}
```

- **Exactly these four keys.** `id` is lowercase-hyphenated and unique; `url` must be `https://`.
- **New publishers start at tier `community`.** Do not set any other tier yourself.
- **`verified` and `official` are granted by maintainers only**, on the evidence described in [GOVERNANCE.md](GOVERNANCE.md#publisher-tiers).
- **Publish under your own id.** Do not add blocks to another publisher's folder.

The tier is copied into every `index.json` entry for that publisher, which is why changing it is a maintainer decision.

## Publish a new version of a block

**Never edit a released file.** Once a block is in a `v*` tag, its file never changes, never moves and is never deleted: loaders pin to tags, and a tagged URL must always serve the same bytes. `node tools/immutable.mjs` fails any pull request that tries. Before the first tag nothing has been released, so it prints `immutability: NOT ENFORCED …` and passes, unless something under `blocks/` is a symbolic link, which fails at any time.

A change is a new file beside the old one, with a version chosen by semver:

| Bump | When |
| --- | --- |
| **MAJOR** (`2.0.0`) | An anchor, port or id is removed or renamed, or the footprint or insertion point changes in a way that would move instances already placed |
| **MINOR** (`1.1.0`) | Anchors, ports or types are added |
| **PATCH** (`1.0.1`) | The label, a colour or metadata changes |

If your change fits none of these rows, say so in the pull request and a maintainer decides.

```sh
cp blocks/<publisher>/<slug>/1.0.0.op blocks/<publisher>/<slug>/1.1.0.op
# edit 1.1.0.op, and set "catalog:version": "1.1.0"
node tools/format.mjs blocks/<publisher>/<slug>/1.1.0.op
node tools/validate.mjs blocks/<publisher>/<slug>/1.1.0.op
npm run index
npm run check
```

The old version stays in the catalog. A loader that asks for a block without a version gets the newest version that has not been revoked, so a new version reaches those users as soon as they move to a catalog tag that contains it.

## Provenance rules

These rules exist because a catalog can only grant rights its contributors hold. They are the same for every pull request.

1. **Self-authored only.** You drew the geometry yourself.
2. **Facts from public data sheets are fine.** Overall dimensions, clearances and similar measurements are facts. Say where they came from in the pull request.
3. **Never copy geometry or linework from manufacturer CAD or BIM files, or from BIM portals.** Their terms restrict reuse; BIMobject's, for example, as quoted in a search result, limit downloads to "personal use (and not for any commercial purposes)" ([terms](https://business.bimobject.com/terms-of-service-eula); unverified).
4. **Manufacturer content comes only from a verified publisher who holds the rights** ([GOVERNANCE.md](GOVERNANCE.md#publisher-tiers)).
5. **The community tier is for generic designs only.** No iconic or named designer pieces. In the EU, furniture can be protected by copyright and by design law; see the Court of Justice's 2025 ruling on utilitarian objects ([EU IP Helpdesk](https://intellectual-property-helpdesk.ec.europa.eu/news-events/news/cjeu-confirms-utilitarian-objects-are-subject-same-originality-requirements-any-other-work-2025-12-05_en)) and the reformed EU design law's reach to software that records a design ([Hogan Lovells](https://www.hoganlovells.com/en/publications/effects-of-the-eu-design-reform-on-3d-printing)). Both are known from search results only and are unverified here.
6. **No brand names in community labels.** CC BY 4.0 does not license trademarks (§2(b)(2)), and a brand in a label can suggest an endorsement that does not exist.
7. **Disclose AI-assisted authoring in the pull request.** Say which parts were AI-assisted (geometry, metadata, text) and how you checked them. Whether AI-generated content is protected by copyright at all is unsettled, and that affects what a licence grant over it covers. This is not legal advice.

If you are unsure whether something is allowed, ask in the pull request before you draw it.

## Licence and sign-off

By contributing, you agree to three things.

**1. You license your contribution as the repository does (inbound = outbound).**

| What you contribute | Licence |
| --- | --- |
| Blocks, and data derived from them (`blocks/**`, `index.json`, `test/fixtures/**`) | [CC BY 4.0](LICENSES/CC-BY-4.0.txt) |
| Everything else: schema, tools, tests, docs, CI | [Apache-2.0](LICENSES/Apache-2.0.txt) |

[`REUSE.toml`](REUSE.toml) gives the licence of every path, and each block also states its own in `catalog:license`. GitHub's Terms of Service set out the same inbound = outbound rule in section D.6 ([text](https://raw.githubusercontent.com/github/site-policy/main/Policies/github-terms/github-terms-of-service.md)). There is no contributor licence agreement.

**2. You certify the [Developer Certificate of Origin 1.1](https://developercertificate.org/)** by adding a `Signed-off-by:` line to every commit (`git commit -s`). In short, you certify that you wrote the contribution, or otherwise have the right to submit it under the licence indicated for the file, and that you understand the record of your contribution, including your sign-off, is public and kept indefinitely. Read the full text before you sign off; the [DCO app's README](https://github.com/dcoapp/app#how-it-works) reproduces its four clauses.

**3. You designate the collective credit line as the attribution for your contribution** under CC BY 4.0 §3(a)(1)(A)(i), which lets a licensor name "others designated to receive attribution, in any reasonable manner requested by the Licensor". The line, exactly as in [LICENSE.md](LICENSE.md#how-to-credit):

```text
"floorkit-catalog" by Vishwajeet Mane and floorkit-catalog contributors,
https://github.com/OpenGeometry-io/floorkit-catalog, CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/)
```

This lets an application credit every block with one line. Your own block still names you in `catalog:attribution`.

**What follows from this:**

- **CC BY 4.0 is irrevocable** (§2(a)(1)). A block you contribute stays usable under it by everyone who received it.
- **Nobody can relicense your block without you.** The CC BY 4.0 grant is non-sublicensable (§2(a)(1)), and with no contributor licence agreement the maintainers cannot offer your block under other terms (for example CC0) without your permission.

**How the sign-off is checked.** `tools/dco.mjs` requires every non-merge commit in a pull request to carry a `Signed-off-by:` line naming that commit's **author** email. A sign-off by someone else does not count. To fix a pull request:

```sh
git commit --amend -s                  # the last commit only
git rebase --signoff <base>            # every commit since <base>
git push --force-with-lease
```

## What CI checks

The [`validate` workflow](.github/workflows/validate.yml) runs on every pull request and on every push to `main`. It has two jobs, `catalog` and `reuse`. From launch, branch protection on `main` requires both to pass before a merge ([docs/LAUNCH.md](docs/LAUNCH.md) item 2).

| Job | Step | Command | Fails when |
| --- | --- | --- | --- |
| `catalog` | Install | `npm ci` | `package-lock.json` and `package.json` disagree |
| `catalog` | Tests | `npm test` | Any `node:test` suite in `test/` fails |
| `catalog` | Validate every block | `node tools/validate.mjs` (`npm run validate`) | Any block is invalid or misplaced, `publishers.json` is malformed or lacks a block's publisher, or `categories.json` disagrees with the schema |
| `catalog` | Index is current | `node tools/build-index.mjs --check` (`npm run index:check`) | `index.json` is not exactly what `blocks/`, `publishers.json` and `revocations.json` produce: stale, or edited by hand |
| `catalog` | Released blocks unchanged | `node tools/immutable.mjs` | A file under `blocks/` that is in any `v*` tag was modified, deleted, renamed or re-moded, anything under `blocks/` is a symbolic link, or the clone is shallow |
| `catalog` | Every commit signed off (DCO) (pull requests only) | `node tools/dco.mjs <base sha> <head sha>` | A non-merge commit lacks a `Signed-off-by:` naming its author |
| `reuse` | REUSE compliance | `reuse lint`, through `fsfe/reuse-action` | A file has no licence or copyright information, or carries an invalid SPDX expression |

Locally, `npm ci && npm run check` covers the first four steps, and `reuse lint` the last, if you have the [REUSE tool](https://reuse.software/) installed. Two things CI does **not** do:

- **Hold blocks to Floorkit itself.** `tools/parity.mjs` needs a Floorkit build, and `@opengeometry/floorkit` is not on npm yet, so maintainers run it.
- **Judge provenance or appearance.** That is review.

## Review

- **A maintainer reviews every pull request**, and merges it once CI passes and review is done. There is one maintainer at present, so no response time is promised.
- **Reviewers check what the tools cannot:**
  - provenance and licence;
  - that `dimensions` match the geometry;
  - that the plan symbol and the body look right and sit at the right height;
  - the label, type, category and tags;
  - the semver bump of a new version.
- **Maintainers may also run** `FLOORKIT_DIR=<a Floorkit build> node tools/parity.mjs --build`, which checks that Floorkit accepts the block, changes none of its values, and builds it with the real geometry kernel.
- **Expect questions about provenance.** They are not an accusation; the catalog can only pass on rights its contributors hold.

## Changing tools, schema or docs

- **Run `npm run check`** before every push.
  <!-- REUSE-IgnoreStart -->
- **Every tool and test file starts with an SPDX header:** `// SPDX-License-Identifier: Apache-2.0`, after the shebang line if there is one.
  <!-- REUSE-IgnoreEnd -->
- **The tools have one dependency, `ajv`.** Do not add another without a reason the pull request explains. `tools/loader.mjs` imports nothing at all, because it must run unchanged in a browser.
- **The catalog stays stricter than Floorkit.** It rejects anything Floorkit would repair. A schema change that loosens a rule must keep that true.
- **A new file that no pattern in [`REUSE.toml`](REUSE.toml) covers**, such as a new top-level file that is not Markdown, or a file in a new top-level folder, must be added to it, or `reuse lint` fails.
- **A breaking change to the format or the index needs an RFC** in [`docs/rfcs/`](docs/rfcs/) ([GOVERNANCE.md](GOVERNANCE.md#changes-to-the-format-and-the-schema)).
- **Docs use British spelling** ("licence" as a noun, "license" as the verb and in SPDX ids) and say what was measured and what is unverified.

## Things never to do

- Edit `index.json` by hand. `tools/build-index.mjs` is its only author.
- Modify, rename or delete a released block. Publish a new version.
- Set your own publisher tier above `community`.
- Copy geometry from a manufacturer's or a portal's files.
- Add a `Signed-off-by:` line in someone else's name.
