# RFC 0003: plan line roles (`lineRole`)

| | |
| --- | --- |
| **Status** | Proposed, awaiting the owner (2026-10-27) |
| **Covers** | An optional `lineRole` on a plan node of a `.op` v1 block: its five values, the pen and dash Floorkit draws each with, what a reader that ignores it draws, the catalog gate, versioning, and the blocks that get a `1.1.0` |
| **Maintainer** | [@aka-blackboots](https://github.com/aka-blackboots) |
| **Date** | 2026-10-27 |
| **Builds on** | [RFC 0001](0001-catalog-and-loader.md), the "Line roles" row of [RFC 0002](0002-parametric-families.md#proposed-op-v2), [docs/format-v1.md](../format-v1.md) §3, and [docs/drafting-standard.md](../drafting-standard.md) §5, §12 (D1, D3) and §13 |

How to read this document:
- **Nothing here is built.** The schema, `tools/validate.mjs` and every block are unchanged by this RFC. Two later changes build it: one in Floorkit, one in this catalog.
- **Read** means taken from Floorkit's source at OpenPlans `main` `b0a084c7`, whose `package.json` declares `@opengeometry/floorkit` 1.2.0. That repository is private; paths are for maintainers who can open them. `generic-element.ts` is `src/packages/openplans-core/src/elements/generic-element.ts`, `pen.ts` is `src/packages/openplans-paper/src/emit/pen.ts`, `plan-style.ts` is `src/packages/openplans-paper/src/screen/plan-style.ts`, and `draw-plan-blocks.ts` is `src/project-manager/draw/draw-plan-blocks.ts`.
- **Measured** means a command was run. No Floorkit behaviour in this RFC was measured: parity was not run for it. **Unverified** means neither read nor measured.
- **The ISO and BS standards cited were not read.** `iso.org` refused a direct fetch (HTTP 403), and the standards are sold, not published. What they say is taken from the drafting standard's §12 and is unverified here.

## Summary

- **One optional key**, `lineRole`, on a `polygon`, `polyline` or `arc`, and on a `profileView` ref, where it overrides its definition's, as `color` does.
- **Five values:** `outline`, `detail`, `overhead`, `hidden` and `swing`. The catalog schema accepts exactly these.
- **Floorkit maps each to a pen** from its own ISO 128 ladder: `outline` 0.25 mm, `detail` 0.18 mm, `overhead` 0.18 mm long-dashed double-dotted, `hidden` 0.13 mm dashed, `swing` 0.13 mm. The pen table in Floorkit owns the values; this RFC proposes them.
- **Absent means `detail`**, which is the 0.18 mm pen every block line is drawn with today. A file without the key draws exactly as before.
- **An old reader ignores it.** Floorkit 1.2.0 drops the key while parsing and draws the symbol as today, solid, at one pen (read).
- **The catalog gate.** A block that uses `overhead` or `hidden` says so in `catalog:note`. `lineRole: "swing"` takes over from the note marker `swing`.
- **Release order.** `v0.1.0` is tagged first, on the solid-line blocks. The roles ship later as `1.1.0` block files beside the tagged `1.0.0` files, a MINOR change. Ten blocks get one.

## Motivation

**Practice draws some lines dashed, and some heavier than others.** Drafting rule D1 asks for "line weight by depth: cut heavy, seen beyond medium, overhead dashed or thin" ([drafting standard §12](../drafting-standard.md#12-drafting-rules-d1-to-d18), citing ISO 128-2:2020 and ISO 7519:1991, unverified). D3 asks for a door's swing arc centred on the hinge (BS 8541-2:2011; Ching, *Architectural Graphics*, 6th ed., 2015; unverified). In practice:
- a wall unit above a counter, an extractor hood, an upper bunk and a pendant are drawn dashed: they are above the plan's cut;
- a clearance zone is drawn dashed: it marks floor space, not an object;
- a swing arc is drawn thinner than the leaf and the body;
- a basin's rim is heavier than its tap.

**Format v1 cannot ask for any of this.**
- The plan kinds are `polygon`, `polyline` and `arc`, with `id`, `color` and `placement` ([format §3](../format-v1.md#3-nodes)). No field says how a line is drawn.
- Node colour never reaches the plan: "Colour is **always** the pen's" (`pen.ts:282`).
- Floorkit inks every primitive of a block with the pen of its element type. `FIXTURE`, `FURNITURE` and `APPLIANCE` are each 0.18 mm continuous (`pen.ts:169-171`), `DOOR` is 0.25 mm (`pen.ts:137`). `LANDSCAPE` and `MEP_EQUIPMENT` have no row, so they fall to `DEFAULT_PEN`, 0.18 mm (`pen.ts:224-227`).
- Floorkit does dash what is above the cut, but only for the types listed in `PLAN_STATE_PENS`: walls, columns, beams, stairs, railings and roofs (`pen.ts:192-211`). `cutStateOf` (`draw-plan-blocks.ts:92-98`) computes the state, and `statedBy` leaves every other type's primitives unstated (`draw-plan-blocks.ts:134-137`).

So the LOD 300 blocks carry true geometry but an LOD 200 plan. The drafting standard records the gap: overhead items are "drawn as outlines" until "a planned RFC 0003 (plan line roles) gives blocks a dashed line" ([§5](../drafting-standard.md#5-the-plan-symbol), [§13](../drafting-standard.md#13-what-the-format-cannot-draw)). The notes of `wall-unit-600` and `extractor-hood` say the same, and `turning-circle-1500` and `wheelchair-space` say "drawn solid, dashed in practice".

**The format is closed**, so a new key needs an RFC before anything is built ([GOVERNANCE.md, "Changes to the format and the schema"](../../GOVERNANCE.md#changes-to-the-format-and-the-schema)).

## Where Floorkit stands

All read at `b0a084c7`.

| Fact | Source |
| --- | --- |
| A plan node keeps `kind`, `id`, `color`, `placement` and its geometry fields; every other key is dropped | `normalizeBaseNode` and `normalizeProfileNode`, `generic-element.ts:522-587` |
| A 2D definition goes through the same function | `normalizeDefinitionNode`, `generic-element.ts:730-732` |
| A ref keeps `ref`, `id`, `color` and `placement`; every other key is dropped | `normalizeRefNode`, `generic-element.ts:530-545` |
| A ref's override replaces its definition's `id`, `color` and `placement` | `applyRefOverridesToProfileNode`, `generic-element.ts:1694-1704` |
| A block's 2D drawing is a plan only: `toDrawing` returns nothing for any view but `'top'` | `generic-element.ts:2173-2174` |
| A polygon becomes a `region`, an arc an `arc`, a polyline a run of `line`s; the style carries `ogType` (and the polygon's colour), and then `ogid` | `generic-element.ts:2177-2197`, `2214-2216`; `src/packages/openplans-core/src/exporter/element-drawing.ts:63-76` |
| A block with no plan nodes draws its footprint rectangle | `generic-element.ts:2201-2213` |
| `DrawingStyle` already has a `role` field, with the values `cut`, `silhouette`, `projected`, `hidden`, `datum` and `marker`, for physical views | `src/packages/openplans-core/src/types.ts:364` |
| When `style.role` is set, `resolvePen` replaces the weight with that role's and dashes only `hidden` | `pen.ts:286-293`, `315-324` |
| The paper ink cache is keyed on `ogType`, `edgeClass`, primitive kind and `style.role` | `src/packages/openplans-paper/src/styles/resolve.ts:234` |
| The screen plan view inks by type, in pixels; `FURNITURE`, `FIXTURE`, `APPLIANCE` and `LANDSCAPE` have no row and fall to 0.8 px; `MEP_EQUIPMENT` is 1.0 px; above the cut dashes `[6, 4]` px | `plan-style.ts:46-74`, `77` |
| No DXF exporter under `src`: comments name one as planned, and a "DXF service" elsewhere that was not read | `pen.ts:19-21`, `src/packages/openplans-core/src/exporter/drawing-primitives.ts:33-35`, `src/project-manager/draw/sheet-annotations-to-model.ts:22` |

## Design

### The field

| | |
| --- | --- |
| **Key** | `lineRole` |
| **Value** | One of `"outline"`, `"detail"`, `"overhead"`, `"hidden"`, `"swing"` |
| **Required** | No. Absent means `detail` |
| **Allowed on** | `polygon`, `polyline` and `arc`, in `profileView` and in `definitions`; a ref in `profileView` |
| **A ref's `lineRole`** | Replaces its definition's, as a ref's `color` does ([format §4](../format-v1.md#4-definitions-and-references)). A ref without one draws with its definition's |
| **Not allowed on** | 3D nodes, `polyline3d`, `offset2d`, `boolean3d`, and refs in `modelView`. The catalog schema rejects it there |

**Why `lineRole` and not `role`.** RFC 0002 sketched the key as `role`. In this catalog `role` already means two other things: an anchor's `metadata.role` ([drafting standard §7](../drafting-standard.md#7-anchors)) and a node's material role in the `mat:` keys ([§6](../drafting-standard.md#6-material-roles-and-colours)). In Floorkit, `DrawingStyle.role` already holds the physical roles above (`types.ts:364`). One word with three meanings would be misread.

**Why these five, and not RFC 0002's six.** RFC 0002 sketched `cut`, `projection`, `hidden`, `overhead`, `swing` and `mask`:
- `cut` is dropped. Whether a block is cut depends on the plan's cut height, which the block does not know. Floorkit decides cut states for its own types (see [Not proposed](#not-proposed)).
- `projection` becomes two values, `outline` and `detail`, so that a rim can be heavier than its tap.
- `mask` is a fill, not a line. It is not proposed.

### The five values

| Value | Means | Typical use | Proposed paper pen | Dash | Precedent in Floorkit |
| --- | --- | --- | --- | --- | --- |
| `outline` | The body's silhouette from above, where the eye reads the object | A basin rim, a bath, a counter's edge | 0.25 mm | continuous | `DOOR`, `WINDOW` and `STAIR` pens (`pen.ts:137-141`); physical `silhouette` (`pen.ts:288`) |
| `detail` | A line inside the outline: an edge seen from above | A tap, a seat back, a door split, a mattress turn-down | 0.18 mm | continuous | Today's block pen (`pen.ts:169-171`); physical `projected` (`pen.ts:289`) |
| `overhead` | Above the plan's cut: a part hung on the wall or from the ceiling over the floor | A wall unit, a hood, an upper bunk, a pendant | 0.18 mm | long-dashed double-dotted, `DASH_PHANTOM` `[12, 1.5, 3, 1.5, 3, 1.5]` | `CEILING` (`pen.ts:135`); roofs and containment, which are overhead, also use `DASH_PHANTOM` (`pen.ts:134`, `164`) |
| `hidden` | Not seen from above: concealed under another part, or a zone that is no physical edge | A clearance or turning zone, a part under a worktop | 0.13 mm | dashed, `DASH_HIDDEN` `[3, 1.5]` | The `Hidden` edge class (`pen.ts:262`); physical `hidden` (`pen.ts:290`, `323`) |
| `swing` | The path of a moving part | A door's swing arc on a fridge or a shower | 0.13 mm | continuous | The narrowest rung of `PEN_LADDER_MM` (`pen.ts:36`) |

Notes on the values:
- **Every weight is a rung of Floorkit's ladder** (`pen.ts:36`), and both dashes already exist (`pen.ts:47`, `51`). Floorkit needs no new constant.
- **Dash runs are paper millimetres** (`pen.ts:41-44`), so a dashed line reads the same at 1:50 and 1:100.
- **The order is the point:** `outline` heavier than `detail`, and `swing` the narrowest. The exact millimetres are the pen table's to change, and this catalog's docs quote them without promising them.
- **`overhead` and `hidden` differ in pattern, not only in weight,** so that a wall unit and a clearance zone on the same sheet read apart. Whether to use `DASH_HIDDEN` at 0.18 mm for `overhead` instead, as Floorkit draws walls and stairs above the cut (`pen.ts:183`, `199`), is [open question 2](#open-questions).
- **Calling a clearance zone `hidden`** stretches the word. See [open question 1](#open-questions).

### Absent means `detail`

A node without `lineRole` is a `detail` line. For the five block types this is the pen they are drawn with today (0.18 mm, `pen.ts:169-171`, `224-227`), so every block without the key draws as it does now.

The exception is a block whose type has a heavier pen: `floorkit.glazed-door` is a `DOOR`, inked at 0.25 mm (`pen.ts:137`). In Floorkit, absent means "the type's pen, as today", which for every type but `DOOR` and `WINDOW` is the `detail` pen. A door block keeps its 0.25 mm until it states roles.

### What Floorkit does with it (proposal for the Floorkit change)

1. **Parse.** `normalizeProfileNode` and `normalizeRefNode` keep `lineRole`, serialise it back out, and refuse any other value with an error that names the node's path, for example `profileView.elements[0].lineRole`. Strict, not repaired.
2. **Resolve refs.** `applyRefOverridesToProfileNode` copies a ref's `lineRole` over its definition's.
3. **Draw.** `toDrawing('top')` puts the node's role on each primitive it makes, as `style.lineRole`. It stays a separate field from `style.role` (see [Alternatives](#alternatives-considered)). The footprint fallback carries none.
4. **Paper.** `resolvePen` gives a primitive with a `lineRole` that role's weight and dash in place of its type pen's; colour stays the pen's, and an explicit `style.stroke.width` still wins. `resolveInk`'s cache key gains `lineRole` (`styles/resolve.ts:234`).
5. **Pens for `LANDSCAPE` and `MEP_EQUIPMENT`.** Both get a `PEN_TABLE` row of 0.18 mm continuous. That equals `DEFAULT_PEN` (`pen.ts:224-227`), so trees, cars, clearance zones and data-centre units draw byte-equal until they state roles.
6. **Screen.** The plan view honours the role: `overhead` and `hidden` dash at the `[6, 4]` px it already uses above the cut (`plan-style.ts:77`), and weights keep the order `outline` > `detail` > `swing`. The pixel values are the Floorkit change's to choose.
7. **Other views.** Sections and elevations are unchanged: a block's 2D drawing is its plan alone (`generic-element.ts:2174`).
8. **DXF.** There is no DXF exporter under `src` to feed (`pen.ts:19-21`), and the "DXF service" was not read. When one reads the pen table, a role is a layer suffix.
9. **Byte-equal.** A project whose blocks carry no `lineRole` emits the same sheet SVG before and after the change.

### What an old reader does

| Reader | Does | How known |
| --- | --- | --- |
| Floorkit 1.2.0 | Accepts the file, drops `lineRole` from every node, and draws the symbol as today: solid, one pen | Read, `generic-element.ts:522-587`, `530-545` |
| Floorkit with the change | Draws the roles | Not built yet |
| The catalog's tools before the catalog change | Refuse the block: every node schema is closed (`additionalProperties: false`, `schema/op/v1.schema.json`) | Read |
| `tools/loader.mjs` | Loads it: it checks the bytes against the index and the file's own `id` and version, not node fields | Read, `tools/loader.mjs` header and `:212` |
| `tools/parity.mjs` against Floorkit 1.2.0 | Counts the block as repaired, since the key does not survive | Read, `tools/parity.mjs:75-96` |
| Parti | Unverified | |

**A loader without a format filter will hand a `1.1.0` file to Floorkit 1.2.0.** `find(id)` prefers the newest version. Floorkit 1.2.0 then draws it solid, as it drew `1.0.0`: the reader loses the dash and nothing else, because `1.1.0` moves no anchor, port or insertion point.

**The index does not change.** No field is added to `index.json`, so `floorkit.catalog/v1` readers are unaffected. The block format stays `"version": 1`; this is a change within v1, not a v2.

### The catalog gate (proposal for the catalog change)

**Schema.**
- `lineRole` on `polygon`, `polyline`, `arc` and a `profileView` ref, with an `enum` of exactly the five values. Anything else, `"cut"` included, is refused with the path.
- Not on any other node.

**Rules in `tools/lib/op.mjs` and `tools/lib/note.mjs`.**
- **`overhead` and `hidden` are said in words.** A block with any node whose `lineRole` is `overhead` must have the word `overhead` in its `catalog:note`; likewise `hidden`. Both become note markers: lowercase, whole words, as `recess` or `slab` are ([drafting standard §2](../drafting-standard.md#2-dimensions-heights-and-note-keywords)). A reader whose Floorkit draws no dash still learns why the line is there.
- **`swing` replaces the note marker `swing`.** Geometry gate (c) today leaves out every arc of a block whose note says `swing`, since a swing draws outside the body (`tools/lib/geometry.mjs:9-11`, `218`). It will leave out exactly the nodes whose `lineRole` is `swing`, of any kind, and keep checking the block's other arcs. The marker stays valid, because released blocks use it, and is documented as deprecated in the same change.
- **A ref's role counts.** The rules read the role a node draws with: the ref's if it has one, else its definition's.

**Docs and tests.** [format §3](../format-v1.md#3-nodes) gains the field; §9 its limit (five values, nothing else); the drafting standard's §2 the markers, §5 its "overhead" rule, and §13 loses "no dashed, hidden or weighted lines". A fixture with `lineRole: "cut"` goes under `test/fixtures/`.

**Parity.** The catalog accepting `lineRole` keeps it stricter than Floorkit only once a Floorkit release keeps the key. So the catalog change waits for the Floorkit change, and its parity run builds the new files against that build: unrepaired N/N means the key survived.

### Versioning and release order

- **Adding, changing or removing a `lineRole` is MINOR.** It is a drawing-only change that moves no anchor, port or insertion point ([drafting standard §14](../drafting-standard.md#14-labels-attribution-and-versions)).
- **The owner decided on 2026-10-27 to tag first.** `v0.1.0` is tagged on the redrawn blocks with solid lines. The roles ship afterwards as new `1.1.0.op` files beside the tagged `1.0.0.op` files, which never change (`tools/immutable.mjs`).
- **Their CHANGELOG entry goes to the release after 0.1.0.**
- **Each `1.1.0` note says it needs a Floorkit release that draws line roles.** Which release that is, is not known yet.

### The blocks that get a `1.1.0`

Read from the `1.0.0` files at `catalog-1.0` `b6fec0e`. A node not listed keeps no role, so it stays `detail`.

| Block | Node(s) | `lineRole` | Why |
| --- | --- | --- | --- |
| `wall-unit-600` | `outline` | `overhead` | Hung on the wall, underside 1.40; its note says the dashed line cannot be drawn |
| `extractor-hood` | `outline` | `overhead` | Above the hob, bottom 1.55; its note says the same |
| `bunk-bed` | `mattress-upper`, `pillow-upper` | `overhead` | The upper bunk, top 1.40. `outline` stays: the posts and the lower frame stand on the floor |
| `pendant-light` | `shade-a`, `shade-b`, `cross-1`, `cross-2` | `overhead` | Hung from the ceiling, bottom 2.00 |
| `downlight` | `trim-a`, `trim-b`, `lamp-a`, `lamp-b` | `overhead` | In the ceiling, bottom 2.37 |
| `ceiling-luminaire-1200` | `outline`, `cross-1`, `cross-2` | `overhead` | On the ceiling, bottom 2.32 |
| `turning-circle-1500` | `circle-a`, `circle-b`, `cross-x`, `cross-z` | `hidden` | A clearance zone; its note says "drawn solid, dashed in practice" |
| `wheelchair-space` | `outline`, `cross-x`, `cross-z` | `hidden` | The same |
| `shower-enclosure` | `door-swing` | `swing` | Its note carries the marker `swing` |
| `fridge-freezer` | `doorSwing` | `swing` | The same |

The source of this list is the drafting standard, [§5](../drafting-standard.md#5-the-plan-symbol) and [§13](../drafting-standard.md#13-what-the-format-cannot-draw), and the blocks' own notes. The `1.1.0` notes are rewritten to say `overhead` or `hidden` as the gate asks, and drop the sentence that a dashed line cannot be drawn.

Not on the list, on purpose:
- **No block gets `outline` in this round** ([open question 3](#open-questions)).
- **Wall-mounted items that are cut by or reach above a usual cut height stay solid:** `wall-light` (bottom 1.68), `boiler` (bottom 1.20), `television` (bottom 0.85) ([open question 4](#open-questions)).
- **`glazed-door`** draws no swing arc, and it is a seed block that only the importer writes.

## Not proposed

- **Fills and masks.** A filled region or a mask that hides what lies under it is a different feature (RFC 0002's `mask`).
- **Text in a symbol.** No "F", "WM" or "DW" marks ([drafting standard §13](../drafting-standard.md#13-what-the-format-cannot-draw)).
- **Cut states for blocks.** Floorkit could add `FURNITURE` and the other block types to `PLAN_STATE_PENS` and dash whatever lies wholly above the cut, as it does for walls and stairs (`pen.ts:192-211`, `draw-plan-blocks.ts:92-98`). That needs no file change, but it works per element, not per node: a bunk bed is cut by its posts, so its upper mattress would stay solid. It also cannot draw a swing or a clearance.
- **A role per view.** A reflected ceiling plan or a lighting layout would draw a pendant solid. Blocks draw one plan symbol for every view.
- **A role on a 3D node.** Sections and elevations of blocks are out of scope.

## Alternatives considered

### Reuse Floorkit's `DrawingStyle.role`: not chosen

`outline` could map to `silhouette` (0.25 mm), `detail` to `projected` (0.18 mm) and `hidden` to `hidden` (0.13 mm dashed), with no new style field (`pen.ts:286-293`). It was not chosen, because:
- `overhead` and `swing` have no counterpart;
- the physical roles describe physical views ("Physical visibility owns its linetype", `pen.ts:322`), and mixing plan symbol roles into them couples two drawing systems;
- the screen view honours `style.role === 'hidden'` only for site pictures (`src/packages/openplans-gui-editor/src/plan/PlanScene.ts:451`).

### One key per pen (`lineWeight`, `dash`): rejected

A block would carry millimetres and dash runs. That moves a drafting decision from Floorkit's pen table into thousands of files, and a sheet style could no longer restyle blocks. A role says what a line is, and the host decides how it looks, as RFC 0002 proposed.

### The key `role`: rejected

See [The field](#the-field).

## Open questions

Each has a default, which applies if the owner says go without answering it.

1. **Which role draws a clearance zone?** `turning-circle-1500` and `wheelchair-space` mark floor space; they are neither overhead nor concealed. *Default:* `hidden`, the dashed narrow line, defined above to cover "a zone that is no physical edge". A sixth value such as `clearance` would need a new RFC.
2. **Which dash for `overhead`?** *Default:* `DASH_PHANTOM` at 0.18 mm, as Floorkit's `CEILING` (`pen.ts:135`), so that it reads apart from `hidden`. The alternative is `DASH_HIDDEN` at 0.18 mm, as Floorkit draws walls and stairs above the cut (`pen.ts:183`, `199`), which would leave `overhead` and `hidden` told apart by weight alone.
3. **Should every block's outline become `outline` (0.25 mm)?** That is a `1.1.0` for most of the 80 blocks. *Default:* not in this round. A block gains `outline` at its next MINOR version.
4. **Do wall-mounted items above a usual cut take `overhead`?** `wall-light` (bottom 1.68), `boiler` (bottom 1.20) and `television` (bottom 0.85). Floorkit's default plan cut height was not found in the source. *Default:* no; they stay solid, as symbols on the wall.
5. **Does an `offset2d` take its source's `lineRole`?** It takes its source's colour when it has none ([format §4](../format-v1.md#4-definitions-and-references)). *Default:* yes, the same way, and the ref that draws it can override.
6. **Is a new block that uses the `swing` marker without any `lineRole: "swing"` refused?** *Default:* no; the marker stays valid for every block, and a reviewer asks for `lineRole` in a new one.
7. **Must an `overhead` block state a height above the floor** (`bottom`, `underside` or `ceiling`)? `bunk-bed` states only `top 1.40`. *Default:* no geometric check in this round; the note word is the gate.

## Sources

Floorkit, read at OpenPlans `main` `b0a084c7` (private):
- `src/packages/openplans-core/src/elements/generic-element.ts`
- `src/packages/openplans-core/src/exporter/element-drawing.ts`
- `src/packages/openplans-core/src/types.ts`
- `src/packages/openplans-paper/src/emit/pen.ts`
- `src/packages/openplans-paper/src/styles/resolve.ts`
- `src/packages/openplans-paper/src/screen/plan-style.ts`
- `src/packages/openplans-gui-editor/src/plan/PlanScene.ts`
- `src/project-manager/draw/draw-plan-blocks.ts`

This catalog: [docs/format-v1.md](../format-v1.md), [docs/drafting-standard.md](../drafting-standard.md), `tools/lib/geometry.mjs`, `tools/lib/note.mjs`, `tools/loader.mjs`, `tools/parity.mjs`, and the blocks under `blocks/floorkit/` at `b6fec0e`.

Drafting rules D1 and D3, as listed in the drafting standard's §12. None was read for this RFC; their content is unverified:
- ISO 128-2:2020, line types.
- ISO 7519:1991, general arrangement drawings, https://www.iso.org/standard/14240.html (HTTP 403 on 2026-10-27).
- BS 8541-2:2011, recommended 2D symbols of building elements for use in building information modelling, https://knowledge.bsigroup.com/products/library-objects-for-architecture-engineering-and-construction-recommended-2d-symbols-of-building-elements-for-use-in-building-information-modelling (not fetched).
- Ching, F. D. K., *Architectural Graphics*, 6th ed., Wiley 2015, ISBN 978-1-119-03566-4.
