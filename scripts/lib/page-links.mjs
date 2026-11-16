// Links to pages of the site always end with a slash (/tvorba/, /tvorba/kolekce/): every page is a folder with its
// index.html, and GitHub Pages answers the address without the slash with a redirect (one more request), the dev
// server serves it as it is (then the page does not know it is /tvorba/). Files (/sitemap.xml, /favicon.ico) keep
// their address. check:images (slashlessLinks) fails on a link to a page without the slash.

/** The parts of an address on the site: path, then query and anchor as written. */
const ADDRESS = /^([^?#]*)(.*)$/s;

/** Whether a path names a page (a folder), not a file: its last segment has no extension. */
const isPagePath = (path) => !/\.[a-z0-9]+$/i.test(path.slice(path.lastIndexOf('/') + 1));

/**
 * An address on the site (starting with one "/") with the slash after the path of a page: '/tvorba?tag=voda' →
 * '/tvorba/?tag=voda'. Any other address (a file, another site, an anchor alone) stays as it is.
 */
export function withTrailingSlash(href) {
  if (typeof href !== 'string' || !/^\/(?!\/)/.test(href)) return href;
  const [, path, rest] = href.match(ADDRESS);
  return path.endsWith('/') || !isPagePath(path) ? href : `${path}/${rest}`;
}

/** Every link (href) to a page of the site without its slash, as { path: page, href } for each built page. */
export function slashlessLinks(pages) {
  return pages.flatMap(({ path, html }) => [...new Set([...html.matchAll(/\shref="([^"]*)"/g)].map((m) => m[1]))]
    .filter((href) => withTrailingSlash(href) !== href)
    .map((href) => ({ path, href })));
}
