// The view of a grid of works (WorkGrid.astro) in the browser, for the gallery (WorkGallery.astro: galleries, years,
// collections) and the home page (scripts/lib/home-view.mjs) alike:
//   - viewOf: which view (big pictures / tiles) and tile size, from the link or what this browser remembered,
//   - showViewOf: the classes of the view, the `sizes` of the pictures and the switch (ViewSwitch.astro),
//   - balanceGrid: the shown cards in columns of about the same height (balanceColumns).
// Each page runs them first in an inline script right after its grid, before the page is painted, so a remembered
// view never flickers (viewScript here, homeScript on the home page), then from its own script. The inlined functions
// are copied by their source text, so they must stay self-contained (no imports, no closures over this module, only
// each other and plain DOM features, `var` and `function`) and all live in this module: the dev server rewrites a call
// of an imported function (`__vite_ssr_import_1__.viewOf(…)`), which the copy in the page could not resolve.
import { DEFAULT_TILE_SIZE, TILE_SIZES, VIEWS, viewImageSizes } from './gallery-filter.mjs';

/** The kinds of view: big pictures and each tile size (keys of `sizes` and of the home page counts). */
export const VIEW_KINDS = ['grid', ...TILE_SIZES];

/**
 * The setup of a grid for the functions below (data-view of the grid, as JSON): `defaultView`, `linkKeys` (URL params
 * with which a link decides the view, never the memory), `keys` ({ view, tile } localStorage keys) and the rest.
 */
export function viewSetup({ defaultView, linkKeys, keys }) {
  return {
    views: VIEWS,
    tiles: TILE_SIZES,
    defaultView,
    defaultTile: DEFAULT_TILE_SIZE,
    linkKeys,
    keys,
    sizes: Object.fromEntries(VIEW_KINDS.map((k) => [k, k === 'grid' ? viewImageSizes('grid') : viewImageSizes('tiles', k)])),
  };
}

// ---- inlined (viewScript, homeScript) ----

/**
 * The view { view, tile } for the address `search`: a link decides (a view in it, or any of setup.linkKeys: page 2
 * of a gallery must show the view it was sent from), otherwise what this browser remembered (`storedView`,
 * `storedTile` = raw values from storage), otherwise the default. A link with a tile size decides the size; a
 * remembered size waits for a switch back to tiles.
 */
export function viewOf(search, storedView, storedTile, setup) {
  var params = new URLSearchParams(search);
  var view = params.get('view');
  var tile = params.get('tile');
  var linked = setup.linkKeys.some(function (key) { return params.has(key); });
  return {
    view: setup.views.indexOf(view) >= 0 ? view : !linked && setup.views.indexOf(storedView) >= 0 ? storedView : setup.defaultView,
    tile: setup.tiles.indexOf(tile) >= 0 ? tile : !params.has('tile') && setup.tiles.indexOf(storedTile) >= 0 ? storedTile : setup.defaultTile,
  };
}

/**
 * Shows `grid` in `state`: the classes tiles / tiles-<size>, the `sizes` of every picture (tiles are narrow, so the
 * browser picks smaller files), the pressed view button and the tile size buttons (only with tiles, disabled at either
 * end) of the switch, when it is already in the page.
 */
export function showViewOf(grid, setup, state) {
  var tiles = state.view === 'tiles';
  grid.classList.toggle('tiles', tiles);
  setup.tiles.forEach(function (t) { grid.classList.toggle('tiles-' + t, tiles && state.tile === t); });
  var sizes = setup.sizes[tiles ? state.tile : 'grid'];
  Array.prototype.forEach.call(grid.querySelectorAll('img[sizes], source[sizes]'), function (el) { el.setAttribute('sizes', sizes); });
  Array.prototype.forEach.call(document.querySelectorAll('#view button[data-view]'), function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === state.view));
  });
  var tileSize = document.getElementById('tile-size');
  if (tileSize) tileSize.hidden = !tiles;
  Array.prototype.forEach.call(document.querySelectorAll('#tile-size button[data-tile-step]'), function (b) {
    var at = setup.tiles.indexOf(state.tile) + Number(b.getAttribute('data-tile-step'));
    b.disabled = at < 0 || at >= setup.tiles.length;
  });
}

