// Recommendations for the descriptions of works, collections, years, the home page and photos: nothing wrong enough to
// stop a run, only what would make the site better (shown in the run summary under "Doporučení",
// scripts/lib/summary.mjs). Messages are Czech ("<file>: <what and how>") because Pavla reads them. Texts still starting with DOPLNIT are left to the checks.

import { untranslatedWords } from './instagram.mjs';
import { TODO } from './schema.mjs';
import { SEARCH_TITLE_MAX } from './seo.mjs';
import { isOnSale, wantsMockups, workPath } from './works.mjs';

/** The first letter (after quotes, brackets and digits) is a small one: "ráno" yes, "„ráno“" yes, "3 ovce" no. */
export const startsLowercase = (text) => /^[^\p{L}\p{N}]*\p{Ll}/u.test(text);
/** Ends a sentence: a full stop, "!", "?" or "…", possibly followed by a closing quote or bracket. */
export const endsSentence = (text) => /[.!?…]["“”»)]*$/.test(text);
/** Ends with a single full stop ("Ráno." yes, "Ráno..." and "Ráno…" no). */
export const endsWithFullStop = (text) => /[^.]\.$|^\.$/.test(text);

/** A text worth advising on: a non-empty string that is not a DOPLNIT placeholder. */
const textOf = (value) => (typeof value === 'string' && value.trim() && !value.trim().startsWith(TODO) ? value.trim() : null);

/** Advice on a sentence (description, caption of a detail): a capital letter first, a full stop last. */
function sentenceAdvice(where, at, value) {
  const text = textOf(value);
  if (!text) return [];
  return [
    startsLowercase(text) && `${where}: ${at} začíná malým písmenem`,
    !endsSentence(text) && `${where}: ${at} by měl končit tečkou`,
  ].filter(Boolean);
}

/** Advice on a title: a capital letter first, no full stop last. */
function titleAdvice(where, value) {
  const title = textOf(value);
  if (!title) return [];
  return [
    startsLowercase(title) && `${where}: title začíná malým písmenem`,
    endsWithFullStop(title) && `${where}: title by neměl končit tečkou`,
  ].filter(Boolean);
}

/**
 * Characters of a work title that fit the page title search results show (SEARCH_TITLE_MAX with " · <site title>"
 * after it, Base.astro).
 */
export const workTitleChars = (siteTitle = '') => SEARCH_TITLE_MAX - [...` · ${siteTitle}`].length;

/**
 * Recommendations for all works (drafts too, they are the ones being written): ["<file>: <advice>"]. `siteTitle`
 * (site.title of site.config.yaml) ends every page title, so it decides how long a work title may be.
 */
export function workAdvice(works, { siteTitle = '' } = {}) {
  const advice = [];
  const titleChars = workTitleChars(siteTitle);
  for (const w of works) {
    const where = workPath(w);
    const data = w.data ?? {};
    if (!Array.isArray(data.tags) || data.tags.length === 0) advice.push(`${where}: nemá štítky (tags), podle nich se v galerii filtruje`);
    advice.push(...titleAdvice(where, data.title));
    const title = textOf(data.title);
    if (title && [...title].length > titleChars) {
      advice.push(`${where}: název má ${[...title].length} znaků, ve výsledcích vyhledávání a v záložce prohlížeče se zkrátí; celý se vejde do ${titleChars} znaků`);
    }
    advice.push(...sentenceAdvice(where, 'description', data.description));
    if (data.details && typeof data.details === 'object') {
      for (const [name, caption] of Object.entries(data.details)) advice.push(...sentenceAdvice(where, `popisek detailu ${name}`, caption));
    }
    if (isOnSale(data.status) && !wantsMockups(data)) {
      advice.push(`${where}: je na prodej, ale nemá mockupy (mockups: true ukáže obraz v interiéru na webu i na Fleru)`);
    }
  }
  return advice;
}

// The gallery selects have a fixed width on a computer (WorkGallery.astro, so the filters stay on one line): closed,
// a longer option is cut ("…"), opened, the list shows it whole. These many characters of a name still show whole
// (measured in the browser at max-width 11em / 13em with ordinary Czech text; the worst case of the whole row is
// every filter shown with the longest texts and 9999 works, which still fits a 1280 px window).
/** Characters of a technique the closed "Technika" select shows whole (its count may be cut). */
export const TECHNIQUE_CHARS = 14;
/** Characters of a collection title the closed "Kolekce" select shows whole (its count may be cut). */
export const COLLECTION_TITLE_CHARS = 19;

/** Advice on a collection title too long for the closed "Kolekce" select of the gallery. */
function collectionTitleAdvice(where, value) {
  const title = textOf(value);
  if (!title || [...title].length <= COLLECTION_TITLE_CHARS) return [];
  return [`${where}: název kolekce má ${[...title].length} znaků, ve výběru Kolekce v galerii se zkrátí (celý je vidět po rozbalení); celý se vejde do ${COLLECTION_TITLE_CHARS} znaků`];
}

/**
 * Advice on techniques too long for the closed "Technika" select of the gallery, once per technique with the number
 * of its works (drafts too). ["Technika „…“: …"]
 */
export function techniqueAdvice(works) {
  const counts = new Map();
  for (const w of works) {
    const t = textOf(w.data?.technique);
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts]
    .filter(([t]) => [...t].length > TECHNIQUE_CHARS)
    .sort((a, b) => a[0].localeCompare(b[0], 'cs'))
    .map(([t, n]) => `Technika „${t}“ (${worksCount(n)}) má ${[...t].length} znaků, ve výběru Technika v galerii se zkrátí (celá je vidět po rozbalení); celá se vejde do ${TECHNIQUE_CHARS} znaků`);
}

/**
 * Recommendations for the texts of collections (title, description), years, the home page and the works without a
 * collection (description), as prepareCollections / prepareYears / prepareHome / prepareUncollected give them
 * ({ yamlPath, data }), and of photos (alt, caption),
 * as preparePhotos gives them ({ name, data }).
 */
export function pageAdvice({ collections = [], years = [], home = null, uncollected = null, photos = [] }) {
  const pages = [
    ...collections.map((c) => [c, true]), ...years.map((y) => [y, false]), ...(home ? [[home, false]] : []),
    ...(uncollected ? [[uncollected, false]] : []),
  ];
  return [
    ...pages.flatMap(([page, titled]) => [
      ...(titled ? [...titleAdvice(page.yamlPath, page.data?.title), ...collectionTitleAdvice(page.yamlPath, page.data?.title)] : []),
      ...sentenceAdvice(page.yamlPath, 'description', page.data?.description),
    ]),
    ...photos.flatMap((p) => ['alt', 'caption'].flatMap((key) => sentenceAdvice(`fotky/${p.name}.yaml`, key, p.data?.[key]))),
  ];
}

// Tags: the gallery shows every tag used as a chip, so the list should stay short and clear. The advice speaks only
// where Pavla can do something about it (merge, shorten or drop a tag); a tag on most works is an honest description,
// it gets no advice, only the statistics (tagStats) in the run summary. Counted over all works, drafts too (they are
// the ones being tagged now).

/** The gallery chips should fit into this many rows on a wide screen. */
export const TAG_ROWS = 2;
/**
 * One row of chips in characters of the chip text: the page is 1320 px wide without its 2 × 48 px gutters, the chips
 * use 0.88 rem Work Sans, about 7.7 px a character (src/components/WorkGallery.astro, src/layouts/Base.astro).
 */
export const TAG_ROW_CHARS = 158;
/** Padding, border and the gap of a chip, in characters. */
const CHIP_EXTRA = 5;
/** A tag longer than this is named as a candidate for a shorter word when the chips do not fit. */
export const TAG_LONG = 12;
/** Two tags this similar (shared works of their works together, Jaccard index) add nothing to each other as filters. */
export const TAG_TOGETHER = 0.9;
/** …but only once both have at least this many works (two tags on the same single work are no pattern yet). */
export const TAG_TOGETHER_MIN = 3;

/** The tags of a work worth counting: non-empty strings, not a DOPLNIT placeholder, each once. */
const tagsOfWork = (w) => [...new Set((Array.isArray(w.data?.tags) ? w.data.tags : []).filter((t) => textOf(t)).map((t) => t.trim()))];

/** Works per tag, most used first, then in Czech alphabetical order: [{ tag, count }]. */
export function tagStats(works) {
  const counts = new Map();
  for (const w of works) for (const t of tagsOfWork(w)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'cs'));
}

