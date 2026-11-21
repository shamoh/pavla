// What search engines read besides the visible page: the description of a page (meta description) and structured
// data (schema.org as JSON-LD), so they know that a page is a work of art by Pavla, a list of works, or about her.
// Pure functions, used by the pages (src/pages) through src/layouts/Base.astro; texts are Czech.
// A work on sale tells only that it is available, never its price (the price stays on the page itself).

import { copyrightNotice } from './image-rights.mjs';
import { searchDescription } from './rich-text.mjs';
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

/** Longest page title (with " · <site title>") a search result shows whole; a browser tab shows even less. */
export const SEARCH_TITLE_MAX = 60;

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
 * Description of a work page: its own description for search engines or its text (searchDescription), otherwise made of what is known (the support as written, never
 * declined), e.g. "Ovce – akvarel, papír Arches 300 g, 42 × 30 cm, 2026. Pavla Kramolišová."
 */
export function workDescription(work, site) {
  const own = searchDescription(work);
  if (own) return summarize(own);
  const facts = [work.technique, work.support, formatSizeCm(work.size_cm), work.year].filter(Boolean).join(', ');
  return summarize(`${work.title}${facts ? ` – ${facts}` : ''}. ${site.author}.`);
}

/**
 * What tells a work from another with the same name or text, from the shortest: its technique; with that, size and
 * year; with those, its id (always distinct).
 */
const distinctions = (w) => [[w.technique], [w.technique, formatSizeCm(w.size_cm), w.year], [w.technique, formatSizeCm(w.size_cm), w.year, w.id]]
  .map((parts) => parts.filter(Boolean).join(', '));

/** The shortest level of `distinctions` that tells every work of `group` apart (the last one always does). */
const distinctLevel = (group) => {
  const levels = distinctions(group[0]).length;
  for (let level = 0; level < levels - 1; level++) if (new Set(group.map((w) => distinctions(w)[level])).size === group.length) return level;
  return levels - 1;
};

const sameText = (a, b) => String(a ?? '').trim().toLocaleLowerCase('cs') === String(b ?? '').trim().toLocaleLowerCase('cs');

/**
 * The title of a work page (in <title>, before the site's name): its title, and when another work (`works`, all
 * shown works) has the same title, what tells them apart in brackets, "Tetřevská slať (tisk z výšky)" (technique;
 * with the same technique also size and year, then the id). The title on the page itself never changes.
 */
export function workPageTitle(work, works) {
  const group = [work, ...works.filter((w) => w !== work && w.id !== work.id && sameText(w.title, work.title))];
  if (group.length < 2) return work.title;
  return `${work.title} (${distinctions(work)[distinctLevel(group)]})`;
}

/**
 * The description of a work page: workDescription, and when another work (`works`) has the same one, followed by
 * what tells them apart from technique, size and year up, "Krmelec na okraji lesa. Akvarel, 27,5 × 40 cm, 2026.",
 * within the 160 characters a search result shows (the own text is cut first).
 */
export function workPageDescription(work, works, site) {
  const own = workDescription(work, site);
  const group = [work, ...works.filter((w) => w !== work && w.id !== work.id && workDescription(w, site) === own)];
  if (group.length < 2) return own;
  const level = Math.max(1, distinctLevel(group));
  const facts = distinctions(work)[level];
  const suffix = `${facts.charAt(0).toLocaleUpperCase('cs')}${facts.slice(1)}.`;
  const text = searchDescription(work) || own;
  const lead = summarize(text, 160 - suffix.length - 1);
  return `${/[.!?…]$/.test(lead) ? lead : `${lead}.`} ${suffix}`;
}

/**
 * The author, with her profiles elsewhere (Instagram, Fler) so search engines join them; her description and topics
 * (`site.authorDescription`, `site.knowsAbout` of site.config.yaml) only when set.
 */
