# RFC 0001: the catalog and its loader

| | |
| --- | --- |
| **Status** | Implemented in v0.1.0; [open questions](#open-questions-for-the-owner) remain |
| **Covers** | The block layout, the metadata vocabulary, `index.json` (`floorkit.catalog/v1`), the integrity model, distribution, and `tools/loader.mjs` |
| **Maintainer** | [@aka-blackboots](https://github.com/aka-blackboots) |
| **Date** | 2026-10-05 |

How to read this document:
- **Measured** means a command was run and its result is quoted. **Unverified** means it was not checked for this document.
- Paths in `OpenGeometry-io/OpenPlans` (the Floorkit SDK source) and `OpenGeometry-io/parti` point into private repositories. They are cited for maintainers who can open them.
- Licensing statements are an engineering record, not legal advice.

## Summary

This repository is a public catalog of Floorkit `.op` element definitions ("blocks").
- **One file per block version.** Each is immutable once released: `blocks/<publisher>/<slug>/<x.y.z>.op`.
- **Strict format.** Every block is held to a JSON Schema and to semantic checks that are stricter than Floorkit's own parser.
- **Generated index.** `index.json` is deterministic. It lists every file's size, SHA-256, canonical content hash, licence and revocation state.
- **Reference loader.** [`tools/loader.mjs`](../../tools/loader.mjs) has no dependencies and checks every block against the index before handing it over. It is written to be moved into the Floorkit SDK.
- **Licences.** Content is CC BY 4.0; code, schema and docs are Apache-2.0 ([LICENSE.md](../../LICENSE.md)).
- **Seeds.** v0.1.0 holds 26 blocks taken from the Floorkit v0.6.1 examples.
- **Distribution.** After launch, jsDelivr is to serve the catalog from git tags. That has not been measured yet ([LAUNCH.md](../LAUNCH.md) item 6).
- **Not in v0.1.0:** a signature over the index. Integrity is only as good as the channel `index.json` arrived over.

## Motivation

### The example blocks had no licence

- **Where the seeds came from.** The 26 seed blocks started as example assets in `examples/src/catalog/assets` of `OpenGeometry-io/OpenPlans`, Floorkit's source repository, which is not public. They were imported at the Floorkit v0.6.1 release (`8a964fb`), and the files are byte-identical on OpenPlans `main` (`681e4f1`).
- **The SDK licence does not cover them.** That repository's `LICENSE.md` now defines **Software** as "the floorkit SDK published as the npm package `@opengeometry/floorkit`". The assets are not in that package (`rollup.config.js` builds from `src/index.ts`, and nothing in `src/` imports an `.op`). So the assets had no licence at all.
- **Parti's stamp had nothing behind it.** Parti stamps its copies of the assets `CC-BY-4.0` / `OpenPlans` with no grant behind the stamp.

[OpenGeometry-io/OpenPlans#128](https://github.com/OpenGeometry-io/OpenPlans/pull/128) tried a carve-out inside the proprietary repository: an exception paragraph in the root `LICENSE.md`, plus a CC BY 4.0 `LICENSE.md` in the assets folder. **This repository supersedes it**, because the carve-out could not be made to work:
- **It conflicts with `main`.** The root `LICENSE.md` was rewritten on `main`, and the PR conflicts with the whole file.
- **It would ship to npm users.** The root `LICENSE.md` is copied into the npm package. An exception about repository paths would reach every npm user, and none of them receive those paths.
- **Nobody can follow its credit URL.** The PR credits `https://github.com/OpenGeometry-io/openplans`, which returned 404 to an anonymous request on 2026-10-05 because the repository was not public. CC BY 4.0 §3(a)(1)(A)(v) asks for "a URI or hyperlink to the Licensed Material to the extent reasonably practicable".
- **Outsiders cannot contribute to a private repository.**
- **Its names are stale.** It names "OpenPlans" as the copyright holder, and an old package name.

A separate public repository fixes all of these:
- the credit URL resolves;
- outside contributions have a route in (a DCO sign-off, inbound = outbound; see [CONTRIBUTING.md](../../CONTRIBUTING.md));
- the repository has its own licences and its own release tags;
- no proprietary terms appear anywhere in the tree.

### Why stricter than the SDK

Floorkit's parser (`validateOpenElementDefinition`, `parseOpenElementDefinition`) normalises as much as it validates:
- unknown keys are dropped at every level;
- missing values get defaults: `type` becomes `FURNITURE`, a size becomes 1 m, and an arc's sweep becomes 2π;
- sizes are clamped to at least 0.01 m;
- `version` is never read, so a `"version": 2` file is silently treated as version 1;
- there is no limit on size or complexity, and a `boolean3d` chain that reuses a definition twice per level costs 2^n builds while it validates in linear time.

That is the right behaviour for an SDK loading whatever it is handed. It is the wrong behaviour for a shared catalog: there, a silently repaired block is a defect that no reviewer sees until it is on someone's drawing. The seeds showed this. 8 of the 26 source files carried keys that Floorkit drops (`cylinder.segments` 12 times, and one arc's `endAngle` and `segments`). The crah fan arc drew a full circle only because the missing `sweepAngle` defaulted to 2π.

So the catalog **rejects anything Floorkit would repair**, and `tools/parity.mjs` holds the other half.

**Measured** against Floorkit built from OpenPlans `681e4f1`:

| Check | Result |
| --- | --- |
| Blocks Floorkit accepts | 26/26 |
| Blocks where Floorkit changes no authored value | 26/26 |
| Kernel-reject fixtures Floorkit refuses | 15/15 |
| Blocks built by the real WASM kernel | 26/26 |

- **The check is not vacuous.** Restoring the source's 6 mm drain made it report `REPAIRED … 0.006 became 0.01`.
- **CI cannot run it yet.** It needs `@opengeometry/floorkit` on npm, and npm returned 404 for that package on 2026-10-05.

The full rules are in [docs/format-v1.md](../format-v1.md).

## Design

### Layout and identity

**A path is identity.** A file cannot claim to be something its location says it is not:
- a reviewer reads publisher, block and version from the diff header;
- a loader can compute a block's URL without trusting the block.

| Rule | Enforced by |
| --- | --- |
| A block is at `blocks/<publisher>/<slug>/<x.y.z>.op`, all lowercase-hyphenated, as a regular file (no symlinks) | `listBlocks` in `tools/lib/repo.mjs` |
| `id` is `<publisher>.<slug>`, for example `floorkit.simple-chair` | `checkListedBlock` in `tools/lib/repo.mjs` |
| `metadata["catalog:version"]` equals the file name | `checkListedBlock` |
| The publisher is listed in `publishers.json` | `checkListedBlock` |
| Each `publishers.json` entry has exactly `id`, `name`, `tier` and `url`, with tier `official`, `verified` or `community` | `readPublishers` in `tools/lib/repo.mjs` |
| The file is in canonical bytes: 2-space JSON, LF, one final newline, no BOM, no duplicate keys | `checkBlockText` in `tools/lib/op.mjs`; fix with `node tools/format.mjs <file.op>` |
| Once in a `v*` tag, a file is never modified, deleted, renamed or re-moded; only additions are allowed under `blocks/` | `node tools/immutable.mjs` |

**Versioning is per block, by semver.**

| Bump | When |
| --- | --- |
| MAJOR | An anchor, port or id is removed or renamed, or a footprint or insertion-point change would move instances already placed |
| MINOR | Anchors, ports or types are added |
| PATCH | Label, colour or metadata change |

A fix is always a new file.

**A catalog release is a git tag `vX.Y.Z`, and loaders pin to tags.** A tag is the moment a file becomes something people depend on. `tools/immutable.mjs` therefore checks HEAD against every `v*` tag in the clone, not against `main`, and fails on a shallow clone instead of passing. Before the first tag it prints `immutability: NOT ENFORCED — no v* tag yet, so no block has been released.` rather than passing quietly.

**Two hashes, two jobs:**
- `sha256` is over the file's exact bytes. It is the transport check.
- `contentHash` is SHA-256 over the definition's canonical JSON (keys sorted at every depth, no whitespace). It is the block's identity, and it is the same identity Parti's block library uses ([below](#parti-integration)).

`.gitattributes` marks `blocks/**/*.op` and `index.json` as `-text`, so git never rewrites the bytes those hashes cover.

**Deprecate and revoke are different things.**
- **Deprecate:** the block keeps resolving. `CHANGELOG.md` and the release notes name its replacement.
- **Revoke:** the entry goes into `revocations.json`, `index.json` marks it `revoked`, and the loader refuses it.

[GOVERNANCE.md](../../GOVERNANCE.md) covers both, and takedowns. The v1 index has no `deprecated` or `replacedBy` field yet ([open question 6](#open-questions-for-the-owner)).

### Metadata vocabulary, and why it lives inside the `.op`

The catalog's facts about a block live in the block's own `metadata`, under namespaced keys, as a **closed** vocabulary. A key the schema does not list fails validation, so a typo such as `catalog:licence` cannot pass quietly.

| Key | Required | Meaning |
| --- | --- | --- |
| `catalog:version` | yes | Strict semver; equals the file name |
| `catalog:license` | yes | `CC-BY-4.0` (a constant in v1) |
| `catalog:attribution` | yes | Who the block credits |
| `catalog:category` | yes | One of the 13 in `categories.json` |
| `catalog:placement` | for `DOOR` and `WINDOW` | `free` or `hosted`; `hosted` if and only if `type` is `DOOR` or `WINDOW` |
| `catalog:defaultSill` | no | Metres; `WINDOW` only |
| `catalog:lod` | no | `100`, `200` or `300` |
| `catalog:tags` | no | `"a, b"`: lowercase, at most 12, no repeats |
| `catalog:author`, `catalog:note`, `catalog:basedOn` | no | Provenance as free text; `basedOn` records the source commit, path and id |
| `ifc:class`, `ifc:predefinedType` | no | `Ifc…` class; the predefined type needs a class |
| `class:uniclass2015`, `class:omniclass` | no | Classification codes |
| `mat:<nodeId>` | no | Material role of an existing node: `surface`, `soft`, `frame`, `metal`, `glass`, `ceramic` or `planting` |
| `ifcClass` | no | Legacy and unprefixed; must equal `ifc:class` |

Why the vocabulary lives inside the file, and why it is namespaced:
- **Metadata is the only place a licence survives Floorkit.** Floorkit's parser drops unknown top-level keys but keeps every non-empty `metadata` key (`sanitizeMetadata` in `generic-element.ts`). A top-level `license` field would vanish on the first parse.
- **Blocks get embedded, and the credit has to go with them.** `.opbase` files have `embedded-op` assets, BuildingModel has `embedded-op` asset refs, and Parti embeds definitions in its plans. A sidecar file per block, such as an `asset.json`, would be left behind at the first embed. With the keys inside the definition, the licence and attribution travel with every copy, which is what CC BY 4.0 §3(a)(1) asks of whoever shares it.
- **Namespaces keep the keys apart.** They separate the catalog's keys from an author's own keys and from a consumer's keys, such as Parti's `parti:*`. The `ifc:`, `class:` and `mat:` keys are exactly the ones Parti already uses.
- **Every value is a string.** Floorkit types metadata as `Record<string, string>` and passes values through `String()`. Hence `"0.9"`, `"200"` and `"chair, dining"`.
- **`ifcClass` is the one unprefixed key.** Floorkit 0.6's IFC export reads exactly that key, and only on its distribution-equipment path, which `MEP_EQUIPMENT` blocks and blocks with ports take ([format-v1 §11](../format-v1.md#11-advisory-notes)). It is kept on the five data-centre seeds (chiller, crah, pdu, rear-door-heat-exchanger, ups), and `ifc:class` must equal it ([open question 4](#open-questions-for-the-owner)).

### `index.json`

`tools/build-index.mjs` is the only author of `index.json`, and it validates the result against [`schema/index/v1.schema.json`](../../schema/index/v1.schema.json) with Ajv in strict mode. The top level is `{ "schema": "floorkit.catalog/v1", "entries": [...] }`.

| Entry field | Source |
| --- | --- |
| `id`, `labelName`, `type`, `dimensions` | The block |
| `publisher` `{id, name, tier}` | `publishers.json` |
| `slug`, `version`, `path` | The file's path |
| `category`, `license`, `attribution` | `catalog:category`, `catalog:license`, `catalog:attribution` |
| `tags` | `catalog:tags` split on `", "`; `[]` when absent |
| `bytes`, `sha256` | The raw file |
| `contentHash` | SHA-256 of the canonical JSON |
| `revoked` `{at, reason}` | `revocations.json`, present only when revoked |

**The index is deterministic on purpose.**
- It carries no timestamp and no commit hash.
- Entries are ordered by publisher, then slug, then numeric version.
- Byte counts and hashes come from the raw files.
- The output is 2-space JSON with one final newline.

So one commit always produces the same bytes. `node tools/build-index.mjs --check` (`npm run index:check`) fails when the committed file differs, which means a hand edit on either side fails CI.

The consequence: freshness (`issuedAt`, `expiresAt`) cannot live in the index. It belongs in the signed pointer described below, which names an index by its hash.

### Integrity and trust model

**What v0.1.0 guarantees.** A consumer that loads blocks through `tools/loader.mjs` gets these guarantees:
- **Bytes match.** Each block's bytes have exactly the length and SHA-256 that `index.json` lists.
- **Identity matches.** The block's own `id` and `catalog:version` equal its entry's.
- **Not revoked.** The entry was not revoked in that index.
- **Transport limits.** The request stayed under the catalog root and followed no redirect. No more bytes were read than the entry promised, and the cap holds while streaming. The index itself is capped (4 MB by default) and every request times out (10 s by default).

**What it does not guarantee:**
- **No signature.** `index.json` is believed because of the channel it came over: HTTPS to jsDelivr, pinned to a tag, which jsDelivr reads from GitHub. Whoever can change `index.json` at the host or in transit can change what "correct" means for every block. That includes each block's byte cap, which is the index's own number.
- **No freshness.** The loader cannot tell that it is being served an old release. It was asked for one tag and that is what it fetched.
- **No re-validation of content.** The loader does not check a block against the schema. CI did that when the block was merged.

| Threat | v0.1.0 | Later |
| --- | --- | --- |
| **Malicious pull request**: oversized, deeply nested or 2^n geometry; `__proto__` or `constructor` keys; markup or URLs in labels; a block claiming another block's id | The schema (closed objects, per-kind bounds, label rules), limits (256 KB, 400 nodes, 1,000 nodes once references are expanded), checks for geometry the kernel cannot build, the path and id rules, a DCO sign-off and maintainer review | A strict validator in the Floorkit SDK, so clients can re-check |
| **A file swapped or corrupted on a host or mirror, index intact** | Refused: `integrity` (SHA-256 or length) or `too-large` | Same |
| **Compromised CDN or mirror** (index and files changed together) | **Not detected.** The hash protects against this only once the index is signed | Signed index or pointer, verified against a key pinned in the client |
| **Rollback or freeze**: serve an older index, or stop serving updates | Not detected, beyond pinning an exact tag | Pointer with `seq` (refuse a lower one) and `expiresAt` (refuse a stale one) |
| **Tag moved or deleted** by someone with write access | Not prevented by the tools. jsDelivr keeps tagged files it has already fetched in permanent storage ([README](https://github.com/jsdelivr/jsdelivr)), so after a move git and jsDelivr can serve different bytes for the same tag | Restrict who can update `v*` tags (whether the org's plan offers this is unverified); the signed pointer names the index by hash, so a moved tag becomes detectable |
| **Takedown** (rights holder, licensing error) | `revocations.json` makes the entry `revoked` in the index at the next tag; the loader refuses it and `list()` hides it. A loader pinned to an earlier tag still loads it | Same, inside a signed index |

**A revocation cannot recall copies.**
- CC BY 4.0 is irrevocable (§2(a)(1)), and copies already embedded in projects keep working.
- Revocation stops **new** placements through a loader that respects it.
- The process is in [GOVERNANCE.md](../../GOVERNANCE.md), and private reports go through [SECURITY.md](../../SECURITY.md).

**The signed pointer (planned, not built).** It is a cut-down form of [The Update Framework](https://raw.githubusercontent.com/theupdateframework/specification/master/tuf-spec.md)'s timestamp role:
- **What it is.** A small `latest.json` plus a detached signature, holding `{ schema, seq, issuedAt, expiresAt, version, index sha256 }`.
- **How it is signed.** With an offline key. CI only verifies.
- **What it changes.** Rollback, freeze and a compromised host all become detectable.
- **Precedents.** Parti's `parti.catalog/v1` design is the same idea: an Ed25519 signature over the exact index bytes, an `issuedAt` that only moves forward, and `expiresAt`. KiCad's Plugin and Content Manager chains `repository.json` → `packages.json` (with SHA-256) → each package (with SHA-256) ([pcm.v1 schema](https://gitlab.com/kicad/code/kicad/-/raw/master/kicad/pcm/schemas/pcm.v1.schema.json)).
- **Still open:** the algorithm and the key ([open question 2](#open-questions-for-the-owner)).

### Distribution

| Channel | Status | Why |
| --- | --- | --- |
| **jsDelivr `/gh/` at a tag**: `https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0/` | Primary, from launch | No publish step. jsDelivr cannot serve a private repository, so it starts working only when this one is public. Branch URLs are cached for 12 hours, so pin a tag, never a branch. Once jsDelivr has fetched a tag's files it keeps them in permanent storage, and its purge API does not touch exact-version links. It does not remove a version because it was deleted upstream, though it may restrict content for serious legal reasons. Single files over 20 MB are not supported, and the terms of use exclude general-purpose file hosting ([README](https://github.com/jsdelivr/jsdelivr), [Terms of Use](https://raw.githubusercontent.com/jsdelivr/jsdelivr/master/Terms%20of%20Use.md)). Status codes, redirect behaviour and CORS headers for this repository are **unverified**: `cdn.jsdelivr.net` was unreachable from the environment these docs were written in. [LAUNCH.md](../LAUNCH.md) item 6 measures them. |
| **npm `@opengeometry/floorkit-catalog`** (name not final) | Later | To be published by trusted publishing (OIDC), which GitHub announced as generally available on 2025-07-31, with provenance attached by default from npm CLI 11.5.1 ([changelog](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/); known from a search result, not fetched). An npm version can never be republished, and unpublishing is restricted ([policy](https://docs.npmjs.com/policies/unpublish/); search result), so the takedown lever is revocation, not unpublish. jsDelivr `/npm/` serves exact versions "effectively forever": 1-year cache headers plus permanent storage ([README](https://github.com/jsdelivr/jsdelivr)). It must be a package of its own, never part of `@opengeometry/floorkit` ([Alternatives](#alternatives-considered)). |
| **raw.githubusercontent.com** | Do not use | Not a CDN. Its unauthenticated limit is 60 requests per hour ([GitHub changelog, 2025-05-08](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/); search result, not fetched). |
| **GitHub Pages** | Not as the primary host | The Pages limits exclude sites "primarily directed at … commercial software as a service (SaaS)", which is a grey area for the catalog of a paid SDK. Sites also have a 1 GB size limit and a 100 GB per month soft bandwidth limit ([GitHub Pages limits](https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/github-pages-limits.md)). It might host a small pointer file. A custom domain may redirect from `github.io`, which the loader refuses (unverified). |
| **A mirror you host yourself** | Supported by design | `openCatalog` takes any `baseUrl`. A mirror must answer from its own URL without redirecting. A public CDN sees end users' IP addresses; a self-hosted mirror keeps them away from a third party. |

### The reference loader

[`tools/loader.mjs`](../../tools/loader.mjs) is written to run unchanged in browsers and in Node 22. It has no dependencies, and it uses `fetch`, streams and WebCrypto. Only Node is tested; no browser test exists yet.

```js
import { openCatalog, CatalogError } from './tools/loader.mjs';

const catalog = await openCatalog({
  baseUrl: 'https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0/',
  // fetch,                    optional: a custom transport
  // maxIndexBytes: 4 << 20,   default 4 MB
  // timeoutMs: 10_000,        default 10 s per request
});
catalog.list();                                   // live entries; list({ includeRevoked: true }) for all
catalog.find('floorkit.simple-chair');            // the newest live version; find(id, '1.0.0') for an exact one
const { entry, text, definition } = await catalog.load('floorkit.simple-chair', { version: '1.0.0' });
// Floorkit: new OpenElement(text), or parseOpenElementDefinition(text)
```

A refusal is a `CatalogError` with a `.code`:

| `code` | When |
| --- | --- |
| `fetch-failed` | A network error or a timeout before the response arrives, or a non-2xx status |
| `redirected` | Any redirect. A mirror that answers from somewhere else is not this catalog. In a browser, `fetch` does not say why it failed, so a redirect there is still refused but reported as `fetch-failed` (read from the code; not tested in a browser) |
| `too-large` | More bytes than promised: a declared `content-length` over the cap, or the cap exceeded while streaming |
| `malformed` | The index is not UTF-8 or not JSON, its `schema` is not `floorkit.catalog/v1`, it has no `entries` array, or a block is not UTF-8 |
| `outside-root` | An entry path with `..`, `.` or an empty segment, or one that resolves outside the base URL |
| `not-found` | No entry has that id, or that id and version |
| `revoked` | The entry is revoked. The error gives the date and the reason |
| `integrity` | The length or SHA-256 differs from the index, or the file's own `id` or `catalog:version` differs from its entry |

Two failures are not wrapped in a `CatalogError` yet:
- **A timeout or network error while the body is streaming** is `fetch-failed`: the deadline is enforced on every read.
- **A file that matches its SHA-256 but is not JSON** is `malformed`, as is an entry whose `bytes` (at most 256 KB) or `sha256` is unusable. Entry paths must match `blocks/<publisher>/<slug>/<x.y.z>.op` exactly, so percent-encoded tricks such as `..%2F` are `outside-root`.

**Measured:** `test/loader.test.mjs` runs the loader against a real local HTTP server serving the real catalog. It loads and verifies all 26 blocks. It then checks seven refusals:

| Case | Code |
| --- | --- |
| A tampered file | `integrity` |
| An oversized file, sent chunked with no `content-length`, so the cap must hold while streaming | `too-large` |
| A revoked entry | `revoked` |
| An entry path that escapes the root | `outside-root` |
| A file claiming to be a different block | `integrity` |
| A redirect | `redirected` |
| An unknown id | `not-found` |

Each one gets the code it should, as do an encoded `..%2F` path, an entry claiming 10^12 bytes, a non-JSON file with a matching hash, a stalled body and a server error. The hand-off to Floorkit (`parseOpenElementDefinition` on every loaded block) passes 26/26 when `FLOORKIT_DIR` points at a Floorkit build. Without one, the test is reported as skipped, not passed.

#### What to move into the Floorkit SDK

Floorkit has the places a loader plugs into, but not the loader itself. Today `loadOPBaseAssetSources` (`op-base.ts`) is a bare `fetch`: no integrity check, size cap, timeout or redirect policy. The steps below are listed smallest first. Each names the SDK code it builds on, as of OpenPlans `681e4f1`.

1. **A strict validator that returns issues.** Something like `validateOpenElementDefinition(definition, { strict: true })` returning `{ definition, issues: [{ path, code, message }] }`. It would reject unknown keys and every value the normalisers would repair, instead of repairing them. Use `schema/op/v1.schema.json` and `tools/lib/op.mjs` as the reference. Only the geometry rules belong in the SDK; the catalog's metadata vocabulary does not.
2. **A version gate.** Read `version` and throw a typed error when it is greater than 1. Today the normaliser writes `version: 1` whatever the file says.
3. **Limits, and memoised builds.** Enforce `{ maxBytes, maxNodes, maxExpandedNodes }` during validation. Memoise built solids in the definition resolver as well, so that a `boolean3d` chain reusing a definition costs n builds rather than 2^n.
4. **`createCatalogLoader`.** Lift this loader into the SDK and have it feed the three places Floorkit already takes pre-loaded sources:
   - `OPBaseOptions.assetSources`;
   - `BuildOptions.assetSources`;
   - the `BuildingSession` options, which take `Pick<BuildOptions, 'assetSources' | …>`.

   Two additions over this loader:
   - **Clamp every block's byte cap to the format maximum** (262,144 bytes), whatever the index says, so that a forged index cannot raise it.
   - **Cache by `contentHash`.**
5. **A `catalog:` URI scheme,** resolved against the configured sources alongside plain URLs. For example, `catalog:floorkit.simple-chair@1.0.0` would resolve to `blocks/floorkit/simple-chair/1.0.0.op` under a configured source. The exact syntax is a proposal.
6. **Pinning in saved projects.** Give `BmAssetRef` (`external-op`) and `OPBaseExternalAsset` optional `version` and `sha256` fields, so a reopened project gets exactly the bytes it was drawn with. Also hold `embedded-op` definitions to the strict validator. Today both `.opbase` and BuildingModel pass them only through the repairing normaliser (`OpenElement.normalizeDefinition`); in BuildingModel they are typed `unknown`, and its document validator (`projects/building/validate.ts`) does not look inside them.
7. **Signature verification,** once [open question 2](#open-questions-for-the-owner) is settled.

The loader, the schemas and the validator are Apache-2.0, so they can move into the proprietary SDK, subject to Apache-2.0 §4's notice conditions. The **blocks** must not be bundled into the SDK ([Alternatives](#alternatives-considered)).

### Parti integration

**A Parti block is an `.op` file with `parti:*` keys in `metadata`.** It is not a separate format. Parti requires four keys:
- `parti:schema` = `parti.block/v1`;
- `parti:version`;
- `parti:category`;
- `parti:license`.

Most of this catalog's vocabulary maps one to one:

| This catalog | Parti (`packages/blocks/src/metadata.ts`) |
| --- | --- |
| *(none)* | `parti:schema` = `parti.block/v1` (required) |
| `catalog:version` | `parti:version` |
| `catalog:license` | `parti:license` |
| `catalog:attribution` | `parti:attribution` |
| `catalog:category` (same 13 categories) | `parti:category` |
| `catalog:placement` | `parti:placement` |
| `catalog:defaultSill` | `parti:defaultSill` |
| `catalog:lod` | `parti:lod` |
| `catalog:tags` | `parti:tags` |
| `catalog:author` | `parti:author` |
| `catalog:basedOn` | `parti:basedOn` |
| `catalog:note` | *(none; it passes through as an unknown key)* |
| `ifc:class`, `ifc:predefinedType`, `class:uniclass2015`, `class:omniclass`, `mat:<nodeId>` | The same keys, and `mat:` has the same seven roles |
| `ifcClass` (legacy) | *(none)* |
| *(none)* | `parti:publisher`, `parti:createdAt`, `ai:model`, `ai:thread` |

Parti cannot read this catalog yet. It needs these changes first (a follow-up in Parti, not here):
1. **Accept `catalog:*` as an alias namespace** when it reads block info. Without that, every block fails Parti's required-key check.
2. **Accept this index's schema.** Parti's `CATALOG_SCHEMA` is the literal `parti.catalog/v1` (`catalog.ts`). It has to accept `floorkit.catalog/v1`, or an alias for it.
3. **Get signing fields from a signed index or pointer.** Parti's index also requires `issuedAt`, `expiresAt`, `keyId` and a detached Ed25519 `index.json.sig`. This index has none of them; they arrive with the signed index or pointer.
4. **Pin a key.** `CATALOG_KEYS` is `{}` today (`keys.ts`). Until a key is pinned, Parti's marketplace reports that it is not set up.
5. **Mind the compatibility traps:**
   - Parti requires `revoked.at` to parse as a date, while this schema accepts any non-empty string, so revocations here should use ISO 8601 dates.
   - Parti holds `category` and `tier` as closed enums, so a 14th category here would make the **whole** index unreadable to an older Parti.
   - Parti supports one catalog URL, with one `lastIssuedAt` for the whole install.

**The content hash is already the same algorithm.** `canonicalJson` in `tools/lib/op.mjs` matches Parti's `hash.ts` rule for rule. **Measured:** running this repository's `canonicalJson` and SHA-256 over Parti's 26 system blocks reproduces the hash Parti recorded for each one in `packages/blocks/system/index.json`: 26 of 26.

The **values** still differ between Parti's copies and these blocks, because the ids and metadata differ and metadata is part of the hash. Parti de-duplicates by `assetRef` (`id@version~hash12`, in `library.ts`), so if it loaded this catalog beside its own system copies, the same chair would appear twice.

**Credit:** Parti's system blocks still say `parti:attribution: "OpenPlans"` and `parti:basedOn: "openplans@8a964fb:…"`. After launch, both should point here ([LAUNCH.md](../LAUNCH.md) item 7).

### Governance

| Document | Covers |
| --- | --- |
| [GOVERNANCE.md](../../GOVERNANCE.md) | Publisher tiers, releases, revocation, takedowns |
| [CONTRIBUTING.md](../../CONTRIBUTING.md) | DCO sign-off, provenance rules, AI-assistance disclosure |
| [SECURITY.md](../../SECURITY.md) | Private reports |
| [LICENSE.md](../../LICENSE.md) | The two licences and the credit line |

A publisher's tier is plain data in `publishers.json`, and no tool checks who changed it. Review is the only control on that file.

## Alternatives considered

### A carve-out inside the SDK repository: superseded

This was [OpenPlans#128](https://github.com/OpenGeometry-io/OpenPlans/pull/128). [Motivation](#the-example-blocks-had-no-licence) explains why this repository replaces it.

### CC0 for the content: not chosen for v0.1.0

It is still open for the owner's own blocks.
- **For CC0:**
  - It removes the credit duty. Under CC BY, a paying Floorkit customer who removes the Floorkit badge still owes the one-line credit for the blocks.
  - It ends the relicensing question.
  - Poly Haven and ambientCG publish their assets under CC0 (Poly Haven from its [API terms](https://github.com/Poly-Haven/Public-API); ambientCG known only from a [search result](https://docs.ambientcg.com/api/v2/)).
- **Against CC0:** no attribution, either for the owner or for contributors.
- **The door stays open.** CC BY 4.0 lets a licensor also offer the same material under other terms (§6(c) in Creative Commons' legal code, §6(d) in the plain-text copy in `LICENSES/`; [open question 1](#open-questions-for-the-owner)).

### Bundling the blocks in the npm package: rejected

- **The two licences collide.** CC BY 4.0 §2(a)(5)(B) says: "You may not offer or impose any additional or different terms or conditions on … the Licensed Material if doing so restricts exercise of the Licensed Rights by any recipient of the Licensed Material."
- **The Floorkit licence would cover the blocks.** It defines Software as the whole npm package, and its condition 3 forbids distributing it "as a standalone product or as a development kit, library or component for others to build with". A block shipped inside the package would be offered under both sets of terms at once.
- **The releases would be tied together.** The catalog could only release when the SDK does.

### A sidecar metadata file per block: rejected

It is lost at the first embed ([above](#metadata-vocabulary-and-why-it-lives-inside-the-op)).

### Floorkit's own parser as the CI gate: rejected as the gate

It is kept as a maintainer check instead.
- Floorkit's parser repairs where the catalog must refuse.
- CI cannot install Floorkit, because it is not on npm yet.
- `tools/parity.mjs` keeps the two in step.

### Signing from v0.1.0: deferred

- No consumer verifies a signature yet: Floorkit has no catalog loader, and Parti has no key pinned.
- The algorithm is still undecided.

## Open questions for the owner

1. **CC0 on your own seeds, before the first outside PR?**
   - CC BY 4.0 is irrevocable. You can later add CC0 to blocks you hold all rights in.
   - You cannot add it to outside contributions without a CLA, and inbound = outbound under the DCO gives you no such right.
   - So decide before the first outside contribution is merged.
   - Note: 14 of the 26 seed files came from commits authored by an AI assistant. Whether that content is copyrightable at all is unsettled, which bears on what any grant over those files actually covers. Not legal advice.
2. **The signing algorithm and key.**
   - **ECDSA P-256:** the SDK already verifies P-256 signatures with WebCrypto for licence keys (`license/key.ts`).
   - **Ed25519:** Parti's catalog design uses it. WebCrypto supports it in Chrome 137+, Firefox 129+ and Safari 17+ ([search result](https://blog.ipfs.tech/2025-08-ed25519/); unverified).
   - Pick one for both consumers. Keep the private key offline, pin key ids in each SDK and Parti release, and treat a key rotation as a release.
3. **The npm package name.** `@opengeometry/floorkit-catalog` is the working name. **Measured** on 2026-10-05: the npm registry answered 404 for `@opengeometry/floorkit-catalog`, and 200 for `@opengeometry/openglyph`, so the `@opengeometry` scope exists. Whether the account that will publish can publish to that scope is unverified.
4. **Should Floorkit read `ifc:class`?** Today the semantic IFC export (`SemanticIfcExtractor.ts`, read, not executed) chooses the class from `type` and ports ([format-v1 §11](../format-v1.md#11-advisory-notes)):
   - `FURNITURE`, `FIXTURE` and `APPLIANCE` without ports become `IfcFurnishingElement`; `LANDSCAPE` without ports becomes `IfcBuildingElementProxy`.
   - `MEP_EQUIPMENT`, and any block with ports, take the distribution-equipment path. Only that path reads the unprefixed `ifcClass`, falling back to `IfcDistributionElement`.
   - `DOOR` and `WINDOW` go through Floorkit's native door and window paths, which export a default door or window, not the block's geometry.
   - If Floorkit read `ifc:class` for every asset, `ifcClass` could be retired. That would happen in new block versions only, because released files never change.
5. **Several catalog sources.** A list such as `sources: [{ url, keys }]` would let a studio add a private catalog or a mirror. Each of these needs a rule:
   - how ids collide across sources;
   - whether one source's revocation applies to a copy loaded from another;
   - whether "last seen" state is kept per source. Parti keeps one `lastIssuedAt` for the whole install, so switching to a catalog with an older `issuedAt` is refused as a rollback.
6. **Machine-readable deprecation.** The v1 index has no `deprecated` or `replacedBy` field, so a loader cannot tell a deprecated block from a current one. Decide whether to add it, and whether adding it is a v1 change or needs a v2 index schema. The index schema is closed, so strict readers would refuse a new field.

## Sources

Statements about Floorkit's and Parti's internals come from reading their source, at OpenPlans `681e4f1` and Parti `23abace`. Both repositories are private.

External, fetched:
- CC BY 4.0 legal code: [LICENSES/CC-BY-4.0.txt](../../LICENSES/CC-BY-4.0.txt) in this repository, and Creative Commons' own [legal code](https://raw.githubusercontent.com/creativecommons/cc-legal-tools-data/main/docs/licenses/by/4.0/legalcode.en.html) (canonical address: <https://creativecommons.org/licenses/by/4.0/legalcode>). §2(a)(1), §2(a)(5)(B) and §3(a)(1)(A)(v) carry the same numbers in both. The "separate terms" clause is §6(c) in Creative Commons' text and §6(d) in the copy in `LICENSES/`, which numbers one more paragraph of section 6.
- jsDelivr: [README](https://github.com/jsdelivr/jsdelivr) (limits, caching, purge, content removal), [Terms of Use](https://raw.githubusercontent.com/jsdelivr/jsdelivr/master/Terms%20of%20Use.md).
- [GitHub Pages limits](https://raw.githubusercontent.com/github/docs/main/content/pages/getting-started-with-github-pages/github-pages-limits.md).
- [The Update Framework specification](https://raw.githubusercontent.com/theupdateframework/specification/master/tuf-spec.md).
- [KiCad PCM `pcm.v1` schema](https://gitlab.com/kicad/code/kicad/-/raw/master/kicad/pcm/schemas/pcm.v1.schema.json).
- [Poly Haven Public API](https://github.com/Poly-Haven/Public-API).

External, known only from search results (unverified):
- [npm trusted publishing GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
- [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/)
- [GitHub unauthenticated rate limits](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)
- [Ed25519 in WebCrypto](https://blog.ipfs.tech/2025-08-ed25519/)
- [ambientCG API v2](https://docs.ambientcg.com/api/v2/)

Local measurements quoted above:
- `npm run check`: `26 block(s) valid.` and `index.json is current: 26 entr(ies).`;
- `tools/parity.mjs --build` against Floorkit built from OpenPlans `681e4f1`;
- the hash cross-check against Parti's `packages/blocks/system/index.json` (26/26);
- the loader's behaviour on a body that stalls (`fetch-failed`), against a local Node server;
- the npm registry lookups in open question 3.
