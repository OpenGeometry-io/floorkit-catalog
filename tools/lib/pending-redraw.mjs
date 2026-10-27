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
  'cafe-counter': '03e3729b4be40040a9b57dd9d22693e84a1c657cf485fb50ea297a97d172c2ec',
  chiller: 'c922e3ad1dd70eea4a6087953c333f32e8a371db828638cd7ef499310a48bc82',
  'counter-run': 'e4b9c95ebcdd2a74335441e3bf376a2bb80fa153d0032da0a8f1c69fc3e85232',
  crah: 'cc1a3ed5fea2b5dff5b6bb25298b4e51e25ee91d42ccbf74fbb6c6c9da3d9672',
  hob: 'd40e26c0d431ea6715fc84caa85aae10ee3e2960e70decf6a5155c7f041fcc61',
  'kitchen-counter': '0a996aef9b7515c92dcf725731c4ae09e1c7da59a0a1a52b893da97721dd07a2',
  'kitchen-sink': '249d8afba0592a834d9886c649235ccad429b920be18a29e8d14a8d8e4d1102c',
  'minimal-sofa': 'f3114b05c6c96fcd12aa800a130771e7bda7cd5fbfcb7632e184e8d5cc79df40',
  'office-desk': 'a9e0e0e242fbcf9b7e5702f5ab0bc5d5c2fada3116addb7f38cffee6a384f7c3',
  'parked-car': '4408c2f884abec21dd30421c2e58dbe7158793735fc541e52ba86059a63ebfe6',
  pdu: 'aac409563d3d7a5ae2c34dbed3819f1a862695c8f7161ae0dc4b0f2ab65741b4',
  planter: '486968838091c77210c1a42fc64b7de30b3c0844020e22d06f66679c648334c9',
  'rear-door-heat-exchanger': '4f4e460f297e30977f335e11334bc3d411c3f6999a34294c30a43b513be58a69',
  'rectangular-bathtub': '6bd72cb0e46cb6e0f6833155fab36c0d3f73f66fd7f7f1e0be1349268ab10270',
  'shower-tray': 'd908bde1230cf1a4c2400fa1b37263befb4f8b88101bb7ea1b2f00043a2e0513',
  'simple-chair': 'c05bdce899138afb3662726bf17106d3466490d8e3352dcc7bb2361ffe53c879',
  table: '7a6105fd8bdbf544ea3dd3fc68bed7a7f6cda1cdb7936adf37c6ec452148df10',
  tree: '2a983280ccde8fd6769d603688e52d5395926bd13e6927cdd1a6a2e26fdf1434',
  ups: '5d9cede96ba9abac4af431d1ccb29b0e19b375410b25506abbbeb453ee839bd6',
  'wash-basin': '7e6a86b061addfbbe16d44fb5f279811f7b9614159a0cdd551b9a215dbe917fa',
  'washing-machine': 'de1ccbaff45473de4678e116296210f60204b50d4d40c7a32ac1ff28088477b4',
  wc: '3b9cdee775210c9a1be3a60f3baaf50863f43c2522c6b738b6f6c2a68c198df8',
  'wc-and-basin': '4d15484bb9b5e4eecd894feffff694ef3304f1e9699530c2147b0e2403c1a049',
});