/**
 * How many columns CSS multi-column layout makes in `width` (the rule of the CSS spec): `count` (column-count, NaN
 * for auto), `columnWidth` (column-width, NaN for auto) and the `gap` between them.
 */
export function columnCount(width, count, columnWidth, gap) {
  if (!(columnWidth > 0)) return count > 0 ? count : 1;
  var fit = Math.max(1, Math.floor((width + gap) / (columnWidth + gap)));
  return count > 0 ? Math.min(count, fit) : fit;
}

/**
 * Splits items of `heights` (newest first) into `n` columns of about the same height: first each item in turn into
 * the shortest column (the newest ones stay on top, in reading order), then while it helps, an item moves or two
 * swap between the tallest and the shortest column (swaps only while the columns are short enough to try every pair
 * quickly; "Zobrazit vše" may show hundreds). Returns the item indexes of each column, in their order.
 */
export function balanceColumns(heights, n) {
  var cols = [];
  for (var c = 0; c < n; c++) cols.push({ items: [], height: 0 });
  heights.forEach(function (h, i) {
    var shortest = cols[0];
    cols.forEach(function (col) { if (col.height < shortest.height) shortest = col; });
    shortest.items.push(i);
    shortest.height += h;
  });
  for (var round = 0; round < 300; round++) {
    var tall = cols[0];
    var low = cols[0];
    cols.forEach(function (col) {
      if (col.height > tall.height) tall = col;
      if (col.height < low.height) low = col;
    });
    var gap = tall.height - low.height;
    var swaps = tall.items.length * low.items.length <= 2500;
    var best = null;
    var consider = function (d, i, j) {
      if (d > 0 && d < gap && (!best || Math.abs(gap - 2 * d) < Math.abs(gap - 2 * best.d))) best = { d: d, i: i, j: j };
    };
    tall.items.forEach(function (i) {
      consider(heights[i], i, -1);
      if (swaps) low.items.forEach(function (j) { consider(heights[i] - heights[j], i, j); });
    });
    if (!best) break;
    tall.items.splice(tall.items.indexOf(best.i), 1);
    low.items.push(best.i);
    if (best.j >= 0) {
      low.items.splice(low.items.indexOf(best.j), 1);
      tall.items.push(best.j);
    }
    tall.height -= best.d;
    low.height += best.d;
  }
  return cols.map(function (col) { return col.items.sort(function (a, b) { return a - b; }); });
}

/** The cards of `grid` in their order (kept as grid.cardsInOrder: once in columns, the page order is gone). */
export function gridCards(grid) {
  return grid.cardsInOrder || (grid.cardsInOrder = Array.prototype.slice.call(grid.querySelectorAll('.card')));
}

/**
 * Lays the shown (not hidden) cards of `grid` out in columns of about the same height (class `balanced`, a
 * <div class="col"> per column, hidden cards stay outside them): measured as the CSS columns of the current view lay
 * them out (pictures have their size in the HTML, so nothing waits for images), as many columns as those make. Runs
 * again after every change of the shown cards, the view or the width.
 */
export function balanceGrid(grid) {
  var cards = gridCards(grid);
  grid.classList.remove('balanced');
  cards.forEach(function (card) { grid.appendChild(card); });
  Array.prototype.forEach.call(grid.querySelectorAll(':scope > .col'), function (col) { col.remove(); });
  var shown = cards.filter(function (card) { return !card.hidden; });
  var style = getComputedStyle(grid);
  var gap = parseFloat(style.columnGap) || 0;
  var n = Math.min(shown.length, columnCount(grid.clientWidth, parseInt(style.columnCount, 10), parseFloat(style.columnWidth), gap));
  if (n < 2) return;
  var heights = shown.map(function (card) { return card.getBoundingClientRect().height + (parseFloat(getComputedStyle(card).marginBottom) || 0); });
  grid.classList.add('balanced');
  balanceColumns(heights, n).forEach(function (items) {
    var col = document.createElement('div');
    col.className = 'col';
    items.forEach(function (i) { col.appendChild(shown[i]); });
    grid.appendChild(col);
  });
}

