// Searching (?q= in the URL): a gallery (/tvorba/, a year, a collection) searches the titles and descriptions of its
// works, the collections overview the titles and descriptions of collections. One rule for both: every word of the query must be a part of the name (a substring,
// never a regular expression), whatever the case and diacritics ("stek" finds "Štěkeň"); spaces between words
// do not matter. Shared by the browser scripts and the tests.

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
 * The searchable text of a work or a collection: its title and description as one searchKey, ready for matchesQuery.
 * Computed once at build time into the card (data-search), so typing never normalizes hundreds of texts again.
 */
export const searchText = (work) => searchKey([work.title, work.description].filter(Boolean).join(' '));
