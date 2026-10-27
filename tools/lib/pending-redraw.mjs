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
  bathtub: '12474e20c6d8fe103ea47697fdbfc1c4ef459402d9d2f88bcb72a4988bb16aae',
  'rectangular-bathtub': '6bd72cb0e46cb6e0f6833155fab36c0d3f73f66fd7f7f1e0be1349268ab10270',
  'shower-tray': 'd908bde1230cf1a4c2400fa1b37263befb4f8b88101bb7ea1b2f00043a2e0513',
});
