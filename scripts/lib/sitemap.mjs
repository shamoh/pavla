// Map of the site (sitemap.xml, src/pages/sitemap.xml.ts): the canonical address of every page, for search engines
// and for the check of the images (scripts/lib/site-check.mjs starts from it, so it sees pages no link leads to).
// Short addresses of works (/tvorba/<id>/, redirects) and the 404 page are left out.

/** Pages that are not made from the content. A new page in src/pages without data behind it belongs here. */
export const STATIC_PAGES = ['/', '/tvorba/', '/tvorba/kolekce/', '/o-mne/', '/kontakt/'];
/** Static pages that list works: their lastmod is the newest change of all works. */
const LISTS_ALL = new Set(['/', '/tvorba/', '/tvorba/kolekce/']);

/** The latest of the `modified` days of `works` (YYYY-MM-DD), undefined without any. */
const latest = (works) => works.map((w) => w.modified).filter(Boolean).sort().at(-1);

/**
 * Every page with its lastmod, in a stable order: the static pages, then the years (newest first), the collections
 * and the works. `works`: [{ year, key, collection, modified }] (modified = derived_modified of the public copy),
 * `years`: [2026, …], `collections`: [{ slug, works }]. A work: the day it last changed; a list (year, collection,
 * the home page, all works, the collections): the newest change of its works; O mně and Kontakt: none (unknown).
 */
export function sitemapEntries({ years = [], collections = [], works = [] }) {
  const all = latest(works);
  return [
    ...STATIC_PAGES.map((path) => ({ path, lastmod: LISTS_ALL.has(path) ? all : undefined })),
    ...years.map((y) => ({ path: `/tvorba/${y}/`, lastmod: latest(works.filter((w) => w.year === y)) })),
    ...collections.map((c) => ({ path: `/tvorba/kolekce/${c.slug}/`, lastmod: latest(c.works ?? works.filter((w) => w.collection === c.slug)) })),
    ...works.map((w) => ({ path: `/tvorba/${w.year}/${w.key}/`, lastmod: w.modified })),
  ];
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** sitemap.xml of `entries` ([{ path, lastmod }]) on `siteUrl` (https://…, without a trailing slash or with one). */
export function sitemapXml(siteUrl, entries) {
  const base = siteUrl.replace(/\/$/, '');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(({ path, lastmod }) => `  <url><loc>${esc(base + path)}</loc>${lastmod ? `<lastmod>${esc(lastmod)}</lastmod>` : ''}</url>`),
    '</urlset>',
    '',
  ].join('\n');
}

/** The addresses listed in a sitemap.xml. */
export const sitemapUrls = (xml) => [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

/** A page that asks search engines not to index it (the 404 page, short addresses of works, the thank-you page). */
export const isNoindex = (html) => /<meta name="robots" content="[^"]*noindex/i.test(html);

/**
 * Paths of built pages (`pages`: [{ path, html }], path like "/tvorba/2026/") that search engines may index but the
 * sitemap (`urls`, absolute) leaves out, sorted: a page forgotten in STATIC_PAGES. Pages with noindex are left out.
 */
export function unlistedPages(pages, urls) {
  const listed = new Set(urls.map((u) => new URL(u).pathname));
  return pages.filter((p) => !isNoindex(p.html) && !listed.has(p.path)).map((p) => p.path).sort();
}
