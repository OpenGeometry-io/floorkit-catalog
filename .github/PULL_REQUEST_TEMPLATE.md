## Summary

<!-- What does this pull request add or change, and why? For a block: its id and version, for example `your-name.stacking-chair` 1.0.0. -->

## Provenance

<!--
Fill this in for every block added. A pull request that adds no block: write "No blocks" and skip the boxes.
The rules are in CONTRIBUTING.md, "Provenance rules". Never copy geometry or linework from manufacturer CAD or BIM files, or from BIM portals.
-->

Where the geometry and the dimensions came from. Tick every box that applies:

- [ ] Geometry: I drew it myself, and copied it from no one's files.
- [ ] Dimensions: my own, or my own measurements of a generic object.
- [ ] Dimensions: from a public data sheet. Data sheet: <!-- link -->
- [ ] On behalf of a verified publisher who holds the rights. Authorisation: <!-- link or quote; see GOVERNANCE.md, "Publisher tiers" -->

AI assistance:

- [ ] AI assistance was used. Which parts (geometry, metadata, text) and how you checked them: <!-- describe -->

<!-- Leave the AI box unticked only if no part of this pull request was AI-assisted. -->

## Verification

<!--
Paste the output of `npm run check` (at least its last lines), and say what else you checked and how.
For a block, also say how you checked that its plan symbol, body, dimensions and insertion point are right.
Record any failure or skip you could not resolve, and why.
-->

```text

```

## Docs and examples

<!-- Did you update docs or examples? If not, why were they not needed? -->

## Reviewer notes

<!-- Anything you want reviewers to focus on, such as the semver bump of a new block version or a rule you were unsure about. -->

## Checklist

- [ ] I ran `npm run check` and pasted its output under Verification.
- [ ] Every commit is signed off (`git commit -s`), by its author.
- [ ] No trademarks or brand names in labels (community tier).
- [ ] I did not edit a released block, and I did not hand-edit `index.json` (it is regenerated with `npm run index`).
- [ ] I updated docs when user-facing behaviour changed.
