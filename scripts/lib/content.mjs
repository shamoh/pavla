// Reads the content repository (pavla-content) and prepares it for the pipeline:
// creates skeleton YAML files for new images and assigns missing work IDs.
//
// Layout (no year folders: the year of a work is the year of its `date`):
//   <contentDir>/tvorba/<name>.jpg + <slug>.yaml       a work without a collection; image and YAML pair by slugify(name)
//   <contentDir>/tvorba/<slug>/*.jpg                   detail photos of that work (a folder named like a work next to it)
//   <contentDir>/tvorba/<collection>/                  any other folder is a collection; its slug is slugify(folder name),
//                                                      e.g. "2026-plener-sumava"; a collection may span several years
//     _kolekce.yaml                                    description of the collection (see scripts/lib/collections.mjs)
//     _uvod.jpg                                        optional cover photo of the collection
//     <name>.jpg + <slug>.yaml, <slug>/*.jpg           works of the collection and their detail photos
// Collections cannot be nested. Names starting with "." or "_" are not works.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { IMAGE_EXTENSIONS, dateYear, generateId, isValidId, slugify, splitExt, titleFromName } from './works.mjs';

export const WORKS_SUBDIR = 'tvorba';
/** Files of a collection folder that are not works. */
export const COLLECTION_META = '_kolekce.yaml';
export const COLLECTION_COVER = '_uvod';

const templatePath = new URL('../templates/work.yaml', import.meta.url);

const isHidden = (name) => name.startsWith('.') || name.startsWith('_');
const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Reads one folder with works: YAML and image files, detail folders and, when `allowCollections`,
 * collection folders (read recursively, one level only). `rel` is the folder relative to tvorba/ ('' = tvorba/).
 */
async function readFolder(worksRoot, rel, allowCollections) {
  const dir = path.join(worksRoot, rel);
  const where = (name) => [WORKS_SUBDIR, rel, name].filter(Boolean).join('/');
  const group = { dir: rel, yamls: new Map(), images: new Map(), details: new Map(), meta: null, cover: null };
  const problems = [];
  const collections = [];
  const folders = [];
  for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort(byName)) {
    const file = item.name;
    const { base, ext } = splitExt(file);
    if (rel && item.isFile() && file === COLLECTION_META) { group.meta = file; continue; }
    if (rel && item.isFile() && base === COLLECTION_COVER && IMAGE_EXTENSIONS.includes(ext)) { group.cover = file; continue; }
    if (isHidden(file)) continue;
    if (item.isDirectory()) { folders.push(file); continue; }
    if (ext === 'yaml' || ext === 'yml') {
      if (group.yamls.has(base)) problems.push(`${where(file)}: duplicate metadata for "${base}"`);
      else group.yamls.set(base, file);
    } else if (IMAGE_EXTENSIONS.includes(ext)) {
      const slug = slugify(base);
      if (group.images.has(slug)) problems.push(`${where(file)}: another image already maps to "${slug}" (${group.images.get(slug).file})`);
      else group.images.set(slug, { file, name: base });
    } else {
      problems.push(`${where(file)}: unknown file type, ignored`);
    }
  }
  // A folder named like a work next to it holds its detail photos; any other folder is a collection.
  for (const name of folders) {
    const slug = slugify(name);
    if (group.yamls.has(slug) || group.images.has(slug)) {
      const found = await readDetails(path.join(dir, name), where(name));
      problems.push(...found.problems);
      group.details.set(slug, { dir: name, files: found.files });
    } else if (allowCollections) {
      const inner = await readFolder(worksRoot, name, false);
      problems.push(...inner.problems);
      collections.push(inner.group);
    } else {
      problems.push(`${where(name)}/: a folder inside a collection must be the detail photos of a work next to it (${where(`${name}.jpg`)}); collections cannot be nested`);
    }
  }
  return { group, collections, problems };
}

/**
 * Lists the works folder: the works without a collection and every collection folder, each as
 * { dir, yamls, images, details, meta, cover }. Does not modify anything.
 */
export async function readTree(worksRoot) {
  const { group, collections, problems } = await readFolder(worksRoot, '', true);
  return { groups: [group, ...collections], problems };
}

/** Lists the detail photos in a work's folder: [{ name, file }] sorted by file name. */
async function readDetails(dir, where) {
  const files = [];
  const problems = [];
  const names = new Set();
  for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort(byName)) {
    if (isHidden(item.name)) continue;
    const { base, ext } = splitExt(item.name);
    if (!item.isFile() || !IMAGE_EXTENSIONS.includes(ext)) {
      problems.push(`${where}/${item.name}: only photos belong into a detail folder, ignored`);
      continue;
    }
    const name = slugify(base);
    if (!name || names.has(name)) {
      problems.push(`${where}/${item.name}: rename the photo, another detail photo already maps to "${name}"`);
      continue;
    }
    names.add(name);
    files.push({ name, file: item.name });
  }
  return { files, problems };
}

