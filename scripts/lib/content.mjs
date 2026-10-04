// Reads the content repository and prepares it for the pipeline:
// creates skeleton YAML files for new images and assigns missing work IDs.
//
// Layout (no year folders: the year of a work is the year of its `date`):
//   <contentDir>/tvorba/<name>.jpg + <slug>.yaml       a work without a collection; image and YAML pair by slugify(name)
//   <contentDir>/tvorba/<slug>/*.jpg                   detail photos of that work (a folder named like a work next to it)
//   <contentDir>/tvorba/<collection>/                  any other folder is a collection; its slug is slugify(folder name),
//                                                      e.g. "2026-plener-sumava"; a collection may span several years
//     _index.yaml                                      description of the collection (see scripts/lib/collections.mjs)
//     _cover.jpg                                       optional cover photo of the collection
//     <name>.jpg + <slug>.yaml, <slug>/*.jpg           works of the collection and their detail photos
// Collections cannot be nested. Names starting with "." or "_" are not works.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { normalizeMetadata, skeleton, todoKeys } from './metadata-yaml.mjs';
import { artform } from './seo.mjs';
import { COLLECTION_SCHEMA, HOME_SCHEMA, PHOTO_SCHEMA, WORK_SCHEMA, YEAR_SCHEMA } from './schema.mjs';
import { IMAGE_EXTENSIONS, dateYear, generateId, isValidId, slugify, splitExt, titleFromName } from './works.mjs';

export const WORKS_SUBDIR = 'tvorba';
// System files share two names wherever they are: _index.yaml describes the place it lies in (the content root =
// the home page, a collection folder = the collection), _cover.<ext> is that place's own cover photo.
export const INDEX_FILE = '_index.yaml';
export const COVER_NAME = '_cover';
/** Files of a collection folder that are not works. */
export const COLLECTION_META = INDEX_FILE;
export const COLLECTION_COVER = COVER_NAME;
/** Former names of the system files: a file still named so is an error, never silently ignored or migrated. */
export const RETIRED_NAMES = { index: ['_kolekce.yaml', 'uvod.yaml'], cover: ['_uvod', 'uvod'] };

/** Problem of a system file under its former name, or null. `rel`: the folder of the file ('' = the content root). */
export function retiredNameProblem(rel, file, { index, cover }) {
  const { base, ext } = splitExt(file);
  const where = [rel, file].filter(Boolean).join('/');
  if (index.includes(file)) return `${where}: renamed to ${INDEX_FILE}, rename the file`;
  if (cover.includes(base) && IMAGE_EXTENSIONS.includes(ext)) return `${where}: renamed to ${COVER_NAME}.${ext}, rename the file`;
  return null;
}

const isHidden = (name) => name.startsWith('.') || name.startsWith('_');
const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Reads one folder with works: YAML and image files, detail folders and, when `allowCollections`,
 * collection folders (read recursively, one level only). `rel` is the folder relative to tvorba/ ('' = tvorba/).
 */
