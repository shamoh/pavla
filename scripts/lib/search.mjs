// Searching (?q= in the URL): a gallery (/tvorba/, a year, a collection) searches the titles and descriptions of its
// works, the collections overview the titles and descriptions of collections. One rule for both: every word of the query must be a part of the name (a substring,
// never a regular expression), whatever the case and diacritics ("stek" finds "Štěkeň"); spaces between words
// do not matter. Shared by the browser scripts and the tests.

import { plainText } from './rich-text.mjs';

/** Longest query kept (a longer one is cut): enough for any name, short enough for a URL. */
export const SEARCH_MAX = 80;

/** A text for comparing: lower case, without diacritics. */
export const searchKey = (text) => String(text ?? '').toLocaleLowerCase('cs').normalize('NFD').replace(/\p{M}/gu, '');

/** A query as typed, tidied for the URL and the state: spaces collapsed and trimmed, at most SEARCH_MAX characters. */
export const normalizeQuery = (q) => String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX).trim();

/** The words of a query to look for (searchKey): [] = no query. */
export const queryWords = (q) => searchKey(normalizeQuery(q)).split(' ').filter(Boolean);

/** True when every word of query `q` is a part of `name`; an empty query matches everything. */
export function matchesQuery(name, q) {
  const key = searchKey(name);
  return queryWords(q).every((w) => key.includes(w));
}

/**
 * The searchable text of a work or a collection: its title and description (and a work's id, which the Instagram post
 * text carries) as one searchKey, ready for matchesQuery.
 * Computed once at build time into the card (data-search), so typing never normalizes hundreds of texts again.
 */
export const searchText = (work) => searchKey([work.title, plainText(work.text), plainText(work.description), work.id].filter(Boolean).join(' '));

/**
 * The id of a work when query `q` is exactly one of `ids` (the works of the listing) and nothing else: one word,
 * whatever the case and spaces ("JUJN2 " = jujn2); null otherwise, also for a part of an id or an id among other words.
 * Ids are 5 random characters, so a real word equal to an id of a shown work is very unlikely.
 */
export function exactId(q, ids) {
  const words = queryWords(q);
  return words.length === 1 && ids.includes(words[0]) ? words[0] : null;
}
