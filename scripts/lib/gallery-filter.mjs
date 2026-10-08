// Gallery filter logic shared by the browser script in WorkGallery.astro and the tests.
// A filter state: { tag, technique, year, collection, status, featured, page, perPage } where each empty value means
// "all", page is the 1-based page of the filtered list (or 'all' when the visitor switched paging off) and
// perPage the page size the visitor picked (null = the default size). Everything lives in the URL, so a filtered and
// paged gallery can be shared as a link.

import { isOnSale } from './works.mjs';

/** Statuses of works the author does not have any more (sold or given away). */
export const GONE_STATUSES = ['sold', 'gifted'];

/** Status filter options: URL value → predicate over a work status. */
export const STATUS_FILTERS = {
  // "na prodej": for sale (available or reserved), not sold yet.
  unsold: isOnSale,
  // "ještě mám": everything not sold or given away (for sale, reserved, not for sale).
  kept: (status) => !GONE_STATUSES.includes(status),
  // "už nemám": sold or given away.
  gone: (status) => GONE_STATUSES.includes(status),
};

/** Czech labels of the status filter options, in the order the select offers them. */
export const STATUS_FILTER_LABELS = { unsold: 'na prodej', kept: 'ještě mám', gone: 'už nemám' };

/**
 * True when a filter option matching `count` of `total` works is worth offering: it shows something, and not the
 * same as "vše" (all of them).
 */
export const offersOption = (count, total) => count > 0 && count < total;

/**
 * The status filter options worth offering for these work statuses (offersOption): [{ value, label, count }];
 * [] = no status filter at all.
 */
export function statusOptions(statuses) {
  const counts = countStatuses(statuses);
  return Object.entries(STATUS_FILTER_LABELS)
    .map(([value, label]) => ({ value, label, count: counts[value] }))
    .filter((o) => offersOption(o.count, statuses.length));
}

/**
 * The year filter options of a collection's gallery for the years of its works: [{ value, count }] newest first,
 * only those worth offering (offersOption); [] = no year filter at all.
 */
export function yearFilterOptions(years) {
  const counts = new Map();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[0] - a[0])
    .map(([y, count]) => ({ value: String(y), count }))
    .filter((o) => offersOption(o.count, years.length));
}

/** Former status filter values, still accepted in shared links: old value → current one. */
export const STATUS_ALIASES = { available: 'unsold' };

export const FILTER_KEYS = ['tag', 'technique', 'year', 'collection', 'status', 'featured'];
/** Value of `featured` when the visitor shows only the author's selection ("Výběr autorky", ?featured=1). */
export const FEATURED_ON = '1';

/** True when a work ({ tags, technique, year as string, collection, status, featured }) passes every active filter. */
export function matchesFilters(work, state) {
  return (
    (!state.tag || work.tags.includes(state.tag)) &&
    (!state.technique || work.technique === state.technique) &&
    (!state.year || work.year === state.year) &&
    (!state.collection || work.collection === state.collection) &&
    (!state.status || (STATUS_FILTERS[state.status]?.(work.status) ?? true)) &&
    (!state.featured || work.featured === true)
  );
}

/** Number of works per status filter option, e.g. { unsold: 3, kept: 10, gone: 2 }. */
export function countStatuses(statuses) {
  return Object.fromEntries(Object.entries(STATUS_FILTERS).map(([key, ok]) => [key, statuses.filter(ok).length]));
}

/** Value of `page` meaning "paging switched off, show every matching work". */
export const ALL_PAGES = 'all';

/** Page sizes a visitor can pick; the first one is the default (site.config.yaml gallery.pageSizes). */
export const DEFAULT_PAGE_SIZES = [12, 24, 48];

/**
 * Reads the filter state from URL search params; former status values become current ones (STATUS_ALIASES),
 * unknown status values, bad pages and page sizes
 * that are not offered are ignored. `pageSizes`: the offered sizes, the first is the default.
 */
export function stateFromParams(params, pageSizes = DEFAULT_PAGE_SIZES) {
  const state = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
  state.status = STATUS_ALIASES[state.status] ?? state.status;
  if (!(state.status in STATUS_FILTERS)) state.status = '';
  if (state.featured !== FEATURED_ON) state.featured = '';
  const raw = params.get('page');
  const page = Number(raw);
  state.page = raw === ALL_PAGES ? ALL_PAGES : Number.isInteger(page) && page > 1 ? page : 1;
  const perPage = Number(params.get('perPage'));
  state.perPage = pageSizes.includes(perPage) && perPage !== pageSizes[0] ? perPage : null;
  return state;
}

/**
 * Writes the active filters (empty values left out), the page (only when > 1 or 'all') and the page size
 * (only when the visitor picked a non-default one) to URL search params.
 */
export function stateToParams(state) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (state[key]) params.set(key, state[key]);
  if (state.page === ALL_PAGES || state.page > 1) params.set('page', String(state.page));
  if (state.perPage) params.set('perPage', String(state.perPage));
  return params;
}

/** Page size in effect: the visitor's pick, otherwise the default (first offered size). */
export const pageSizeOf = (state, pageSizes = DEFAULT_PAGE_SIZES) => state.perPage ?? pageSizes[0];

/** State after the visitor picks a page size: back to page 1 with paging on; the default size is not stored. */
export const withPageSize = (state, size, pageSizes = DEFAULT_PAGE_SIZES) => ({
  ...state,
  page: 1,
  perPage: pageSizes.includes(size) && size !== pageSizes[0] ? size : null,
});

/** Page after a filter change: back to the first page, unless paging is switched off. */
export const pageAfterFilterChange = (page) => (page === ALL_PAGES ? ALL_PAGES : 1);

/**
 * Splits `total` items into pages of `size`; `page` is clamped into the existing range.
 * Returns { page, pages, start, end } with items [start, end) on the page.
 * `page` 'all' (paging off) returns every item: { page: 'all', pages, start: 0, end: total }.
 */
export function paginate(total, page, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (page === ALL_PAGES) return { page: ALL_PAGES, pages, start: 0, end: total };
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { page: p, pages, start: (p - 1) * size, end: Math.min(p * size, total) };
}

/**
 * Page links for a pager: always the first and last page, the current one with `around` neighbours,
 * and null for a gap ("…"). E.g. page 6 of 12 → [1, null, 5, 6, 7, null, 12].
 */
export function pageLinks(page, pages, around = 1) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= around) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

/** localStorage key of the page size a visitor picked, remembered for their next visits. */
export const PAGE_SIZE_STORAGE_KEY = 'pavla.gallery.perPage';

/**
 * Page size remembered from an earlier visit that should apply now, or null. It never overrides a link:
 * with `perPage` or `page` in the URL the link decides (page 2 must show the same works to everyone).
 * `stored` is the raw value from storage; only an offered, non-default size applies.
 */
export function rememberedPageSize(params, stored, pageSizes = DEFAULT_PAGE_SIZES) {
  if (params.has('perPage') || params.has('page')) return null;
  const size = Number(stored);
  return pageSizes.includes(size) && size !== pageSizes[0] ? size : null;
}

/** Value to remember after the visitor picks `size`: null (forget) for the default size. */
export const pageSizeToRemember = (size, pageSizes = DEFAULT_PAGE_SIZES) =>
  pageSizes.includes(size) && size !== pageSizes[0] ? String(size) : null;
