# Governance

How decisions are made in floorkit-catalog: who maintains it, what publisher tiers mean, how changes are merged and released, how a block is withdrawn, and how the format changes.

## Maintainers

| Maintainer | Role |
| --- | --- |
| [@aka-blackboots](https://github.com/aka-blackboots) | Owner and, at present, the only maintainer |

Maintainers:
- review and merge pull requests;
- grant and withdraw the `verified` and `official` tiers;
- tag releases;
- decide revocations and takedowns;
- accept or reject RFCs.

The owner adds maintainers and lists them here. Where maintainers disagree, the owner decides.

## Publisher tiers

Every block belongs to a publisher listed in [`publishers.json`](publishers.json) as `{ id, name, tier, url }`. The tier is copied into every `index.json` entry for that publisher, so applications can show it.

| Tier | Who | How it is granted |
| --- | --- | --- |
| `official` | The Floorkit project itself: the seed publisher `floorkit`, the only `official` publisher at v0.1.0 | By maintainers only |
| `verified` | A publisher that controls a domain and holds the rights to what it publishes, such as a manufacturer publishing its own products | By maintainers only, on the evidence below |
| `community` | Everyone else. Generic designs only ([CONTRIBUTING.md](CONTRIBUTING.md#provenance-rules)) | Automatically: every new publisher starts here |

**To become `verified`**, ask for it in a pull request (it can be the one that adds you as a publisher), and record two things in it:
1. **The domain.** Your `url` is on a domain you control. A maintainer confirms that control by a means they choose, and says in the pull request how it was confirmed.
2. **Authorisation from the rights holder.** A statement from the holder of the rights in the content you will publish (for a manufacturer, the manufacturer itself), authorising you to publish it under this repository's licences. Link it or quote it in the pull request.

If both hold, a maintainer sets the tier in `publishers.json` in that pull request.

**What a tier is, and is not:**
- **It is plain data.** No tool checks who changed `publishers.json`; maintainer review is the only control on it. A tier is raised only by a maintainer's decision, recorded in the pull request.
- **It says who publishes, not that a block is correct.** Every tier passes the same validation and the same review.
- **It can be lowered.** Maintainers lower a tier when its evidence no longer holds, for example when an authorisation is withdrawn.
- **Changing it changes no block file.** It changes `publishers.json` and the generated `index.json`, so it never conflicts with [immutability](#releases).

## Review and merge

- **Every change goes through a pull request to `main`,** including maintainers' own.
- **CI must pass.** The checks are listed in [CONTRIBUTING.md](CONTRIBUTING.md#what-ci-checks). From launch, branch protection on `main` requires the `validate` workflow's two jobs, `catalog` and `reuse`, and blocks force pushes and deletion ([docs/LAUNCH.md](docs/LAUNCH.md) item 2).
- **A maintainer approves and merges.**
  - While there is one maintainer, the maintainer may merge their own pull requests once CI passes.
  - Once there are two or more, a maintainer's own pull request needs another maintainer's approval.
- **These files need the most care,** because a change to them changes what every block is held to or how it is trusted:
  - `publishers.json` tiers;
  - `revocations.json`;
  - `schema/`, `tools/` and `.github/`;
  - `LICENSE.md`, `LICENSES/` and `REUSE.toml`.
- **Maintainers may run Floorkit parity** (`FLOORKIT_DIR=<a Floorkit build> node tools/parity.mjs --build`) before merging. CI cannot run it until `@opengeometry/floorkit` is published on npm.

## Releases

**A catalog release is an annotated git tag `vX.Y.Z` on `main`.** Loaders pin their URLs to a tag, for example `https://cdn.jsdelivr.net/gh/OpenGeometry-io/floorkit-catalog@v0.1.0/`, so a tag is the moment a file becomes something people depend on.

To release:

```sh
git switch main && git pull --ff-only
npm ci && npm run check
# CHANGELOG.md has an entry for X.Y.Z, and package.json says "version": "X.Y.Z"
git tag -a vX.Y.Z -m "floorkit-catalog vX.Y.Z"
git push origin vX.Y.Z
```

**Never move, delete or re-create a tag.** A mistake in a block is fixed by a new block version in a new tag.

**Immutability is enforced from the first tag.**
- `node tools/immutable.mjs` compares `blocks/` at HEAD with every `v*` tag in the clone. A file in any tag must be unchanged. It fails on a shallow clone rather than passing.
- Only additions are allowed. A modified, deleted, renamed or re-moded file fails, and so does a symbolic link anywhere under `blocks/`.
- Before the first tag nothing has been released, and it prints `immutability: NOT ENFORCED — no v* tag yet, so no block has been released.` rather than passing quietly.
- CI must fetch tags for this to work: a shallow checkout fetches none, and the check would then report `NOT ENFORCED` after a release too. The `validate` workflow checks out with `fetch-depth: 0` for this reason, and [docs/LAUNCH.md](docs/LAUNCH.md) item 4 confirms it on the first pull request after the tag.
- In CI it runs on pull requests only, and looks for the tag from the pull request's base commit.

**What a tag does not protect against.** The tools cannot stop someone with write access from moving a tag, and `index.json` is not signed yet. Whether the organisation's plan can restrict who updates `v*` tags is unverified. [RFC 0001](docs/rfcs/0001-catalog-and-loader.md#integrity-and-trust-model) sets out the trust model and the planned signed pointer.

## Deprecate or revoke

These are different things.

| | Deprecate | Revoke |
| --- | --- | --- |
| **Means** | A better version or a replacement exists; the old one is still fine to use | The block must not be placed again |
| **Typical reason** | A new MAJOR version; a better block | A rights claim, a licensing error, harmful content |
| **Recorded in** | `CHANGELOG.md` and the release notes, naming the replacement | [`revocations.json`](revocations.json) |
| **In `index.json`** | Nothing yet: the v1 index has no field for it ([RFC 0001, open question 6](docs/rfcs/0001-catalog-and-loader.md#open-questions-for-the-owner)) | The entry gains `revoked: { at, reason }` |
| **In the reference loader** | Keeps resolving | `load()` throws `CatalogError` with code `revoked`, giving the date and the reason. `list()` leaves it out unless called with `{ includeRevoked: true }`. `find(id)` without a version prefers the newest version that is not revoked |

**A revocation** is one object in `revocations.json`. For example (an illustration, not a real revocation):

```json
[
  {
    "publisher": "your-name",
    "slug": "stacking-chair",
    "version": "1.0.0",
    "at": "2026-10-05",
    "reason": "Withdrawn at the rights holder's request."
  }
]
```

- **All five fields are needed.** `tools/build-index.mjs` refuses an entry without `at` or `reason`, and an entry that names no block in `blocks/`.
- **Write `at` as an ISO 8601 date.** The index schema accepts any non-empty string, but Parti requires a date it can parse.
- **`reason` is public.** Keep it factual, and leave out personal data.
- **Then rebuild and commit the index** (`npm run index`), and tag a release. Loaders see the revocation only in indexes at that tag and later.
- **The file itself stays.** A released file is never deleted. A block that has never been in a tag can simply be removed instead.

## Takedowns

For a rights holder who believes a block infringes their rights, or anyone who finds a licensing error.

**How to ask:**
- **Publicly:** open an issue using the takedown template ([new issue](https://github.com/OpenGeometry-io/floorkit-catalog/issues/new/choose)).
- **Privately,** when a public issue would itself cause harm: use the private route in [SECURITY.md](SECURITY.md#how-to-report).

Name the block id and versions, the right you hold, and how to reach you.

**What maintainers do:**
1. Acknowledge the request, and ask for anything missing.
2. Assess it. The maintainers are not lawyers, and nothing here is legal advice.
3. If the block has to go, **revoke it in the next release**, as [above](#deprecate-or-revoke). A block that has never been in a tag is deleted instead.
4. Say on the issue, or privately, what was done and in which release.

**What a takedown cannot do:**
- **Erase released copies.** Copies already released in a tag stay in that tag and in git history. Copies served by a CDN such as jsDelivr, or published to npm once a package exists, cannot be erased by this repository.
- **Reach older tags.** An index at an earlier tag does not mark the block revoked, so a loader pinned to that tag can still load it.
- **Recall embedded copies.** A Floorkit project can embed a block's definition (an `embedded-op` asset), and a Parti plan keeps a copy of every definition it uses. Those copies keep working. Revocation stops new placements through a loader that respects it.
- **Withdraw the licence.** CC BY 4.0 is irrevocable (§2(a)(1)) for material that was validly licensed under it.

Rights holders can also use GitHub's own process ([Terms of Service, section F](https://raw.githubusercontent.com/github/site-policy/main/Policies/github-terms/github-terms-of-service.md)). That route belongs to GitHub, and how it would treat a tagged release is unverified.

## Changes to the format and the schema

The format has two versioned schemas:

| What | Schema | Identifier |
| --- | --- | --- |
| A block (`.op` v1) | [`schema/op/v1.schema.json`](schema/op/v1.schema.json) | `"version": 1` in every block |
| A block (`.op` format v2, [RFC 0004](docs/rfcs/0004-format-v2.md)) | [`schema/op/v2.schema.json`](schema/op/v2.schema.json) | `"catalog:format": "2"` in root `metadata`; `"version"` stays `1` |
| The index | [`schema/index/v1.schema.json`](schema/index/v1.schema.json) | `"schema": "floorkit.catalog/v1"` |

**A change within v1** comes as an ordinary pull request with tests, and stays inside two limits:
- **Every released block must stay valid.** Released blocks never change, and `npm run check` validates every one of them, so a tightening that breaks one fails CI.
- **The catalog must stay stricter than Floorkit.** It rejects anything Floorkit would repair. A loosening must keep that true, and maintainers re-run `tools/parity.mjs`.

**These need an RFC first** (below):
- anything that makes an existing reader refuse a catalog it accepted before. For example, Parti holds categories and tiers as closed lists, so a 14th category in `categories.json` and the schema would make the whole index unreadable to a Parti built before it ([RFC 0001](docs/rfcs/0001-catalog-and-loader.md#parti-integration));
- a new field in `index.json`, since the index schema is closed;
- a new major version of either format.

**An RFC** is a pull request adding `docs/rfcs/NNNN-short-title.md`, numbered after the last one ([0001](docs/rfcs/0001-catalog-and-loader.md) is the model). It says what changes, why, what it breaks and what was measured. Maintainers accept or reject it in that pull request.

**A new major version gets a new schema path beside the old one.** For example, `schema/op/v2.schema.json` sits next to `schema/op/v1.schema.json`. The v1 schema stays for as long as released blocks use it, which in practice is permanently.
