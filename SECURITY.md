# Security policy

## Scope

**In scope:**

- **Blocks that harm whoever loads them.** A malicious or malformed block that crashes, hangs or exhausts memory in a loader or in Floorkit, above all one that passes `node tools/validate.mjs`. For example, geometry that stays inside the [limits](docs/format-v1.md#9-limits-and-why) but still takes very long to build, or a label that passes the label rules and still injects markup into an application.
- **Getting past the reference loader.** Any way to make [`tools/loader.mjs`](tools/loader.mjs) do one of these:
  - return bytes that do not match `index.json`;
  - follow a redirect;
  - fetch from outside the catalog root;
  - read more bytes than the index promised;
  - return a revoked block;
  - return a file whose `id` or version disagrees with its entry.
- **The tools and CI.** For example:
  - a pull request that gets the GitHub Actions workflow to run with write access or read secrets;
  - a way past the gates (`tools/immutable.mjs`, `tools/dco.mjs`, `node tools/build-index.mjs --check`);
  - input that makes `tools/validate.mjs` itself hang or crash.

**Known limitations, not new vulnerabilities.** These are documented in [RFC 0001](docs/rfcs/0001-catalog-and-loader.md#integrity-and-trust-model). A report that shows a new way to exploit one of them is still welcome.

- `index.json` is not signed. A compromised CDN or mirror that changes the index and the blocks together is not detected.
- An old index served in place of a new one (rollback), or updates that stop (freeze), are not detected beyond pinning an exact tag.
- The loader's byte cap for a block is the index's own number, so a forged index can raise it.
- An application that fetches `.op` files without the loader gets no checks at all.

**Out of scope here:**

- **Floorkit itself** is maintained elsewhere. If a block from this catalog triggers a flaw in Floorkit, report it here and the maintainer will pass it on.
- **jsDelivr, GitHub and npm** have their own reporting channels.
- **A rights or licensing problem with a block** is a takedown, not a vulnerability. See [GOVERNANCE.md](GOVERNANCE.md#takedowns).

## How to report

**Do not open a public issue, discussion or pull request for a vulnerability**, and do not put a working exploit block in one.

The same private route takes a takedown request that should not be public ([GOVERNANCE.md](GOVERNANCE.md#takedowns)) and a conduct report ([CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)). Say which kind of report it is.

Use GitHub's private vulnerability reporting on this repository:

1. Open <https://github.com/OpenGeometry-io/floorkit-catalog/security>.
2. Choose **Report a vulnerability**.
3. Describe:
   - what is affected: file, block id and version, tag or commit;
   - how to reproduce it: a block, a command or a script;
   - the impact;
   - a fix, if you have one in mind.

## What happens next

- **The maintainer acknowledges the report and investigates.** There is one maintainer at present, so no response time is promised.
- **A fix to the tools or CI** is prepared, privately if it needs to be, and released in a new tag.
- **A harmful block is revoked,** because a released block can never be changed ([GOVERNANCE.md](GOVERNANCE.md#deprecate-or-revoke)). Copies already embedded in projects are not recalled.
- **You are credited** in the release notes unless you prefer not to be.

## What the catalog already defends against

**Validation**, which CI runs on every block for every pull request and every push to `main` ([docs/format-v1.md](docs/format-v1.md)):

| Defence | Detail |
| --- | --- |
| Size and complexity limits | 256 KB per file; 400 nodes; 400 elements per view; 1,024 points per list; 64 ports; 16 operands per boolean; per-field numeric bounds ([§9](docs/format-v1.md#9-limits-and-why)) |
| Exponential builds | A block may build at most 1,000 nodes once references are expanded. Floorkit rebuilds a referenced definition each time it is used, so a chain of booleans that reuses the previous level twice costs 2^n builds while validating in linear time. `test/op.test.mjs` checks that a 22-level chain is refused |
| Plain data | Every number finite; no key that exists on `Object.prototype` (`__proto__`, `constructor` and the like); references resolve by own property, to the right kind, with no cycles |
| Labels | 1–80 characters, with no `<`, `>`, control characters or `://` |
| Closed structure | Every object is closed, root metadata is a closed vocabulary, and the file must be in canonical bytes (no BOM, CRLF or duplicate keys) |
| Identity | A block's path, `id` and version must agree, it must be a regular file (no symbolic links), and its publisher must be listed |
| History | Checked on pull requests. From the first tag, released blocks cannot be modified, deleted or renamed (`tools/immutable.mjs`); every non-merge commit carries a DCO sign-off from its author (`tools/dco.mjs`) |

**The reference loader** ([`tools/loader.mjs`](tools/loader.mjs)) checks every block against `index.json` before returning it. Each refusal is a `CatalogError` with a `.code` ([RFC 0001](docs/rfcs/0001-catalog-and-loader.md#the-reference-loader)):

| `code` | Refused |
| --- | --- |
| `fetch-failed` | A network error, a timeout before the response arrives (10 s per request by default), or a status that is neither 2xx nor a redirect |
| `redirected` | Any redirect. In a browser, `fetch` does not say why it failed, so a redirect there is still refused but reported as `fetch-failed` (read from the code; no browser test exists) |
| `too-large` | More bytes than expected: the index over its cap (4 MB by default), or a block over the byte count its entry promises, checked while streaming |
| `malformed` | An index that is not UTF-8 or JSON, is not a `floorkit.catalog/v1` index, or has no `entries`; a block that is not UTF-8 |
| `outside-root` | An entry path with `..`, `.` or an empty segment, or one that resolves outside the base URL |
| `not-found` | An unknown id or version |
| `revoked` | A revoked entry |
| `integrity` | A length or SHA-256 that differs from the index, or a file whose own `id` or `catalog:version` differs from its entry |

Two more failures get a code:
- **A timeout or network error while a body is streaming** is `fetch-failed`: the loader enforces its deadline on every read, so a host that keeps sending slowly cannot outlive it.
- **A file that matches its SHA-256 but is not JSON** is `malformed`, and so is an index entry whose `bytes` or `sha256` is missing or out of range (a block is at most 256 KB).

**Measured:** `test/loader.test.mjs` serves the real catalog from a local HTTP server, loads and verifies every block in `index.json` (80 when this was written), then serves it lying in each of these ways: a tampered file, an oversized file sent chunked with no `content-length`, a revoked entry, an entry path that escapes the root, a file claiming to be a different block, a redirect, an unknown id, a percent-encoded `..%2F` path, an entry claiming 10^12 bytes, a non-JSON file with a matching hash, a body that stalls, and a server error. Each gets the code it should.

**What the loader does not do:**
- verify a signature over the index;
- validate a block's content again in the client. The loader trusts that CI validated it.

[RFC 0001](docs/rfcs/0001-catalog-and-loader.md) discusses both: a signed pointer, and a strict validator in the Floorkit SDK.
