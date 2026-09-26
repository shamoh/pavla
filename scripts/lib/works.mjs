// Pure helpers shared by the image pipeline and the Astro site.
// No filesystem access here, so everything is easy to unit test.

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

const dateYear = (date) => {
  if (date instanceof Date) return date.getFullYear();
  const m = /^(\d{4})/.exec(String(date ?? ''));
  return m ? Number(m[1]) : NaN;
};

/**
 * Validates scanned works. Each work: { year, slug, id, data, yamlPath }.
 * Returns a list of human-readable problems (empty when everything is fine).
 */
export function validateWorks(works) {
  const problems = [];
  const byId = new Map();
  for (const w of works) {
    const where = w.yamlPath ?? `${w.year}/${w.slug}`;
    if (!isValidYear(w.year)) problems.push(`${where}: folder "${w.year}" is not a year`);
    if (!isValidSlug(w.slug)) problems.push(`${where}: "${w.slug}" is not a valid slug (use a-z, 0-9 and dashes)`);
    if (!isValidId(w.id)) problems.push(`${where}: invalid id "${w.id}"`);
    if (!w.data?.title) problems.push(`${where}: missing title`);
    if (!w.data?.date) problems.push(`${where}: missing date`);
    else if (dateYear(w.data.date) !== Number(w.year)) {
      problems.push(`${where}: date ${formatDate(w.data.date)} does not match year folder ${w.year}`);
    }
    if (!w.data?.draft && w.data?.size_cm !== undefined && !validSize(w.data.size_cm)) {
      problems.push(`${where}: size_cm must be [width, height] in cm, both greater than 0`);
    }
    if (w.id && byId.has(w.id)) problems.push(`${where}: id "${w.id}" is also used by ${byId.get(w.id)}`);
    else if (w.id) byId.set(w.id, where);
  }
  return problems;
}

/** True for [width, height] with two positive numbers. */
export const validSize = (s) => Array.isArray(s) && s.length === 2 && s.every((n) => typeof n === 'number' && n > 0);

const formatDate = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

/**
 * Decides which generated entries are stale.
 * `existing` and `wanted` are lists of "<year>/<key>" paths; returns the ones to delete.
 */
export function planPrune(existing, wanted) {
  const keep = new Set(wanted);
  return existing.filter((p) => !keep.has(p)).sort();
}
