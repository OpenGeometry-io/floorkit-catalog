// SPDX-License-Identifier: Apache-2.0
/**
 * The keywords a block's `catalog:note` carries for the tools, read in one
 * place. The note stays free text for people; a keyword is one phrase in it,
 * standing anywhere and set apart by a space, a comma or a full stop. The
 * grammar is `docs/drafting-standard.md` §2, copied into `docs/format-v1.md` §7:
 *
 *   <height keyword> <metres>   at | ceiling | seat | rim | top | bottom | underside,
 *                               then metres with two decimals: "seat 0.45"
 *   overlap <nodeA>+<nodeB>     two node names joined by "+": "overlap carcass+kick"
 *   <marker>                    recess | carcass | slab | swing, as a whole word
 *
 * Node names are as Floorkit names a 3D node: its `id`, or the definition key
 * of an unnamed ref.
 */
export const HEIGHT_KEYWORDS = Object.freeze(['at', 'ceiling', 'seat', 'rim', 'top', 'bottom', 'underside']);
export const MARKERS = Object.freeze(['recess', 'carcass', 'slab', 'swing']);

const NAME = '[A-Za-z][A-Za-z0-9_-]{0,63}';
const OVERLAP = new RegExp(`\\boverlap (${NAME})\\+(${NAME})(?![A-Za-z0-9_-])`, 'g');
const HEIGHT = new RegExp(`(?<![A-Za-z0-9_+-])(${HEIGHT_KEYWORDS.join('|')}) (\\d+(?:\\.\\d+)?)(?![0-9.]*[0-9])`, 'g');
const MARKER = new RegExp(`(?<![A-Za-z0-9_+-])(${MARKERS.join('|')})(?![A-Za-z0-9_+-])`, 'g');

/**
 * The keywords of one note: `overlaps` holds each pair as `a+b`, sorted;
 * `heights` maps each height keyword to the values given; `markers` is a set;
 * `problems` lists a height keyword whose number is not written with two decimals.
 */
export function parseNote(note = '') {
  const text = String(note);
  const overlaps = new Set([...text.matchAll(OVERLAP)].map((match) => [match[1], match[2]].sort().join('+')));
  const heights = Object.fromEntries(HEIGHT_KEYWORDS.map((keyword) => [keyword, []]));
  const problems = [];
  for (const match of text.matchAll(HEIGHT)) {
    if (/^\d+\.\d{2}$/.test(match[2])) heights[match[1]].push(Number(match[2]));
    else problems.push(`"${match[0]}" needs metres with two decimals ("${match[1]} ${Number(match[2]).toFixed(2)}")`);
  }
  const markers = new Set([...text.matchAll(MARKER)].map((match) => match[1]));
  return { overlaps, heights, markers, problems };
}