async function readFolder(worksRoot, rel, allowCollections) {
  const dir = path.join(worksRoot, rel);
  const where = (name) => [WORKS_SUBDIR, rel, name].filter(Boolean).join('/');
  const group = { dir: rel, yamls: new Map(), images: new Map(), details: new Map(), meta: null, cover: null, retired: false };
  const problems = [];
  const collections = [];
  const folders = [];
  for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort(byName)) {
    const file = item.name;
    const { base, ext } = splitExt(file);
    if (rel && item.isFile() && file === COLLECTION_META) { group.meta = file; continue; }
    if (rel && item.isFile() && base === COLLECTION_COVER && IMAGE_EXTENSIONS.includes(ext)) { group.cover = file; continue; }
    const retired = rel && item.isFile() && retiredNameProblem(where(''), file, { index: ['_kolekce.yaml'], cover: ['_uvod'] });
    if (retired) { problems.push(retired); group.retired = true; continue; }
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

/** The YAML text of a new work: every attribute of WORK_SCHEMA, marked DOPLNIT (except the id). */
export const skeletonYaml = ({ id, title, date }) => skeleton(WORK_SCHEMA, { id, title, date });

/**
 * Brings the YAML of one content file in line with its schema (scripts/lib/metadata-yaml.mjs) and writes it when
 * it changed. Adds to `updated` ("<file>: …" in Czech, for the run summary) and `problems`. Returns the new text.
 */
export async function keepInLine(text, schema, file, absPath, updated, problems) {
  const r = normalizeMetadata(text, schema);
  if (r.problem) {
    problems.push(`${file}: ${r.problem}`);
    return text;
  }
  if (!r.changed) return text;
  await fs.writeFile(absPath, r.text);
  const notes = [];
  const settled = new Set(schema.fields.filter((f) => f.settled).map((f) => f.key));
  const toCheck = r.added.filter((k) => !settled.has(k));
  const final = r.added.filter((k) => settled.has(k));
  if (toCheck.length) notes.push(`doplněno ${toCheck.join(', ')} (DOPLNIT)`);
  if (final.length) notes.push(`doplněno ${final.join(', ')} (výchozí hodnota)`);
  if (r.unknown.length) notes.push(`neznámé ${r.unknown.join(', ')} (NEZNÁMÝ)`);
  updated.push(`${file}: ${notes.length ? notes.join('; ') : 'srovnány komentáře a pořadí'}`);
  return r.text;
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
 * Scans the content repository, writes skeletons and IDs where needed, brings every work's YAML in line with
 * WORK_SCHEMA and returns { works, collectionFolders, created, assigned, updated, pending, problems }.
 * `pending`: published works (meta_draft: false) that still have values marked DOPLNIT ("<file>: <keys>").
 * A work: { slug, dir (folder in tvorba/, '' without a collection), collection (slug or null), year (from its date,
 * null when the date is not valid), id, data, text, yamlPath, masterPath, details }.
 * A collection folder: { slug, dir, metaPath (null when there is no _index.yaml yet), coverPath,
 * retired (a system file under its former name: reported, no skeleton is written) }.
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
      const text = skeletonYaml({ id, title: titleFromName(image.name), date: isoDay(today) });
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

  // Pass 3: every file gets all supported attributes, in order, with their technical comments.
  const updated = [];
  const pending = [];
  for (const e of entries) {
    const file = path.relative(contentDir, e.yamlPath);
    e.text = await keepInLine(e.text, WORK_SCHEMA, file, e.yamlPath, updated, problems);
    e.data = YAML.parse(e.text) ?? {};
    const todo = e.data.meta_draft === true ? [] : todoKeys(e.text);
    if (todo.length) pending.push(`${file}: ${todo.join(', ')}`);
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
    retired: g.retired,
  }));
  return { works, collectionFolders, created, assigned, updated, pending, problems };
}

/**
 * Attributes the schema does not know (typos like "mockup:"), in every work, collection, year, home page and photo description:
 * ["<file>: <keys>"]. Reads only, changes nothing; used by the weekly health check.
 */
export async function findUnknownAttributes(contentDir) {
  const files = [];
  const worksRoot = path.join(contentDir, WORKS_SUBDIR);
  const { groups } = await readTree(worksRoot);
  for (const g of groups) {
    for (const file of g.yamls.values()) files.push([path.join(WORKS_SUBDIR, g.dir, file), WORK_SCHEMA]);
    if (g.meta) files.push([path.join(WORKS_SUBDIR, g.dir, g.meta), COLLECTION_SCHEMA]);
  }
  const yearsDir = path.join(contentDir, 'roky');
  for (const f of (await fs.readdir(yearsDir).catch(() => [])).sort()) if (/\.ya?ml$/.test(f)) files.push([path.join('roky', f), YEAR_SCHEMA]);
  if (await fs.access(path.join(contentDir, INDEX_FILE)).then(() => true, () => false)) files.push([INDEX_FILE, HOME_SCHEMA]);
  const photosDir = path.join(contentDir, 'fotky');
  const photos = await fs.readdir(photosDir).catch(() => []);
  for (const f of photos.sort()) if (/\.ya?ml$/.test(f)) files.push([path.join('fotky', f), PHOTO_SCHEMA]);

  const found = [];
  for (const [file, schema] of files) {
    const { unknown } = normalizeMetadata(await fs.readFile(path.join(contentDir, file), 'utf8'), schema);
    if (unknown.length) found.push(`${file}: ${unknown.join(', ')}`);
  }
  return found;
}

/**
 * Techniques of the works for which search engines get no art form (`artform` in scripts/lib/seo.mjs knows no rule
 * for them): ["<technique>: <file>, <file>"], sorted; a work without a technique is left out. Changes nothing.
 */
export async function findUnknownTechniques(contentDir) {
  const { groups } = await readTree(path.join(contentDir, WORKS_SUBDIR));
  const files = new Map();
  for (const g of groups) {
    for (const file of g.yamls.values()) {
      const rel = path.join(WORKS_SUBDIR, g.dir, file);
      const technique = String(YAML.parse(await fs.readFile(path.join(contentDir, rel), 'utf8'))?.technique ?? '').trim();
      if (technique && !artform(technique)) files.set(technique, [...(files.get(technique) ?? []), rel]);
    }
  }
  return [...files].sort(([a], [b]) => a.localeCompare(b, 'cs')).map(([technique, list]) => `${technique}: ${list.join(', ')}`);
}
