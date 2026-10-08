// Collections of works (e.g. one plein-air trip, or a theme across years): every folder in <contentDir>/tvorba/
// is a collection, its works lie in it (see scripts/lib/content.mjs). Its slug (the web address) is slugify(folder
// name), e.g. "2026-plener-sumava"; the year is just a part of the name, a collection may span several years.
//   tvorba/<collection>/_index.yaml     title, description, optional `cover` and `focus` (private_note stays private)
//   tvorba/<collection>/_cover.jpg      optional cover photo
// Cover of a collection: its own photo, otherwise `cover: <work id>` (the work) or `cover: <work id>#<detail>`
// (one of its detail photos), otherwise its newest work. The cover is shown cropped to 3:2 around `focus: [x, y]` (%).

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { COLLECTION_META, WORKS_SUBDIR, keepInLine } from './content.mjs';
import { skeleton, yamlProblem } from './metadata-yaml.mjs';
import { COLLECTION_SCHEMA, fieldKeys, publicKeys } from './schema.mjs';
import { coverProblems, coverShareSource, parseCoverRef } from './covers.mjs';
import { isValidSlug, titleFromName } from './works.mjs';
import { NO_COLLECTION } from './gallery-filter.mjs';

/** Former home of collections; now they are folders in tvorba/. */
export const LEGACY_COLLECTIONS_SUBDIR = 'kolekce';

/** Fields of a collection copied to the public site repository (private_note stays private). */
export const PUBLIC_COLLECTION_FIELDS = publicKeys(COLLECTION_SCHEMA);
/** Every attribute of a collection's _index.yaml (COLLECTION_SCHEMA in scripts/lib/schema.mjs). */
export const COLLECTION_FIELDS = fieldKeys(COLLECTION_SCHEMA);


/**
 * Title of a new collection from its folder name, with a leading year moved to the end:
 * "2026-plener-sumava" → "Plener sumava 2026", "2026 Plenér Šumava" → "Plenér Šumava 2026",
 * "2025-2026 Ovce" → "Ovce 2025–2026". Only a starting point, the author writes the real title.
 */
export function titleFromFolder(name) {
  const m = /^(\d{4})(?:[-–](\d{4}))?[-_ ]+(.+)$/.exec(String(name).trim());
  if (!m) return titleFromName(name);
  return `${titleFromName(m[3])} ${m[2] ? `${m[1]}–${m[2]}` : m[1]}`;
}

/** Path of a collection's description relative to the content repository. */
export const collectionMetaPath = (dir) => path.join(WORKS_SUBDIR, dir, COLLECTION_META);

/**
 * Reads the collections (folders from prepareContent) and returns { collections, created, updated, problems }.
 * A folder without _index.yaml gets a skeleton (not when it has a file under a former name, see prepareContent);
 * every _index.yaml is brought in line with COLLECTION_SCHEMA.
 * Collection: { slug, dir, data, coverPath, yamlPath }.
 */
export async function prepareCollections(contentDir, folders = []) {
  const collections = [];
  const created = [];
  const updated = [];
  const problems = [];
  try {
    if ((await fs.stat(path.join(contentDir, LEGACY_COLLECTIONS_SUBDIR))).isDirectory()) {
      problems.push(`${LEGACY_COLLECTIONS_SUBDIR}/: kolekce jsou teď složky v ${WORKS_SUBDIR}/ (${WORKS_SUBDIR}/<kolekce>/${COLLECTION_META}), přesuň je tam`);
    }
  } catch {
    // no legacy folder, fine
  }
  const bySlug = new Map();
  for (const f of [...folders].sort((a, b) => a.dir.localeCompare(b.dir))) {
    const yamlPath = collectionMetaPath(f.dir);
    if (!isValidSlug(f.slug)) {
      problems.push(`${WORKS_SUBDIR}/${f.dir}/: přejmenuj složku, její název potřebuje písmena nebo číslice`);
      continue;
    }
    // The gallery uses ?collection=none for the works in no collection ("žádná"): no collection may have that address.
    if (f.slug === NO_COLLECTION) {
      problems.push(`${WORKS_SUBDIR}/${f.dir}/: adresu „${NO_COLLECTION}“ web používá pro obrazy bez kolekce, přejmenuj složku`);
      continue;
    }
    if (bySlug.has(f.slug)) {
      problems.push(`${WORKS_SUBDIR}/${f.dir}/: dává stejnou adresu na webu „${f.slug}“ jako ${WORKS_SUBDIR}/${bySlug.get(f.slug)}/, jednu ze složek přejmenuj`);
      continue;
    }
    bySlug.set(f.slug, f.dir);
    if (!f.metaPath && f.retired) continue; // reported by prepareContent; a skeleton would hide the renamed file
    let text;
    if (f.metaPath) {
      text = await fs.readFile(f.metaPath, 'utf8');
      text = await keepInLine(text, COLLECTION_SCHEMA, yamlPath, f.metaPath, updated, problems);
    } else {
      text = skeleton(COLLECTION_SCHEMA, { title: titleFromFolder(f.dir) });
      await fs.writeFile(path.join(contentDir, yamlPath), text);
      created.push(yamlPath);
    }
    let data;
    try {
      data = YAML.parse(text) ?? {};
    } catch (e) {
      problems.push(`${yamlPath}: ${yamlProblem(e)}`);
      continue;
    }
    if (!data.title) problems.push(`${yamlPath}: chybí název kolekce (title)`);
    collections.push({ slug: f.slug, dir: f.dir, data, coverPath: f.coverPath, yamlPath });
  }
  return { collections, created, updated, problems };
}

export { parseCoverRef };

/**
 * Checks `cover` and `focus` of every collection (scripts/lib/covers.mjs): `cover` must be a published work of that
 * collection (`<id>`) or one of its detail photos (`<id>#<detail photo name>`), and a collection cannot have both
 * `cover` and its own cover photo. Works: { id, data, details } from prepareContent.
 */
export function validateCollectionCovers(collections, works) {
  return collections.flatMap((c) => coverProblems({
    where: c.yamlPath ?? collectionMetaPath(c.dir ?? c.slug),
    data: c.data,
    photoPath: c.coverPath,
    works,
    inScope: (w) => w.collection === c.slug,
    scope: 'this collection',
  }));
}

/** Source of a collection's share image (coverShareSource in scripts/lib/covers.mjs), null when the site uses a work's. */
export const coverSource = (collection, works) =>
  coverShareSource({ photoPath: collection.coverPath, data: collection.data, works: works.filter((w) => w.collection === collection.slug) });
