// SPDX-License-Identifier: Apache-2.0
/**
 * The closed vocabularies of `docs/drafting-standard.md`, as data for the
 * validator. `test/op.test.mjs` reads the standard and fails if these and its
 * tables differ, so the two cannot drift: change the standard first.
 */

/** §7: every anchor name, and the roles it may carry. */
export const ANCHOR_ROLES = Object.freeze({
  base: ['floor-contact', 'surface-contact'],
  wallFace: ['wall-contact'],
  headWall: ['wall-contact'],
  ceilingContact: ['ceiling-contact'],
  seatCenter: ['seating-point'],
  seatLeft: ['seating-point'],
  seatRight: ['seating-point'],
  topCenter: ['top-surface'],
  serveEdge: ['serving-edge'],
  sleepingSurface: ['sleeping-surface'],
  drainCenter: ['drain-point'],
  faucetMount: ['tap-mount'],
  flushSide: ['transfer-side'],
  soilTop: ['planting-point'],
  canopyCenter: ['canopy-centre'],
  baseCenter: ['floor-contact'],
  tagMount: ['signage-mount'],
});

const pipe = (systemType, directions, sizes) => ({ domain: 'piping', systemType, directions, shape: 'round', sizes });

/** §8: every port id, with its domain, systemType, directions and sizes in metres. */
export const PORTS = Object.freeze({
  dcw: pipe('domesticColdWater', ['sink'], [0.015]),
  dhw: pipe('domesticHotWater', ['sink', 'source'], [0.015]),
  waste: pipe('drainage', ['source'], [0.032, 0.04]),
  soil: pipe('drainage', ['source'], [0.1]),
  flow: pipe('heating', ['sink', 'source'], [0.015, 0.022]),
  return: pipe('heating', ['source', 'sink'], [0.015, 0.022]),
  gas: pipe('gas', ['sink'], [0.022]),
  exhaust: { domain: 'hvac', systemType: 'exhaustAir', directions: ['source'], shape: 'round', sizes: [0.1, 0.15] },
  flue: { domain: 'hvac', systemType: 'exhaustAir', directions: ['source'], shape: 'round', sizes: [0.1] },
  power: { domain: 'electrical', systemType: 'power', directions: ['sink'], shape: 'electrical', poles: 1, voltage: 230 },
});

/**
 * §8: the data-centre seeds keep their own port ids, since renaming a port is a
 * MAJOR change. These five ids skip the whole port table, not only the id.
 */
export const KEPT_PORT_IDS = Object.freeze(['floorkit.chiller', 'floorkit.crah', 'floorkit.pdu', 'floorkit.rear-door-heat-exchanger', 'floorkit.ups']);
