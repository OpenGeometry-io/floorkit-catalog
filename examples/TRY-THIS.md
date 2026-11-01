# Try this: the demo flat and office

One script furnishes a two-bedroom flat and a four-desk office with 82 copies of 43 catalog blocks, then draws a plan, a section and three elevations. The bathroom's WC, wash basin and bath are their 2.0.0 versions (format v2); the shower enclosure is 1.0.0.

## Run it

From the repository root:

```sh
FLOORKIT_DIR=<a Floorkit 3.0 build> node examples/demo.mjs
```

It ends with `demo holds; pictures in examples/out` and exits 0. Open the files in `examples/out/` in a browser.

## What each picture shows

- **`plan-1-50.svg`**: on the left the flat (kitchen, bathroom, two bedrooms, hall, living room), on the right the office with its meeting room. Every one of the 82 blocks draws (`plan: all 82 placed blocks draw (1:50)`). Doors, windows and walls are Floorkit's own.
- **`section-a-1-50.svg`**: a cut at z 2.7 through the kitchen, the bathroom and bedroom 2, seeing northwards from the cut. In the bathroom it passes through the WC and the wash basin, which draw as seen lines, with the bath and the shower enclosure beyond them. The walls run from 0.00 to 2.40 (`section A: wall lines from 0.000 to 2.400`). The counter top is at 0.90, the hood underside at 1.55 (0.65 above the counter), the kitchen pendant bottom at 2.00 (0.40 below the 2.40 ceiling) and the bath rim at 0.55. The script measures each height in the built body and in the section, and both agree (`counter top 0.90: built 0.900, section 0.900`, `bath rim 0.55: built 0.550, section 0.550`, `hood underside 1.55: built 1.550, section 1.550`, `pendant bottom 2.00: built 2.000, section 2.000`).
- **`elevation-kitchen-1-50.svg`**: the kitchen wall with its window, the fridge freezer, the base units with the sink and the hob, the hood, the wall unit, the washing machine under it, the dishwasher, and the pendant.
- **`elevation-bathroom-1-50.svg`**: the bathroom's south wall seen from inside the bathroom, with the WC, the wash basin and the bathroom door.
- **`elevation-office-1-50.svg`**: the office desk wall with its two windows, four desks, each with a pedestal under its right-hand end and a chair in front, and four ceiling luminaires.
- **`ifc-request.json`**: 108 elements. Each of the 82 blocks carries the class its `.op` names: `IfcElectricAppliance 7, IfcFurniture 43, IfcSanitaryTerminal 5, IfcLightFixture 20, IfcSpaceHeater 6, IfcAudioVisualAppliance 1`. For the 32 blocks with ports, Floorkit reads the class from the .op's legacy ifcClass key, which equals ifc:class (a known Floorkit fault: its distribution path reads only that key).
- **`roundtrip.json`**: the project saved (309369 bytes, with the text of all 43 blocks), opened again without the catalog and rebuilt. All 123 element ids and boxes are equal (`"equal": true`).

Every placed block draws in the section and the elevations it stands in: the list of blocks left out (`NOT_DRAWN`) is empty on a Floorkit 3.0 build.

Walls are not in the IFC request: Floorkit's semantic IFC refuses WallNetwork walls. Each elevation shows only the wall it is drawn for and the blocks in front of that wall.

Each block on its own: `FLOORKIT_DIR=<a Floorkit 3.0 build> node tools/render.mjs`, then open `renders/gallery.html`.