export function personLd(site, { image } = {}) {
  return {
    '@type': 'Person',
    '@id': authorId(site),
    name: site.author,
    url: absolute(site, '/o-mne/'),
    ...(site.authorDescription && { description: site.authorDescription }),
    ...(site.knowsAbout?.length && { knowsAbout: site.knowsAbout }),
    ...(site.location && { homeLocation: { '@type': 'Place', name: site.location, address: { '@type': 'PostalAddress', addressLocality: site.location, addressCountry: 'CZ' } } }),
    ...(image && { image }),
    sameAs: [site.instagram && `https://www.instagram.com/${site.instagram}/`, site.pinterest, site.fler].filter(Boolean),
  };
}

/** The description of a year page when site.config.yaml has no `site.yearDescription`. */
export const YEAR_DESCRIPTION = 'Tvorba z roku {year} – {author}.';

/** `template` with each "{name}" replaced by `values[name]`; an unknown name stays as it is. */
export const fillTemplate = (template, values) => String(template).replace(/\{(\w+)\}/g, (all, name) => (name in values ? String(values[name]) : all));

/**
 * The description of a year page: the author's own one (roky/<year>.yaml), otherwise `site.yearDescription`
 * (or YEAR_DESCRIPTION) with {year} and {author} filled in.
 */
