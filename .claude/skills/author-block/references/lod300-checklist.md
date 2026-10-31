# LOD 300 checklist

Tick every line against the pictures `tools/render.mjs` writes for the block (`renders/<publisher>/<slug>/<version>/`). One line, one check; the section in brackets is the rule in [docs/drafting-standard.md](../../../../docs/drafting-standard.md). A line that cannot be ticked is fixed, or explained in the pull request; a line that does not apply is marked N/A with a word of reason ("N/A: no ports").

## Plan tick (`plan-1-50.svg`, `plan-1-100.svg`, `overlay.svg`)

- [ ] At 1:100 the symbol reads as the object by its outline and at most two interior lines (§5).
- [ ] The outline is the body's top-down silhouette, proud handles included: in `overlay.svg` the red outline sits on the grey body within 5 mm, except a door's swing arc (§5).
- [ ] Nothing in the symbol is finer than 0.03 m (§5).
- [ ] The symbol shows what the category's row asks for at 1:100 and at 1:50 (§10).
- [ ] Closed outlines are polygons; every circle shows on the paper plan (two half arcs, not one full arc) (§5).
- [ ] Nothing hidden by the top of the object is drawn (legs under a top, under a seat) (§5).
- [ ] An overhead item says "overhead" in its label or note (§5).
- [ ] The origin cross in `overlay.svg` is at the centre of the footprint, and the back of the block is at the top of the plan (−z) (§1).

## 3D tick (`iso`, `front`, `side`, `elevation-1-50.svg`)

- [ ] From the isometric view the body reads as the object, not as a box.
- [ ] Every part the category's row lists is present as its own solid (§10).
- [ ] At least 3 solids (§3).
- [ ] Heights are true: each height in the note (`seat`, `rim`, `top`, `at`, `ceiling`, `bottom`, `underside`) is a horizontal face in the front or side view; `bottom` is the casing's, not a connection's; the note's prose reads as no height or marker by accident (§2).
- [ ] `dimensions` equal the body's overall extent within 5 mm (§2).
- [ ] The body stands on the floor, or on the ground the note names; no part floats (§1, §3).
- [ ] Nothing goes below the floor unless the note says `recess` (§2).
- [ ] Hollow objects are hollow, drawn by an allowed boolean or by plate with hole plus liner; a coaxial cutter is as tall as its base, a plate cutter 10 mm past each face (§3).
- [ ] No part is thinner than 10 mm, and no part is hidden inside another (§3).
- [ ] `parity.mjs --build --mesh` reports no overlap, or only pairs the note lists that §4 allows (§4).
- [ ] Every part's colour is its `mat:` role's palette colour, and the roles are plausible (wood is `frame`, a tap `metal`, a basin `ceramic`) (§6).
- [ ] No cylinder has an `angle`; a cylinder turned about x or z has an even side count in `parity.mjs --build --mesh`; a round part under radius 0.04 is at true size and the note says it builds as a prism (§3).

## Data tick

- [ ] Every anchor's name and role are in the table, and each anchor sits on the body or under the footprint's edge (§7).
- [ ] Every port's id, domain, `systemType`, direction and size are from the table, and the port sits on a face; a `power` port states `amperage` on an appliance with its own circuit and leaves it out, saying so in the note, on a luminaire (§8).
- [ ] `ifc:class` is set; a block with a port or of type `MEP_EQUIPMENT` also sets `ifcClass` to the same value (§9).
- [ ] `catalog:lod` is `"300"`; `catalog:basedOn` names the dimension source (§11).
- [ ] The label is plain British English with no brand (§14).
- [ ] The version bump matches the change (§14).
