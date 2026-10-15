// Gallery filter logic shared by the browser script in WorkGallery.astro and the tests.
// A filter state: { tag, technique, year, collection, status, featured, q, page, perPage } where each empty value means
// "all", q is the search in the titles of the works (scripts/lib/search.mjs), tag is a list of picked tags (a work must have all of them, [] = all; ?tag=krajina&tag=voda), page is the 1-based page of the filtered list (or 'all' when the visitor switched paging off) and
// perPage the page size the visitor picked (null = the default size). Everything lives in the URL, so a filtered and
// paged gallery can be shared as a link.

import { isOnSale } from './works.mjs';
import { matchesQuery, normalizeQuery, searchText } from './search.mjs';

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
 * The status filter options for these work statuses, those with at least one work, in the order of the select:
 * [{ value, label, count }]. Which of them are offered after a filter change decides facetChoices; [] = no works.
 */
export function statusOptions(statuses) {
  const counts = countStatuses(statuses);
  return Object.entries(STATUS_FILTER_LABELS)
    .map(([value, label]) => ({ value, label, count: counts[value] }))
    .filter((o) => o.count > 0);
}

/**
 * The year filter options of a collection's gallery: the years of its works with counts, [{ value, count }] newest
 * first. Which of them are offered after a filter change decides facetChoices; [] = no works.
 */
export function yearFilterOptions(years) {
  const counts = new Map();
  for (const y of years) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[0] - a[0])
    .map(([y, count]) => ({ value: String(y), count }));
}

/** Former status filter values, still accepted in shared links: old value → current one. */
export const STATUS_ALIASES = { available: 'unsold' };

export const FILTER_KEYS = ['tag', 'technique', 'year', 'collection', 'status', 'featured', 'q'];
/** Value of `featured` when the visitor shows only the author's selection ("Výběr autorky", ?featured=1). */
export const FEATURED_ON = '1';
/**
 * Value of `collection` for the works in no collection ("žádná", ?collection=none). Collection slugs come from
 * Czech names (slugify), so none is ever "none".
 */
export const NO_COLLECTION = 'none';

/**
 * `items` in Czech alphabetical order of `name(item)` (the title by default), a new array: the collections and
 * techniques of the gallery filters, easy to find a known one.
 */
export function czechOrder(items, name = (item) => item.title) {
  return [...items].sort((a, b) => name(a).localeCompare(name(b), 'cs'));
}
/** The name of the works in no collection: the item of the collections overview, the chip in the filter bar (lower case). */
export const NO_COLLECTION_TITLE = 'Mimo kolekce';

/** True when a work (its collection slug, '' = none) passes the collection filter `picked` ('' = all). */
const inCollection = (collection, picked) => !picked || (picked === NO_COLLECTION ? !collection : collection === picked);

/**
 * True when a work ({ search or title + description, tags, technique, year as string, collection, status, featured })
 * passes every active filter, the search (`q`) in its title and description too (`search`: searchText, from the card).
 */
export function matchesFilters(work, state) {
  return (
    state.tag.every((t) => work.tags.includes(t)) &&
    (!state.technique || work.technique === state.technique) &&
    (!state.year || work.year === state.year) &&
    inCollection(work.collection, state.collection) &&
    (!state.status || (STATUS_FILTERS[state.status]?.(work.status) ?? true)) &&
    (!state.featured || work.featured === true) &&
    matchesQuery(work.search ?? searchText(work), state.q)
  );
}

/** Picked tags in their canonical order (Czech alphabet, no duplicates, no empty ones), so one choice = one URL. */
export const sortTags = (tags) => [...new Set(tags.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));

/** Picked tags after a click on the chip of `tag`: picks it, or drops it when it was picked. */
export const toggleTag = (picked, tag) => sortTags(picked.includes(tag) ? picked.filter((t) => t !== tag) : [...picked, tag]);

/**
 * The tag chips after a filter change, picked tags narrowing the works together ("a zároveň"): for each tag of the
 * page (`tags`, in the order of the chips), how many of the works shown now (`shownTags`: the tags of each matching
 * work) have it, and whether its chip is offered. A picked chip always stays (to be unpicked); any other only when
 * picking it would narrow the works without leaving none (offersOption), so no chip leads to an empty gallery and
 * none changes nothing. [{ tag, count, picked, offered }]
 */
