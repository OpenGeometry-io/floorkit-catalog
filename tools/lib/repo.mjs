// SPDX-License-Identifier: Apache-2.0
/**
 * The catalog as a whole: where blocks live, who may publish them, and the
 * rules that tie a file to its path.
 *
 *   blocks/<publisher>/<slug>/<x.y.z>.op
 *
 * A path is identity. The block's `id` is `<publisher>.<slug>` and its
 * `catalog:version` is the file name, so a file cannot claim to be something
 * its location says it is not.
 */
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { checkBlockText } from './op.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const TIERS = ['official', 'verified', 'community'];

export function readJson(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), 'utf8'));
}

/** `publishers.json`, checked: the list a block's publisher must be on. */
export function readPublishers(root = ROOT) {
  const list = readJson(root, 'publishers.json');
  const problems = [];
  if (!Array.isArray(list)) throw new Error('publishers.json must be an array');
  const byId = new Map();
  list.forEach((entry, index) => {
    const at = `publishers.json[${index}]`;
    const keys = Object.keys(entry ?? {}).sort().join(',');
    if (keys !== 'id,name,tier,url') problems.push(`${at} must have exactly id, name, tier and url`);
    if (!SLUG.test(entry?.id ?? '')) problems.push(`${at}.id must be lowercase-hyphenated`);
    if (typeof entry?.name !== 'string' || entry.name.length === 0) problems.push(`${at}.name is required`);
    if (!TIERS.includes(entry?.tier)) problems.push(`${at}.tier must be one of ${TIERS.join(', ')}`);
    if (!/^https:\/\/\S+$/.test(entry?.url ?? '')) problems.push(`${at}.url must be an https URL`);
    if (byId.has(entry?.id)) problems.push(`${at}.id "${entry.id}" is listed twice`);
    byId.set(entry?.id, entry);
  });
  if (problems.length > 0) throw new Error(problems.join('\n'));
  return byId;
}

/** Numeric semver order. */
export function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (pa[index] !== pb[index]) return pa[index] - pb[index];
  }
  return 0;
}

/**
 * Every file under `blocks/`, in a stable order (publisher, slug, numeric
 * version), with whatever is wrong with its PLACE: a stray file, a symlink, a
 * name that is not a version. What is wrong with its CONTENT is `checkBlockText`'s.
 */
export function listBlocks(root = ROOT) {
  const base = path.join(root, 'blocks');
  const blocks = [];
  const misplaced = [];
  const walk = (dir, depth) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (entry.name === '.gitkeep' && depth === 0) continue;
      if (lstatSync(full).isSymbolicLink()) {
        misplaced.push({ file: rel, message: 'is a symbolic link; blocks must be regular files' });
      } else if (entry.isDirectory() && depth < 2) {
        walk(full, depth + 1);
      } else if (entry.isFile() && depth === 2) {
        const [, publisher, slug, name] = rel.split('/');
        const version = name.endsWith('.op') ? name.slice(0, -3) : '';
        if (!SLUG.test(publisher) || !SLUG.test(slug) || !SEMVER.test(version)) {
          misplaced.push({ file: rel, message: 'must be blocks/<publisher>/<slug>/<x.y.z>.op, all lowercase-hyphenated' });
        } else {
          blocks.push({ file: rel, publisher, slug, version });
        }
      } else {
        misplaced.push({ file: rel, message: 'does not belong here; blocks/ holds only <publisher>/<slug>/<x.y.z>.op' });
      }
    }
  };
  walk(base, 0);
  blocks.sort(
    (a, b) =>
      (a.publisher < b.publisher ? -1 : a.publisher > b.publisher ? 1 : 0) ||
      (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0) ||
      compareSemver(a.version, b.version),
  );
  return { blocks, misplaced };
}

/** Content plus place: everything wrong with one listed block. */
export function checkListedBlock(root, block, publishers) {
  const raw = readFileSync(path.join(root, block.file));
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    return { text: '', definition: undefined, issues: [{ path: '/', message: 'is not valid UTF-8' }] };
  }
  const result = checkBlockText(text);
  const issues = [...result.issues];
  if (!publishers.has(block.publisher)) {
    issues.push({ path: '/', message: `publisher "${block.publisher}" is not in publishers.json` });
  }
  if (result.definition && typeof result.definition === 'object') {
    const expectedId = `${block.publisher}.${block.slug}`;
    if (result.definition.id !== expectedId) {
      issues.push({ path: '/id', message: `must be "${expectedId}" to match the file's path` });
    }
    const version = result.definition.metadata?.['catalog:version'];
    if (version !== block.version) {
      issues.push({ path: '/metadata/catalog:version', message: `must be "${block.version}" to match the file name` });
    }
  }
  return { text, definition: result.definition, issues };
}
