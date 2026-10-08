// Links back to a listing (the gallery /tvorba/, a year page, a collection page, the collections overview) open it
// the way the visitor left it: with its filters and page. Each listing remembers its own URL query per path for this
// tab (sessionStorage, rewritten on every load and change, nothing remembered = removed); a link marked
// data-return on another page gets the query remembered for its path. Without storage the query of the referrer is
// used when the visitor came straight from that listing. Shared by the browser scripts and the tests.
// The memory holds only while the visitor stays in the Tvorba section (RETURN_SCOPE): any other page (home, about,
// contact) forgets it, so a link back never brings up filters from an earlier, unrelated browse. The main menu
// links carry no memory: "Tvorba" there always opens the gallery afresh.
// A link back marked data-return-focus (from a work page its id, from a collection page its slug) also remembers
// where the visitor comes from (RETURN_FOCUS_KEY): the listing scrolls to that card (a work in a gallery, a collection
// on the overview).

import { isValidId, isValidSlug } from './works.mjs';

/** sessionStorage key: JSON { "<path>": "<query without ?>" }. */
export const RETURN_STORAGE_KEY = 'pavla.return';

/** sessionStorage key of the work or collection a visitor goes back from; the listing scrolls to its card and forgets it. */
export const RETURN_FOCUS_KEY = 'pavla.return.focus';

/** The section (path under the site base) in which the memory holds. */
export const RETURN_SCOPE = '/tvorba/';

/** True when `pathname` lies in RETURN_SCOPE of a site with base path `base` ('/' or '/pavla/'). */
export const insideScope = (pathname, base = '/') => pathname.startsWith(`${base.replace(/\/$/, '')}${RETURN_SCOPE}`);

/** The remembered card to scroll to (a work id or a collection slug), when it looks like one; otherwise ''. */
export const focusToken = (stored) => (isValidId(stored) || isValidSlug(stored) ? stored : '');

/** Most paths remembered at once; the oldest are dropped first. */
export const RETURN_MAX_PATHS = 30;

/** The remembered map from its stored text; anything broken = {}. */
export function parseReturns(stored) {
  try {
    const map = JSON.parse(stored ?? '{}');
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
    return Object.fromEntries(Object.entries(map).filter(([, q]) => typeof q === 'string'));
  } catch {
    return {};
  }
}

/** The stored text after a listing at `path` shows `query` (URLSearchParams or text, '' = forget it). */
export function rememberReturn(stored, path, query) {
  const map = parseReturns(stored);
  delete map[path];
  const text = String(query).replace(/^\?/, '');
  if (text) map[path] = text;
  const entries = Object.entries(map);
  return JSON.stringify(Object.fromEntries(entries.slice(Math.max(0, entries.length - RETURN_MAX_PATHS))));
}

/**
 * A link back to a listing (`href`, absolute as a.href gives it): with the query remembered for its path, or, when
 * nothing is remembered (storage blocked), with the query of the referrer when that is the same listing.
 * An href that already has a query is left alone.
 */
export function returnHref(href, stored, referrer = '') {
  const target = new URL(href);
  if (target.search) return href;
  let query = parseReturns(stored)[target.pathname] ?? '';
  if (!query && stored == null) {
    try {
      const from = new URL(referrer);
      if (from.origin === target.origin && from.pathname === target.pathname) query = from.search.slice(1);
    } catch { /* no referrer */ }
  }
  if (!query) return href;
  target.search = query;
  return target.href;
}
