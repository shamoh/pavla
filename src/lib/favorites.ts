// Browser side of the favourite works (scripts/lib/favorites.mjs): the list in localStorage, the hearts of the page
// ([data-heart] buttons: over the card pictures, at the title of a work, in the cinema) and the statistics. Every heart of
// a work shows the same state, in this tab and in the others (the storage event). Storage may be blocked (private mode):
// then the hearts still toggle for this page, nothing is kept.
import { FAVORITES_STORE, favoriteEventParams, favoriteLabel, readFavorites, toggleFavorite } from '../../scripts/lib/favorites.mjs';
import { EVENTS, trackEvent } from '../../scripts/lib/analytics.mjs';

const CHANGED = 'pavla:favorites';
let memory: string[] | null = null; // the list when storage is blocked

/** The favourites of this visitor (ids, in the order they were added). */
export function favorites(): string[] {
  try { return readFavorites(localStorage.getItem(FAVORITES_STORE)); } catch { return memory ?? []; }
}

function keep(list: string[]) {
  memory = list;
  try { localStorage.setItem(FAVORITES_STORE, JSON.stringify(list)); } catch { /* blocked: only this page */ }
}

/** A heart clicked (or the key L of the cinema): the work in or out, the event, every heart repainted; true = added. */
export function toggleStoredFavorite(id: string, source: string, title = ''): boolean {
  const next = toggleFavorite(favorites(), id);
  keep(next.list);
  trackEvent(next.added ? EVENTS.favoriteAdd : EVENTS.favoriteRemove, favoriteEventParams({ workId: id, workTitle: title, source }));
  dispatchEvent(new CustomEvent(CHANGED));
  return next.added;
}

/** `fn` after every change of the favourites, here or in another tab. */
export function onFavoritesChange(fn: () => void) {
  addEventListener(CHANGED, fn);
  addEventListener('storage', (e) => { if (e.key === FAVORITES_STORE) fn(); });
}

/** Every heart under `root` as the list says: full (class on, aria-pressed) or an outline, with its label. */
export function paintHearts(root: ParentNode = document) {
  const liked = new Set(favorites());
  for (const button of root.querySelectorAll<HTMLElement>('[data-heart]')) {
    const on = liked.has(button.dataset.heart!);
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
    const label = favoriteLabel(on) + (button.dataset.heartKey ? ` (${button.dataset.heartKey})` : '');
    button.title = label;
    button.setAttribute('aria-label', label);
  }
}

/** A short beat of a heart that was just filled. */
export function beat(button: Element) {
  button.classList.remove('beat');
  void (button as HTMLElement).offsetWidth;
  button.classList.add('beat');
}

let started = false;
/**
 * The hearts of the page come alive (once, whoever calls it first): html.hearts shows them (without JavaScript they stay
 * hidden), a click on one toggles its work. A click on a heart inside a card never opens the card. Hearts marked
 * data-heart-own (the cinema) handle their own clicks.
 */
export function startHearts() {
  if (started) return;
  started = true;
  document.documentElement.classList.add('hearts');
  paintHearts();
  document.addEventListener('click', (e) => {
    const button = (e.target as Element | null)?.closest<HTMLElement>('[data-heart]');
    if (!button || button.dataset.heartOwn !== undefined) return;
    e.preventDefault();
    e.stopPropagation();
    if (toggleStoredFavorite(button.dataset.heart!, button.dataset.heartSource ?? '', button.dataset.workTitle ?? '')) beat(button);
  }, true);
  onFavoritesChange(() => paintHearts());
}
