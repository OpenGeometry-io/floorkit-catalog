# Drafting standard for catalog blocks

This page says how a block must be drawn so that it reads like the work of a senior BIM author: where its origin sits, what its plan symbol shows, which parts its body has, which heights are true, and how it names its anchors and ports. [`format-v1.md`](format-v1.md) says what a block may contain; this page says what a good block does contain. Where the two disagree, the format and the tools win, and the difference is a bug in this page.

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

Note keywords are lowercase phrases inside the otherwise free `catalog:note` (at most 500 characters). They may stand anywhere in the text, separated from it by a space, a comma or a full stop. The grammar:

```text
<height keyword> <metres>      at | ceiling | seat | rim | top | bottom | underside, then metres with two decimals: "seat 0.45"
overlap <nodeA>+<nodeB>        two node names joined by "+", no spaces: "overlap carcass+kick"
<marker>                       recess | carcass | slab, as a whole word
```

[`format-v1.md` §7](format-v1.md#7-root-metadata) will carry the same grammar once the geometry gates land.

| Keyword | Meaning |
| --- | --- |
| `at <m>` | The block is set into or onto a counter whose top is at this height (a hob, an inset sink); that plane is a ground. A worktop's own height is `top 0.90` |
| `ceiling <m>` | The block hangs from a ceiling at this height (2.40 unless the block says otherwise) |
| `seat <m>` | Top of the seat |
| `rim <m>` | Top of the rim of a basin, bath, WC pan or sink |
| `top <m>` | Top of a working or serving surface |
| `bottom <m>`, `underside <m>` | Lowest face of a wall-hung or ceiling-hung item |
| `recess` | Part of the body goes below `y = 0` on purpose (a level-access shower) |
| `carcass`, `slab` | The block is a box by nature (a cabinet carcass, a clearance slab); exempt only from the volume ratio in section 3. The 3-solid minimum and the parts of section 10 still apply |
| `overlap <a>+<b>` | Nodes `a` and `b` may interpenetrate (section 4) |

Example: `"catalog:note": "Wall-hung basin. rim 0.85, underside 0.68. Waste at the back; overlap counter+tap."`

## 3. The body at LOD 300

The body must read as the object from the isometric view, with the parts the category lists (section 10) at their true heights.

- **At least 3 solids**, and the sum of the solids' volumes below 95 % of the bounding-box volume (the note's `carcass` or `slab` waives the volume ratio only). A body of one box is LOD 100, not a catalog block. No tool computes the ratio yet; `mesh-report.json` from `parity.mjs` lists each node's volume.
- **No part thinner than 0.01 m** in any direction (glass included, 0.010), and no part wholly hidden inside another.
- **Every part touches** another part or a ground (section 1) within 0.001 m. No floating worktop, no car on wheels that stop short of the floor.
- **Hollows** (bowls, baths, sinks, trays) are drawn hollow. Never put a solid box inside another box to suggest a basin. Two ways are allowed:
  - a boolean in an arrangement measured to build: a vertical through-hole cut from a cuboid or a cylinder by a cuboid or a cylinder, or a cylinder minus a narrower coaxial cylinder. A cuboid minus a cylinder that crosses one of its side faces does not build;
  - plate with hole plus liner: the rim as a plate with a through-hole, and the bowl below it as separate thin walls and a floor that touch the plate's underside.
  Booleans take only `cuboid`, `cylinder` or another `boolean3d` as operands ([format §4](format-v1.md#4-definitions-and-references)). Every block with a boolean is built by a maintainer with `parity.mjs --build --mesh` before it merges.
- **Sweeps** only in the orientation of `floorkit.glazed-door`: profile in the x–z plane around the origin, path starting vertically. Other orientations are unverified.
- **Cylinders** stand on their axis along y. A cylinder that lies down (a porthole, a wheel, a rail) is turned 90° about x by its `placement.rotation` (`[90, 0, 0]`), which is measured; a turn about z is unverified, so a rail along x is a cuboid or is built and checked by a maintainer.
- **No partial cylinders.** A cylinder with `angle` below a full turn must not be used: when a project mirrors the block (`scale [-1, 1, 1]`), Floorkit moves its centre but does not flip its arc, so the body lands up to its full width off the mirrored plan (measured: 400 mm for a quarter cylinder of radius 0.4). A half cylinder may be drawn as a full cylinder minus a cuboid, but that arrangement is unverified: a maintainer must build it, mirror included, with `parity.mjs --build --mesh` before it merges.
- **Rotations.** Measured to build and to mirror correctly: a cylinder turned 90° about x; a cuboid turned about y; a ref turned about y by any angle (72° measured). A positive angle about y turns +x towards −z. A turn about z, a tilt of a cuboid about x (splayed legs) and a turn about two axes are unverified: draw parts upright, or have a maintainer build them.
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

Everything else must be redrawn so the parts meet:

- a solid inside a solid to fake a hollow (a basin box inside a bath shell, a bowl disc under a counter);
- rails or walls that cross at a corner: butt one against the other (a table apron runs between the legs, not through the next apron);
- two carcasses that overlap at an L-corner: draw them abutting;
- a part pushed into a body to hide its far side (wheels inside a car body, a door disc half inside a washing machine);
- plants pushed into soil: the plant's base sits on the soil top.

## 5. The plan symbol

The plan symbol (`profileView`) is what most users see. It follows practice for furniture and fittings (D11): a light outline at true size, no fill.

- **The outline is the top-down silhouette of the body**, within 0.005 m on each side. Arcs that show a door's swing are outside this rule.
- **At 1:100 it reads by its outline plus at most two interior lines** (a seat back, a mattress turn-down, a door split). An interior line marks an edge seen from above: for a chair, the front face of the back, where it meets the seat. Detail beyond that is for 1:50 and must still read at 1:100. A block draws one symbol for both scales, so a plan that is the same at 1:50 and 1:100 is fine until plan line roles exist.
- **Nothing finer than 0.03 m.** A gap, a lip or a line spacing under 0.03 m prints as one blot at 1:100: keep an interior line at least 0.03 m from the outline and from other lines, and leave it out for a part thinner than that.
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

**`mat:` on refs.** A ref takes the role of its definition: put `mat:<definitionKey>` once for all the refs that place it, and give a ref its own `mat:<refId>` only when that copy differs. Every model node that is not a ref has its own key. The format allows all three targets ([format §7](format-v1.md#7-root-metadata)).

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
| `appliances` | Casing outline, front line | Hob rings, a washer's door circle, a fridge's door swing | Casing, door or front, control strip, hob rings, porthole turned about x | `IfcElectricAppliance` (`ELECTRICCOOKER`, `DISHWASHER`, `WASHINGMACHINE`, `FREEZER`, `TUMBLEDRYER`); a television `IfcAudioVisualAppliance` `DISPLAY` |
| `lighting` | Circle and cross (point source); rectangle and diagonal cross (linear) | Shade outline | Rose or canopy, rod or cable, shade or body; a floor lamp's base | `IfcLightFixture` `POINTSOURCE`, `DIRECTIONSOURCE` (verify) |
| `planting` | Canopy circle and trunk circle; a planter's trough outline and inner line | Plant positions | Trunk, canopy as stacked cylinders; a planter's sides, floor, soil and plants | `IfcGeographicElement` `VEGETATION` (verify); planters `IfcFurniture` `USERDEFINED` |
| `vehicles` | Body outline with chamfered ends, windscreen lines | Mirrors, wheel arches | Body, cabin, glazing, four wheels turned about x and touching the floor | `IfcBuildingElementProxy` `USERDEFINED` until a vehicle class is confirmed (verify) |
| `equipment` | Casing outline, access side line | Grilles, fans, panel splits | Casing, panels or grilles, fans, stubs at every port | Its own class (`IfcChiller`, `IfcBoiler`, `IfcSpaceHeater` `RADIATOR`, `IfcTank` `STORAGE`, `IfcElectricAppliance` `PHOTOCOPIER` or `FREESTANDINGWATERCOOLER` …); with `ifcClass` too when ported or `MEP_EQUIPMENT` (section 9) |
| `openings` | Jamb and frame lines, leaf open at 90°, swing arc | Glazing lines, threshold | Frame, leaf, glazing, ironmongery | `IfcDoor`; `catalog:placement: "hosted"` |
| `other` | Outline and centre cross (clearance zones) | Turning circle or approach zone | A 0.010 m floor slab, note `slab` | `IfcBuildingElementProxy` `USERDEFINED` |

## 11. Where the numbers come from

Sizes and heights come from published sources, never from a manufacturer's CAD or BIM file ([CONTRIBUTING, Provenance rules](../CONTRIBUTING.md#provenance-rules)).

**The rule.** A number comes from the key-dimension table below, or from a source the author names in `catalog:basedOn`. A number marked "verify" may be drawn; the pull request then says it is unverified. Stop and ask only when neither the table nor a source you can name gives the number. When the table is the source, `catalog:basedOn` says so: `"Drafting standard key dimensions (practice, Neufert / Metric Handbook), unverified"`.

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

Version 1 of the format cannot express these. Draw the closest honest thing and say so in the note; do not invent a workaround the tools do not check.

- **No dashed, hidden or weighted lines**, no fills or masks: overhead items are drawn as outlines (section 5).
- **No text** in a symbol: no "F", "WM", "DW" marks.
- **A body is mandatory**: a clearance zone is a 0.010 m floor slab with the note keyword `slab`.
- **No mounting height in plan**: heights are baked into the body and stated in the note.
- **Items that sit on other items** stand at `y = 0` with `base` role `surface-contact` (a table lamp); a microwave on a worktop is not a block.
- **Fittings smaller than about 0.15 m** (toilet roll holders, grab rails, switches, monitors) are not blocks.
- **No sphere, revolve, cone or fillet**: approximate with cylinders and cuboids.
- **Boolean pockets** beyond the measured arrangements are unverified (section 3).
- **One colour per node**: glass is a pale solid.
- **No scale or parameters**: one block per module or bed size; non-uniform scaling of a placed block is refused by Floorkit.

## 14. Labels, attribution and versions

- **Labels** are plain British English, capitalised as a title, with no brand: "Wash Basin", "Tumble Dryer", "Wardrobe".
- **Tags.** The object's common name first, then its type and the room or use, with words already used in the catalog: `"chair, stacking, dining"`. No brand, and no material unless it tells two blocks apart.
- **Attribution.** `catalog:attribution` names who drew the block. A redrawn `floorkit` block keeps `"Vishwajeet Mane"`.
- **Versions** follow [CONTRIBUTING, Publish a new version](../CONTRIBUTING.md#publish-a-new-version-of-a-block):

| Bump | When |
| --- | --- |
| MAJOR | An anchor, port or id is removed or renamed, or the footprint or insertion point moves |
| MINOR | Anchors, ports or types are added; or a drawing-only change (a plan line, a body part, a `mat:` or anchor role) that moves no anchor, port or insertion point |
| PATCH | The label, a colour or other metadata |
