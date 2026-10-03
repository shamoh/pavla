import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkSiteImages, distFetch, evaluateSiteImages, pageReferences } from './site-check.mjs';

const ORIGIN = 'https://web.test';

test('pageReferences: images from src, srcset, href and og:image; pages from links; other sites and files ignored', () => {
  const html = `
    <meta property="og:image" content="https://web.test/tvorba/2026/rano-k3f9a/og.jpg">
    <meta property="og:description" content="Akvarel, papír, 2026">
    <link rel="icon" href="/favicon.svg">
    <source srcset="/tvorba/2026/rano-k3f9a/480.avif 480w, /tvorba/2026/rano-k3f9a/960.avif 960w">
    <img src="480.jpg">
    <a href="/tvorba/2026/rano-k3f9a/2400.jpg">plná velikost</a>
    <a href="/kontakt">Kontakt</a> <a href="/tvorba/?featured=1#galerie">Výběr</a> <a href="/tvorba/">Tvorba</a>
    <a href="https://www.instagram.com/x/">Instagram</a> <img src="https://cdn.other.test/a.jpg">
    <a href="/feed.xml">RSS</a>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,400&display=swap">
    <a href="/o-mne">O mně, a tak</a>`;
  const r = pageReferences(html, `${ORIGIN}/tvorba/2026/rano-k3f9a/`, ORIGIN);
  assert.deepEqual(r.images.sort(), [
    `${ORIGIN}/favicon.svg`,
    `${ORIGIN}/tvorba/2026/rano-k3f9a/2400.jpg`,
    `${ORIGIN}/tvorba/2026/rano-k3f9a/480.avif`,
    `${ORIGIN}/tvorba/2026/rano-k3f9a/480.jpg`,
    `${ORIGIN}/tvorba/2026/rano-k3f9a/960.avif`,
    `${ORIGIN}/tvorba/2026/rano-k3f9a/og.jpg`,
  ]);
  // a comma inside a value (a font URL) never splits it into made-up pages
  assert.deepEqual(r.pages.sort(), [`${ORIGIN}/kontakt/`, `${ORIGIN}/o-mne/`, `${ORIGIN}/tvorba/`]);
});

/** A fake site: pages (path → html) and existing images (paths). */
function fakeSite(pages, images) {
  const asked = [];
  const fetchFn = async (url, { method }) => {
    const { pathname } = new URL(url);
    asked.push(`${method} ${pathname}`);
    if (method === 'GET' && pages[pathname] !== undefined) return { ok: true, status: 200, text: async () => pages[pathname] };
    if (method === 'HEAD' && images.includes(pathname)) return { ok: true, status: 200 };
    return { ok: false, status: 404, text: async () => '' };
  };
  return { fetchFn, asked };
}

test('checkSiteImages: walks the pages once each, asks for each image once, reports missing images and broken pages', async () => {
  const { fetchFn, asked } = fakeSite({
    '/': '<a href="/tvorba">Tvorba</a><a href="/kontakt/">K</a><img src="/_cover/480.jpg">',
    '/tvorba/': '<a href="/">Domů</a><a href="/tvorba/2026/rano-k3f9a/">Ráno</a><img src="/tvorba/2026/rano-k3f9a/480.jpg">',
    '/tvorba/2026/rano-k3f9a/': '<img src="480.jpg"><a href="/tvorba/2026/smazane-a1b2c/">pryč</a>',
    '/kontakt/': '<img src="/fotky/kontakt/480.jpg">',
  }, ['/_cover/480.jpg', '/tvorba/2026/rano-k3f9a/480.jpg']);
  const r = await checkSiteImages(`${ORIGIN}/`, fetchFn, { concurrency: 2 });
  assert.equal(r.pages, 4);
  assert.equal(r.images, 3);
  assert.deepEqual(r.missing, [{ image: `${ORIGIN}/fotky/kontakt/480.jpg`, page: `${ORIGIN}/kontakt/`, status: 404 }]);
  assert.deepEqual(r.brokenPages, [{ page: `${ORIGIN}/tvorba/2026/smazane-a1b2c/`, status: 404 }]);
  assert.equal(asked.filter((a) => a === 'GET /').length, 1, 'each page once');
  assert.equal(asked.filter((a) => a === 'HEAD /tvorba/2026/rano-k3f9a/480.jpg').length, 1, 'each image once');
});

