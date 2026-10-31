# RFC 0002: toward Revit-family-like blocks (`.op` v2)

| | |
| --- | --- |
| **Status** | Draft |
| **Covers** | What a Revit loadable family is, how far `.op` v1 is from one, a sketch of `.op` v2, how to keep expressions safe in a community catalog, and the order to build it in |
| **Maintainer** | [@aka-blackboots](https://github.com/aka-blackboots) |
| **Date** | 2026-10-05 |
| **Builds on** | [RFC 0001](0001-catalog-and-loader.md) and [docs/format-v1.md](../format-v1.md) |
| **Note** | The name "format v2" now belongs to the Floorkit 3.0 node kinds ([RFC 0004](0004-format-v2.md)); the parametric-family format sketched here moves to a later format number |

How to read this document:
- **Nothing here is built.** Field names are sketches, not a schema, and nothing in this RFC changes what `tools/validate.mjs` accepts today.
- **Read** means taken from Floorkit's source at OpenPlans `681e4f1` (a private repository; paths are for maintainers who can open them). Floorkit paths are relative to `src/packages/openplans-core/src/`; the parser, `generic-element.ts`, is `elements/generic-element.ts` there. **Measured** means a command was run. **Unverified** means neither.
- External claims carry a key from [Sources](#sources). Keys marked † were read in full during research. The rest are known only from search-index excerpts: a direct fetch was either blocked (`help.autodesk.com`, `*.buildingsmart.org`, `gdl.graphisoft.com`, `help.sketchup.com` and `community.osarch.org` all refused it) or not attempted. Treat their detail as unverified. "(secondary)" marks a blog or forum.

## Summary

- **Plausible:** a JSON `.op` v2 can reach most of what a Revit loadable family does for library content (furniture, sanitary, casework, equipment, simple doors and windows). That means typed **parameters**, named **types**, a sidecar **type catalog**, **safe formulas**, **detail levels** and **IFC type** export.
- **Not plausible, and not advisable:** Revit's constraint-solver "flex" (reference planes with locked, labelled dimensions). v2 uses explicit expressions against named anchors instead: dataflow, not solving.
- **IFC stays the per-type export; `.op` is the authoring source.** IFC stores the resulting types, not the parametric family [osarch-families] [arXiv-2007.10951]; the partial exception is `IfcDoorType`'s lining and panel properties [bSI-door]. Revit has the same split: `.rfa` authors, IFC exchanges.
- **The gap today:** nothing in a v1 file drives geometry. `dimensions` feeds only fallbacks, and there are no parameters, types, formulas, detail levels or IFC types.
- **This catalog's job** would be to act as the conformance suite: a v2 schema beside v1, a CI "flex" that evaluates every type, and parity against Floorkit's evaluator. v1 blocks keep working unchanged.

## What a Revit family is

| Concept | What it is | Source |
| --- | --- | --- |
| Three kinds | *System* families (walls, floors, levels) are built in and never stored as files. *Loadable* families are `.rfa` files. *In-place* families are one-off, with a single type. | [AD-kinds] |
| Category and template | A family starts from a category template (`Furniture.rft`, `Generic Model Face Based.rft`) that fixes its behaviour. Flags include Always Vertical, Work Plane-Based, Shared, Room Calculation Point and Cut with Voids When Loaded. | [AD-templ] [AD-famparams] |
| Types; type and instance parameters | A family holds named types. A *type* parameter is set per type and every placement follows it; an *instance* parameter is set per placement. | [AD-createparams] |
| Shared parameters | Defined in an external tab-separated `.txt` (`*META`, `*GROUP`, `*PARAM` rows), each with a GUID. The GUID lets one value be scheduled and tagged across families and projects. | [AD-spfile] [AD-sp-api] |
| Type catalogs | A `.txt` named like the `.rfa`, beside it. The header declares columns as `Name##type##units` (e.g. `Width##length##millimeters`), then one row per type. On load, a "Specify Types" dialog loads only the rows picked. | [AD-tc] [AD-tc-load] |
| Formulas | `if()`, `and`, `or`, `not`, arithmetic, `sqrt`, `exp`, `log`, trigonometry, `pi()`, `round`, `roundup`, `rounddown`. No loops, no I/O, no user functions: a closed language. | [AD-formula] |
| Reference planes, labelled dimensions | A dimension between reference planes becomes a parameter once labelled. Locked dimensions make geometry follow it through Revit's constraint solver. "Flexing" means changing values to test the constraints. | [AD-dim] [AD-lock] [AD-constrain] |
| Nested and shared nested | A nested family acts as part of its host; marked *Shared*, it can be selected, tagged and scheduled on its own. A *Family Type* parameter swaps the nested type (secondary; that source is not listed here, so unverified). | [AD-famparams] |
| Detail levels, symbolic lines | Each element is shown or hidden per detail level (Coarse, Medium, Fine) and per view type. Symbolic lines and masking regions appear only in orthographic views, such as a door swing in plan. Subcategories style sub-parts. | [AD-vis] [AD-mask] [AD-subcat] |
| Hosting and voids | Wall-, floor-, ceiling- and roof-based families can only be placed on that host. Doors and windows cut their wall. Face-based families sit on any face. | [AD-templ] [AD-famparams] |
| Materials | Material is a parameter type, set per type or per instance (secondary). | [novedge] |
| Classification | OmniClass number and title (Table 23); Assembly Code from `UniformatClassifications.txt`. | [AD-omni] |
| IFC mapping | The shared parameters `IfcExportAs` (the entity) and `IfcExportType` (its PredefinedType) override the category's default class. | [AD-ifc] [osarch-revit-ifc] |
| The file | `.rfa` is an OLE compound file. Without Revit, only file properties and the PartAtom XML (the family, its types and their values) can be read. | [TBC-0248]† [TBC-1407]† |

## Where `.op` v1 stands

`.op` v1 is a static block: a plan symbol, a 3D body of analytic solids, named anchors and MEP ports ([format-v1.md](../format-v1.md)).

| Concept | `.op` v1 today | Evidence |
| --- | --- | --- |
| Parameters | None. `dimensions` drives only fallbacks: a plan rectangle, a box, and a plan-export outline when the plan yields nothing. A catalog block has both views, so none of them applies. An `.opbase` `overrides.dimensions` therefore changes no geometry of such a block. | Read: `elements/generic-element.ts:1468-1500`, `:2136-2149`, `projects/op-base.ts:1066-1073`; [format-v1 §2](../format-v1.md#2-top-level-fields) |
| Derived geometry | Not expressible. Floorkit's `Rack` is a class "because its geometry is *derived*: height follows `units` × RACK_UNIT_M, and the four ports move with the frame. A block would have to bake one height per file." | Read: `elements/datacenter/rack.ts:47-49` |
| Stretch | Only `placement.scale`, which stretches frame thicknesses too. `floorkit.counter-run` works around it by convention: "Authored 1.0 m long so a run scales by its length in X; depth and height never scale." | `blocks/floorkit/counter-run/1.0.0.op`, `catalog:note`; placement composition in [format-v1 §1](../format-v1.md#1-units-and-coordinates) |
| Types, type catalog | None. One file is one fixed geometry. | Read: `generic-element.ts:170-183` |
| Type vs instance | None. An edit writes into a private per-instance copy of the definition. | Read: `generic-element.ts:2174-2187` |
| Shared parameters | None. Metadata is a string record, and the catalog's vocabulary is closed. | [format-v1 §7](../format-v1.md#7-root-metadata) |
| Formulas, constraints | None: Floorkit has no evaluator. Anchors are mount points, not constraints. | Read; [format-v1 §5](../format-v1.md#5-anchors) |
| Nesting | Within one file only: `definitions` reused by `ref`. A block cannot reference another `.op`. | [format-v1 §4](../format-v1.md#4-definitions-and-references) |
| Detail levels | None; only whole-view toggles. `catalog:lod` is a label Floorkit does not read. | Read: `generic-element.ts:2003-2023` |
| Symbolic lines | Plan only (`profileView`); `toDrawing` returns nothing for any view but `'top'`. No masking regions or line roles. | Read: `generic-element.ts:2109-2110` |
| Materials | Per-node `color` only. `mat:<nodeId>` roles are catalog metadata. | [format-v1 §7](../format-v1.md#7-root-metadata) |
| Hosting, voids | None. `catalog:placement: hosted` is metadata only: "an OPBase relation resolves to a placement transform and never to a boolean". Parti adds its own `WallOpening`. | Read: `projects/building/model.ts:7-11`; [format-v1 §11](../format-v1.md#11-advisory-notes) |
| IFC | Class from `type` and ports: `FURNITURE`, `FIXTURE`, `APPLIANCE` without ports → `IfcFurnishingElement`. `ifc:class` is not read; legacy `ifcClass` only on the distribution-equipment path. No `IfcTypeProduct`, `RepresentationMap` or `IfcMappedItem` appears anywhere under OpenPlans `src/`. | Read: `exporter/semantic-ifc/SemanticIfcExtractor.ts:96-98`, `:213-219`; [format-v1 §11](../format-v1.md#11-advisory-notes). Measured: `grep -rlnE "IfcTypeProduct\|RepresentationMap\|IfcMappedItem" src/` at `681e4f1` lists no file (the same search for `IfcFurnishingElement` finds the extractor) |
| Property sets | Runtime only. The parser never reads `propertySets` from a file, and the catalog rejects the key. | Read: `generic-element.ts:826-852`, `:886-888` |
| Classification | `class:uniclass2015` and `class:omniclass` strings; Floorkit reads neither. | [format-v1 §7](../format-v1.md#7-root-metadata) |
| Connectors | **Present**, and strict. Port sizes are not tied to any parameter. | Read: `generic-element.ts:369-467` |
| Format version | The `.op` parser never reads `version`; it writes `1` whatever the file says. | Measured (`2` became `1`; [format-v1 §2](../format-v1.md#2-top-level-fields)); `generic-element.ts:831-832` |

## Proposed `.op` v2

A v2 block is a v1 block plus a parameter layer. **Evaluating a v2 block for one type, at given instance values and one detail level, yields a v1 definition.** That is the central choice: the node kinds, the kernel and the v1 checks stay as they are. Every evaluated type can be written out with `formatBlock` and judged by `checkBlockText` (both in `tools/lib/op.mjs`), exactly as a block is today. A sketch (metadata, anchors and `profileView` omitted; `<…>` is a placeholder, not a real code):

```json
{
  "version": 2,
  "id": "example.desk",
  "parameters": {
    "Width":     { "kind": "length", "scope": "type", "default": 1.6, "min": 1.2, "max": 2.0, "step": 0.1, "unit": "m" },
    "Depth":     { "kind": "length", "scope": "type", "default": 0.8, "min": 0.6, "max": 0.9, "step": 0.05, "unit": "m" },
    "Height":    { "kind": "length", "scope": "instance", "default": 0.74, "min": 0.62, "max": 1.25, "step": 0.01, "unit": "m" },
    "Modesty":   { "kind": "boolean", "scope": "type", "default": true },
    "TopFinish": { "kind": "material", "scope": "type", "default": "surface" },
    "LegInset":  { "kind": "length", "derive": { "expr": "Width * 0.05" } }
  },
  "types": [
    { "name": "1600 x 800", "values": { "Width": 1.6, "Depth": 0.8 } },
    { "name": "1200 x 600", "values": { "Width": 1.2, "Depth": 0.6, "Modesty": false } }
  ],
  "assert": [{ "expr": "Depth < Width", "message": "Depth must be less than Width." }],
  "modelView": { "elements": [
    { "id": "top", "kind": "cuboid", "material": { "param": "TopFinish" },
      "center": [0, { "expr": "Height - 0.0125" }, 0],
      "width": { "param": "Width" }, "height": 0.025, "depth": { "param": "Depth" } },
    { "id": "modesty", "kind": "cuboid", "visibleIf": { "param": "Modesty" }, "detail": ["medium", "fine"],
      "center": [0, 0.4, { "expr": "0.05 - Depth / 2" }],
      "width": { "expr": "Width - 2 * LegInset" }, "height": 0.35, "depth": 0.018 }
  ] },
  "ifc": { "type": "IfcFurnitureType", "predefinedType": "DESK", "occurrence": "IfcFurniture" },
  "classification": [{ "system": "Uniclass2015", "code": "<code>", "uri": "<bSDD class URI>" }]
}
```

| Field | Sketch | Priority |
| --- | --- | --- |
| `version: 2` | Read and gated by Floorkit. Today Floorkit 0.6 would parse this file as v1: it would drop `parameters`, `types`, `visibleIf` and the other new keys, build each cuboid size given as `{"param": …}` or `{"expr": …}` as 1 m, and put each coordinate given that way at 0 (read: `toFiniteNumber`, `generic-element.ts:289-291`, `:497-513`, `:608-617`; not executed). | Essential |
| `parameters` | `{kind, scope: "type" \| "instance", default, min, max, step, unit}`. Kinds: `length`, `angle`, `number`, `integer`, `boolean`, `enum`, `material`, `text`. Lengths in metres. | Essential |
| Bound numerics | Any numeric geometry field takes a number, `{"param": "Width"}` or `{"expr": "…"}`. Without this, types only rename things. | Essential |
| `types[]` | Named values for `type`-scope parameters. A placed instance stores its type name and its instance values only. | Essential |
| Type catalog | A sidecar `<slug>.types.json`, after Revit's `.txt` and OpenSCAD's `parameterSets` [SCAD]. The loader lists the rows, loads only those picked and copies them into `types[]`, so an embedded copy never needs the sidecar. | Valuable |
| Derived parameters | `"derive": {"expr": …}`. Parameters form a DAG, evaluated in topological order; a cycle fails validation. | Valuable |
| `visibleIf`, `assert` | `visibleIf` on any element (SketchUp's `Hidden` [SU-DC]); `assert` lists conditions every type and instance must meet (GDL's `VALUES` and `LOCK` [GDL-param]). | Valuable |
| Arrays | `"copies"` with a count expression and a spacing, for shelves and legs (SketchUp's `Copies` [SU-DC]); capped. | Valuable |
| Detail tags | `"detail": ["coarse", "medium", "fine"]` per element; absent means all three. Exported as IFC representation subcontexts, which carry a `TargetView` and a `TargetScale` under identifiers such as `Body`, `FootPrint` and `Annotation` [osarch-ctx]. | Valuable |
| Symbols per view | `"symbols": {"top": …, "front": …}`, with today's `profileView` as `top` (Hypar's `Symbol{Geometry, CameraPosition}` [Hypar-Symbol]†). | Valuable |
| Line roles | `"role"` on 2D elements: `cut`, `projection`, `hidden`, `overhead`, `swing` or `mask` (a fill with no stroke that hides what lies under it). The host maps roles to pens. | Valuable |
| Materials as parameters | `"material": {"param": "TopFinish"}`, valued from v1's seven `mat:` roles, so a finish-only type reuses its geometry (as `KHR_materials_variants` does [KHR-var]). | Valuable |
| `ifc` | `{type, predefinedType, occurrence}` → one `IfcTypeProduct` per type with `RepresentationMaps`; each placement an occurrence holding an `IfcMappedItem` and a transform, linked by `IfcRelDefinesByType` [bSI-TypeProduct]. `IfcFurnitureType` has `CHAIR` and `DESK` [bSI-IfcFurnitureType]. | Essential |
| `propertySets` | Read from the file at type level; an occurrence value overrides a type value of the same name, as in IFC [bSI-TypeProduct]. Nominal sizes fill `Pset_FurnitureTypeCommon` [bSI-furniture]. | Essential |
| `classification` | `[{system, code, uri}]`, preferring bSDD URIs [bSDD]. | Valuable |
| Shared-parameter registry | Catalog-level `parameters/` entries `{id, name, kind, bsdd, ifc}` (e.g. `"ifc": "Pset_FurnitureTypeCommon.NominalLength"`), keyed by a bSDD property URI where one exists rather than an invented GUID [bSDD]. A block's parameter names one with `"shared"`. | Valuable |
| `hosting` | `{"kind": "free" \| "wall" \| "floor" \| "ceiling" \| "face", "cut": {"ref": "<2D definition>", "depth": "host"}}`, compiled by Floorkit into a `WallOpening`, as Parti does by hand today. | Valuable for openings; Later otherwise |
| Nested blocks | `"nested": [{"use": "example.desk-leg@^1", "type": …, "placement": …, "bind": {…}}]`, resolved from the catalog by semver range; each definition stored once and placed by transform, like Speckle's `InstanceDefinitionProxy` and `InstanceProxy` [Speckle]; depth capped. | Later |
| Mesh escape hatch | A glTF body with a required bounding box and plan symbol (Hypar's `ContentElement` [Hypar-CE]†). Not parametric. | Later |
| Manufacturer data | `Pset_ManufacturerTypeInformation`, NBS and COBie fields. | Later |

## Safety of expressions in a community catalog

A block here is written by a stranger and evaluated in every consumer's browser, and in Parti's Electron main process if Parti evaluates it there. The precedents point both ways:
- Revit's formulas are a closed language; its executable risks are macros and Dynamo graphs, which it disables or warns about by default [AD-macro] [AD-dynamo]. GDL is a full language with file-I/O add-ons, shared through a community portal [GDL-io] [GC-BIMcomp].
- **"Safe" JavaScript evaluators fail.** `expr-eval` (all versions) and `expr-eval-fork` before 3.0.1 have CVE-2025-12735, CVSS 9.8: a function object passed in the evaluation context is invoked during evaluation, which allows remote code execution [NVD] [CERT-VU263614]. math.js calls its parser sandboxed and warns there may be unknown vulnerabilities [mathjs-sec].
- **Two designs are safe by construction.** JSON Logic has no `eval`, no side effects and no loops, and a rule is itself JSON, so a JSON Schema can check it [jsonlogic-js]†. CEL "evaluates in linear time, is mutation free, and not Turing-complete" [cel-spec]†. A zero-dependency JavaScript CEL exists; its conformance is unverified, and it returns `BigInt` for integer literals [cel-js].

The rules for v2:
1. **Expressions are data.** Floorkit parses them into an AST and walks it: never `eval`, `new Function` or a library that does either.
2. **A whitelist of pure functions**, roughly Revit's set [AD-formula]. Nothing from the host is in scope: the scope is a frozen map of the block's own scalar parameters, so the expr-eval failure has nothing to call.
3. **An acyclic graph.** Derived parameters are sorted topologically; a cycle is a validation error, never a runtime one.
4. **Budgets, refused rather than clamped:** AST nodes and depth per expression, expressions per block, array copies, nesting depth, and nodes and points after evaluation. Set them as v1's were set ([format-v1 §9](../format-v1.md#9-limits-and-why)).
5. **Pinned numerics:** IEEE-754 doubles (never `BigInt`), lengths in metres, a specified `round`, no `random`, no clock. Whether trigonometry agrees bit for bit across JavaScript engines is unverified, so parity compares within a stated tolerance.
6. **No I/O.** An expression cannot name a URL, a file or another block.
7. **Strict validation**, as in v1: unknown keys and out-of-range values are refused, never repaired.
8. **Flex in CI.** Every type is evaluated at its defaults, with each parameter at its `min` and at its `max`, and at every type-catalog row. Each result must pass the v1 checks and every `assert`, and its plan and 3D bounds are recorded.

## What not to copy

- **The constraint solver** [AD-lock] [AD-constrain]. A solver's answer is whatever its implementation finds, so every consumer would need the same solver to draw the same block, and its cost is hard to bound. Expressions against named anchors give one answer, computed in order, checkable in CI.
- **GDL-style scripting.** GDL has loops, `GOTO` and `GOSUB` [GDL-flow], and add-ons that open, read and write files, including by full path [GDL-io]. Community content would be running code.
- **Closed binary formats.** Beyond its properties and PartAtom, `.rfa` cannot be read without Revit [TBC-1407]†. `.op` stays JSON with a published schema that any tool can read, diff and review.

## Precedents to borrow from

- **Archicad GDL:** ranges, value lists, `LOCK` and `HIDEPARAMETER` as declarative rules; a 2D symbol separate from the 3D body [GDL-param] [GC-script].
- **IFC type objects:** a type carries shared property sets and representation maps, and occurrences map them [bSI-TypeProduct].
- **bSDD:** dictionaries of classes and properties, each with a URI, referenced from IFC through `IfcClassificationReference` [bSDD].
- **Bonsai:** its parametric doors keep parameters in a custom property set that another program cannot tweak without Bonsai's code. Parameters are portable only if the evaluator is a published spec [osarch-families] (secondary).
- **SketchUp Dynamic Components:** `Copies` for parametric arrays, `Hidden` as an expression [SU-DC].
- **Hypar Elements:** `ContentElement` (glTF, bounding box, scale to metres, facing direction) and view-keyed `Symbol`s [Hypar-CE]† [Hypar-Symbol]†.
- **Speckle:** a definition stored once (`InstanceDefinitionProxy`) and placed by transform (`InstanceProxy`), recursively [Speckle].
- **OpenSCAD Customizer:** a JSON `parameterSets` file beside the model; a set may be partial [SCAD].
- **glTF `KHR_materials_variants`:** material variants over shared geometry, explicitly not a configurator [KHR-var].

## Ordered path

1. **Harden v1 in the SDK.** [RFC 0001's first steps](0001-catalog-and-loader.md#what-to-move-into-the-floorkit-sdk): a strict validator that returns issues, a version gate, and limits with memoised builds. Also read `propertySets` from the file; export `IfcFurniture` / `IfcFurnitureType` instead of `IfcFurnishingElement`, which IFC4 deprecates for direct use [bSI-IFC4-furnishing]; and read `ifc:class` for every asset, so the legacy `ifcClass` can retire. The version gate must ship before the first v2 block is published.
2. **v2 core:** `parameters`, `types[]`, bound numerics and the sidecar type catalog; `schema/op/v2.schema.json`; a reference evaluator in `tools/`.
3. **IFC type export:** `IfcTypeProduct` with `RepresentationMaps`, `IfcMappedItem` occurrences, `Pset_*TypeCommon`, a stable type identity for the type's `GlobalId`, and occurrence-overrides-type.
4. **Expressions:** derived parameters, `visibleIf`, `assert` and arrays, with the CI flex.
5. **Representation:** detail tags, symbols per view, line roles and masks, mapped to IFC subcontexts.
6. **Semantics:** the shared-parameter registry keyed to bSDD, classification, material parameters.
7. **Later:** hosting and voids for generic content; nested blocks; the glTF escape hatch; manufacturer and COBie data.

## The catalog's role

The catalog would be where the v2 spec is tested, not only where blocks are stored.
- **A v2 schema beside v1.** `schema/op/v2.schema.json` would sit next to `v1.schema.json`; the format's major version is in the path.
- **Flex in CI** (rule 8). Every evaluated type then goes through the same `tools/lib/op.mjs` checks as a v1 block.
- **Parity.** `tools/parity.mjs` would gain a mode that compares Floorkit's evaluation of every flexed type with the reference evaluator's. Two implementations agreeing is the evidence that the spec, not one codebase, defines the result. Like today's parity, it needs a Floorkit build until the npm package exists.
- **v1 keeps working.** Released files never change (`tools/immutable.mjs`). A v2 block is a new file and a new version of its block.
- **Old readers must be kept off v2 files.** The index needs a per-entry format version so a loader can filter. The v1 index schema is closed, so that is an index schema change, the same question [RFC 0001's open question 6](0001-catalog-and-loader.md#open-questions-for-the-owner) raises for `deprecated`.
- **Layout.** `listBlocks` in `tools/lib/repo.mjs` treats any file under `blocks/` other than `<publisher>/<slug>/<x.y.z>.op` as misplaced, which fails both `tools/validate.mjs` and the index build. A sidecar type catalog therefore needs a layout rule first. Under `REUSE.toml` as it stands, a sidecar under `blocks/**` would be CC BY 4.0, like the block.

## Open questions

1. **Expression encoding.** A string grammar (as sketched), JSON Logic, or a CEL subset? Whichever is chosen must be specified independently of any one library.
2. **Sidecar or inline type catalog.** RFC 0001 rejected sidecar metadata because an embed leaves it behind. Copying picked rows into `types[]` avoids that; is a sidecar still worth its layout cost for a block with few types?
3. **Versioning parameters.** Is renaming or removing a parameter or a type MAJOR, since saved instances name them? Is changing a default MAJOR when it would move placed instances, as for anchors?
4. **Units.** Metres only, or declared units in a type-catalog header, as in Revit's `##length##millimeters`? And an `angle` parameter needs a rule, because v1 geometry angles are radians while placement rotations are degrees.
5. **Type identity.** What stable id becomes an IFC type's `GlobalId`: a uuid per type in the file, or one derived from block id, version and type name?
6. **Who owns the evaluator.** A reference evaluator here would be Apache-2.0 and could move into Floorkit as the loader can (RFC 0001), or Floorkit owns it and the catalog only tests it.
7. **IFC5.** It is JSON with layered composition, and its own README says it is "not suitable for production use" [IFC5-repo]†. Watch it; do not target it.

## Sources

Read in full during research (†):
- [Hypar-CE] https://github.com/hypar-io/Elements/blob/master/Elements/src/ContentElement.cs
- [Hypar-Symbol] https://github.com/hypar-io/Elements/blob/master/Elements/src/Symbol.cs
- [cel-spec] https://github.com/google/cel-spec
- [jsonlogic-js] https://github.com/jwadhams/json-logic-js
- [TBC-0248] https://raw.githubusercontent.com/jeremytammik/tbc/gh-pages/a/0248_extract_part_atoms.htm
- [TBC-1407] https://raw.githubusercontent.com/jeremytammik/tbc/gh-pages/a/1407_read_rvt_without_revit.html
- [IFC5-repo] https://raw.githubusercontent.com/buildingSMART/IFC5-development/main/README.md

From search-index excerpts only (unverified in detail):
- Autodesk Revit help: [AD-kinds] https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-403FFEAE-BFF6-464D-BAC2-85BF3DAB3BA2.htm · [AD-templ] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-E36987A9-A68F-4121-A391-907306BAA60A.htm · [AD-famparams] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-68EFCA67-4913-4E00-AB9E-F2E6A7BEF8C6.htm · [AD-createparams] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-921F7A15-D191-4F75-8243-4989C482E253.htm · [AD-spfile] https://help.autodesk.com/cloudhelp/2015/ENU/Revit-API/files/GUID-9C7F6E02-05C2-4F72-8108-60F2175FB9E3.htm · [AD-sp-api] https://help.autodesk.com/cloudhelp/2018/CHT/Revit-API/files/GUID-D0F45890-91E0-419B-B0EF-575BA83A4BE9.htm · [AD-tc] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-FFA71D72-D4C5-416D-BF65-1757657C3CE9.htm · [AD-tc-load] https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-5DB0797C-B0CA-4C3F-B72A-84176738AEC5.htm · [AD-formula] https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-B37EA687-2BDF-4712-9951-2088B2A8E523.htm · [AD-dim] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-0F8851B7-506E-44EC-8137-C8F11909B7FA.htm · [AD-lock] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-B638562A-D041-419A-B356-64536C493EE9.htm · [AD-constrain] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-26CE1E00-72C1-49D6-9295-A59F50BAA0EF.htm · [AD-vis] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-253B2300-35C2-4024-AB70-43E576CEA49C.htm · [AD-mask] https://help.autodesk.com/cloudhelp/2018/ENU/Revit-DocumentPresent/files/GUID-B72C69FA-F58A-4752-8905-843DB89484C6.htm · [AD-subcat] https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Customize/files/GUID-55A3626E-D458-48BA-9169-915F53014006.htm · [AD-omni] https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-D9434F74-4FDC-4B66-9EDA-35313B1CE676.htm · [AD-ifc] https://help.autodesk.com/cloudhelp/2018/ENU/Revit-DocumentPresent/files/GUID-7119A8C3-A0EE-4568-8C35-750410D867C9.htm · [AD-macro] https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Customize/files/GUID-23497666-2918-4F91-A50A-402949070658.htm · [AD-dynamo] https://help.autodesk.com/cloudhelp/2026/ENU/RevitDynamo/files/RevitDynamo_About_Dynamo_Graph_Security_html.html
- Secondary, on Revit: [novedge] https://novedge.com/blogs/design-news/revit-tip-material-parameters-as-single-source-of-truth · [osarch-revit-ifc] https://wiki.osarch.org/index.php/Revit_setup_for_OpenBIM/Revit_and_IFC_classes
- buildingSMART and IFC: [bSI-TypeProduct] https://technical.buildingsmart.org/projects/2024tunnel/schema/ifckernel/lexical/ifctypeproduct.htm · [bSI-furniture] https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/Pset_FurnitureTypeCommon.htm · [bSI-IfcFurnitureType] https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/IfcFurnitureType.htm · [bSI-IFC4-furnishing] https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2/HTML/schema/ifcproductextension/lexical/ifcfurnishingelement.htm · [bSI-door] https://standards.buildingsmart.org/IFC/RELEASE/IFC4/FINAL/HTML/schema/ifcarchitecturedomain/lexical/ifcdoorpanelproperties.htm · [osarch-ctx] https://wiki.osarch.org/ifc-industry-foundation-classes-representation-context/ · [bSDD] https://technical.buildingsmart.org/services/bsdd/referencing-bsdd-in-ids-and-ifc/ · [arXiv-2007.10951] https://arxiv.org/pdf/2007.10951
- Bonsai and GDL: [osarch-families] https://community.osarch.org/discussion/comment/26896/ · [GC-script] https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-301.htm · [GDL-param] https://gdl.graphisoft.com/gdl-basics/parameter-logic/ · [GDL-flow] https://gdl.graphisoft.com/?p=881 · [GDL-io] https://gdl.graphisoft.com/reference-guide/gdl-text-io-add-on/ · [GC-BIMcomp] https://help.graphisoft.com/AC/27/INT/_AC27_Help/040_ElementsVB/040_ElementsVB-280.htm
- Other tools and formats: [SU-DC] https://help.sketchup.com/en/sketchup/dynamic-component-predefined-attributes · [Speckle] https://docs.speckle.systems/developers/sdks/python/concepts/proxification · [SCAD] https://files.openscad.org/documentation/manual/Customizer.html · [KHR-var] https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_materials_variants
- Expression security: [NVD] https://nvd.nist.gov/vuln/detail/CVE-2025-12735 · [CERT-VU263614] https://kb.cert.org/vuls/id/263614 · [mathjs-sec] https://mathjs.org/docs/expressions/security.html · [cel-js] https://socket.dev/npm/package/@marcbachmann/cel-js/overview/8.0.0