export function yearPageDescription(yearPage, year, site) {
  return yearPage?.description || fillTemplate(site.yearDescription || YEAR_DESCRIPTION, { year, author: site.author });
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

/**
 * The art form of a work (schema.org `artform`), from its technique as written: the first matching rule wins,
 * so "akvarel a tuš" is a painting; an unknown technique has none.
 */
const ARTFORMS = [
  [/tisk|ryt|grafik|lept|monotyp|sítotisk/i, 'grafika'],
  [/akvarel|kvaš|olej|akryl|tempera|pastel|malb/i, 'malba'],
  [/kresb|tužk|uhel|uhlem|brush pen|tuš|perem|fix/i, 'kresba'],
];
export const artform = (technique) => ARTFORMS.find(([pattern]) => pattern.test(technique ?? ''))?.[1];

/**
 * Keywords of a list of works (schema.org `keywords`): their tags, the most frequent first (then alphabetically),
 * at most `max`; items without tags (e.g. collections) add nothing.
 */
export function tagKeywords(items, max = 20) {
  const counts = new Map();
  for (const tag of items.flatMap((it) => it.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort(([a, m], [b, n]) => n - m || a.localeCompare(b, 'cs')).slice(0, max).map(([tag]) => tag);
}

/** Availability of a work for schema.org: on sale and reserved only (no price, see the top of this file). */
const AVAILABILITY = { available: `${SCHEMA}/InStock`, reserved: `${SCHEMA}/LimitedAvailability` };

/**
 * The picture of a work as schema.org ImageObject: its address, the author as creator, the credit line and the
 * copyright notice (the same as in the XMP of the file, scripts/lib/image-rights.mjs). Never a licence.
 */
export function imageObjectLd(image, work, site) {
  const year = work.year ?? (work.date ? new Date(work.date).getFullYear() : '');
  return {
    '@type': 'ImageObject',
    contentUrl: image,
    url: image,
    creator: { '@id': authorId(site) },
    creditText: site.author,
    copyrightNotice: copyrightNotice(site.author, year),
  };
}

/** Other pages about the same work (its post on Instagram, its listing on Fler): web addresses only. */
const elsewhere = (work) => [work.instagram, work.fler].filter((u) => typeof u === 'string' && /^https?:\/\/\S+$/.test(u.trim())).map((u) => u.trim());

/**
 * A work as schema.org VisualArtwork. `work`: { title, key, year, date, technique, support, size_cm, status,
 * description, tags, instagram, fler }, `path`: its page, `image`: absolute address of its picture. Its post on
 * Instagram and its listing on Fler are `sameAs` (the same artwork elsewhere).
 */
export function artworkLd(work, site, { path, image }) {
  const sameAs = elsewhere(work);
  const [width, height] = Array.isArray(work.size_cm) ? work.size_cm : [];
  const cm = (value) => ({ '@type': 'QuantitativeValue', value, unitCode: 'CMT', unitText: 'cm' });
  const availability = AVAILABILITY[work.status];
  const form = artform(work.technique);
  return {
    '@type': 'VisualArtwork',
    '@id': `${absolute(site, path)}#dilo`,
    url: absolute(site, path),
    name: work.title,
    description: workDescription(work, site),
    ...(image && { image: imageObjectLd(image, work, site) }),
    ...(form && { artform: form }),
    ...(work.technique && { artMedium: work.technique }),
    ...(work.support && { artworkSurface: work.support }),
    ...(width > 0 && height > 0 && { width: cm(width), height: cm(height) }),
    ...(work.date && { dateCreated: new Date(work.date).toISOString().slice(0, 10) }),
    ...(work.tags?.length && { keywords: work.tags.join(', ') }),
    inLanguage: 'cs',
    creator: { '@id': authorId(site) },
    isPartOf: { '@id': siteId(site) },
    ...(sameAs.length && { sameAs }),
    ...(availability && { offers: { '@type': 'Offer', availability, url: absolute(site, path) } }),
  };
}

/**
 * The page of a work as an ItemPage about it (mainEntity = its VisualArtwork, artworkLd) with the addresses of the pages
 * of its related works (`relatedPaths`, relatedWorks in scripts/lib/works.mjs) as relatedLink. schema.org has no
 * "related" for a CreativeWork (isRelatedTo is for products and services only), relatedLink of a WebPage is the one.
 */
export function workPageLd(site, { path, name, relatedPaths = [] }) {
  return {
    '@type': 'ItemPage',
    '@id': absolute(site, path),
    url: absolute(site, path),
    name,
    inLanguage: 'cs',
    isPartOf: { '@id': siteId(site) },
    mainEntity: { '@id': `${absolute(site, path)}#dilo` },
    ...(relatedPaths.length && { relatedLink: relatedPaths.map((p) => absolute(site, p)) }),
  };
}

/**
 * The page of the game Detail dne: a WebPage of the site written by the author, about a game made of her works (schema.org has a
 * Game, but no type for a page to play it in the browser that search engines use; the page itself says what it is).
 */
export function gamePageLd(site, { path, name, description }) {
  return {
    '@type': 'WebPage',
    '@id': absolute(site, path),
    url: absolute(site, path),
    name,
    description,
    inLanguage: 'cs',
    isPartOf: { '@id': siteId(site) },
    author: { '@id': authorId(site) },
  };
}

/**
 * A page listing works or collections (all works, a year, a collection, the collections): `items` in order as an
 * ItemList, each { title, tags }, its page from `itemPath(item)`; the tags of the works are its keywords.
 */
export function collectionPageLd(site, { path, name, description, items, itemPath }) {
  const keywords = tagKeywords(items);
  return {
    '@type': 'CollectionPage',
    '@id': absolute(site, path),
    url: absolute(site, path),
    name,
    ...(description && { description: summarize(description) }),
    ...(keywords.length && { keywords: keywords.join(', ') }),
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
  const names = { google: 'google-site-verification', bing: 'msvalidate.01', seznam: 'seznam-wmt', pinterest: 'p:domain_verify' };
  return Object.entries(names).filter(([key]) => verification?.[key]).map(([key, name]) => ({ name, content: String(verification[key]) }));
}

/**
 * robots.txt: everything may be crawled, the map of the site is at /sitemap.xml. A site hidden from search engines
 * (`hidden`: the test site, HIDDEN_SITE_ROBOTS) may not be crawled at all and names no map.
 */
export const robotsTxt = (site, { hidden = false } = {}) => (hidden
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\n\nSitemap: ${absolute(site, '/sitemap.xml')}\n`);

/**
 * The robots meta of every page of a site hidden from search engines (the test site, isDemoSite): neither the page nor
 * its links. The attribute data-hidden-site tells it apart from the noindex of a single page (sitemap.mjs isNoindex),
 * so the checks of the built pages treat the pages of a hidden site as if it were indexed.
 */
export const HIDDEN_SITE_ROBOTS = 'noindex, nofollow';