/**
 * Starts the view of a gallery grid before the page is painted: its setup (data-view), the view of the link or the
 * memory, shown at once; kept as grid.viewSetup and grid.viewState for the page script, which then filters, pages
 * and balances the cards. Storage may be blocked (private mode), then nothing is remembered.
 */
export function startView(grid) {
  var setup = JSON.parse(grid.getAttribute('data-view'));
  var stored = function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } };
  var state = viewOf(location.search, stored(setup.keys.view), stored(setup.keys.tile), setup);
  showViewOf(grid, setup, state);
  grid.viewSetup = setup;
  grid.viewState = state;
  return state;
}

// The home page (scripts/lib/home-view.mjs, homeScript).

/** The address query for `state` ("" or "?…"): anything else in `search` (e.g. utm_*) stays, the view only when not the default. */
export function homeSearch(search, state, setup) {
  var params = new URLSearchParams(search);
  params.delete('view');
  params.delete('tile');
  if (state.view !== setup.defaultView) params.set('view', state.view);
  if (state.view === 'tiles' && state.tile !== setup.defaultTile) params.set('tile', state.tile);
  var query = params.toString();
  return query ? '?' + query : '';
}

/** Values to remember for `state`: null (forget) for a default. */
export function homeRemember(state, setup) {
  return { view: state.view === setup.defaultView ? null : state.view, tile: state.tile === setup.defaultTile ? null : state.tile };
}

/** The screen (`phone`, `tablet`, `wide`): the first of setup.screens whose media query `matches` (a function). */
export function homeScreen(setup, matches) {
  for (var i = 0; i < setup.screens.length; i++) if (matches(setup.screens[i][1])) return setup.screens[i][0];
  return 'wide';
}

/** How many works `state` shows on `screen`. */
export function homeShownCount(state, screen, setup) {
  return setup.recent[screen][state.view === 'tiles' ? state.tile : 'grid'];
}

/**
 * Shows the grid of the home page in `state` on `screen`: the view (showViewOf), the newest works the view shows
 * except the cover (grid.homeCover), in columns of about the same height (balanceGrid). Can run again.
 */
export function layoutHome(grid, setup, state, screen) {
  showViewOf(grid, setup, state);
  var count = homeShownCount(state, screen, setup);
  var shown = 0;
  gridCards(grid).forEach(function (card) {
    var show = card.getAttribute('data-id') !== grid.homeCover && shown < count;
    card.hidden = !show;
    if (show) shown++;
  });
  balanceGrid(grid);
}

/**
 * Starts the home grid: its setup (data-view), the cover (the random one Cover.astro's script showed, or the chosen
 * one), the view of the link or the memory, the layout, and the view in the address. Kept as grid.viewSetup and
 * grid.viewState for the page script. Storage may be blocked (private mode), then nothing is remembered.
 */
export function startHome(grid) {
  var setup = JSON.parse(grid.getAttribute('data-view'));
  var stored = function (key) { try { return localStorage.getItem(key); } catch (e) { return null; } };
  var pick = document.querySelector('[data-pick-exclude="#' + grid.id + '"] > [data-pick]:not([hidden])');
  grid.homeCover = pick ? pick.getAttribute('data-id') : setup.cover;
  var state = viewOf(location.search, stored(setup.keys.view), stored(setup.keys.tile), setup);
  layoutHome(grid, setup, state, homeScreen(setup, function (query) { return matchMedia(query).matches; }));
  history.replaceState(history.state, '', location.pathname + homeSearch(location.search, state, setup) + location.hash);
  grid.viewSetup = setup;
  grid.viewState = state;
  return state;
}

/** Source of an inline script that defines `fns` and calls `start` with the element right before the script. */
export const inlineScript = (fns, start) =>
  `(function () {\n${fns.map(String).join('\n')}\n${start.name}(document.currentScript.previousElementSibling);\n})();`;

/** The inline script right after a gallery grid. */
export const viewScript = inlineScript([viewOf, showViewOf, startView], startView);
