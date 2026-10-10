// Pinterest: works with `meta_pinterest: true` get a pin (pin.jpg in the folder of their page: the work with the
// caption on paper, 2:3, made by renderCaption of scripts/lib/instagram.mjs) and an item in the feed /pinterest.xml
// (RSS 2.0, src/pages/pinterest.xml.ts). Pinterest reads the feed about once a day and makes a pin of every new item
// (by guid = id of the work) on the board chosen for the feed; a pin links to the page of the work.
// The page of every work also has a link "Uložit na Pinterest" for visitors (pinSaveUrl, no script of Pinterest).

import { captionFacts } from './works.mjs';

/** The pin image in the folder of a work's page (public/tvorba/<year>/<slug>-<id>/). */
export const PIN_FILE = 'pin.jpg';

/** The pin (images.pinterest of site.config.yaml overrides these): 2:3, margin `padding` of the width, inset like Instagram. */
export const PIN_DEFAULTS = { width: 1000, height: 1500, quality: 90, padding: 0.04, insetPercent: 0.5 };

/**
 * UTM parameters of the links of the feed: Google Analytics files a visit from a pin of the feed under this source
 * even when the app of Pinterest sends no referrer (it would look like a direct visit). The page itself is the same
 * (its canonical address has no parameters).
 */
export const FEED_UTM = { utm_source: 'pinterest', utm_medium: 'social', utm_campaign: 'rss' };

/** `url` with the `params` added to its query (existing parameters kept, the same ones replaced). */
export function withParams(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.href;
}

/** Pinterest takes at most 500 characters of the description of a pin and 100 of its title. */
export const PIN_DESCRIPTION_CHARS = 500;
export const PIN_TITLE_CHARS = 100;

/** `text` with whitespace collapsed, at most `max` characters (cut after a whole word, ended with "…"). */
export function clip(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const word = cut.replace(/\s+\S*$/, '');
  return `${(word.length > max / 2 ? word : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/**
 * Keywords of a work for Pinterest (it finds pins by the words of their title and description, not by hashtags):
 * the technique and the tags in Czech, then their English translations from `dictionary` (pinterestKeywords.en of
 * site.config.yaml: plain words with spaces, unlike the hashtags of Instagram; a word without one is only Czech).
 * "akvarel, krajina, mlha · watercolor, landscape, fog"; '' without any.
 */
export function pinKeywords(work, dictionary = {}) {
  const words = [...new Set([work?.technique, ...(Array.isArray(work?.tags) ? work.tags : [])]
    .filter((w) => typeof w === 'string' && w.trim()).map((w) => w.trim()))];
  const en = [...new Set(words.map((w) => dictionary[w] ?? dictionary[w.toLowerCase()]).filter(Boolean))];
  return [words.join(', '), en.join(', ')].filter(Boolean).join(' · ');
}

/**
 * The description of a pin: the description of the work, "technique · size · year" and the keywords (pinKeywords);
 * a long description is shortened, so the facts and the keywords always fit the limit of Pinterest.
 */
export const pinDescription = (work, year, dictionary = {}) => {
  const tail = [captionFacts(work ?? {}, year), pinKeywords(work, dictionary)].filter(Boolean).join('. ');
  const own = typeof work?.description === 'string' && !/^\s*DOPLNIT/.test(work.description) ? work.description.trim() : '';
  const room = PIN_DESCRIPTION_CHARS - tail.length - 1;
  const head = own && room > 20 ? clip(own, room) : '';
  return clip([head, tail].filter(Boolean).join(' '), PIN_DESCRIPTION_CHARS);
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

/** RFC 822 date of an RSS item (a Date or YYYY-MM-DD; invalid = none). */
const rssDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toUTCString();
};

/**
 * The feed for Pinterest (RSS 2.0) of `items` [{ id, title, link, description, date, image: { url, bytes } }]
 * (newest first): every item is one pin, its guid the id of the work (Pinterest never makes a pin twice).
 * `channel`: { title, link, description, self } (self = the address of the feed itself).
 */
export function pinterestFeed(channel, items) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    '<channel>',
    `  <title>${esc(channel.title)}</title>`,
    `  <link>${esc(channel.link)}</link>`,
    `  <description>${esc(channel.description)}</description>`,
    '  <language>cs</language>',
    ...(channel.self ? [`  <atom:link href="${esc(channel.self)}" rel="self" type="application/rss+xml"/>`] : []),
  ];
  for (const it of items) {
    const date = rssDate(it.date);
    lines.push(
      '  <item>',
      `    <title>${esc(clip(it.title, PIN_TITLE_CHARS))}</title>`,
      `    <link>${esc(it.link)}</link>`,
      `    <guid isPermaLink="false">${esc(it.id)}</guid>`,
      `    <description>${esc(it.description)}</description>`,
      ...(date ? [`    <pubDate>${date}</pubDate>`] : []),
      `    <enclosure url="${esc(it.image.url)}" length="${Number(it.image.bytes) || 0}" type="image/jpeg"/>`,
      `    <media:content url="${esc(it.image.url)}" medium="image" type="image/jpeg"/>`,
      '  </item>',
    );
  }
  lines.push('</channel>', '</rss>', '');
  return lines.join('\n');
}

/** The image addresses of a feed (enclosures), for the check of the site (scripts/lib/site-check.mjs). */
export const feedImages = (xml) => [...String(xml).matchAll(/<enclosure\b[^>]*\burl="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

/**
 * The link "Uložit na Pinterest" of a work page: Pinterest's own form for saving `media` (an absolute image address)
 * with a link to `url` (the page) and `description`; a plain link, no script of Pinterest, no cookies on the site.
 */
export function pinSaveUrl({ url, media, description }) {
  const q = new URLSearchParams({ url, media, description: clip(description, PIN_DESCRIPTION_CHARS) });
  return `https://www.pinterest.com/pin/create/button/?${q}`;
}
