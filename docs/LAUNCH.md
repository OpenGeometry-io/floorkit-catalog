# Launch checklist

How `OpenGeometry-io/floorkit-catalog` goes from private to public. Work through it in order. Each item says how to check it is done.

> **Do not send anything from this repository to anyone outside before items 5 and 6 pass.** That covers the blocks, `index.json` and links to either.
> - **The credit link would not open.** Every copy carries the credit line from [LICENSE.md](../LICENSE.md), which links to `https://github.com/OpenGeometry-io/floorkit-catalog`. While the repository is private, that URL answers 404 to anyone without access. A copy sent out now would carry a credit link its recipient cannot open, one of the defects of [OpenPlans#128](https://github.com/OpenGeometry-io/OpenPlans/pull/128) ([RFC 0001](rfcs/0001-catalog-and-loader.md#the-example-blocks-had-no-licence)).
> - **The loader example would not work.** jsDelivr cannot serve a private repository, so the README's loader example fails until launch.

**Who and what you need:**
- An admin of the repository: [@aka-blackboots](https://github.com/aka-blackboots).
- `gh` logged in as that admin (`gh auth status`).
- A clone of the repository with its tags, Node 22 or later, `curl`, `sha256sum` and the [REUSE](https://reuse.software/) tool. On macOS, use `shasum -a 256` wherever `sha256sum` appears.

The `gh` and `gh api` calls below have **not been run** against this repository yet. Where one disagrees with the settings page named beside it, the settings page is right; update this file.

## Before you start

Run these on an up-to-date `main`. N is the number of entries in `index.json`: `node -p "require('./index.json').entries.length"`.

| Check | Command | Expect |
| --- | --- | --- |
| Tests, blocks and index | `npm ci && npm run check` | `N block(s) valid.` and `index.json is current: N entr(ies).`, with no failing test. On commit `d8161de` (branch `catalog-1.0` at `cfe150e` plus documentation) on 2026-10-31 these read `91 block(s) valid.` and `index.json is current: 91 entr(ies).`, with 69 tests, 62 passing and 7 skipped without `FLOORKIT_DIR` |
| Licensing metadata | `reuse lint` | `Congratulations! Your project is compliant with version 3.3 of the REUSE Specification :-)` |
| Immutability gate, before any tag | `node tools/immutable.mjs` | `immutability: NOT ENFORCED — no v* tag yet, so no block has been released.` |
| Floorkit parity (maintainers with a Floorkit build) | `FLOORKIT_DIR=<dir with dist/index.js> node tools/parity.mjs --build --mesh` | Accepted, unrepaired, built, mirrored and mesh clean, N/N each; kernel-reject fixtures refused 27/27 (the 12 `v2-*.json` need Floorkit 3.0); `parity holds.` |
| What going public publishes | `git log --stat`, plus the issues, pull requests and Actions logs | Nothing that should stay private. The whole history becomes visible |

## Checklist

### 1. Make the repository public

Before you flip it, confirm on <https://www.contributor-covenant.org> that the Contributor Covenant is still published under CC BY 4.0. `CODE_OF_CONDUCT.md` is adapted from it, and `REUSE.toml` labels it that way, but the site could not be reached when this repository was written.

```sh
gh repo edit OpenGeometry-io/floorkit-catalog --visibility public --accept-visibility-change-consequences
```

The alternative is **Settings → General → Danger Zone → Change repository visibility**.

**Verify:**

```sh
gh repo view OpenGeometry-io/floorkit-catalog --json visibility --jq .visibility   # PUBLIC
```

### 2. Confirm branch protection on `main`

Set up branch protection (or a ruleset) on `main` with:
- **required status checks:** `catalog` and `reuse`, the two jobs of the `validate` workflow ([`.github/workflows/validate.yml`](../.github/workflows/validate.yml));
- **branches must be up to date before merging** ("strict"): a pull request opened before a tag must re-run against the tagged base, or the immutability gate never compares it with the release;
- **force pushes blocked;**
- **deletion blocked.**

If the organisation's plan did not offer branch protection or rulesets on a private repository (which plan it is on is unverified here), this was deferred to now. Set it in **Settings → Branches** or **Settings → Rules → Rulesets**.

**Verify** with whichever you used:

```sh
# Classic branch protection
gh api repos/OpenGeometry-io/floorkit-catalog/branches/main/protection \
  --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, forcePush: .allow_force_pushes.enabled, deletion: .allow_deletions.enabled}'
# expect: checks lists "catalog" and "reuse"; strict true; forcePush false; deletion false

# Ruleset
gh api repos/OpenGeometry-io/floorkit-catalog/rules/branches/main --jq '[.[].type]'
# expect: includes "required_status_checks", "non_fast_forward" and "deletion"
```

A further check: open a pull request and confirm that `catalog` and `reuse` are listed on it as **Required**.

### 3. Enable private vulnerability reporting

This is only available on public repositories, which is why it waits until now. Until it is on, reports go to the owner directly ([SECURITY.md](../SECURITY.md)).

```sh
gh api -X PUT repos/OpenGeometry-io/floorkit-catalog/private-vulnerability-reporting
```

The alternative is the **Private vulnerability reporting** switch in the security section of the repository's **Settings**. GitHub has renamed that section before.

**Verify:**
- `gh api repos/OpenGeometry-io/floorkit-catalog/private-vulnerability-reporting --jq .enabled` prints `true`.
- The repository's **Security** tab offers **Report a vulnerability** to a signed-in account that is not a member.

### 4. Tag v0.1.0

1. **Merge one last pull request that dates the release.** In `CHANGELOG.md`, the heading `## [0.1.0] - not yet tagged`: put the release date in place of "not yet tagged". Commits must be signed off (`git commit -s`), like any other.
2. **Check that `CHANGELOG.md` has its `0.1.0` entry** and that `package.json` says `"version": "0.1.0"`.
3. **Tag the merged commit:**

   ```sh
   git switch main && git pull --ff-only
   npm ci && npm run check
   git tag -a v0.1.0 -m "floorkit-catalog v0.1.0"
   git push origin v0.1.0
   ```

**Verify:**

```sh
grep -n "not yet tagged" CHANGELOG.md                # prints nothing
git ls-remote --tags origin 'v0.1.0*'                # the tag, and its ^{} commit
node tools/immutable.mjs                             # immutability: N released file(s) across 1 tag(s) checked against HEAD.
```

From now on, `tools/immutable.mjs` fails any change that modifies, deletes or renames a file under `blocks/`.
- **Confirm it runs in CI, not just locally.** Open the next pull request's `validate` run, job `catalog`. Its **Released blocks unchanged** step must say `immutability: N released file(s) across 1 tag(s) checked against HEAD.`
- **If it still says `NOT ENFORCED`,** the CI checkout fetched no tags, and the gate is not running. The workflow checks out with `fetch-depth: 0` so that it gets them; a shallow checkout fetches none.

**Never move or re-create `v0.1.0`.** Loaders pin to it, and once jsDelivr has fetched a tag's files it keeps them in permanent storage ([jsDelivr README](https://github.com/jsdelivr/jsdelivr)), so a re-created tag could serve different bytes from git and from jsDelivr. A mistake in a block is fixed by a new block version in a new tag. A mistake in the docs needs no tag at all.

### 5. Check the credit URL resolves anonymously

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/OpenGeometry-io/floorkit-catalog
```

**Expect** `200`. Before item 1 the same command answers `404`, which is why the warning at the top exists.

Also open both URLs in the credit line in a signed-out browser window: the repository and `https://creativecommons.org/licenses/by/4.0/`.

### 6. Check jsDelivr serves the tag, and the blocks match the index

Wait until items 1 and 4 are done before requesting the jsDelivr URL at all. Whether jsDelivr caches a failed lookup, and for how long, is unverified.

```sh
BASE=https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0

# 1. It serves the index.
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/index.json"   # 200

# 2. It serves exactly the tagged bytes: the two digests must be equal.
curl -sf "$BASE/index.json" | sha256sum
git show v0.1.0:index.json | sha256sum

# 3. Every block matches its sha256 and byte count in that index (run from the repository root).
node --input-type=module -e "
import { openCatalog } from './tools/loader.mjs';
const catalog = await openCatalog({ baseUrl: '$BASE/' });
for (const entry of catalog.list()) await catalog.load(entry.id);
console.log('verified', catalog.list().length, 'blocks from', catalog.baseUrl);
"
# verified N blocks from https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0/

# 4. Browsers can read it cross-origin (the loader in a page needs this).
curl -sI -H 'Origin: https://example.com' "$BASE/index.json" | grep -i '^access-control-allow-origin'
```

What each step proves:
- **Step 2** ties what jsDelivr serves to the tag in git.
- **Step 3** ties every block to that index.
- **Step 3 also checks redirects.** In Node, the loader refuses any redirect with `CatalogError` code `redirected`, so a pass also shows that jsDelivr answers without one.
- **A failure in step 3 usually names the file and the reason.** Check the `CatalogError` code: `integrity`, `too-large`, `redirected` or `fetch-failed`.

**Measured so far:** the step 3 command was run against a local HTTP server (`python3 -m http.server`) serving this repository at commit `d8161de` on 2026-10-31, and printed `verified 80 blocks from http://127.0.0.1:8765/`: with the loader's default `maxFormat` 1 it reads the 80 format 1 entries. The same loop with `openCatalog({ baseUrl, maxFormat: 2 })`, loading each entry by its version, printed `verified 91 entries from http://127.0.0.1:8765/`. It has **not** been run against jsDelivr: `cdn.jsdelivr.net` was unreachable from where this file was written. Step 4's expected `access-control-allow-origin: *` is also unverified.

### 7. Point Parti's credit and `basedOn` at this repository

This is a follow-up in `OpenGeometry-io/parti`, as its own pull request there. Parti's system blocks are copies of the 26 Floorkit example assets this catalog was seeded from, and they still credit the old source. They are copies from before the redraw: of those 26 assets, 23 are in this catalog with new geometry, and three were deleted (`rectangular-bathtub`, `wc-and-basin` and `counter-run`). A `parti:basedOn` that names a block here therefore names a different drawing, unless Parti imports the redrawn block. In Parti's `scripts/blocks/importCatalog.mjs`, which writes both:

| Key | Today | After launch |
| --- | --- | --- |
| `parti:attribution` | `"OpenPlans"` | The credit line from [LICENSE.md](../LICENSE.md) |
| `parti:basedOn` | `openplans@8a964fb:examples/src/catalog/assets/…` | This repository and tag, for example `OpenGeometry-io/floorkit-catalog@v0.1.0:blocks/floorkit/<slug>/1.0.0.op` |

Also update `packages/blocks/src/__tests__/system.test.ts`, which expects `'OpenPlans'`.

Re-importing changes every system block's content hash and `assetRef`, because metadata is part of the hash. A Parti plan keeps a copy of every definition it uses (`packages/blocks/src/layer.ts`), so existing plans should keep drawing; that was read from the code, not tested. Whether to bump `parti:version` is Parti's decision. [RFC 0001](rfcs/0001-catalog-and-loader.md#parti-integration) lists what else Parti needs before it can read this catalog directly.

**Verify, in a Parti checkout:**

```sh
grep -rl '"parti:attribution": "OpenPlans"' packages/blocks/system | wc -l              # 0
grep -rL 'OpenGeometry-io/floorkit-catalog' packages/blocks/system --include='*.op' | wc -l   # 0
```

Both print 26 today (measured at Parti `23abace`). Parti's own test suite must pass as well.

### 8. Announce

1. **Optionally publish a GitHub release from the tag:**

   ```sh
   gh release create v0.1.0 --repo OpenGeometry-io/floorkit-catalog --title v0.1.0 --notes "See CHANGELOG.md."
   ```

2. **Announce it** wherever Floorkit news goes. Include:
   - the repository URL;
   - the pinned base URL `https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0/`;
   - the credit line;
   - a pointer to [CONTRIBUTING.md](../CONTRIBUTING.md).

**Verify:**
- Every link in the announcement opens in a signed-out browser window.
- `gh release view v0.1.0 --repo OpenGeometry-io/floorkit-catalog` shows the release, if you made one.