export function tagChoices(tags, shownTags, picked) {
  const counts = new Map();
  for (const list of shownTags) for (const t of new Set(list)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return tags.map((tag) => {
    const count = counts.get(tag) ?? 0;
    const isPicked = picked.includes(tag);
    return { tag, count, picked: isPicked, offered: isPicked || offersOption(count, shownTags.length) };
  });
}

/** The filters with one picked option each (selects and the author's selection switch), besides the tags. */
export const FACETS = ['technique', 'year', 'collection', 'status', 'featured'];

/**
 * The options of filter `key` a work ({ technique, year, collection, status, featured }) falls under: one technique,
 * year or collection (NO_COLLECTION without a collection), every status option its status passes (an available work is both
 * "na prodej" and "ještě mám"), FEATURED_ON for a featured work.
 */
export function facetValues(work, key) {
  if (key === 'status') return Object.keys(STATUS_FILTERS).filter((k) => STATUS_FILTERS[k](work.status));
  if (key === 'featured') return work.featured ? [FEATURED_ON] : [];
  if (key === 'collection') return [work.collection || NO_COLLECTION];
  return work[key] ? [String(work[key])] : [];
}

/**
 * The options of filter `key` (`values`, in the order of the select) after a filter change: how many works each
 * would show together with all the other active filters (the filter itself left out, so the counts tell what
 * switching to that option gives), and whether it is offered. The picked option always is; any other only when it
 * shows some works but not the same as "vše" (offersOption over the works the other filters leave), so no option
 * leads to an empty gallery and none changes nothing. [{ value, count, picked, offered }]
 */
export function facetChoices(works, state, key, values) {
  const base = works.filter((w) => matchesFilters(w, { ...state, [key]: '' }));
  const counts = new Map();
  for (const w of base) for (const v of facetValues(w, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return values.map((value) => {
    const count = counts.get(value) ?? 0;
    const picked = state[key] === value;
    return { value, count, picked, offered: picked || offersOption(count, base.length) };
  });
}

/**
 * How a filter shows after a change (choices of facetChoices): `off` when none of its options narrows the shown works
 * (every shown work has the same value, or none has any). An off filter stays in place, greyed and disabled, so the
 * visitor sees it is there and why it gives nothing: its select shows `common`, the index of the option every
 * shown work falls under (-1 when none), instead of "vše". A picked option is always offered, so never off then.
 */
export function facetDisplay(choices) {
  const off = !choices.some((c) => c.offered);
  return { off, common: off ? choices.findIndex((c) => c.count > 0) : -1 };
}

/**
 * The filter state after a change of the form: `fields` [{ key, value, off }] are its selects (and the switch as
 * FEATURED_ON or ''). An off filter (facetDisplay: greyed, disabled) only shows the value all shown works share, never
 * a choice of the visitor, so its key keeps the state's value ('' then: a picked option keeps a filter on).
 */
export function stateFromForm(state, fields) {
  const next = { ...state };
  for (const { key, value, off } of fields) if (!off) next[key] = value;
  return next;
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
 * Reads the filter state from URL search params (every ?tag= is a picked tag); former status values become current ones (STATUS_ALIASES),
 * unknown status values, bad pages and page sizes
 * that are not offered are ignored. `pageSizes`: the offered sizes, the first is the default.
 */
export function stateFromParams(params, pageSizes = DEFAULT_PAGE_SIZES) {
  const state = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? '']));
  state.tag = sortTags(params.getAll('tag'));
  state.q = normalizeQuery(state.q);
  state.status = STATUS_ALIASES[state.status] ?? state.status;
  if (!(state.status in STATUS_FILTERS)) state.status = '';
  if (state.featured !== FEATURED_ON) state.featured = '';
  return { ...state, ...pagingFromParams(params, pageSizes), view: viewFromParams(params), tile: tileSizeFromParams(params) };
}

/**
 * The page and the page size of any paged listing (the gallery, the collections overview) from URL search params:
 * { page: 1-based or ALL_PAGES (bad values = 1), perPage: an offered size other than the default, otherwise null }.
 */
export function pagingFromParams(params, pageSizes = DEFAULT_PAGE_SIZES) {
  const raw = params.get('page');
  const page = Number(raw);
  const perPage = Number(params.get('perPage'));
  return {
    page: raw === ALL_PAGES ? ALL_PAGES : Number.isInteger(page) && page > 1 ? page : 1,
    perPage: pageSizes.includes(perPage) && perPage !== pageSizes[0] ? perPage : null,
  };
}

/** Writes the page (only when > 1 or 'all') and a picked page size of `state` to URL search `params`. */
export function pagingToParams(params, state) {
  if (state.page === ALL_PAGES || state.page > 1) params.set('page', String(state.page));
  if (state.perPage) params.set('perPage', String(state.perPage));
  return params;
}

/**
 * Writes the active filters (empty values left out), the page (only when > 1 or 'all'), the page size
 * (only when the visitor picked a non-default one) and the view (only tiles) to URL search params.
 */
export function stateToParams(state) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (key === 'tag') state.tag.forEach((t) => params.append('tag', t));
    else if (state[key]) params.set(key, state[key]);
  }
  pagingToParams(params, state);
  return viewToParams(params, state);
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

// The view of a gallery: big pictures with their titles (grid, the default) or small tiles side by side without
// texts (tiles). Like the page size: in the URL (?view=tiles, so a sent link shows the same) and remembered.

/** Views of a gallery; the first one is the default and never goes into the URL. */
export const VIEWS = ['grid', 'tiles'];
export const DEFAULT_VIEW = VIEWS[0];

/** localStorage key of the view a visitor picked. */
export const VIEW_STORAGE_KEY = 'pavla.gallery.view';

