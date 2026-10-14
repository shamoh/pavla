// The thin filter bar of a gallery (WorkGallery.astro): once the filters at the top are scrolled away, scrolling back
// up a little slides in one line with the active filters as chips (each with "×" to remove it) and "Upravit", which
// opens the same filter form as a panel; scrolling down slides it away again. Shared by the browser script and the tests.

import { worksPlural } from './collection-filter.mjs';
import { pageAfterFilterChange } from './gallery-filter.mjs';

/** How far (px) the visitor must scroll up before the bar slides in: no flicker on a small move or a bounce. */
export const REVEAL_AFTER = 40;
/** How far (px) the visitor must scroll down before the bar slides away. */
export const HIDE_AFTER = 8;

/**
 * The active filters in the order of the form, [{ key, value, text }]: picked tags ("#krajina"), then technique, year,
 * collection and status by `label(key, value)` (the text of the option), the author's selection as "doporučené",
 * the search in titles as the query in quotes („ranní mlha“).
 */
export function activeFilters(state, label) {
  return [
    ...state.tag.map((t) => ({ key: 'tag', value: t, text: `#${t}` })),
    ...['technique', 'year', 'collection', 'status'].filter((k) => state[k]).map((k) => ({ key: k, value: state[k], text: label(k, state[k]) })),
    ...(state.featured ? [{ key: 'featured', value: state.featured, text: 'doporučené' }] : []),
    ...(state.q ? [{ key: 'q', value: state.q, text: `„${state.q}“` }] : []),
  ];
}

/** The state after the "×" of one active filter ({ key, value }): that one off, back to the first page. */
export function withoutFilter(state, { key, value }) {
  return {
    ...state,
    [key]: key === 'tag' ? state.tag.filter((t) => t !== value) : '',
    page: pageAfterFilterChange(state.page),
  };
}

/**
 * The state after "Zrušit filtry": every filter of the form off (tags, technique, year and collection where they are
 * selects, status, the author's selection, the search), back to the first page; the view, the tile size, the page
 * size and "Zobrazit vše" stay. The year of a year page and the collection of a collection page are their address, not
 * filters of the state, so they stay too.
 */
export function withoutFilters(state) {
  return {
    ...state,
    tag: [], technique: '', year: '', collection: '', status: '', featured: '', q: '',
    page: pageAfterFilterChange(state.page),
  };
}

/** The number of works after the chips of the bar: "6 děl", "1 dílo". */
export const worksCount = (count) => `${count} ${worksPlural(count)}`;

/**
 * The number of works next to the filters: "58 děl" without a filter, with one "12 z 58 děl" (shown of all on the page;
 * the noun after "z" in the genitive: "z 1 díla", otherwise "děl").
 */
export const filteredCount = (shown, total, filtered) => (filtered ? `${shown} z ${total} ${total === 1 ? 'díla' : 'děl'}` : worksCount(total));

/** The starting bar state: hidden, at the top of the page. */
export const BAR_START = { visible: false, y: 0, dir: 0, turn: 0 };

/**
 * The bar after the page scrolled to `y` (px, clamped to the scrollable range by the caller): it slides in after
 * scrolling up REVEAL_AFTER px since the last turn of direction, away after scrolling down HIDE_AFTER px, and never
 * shows while the filter form itself is on screen (`formOnScreen`).
 */
export function scrollBar(prev, y, formOnScreen) {
  const dir = Math.sign(y - prev.y);
  if (dir === 0) return { ...prev, visible: prev.visible && !formOnScreen };
  const turn = dir === prev.dir ? prev.turn : prev.y;
  let visible = prev.visible;
  if (dir < 0 && turn - y >= REVEAL_AFTER) visible = true;
  if (dir > 0 && y - turn >= HIDE_AFTER) visible = false;
  return { visible: visible && !formOnScreen, y, dir, turn };
}
