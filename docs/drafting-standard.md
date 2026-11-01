# Drafting standard for catalog blocks

This page says how a block must be drawn so that it reads like the work of a senior BIM author: where its origin sits, what its plan symbol shows, which parts its body has, which heights are true, and how it names its anchors and ports. [`format-v1.md`](format-v1.md) and [`format-v2.md`](format-v2.md) say what a block may contain; this page says what a good block does contain. Where the two disagree, the format and the tools win, and the difference is a bug in this page.

"Must" is a rule a reviewer refuses a block for. "Should" is a rule a reviewer may waive with a reason in the pull request. Rules that a tool checks name the tool.

The [`author-block` skill](../.claude/skills/author-block/SKILL.md) is the order of work; its [`lod300-checklist.md`](../.claude/skills/author-block/references/lod300-checklist.md) is the reviewer's tick list.

## Contents

1. [Origin, axes and grounds](#1-origin-axes-and-grounds)
2. [Dimensions, heights and note keywords](#2-dimensions-heights-and-note-keywords)
3. [The body at LOD 300](#3-the-body-at-lod-300)
4. [Overlapping parts](#4-overlapping-parts)
5. [The plan symbol](#5-the-plan-symbol)
6. [Material roles and colours](#6-material-roles-and-colours)
7. [Anchors](#7-anchors)
8. [Ports](#8-ports)
9. [IFC class](#9-ifc-class)
10. [Per category](#10-per-category)
11. [Where the numbers come from](#11-where-the-numbers-come-from)
12. [Drafting rules D1 to D18](#12-drafting-rules-d1-to-d18)
13. [What the format cannot draw](#13-what-the-format-cannot-draw)
14. [Labels, attribution and versions](#14-labels-attribution-and-versions)

## 1. Origin, axes and grounds

- **The origin is on the floor at the centre of the footprint** (`x` and `z` halfway across the body's plan bounds, `y = 0`). It is the insertion point and the `base` anchor.
- **The back is at −z.** A block placed against a wall has its back face at `z = −depth/2`, with the `wallFace` anchor there. The front, the side a person uses, faces +z.
- **Wall-hung and ceiling items keep the origin on the floor** beneath them. Their mounting height is baked into the geometry and stated in `catalog:note` (`underside 1.40` for a wall unit, `ceiling 2.40` for a ceiling-hung item; section 2). An item set into or onto a counter (a hob, an inset sink) states the counter's height with `at 0.90`.
- **Contact grounds.** Every part must touch another part or one of these grounds, so nothing floats:
  - the floor, `y = 0`;
  - the wall plane, the plane `z` of the `wallFace` anchor;
  - the ceiling plane, `y` given by `ceiling <m>` in the note;
  - the counter plane, `y` given by `at <m>` in the note.
- **Items placed on furniture** (a table lamp) stand at `y = 0` on their own foot, with `base` role `surface-contact` and no `at`.
- **Units** are those of the format: metres, geometry angles in radians, placement rotations in degrees ([format §1](format-v1.md#1-units-and-coordinates)).

## 2. Dimensions, heights and note keywords

- **`dimensions` are the overall extent of the body**: `width` = the body's x extent, `depth` = z, `height` = y, from the lowest to the highest point of any solid, each within 0.005 m. A tap, a fan disc or a handle that stands proud is part of the extent.
- **A part height that matters is a note keyword, not a dimension.** A seat at 0.45 m, a rim at 0.85 m, an underside at 1.40 m: write them in `catalog:note`.
- **Heights are true.** A keyword's value must equal the height of a horizontal face of the body within 0.005 m.
- **`bottom` is the casing's lowest face.** Connections that hang below the casing (pipe stubs, valves, cable tails, flues) are not its bottom, though they count in `height`: `floorkit.boiler` says `bottom 1.20` with its stubs down to 1.15, and `floorkit.radiator` says `bottom 0.15` with its valves down to 0.10.

Note keywords are lowercase phrases inside the otherwise free `catalog:note` (at most 500 characters). They may stand anywhere in the text, separated from it by a space, a comma or a full stop. The grammar:

```text
<height keyword> <metres>      at | ceiling | seat | rim | top | bottom | underside, then metres with two decimals: "seat 0.45"
overlap <nodeA>+<nodeB>        two node names joined by "+", no spaces: "overlap carcass+kick"
<marker>                       recess | carcass | slab | swing, as a whole word
```

[`format-v1.md` §7](format-v1.md#7-root-metadata) carries the same grammar, and `validate.mjs` reads it.

| Keyword | Meaning |
| --- | --- |
| `at <m>` | The block is set into or onto a counter whose top is at this height (a hob, an inset sink); that plane is a ground. A worktop's own height is `top 0.90` |
| `ceiling <m>` | The block hangs from a ceiling at this height (2.40 unless the block says otherwise) |
| `seat <m>` | Top of the seat |
| `rim <m>` | Top of the rim of a basin, bath, WC pan or sink |
| `top <m>` | Top of a working or serving surface |
| `bottom <m>`, `underside <m>` | Lowest face of a wall-hung or ceiling-hung item; for `bottom`, the lowest face of its casing, connections excepted |
| `recess` | Part of the body goes below `y = 0` on purpose (a level-access shower) |
| `carcass`, `slab` | The block is a box by nature (a cabinet carcass, a clearance slab); exempt only from the volume ratio in section 3. The 3-solid minimum and the parts of section 10 still apply |
| `overlap <a>+<b>` | Nodes `a` and `b` may interpenetrate (section 4) |

Example: `"catalog:note": "Wall-hung basin. rim 0.85, underside 0.68. Waste at the back; overlap counter+tap."`

**The prose is parsed too.** `tools/lib/note.mjs` reads the whole note, not only the phrases meant as keywords:

- A height keyword followed by one space and a number is read as a height wherever it stands, unless a letter, a digit, `_`, `+` or `-` comes right before it. "Mounted at 1.80" is read as `at 1.80`: a counter plane, which must then match a bottom face. A number without two decimals is refused: "at 1.8" or "at 3 points" fails `validate.mjs`.
- A marker counts wherever it stands as a lowercase word with no letter, digit, `_`, `+` or `-` right before or after it. "The carcass sits on a plinth" says `carcass` and waives the volume ratio; "a door swing" says `swing` and takes the arcs out of the plan check. `carcasses`, `recessed` and `swings` are not markers, and neither is a node name inside `overlap carcass+kick`.
- Matching is case-sensitive: only the lowercase words are read.

So word the prose so that neither happens by accident: put a word between a height word and its number ("mounted about 1.80 to its middle", as `floorkit.wall-light` says), and use another word for a marker you do not mean ("case", "body", "floor marking", "door arc").

## 3. The body at LOD 300

The body must read as the object from the isometric view, with the parts the category lists (section 10) at their true heights.

- **At least 3 solids**, and the sum of the solids' volumes below 95 % of the bounding-box volume (the note's `carcass` or `slab` waives the volume ratio only). A body of one box is LOD 100. `validate.mjs` holds a block to both rules when its `catalog:lod` is `300`; a block declaring 100 or 200 is not held to them. `validate.mjs` computes the ratio from the solids' boxes ([format §9](format-v1.md#9-limits-and-why)).
- **No part thinner than 0.01 m** in any direction (glass included, 0.010), and no part wholly hidden inside another.
- **Every part touches** another part or a ground (section 1) within 0.001 m. No floating worktop, no car on wheels that stop short of the floor.
- **Hollows** (bowls, baths, sinks, trays) are drawn hollow. Never put a solid box inside another box to suggest a basin. Two ways are allowed:
  - a boolean in an arrangement measured to build: a vertical through-hole cut from a cuboid or a cylinder by a cuboid or a cylinder, or a cylinder minus a narrower coaxial cylinder. A cuboid minus a cylinder that crosses one of its side faces does not build;
  - plate with hole plus liner: the rim as a plate with a through-hole, and the bowl below it as separate thin walls and a floor that touch the plate's underside.
  Booleans take only `cuboid`, `cylinder` or another `boolean3d` as operands ([format §4](format-v1.md#4-definitions-and-references)). Every block with a boolean is built by a maintainer with `parity.mjs --build --mesh` before it merges.
- **Cutter sizes.** A coaxial cutter (a cylinder minus a narrower coaxial cylinder) must be exactly as tall as its base and level with it: a taller one builds open shells. Every ring in the catalog is drawn so: the pan and seat rings of `floorkit.wc` (0.20 and 0.02 high, cutter and base alike) and the bowl liners of the basins. A through-hole cutter in a plate goes 0.01 m past each face of the plate: `floorkit.wash-basin` cuts its 0.02 rim plate with a cylinder 0.04 high on the same centre.
- **Sweeps** of a list of points only in the case the gates bound as OpenGeometry's `sweep.rs` builds it, as in `floorkit.glazed-door`: the profile centred on its vertex average at the origin (within 0.001 m) and facing +y, the path starting straight up, in one vertical plane, with no turn over 90°. `validate.mjs` refuses any other sweep.
- **Cylinders** stand on their axis along y. A cylinder that lies down is turned 90° by its `placement.rotation`: about x (`[90, 0, 0]`, axis along z: a porthole, as in `floorkit.washing-machine`) or about z (`[0, 0, 90]`, axis along x: a wheel, as in `floorkit.parked-car`). Both are measured to build and to mirror with `parity.mjs --build --mesh`.
- **A lying cylinder needs an even side count.** The kernel builds a cylinder as a prism and decides how many sides it has. Turned about x or z, a prism with an odd count does not land on the reflection of its unmirrored build when a project mirrors the block, so a mirrored wheel can leave the floor. On Floorkit main `b0a084c7` the count followed the radius and could be odd (measured: radius 0.30 gave 20 sides, 0.31 to 0.33 gave 21). On Floorkit 3.0 the count depends on the body's size as well as its radius, and every full cylinder in the catalog built with an even count, 12 to 68 sides, when measured on 2026-10-31 (a Floorkit 3.0 build, kernel 3.0.0). `parity.mjs --build --mesh` checks a lying cylinder's mirror.
- **No partial cylinders in format 1.** A format 1 cylinder with `angle` below a full turn must not be used: when a project mirrors the block (`scale [-1, 1, 1]`), Floorkit moves its centre but does not flip its arc, so the body lands up to its full width off the mirrored plan (measured: 400 mm for a quarter cylinder of radius 0.4). A half cylinder may be drawn as a full cylinder minus a cuboid, but that arrangement is unverified: a maintainer must build it, mirror included, with `parity.mjs --build --mesh` before it merges.
- **Format v2 (the Floorkit 3.0 kinds, [format-v2.md](format-v2.md)).** A block that says `"catalog:format": "2"` keeps every rule above, except the one against partial cylinders, and adds these:
  - **Round parts are drawn as what they are.** A bowl, a knob or a pan is a `revolve` or an outline sweep, a ball a `sphere`, a tapered leg a `cone`, a ring a `torus`; not a stack of cylinders.
  - **A sector is a `cylinder` with `angle` and `startAngle`.** A half-round top is a sector of `angle` π. Floorkit 3.0 reflects a sector's arc when a project mirrors the block (measured on `test/fixtures/valid/v2-pedestal.op`): a maintainer still builds it mirrored with `parity.mjs --build --mesh` before it merges.
  - **An outline sweep is an extrusion:** one vertical path segment from its lower end up, both caps `true`, and the outline's `[0, 0]` at the path's lower end. Its arcs read counter-clockwise seen from above, as every `.op` angle. Check the sense against the plan: `validate.mjs` reports an arc that bulges the wrong way as a body that does not fill its `dimensions` or its plan.
  - **A revolve's outline stays on one side of its axis.** It may lie on the axis along one run of straight edges, which makes a solid revolve (a knob, a pedestal); it must not cross the axis or touch it at a single point, and every other vertex and edge stays more than 0.001 m from it.
  - **Hollows may be a `shell`** of a cuboid, a full cylinder, a sphere, a cone, a torus, a sweep or a boolean of these (never of another shell), with `thickness` at least 0.01. Never a shell of a revolve or a sector, also through a boolean: the kernel cannot build it, and `validate.mjs` refuses it.
  - **A body's placement scale is one number on all three axes**, or Floorkit 3.0 refuses the body. This holds in format 1 too, and `validate.mjs` refuses it in both.
  - **Spheres are heavy.** The shell of a sphere of radius 0.1 m is 83,636 triangles (measured), and a drawing caps a block at 20,000 (unverified here). Use a sphere only where the object needs one, and read the triangle counts in the mesh report.
  - Every block with a format v2 kind is built by a maintainer with `parity.mjs --build --mesh` before it merges, as a block with a boolean is.
- **Thin round parts render polygonal.** The kernel builds a cylinder as a prism and decides its facets, and the count changes with the kernel: on Floorkit main `b0a084c7` a cylinder of radius 0.011 and height 0.42 built with 4 sides and rendered square; on a Floorkit 3.0 build, kernel 3.0.0, the legs of `floorkit.stacking-chair` (radius 0.011, height 0.41) build with 18 sides and the bars of `floorkit.cot` (radius 0.01, height 0.70) with 12 (measured with `parity.mjs --build --mesh` on 2026-10-31). A round part under radius about 0.04 is accepted as a prism: draw it at its true size, not larger to look round, and say so in one line of the note, as `floorkit.wash-basin` does: `Parts under radius 0.04 build as polygonal prisms at true size.` Do not give a side count in a note.
- **Rotations.** Measured to build and to mirror correctly: a cylinder turned 90° about x or about z, with an even side count; a cuboid turned about y; a ref turned about y by any angle (72° measured). A positive angle about y turns +x towards −z. A cuboid turned about z, a tilt of a cuboid about x (splayed legs) and a turn about two axes are unverified: draw parts upright, or have a maintainer build them.
- **Mirroring.** Every block may be mirrored by a project. Floorkit mirrors the body and the plan, but not anchors or ports: an anchor or port off `x = 0` stays where it was. Put anchors on `x = 0` where the object allows; where it cannot (a tap at one end of a bath), say so in the note.
- **Reuse** repeated parts (legs, castors, burners) as one `definitions` entry and refs.
- **Numbers.** Every size comes from section 11: the key-dimension table, or a source the author names in `catalog:basedOn`.

## 4. Overlapping parts

Parts of a real object meet face to face. A solid that runs into another by more than 1 mm is a drawing error, and `parity.mjs --build --mesh` reports it, unless the block lists the pair in its note as `overlap <a>+<b>`.

A block may list a pair only when it is one of these:

| Allowed overlap | Example |
| --- | --- |
| A recessed plinth or kick inside a carcass whose sides run to the floor | `overlap carcass+kick` |
| A fitting seated into its host, by no more than the host's thickness | a tap into a deck or rim, a fan disc into a casing top, a grille or panel into a casing face, a handle into a door |
| Glass in its frame's rebate or a leaf in its frame's rebate | a vision panel in a door leaf |
| A post or column through a base disc or a footrest ring | a stool column through its foot ring |
| A soft part resting into its support by no more than 0.02 m | a cushion on a seat deck |
| A bowl floor set into its bowl wall, by no more than the wall's thickness: the floor lies inside the outline of the bowl wall's outside, runs into the wall by no more than the wall's thickness, and its top is below the wall's top (a maintainer decision, 2026-10-31) | a bidet's bowl floor 0.01 into a wall at least 0.0265 thick, `overlap bowl+bowl-floor`; a urinal's floor 0.015 into a wall 0.03 thick, `overlap bowlWall+floor` |

Everything else must be redrawn so the parts meet:

- a solid inside a solid to fake a hollow (a basin box inside a bath shell, a bowl disc under a counter);
- rails or walls that cross at a corner: butt one against the other (a table apron runs between the legs, not through the next apron);
- two carcasses that overlap at an L-corner: draw them abutting;
- a part pushed into a body to hide its far side (wheels inside a car body, a door disc half inside a washing machine);
- plants pushed into soil: the plant's base sits on the soil top.

## 5. The plan symbol

The plan symbol (`profileView`) is what most users see. It follows practice for furniture and fittings (D11): a light outline at true size, no fill.

- **The outline is the top-down silhouette of the body**, within 0.005 m on each side. Arcs that show a door's swing are outside this rule: a `DOOR` is exempt, and any other block with a swing says `swing` in its note.
- **Proud parts are in the silhouette.** The outline follows a handle that stands proud of a front: `floorkit.fridge-freezer` draws its outline to z 0.325, the front face of its handles, 0.03 in front of the doors.
- **At 1:100 it reads by its outline plus at most two interior lines** (a seat back, a mattress turn-down, a door split). An interior line marks an edge seen from above: for a chair, the front face of the back, where it meets the seat. Detail beyond that is for 1:50 and must still read at 1:100. A block draws one symbol for both scales, so a plan that is the same at 1:50 and 1:100 is fine until plan line roles exist.
- **Nothing finer than 0.03 m.** A gap, a lip or a line spacing under 0.03 m prints as one blot at 1:100: keep an interior line at least 0.03 m from the outline and from other lines, and leave it out for a part thinner than that: a shell back thinner than 0.03 m is drawn by the silhouette alone, not thickened to earn its line.
- **Use polygons for closed outlines**, so the plan draws as regions; loose polylines are for single lines only (a door seam, a nosing line).
- **Circles.** Draw a full circle as two `arc`s of π each. A single `arc` of 2π does not appear on Floorkit's paper SVG (measured against Floorkit main `b0a084c7`: its path starts and ends at the same point, so it draws nothing). Two half arcs each run between two different points and draw (measured the same way, with `tools/render.mjs` on a probe: `M 18 14 A 3 3 0 0 0 12 14` and `M 12 14 A 3 3 0 0 0 18 14` beside the empty `M 17 14 A 2 2 0 1 0 17 14`).
- **One pen.** Floorkit draws every block line with one pen (0.18 mm measured; doors 0.25 mm), in black; node colour never reaches the plan, and there are no dashed or hidden lines. So:
  - draw an overhead item (a wall unit, a hood, an upper bunk, a pendant) by its outline only, and say "overhead" in the label or note, until a planned RFC 0003 (plan line roles) gives blocks a dashed line;
  - do not draw what the top of the object hides (table legs under a top, chair legs under a seat).
- **Doors** show the leaf open at 90° and the swing as a quarter arc of the leaf width centred on the hinge (D3).

## 6. Material roles and colours

Every model node has a `mat:` role, and its `color` is the role's colour from this palette. The palette is neutral on purpose: it shows what a part is made of without suggesting a product finish. `tools/render.mjs` colours its pictures with the same values.

| Role | Colour | For |
| --- | --- | --- |
| `surface` | `#d8d2c4` | Worktops, tops, panels, painted or laminated boards, a hard moulded or plywood seat and back (a shell seat) |
| `soft` | `#9fb0c4` | Upholstery, cushions, mattresses, pillows |
| `frame` | `#7a5c3e` | Structural members of any material: legs, rails, posts, stretchers (timber, or steel and tubular), carcass edges, door frames |
| `metal` | `#9aa3ab` | Metal fittings and casings that are not structure: taps, handles, castors, hinges, appliance casings, equipment |
| `glass` | `#a8d0e6` | Glazing, screens, shower panels (drawn as a pale solid at least 0.010 m thick) |
| `ceramic` | `#f2f1ec` | Sanitaryware, tiles |
| `planting` | `#5e8f4e` | Foliage, soil surface |

A role names what the part is in the object, not only its material: a steel chair leg is `frame`, a steel tap `metal`; an upholstered seat is `soft`, a plastic or plywood shell seat `surface`.

**`mat:` on refs.** A ref takes the role of its definition: put `mat:<definitionKey>` once for all the refs that place it, and give a ref its own `mat:<refId>` only when that copy differs. Every model node that is not a ref has its own key. The format allows all three targets ([format §7](format-v1.md#7-root-metadata)). A ref's `color` follows the same rule: set it once on the definition, and on a ref only when that copy differs.

Plan nodes need no colour: the paper plan draws every line in black.

## 7. Anchors

Every anchor has a `metadata.role` from this table. A new anchor name or role is added here first, by a pull request to this page. Names are the format's identifiers (they keep the format's spelling, as in `drainCenter`); roles are lowercase words joined by hyphens.

| Anchor | Role | Where it sits | Used by |
| --- | --- | --- | --- |
| `base` | `floor-contact` | The origin, on the floor | Every block that stands on the floor |
| `base` | `surface-contact` | The origin, at the foot of an item that is placed on furniture rather than the floor; the item starts at `y = 0` and has no `at` keyword | A table lamp |
| `wallFace` | `wall-contact` | `(0, 0, −depth/2)`, on the floor under the back face | Every block placed against a wall |
| `headWall` | `wall-contact` | `(0, 0, −depth/2)` at the head end | Beds |
| `ceilingContact` | `ceiling-contact` | `(0, ceiling height, 0)`, top of the rose or canopy | Ceiling-hung lighting and equipment |
| `seatCenter` | `seating-point` | Top of the seat at its centre | Chairs, stools, benches, a sofa's middle seat |
| `seatLeft`, `seatRight` | `seating-point` | Top of the left or right seat at its centre | Sofas |
| `topCenter` | `top-surface` | Top face at its centre | Tables, desks, cabinets, counters |
| `serveEdge` | `serving-edge` | Front edge of the serving top, at its middle | Counters, islands |
| `sleepingSurface` | `sleeping-surface` | Top of the mattress at its centre | Beds, cots |
| `drainCenter` | `drain-point` | Centre of the waste outlet, on the floor of the bowl or tray | Baths, showers, sinks, basins |
| `faucetMount` | `tap-mount` | Centre of the tap's base, on the deck or rim | Baths, sinks, basins |
| `flushSide` | `transfer-side` | On the pan's side face, on the side a wheelchair user transfers from, at seat height | Accessible WCs |
| `soilTop` | `planting-point` | Centre of the soil surface | Planters, pots |
| `canopyCenter` | `canopy-centre` | Top of the canopy at its centre | Trees |
| `baseCenter` | `floor-contact` | Centre of the threshold, on the floor | Doors |
| `tagMount` | `signage-mount` | Where a door tag or sign is fixed | Doors |

That is 17 anchor names and 14 roles. "At its centre" means the centre of that face in x and z as drawn (the seat panel's own centre, not the origin). `base` is always `floor-contact` except on an item that stands on another item. Each anchor lies on the body's surface, or, for `base` and `wallFace`, on the floor under the footprint's edge, within 0.005 m.

## 8. Ports

Ports are optional; a block that has them follows this table. **Port ids are short fixed names, not the `systemType`.** Two ports of one block may share a `systemType` (a radiator's flow and return are both `heating`), ids must be unique, and an id is what a project's connections name, so it must stay stable even if the `systemType` vocabulary grows. Every family uses these ids; the five data-centre seeds keep theirs, since renaming a port is a MAJOR change.

| Id | Domain | `systemType` | Direction | Profile and size (m) | Typical blocks |
| --- | --- | --- | --- | --- | --- |
| `dcw` | `piping` | `domesticColdWater` | `sink` | round 0.015 | Taps on sinks, basins, baths; WC cistern; washing machine, dishwasher |
| `dhw` | `piping` | `domesticHotWater` | `sink` on a tap; `source` on a boiler or cylinder | round 0.015 | Taps on sinks, basins, baths; boilers, hot-water cylinders |
| `waste` | `piping` | `drainage` | `source` | round 0.032 (basin), 0.040 (sink, bath, shower, washing machine, dishwasher) | Fittings with a trap |
| `soil` | `piping` | `drainage` | `source` | round 0.100 | WCs |
| `flow` | `piping` | `heating` | `sink` on a radiator, `source` on a boiler | round 0.015 (radiator), 0.022 (boiler) | Radiators, boilers |
| `return` | `piping` | `heating` | `source` on a radiator, `sink` on a boiler | as `flow` | Radiators, boilers |
| `gas` | `piping` | `gas` | `sink` | round 0.022 | Boilers, gas hobs |
| `exhaust` | `hvac` | `exhaustAir` | `source` | round 0.100 (dryer), 0.150 (hood) | Extractor hoods, tumble dryers |
| `flue` | `hvac` | `exhaustAir` | `source` | round 0.100 | Boilers |
| `power` | `electrical` | `power` | `sink` | electrical, 1 pole, 230 V (verify) | Luminaires, appliances that are wired in |

- **Amperage on `power`.** A `power` port on an appliance with its own dedicated circuit states `amperage`: `floorkit.cooker` and `floorkit.hob` give 32. A luminaire on a lighting circuit leaves `amperage` out and says so in its note, as `floorkit.downlight`, `floorkit.pendant-light`, `floorkit.wall-light` and `floorkit.ceiling-luminaire-1200` do. The kept data-centre ports keep the values they had in the seeds, since their ids and values are unchanged: `floorkit.pdu` (`in` 400, `outA` and `outB` 32) and `floorkit.ups` (`in` and `out` 400) set `amperage` and no `voltage`.
- The `systemType` values are the ones Floorkit maps to IFC's distribution system types; any other value exports as `USERDEFINED`.
- A port sits on a face of the body, with its +z pointing out of the body. This is the catalog's convention; how Floorkit orients an element's own port is unverified ([format §6](format-v1.md#6-ports)).
- Every size in the table is to verify: they are the nominal conventions of BS EN 12056-2 and Approved Document H (sanitary pipework) and UK domestic practice. The author checks the source for the fitting drawn, writes it in `catalog:basedOn`, and says in the pull request if it was not checked.

## 9. IFC class

- **Every block sets `ifc:class`**, and `ifc:predefinedType` where IFC4 has an enumeration value for the object; otherwise `USERDEFINED`.
- **A block with a port, or of type `MEP_EQUIPMENT`, also sets the legacy `ifcClass` equal to `ifc:class`**, except a `DOOR` or `WINDOW`, which Floorkit exports by its native path whatever it carries ([format §11](format-v1.md#11-advisory-notes)). Floorkit sends such a block to its distribution path, which reads only `ifcClass`: with `ifc:class` alone a ported pdu, chiller or basin exports as `IfcDistributionElement` (measured against Floorkit main `b0a084c7`). A block without ports and of another type needs `ifc:class` only.
- A `DOOR` block exports through Floorkit's native door at 0.9 × 2.1 m whatever it draws ([format §11](format-v1.md#11-advisory-notes)); state the true size in the note.

## 10. Per category

One row per category in [`categories.json`](../categories.json). "1:100" is what the symbol must show to read at that scale; "1:50" is what it adds and must still be right at that scale. The 3D column is the LOD 300 bar: the parts that must be present as separate solids. IFC values marked "verify" are checked against the IFC4 documentation before use.

| Category | Plan at 1:100 | Adds at 1:50 | 3D at LOD 300 | IFC |
| --- | --- | --- | --- | --- |
| `seating` | Seat outline and back line; arms | Seat cushions split; a swivel chair's star base as spokes | Seat, back, each leg or the base, arms where present; castors on a swivel chair. A stacking chair: tubular legs (upright cylinders) and a shell seat and back (`surface`); its nesting splay is not drawn (section 3) | `IfcFurniture` `CHAIR`, `SOFA` |
| `tables` | Top outline | Pedestal or base outline only where the top does not hide it | Top, legs or pedestal, aprons or frame between the legs; a desk's modesty panel | `IfcFurniture` `TABLE`, `DESK` |
| `beds` | Frame outline, mattress line | Pillow, turn-down line 0.60 m from the head (verify) | Frame, mattress, headboard, legs, pillow; a bunk's posts, ladder and rail | `IfcFurniture` `BED` |
| `storage` | Carcass outline, door split | Door leaves; a wardrobe's rail centreline | Carcass panels, plinth, doors or drawer fronts, handles, shelves or rail | `IfcFurniture` `SHELF`, `FILECABINET` (verify), else `USERDEFINED` |
| `kitchen` | Unit outline, worktop nosing line; a sink's bowl | Bowl inner line, drainer, tap | Plinth, carcass, doors, worktop; a sink's rim plate, hollow bowl and tap | `IfcFurniture`; a sink `IfcSanitaryTerminal` `SINK` |
| `sanitary` | The fitting's outline by BS 8541-2: WC pan and cistern, basin rim, bath outline, tray square | Bowl or basin inner line, waste, tap; a tray's falls | Hollow pan, bowl, bath or tray; rim; cistern and seat; pedestal or bracket; tap | `IfcSanitaryTerminal` `TOILETPAN`, `WASHHANDBASIN`, `BATH`, `SHOWER`, `BIDET`, `URINAL` |
| `appliances` | Casing outline, front line | Hob rings, a washer's door circle, a fridge's door swing | Casing, door or front, control strip, hob rings, porthole turned about x | `IfcElectricAppliance` (`ELECTRICCOOKER`, `DISHWASHER`, `WASHINGMACHINE`, `FREEZER`, `FRIDGE_FREEZER`, `TUMBLEDRYER`); a television `IfcAudioVisualAppliance` `DISPLAY` |
| `lighting` | Circle and cross (point source); a small circle, the trim, with the lamp circle inside it and no cross (downlight); the box outline with a half circle inside it (wall light); rectangle and diagonal cross (linear) | Shade outline | Rose or canopy, rod or cable, shade or body; a floor lamp's base | `IfcLightFixture` `POINTSOURCE`, `DIRECTIONSOURCE` (verify) |
| `planting` | Canopy circle and trunk circle; a planter's trough outline and inner line | Plant positions | Trunk, canopy as stacked cylinders; a planter's sides, floor, soil and plants | `IfcGeographicElement` `VEGETATION` (verify); planters `IfcFurniture` `USERDEFINED` |
| `vehicles` | Body outline with chamfered ends, windscreen lines | Mirrors, wheel arches | Body, cabin, glazing, four wheels, cylinders turned about z, touching the floor | `IfcBuildingElementProxy` `USERDEFINED` until a vehicle class is confirmed (verify) |
| `equipment` | Casing outline, access side line | Grilles, fans, panel splits | Casing, panels or grilles, fans, stubs at every port | Its own class (`IfcChiller`, `IfcBoiler`, `IfcSpaceHeater` `RADIATOR`, `IfcTank` `STORAGE`, `IfcElectricAppliance` `PHOTOCOPIER` or `FREESTANDINGWATERCOOLER` …); with `ifcClass` too when ported or `MEP_EQUIPMENT` (section 9) |
| `openings` | Jamb and frame lines, leaf open at 90°, swing arc | Glazing lines, threshold | Frame, leaf, glazing, ironmongery | `IfcDoor`; `catalog:placement: "hosted"` |
| `other` | Outline and centre cross (clearance zones) | Turning circle or approach zone | A 0.010 m floor slab, note `slab` | `IfcBuildingElementProxy` `USERDEFINED` |

`floorkit.glazed-door` is the one opening kept as is: it does not meet the `openings` row (no open leaf or swing in plan, no ironmongery) and stays so until the openings debt is taken up.

## 11. Where the numbers come from

Sizes and heights come from published sources, never from a manufacturer's CAD or BIM file ([CONTRIBUTING, Provenance rules](../CONTRIBUTING.md#provenance-rules)).

**The rule.** Key dimensions (the overall size and the named heights) come from the key-dimension table below, or from a source the author names in `catalog:basedOn`; a number marked "verify" may be drawn, and the pull request then says it is unverified. Secondary sizes (thicknesses, insets, rails) are the author's choice within this standard's minima and the parts of §10. Stop and ask only for a key dimension with no source. When the table is the source, `catalog:basedOn` says so: `"Drafting standard key dimensions (practice, Neufert / Metric Handbook), unverified"`.

The sources this catalog uses:

| Source | For |
| --- | --- |
| Neufert, *Architects' Data* | Furniture, beds, kitchens, clearances around furniture |
| *Metric Handbook: Planning and Design Data* | Furniture and fittings in UK practice; car sizes and bays |
| EN 1116 | Kitchen furniture co-ordinating sizes (unit widths, worktop height) |
| EN 997, EN 14688, EN 14516, EN 14527 | WC pans, wash basins, baths, shower trays |
| EN 1335, EN 527 | Office work chairs, office desks |
| BS 8300-2, Approved Document M, ADA Standards | Accessible WCs, basins, showers, turning circles and wheelchair spaces |
| BS 8541-2:2011 | Plan symbols of building elements |
| BS EN 12056-2, Approved Document H | Sanitary pipework sizes (ports, section 8) |

Heights the catalog fixes for every block: worktop 0.90 m, ceiling 2.40 m.

### Key dimensions

W × D × H in metres. "Practice, verify" means the figure is the usual one in Neufert and the *Metric Handbook* and has not been checked against them for this page.

| Category | Key dimensions | Source |
| --- | --- | --- |
| `seating` | Simple chair 0.45 × 0.52 × 0.85, seat 0.45; armchair 0.80 × 0.85 × 0.80; stacking chair 0.53 × 0.55 × 0.82, tubular legs radius 0.011; bar stool 0.38 diameter × 0.75; 2-seat sofa 1.60 × 0.90 × 0.80; 3-seat sofa 2.20 × 0.90 × 0.80; bench 1.20 × 0.40 × 0.45 | Practice, verify |
| `seating` | Office chair 0.65 × 0.65 × 1.00 | EN 1335 |
| `tables` | Dining table for 4 1.20 × 0.80 × 0.75; for 6 1.80 × 0.90 × 0.75; round table 1.10 diameter × 0.75; coffee table 1.10 × 0.60 × 0.42; meeting table 2.00 × 1.00 × 0.74; serving counter 2.40 × 0.70 × 1.10 | Practice, verify |
| `tables` | Desk 1.60 × 0.80 × 0.74 | EN 527-1 |
| `beds` | Single bed 1.00 × 2.10 × 0.90, mattress 0.90 × 2.00; double 1.50 × 2.10; bunk 1.00 × 2.10 × 1.60; bedside table 0.45 × 0.40 × 0.55 | Practice, verify |
| `beds` | King 1.70 × 2.10 (verify); cot 0.66 × 1.26 × 0.90 (EN 716-1, verify) | As marked |
| `storage` | Cabinet 1.00 × 0.45 × 1.30; sideboard 1.60 × 0.45 × 0.80; chest of drawers 0.80 × 0.45 × 0.90; wardrobe 1.00 × 0.60 × 2.10; bookshelf 0.80 × 0.30 × 2.00; desk pedestal 0.43 × 0.60 × 0.60; filing cabinet 0.47 × 0.62 × 1.32 (verify) | Practice, verify |
| `kitchen` | Base unit 0.60 × 0.60 × 0.90, worktop 0.04 thick; wall unit 0.60 × 0.35 × 0.72, underside 1.40; tall unit 0.60 × 0.60 × 2.10; sink 0.86 × 0.50, bowl 0.40 × 0.34 × 0.18 | EN 1116 |
| `sanitary` | WC 0.37 × 0.65 × 0.78, seat 0.42; wall-hung WC rim 0.40; wash basin 0.55 × 0.45, rim 0.85; bath 1.70 × 0.70 × 0.55; shower tray 0.90 × 0.90 × 0.04; bidet 0.37 × 0.56 × 0.40 | Practice, verify (EN 997, EN 14688, EN 14516, EN 14527 for the fittings) |
| `sanitary` | Accessible WC seat 0.48, pan front 0.75 from the wall; accessible basin rim 0.72, clear under 0.67 | Approved Document M; BS 8300-2 |
| `appliances` | Cooker, dishwasher, washing machine 0.60 × 0.60 × 0.85 or 0.90; fridge-freezer 0.60 × 0.65 × 1.85; hob 0.60 × 0.52 × 0.05 `at 0.90`; extractor hood 0.60 × 0.50 × 0.15, underside 1.55 | Practice, verify |
| `lighting` | Ceiling 2.40 (assumed); pendant shade 0.40 diameter, bottom 2.00; wall light centre 1.80 | Practice, verify |
| `equipment` | Radiator 1.00 × 0.10 × 0.60, bottom 0.15; boiler 0.45 × 0.35 × 0.75, bottom 1.20 (verify) | Practice, verify |
| `other` | Turning circle 1.50 diameter (ADA 1.525) | BS 8300-2; ADA Standards |

## 12. Drafting rules D1 to D18

The rules a plan symbol and a drawing are reviewed against, in short. "Standard" rules come from published standards; "practice" rules are what the usual textbooks teach and what Revit, Archicad and AutoCAD Architecture draw by default. Rules marked "block" bind every block; the others belong to the drawing a block is placed in and are listed so a reviewer knows where a block stops.

| Id | Rule | Kind | Source | Applies to |
| --- | --- | --- | --- | --- |
| D1 | Line weight by depth: cut heavy, seen beyond medium, overhead dashed or thin | standard | ISO 128-2:2020, ISO 7519:1991 | Block (one pen today: section 5) |
| D2 | Cut walls filled or hatched by material | standard | ISO 128-50:2001 | Drawing |
| D3 | A swing door shows its leaf open and a swing arc centred on the hinge; sliding, folding and double doors their own symbols | practice | BS 8541-2:2011; Ching, *Architectural Graphics*, 6th ed. 2015 | Block (`openings`) |
| D4 | A window: wall cut stops at the jambs, glass as thin lines, sill line at 1:50 | practice | BS 8541-2:2011; Ching 2015 | Block (windows, when the catalog has them) |
| D5 | Door and window tags keyed to a schedule, clear of the swing | practice | ISO 4157-1:1998; US National CAD Standard v6 | Drawing |
| D6 | Room name, number and area inside the room | standard | ISO 4157-2:1998 | Drawing |
| D7 | Stairs: treads, direction arrow, break line at the cut | practice | BS 8541-2:2011; Ching 2015 | Drawing |
| D8 | Columns cut heavy and filled, with their grid reference | practice | ISO 128-50:2001; Ching 2015 | Drawing |
| D9 | The roof above omitted or dashed on a floor plan | practice | Ching 2015 | Drawing |
| D10 | Railings as a thin double or single line following the flight | practice | BS 8541-2:2011 | Drawing |
| D11 | Furniture and fittings: light outline, no fill, true size; sanitary fittings by their standard symbols | practice | BS 8541-2:2011; Ching 2015 | Block (every category) |
| D12 | Dimensions with ticks or arrows, chains that add up | standard | ISO 129-1:2018, ISO 7519:1991 | Drawing |
| D13 | Text at least about 1.8 mm printed, upright and consistent | standard | ISO 3098-1:2015 | Drawing; a block carries no text (section 13) |
| D14 | Grids and levels with bubbles and values | practice | ISO 7519:1991 | Drawing |
| D15 | North arrow, stated scale and a scale bar | standard | ISO 9431:1990, ISO 5455:1979 | Drawing |
| D16 | Section and elevation marks with identifiers | practice | ISO 7519:1991; US National CAD Standard v6 | Drawing |
| D17 | Title block and revision table | standard | ISO 7200:2004, ISO 9431:1990 | Drawing |
| D18 | Demolition and new work by line type or fill | standard | ISO 7518:1983 | Drawing |

## 13. What the format cannot draw

Format 1 cannot express these; where format v2 can, the line says so. Draw the closest honest thing and say so in the note; do not invent a workaround the tools do not check.

- **No dashed, hidden or weighted lines**, no fills or masks: overhead items are drawn as outlines (section 5).
- **No text** in a symbol: no "F", "WM", "DW" marks.
- **A body is mandatory**: a clearance zone is a 0.010 m floor slab with the note keyword `slab`.
- **No mounting height in plan**: heights are baked into the body and stated in the note.
- **Items that sit on other items** stand at `y = 0` with `base` role `surface-contact` (a table lamp); a microwave on a worktop is not a block.
- **Fittings smaller than about 0.15 m** (toilet roll holders, grab rails, switches, monitors) are not blocks. A downlight is the exception: it is a block, as a ceiling luminaire, although it is smaller (`floorkit.downlight` is 0.09 × 0.09 × 0.03).
- **No sphere, revolve, cone or fillet in format 1**: approximate with cylinders and cuboids. Format v2 has `sphere`, `cone`, `torus`, `revolve`, `shell`, the cylinder sector and the outline sweep with arc edges (section 3). Neither format has a fillet: round an edge with an outline arc in plan, or not at all.
- **No partial cylinder in format 1** (section 3); format v2 draws a sector.
- **Boolean pockets** beyond the measured arrangements are unverified (section 3).
- **One colour per node**: glass is a pale solid.
- **No scale or parameters**: one block per module or bed size; non-uniform scaling of a placed block is refused by Floorkit.

## 14. Labels, attribution and versions

- **Labels** are plain British English, capitalised as a title, with no brand: "Wash Basin", "Tumble Dryer", "Wardrobe".
- **Tags.** The object's common name first, then its type and the room or use, with words already used in the catalog where one fits, else a new descriptive tag (lowercase, British English): `"chair, stacking, dining"`. No brand, and no material unless it tells two blocks apart.
- **Attribution.** `catalog:attribution` names who drew the block. A redrawn `floorkit` block keeps `"Vishwajeet Mane"`.
- **Versions** follow [CONTRIBUTING, Publish a new version](../CONTRIBUTING.md#publish-a-new-version-of-a-block):

| Bump | When |
| --- | --- |
| MAJOR | An anchor, port or id is removed or renamed, or the footprint or insertion point moves |
| MINOR | Anchors, ports or types are added; or a drawing-only change (a plan line, a body part, a `mat:` or anchor role) that moves no anchor, port or insertion point |
| PATCH | The label, a colour or other metadata |

**A move to format v2 is MAJOR on its own**, even when the drawing does not change: a reader of format 1 cannot load the new file ([RFC 0004](rfcs/0004-format-v2.md#versioning)). The format 1 file stays.
