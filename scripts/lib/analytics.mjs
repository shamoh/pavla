// Visitor statistics: Google Analytics 4 (gtag.js), configured by analytics.googleMeasurementId in site.config.yaml.
// Only the production build of the real site measures: never `astro dev`, never the site from the test data.
// GA stores its usual first-party cookies (_ga, _ga_<id>), so returning visitors are recognised.
// Own events (sent from the browser, see EVENTS): a filter change in the gallery, clicks on the buttons
// of a work ("Koupit na Fleru", "Napsat autorce"), the pictures shown in the viewer of a work. This module runs both in the build and in the browser.

import { FILTER_KEYS } from './gallery-filter.mjs';
import { viewKind } from './work-viewer.mjs';

/** A GA4 measurement ID, e.g. "G-HPZNHYZ2MQ". */
export const isMeasurementId = (id) => typeof id === 'string' && /^G-[A-Z0-9]{4,16}$/.test(id);

/**
 * The measurement ID to put into the pages, or null when this build must not measure.
 * `production`: a production build (not the dev server); `demo`: the site is built from the test data.
 * An ID that is set but invalid is an error, so a typo does not silently switch the statistics off.
 */
export function measurementIdFor(analytics, { production, demo }) {
  const id = analytics?.googleMeasurementId;
  if (id === undefined || id === null || id === '') return null;
  if (!isMeasurementId(id)) throw new Error(`analytics.googleMeasurementId must look like G-XXXXXXXXXX, got ${JSON.stringify(id)}`);
  return production && !demo ? id : null;
}

/** `display_mode` of every event: the installed app (standalone window, iOS home screen) or a browser tab. */
export const DISPLAY_MODES = { app: 'app', browser: 'browser' };
/** The same test as standalone() of src/lib/app-install.ts, as text for the inline config of gtag. */
const DISPLAY_MODE_EXPRESSION = `(matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) ? '${DISPLAY_MODES.app}' : '${DISPLAY_MODES.browser}'`;

/** URL of the gtag.js loader. */
export const gtagSrc = (id) => `https://www.googletagmanager.com/gtag/js?id=${id}`;

/**
 * Inline script that configures gtag, as in the Google Analytics installation guide. The page is reported with
 * its query string, so gallery filters and paging (?status=…&page=2) can be told apart in the reports
 * ("Page path + query string"), while "Page path and screen class" adds them up per page.
 * Every event (page_view too) carries `display_mode` (DISPLAY_MODES): the site opened as the installed app or in a browser.
 */
