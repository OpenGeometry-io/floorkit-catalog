// SPDX-License-Identifier: Apache-2.0
/**
 * `index.json`: what a loader reads first.
 *
 * Deterministic on purpose: no timestamp, no commit hash, entries in a fixed
 * order and bytes and hashes taken from the raw file. So `--check` can say
 * "the committed index is exactly what the blocks produce", and a hand edit to
 * either side fails CI.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, sha256Hex } from './op.mjs';
import { checkListedBlock, listBlocks, readJson, readPublishers } from './repo.mjs';

export const INDEX_SCHEMA = 'floorkit.catalog/v1';

/** Build the index, or throw with every reason it cannot be built. */
export function buildIndex(root) {
  const publishers = readPublishers(root);
  const revocations = readJson(root, 'revocations.json');
  const revoked = new Map();
  for (const item of revocations) {
    const key = `${item.publisher}/${item.slug}@${item.version}`;
    if (!item.at || !item.reason) throw new Error(`revocations.json: ${key} needs "at" and "reason"`);
    revoked.set(key, { at: item.at, reason: item.reason });
  }
  const { blocks, misplaced } = listBlocks(root);
  const problems = misplaced.map((item) => `${item.file}: ${item.message}`);
  const entries = [];
  for (const block of blocks) {
    const { definition, issues } = checkListedBlock(root, block, publishers);
    if (issues.length > 0) {
      problems.push(`${block.file}: ${issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
      continue;
    }
    const raw = readFileSync(path.join(root, block.file));
    const publisher = publishers.get(block.publisher);
    const metadata = definition.metadata;
    const key = `${block.publisher}/${block.slug}@${block.version}`;
    entries.push({
      id: definition.id,
      publisher: { id: publisher.id, name: publisher.name, tier: publisher.tier },
      slug: block.slug,
      version: block.version,
      labelName: definition.labelName,
      type: definition.type,
      category: metadata['catalog:category'],
      license: metadata['catalog:license'],
      attribution: metadata['catalog:attribution'],
      tags: metadata['catalog:tags'] ? metadata['catalog:tags'].split(', ') : [],
      dimensions: definition.dimensions,
      path: block.file,
      bytes: raw.length,
      sha256: sha256Hex(raw),
      contentHash: sha256Hex(canonicalJson(definition)),
      ...(revoked.has(key) ? { revoked: revoked.get(key) } : {}),
    });
    revoked.delete(key);
  }
  for (const key of revoked.keys()) problems.push(`revocations.json: ${key} names no block in blocks/`);
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return { schema: INDEX_SCHEMA, entries };
}

export const formatIndex = (index) => `${JSON.stringify(index, null, 2)}\n`;
