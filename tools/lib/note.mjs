// SPDX-License-Identifier: Apache-2.0
/**
 * The keywords a block's `catalog:note` may carry for the tools, read in one
 * place. The note stays free text for people; a keyword is one phrase in it.
 *
 * - `overlap <nodeA>+<nodeB>`: the two nodes are meant to interpenetrate (a
 *   kick inside a carcass, say), so the mesh check does not report the pair.
 *   Node names are as Floorkit names a 3D node: its `id`, or the definition
 *   key of an unnamed ref.
 */
const OVERLAP = /\boverlap ([A-Za-z][A-Za-z0-9_-]{0,63})\+([A-Za-z][A-Za-z0-9_-]{0,63})(?![A-Za-z0-9_-])/g;

/** The keywords of one note. `overlaps` holds each pair as `a+b`, sorted. */
export function parseNote(note = '') {
  const overlaps = new Set([...String(note).matchAll(OVERLAP)].map((match) => [match[1], match[2]].sort().join('+')));
  return { overlaps };
}