// Every function taking `defaultView` serves the gallery (big pictures by default) and the home page (tiles by default,
// scripts/lib/home-view.mjs) alike.

/** The view from URL search params: an offered one, otherwise the default. */
export const viewFromParams = (params, defaultView = DEFAULT_VIEW) => (VIEWS.includes(params.get('view')) ? params.get('view') : defaultView);

/** Value to remember after the visitor picks `view`: null (forget) for the default view. */
export const viewToRemember = (view, defaultView = DEFAULT_VIEW) => (VIEWS.includes(view) && view !== defaultView ? view : null);

/** Writes the view (only when not the default) and the tile size (only with tiles, not the default) to URL search `params`. */
export function viewToParams(params, { view, tile }, defaultView = DEFAULT_VIEW) {
  if (view && view !== defaultView) params.set('view', view);
  if (view === 'tiles' && tile && tile !== DEFAULT_TILE_SIZE) params.set('tile', tile);
  return params;
}

/** Page sizes of the tiles view; the first one is the default (site.config.yaml gallery.tilePageSizes). */
export const DEFAULT_TILE_PAGE_SIZES = [36, 72, 144];

/** localStorage key of the page size a visitor picked for the tiles (the big pictures keep PAGE_SIZE_STORAGE_KEY). */
export const TILE_PAGE_SIZE_STORAGE_KEY = 'pavla.gallery.tilesPerPage';

/** The page sizes offered in `view`: `sizes` { grid, tiles }. */
export const viewPageSizes = (view, sizes) => (view === 'tiles' ? sizes.tiles : sizes.grid);

/** The localStorage key of the page size remembered for `view`. */
export const pageSizeStorageKey = (view) => (view === 'tiles' ? TILE_PAGE_SIZE_STORAGE_KEY : PAGE_SIZE_STORAGE_KEY);

/**
 * State after the visitor switches to `view`: its own page size (the one remembered for it, `stored` = raw value from
 * storage, otherwise its default) and the page that shows the first work of the current page, so the visitor stays
 * where they were; "Zobrazit vše" stays. `sizes` { grid, tiles }.
 */
export function withView(state, view, sizes, stored = null) {
  if (!VIEWS.includes(view)) return state;
  const before = pageSizeOf(state, viewPageSizes(state.view ?? DEFAULT_VIEW, sizes));
  const pageSizes = viewPageSizes(view, sizes);
  const next = { ...state, view, perPage: rememberedPageSize(new URLSearchParams(), stored, pageSizes) };
  if (state.page !== ALL_PAGES) next.page = Math.floor(((state.page - 1) * before) / pageSizeOf(next, pageSizes)) + 1;
  return next;
}

// The size of the tiles (the width of their columns): small, medium (the default) or large. Like the view: in the URL
// (?tile=s, only with view=tiles and not the default) and remembered; a link with `tile` decides.

/** Sizes of the tiles from the smallest; the CSS of WorkGallery.astro has a class tiles-<size> for each. */
export const TILE_SIZES = ['s', 'm', 'l'];
export const DEFAULT_TILE_SIZE = 'm';

/** Width of a tile column in px by size (the `sizes` of the pictures follow it). */
export const TILE_WIDTHS = { s: 110, m: 150, l: 210 };

/** Columns of each tile size on a phone (the same as in the CSS of WorkGrid.astro). */
export const TILE_PHONE_COLUMNS = { s: 4, m: 3, l: 2 };

/** `sizes` of the pictures of a work card with big pictures (WorkCard.astro). */
export const CARD_IMAGE_SIZES = '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw';

/** `sizes` of the pictures in `view` with `tile` size: tiles are narrow, so the browser picks smaller files. */
export function viewImageSizes(view, tile = DEFAULT_TILE_SIZE) {
  if (view !== 'tiles') return CARD_IMAGE_SIZES;
  const t = TILE_SIZES.includes(tile) ? tile : DEFAULT_TILE_SIZE;
  return `(max-width: 640px) ${Math.ceil(100 / TILE_PHONE_COLUMNS[t])}vw, ${Math.round(TILE_WIDTHS[t] * 1.2)}px`;
}

/** localStorage key of the tile size a visitor picked. */
export const TILE_SIZE_STORAGE_KEY = 'pavla.gallery.tileSize';

/** The tile size from URL search params: an offered one, otherwise the default. */
export const tileSizeFromParams = (params) => (TILE_SIZES.includes(params.get('tile')) ? params.get('tile') : DEFAULT_TILE_SIZE);

/** Value to remember after the visitor picks `size`: null (forget) for the default size. */
export const tileSizeToRemember = (size) => (TILE_SIZES.includes(size) && size !== DEFAULT_TILE_SIZE ? size : null);

/** The next smaller (`step` -1) or larger (+1) tile size, the same one at either end. */
export function stepTileSize(size, step) {
  const at = TILE_SIZES.indexOf(TILE_SIZES.includes(size) ? size : DEFAULT_TILE_SIZE);
  return TILE_SIZES[Math.min(TILE_SIZES.length - 1, Math.max(0, at + step))];
}
