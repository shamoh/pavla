// Browser side of the links back to listings (scripts/lib/page-return.mjs): a listing remembers its query, a page
// fills in its links marked data-return. Pages outside the Tvorba section forget everything. Storage may be blocked
// (private mode), then nothing is remembered.
import {
  RETURN_FOCUS_KEY, RETURN_STORAGE_KEY, focusToken, insideScope, rememberReturn, returnHref,
} from '../../scripts/lib/page-return.mjs';

const read = (key: string) => {
  try { return sessionStorage.getItem(key); } catch { return null; }
};
const write = (key: string, value: string | null) => {
  try { value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, value); } catch { /* ignore */ }
};

/** Remembers the current listing (this path) with its filters and page ('' = forget it). */
export function rememberListing(query: URLSearchParams | string) {
  write(RETURN_STORAGE_KEY, rememberReturn(read(RETURN_STORAGE_KEY), location.pathname, query));
}

/**
 * Outside the Tvorba section: forgets every listing. Inside: links marked data-return lead back to their listing
 * the way the visitor left it; one with data-return-focus (a work id on a work page, a collection slug on a
 * collection page) also remembers it when clicked, so the listing scrolls to its card.
 */
export function applyReturnLinks() {
  if (!insideScope(location.pathname, import.meta.env.BASE_URL)) {
    write(RETURN_STORAGE_KEY, null);
    write(RETURN_FOCUS_KEY, null);
    return;
  }
  const remembered = read(RETURN_STORAGE_KEY);
  document.querySelectorAll<HTMLAnchorElement>('a[data-return]').forEach((a) => {
    a.href = returnHref(a.href, remembered, document.referrer);
    const focus = a.dataset.returnFocus;
    if (focus) a.addEventListener('click', () => write(RETURN_FOCUS_KEY, focus));
  });
}

/**
 * Back from a work or collection page: scrolls to the card of `items` it came from (its data-<key> equals the
 * remembered value) and marks it for a moment (.returned, Base.astro), so the visitor sees where they left off.
 * Only a shown card; the remembered value is forgotten either way.
 */
export function revealReturned(items: HTMLElement[], key: string) {
  const token = focusToken(read(RETURN_FOCUS_KEY));
  write(RETURN_FOCUS_KEY, null);
  const card = token && items.find((c) => c.dataset[key] === token && !c.hidden);
  if (!card) return;
  card.scrollIntoView({ block: 'center' });
  card.classList.add('returned');
  setTimeout(() => card.classList.remove('returned'), 2400);
}
