// Public copies of the descriptions in this repo: content/ mirrors the content repository, with the same folders and
// file names, only the public attributes and no comments (the pipeline writes them, the site reads them):
//   content/_index.yaml                      the home page
//   content/tvorba/<slug>.yaml               a work without a collection (+ derived_modified, see MODIFIED)
//   content/tvorba/<collection>/_index.yaml  a collection (its folder is its slug)
//   content/tvorba/<collection>/<slug>.yaml  a work of the collection (the collection comes from the folder)
//   content/roky/<year>.yaml                 a year
//   content/fotky/<name>.yaml                another photo of the site
// The year of a work comes from its `date`, as in the content repository; drafts are never copied.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { INDEX_FILE, WORKS_SUBDIR } from './content.mjs';
import { PHOTOS_SUBDIR } from './photos.mjs';
import { YEARS_SUBDIR } from './years.mjs';

/**
 * derived_ attribute of the public copy of a work (made by the pipeline, never in the content repository): the day
 * (YYYY-MM-DD) its public attributes or its images last changed; lastmod of the work in the sitemap.
 */
export const MODIFIED = 'derived_modified';

/** Folder of the public copies in this repo. */
export const COPIES_DIR = 'content';

/** Path of the public copy of a work (relative to this repo); `collection`: its slug or null. */
export const workCopyPath = (collection, slug) => path.posix.join(COPIES_DIR, WORKS_SUBDIR, collection ?? '', `${slug}.yaml`);
/** Path of the public copy of a collection's _index.yaml. */
export const collectionCopyPath = (slug) => path.posix.join(COPIES_DIR, WORKS_SUBDIR, slug, INDEX_FILE);
/** Path of the public copy of a year. */
export const yearCopyPath = (year) => path.posix.join(COPIES_DIR, YEARS_SUBDIR, `${year}.yaml`);
/** Path of the public copy of the home page. */
export const HOME_COPY = path.posix.join(COPIES_DIR, INDEX_FILE);
/** Path of the public copy of a photo's description. */
export const photoCopyPath = (name) => path.posix.join(COPIES_DIR, PHOTOS_SUBDIR, `${name}.yaml`);

const isYaml = (f) => f.endsWith('.yaml');
const isSystem = (f) => f.startsWith('_') || f.startsWith('.');
const readYaml = (file) => YAML.parse(fs.readFileSync(file, 'utf8')) ?? {};
const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)) : []);

/**
 * Reads the public copies under `root` (this repo, or .demo/site for the test data):
 * { works: [{ slug, collection (slug or null), data }], collections: [{ slug, data }],
 *   years: Map(year → data), home: data | null, photos: Map(name → data) }.
 */
export function readCopies(root) {
  const base = path.join(root, COPIES_DIR);
  const works = [];
  const collections = [];
  const worksDir = path.join(base, WORKS_SUBDIR);
  for (const e of list(worksDir)) {
    if (e.isFile() && isYaml(e.name) && !isSystem(e.name)) {
      works.push({ slug: e.name.slice(0, -5), collection: null, data: readYaml(path.join(worksDir, e.name)) });
    } else if (e.isDirectory() && !isSystem(e.name)) {
      const dir = path.join(worksDir, e.name);
      for (const f of list(dir)) {
        if (!f.isFile() || !isYaml(f.name)) continue;
        if (f.name === INDEX_FILE) collections.push({ slug: e.name, data: readYaml(path.join(dir, f.name)) });
        else if (!isSystem(f.name)) works.push({ slug: f.name.slice(0, -5), collection: e.name, data: readYaml(path.join(dir, f.name)) });
      }
    }
  }
  const years = new Map();
  for (const e of list(path.join(base, YEARS_SUBDIR))) {
    if (e.isFile() && /^\d{4}\.yaml$/.test(e.name)) years.set(e.name.slice(0, 4), readYaml(path.join(base, YEARS_SUBDIR, e.name)));
  }
  const photos = new Map();
  for (const e of list(path.join(base, PHOTOS_SUBDIR))) {
    if (e.isFile() && isYaml(e.name)) photos.set(e.name.slice(0, -5), readYaml(path.join(base, PHOTOS_SUBDIR, e.name)));
  }
  const homeFile = path.join(root, HOME_COPY);
  return { works, collections, years, home: fs.existsSync(homeFile) ? readYaml(homeFile) : null, photos };
}

/**
 * Files under content/ of `root` that are not in `wanted` (paths relative to `root`, e.g. "content/roky/2026.yaml"):
 * left over from deleted, renamed or unpublished items, or from an older layout. Sorted.
 */
export function staleCopies(root, wanted) {
  const stale = [];
  const walk = (rel) => {
    for (const e of list(path.join(root, rel))) {
      const r = path.posix.join(rel, e.name);
      if (e.isDirectory()) walk(r);
      else if (!wanted.has(r)) stale.push(r);
    }
  };
  walk(COPIES_DIR);
  return stale.sort();
}
