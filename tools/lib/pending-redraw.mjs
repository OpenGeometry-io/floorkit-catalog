// SPDX-License-Identifier: Apache-2.0
/**
 * The seed blocks not yet redrawn to `docs/drafting-standard.md`, each with the
 * sha256 of its `blocks/floorkit/<slug>/1.0.0.op` bytes. Every check added for
 * LOD 300 blocks (the geometry gates, `catalog:lod`, anchor roles, ports, IFC)
 * skips exactly those files: the right path, version 1.0.0 and the same bytes.
 * Any other copy of a seed, in `blocks/` or outside it, gets every check.
 * The list only shrinks: each family issue removes its own slugs as it lands
 * their redraw, and the file is deleted once it is empty.
 */
export const PENDING_REDRAW = Object.freeze({
  bathtub: '12474e20c6d8fe103ea47697fdbfc1c4ef459402d9d2f88bcb72a4988bb16aae',
  cabinet: '208c3d4abd991faf3113d92c1977a9720297cd8d97aa84d1220f81df5166160c',
  chiller: 'c922e3ad1dd70eea4a6087953c333f32e8a371db828638cd7ef499310a48bc82',
  crah: 'cc1a3ed5fea2b5dff5b6bb25298b4e51e25ee91d42ccbf74fbb6c6c9da3d9672',
  hob: 'd40e26c0d431ea6715fc84caa85aae10ee3e2960e70decf6a5155c7f041fcc61',
  pdu: 'aac409563d3d7a5ae2c34dbed3819f1a862695c8f7161ae0dc4b0f2ab65741b4',
  'rear-door-heat-exchanger': '4f4e460f297e30977f335e11334bc3d411c3f6999a34294c30a43b513be58a69',
  'rectangular-bathtub': '6bd72cb0e46cb6e0f6833155fab36c0d3f73f66fd7f7f1e0be1349268ab10270',
  'shower-tray': 'd908bde1230cf1a4c2400fa1b37263befb4f8b88101bb7ea1b2f00043a2e0513',
  ups: '5d9cede96ba9abac4af431d1ccb29b0e19b375410b25506abbbeb453ee839bd6',
  'wash-basin': '7e6a86b061addfbbe16d44fb5f279811f7b9614159a0cdd551b9a215dbe917fa',
  'washing-machine': 'de1ccbaff45473de4678e116296210f60204b50d4d40c7a32ac1ff28088477b4',
  wc: '3b9cdee775210c9a1be3a60f3baaf50863f43c2522c6b738b6f6c2a68c198df8',
  'wc-and-basin': '4d15484bb9b5e4eecd894feffff694ef3304f1e9699530c2147b0e2403c1a049',
});