/** Rows the chips of these tags ("Vše" first, then "#<tag> <count>") take in the gallery, wrapped like the page does. */
export function tagRows(stats, rowChars = TAG_ROW_CHARS) {
  const widths = ['Vše'.length + CHIP_EXTRA, ...stats.map(({ tag, count }) => tag.length + String(count).length + 2 + CHIP_EXTRA)];
  let rows = 1;
  let used = 0;
  for (const w of widths) {
    if (used && used + w > rowChars) { rows++; used = 0; }
    used += w;
  }
  return rows;
}

/** A tag to compare with others: small letters, no diacritics ("Plenér" → "plener"). */
export const tagKey = (tag) => tag.toLocaleLowerCase('cs').normalize('NFD').replace(/\p{M}/gu, '');

/** A tag without its ending vowels, enough to tell Czech word forms of one word: "hory" / "hora" → "hor". */
export const tagStem = (tag) => tagKey(tag).replace(/[aeiouy]+$/, '');

/**
 * Two tags that are most likely one: the same word but for capitals or diacritics ("plener" / "Plenér"), or another
 * form of it, differing only in the ending vowels ("strom" / "stromy", "hora" / "hory", "květina" / "květiny");
 * stems shorter than 3 letters are left alone.
 */
export function sameTag(a, b) {
  if (tagKey(a) === tagKey(b)) return true;
  const stem = tagStem(a);
  return stem.length >= 3 && stem === tagStem(b);
}

