// Check of a site: every image a page refers to exists. It walks the site from its home page and from every page of
// its map (sitemap.xml, so pages no link leads to are seen too) along its own links, and asks for every image found
// in src, srcset, href and content (og:image) of the pages. `fetchFn` is injected: fetch for the deployed site
// (weekly health check, scripts/check-health.mjs), distFetch for a build in dist/ (npm run check:images).

import fs from 'node:fs/promises';
import path from 'node:path';
import { sitemapUrls } from './sitemap.mjs';

const IMAGE_RE = /\.(avif|webp|jpe?g|png|gif|svg)$/i;
const ATTR_RE = /\b(src|srcset|href|content)="([^"]*)"/g;

/** A page URL without query and hash, always with a trailing slash ("/kontakt" and "/kontakt/" are one page). */
const pageKey = (url) => {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.href;
};

/**
 * What a page refers to on its own site (`origin`): { pages: [URL], images: [URL] }, each once.
 * Images: paths ending in an image extension (only srcset lists several, separated by commas; other values may
 * contain commas themselves, e.g. a font URL); pages: links (href) without an extension.
 * Query and hash are dropped (gallery filters are one page).
 */
export function pageReferences(html, pageUrl, origin) {
  const pages = new Set();
  const images = new Set();
  for (const [, attr, value] of html.matchAll(ATTR_RE)) {
    for (const part of attr === 'srcset' ? value.split(',') : [value]) {
      const candidate = part.trim().split(/\s+/)[0];
      if (!candidate) continue;
      let url;
      try {
        url = new URL(candidate, pageUrl);
      } catch {
        continue;
      }
      if (url.origin !== origin) continue;
      if (IMAGE_RE.test(url.pathname)) {
        url.search = '';
        url.hash = '';
        images.add(url.href);
      } else if (attr === 'href' && !/\.[a-z0-9]+$/i.test(url.pathname)) {
        pages.add(pageKey(url.href));
      }
    }
  }
  return { pages: [...pages], images: [...images] };
}

/**
 * Walks the site from `siteUrl` (its home page and the pages of its sitemap.xml) and checks every image its pages
 * refer to. Returns { pages, images (counts), sitemap (pages listed in it, 0 without one), missing: [{ image, page }],
 * brokenPages: [{ page, status }] }. `fetchFn(url, { method })` like fetch; images are asked for with HEAD,
 * `concurrency` at a time. A page listed in the sitemap counts as linked from "sitemap.xml".
 */
export async function checkSiteImages(siteUrl, fetchFn, { maxPages = 1000, concurrency = 8 } = {}) {
  const origin = new URL(siteUrl).origin;
  const queue = [pageKey(new URL('/', siteUrl).href)];
  const map = await fetchFn(new URL('/sitemap.xml', siteUrl).href, { method: 'GET' });
  const listed = map.ok ? sitemapUrls(await map.text()).filter((u) => new URL(u).origin === origin).map(pageKey) : [];
  for (const p of listed) if (!queue.includes(p)) queue.push(p);
  const seen = new Set(queue);
  const imageFrom = new Map();
  const brokenPages = [];
  while (queue.length && seen.size <= maxPages) {
    const page = queue.shift();
    const res = await fetchFn(page, { method: 'GET' });
    if (!res.ok) {
      brokenPages.push({ page, status: res.status });
      continue;
    }
    const { pages, images } = pageReferences(await res.text(), page, origin);
    for (const p of pages) {
      if (!seen.has(p)) {
        seen.add(p);
        queue.push(p);
      }
    }
    for (const i of images) if (!imageFrom.has(i)) imageFrom.set(i, page);
  }
  const missing = [];
  const all = [...imageFrom.keys()];
  for (let i = 0; i < all.length; i += concurrency) {
    await Promise.all(all.slice(i, i + concurrency).map(async (image) => {
      const res = await fetchFn(image, { method: 'HEAD' });
      if (!res.ok) missing.push({ image, page: imageFrom.get(image), status: res.status });
    }));
  }
  missing.sort((a, b) => a.image.localeCompare(b.image));
  return { pages: seen.size - brokenPages.length, images: all.length, sitemap: listed.length, missing, brokenPages };
}

/**
 * fetchFn over a built site in `distDir` (like GitHub Pages serves it): "/a/" and "/a" are /a/index.html, anything
 * else the file itself; a missing file is 404. For npm run check:images, no server needed.
 */
export function distFetch(distDir) {
  return async (url) => {
    let rel = decodeURIComponent(new URL(url).pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    else if (!path.extname(rel)) rel += '/index.html';
    const file = path.join(distDir, rel);
    if (!file.startsWith(path.resolve(distDir))) return { ok: false, status: 400, text: async () => '' };
    const text = await fs.readFile(file, 'utf8').catch(() => null);
    return text === null ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => text };
  };
}

/** Czech noun after a number: 1 obrázek, 2–4 obrázky, 0 and 5+ obrázků. */
const count = (n, [one, few, many]) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
const IMAGES = ['obrázek', 'obrázky', 'obrázků'];
const PAGES = ['stránce', 'stránkách', 'stránkách'];

/** Czech result of checkSiteImages for the health report (at most `limit` items listed). */
export function evaluateSiteImages(result, { limit = 10 } = {}) {
  if (result === null) return { ok: true, message: 'Obrázky na webu nebyly zkontrolovány.' };
  const path = (url) => new URL(url).pathname;
  const problems = [];
  if (result.missing.length) {
    problems.push(`Na webu chybí ${count(result.missing.length, IMAGES)}, na které odkazují jeho stránky:`);
    problems.push(...result.missing.slice(0, limit).map((m) => `- ${path(m.image)} (stránka ${path(m.page)})`));
    if (result.missing.length > limit) problems.push(`- … a dalších ${result.missing.length - limit}`);
  }
  if (result.brokenPages.length) {
    problems.push(`Nedostupné stránky webu (${result.brokenPages.length}):`);
    problems.push(...result.brokenPages.slice(0, limit).map((p) => `- ${path(p.page)} (HTTP ${p.status})`));
  }
  if (problems.length) {
    problems.push('Nejspíš se nasadil web bez obrázků nebo pipeline nějaké smazala; spusť `npm run images` a zkontroluj pull request.');
    return { ok: false, message: problems.join('\n') };
  }
  const map = result.sitemap ? `, z mapy webu ${result.sitemap}` : ', bez mapy webu';
  return { ok: true, message: `Všechny obrázky na webu existují (${count(result.images, IMAGES)} na ${count(result.pages, PAGES)}${map}).` };
}