/** Creates the YAML text for a new work from the template. */
export async function skeletonYaml({ id, title, date }) {
  const template = await fs.readFile(templatePath, 'utf8');
  return template
    .replace('{{id}}', id)
    .replace('{{title}}', JSON.stringify(title))
    .replace('{{date}}', date);
}

/**
 * Inserts `id: <id>` above the first key. Plain text insertion, so the rest of the file
 * (comments, alignment, quoting) stays exactly as the author wrote it.
 */
export function withId(yamlText, id) {
  if (!YAML.isMap(YAML.parseDocument(yamlText).contents)) throw new Error('work metadata must be a YAML mapping');
  const lines = yamlText.split('\n');
  // First line that starts a top-level key; comments and blank lines above it stay on top.
  const at = lines.findIndex((l) => /^[^\s#-]/.test(l));
  lines.splice(at, 0, `id: ${id}`);
  return lines.join('\n');
}

const isoDay = (d) => d.toISOString().slice(0, 10);

/**
 * Scans the content repository, writes skeletons and IDs where needed and returns
 * { works, collectionFolders, created, assigned, problems }.
 * A work: { slug, dir (folder in tvorba/, '' without a collection), collection (slug or null), year (from its date,
 * null when the date is not valid), id, data, text, yamlPath, masterPath, details }.
 * A collection folder: { slug, dir, metaPath (null when there is no _kolekce.yaml yet), coverPath }.
 * Options: today (Date, the date of new skeletons), random (for deterministic IDs in tests).
 */
export async function prepareContent(contentDir, { today = new Date(), random } = {}) {
  const worksRoot = path.join(contentDir, WORKS_SUBDIR);
  const { groups, problems } = await readTree(worksRoot);
  const created = [];
  const assigned = [];
  const rel = (...p) => path.join(WORKS_SUBDIR, ...p);

  // Pass 1: parse every YAML and collect IDs that already exist.
  const entries = [];
  const taken = new Set();
  for (const g of groups) {
    for (const [slug, file] of g.yamls) {
      const yamlPath = path.join(worksRoot, g.dir, file);
      const text = await fs.readFile(yamlPath, 'utf8');
      let data;
      try {
        data = YAML.parse(text) ?? {};
      } catch (e) {
        problems.push(`${rel(g.dir, file)}: invalid YAML (${e.message.split('\n')[0]})`);
        continue;
      }
      if (isValidId(data.id)) taken.add(data.id);
      entries.push({ g, slug, yamlPath, text, data, image: g.images.get(slug), details: g.details.get(slug) });
    }
    // Pass 1b: images without metadata get a skeleton, dated today.
    for (const [slug, image] of g.images) {
      if (g.yamls.has(slug)) continue;
      const id = generateId(taken, random);
      taken.add(id);
      const text = await skeletonYaml({ id, title: titleFromName(image.name), date: isoDay(today) });
      const yamlPath = path.join(worksRoot, g.dir, `${slug}.yaml`);
      await fs.writeFile(yamlPath, text);
      created.push(rel(g.dir, `${slug}.yaml`));
      entries.push({ g, slug, yamlPath, text, data: YAML.parse(text), image, details: g.details.get(slug) });
    }
  }

  // Pass 2: YAML files written by hand get an ID on first run.
  for (const e of entries) {
    if (e.data.id !== undefined && e.data.id !== null && e.data.id !== '') continue;
    const id = generateId(taken, random);
    taken.add(id);
    e.text = withId(e.text, id);
    e.data = YAML.parse(e.text);
    await fs.writeFile(e.yamlPath, e.text);
    assigned.push(`${rel(e.g.dir, e.slug)}: ${id}`);
  }

  const works = entries.map((e) => {
    const year = dateYear(e.data.date);
    return {
      slug: e.slug,
      dir: e.g.dir,
      collection: e.g.dir ? slugify(e.g.dir) : null,
      year: Number.isInteger(year) && year >= 1000 && year <= 9999 ? String(year) : null,
      id: e.data.id,
      data: e.data,
      text: e.text,
      yamlPath: path.relative(contentDir, e.yamlPath),
      masterPath: e.image ? path.join(worksRoot, e.g.dir, e.image.file) : null,
      details: (e.details?.files ?? []).map((d) => ({ name: d.name, path: path.join(worksRoot, e.g.dir, e.details.dir, d.file) })),
    };
  });
  const collectionFolders = groups.filter((g) => g.dir).map((g) => ({
    slug: slugify(g.dir),
    dir: g.dir,
    metaPath: g.meta ? path.join(worksRoot, g.dir, g.meta) : null,
    coverPath: g.cover ? path.join(worksRoot, g.dir, g.cover) : null,
  }));
  return { works, collectionFolders, created, assigned, problems };
}
