// Collections of works (e.g. one plein-air trip) from <contentDir>/kolekce/.
// Each collection: <slug>.yaml (title, description, optional `cover` and `focus`) plus an optional cover photo <slug>.jpg.
// Cover of a collection: its own photo, otherwise `cover: <work id>` (the work) or `cover: <work id>#<detail>`
// (one of its detail photos), otherwise its newest work. The cover is shown cropped to 3:2 around `focus: [x, y]` (%).
// A work joins a collection with `collection: <slug>` in its YAML.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { isValidFocus } from './photos.mjs';
import { IMAGE_EXTENSIONS, detailKey, isValidSlug, slugify, splitExt, titleFromName } from './works.mjs';

export const COLLECTIONS_SUBDIR = 'kolekce';

/** Fields of a collection copied to the public site repository (private_note stays private). */
export const PUBLIC_COLLECTION_FIELDS = ['title', 'description', 'cover', 'focus'];

const templatePath = new URL('../templates/collection.yaml', import.meta.url);

async function skeleton(title) {
  const template = await fs.readFile(templatePath, 'utf8');
  return template.replace('{{title}}', JSON.stringify(title));
}

/**
 * Scans the collections folder and returns { collections, created, problems }.
 * Writes a skeleton YAML for a cover photo without one and for every slug in `referenced`
 * (collections named by works) that does not exist yet.
 */
export async function prepareCollections(contentDir, referenced = new Set()) {
  const root = path.join(contentDir, COLLECTIONS_SUBDIR);
  const collections = [];
  const created = [];
  const problems = [];
  let files = [];
  try {
    files = (await fs.readdir(root, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name).sort();
  } catch {
    // the folder is optional until the first collection
  }

  const yamls = new Map();
  const images = new Map();
  for (const file of files) {
    if (file.startsWith('.')) continue;
    const { base, ext } = splitExt(file);
    if (ext === 'yaml' || ext === 'yml') yamls.set(base, file);
    else if (IMAGE_EXTENSIONS.includes(ext)) {
      const slug = slugify(base);
      if (images.has(slug)) problems.push(`${COLLECTIONS_SUBDIR}/${file}: another cover photo already maps to "${slug}"`);
      else images.set(slug, file);
    } else problems.push(`${COLLECTIONS_SUBDIR}/${file}: unknown file type, ignored`);
  }

  const wanted = new Map();
  for (const slug of yamls.keys()) wanted.set(slug, null);
  for (const [slug, file] of images) if (!wanted.has(slug)) wanted.set(slug, titleFromName(splitExt(file).base));
  for (const slug of referenced) if (!wanted.has(slug)) wanted.set(slug, titleFromName(slug));

  for (const [slug, newTitle] of [...wanted].sort(([a], [b]) => a.localeCompare(b))) {
    if (!isValidSlug(slug)) {
      problems.push(`${COLLECTIONS_SUBDIR}/${yamls.get(slug) ?? images.get(slug)}: rename to letters, digits and dashes`);
      continue;
    }
    let text;
    if (yamls.has(slug)) {
      text = await fs.readFile(path.join(root, yamls.get(slug)), 'utf8');
    } else {
      text = await skeleton(newTitle);
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(path.join(root, `${slug}.yaml`), text);
      created.push(`${COLLECTIONS_SUBDIR}/${slug}.yaml`);
    }
    let data;
    try {
      data = YAML.parse(text) ?? {};
    } catch (e) {
      problems.push(`${COLLECTIONS_SUBDIR}/${slug}.yaml: invalid YAML (${e.message.split('\n')[0]})`);
      continue;
    }
    if (!data.title) problems.push(`${COLLECTIONS_SUBDIR}/${slug}.yaml: missing title`);
    collections.push({ slug, data, coverPath: images.has(slug) ? path.join(root, images.get(slug)) : null });
  }
  return { collections, created, problems };
}

/** "vjr39#1-kvety" → { id: "vjr39", detail: "1-kvety" }; "vjr39" → { id: "vjr39", detail: null }. */
export function parseCoverRef(cover) {
  const [id, ...rest] = String(cover).trim().split('#');
  return { id: id.trim(), detail: rest.length ? detailKey(rest.join('#')) : null };
}

/**
 * Checks `cover` and `focus` of every collection. `cover` must be a published work of that collection
 * (`<id>`) or one of its detail photos (`<id>#<detail photo name>`), and a collection cannot have both
 * `cover` and its own cover photo. Works: { id, data, details } from prepareContent.
 */
export function validateCollectionCovers(collections, works) {
  const problems = [];
  for (const c of collections) {
    const where = `${COLLECTIONS_SUBDIR}/${c.slug}.yaml`;
    if (c.data?.focus !== undefined && c.data.focus !== null && !isValidFocus(c.data.focus)) {
      problems.push(`${where}: focus must be [x, y] in % (0–100), e.g. focus: [50, 30]`);
    }
    const cover = c.data?.cover;
    if (cover === undefined || cover === null || cover === '') continue;
    const { id, detail } = parseCoverRef(cover);
    const work = works.find((w) => w.id === id);
    if (c.coverPath) problems.push(`${where}: cover ${cover} and the cover photo ${path.basename(c.coverPath)} both set, keep one`);
    else if (!work) problems.push(`${where}: cover ${cover}: ${id} is not the id of any work`);
    else if (work.data.collection !== c.slug) problems.push(`${where}: cover ${cover} (${work.data.title}) is not in this collection`);
    else if (work.data.draft) problems.push(`${where}: cover ${cover} (${work.data.title}) is a draft, it is not on the web`);
    else if (detail !== null && !(work.details ?? []).some((d) => d.name === detail)) {
      problems.push(`${where}: cover ${cover}: ${work.data.title} has no detail photo "${detail}" (folder ${work.year}/${work.slug}/)`);
    }
  }
  return problems;
}

/**
 * Master file of the image a collection shows as its cover, the same choice the site makes:
 * its own photo, otherwise `cover` (a work or `<id>#<detail>`), otherwise its newest published work.
 * Works: { id, data, masterPath, details: [{ name, path }] } from prepareContent. Null when unknown.
 */
export function coverSource(collection, works) {
  if (collection.coverPath) return collection.coverPath;
  const members = works
    .filter((w) => w.data.collection === collection.slug && !w.data.draft)
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
  const ref = collection.data?.cover ? parseCoverRef(collection.data.cover) : null;
  const work = ref ? members.find((w) => w.id === ref.id) : members[0];
  if (!work) return null;
  if (ref?.detail) return work.details?.find((d) => d.name === ref.detail)?.path ?? null;
  return work.masterPath ?? null;
}