export function gtagConfigScript(id) {
  if (!isMeasurementId(id)) throw new Error(`invalid measurement ID ${JSON.stringify(id)}`);
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('set', { display_mode: ${DISPLAY_MODE_EXPRESSION} });`,
    `gtag('config', '${id}');`,
  ].join('\n');
}

/** Methods of the `share` event besides the links of the services: the share sheet of a phone, copying the link. */
export const SHARE_NATIVE = 'native';
export const SHARE_COPY = 'copy';

/** Names of the own events; their parameters must be registered as custom dimensions in GA (see README). */
export const EVENTS = {
  filter: 'gallery_filter', // tag (picked tags joined by a comma), technique, year, collection, status, featured, favorites, q (only the active ones), results
  fler: 'fler_click', // work_id, work_title
  instagram: 'instagram_click', // "Obraz na Instagramu" of a work: work_id, work_title
  share: 'share', // "Sdílet" of a work (GA's recommended event): method (pinterest, facebook, whatsapp, native, copy), work_id, work_title
  email: 'email_click', // the address on the contact page; "Napsat autorce" of a work (work_id, work_title) without messages
  message: 'message_sent', // message_type, work_id and work_title (a message about a work)
  palette: 'palette_change', // palette: the chosen colours (papir, pergamen, noc, auto)
  view: 'view_change', // the view of works switched: listing (home, gallery), view (grid, tiles-s, tiles-m, tiles-l)
  image: 'image_view', // a picture shown in the viewer of a work: work_id, work_title, image, image_kind, method
  cinema: 'cinema_open', // the cinema of a listing opened: listing (gallery, year, collection, selection), results, interval, method (button, link)
  cinemaClose: 'cinema_close', // the cinema closed: listing, reason (CINEMA_CLOSE_REASONS), seconds, shown (works shown)
  gameStart: 'game_start', // the first guess of a round of Detail dne: level, day, archive, look (gameEventParams); of a quiz of a visitor source quiz, level, look, work_id (quizEventParams)
  gameEnd: 'game_end', // a round of Detail dne over: level, day, archive, look, solved, misses, drops, streak, work_id, work_title; of a quiz + solved, misses
  code: 'code_open', // a work opened by its code in the header (CodeJump.astro): work_id, method (CODE_METHODS)
  appInstall: 'app_install', // "Nainstalovat" in the footer and the app installed: method (INSTALL_METHODS of app-install.mjs)
  more: 'more_click', // a click under a work: the clicked work_id, work_title; method (MORE_METHODS); the page = the work it was under
  favoriteAdd: 'favorite_add', // a heart: a work added to the favourites: work_id, work_title, source (FAVORITE_SOURCES of favorites.mjs)
  favoriteRemove: 'favorite_remove', // a heart: a work removed from the favourites: work_id, work_title, source
  favoritesOpen: 'favorites_open', // "Můj výběr" opened by a link: results (works), own (yes = all of them liked here)
};

/**
 * Where on the page of a work a visitor went on (more_click `method`): a work of "Související obrazy" (related), a work
 * of "Podobné obrazy" (similar) or the link of "Podobné obrazy" to the gallery with its filter (similar_filter).
 */
export const MORE_METHODS = { related: 'related', similar: 'similar', similarFilter: 'similar_filter' };

/** How a code opened its work (code_open `method`): pasted (opens at once) or typed and confirmed (Enter, Go). */
export const CODE_METHODS = { paste: 'paste', enter: 'enter' };

/**
 * Parameters of game_start and game_end (and of `share` from the game, with `source: game`): the level, the key of the day (`id`,
 * dayId of scripts/lib/detail-game.mjs: "2026-320"), `archive` yes / no (`day` before `today`), the look. game_end adds
 * the outcome: `solved` yes / no, `misses`, `drops` won, `streak` after it and the work.
 */
export function gameEventParams({ level, day, today, id, look }, end = null) {
  const params = { level, day: id, archive: day === today ? 'no' : 'yes', look };
  if (!end) return params;
  return { ...params, solved: end.solved ? 'yes' : 'no', misses: end.misses, drops: end.drops, streak: end.streak, work_id: end.work.id, work_title: end.work.title };
}

/**
 * Links of the site that open a show and name themselves by `?from=` (CINEMA_FROM, scripts/lib/cinema.mjs): home = the
 * second button of the home page, footer = "Obrazy na prodej" / "Moje nejmilejší" in the footer,
 * shortcut = "Promítat" and shortcut_favorites = "Oblíbené" of the home screen icon (site.webmanifest) (which show it was is
 * in the address of the page). The gallery drops `from` from the address.
 */
export const CINEMA_LINK_SOURCES = ['home', 'footer', 'shortcut', 'shortcut_favorites'];

/**
 * How the cinema opened (`method` of cinema_open): button = "▶ Promítat", link = the page opened with ?cinema=,
 * or the link of the site it came from (CINEMA_LINK_SOURCES).
 */
export const CINEMA_OPEN_METHODS = ['button', 'link', ...CINEMA_LINK_SOURCES];

/** `method` of a show opened by its address: the link of the site named by `from`, any other = link. */
export const cinemaLinkMethod = (from) => (CINEMA_LINK_SOURCES.includes(from) ? from : 'link');

/**
 * Why the cinema closed (`reason` of cinema_close): close = × or Esc, back = Back of the browser, work / collection = to
 * the page of the work shown or of its collection, list = "Seznam" back to the listing, selection = "Seznam" of a show of
 * favourites to "Můj výběr" (its works).
 */
export const CINEMA_CLOSE_REASONS = ['close', 'back', 'work', 'collection', 'list', 'selection'];

/**
 * How it was asked for (`method` of cinema_close), by reason; Back has none. button = ×, "Seznam"; key = Esc, S, ↓ ↑;
 * fullscreen = the end of the whole screen (Esc in it, a gesture of the system); pinch = two fingers pinched together;
 * click = the caption or "Kolekce: …"; swipe = a finger down or up.
 */
export const CINEMA_CLOSE_METHODS = {
  close: ['button', 'key', 'fullscreen'],
  list: ['button', 'key', 'pinch'],
  selection: ['button', 'key', 'pinch'],
  work: ['click', 'key', 'swipe'],
  collection: ['click', 'key', 'swipe'],
};

/** Parameters of cinema_open. */
export function cinemaOpenParams({ listing, results, interval, method }) {
  if (!CINEMA_OPEN_METHODS.includes(method)) throw new Error(`unknown method of cinema_open: ${method}`);
  return { listing, results, interval, method };
}

/**
 * Parameters of cinema_close: how long it ran (whole seconds), how many works it showed, its counts (cinemaRunCounts in
 * scripts/lib/cinema.mjs: `swipes` steps by a finger, `keys` steps by ← →, `swipes_missed` finger swipes slid back) and
 * how it was closed (`method`, CINEMA_CLOSE_METHODS of the reason).
 */
export function cinemaCloseParams({ listing, reason, ms, shown, swipes = 0, keys = 0, swipes_missed = 0, method }) {
  if (!CINEMA_CLOSE_REASONS.includes(reason)) throw new Error(`unknown reason of cinema_close: ${reason}`);
  const params = { listing, reason, seconds: Math.round(ms / 1000), shown, swipes, keys, swipes_missed };
  const methods = CINEMA_CLOSE_METHODS[reason];
  if (!methods) return params;
  if (!methods.includes(method)) throw new Error(`unknown method of cinema_close ${reason}: ${method}`);

  return { ...params, method };
}

/**
 * How a picture got into the viewer (`method` of image_view): open = a click on the picture, a detail or a mockup on
 * the page, arrow = an arrow of the viewer, swipe, key = ← / → on the keyboard, link = the page opened with its
 * address (#detail-…), history = Back / Forward of the browser.
 */
export const IMAGE_METHODS = ['open', 'arrow', 'swipe', 'key', 'link', 'history'];

/**
 * Parameters of image_view: the work, the picture (`image` = its id in the address: obraz, detail-<name>,
 * mockup-<scene>; `image_kind` = main, detail, mockup) and how it got there (IMAGE_METHODS).
 */
export function imageEventParams({ id, title }, image, method) {
  if (!IMAGE_METHODS.includes(method)) throw new Error(`unknown method of image_view: ${method}`);
  return { work_id: id, work_title: title, image, image_kind: viewKind(image), method };
}

/** Parameters of view_change: where (`listing`: home, gallery) and the new view (grid, or tiles with its size). */
export const viewEventParams = (listing, { view, tile }) => ({ listing, view: view === 'tiles' ? `tiles-${tile}` : 'grid' });

/**
 * Parameters of gallery_filter: the active filters (empty ones left out) and how many works match. Several picked
 * tags go as one value joined by a comma ("krajina,voda", in the canonical order of sortTags).
 */
export function filterEventParams(state, results) {
  const params = {};
  for (const key of FILTER_KEYS) {
    const value = Array.isArray(state[key]) ? state[key].join(',') : state[key];
    if (value) params[key] = String(value);
  }
  params.results = results;
  return params;
}

/**
 * The event of a clicked element marked with data-track="<event>" (and data-work-id, data-work-title, data-method),
 * or null when it is not one of our events.
 */
export function trackedClick(dataset) {
  const name = dataset?.track;
  if (!Object.values(EVENTS).includes(name)) return null;
  const params = {};
  if (dataset.workId) params.work_id = dataset.workId;
  if (dataset.workTitle) params.work_title = dataset.workTitle;
  if (dataset.method) params.method = dataset.method;
  return { name, params };
}

/**
 * Sends an event to GA. Without the Google tag (dev server, test data) nothing is sent; the event is only
 * logged to the console (level "Verbose"/debug), so it can be checked locally.
 */
export function trackEvent(name, params, w = globalThis) {
  if (typeof w.gtag === 'function') w.gtag('event', name, params);
  else w.console?.debug?.('[analytics]', name, params);
}
