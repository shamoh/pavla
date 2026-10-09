// Pure helpers shared by the image pipeline and the Astro site.
// No filesystem access here, so everything is easy to unit test.

import path from 'node:path';
import { TODO, WORK_SCHEMA, fieldKeys, optionProblems, publicKeys } from './schema.mjs';

/** Characters used for work IDs: lowercase letters and digits without look-alikes (0/o, 1/l/i). */
export const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
/**
 * The first character is always a letter other than "e": otherwise YAML would read IDs such as
 * "22222" or "2e345" as numbers (the latter even as Infinity).
 */
export const ID_FIRST = ID_ALPHABET.replace(/[\de]/g, '');
export const ID_LENGTH = 5;

const ID_PATTERN = `[${ID_FIRST}][${ID_ALPHABET}]{${ID_LENGTH - 1}}`;
const ID_RE = new RegExp(`^${ID_PATTERN}$`);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEAR_RE = /^\d{4}$/;
const KEY_RE = new RegExp(`^([a-z0-9]+(?:-[a-z0-9]+)*)-(${ID_PATTERN})$`);

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'];

export const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);
export const isValidSlug = (slug) => typeof slug === 'string' && SLUG_RE.test(slug);
export const isValidYear = (year) => typeof year === 'string' && YEAR_RE.test(year);

/**
 * Returns a random ID that is not in `taken`.
 * `random` is injectable for tests; it must return a float in [0, 1).
 */
export function generateId(taken = new Set(), random = Math.random) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let id = ID_FIRST[Math.floor(random() * ID_FIRST.length)];
    for (let i = 1; i < ID_LENGTH; i++) id += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
    if (!taken.has(id)) return id;
  }
  throw new Error('Could not generate a unique work ID');
}

/** "Ráno u rybníka" → "rano-u-rybnika". */
export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Human title from a file name: "ráno_u rybníka" → "Ráno u rybníka". */
export function titleFromName(name) {
  const t = String(name).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toLocaleUpperCase('cs') + t.slice(1);
}

/** Splits "photo.JPG" into { base: "photo", ext: "jpg" }. */
export function splitExt(file) {
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return { base: file, ext: '' };
  return { base: file.slice(0, dot), ext: file.slice(dot + 1).toLowerCase() };
}

/** Folder/URL name of a work: "<slug>-<id>". */
export const workKey = (slug, id) => `${slug}-${id}`;

/** Inverse of workKey; returns null for anything that is not a valid key. */
export function parseWorkKey(key) {
  const m = KEY_RE.exec(key);
  return m ? { slug: m[1], id: m[2] } : null;
}

/** Extracts a work ID from the end of a URL path such as "/tvorba/2025/old-name-k3f9a/". */
export function idFromPath(pathname) {
  const m = new RegExp(`-(${ID_PATTERN})/?$`).exec(pathname);
  return m ? m[1] : null;
}

/** Year of a work date ("2026-06-14" or a Date); NaN when there is none. The year of a work is always its date's. */
export const dateYear = (date) => {
  if (date instanceof Date) return date.getFullYear();
  const m = /^(\d{4})/.exec(String(date ?? ''));
  return m ? Number(m[1]) : NaN;
};

/**
 * Validates scanned works. Each work: { slug, dir, id, data, yamlPath, details? } where `dir` is its folder
 * in tvorba/ ('' without a collection) and `details` lists the detail photos next to it ([{ name }]).
 * Returns a list of human-readable problems (empty when everything is fine).
 */
/** The description file of a work as the content repository has it, for messages: tvorba/[<collection>/]<slug>.yaml. */
export const workPath = (w) => w.yamlPath ?? `tvorba/${w.dir ? `${w.dir}/` : ''}${w.slug}.yaml`;

export function validateWorks(works) {
  const problems = [];
  const byId = new Map();
  for (const w of works) {
    const where = workPath(w);
    if (!isValidSlug(w.slug)) problems.push(`${where}: „${w.slug}“ není platné jméno pro adresu (jen a-z, 0-9 a pomlčky), přejmenuj soubor`);
    if (!isValidId(w.id)) problems.push(`${where}: neplatný kód id „${w.id}“ (kód přiděluje automatika, řádek id smaž a dostane nový)`);
    if (!w.data?.title) problems.push(`${where}: chybí název (title)`);
    if (!w.data?.date) problems.push(`${where}: chybí datum (date)`);
    else if (!isValidYear(String(dateYear(w.data.date))) || !/^\d{4}-\d{2}-\d{2}/.test(formatDate(w.data.date))) {
      problems.push(`${where}: date musí být den ve tvaru 2026-06-14 (podle něj se obraz zařadí do roku), ne „${formatDate(w.data.date)}“`);
    }
    if (!w.data?.meta_draft && w.data?.size_cm !== undefined && w.data.size_cm !== null && !validSize(w.data.size_cm)) {
      problems.push(`${where}: size_cm musí být [šířka, výška] v cm, obojí větší než 0`);
    }
    if (!w.data?.meta_draft && isOnSale(w.data?.status) && !(typeof w.data.price === 'number' && w.data.price > 0)) {
      problems.push(`${where}: stav „${w.data.status}“ potřebuje cenu (price: <Kč>)`);
    }
    problems.push(...validateDetailCaptions(w, where));
    if (!w.data?.meta_draft) problems.push(...todoProblems(where, w.data, PUBLIC_WORK_FIELDS, ' (nebo nech meta_draft: true)'));
    problems.push(...optionProblems(where, w.data, WORK_SCHEMA));
    if (w.data?.collection !== undefined && w.data.collection !== null && w.data.collection !== '') {
      problems.push(`${where}: „collection:“ se už nepoužívá, obraz patří do kolekce tím, že leží v její složce (tvorba/<kolekce>/); řádek smaž`);
    }
    if (w.id && byId.has(w.id)) problems.push(`${where}: kód id „${w.id}“ má i ${byId.get(w.id)}`);
    else if (w.id) byId.set(w.id, where);
  }
  return problems;
}

