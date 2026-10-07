// Recommendations for the descriptions of works, collections, years, the home page and photos: nothing wrong enough to
// stop a run, only what would make the site better (shown in the run summary under "Doporučení",
// scripts/lib/summary.mjs). Messages are Czech ("<file>: <what and how>") because Pavla reads them. Texts still starting with DOPLNIT are left to the checks.

import { TODO } from './schema.mjs';
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

/** Recommendations for all works (drafts too, they are the ones being written): ["<file>: <advice>"]. */
export function workAdvice(works) {
  const advice = [];
  for (const w of works) {
    const where = workPath(w);
    const data = w.data ?? {};
    if (!Array.isArray(data.tags) || data.tags.length === 0) advice.push(`${where}: nemá štítky (tags), podle nich se v galerii filtruje`);
    advice.push(...titleAdvice(where, data.title));
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

/**
 * Recommendations for the texts of collections (title, description), years and the home page (description), as
 * prepareCollections / prepareYears / prepareHome give them ({ yamlPath, data }), and of photos (alt, caption),
 * as preparePhotos gives them ({ name, data }).
 */
export function pageAdvice({ collections = [], years = [], home = null, photos = [] }) {
  const pages = [...collections.map((c) => [c, true]), ...years.map((y) => [y, false]), ...(home ? [[home, false]] : [])];
  return [
    ...pages.flatMap(([page, titled]) => [
      ...(titled ? titleAdvice(page.yamlPath, page.data?.title) : []),
      ...sentenceAdvice(page.yamlPath, 'description', page.data?.description),
    ]),
    ...photos.flatMap((p) => ['alt', 'caption'].flatMap((key) => sentenceAdvice(`fotky/${p.name}.yaml`, key, p.data?.[key]))),
  ];
}
