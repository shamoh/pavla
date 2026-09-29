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
export function validateWorks(works) {
  const problems = [];
  const byId = new Map();
  for (const w of works) {
    const where = w.yamlPath ?? `tvorba/${w.dir ? `${w.dir}/` : ''}${w.slug}.yaml`;
    if (!isValidSlug(w.slug)) problems.push(`${where}: "${w.slug}" is not a valid slug (use a-z, 0-9 and dashes)`);
    if (!isValidId(w.id)) problems.push(`${where}: invalid id "${w.id}"`);
    if (!w.data?.title) problems.push(`${where}: missing title`);
    if (!w.data?.date) problems.push(`${where}: missing date`);
    else if (!isValidYear(String(dateYear(w.data.date))) || !/^\d{4}-\d{2}-\d{2}/.test(formatDate(w.data.date))) {
      problems.push(`${where}: date must be a day like 2026-06-14 (the year of the work comes from it), not "${formatDate(w.data.date)}"`);
    }
    if (!w.data?.draft && w.data?.size_cm !== undefined && !validSize(w.data.size_cm)) {
      problems.push(`${where}: size_cm must be [width, height] in cm, both greater than 0`);
    }
    if (!w.data?.draft && isOnSale(w.data?.status) && !(typeof w.data.price === 'number' && w.data.price > 0)) {
      problems.push(`${where}: status "${w.data.status}" needs a price (price: <Kč>)`);
    }
    problems.push(...validateDetailCaptions(w, where));
    for (const flag of ['instagram', 'mockups']) {
      if (w.data?.[flag] !== undefined && w.data[flag] !== null && typeof w.data[flag] !== 'boolean') {
        problems.push(`${where}: ${flag} must be true or false`);
      }
    }
    if (w.data?.collection !== undefined && w.data.collection !== null && w.data.collection !== '') {
      problems.push(`${where}: "collection:" is not used any more, a work belongs to a collection by lying in its folder (tvorba/<collection>/)`);
    }
    if (w.id && byId.has(w.id)) problems.push(`${where}: id "${w.id}" is also used by ${byId.get(w.id)}`);
    else if (w.id) byId.set(w.id, where);
  }
  return problems;
}

/** Statuses of works that are for sale and not sold yet: they get Fler exports and the "unsold" filter. */
export const ON_SALE_STATUSES = ['available', 'reserved'];
export const isOnSale = (status) => ON_SALE_STATUSES.includes(status);

/**
 * Fields of a work that are copied to the public site repository. Anything else (private_note,
 * unknown keys) stays in the private content repository.
 */
export const PUBLIC_WORK_FIELDS = [
  'id', 'draft', 'title', 'date', 'technique', 'support', 'size_cm', 'tags',
  'status', 'price', 'fler', 'featured', 'collection', 'description', 'details', 'mockups',
];

/**
 * Every attribute a work's YAML supports: the public ones (except `collection`, which comes from the folder)
 * plus those that stay private. The skeleton of a new work (scripts/templates/work.yaml) must contain all of
 * them, a test checks it: a new attribute goes here, into PUBLIC_WORK_FIELDS if public, and into the template.
 */
export const WORK_FIELDS = [...PUBLIC_WORK_FIELDS.filter((f) => f !== 'collection'), 'instagram', 'private_note'];

/** Picks the public fields of `data` (in PUBLIC_WORK_FIELDS order), leaving out the rest. */
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
    return [`${where}: details must be a list of "<photo name>: <caption>" lines`];
  }
  const found = new Set((w.details ?? []).map((d) => d.name));
  const problems = [];
  for (const [name, caption] of Object.entries(captions)) {
    if (!found.has(detailKey(name))) problems.push(`${where}: details: no detail photo "${name}" in the folder tvorba/${w.dir ? `${w.dir}/` : ''}${w.slug}/`);
    else if (typeof caption !== 'string') problems.push(`${where}: details: the caption of "${name}" must be text`);
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

/** Suffixes of export file names after "<slug>-<id>" (-wall is a legacy Instagram mockup, still recognised for cleanup). */
const EXPORT_SUFFIX = '(-clean|-wall|-mockup-[a-z0-9-]+|-detail-([a-z0-9-]+))?\\.jpg';
const ANY_EXPORT_RE = new RegExp(`^[a-z0-9]+(?:-[a-z0-9]+)*-${ID_PATTERN}${EXPORT_SUFFIX}$`);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches the export files (Instagram, Fler) of the work with the given "<slug>-<id>" key; group 2 is a detail name. */
export const exportPattern = (key) => new RegExp(`^${escapeRe(key)}${EXPORT_SUFFIX}$`);

/**
 * Decides which export files are stale: exports of works that no longer exist (deleted or renamed)
 * and exports a current work should not have (a detail photo or mockup scene it no longer has,
 * Fler exports of a work that is not for sale any more).
 * `files` are "<year>/<file name>" paths inside one platform folder. `wanted` maps "<year>/<key>" of every
 * current work to the export suffixes it may have on this platform ('' = "<key>.jpg", '-clean',
 * '-detail-<name>', '-mockup-<scene>'), or to null when any export of the work is fine (unknown state).
 * A plain array of "<year>/<key>" means null for all. Files that do not look like exports are never
 * touched. Returns the paths to delete, sorted.
 */
export function planExportPrune(files, wanted) {
  const byYear = new Map();
  for (const [rel, allowed] of wanted instanceof Map ? wanted : new Map(wanted.map((w) => [w, null]))) {
    const [year, key] = rel.split('/');
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push({ re: exportPattern(key), allowed: allowed ? new Set(allowed) : null });
  }
  const claimed = (year, name) =>
    (byYear.get(year) ?? []).some(({ re, allowed }) => {
      const m = re.exec(name);
      return m !== null && (!allowed || allowed.has(m[1] ?? ''));
    });
  return files
    .filter((f) => {
      const [year, name] = f.split('/');
      return ANY_EXPORT_RE.test(name) && !claimed(year, name);
    })
    .sort();
}

/** True when the author asked for mockups of a work (`mockups: true`), independent of whether it is for sale. */
export const wantsMockups = (data) => data?.mockups === true;

/** True when the author asked for Instagram exports of a work (`instagram: true`). */
export const wantsInstagram = (data) => data?.instagram === true;

/**
 * Export suffixes a work should have, per platform (see planExportPrune).
 * Instagram: only works with `instagram: true`, the original on paper and every detail photo, never mockups.
 * Fler: only works on sale, the original and every mockup. `mockupScenes` null = unknown (no web images yet).
 */
export function expectedExports({ status, details, mockupScenes, instagram = false }) {
  const onSale = isOnSale(status);
  return {
    instagram: instagram ? ['-clean', ...details.map((d) => `-detail-${d}`)] : [],
    fler: !onSale ? [] : mockupScenes === null ? null : ['', ...mockupScenes.map((s) => `-mockup-${s}`)],
  };
}
