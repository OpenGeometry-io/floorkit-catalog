# Licensing

This repository holds two kinds of thing, under two licences, plus a code of conduct adapted from the Contributor Covenant.

| What | Where | Licence |
| --- | --- | --- |
| **Blocks**: the `.op` element definitions, and data derived from them | `blocks/**`, `index.json`, `test/fixtures/**`, the README banner `docs/images/minimal-sofa-*.png` | [CC BY 4.0](LICENSES/CC-BY-4.0.txt) |
| **The code of conduct**, adapted from the Contributor Covenant 2.1 | `CODE_OF_CONDUCT.md` | [CC BY 4.0](LICENSES/CC-BY-4.0.txt), as the Covenant is published |
| **Everything else**: schema, tools, tests, docs, CI | the rest of the repository | [Apache-2.0](LICENSES/Apache-2.0.txt) |

[`REUSE.toml`](REUSE.toml) states the same thing path by path, in a form [`reuse lint`](https://reuse.software/) can check.

This page is an engineering summary. The two licence texts are the terms, and nothing here is legal advice.

## Blocks: CC BY 4.0

Copyright (c) 2025-present Vishwajeet Mane and floorkit-catalog contributors. Each block's `catalog:attribution` metadata names the people it credits.

You may share and adapt the blocks for any purpose, including commercially. CC BY 4.0 §3(a) sets three conditions:
- give appropriate credit;
- link to the licence;
- say whether you changed anything.

### How to credit

Credit the catalog as a whole with this line:

```text
"floorkit-catalog" by Vishwajeet Mane and floorkit-catalog contributors,
https://github.com/OpenGeometry-io/floorkit-catalog, CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/)
```

That one line is the attribution every contributor has asked for.
- CC BY 4.0 §3(a)(1)(A)(i) lets a licensor designate who receives attribution, "in any reasonable manner requested by the Licensor". Every contributor designates this line by contributing (see [CONTRIBUTING.md](CONTRIBUTING.md#licence-and-sign-off)).
- An application that places blocks can show the line once, for example on an about or credits screen. It does not have to sit next to every chair.

**If you change a block, say so**, for example: "adapted from floorkit-catalog …".

**Credit travels with the block.** Each block carries `catalog:license` and `catalog:attribution` in its own `metadata`, so when a definition is embedded in a project file, its licence goes with it.

### What the licence does not grant

- **Trademarks.** CC BY 4.0 §2(b)(2) excludes trademark rights. "Floorkit", and the name of any manufacturer, are not licensed by this repository.
- **A warranty.** The blocks are provided as-is (§5). A block's dimensions and clearances are drawing aids. They do not replace a product's data sheet or the building regulations that apply to a project.
- **Floorkit itself.** The blocks are plain JSON: you can use them without Floorkit, and without a Floorkit licence key. Floorkit, the npm package `@opengeometry/floorkit`, has its own licence, and these blocks are not part of that package.

## Code, schema and docs: Apache-2.0

Copyright (c) 2025-present Vishwajeet Mane and floorkit-catalog contributors.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use these files except in compliance with the License. You may obtain a copy of the License at <https://www.apache.org/licenses/LICENSE-2.0>, and in [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
