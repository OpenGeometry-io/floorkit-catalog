# Examples

`demo.mjs` furnishes a two-bedroom flat and a four-desk office on one storey with 43 blocks from [`blocks/`](../blocks) and draws them with Floorkit. It is run by maintainers, against a Floorkit build, like `tools/render.mjs`:

```sh
FLOORKIT_DIR=<dir containing dist/index.js> node examples/demo.mjs
```

[`TRY-THIS.md`](TRY-THIS.md) says what each picture shows.

## What it writes

In `examples/out/`, which git ignores:

| File | What |
| --- | --- |
| `plan-1-50.svg` | The plan of the storey at 1:50 |
| `section-a-1-50.svg` | Section A through the kitchen, the bathroom and bedroom 2, looking north |
| `elevation-kitchen-1-50.svg` | The kitchen wall, from inside the kitchen |
| `elevation-office-1-50.svg` | The office desk wall, from inside the office |
| `ifc-request.json` | Floorkit's semantic IFC request for the blocks, doors, windows and rooms |
| `roundtrip.json` | The ids and boxes of every built element, and whether they are equal after save, reopen and rebuild |

Each SVG is one view on a bare page fitted to it, through Floorkit's paper emitter: no title block.

## What it checks

The script exits 1 when:
- fewer than 30 distinct blocks are placed;
- a view does not draw;
- a placed block has no linework in the plan;
- the counter top (0.90), the bath rim (0.55), the hood underside (1.55) or the pendant bottom (2.00) is off by more than 5 mm in the built body or in section A;
- a block's class in the IFC request is missing or differs from the `ifc:class` its `.op` names (a DOOR block with no class is reported as FLO-235 instead);
- the reopened project has other element ids or boxes.

`--break=height`, `--break=plan`, `--break=ifc`, `--break=roundtrip` and `--break=omissions` each break one input on purpose, so that each check can be seen to fail.

## Notes

- `NOT_DRAWN` in `demo.mjs` lists the blocks Floorkit cannot draw in a section or an elevation (FLO-238, FLO-239). A placed block on that list is left out of those views only; any other drawing error fails the run.
- `demo.mjs` copies the steps of `loadFloorkit` from `tools/lib/floorkit.mjs` instead of importing it, because that module reaches `ajv` and the demo imports only Node built-ins and the Floorkit build.
- Section A lists its walls and blocks by id and leaves the rooms out, because Floorkit refuses a room in a section's id list.
