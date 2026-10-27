// SPDX-License-Identifier: Apache-2.0
/**
 * The seed blocks not yet redrawn to `docs/drafting-standard.md`, each with the
 * sha256 of its `blocks/floorkit/<slug>/1.0.0.op` bytes. Every check added for
 * LOD 300 blocks (the geometry gates, `catalog:lod`, anchor roles, ports, IFC)
 * skips exactly those files: the right path, version 1.0.0 and the same bytes.
 * Any other copy of a seed, in `blocks/` or outside it, gets every check.
 * The list only shrinks: each family issue removes its own slugs as it lands
 * their redraw, and the file is deleted once it is empty.
 */
export const PENDING_REDRAW = Object.freeze({
});
