// The view of "Nejnovější" on the home page: the same views as the gallery (big pictures or tiles of three sizes,
// scripts/lib/view-layout.mjs), but medium tiles by default, with no paging, and remembered apart from the gallery,
// so the home page may look different from the rest of the works. Each view shows as many of the newest works as fill
// about the same height (site.config.yaml home.recent, separately for a wide screen, a tablet and a phone). Only a view
// other than the default goes into the URL (?view=grid, ?tile=s), so the plain home page stays "/".
//
// Everything runs in an inline script right after the grid (homeScript), before the page is painted, so neither a
// remembered view nor the columns flicker; the page script then handles the switch. The functions listed in
// homeScript are inlined by their source text, so they must stay self-contained and all in view-layout.mjs.
import { DEFAULT_TILE_SIZE } from './gallery-filter.mjs';
import {
  VIEW_KINDS, balanceColumns, balanceGrid, columnCount, columnPlan, gridCards, homeScreen, orderColumns, homeSearch, homeShownCount, inlineScript, layoutHome, showViewOf,
  startHome, viewOf, viewSetup,
} from './view-layout.mjs';

// The functions of the inline script live in view-layout.mjs: they call each other, and only calls within one module
// keep their plain names in the copied source text (the dev server rewrites calls of imported functions).
export { homeRemember, homeScreen, homeSearch, homeShownCount, layoutHome, startHome } from './view-layout.mjs';

/** The default view of the home page (medium tiles). */
export const HOME_DEFAULT_VIEW = 'tiles';

/** localStorage keys of the home page view, apart from those of the gallery. */
export const HOME_VIEW_STORAGE_KEY = 'pavla.home.view';
export const HOME_TILE_SIZE_STORAGE_KEY = 'pavla.home.tileSize';

/**
 * Screens with counts of their own, the first matching media query wins, otherwise `wide`: a phone (the same width as
 * the phone columns of WorkGrid.astro) and a tablet (up to the width where big pictures have three columns).
 */
export const HOME_SCREENS = [['phone', '(max-width: 640px)'], ['tablet', '(max-width: 1100px)']];

/**
 * How many of the newest works each view shows when site.config.yaml has no home.recent, about the same height in each
 * view: on a wide screen that of six big pictures (3 × 2, tiles l 5 × 4, m 6 × 5, s 9 × 7), on a tablet and a phone
 * less (about one and a half screens).
 */
export const HOME_RECENT = {
  wide: { grid: 6, l: 20, m: 30, s: 63 },
  tablet: { grid: 4, l: 16, m: 25, s: 49 },
  phone: { grid: 3, l: 10, m: 24, s: 40 },
};

/** The counts of site.config.yaml home.recent, missing ones from HOME_RECENT; anything but a whole number ≥ 1 = error. */
export function homeRecent(recent) {
  const out = {};
  for (const screen of Object.keys(HOME_RECENT)) {
    out[screen] = {};
    for (const kind of VIEW_KINDS) {
      const value = recent?.[screen]?.[kind] ?? HOME_RECENT[screen][kind];
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`site.config.yaml home.recent.${screen}.${kind} must be a whole number of at least 1, got ${JSON.stringify(value)}`);
      }
      out[screen][kind] = value;
    }
  }
  return out;
}

/** The most works any view shows (the page renders this many, plus one for when the cover is among them). */
export const homeMost = (recent) => Math.max(...Object.values(recent).flatMap((counts) => Object.values(counts)));

/**
 * Everything the inline script needs, as data-view of the grid: the view setup (with the column settings `columns`
 * of site.config.yaml), counts, screens, the cover.
 */
export function homeSetup(recent, cover, columns) {
  return {
    ...viewSetup({ defaultView: HOME_DEFAULT_VIEW, linkKeys: ['view', 'tile'], keys: { view: HOME_VIEW_STORAGE_KEY, tile: HOME_TILE_SIZE_STORAGE_KEY }, columns }),
    recent,
    screens: HOME_SCREENS,
    cover: cover ?? null,
  };
}

/** The view the HTML of the home page is in (the inline script switches before the first paint). */
export const HOME_START = { view: HOME_DEFAULT_VIEW, tile: DEFAULT_TILE_SIZE };

/** The inline script placed right after the home grid. */
export const homeScript = inlineScript(
  [viewOf, showViewOf, columnCount, balanceColumns, columnPlan, orderColumns, gridCards, balanceGrid, homeSearch, homeScreen, homeShownCount, layoutHome, startHome],
  startHome,
);
