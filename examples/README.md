# Examples

`demo.mjs` furnishes a two-bedroom flat and a four-desk office on one storey with 43 blocks from [`blocks/`](../blocks) and draws them with Floorkit. It is run by maintainers, against a Floorkit 3.0 build, like `tools/render.mjs`:

```sh
FLOORKIT_DIR=<dir containing dist/index.js> node examples/demo.mjs
```

[`TRY-THIS.md`](TRY-THIS.md) says what each picture shows.

## What it writes

In `examples/out/`, which git ignores:

| File | What |
| --- | --- |
| `plan-1-50.svg` | The plan of the storey at 1:50 |
| `section-a-1-50.svg` | Section A at z 2.7, through the kitchen, the bathroom (its WC and basin) and bedroom 2, looking north |
| `elevation-kitchen-1-50.svg` | The kitchen wall, from inside the kitchen |
| `elevation-bathroom-1-50.svg` | The bathroom's south wall with the WC and the basin, from inside the bathroom |
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
- a block's class in the IFC request is missing or differs from the `ifc:class` its `.op` names (a DOOR block with no class is reported as a known Floorkit fault instead: a DOOR block reaches the IFC request with no class);
- the reopened project has other element ids or boxes.

`--break=height`, `--break=plan`, `--break=ifc`, `--break=roundtrip` and `--break=omissions` each break one input on purpose, so that each check can be seen to fail. `--break=omissions` puts a room in section A's list of ids, which Floorkit refuses, so the section does not draw.

## Notes

- **Versions.** A placement names its block as `slug@x.y.z` (`wc@2.0.0`), or as `slug` for the newest version of a format the demo reads. The demo reads format 1 and format 2 ([docs/format-v2.md](../docs/format-v2.md)), and checks each file against its `sha256` and `format` in `index.json`. It places one version of each block.
- **`NOT_DRAWN`** in `demo.mjs` lists format 1 blocks that Floorkit cannot draw in a section or an elevation, with their filed faults. A placed block on that list is left out of those views only; any other drawing error fails the run. Format 2 blocks draw there as seen lines and are never left out. The list is empty: on a Floorkit 3.0 build every block that was on it (a cylinder turned about x or z, and a boolean with a cylinder operand) draws.
- `demo.mjs` copies the steps of `loadFloorkit` from `tools/lib/floorkit.mjs` instead of importing it, because that module reaches `ajv` and the demo imports only Node built-ins and the Floorkit build.
- Section A lists its walls and blocks by id and leaves the rooms out, because Floorkit refuses a room in a section's id list.
