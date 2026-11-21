// The favourite works of a visitor (♥): a list of ids kept only in the browser (localStorage FAVORITES_STORE), no account and
// no service (browser side src/lib/favorites.ts). A heart over the pictures of the cards (galleries, the home page
// "Nejnovější", "Můj výběr"), at the title of a work and in the cinema (a button, the key L) adds or removes a work;
// "♥ Moje oblíbené (N)" beside the count of a gallery opens "Můj výběr" (SELECTION_PATH) with the favourites of the shown
// works, their ids in the address (?obrazy=a,b,c), so the link can be sent on. Too many for an address (more than
// FAVORITES_LINK_MAX) = a grey count with a tooltip instead of the link. The functions are self-contained (the prototype
// oblibene.html takes them as text): the limits come as arguments.

import { storageKey } from './storage-prefix.mjs';

/** Where the favourites are kept in the browser. */
export const FAVORITES_STORE = storageKey('favorites');

/** The parameter of the page "Můj výběr" with the ids of its works, joined by commas. */
export const SELECTION_PARAM = 'obrazy';

/**
 * At most this many works in the link to "Můj výběr": 6 characters a work, about 600 characters, safely under what
 * messengers, e-mail and social sites keep of an address (about 2000).
 */
export const FAVORITES_LINK_MAX = 100;

/** Where a heart was clicked (the parameter `source` of the events favorite_add and favorite_remove). */
export const FAVORITE_SOURCES = ['gallery', 'home', 'selection', 'work', 'cinema'];

/** The page "Můj výběr" (noindex, outside the sitemap). */
export const SELECTION_PATH = '/tvorba/vyber/';

/** The tooltip of the grey count when the favourites of a gallery are too many for a link. */
export const OVER_LINK_TITLE = 'Zužte filtr, výběr je příliš velký na odkaz';

/** The heart (24 × 24): an outline, filled by CSS (fill: currentColor) when the work is a favourite. */
export const HEART_ICON = '<path d="M12 20.4s-7.4-4.5-9.2-9.1C1.6 8.2 3.5 5 6.7 4.7c2-.2 3.8.9 5.3 2.8 1.5-1.9 3.3-3 5.3-2.8 3.2.3 5.1 3.5 3.9 6.6-1.8 4.6-9.2 9.1-9.2 9.1z"/>';

/** Whether `id` looks like the id of a work (5 characters, a letter first; scripts/lib/works.mjs). */
export function isFavoriteId(id) {
  return typeof id === 'string' && /^[abcdfghjkmnpqrstuvwxyz][23456789abcdefghjkmnpqrstuvwxyz]{4}$/.test(id);
}

/** The favourites from the text kept in the browser (`text`, JSON): the valid ids once each, in their order; anything else = none. */
export function readFavorites(text) {
  let list;
  try { list = JSON.parse(text ?? '[]'); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => /^[abcdfghjkmnpqrstuvwxyz][23456789abcdefghjkmnpqrstuvwxyz]{4}$/.test(String(id))))];
}

/** `list` with `id` added (at the end) or removed: { list, added }. */
export function toggleFavorite(list, id) {
  return list.includes(id) ? { list: list.filter((x) => x !== id), added: false } : { list: [...list, id], added: true };
}

/** The favourites among the shown works (`shownIds`, in their order on the page): the ids in that order. */
export function shownFavorites(favorites, shownIds) {
  const liked = new Set(favorites);
  return shownIds.filter((id) => liked.has(id));
}

/**
 * The address of "Můj výběr" with `ids` (`page` = its path, `param` = SELECTION_PARAM), or null without any or with more
 * than `max` (FAVORITES_LINK_MAX): such a link would be too long to send on.
 */
export function selectionLink(ids, { page, param, max }) {
  if (!ids.length || ids.length > max) return null;
  return `${page}?${param}=${ids.join(',')}`;
}

/** The works of "Můj výběr" from its address (`search`): the valid ids of `param` once each, only of the works in `knownIds`. */
export function selectionFromSearch(search, { param, knownIds }) {
  const known = new Set(knownIds);
  const raw = new URLSearchParams(search).get(param) ?? '';
  return [...new Set(raw.split(',').map((id) => id.trim()).filter((id) => known.has(id)))];
}

/** Whether the selection `ids` are the visitor's own favourites (all of them liked here), for the event favorites_open. */
export function ownSelection(ids, favorites) {
  const liked = new Set(favorites);
  return ids.length > 0 && ids.every((id) => liked.has(id));
}

/** The label of a heart (its tooltip and aria-label): what a click does. */
export const favoriteLabel = (on) => (on ? 'Odebrat z oblíbených' : 'Přidat do oblíbených');

/**
 * "♥ Moje oblíbené (N)" of a gallery with `ids` (its favourites among the shown works): none without any, a link up to
 * `max`, a grey count above it (`over`).
 */
export function favoritesLinkState(ids, { page, param, max }) {
  if (!ids.length) return { kind: 'none', count: 0, href: null };
  const href = selectionLink(ids, { page, param, max });
  return href ? { kind: 'link', count: ids.length, href } : { kind: 'over', count: ids.length, href: null };
}

/**
 * "Seznam" in a show of favourites (the gallery with ?favorites=1): the address of "Můj výběr" with the works of the show
 * (`showIds`, in the order of the gallery) that are still favourites. More than `max` = the page without ids (the
 * visitor's own favourites, the same works) when the favourites are the only filter (`onlyFavorites`), else none; none
 * also without any favourite left. Self-contained (no other function of this module).
 */
export function showSelectionLink(showIds, favorites, { page, param, max, onlyFavorites }) {
  const liked = new Set(favorites);
  const ids = showIds.filter((id) => liked.has(id));
  if (!ids.length) return null;
  if (ids.length <= max) return `${page}?${param}=${ids.join(',')}`;
  return onlyFavorites ? page : null;
}

/** What a listing of the own favourites says without any (the gallery with ?favorites=1, "Můj výběr"). */
export const NO_FAVORITES_TEXT = 'Zatím tu nic není. Srdíčkem u obrazu si ho přidáte do oblíbených.';

/** "N obrazů" of "Můj výběr" in Czech. */
export function worksWord(count) {
  if (count === 1) return '1 obraz';
  return `${count} ${count >= 2 && count <= 4 ? 'obrazy' : 'obrazů'}`;
}

/** Parameters of favorite_add / favorite_remove: the work and where its heart was (FAVORITE_SOURCES). */
export const favoriteEventParams = ({ workId, workTitle, source }) => ({ work_id: workId, work_title: workTitle ?? '', source });

/** Parameters of favorites_open ("Můj výběr" opened by a link): how many works and whether they are the visitor's own. */
export const favoritesOpenParams = (ids, favorites) => ({ results: ids.length, own: ownSelection(ids, favorites) ? 'yes' : 'no' });