const quoted = (tag) => `„${tag}“`;
/** "u 1 díla", "u 3 děl". */
const worksAt = (n) => `u ${n} ${n === 1 ? 'díla' : 'děl'}`;
const worksCount = (n) => `${n} ${n === 1 ? 'dílo' : n >= 2 && n <= 4 ? 'díla' : 'děl'}`;

/** Recommendations for the tags of all works, under "Štítky" in the run summary: ["Štítky: <advice>"]. */
export function tagAdvice(works) {
  const stats = tagStats(works);
  const worksOf = new Map(stats.map(({ tag }) => [tag, new Set()]));
  works.forEach((w, i) => tagsOfWork(w).forEach((t) => worksOf.get(t).add(i)));
  const advice = [];
  // 1. one tag in two spellings or forms
  const merged = new Set();
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const [a, b] = [stats[i], stats[j]];
      if (!sameTag(a.tag, b.tag)) continue;
      merged.add(`${a.tag}|${b.tag}`);
      advice.push(`Štítky: ${quoted(a.tag)} (${worksCount(a.count)}) a ${quoted(b.tag)} (${worksCount(b.count)}) jsou nejspíš jeden štítek, sjednoť je na jeden tvar`);
    }
  }
  // 2. two tags that always come together: as filters one adds nothing to the other
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const [a, b] = [stats[i], stats[j]];
      if (merged.has(`${a.tag}|${b.tag}`) || Math.min(a.count, b.count) < TAG_TOGETHER_MIN) continue;
      const [wa, wb] = [worksOf.get(a.tag), worksOf.get(b.tag)];
      const both = [...wa].filter((w) => wb.has(w)).length;
      const either = wa.size + wb.size - both;
      if (both / either < TAG_TOGETHER) continue;
      const apart = either - both;
      const how = apart ? `skoro vždy spolu (spolu ${worksAt(both)}, jen jeden z nich ${worksAt(apart)})` : `vždy spolu (${worksAt(both)})`;
      advice.push(`Štítky: ${quoted(a.tag)} a ${quoted(b.tag)} jsou ${how}; jako filtr v galerii jeden nic nepřidá, zvaž, jestli potřebuješ oba`);
    }
  }
  // 3. too many chips for the gallery: name the cheapest ones to merge, shorten or drop
  const rows = tagRows(stats);
  if (rows > TAG_ROWS) {
    const single = stats.filter((s) => s.count === 1).map((s) => quoted(s.tag));
    const long = stats.filter((s) => s.tag.length > TAG_LONG).sort((a, b) => b.tag.length - a.tag.length).map((s) => quoted(s.tag));
    const candidates = [
      single.length && `jen u jednoho díla ${single.join(', ')}`,
      long.length && `dlouhé ${long.join(', ')}`,
    ].filter(Boolean);
    advice.push(
      `Štítky: v galerii zaberou asi ${rows} ${rows <= 4 ? 'řádky' : 'řádků'} (${stats.length} štítků), přehledné je nejvýš ${TAG_ROWS}; ` +
      'zvaž sloučení, kratší slova nebo vynechání málo užitých' + (candidates.length ? ` (${candidates.join('; ')})` : ''),
    );
  }
  return advice;
}

/**
 * Works with Instagram exports (meta_instagram: true) whose technique or tags have no English hashtag in the text of
 * the post: ["<file>: …"]. `settings` = instagramPost of site.config.yaml (see scripts/lib/instagram.mjs).
 */
export function hashtagAdvice(works, settings = {}) {
  return works
    .filter((w) => w.data?.meta_instagram === true)
    .map((w) => [w, untranslatedWords(w.data, settings)])
    .filter(([, words]) => words.length)
    .map(([w, words]) => `${workPath(w)}: ${words.length === 1 ? 'štítek' : 'štítky'} ${words.map((x) => `„${x}“`).join(', ')} `
      + `${words.length === 1 ? 'nemá' : 'nemají'} v textu příspěvku pro Instagram anglický hashtag (překlad doplní Libor do nastavení webu, instagramPost.en)`);
}
