// What search engines read besides the visible page: the description of a page (meta description) and structured
// data (schema.org as JSON-LD), so they know that a page is a work of art by Pavla, a list of works, or about her.
// Pure functions, used by the pages (src/pages) through src/layouts/Base.astro; texts are Czech.
// A work on sale tells only that it is available, never its price (the price stays on the page itself).

import { formatSizeCm } from './works.mjs';

const SCHEMA = 'https://schema.org';

/** The site's address without a trailing slash. */
const baseOf = (site) => site.url.replace(/\/$/, '');
/** Absolute address of a path on the site. */
export const absolute = (site, path) => `${baseOf(site)}${path.startsWith('/') ? path : `/${path}`}`;
/** Identifier of the author in the structured data (one node referred to from every page). */
export const authorId = (site) => `${baseOf(site)}/#autorka`;
/** Identifier of the site in the structured data. */
export const siteId = (site) => `${baseOf(site)}/#web`;

/**
 * A description for a search result: whitespace collapsed, at most `max` characters, cut after a whole word
 * (with "…"); '' for nothing.
 */
export function summarize(text, max = 160) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > max / 2 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,;:–—-]+$/, '')}…`;
}


/**
 * Description of a work page: its own text, otherwise made of what is known (the support as written, never
 * declined), e.g. "Ovce – akvarel, papír Arches 300 g, 42 × 30 cm, 2026. Pavla Kramolišová."
 */
export function workDescription(work, site) {
  if (work.description?.trim()) return summarize(work.description);
  const facts = [work.technique, work.support, formatSizeCm(work.size_cm), work.year].filter(Boolean).join(', ');
  return summarize(`${work.title}${facts ? ` – ${facts}` : ''}. ${site.author}.`);
}

/** The author: Pavla, with her profiles elsewhere (Instagram, Fler) so search engines join them. */
export function personLd(site, { image } = {}) {
  return {
    '@type': 'Person',
    '@id': authorId(site),
    name: site.author,
    url: absolute(site, '/o-mne/'),
    description: 'Malířka, která maluje pro radost, hlavně akvarelem; na procházkách skicuje tužkou a brush penem.',
    knowsAbout: ['akvarel', 'kresba', 'skicování', 'plenér'],
    ...(image && { image }),
    sameAs: [site.instagram && `https://www.instagram.com/${site.instagram}/`, site.fler].filter(Boolean),
  };
}

/** The site as a whole, written by the author, in Czech. */
export function websiteLd(site) {
  return {
    '@type': 'WebSite',
    '@id': siteId(site),
    url: absolute(site, '/'),
    name: site.title,
    description: `${site.author} – ${site.tagline.toLowerCase()}.`,
    inLanguage: 'cs',
    author: { '@id': authorId(site) },
    publisher: { '@id': authorId(site) },
  };
}

/** Availability of a work for schema.org: on sale and reserved only (no price, see the top of this file). */
const AVAILABILITY = { available: `${SCHEMA}/InStock`, reserved: `${SCHEMA}/LimitedAvailability` };

/**
 * A work as schema.org VisualArtwork. `work`: { title, key, year, date, technique, support, size_cm, status,
 * description }, `path`: its page, `image`: absolute address of its picture.
 */
export function artworkLd(work, site, { path, image }) {
  const [width, height] = Array.isArray(work.size_cm) ? work.size_cm : [];
  const cm = (value) => ({ '@type': 'QuantitativeValue', value, unitCode: 'CMT', unitText: 'cm' });
  const availability = AVAILABILITY[work.status];
  return {
    '@type': 'VisualArtwork',
    '@id': `${absolute(site, path)}#dilo`,
    url: absolute(site, path),
    name: work.title,
    description: workDescription(work, site),
    ...(image && { image }),
    ...(work.technique && { artMedium: work.technique }),
    ...(work.support && { artworkSurface: work.support }),
    ...(width > 0 && height > 0 && { width: cm(width), height: cm(height) }),
    ...(work.date && { dateCreated: new Date(work.date).toISOString().slice(0, 10) }),
    inLanguage: 'cs',
    creator: { '@id': authorId(site) },
    isPartOf: { '@id': siteId(site) },
    ...(availability && { offers: { '@type': 'Offer', availability, url: absolute(site, path) } }),
  };
}

/**
 * A page listing works or collections (all works, a year, a collection, the collections): `items` in order as an
 * ItemList, each { title }, its page from `itemPath(item)`.
 */
export function collectionPageLd(site, { path, name, description, items, itemPath }) {
  return {
    '@type': 'CollectionPage',
    '@id': absolute(site, path),
    url: absolute(site, path),
    name,
    ...(description && { description: summarize(description) }),
    inLanguage: 'cs',
    isPartOf: { '@id': siteId(site) },
    author: { '@id': authorId(site) },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: absolute(site, itemPath(it)), name: it.title })),
    },
  };
}

/** Breadcrumbs of a page: [{ name, path }] from the home page down to the page itself. */
export function breadcrumbLd(site, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(site, item.path) })),
  };
}

/** The JSON-LD of a page: its nodes in one @graph (nothing for no nodes). */
export const graphLd = (...nodes) => {
  const list = nodes.flat().filter(Boolean);
  return list.length ? { '@context': SCHEMA, '@graph': list } : null;
};

/** JSON-LD as the content of a <script> element: "<" escaped, so a text can never close the element. */
export const jsonLdText = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

/** Meta tags proving the site belongs to us, from site.verification of site.config.yaml (empty = none). */
export function verificationMeta(verification = {}) {
  const names = { google: 'google-site-verification', bing: 'msvalidate.01', seznam: 'seznam-wmt' };
  return Object.entries(names).filter(([key]) => verification?.[key]).map(([key, name]) => ({ name, content: String(verification[key]) }));
}

/** robots.txt: everything may be crawled, the map of the site is at /sitemap.xml. */
export const robotsTxt = (site) => `User-agent: *\nAllow: /\n\nSitemap: ${absolute(site, '/sitemap.xml')}\n`;