/** Statuses of works that are for sale and not sold yet: they get Fler exports and the "unsold" filter. */
export const ON_SALE_STATUSES = ['available', 'reserved'];
export const isOnSale = (status) => ON_SALE_STATUSES.includes(status);

/**
 * Fields of a work that are copied to the public site repository (a draft is not copied at all): the shared ones,
 * without a prefix (scripts/lib/schema.mjs). meta_ and private_ attributes and unknown keys stay in the content repository.
 */
export const PUBLIC_WORK_FIELDS = publicKeys(WORK_SCHEMA);

/** Every attribute a work's YAML supports (WORK_SCHEMA in scripts/lib/schema.mjs). */
export const WORK_FIELDS = fieldKeys(WORK_SCHEMA);

/** Picks the public fields of `data` (in the order of `fields`), leaving out the rest. */
export function publicFields(data, fields) {
  const out = {};
  for (const f of fields) if (data?.[f] !== undefined) out[f] = data[f];
  return out;
}

/** Slug of a detail photo named in `details:` ("1 Mlha" and "1-mlha" both mean the file 1-mlha.jpg). */
export const detailKey = (name) => slugify(name);

/** `details:` in a work is an optional mapping "<detail file name>: <caption>". */
function validateDetailCaptions(w, where) {
  const captions = w.data?.details;
  if (captions === undefined || captions === null) return [];
  if (typeof captions !== 'object' || Array.isArray(captions)) {
    return [`${where}: details musí být řádky „název fotky: popisek“`];
  }
  const found = new Set((w.details ?? []).map((d) => d.name));
  const problems = [];
  for (const [name, caption] of Object.entries(captions)) {
    if (!found.has(detailKey(name))) problems.push(`${where}: details: ve složce tvorba/${w.dir ? `${w.dir}/` : ''}${w.slug}/ není detailní fotka „${name}“`);
    else if (typeof caption !== 'string') problems.push(`${where}: details: popisek „${name}“ musí být text`);
  }
  return problems;
}

/**
 * Where texts in `data` start with DOPLNIT (a placeholder for people to replace, e.g. the detail captions of a new
 * skeleton): "title", "tags[1]", "details.lodka"…, in the order of the data. Nothing on the site may keep any.
 */
export function todoTexts(data, at = '') {
  if (typeof data === 'string') return data.trim().startsWith(TODO) ? [at] : [];
  if (Array.isArray(data)) return data.flatMap((v, i) => todoTexts(v, `${at}[${i}]`));
  if (data && typeof data === 'object' && !(data instanceof Date)) {
    return Object.entries(data).flatMap(([k, v]) => todoTexts(v, at ? `${at}.${k}` : k));
  }
  return [];
}

/** Problems of the public `fields` of `data` that still start with DOPLNIT ("<where>: title still starts with DOPLNIT…"). */
export function todoProblems(where, data, fields, hint = '') {
  return todoTexts(publicFields(data, fields)).map((at) => `${where}: ${at} pořád začíná „${TODO}“, přepiš ho${hint}`);
}

/** True for [width, height] with two positive numbers. */
export const validSize = (s) => Array.isArray(s) && s.length === 2 && s.every((n) => typeof n === 'number' && n > 0);

/** Size of a work as Czech text with a decimal comma, e.g. "29,5 × 29,5 cm" from [29.5, 29.5]; '' without a valid size. */
export const formatSizeCm = (s) => (validSize(s) ? `${s.map((n) => String(n).replace('.', ',')).join(' × ')} cm` : '');

const formatDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

/**
 * Decides which generated entries are stale.
 * `existing` and `wanted` are lists of "<year>/<key>" paths; returns the ones to delete.
 */
export function planPrune(existing, wanted) {
  const keep = new Set(wanted);
  return existing.filter((p) => !keep.has(p)).sort();
}

/**
 * Suffixes of export file names after "<slug>-<id>" in the former flat layout (<year>/<key>…), still recognised
 * for cleanup; -clean (the work on paper) and -wall (a mockup) are even older Instagram exports.
 */