test('checkSiteImages: stops after maxPages', async () => {
  const pages = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i ? `/p${i}/` : '/', `<a href="/p${i + 1}/">dál</a>`]));
  const { fetchFn, asked } = fakeSite(pages, []);
  await checkSiteImages(`${ORIGIN}/`, fetchFn, { maxPages: 5 });
  assert.ok(asked.filter((a) => a.startsWith('GET')).length <= 6);
});

test('evaluateSiteImages: fine, missing images (listed up to the limit), broken pages, not checked', () => {
  assert.deepEqual(evaluateSiteImages({ pages: 30, images: 375, sitemap: 18, missing: [], brokenPages: [] }), {
    ok: true, message: 'Všechny obrázky na webu existují (375 obrázků na 30 stránkách, z mapy webu 18).',
  });
  assert.match(evaluateSiteImages({ pages: 1, images: 3, sitemap: 0, missing: [], brokenPages: [] }).message, /\(3 obrázky na 1 stránce, bez mapy webu\)/);
  assert.match(evaluateSiteImages({ pages: 1, images: 1, missing: [{ image: `${ORIGIN}/a.jpg`, page: `${ORIGIN}/` }], brokenPages: [] }).message, /^Na webu chybí 1 obrázek,/);
  const missing = Array.from({ length: 12 }, (_, i) => ({ image: `${ORIGIN}/tvorba/2026/x/${i}.jpg`, page: `${ORIGIN}/tvorba/2026/x/`, status: 404 }));
  const bad = evaluateSiteImages({ pages: 1, images: 12, missing, brokenPages: [{ page: `${ORIGIN}/o-mne/`, status: 500 }] });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /^Na webu chybí 12 obrázků/);
  assert.match(bad.message, /\n- \/tvorba\/2026\/x\/0\.jpg \(stránka \/tvorba\/2026\/x\/\)/);
  assert.match(bad.message, /\n- … a dalších 2\n/);
  assert.match(bad.message, /Nedostupné stránky webu \(1\):\n- \/o-mne\/ \(HTTP 500\)/);
  assert.equal(evaluateSiteImages(null).ok, true);
});

test('checkSiteImages: also pages only the sitemap lists (no link leads to them)', async () => {
  const { fetchFn } = fakeSite({
    '/sitemap.xml': `<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/tvorba/kolekce/skryta</loc></url>`
      + '<url><loc>https://jinde.test/x/</loc></url></urlset>',
    '/': '<img src="/a.jpg">',
    '/tvorba/kolekce/skryta/': '<img src="/skryta.jpg">',
  }, ['/a.jpg']);
  const r = await checkSiteImages(`${ORIGIN}/`, fetchFn);
  assert.equal(r.sitemap, 2, 'other sites in the sitemap are ignored');
  assert.equal(r.pages, 2);
  assert.deepEqual(r.missing.map((m) => [m.image, m.page]), [[`${ORIGIN}/skryta.jpg`, `${ORIGIN}/tvorba/kolekce/skryta/`]]);
});

test('checkSiteImages: a site without a sitemap is walked from its home page', async () => {
  const { fetchFn } = fakeSite({ '/': '<img src="/a.jpg">' }, ['/a.jpg']);
  const r = await checkSiteImages(`${ORIGIN}/`, fetchFn);
  assert.deepEqual([r.pages, r.images, r.sitemap, r.missing.length], [1, 1, 0, 0]);
});

test('distFetch: serves a built site like GitHub Pages: folders by index.html, 404 when missing, nothing outside', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dist-fetch-'));
  await fs.mkdir(path.join(dir, 'o-mne'));
  await fs.writeFile(path.join(dir, 'index.html'), 'home');
  await fs.writeFile(path.join(dir, 'o-mne/index.html'), 'o mně');
  await fs.writeFile(path.join(dir, 'a.jpg'), 'x');
  const f = distFetch(dir);
  assert.equal(await (await f(`${ORIGIN}/`)).text(), 'home');
  assert.equal(await (await f(`${ORIGIN}/o-mne`)).text(), 'o mně');
  assert.equal(await (await f(`${ORIGIN}/o-mne/`)).text(), 'o mně');
  assert.equal((await f(`${ORIGIN}/a.jpg`, { method: 'HEAD' })).ok, true);
  assert.equal((await f(`${ORIGIN}/b.jpg`)).status, 404);
  assert.equal((await f(`${ORIGIN}/%2e%2e/etc/passwd`)).ok, false);
  await fs.rm(dir, { recursive: true, force: true });
});
