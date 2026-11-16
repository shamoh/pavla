// Pages of the Tvorba section open scrolled past the site header (name, tagline, menu): the visitor starts at the
// heading of the page ("Tvorba", a year, "Kolekce", "← Kolekce" of a work), the header is just above. Only a fresh
// visit: back / forward and reload keep the place the browser restores, a link to an anchor (#…) goes to its anchor.
// Inlined into the page right after the footer (Base.astro), so the whole page is laid out and nothing jumps later;
// the functions are copied as text, so they use nothing outside this module and call only each other.

/** Room in px left above the page content (part of the header's own bottom padding). */
export const SKIP_HEADER_ROOM = 16;

/**
 * Whether a page opens scrolled past the header: inside `scope` (the Tvorba section with its base path, the menu
 * links it without the trailing slash), without an anchor and opened afresh (the type of the navigation is
 * 'navigate', not 'reload' or 'back_forward').
 */
export function skipsHeader(page) {
  return Boolean(page.scope) && (page.path + '/').startsWith(page.scope) && !page.hash && page.navigation === 'navigate';
}

/** Scrolls the window so that `main` starts `room` px under its top edge, when the page skips the header. */
export function skipHeader(scope, room, main) {
  var entry = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  var page = { path: location.pathname, scope: scope, hash: location.hash, navigation: entry ? entry.type : '' };
  if (!main || !skipsHeader(page)) return;
  window.scrollTo(0, Math.max(0, main.getBoundingClientRect().top + window.scrollY - room));
}

/** Source of the inline script for the pages in `scope` (e.g. '/tvorba/'). */
export const skipHeaderScript = (scope, room = SKIP_HEADER_ROOM) =>
  `(function () {\n${skipsHeader}\n${skipHeader}\nskipHeader(${JSON.stringify(scope)}, ${room}, document.querySelector('main'));\n})();`;