const EXPORT_SUFFIX = '(-clean|-wall|-caption-[a-z0-9-]+|-scene-[a-z0-9-]+|-mockup-[a-z0-9-]+|-detail-([a-z0-9-]+))?\\.jpg';
const ANY_EXPORT_RE = new RegExp(`^[a-z0-9]+(?:-[a-z0-9]+)*-${ID_PATTERN}${EXPORT_SUFFIX}$`);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches the files of the former flat layout of exports (<year>/<slug>-<id>-…) of the work with the given key. */
export const exportPattern = (key) => new RegExp(`^${escapeRe(key)}${EXPORT_SUFFIX}$`);


/**
 * Exports of a work (Instagram, Fler) live in a folder of their own that mirrors tvorba/ of the content repository:
 * tvorba/<collection>/<slug>.yaml -> export/<platform>/<collection>/<slug>/ (a work without a collection:
 * export/<platform>/<slug>/). `yamlPath` is relative to the content repository. Returns the folder relative to
 * export/<platform>/.
 */
export const exportFolder = (yamlPath, slug) => {
  const dir = path.posix.dirname(String(yamlPath).split(path.sep).join('/'));
  return path.posix.join(path.posix.relative('tvorba', dir), slug);
};

/**
 * File name of an export inside the folder of its work, from its suffix (see expectedExports):
 * '' -> 'original.jpg' (Fler), '-mockup-komoda' -> 'mockup-komoda.jpg', '-caption-papir' -> 'caption-papir.jpg',
 */
export const exportFileName = (suffix) => (suffix === '' ? 'original.jpg' : `${suffix.slice(1)}.jpg`);

/**
 * Names of files the pipeline writes into the folder of a work, per platform (anything else there is left alone);
 * post.txt is a former Instagram export (its text is in README.md now), still recognised for cleanup.
 */
export const EXPORT_FILES = {
  instagram: /^(?:(?:caption|scene|detail)-[a-z0-9-]+\.jpg|post\.txt|README\.md)$/,
  fler: /^(?:(?:original|mockup-[a-z0-9-]+)\.jpg|README\.md)$/,
};

/**
 * Decides which files under export/<platform>/ are stale. `files` are paths relative to export/<platform>/;
 * `wanted` maps the folder of every work that may have exports there (exportFolder) to the file names it should have,
 * or to null when any file of the work is fine (unknown state, e.g. no web images yet). Removed: exports in folders
 * of no current work (deleted, renamed, moved to another collection, no longer on sale or Instagram switched off),
 * exports a work should not have (a detail photo, scene or mockup it no longer has) and exports of the former flat
 * layout (<year>/<slug>-<id>-….jpg). Files whose names the pipeline never writes (`names`) are never touched.
 * Returns the paths, sorted.
 */
export function planFolderPrune(files, wanted, names) {
  return files
    .filter((f) => {
      const parts = f.split('/');
      const name = parts.at(-1), dir = parts.slice(0, -1).join('/');
      if (parts.length === 2 && YEAR_RE.test(parts[0]) && ANY_EXPORT_RE.test(name)) return true; // former layout
      if (!names.test(name)) return false;
      if (!wanted.has(dir)) return true;
      const allowed = wanted.get(dir);
      return allowed !== null && !allowed.has(name);
    })
    .sort();
}

/** True when the author asked for mockups of a work (`mockups: true`), independent of whether it is for sale. */
export const wantsMockups = (data) => data?.mockups === true;

/** True when the author asked for Instagram exports of a work (`meta_instagram: true`). */
export const wantsInstagram = (data) => data?.meta_instagram === true;

/**
 * Export suffixes a work should have, per platform (file names: exportFileName; stale files: planFolderPrune).
 * Instagram: only works with `meta_instagram: true`: `instagramVariants` (captions and studio scenes, see
 * scripts/lib/instagram.mjs instagramSuffixes) and every detail photo (the text of the post is in README.md), never the
 * mockups of the site.
 * Fler: only works on sale, the original and every mockup. `mockupScenes` null = unknown (no web images yet).
 */
export function expectedExports({ status, details, mockupScenes, instagram = false, instagramVariants = [] }) {
  const onSale = isOnSale(status);
  return {
    instagram: instagram ? [...instagramVariants, ...details.map((d) => `-detail-${d}`)] : [],
    fler: !onSale ? [] : mockupScenes === null ? null : ['', ...mockupScenes.map((s) => `-mockup-${s}`)],
  };
}

/** How many of the newest works of the author's selection (featured) take turns on a cover, one at random per visit. */
export const FEATURED_PICK = 10;

/**
 * Candidates for the cover of a list of works (newest first): its newest `n` works in the author's selection
 * (`isFeatured`), or just its newest work when none is selected. The first candidate is the fixed choice: the share
 * image and what visitors without JavaScript see; the page shows one of them at random.
 */
export function coverCandidates(works, isFeatured = (w) => w.featured === true, n = FEATURED_PICK) {
  const selected = works.filter(isFeatured);
  return selected.length ? selected.slice(0, n) : works.slice(0, 1);
}
