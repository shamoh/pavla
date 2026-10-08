import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATIC_PAGES, isNoindex, sitemapEntries, sitemapUrls, sitemapXml, unlistedPages } from './sitemap.mjs';

test('sitemapEntries: static pages, years, collections and works; never the short addresses of works', () => {
  const rano = { year: 2026, key: 'rano-k3f9a', id: 'k3f9a', collection: 'plener', modified: '2026-10-07' };
  const zima = { year: 2025, key: 'zima-m7q2x', id: 'm7q2x', modified: '2026-09-01' };
  const entries = sitemapEntries({ years: [2026, 2025], collections: [{ slug: 'plener', works: [rano] }], works: [rano, zima] });
  assert.deepEqual(entries.map((e) => e.path), [
    ...STATIC_PAGES, '/tvorba/2026/', '/tvorba/2025/', '/tvorba/kolekce/plener/', '/tvorba/2026/rano-k3f9a/', '/tvorba/2025/zima-m7q2x/',
  ]);
  assert.ok(!entries.some((e) => e.path === '/tvorba/k3f9a/'));
  const lastmod = Object.fromEntries(entries.map((e) => [e.path, e.lastmod]));
  // a work: its own day; a list: the newest change of its works; About and Contact: unknown
  assert.equal(lastmod['/tvorba/2025/zima-m7q2x/'], '2026-09-01');
  assert.equal(lastmod['/tvorba/2025/'], '2026-09-01');
  assert.equal(lastmod['/tvorba/kolekce/plener/'], '2026-10-07');
  for (const p of ['/', '/tvorba/', '/tvorba/kolekce/']) assert.equal(lastmod[p], '2026-10-07', p);
  for (const p of ['/o-mne/', '/kontakt/']) assert.equal(lastmod[p], undefined, p);
  assert.deepEqual(sitemapEntries({}).map((e) => e.path), STATIC_PAGES, 'no content yet: only the static pages');
  assert.equal(sitemapEntries({ works: [{ year: 2026, key: 'a-b2c3d' }] })[0].lastmod, undefined, 'no day known yet');
});

test('sitemapXml and sitemapUrls: absolute addresses on the site, escaped, read back the same', () => {
  const xml = sitemapXml('https://web.test/', [{ path: '/', lastmod: '2026-10-07' }, { path: '/tvorba/a&b/' }]);
  assert.match(xml, /<url><loc>https:\/\/web\.test\/<\/loc><lastmod>2026-10-07<\/lastmod><\/url>/);
  assert.match(xml, /<loc>https:\/\/web\.test\/tvorba\/a&amp;b\/<\/loc><\/url>/, 'no lastmod when unknown');
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(xml, /<loc>https:\/\/web\.test\/tvorba\/a&amp;b\/<\/loc>/);
  assert.deepEqual(sitemapUrls(xml), ['https://web.test/', 'https://web.test/tvorba/a&b/']);
});

test('unlistedPages: indexable built pages missing in the sitemap, never noindex ones', () => {
  const page = (path, robots = '') => ({ path, html: `<html><head>${robots}<title>x</title></head></html>` });
  const noindex = '<meta name="robots" content="noindex">';
  const pages = [page('/'), page('/tvorba/'), page('/novinky/'), page('/tvorba/k3f9a/', noindex), page('/kontakt/odeslano/', noindex), page('/akce/')];
  const urls = ['https://pavla.example/', 'https://pavla.example/tvorba/'];
  assert.deepEqual(unlistedPages(pages, urls), ['/akce/', '/novinky/']);
  assert.deepEqual(unlistedPages(pages.slice(0, 2), urls), []);
});

test('isNoindex: the robots meta with noindex, in any case and with other values', () => {
  assert.ok(isNoindex('<meta name="robots" content="noindex">'));
  assert.ok(isNoindex('<meta name="robots" content="noindex, follow">'));
  assert.ok(!isNoindex('<meta name="robots" content="index">'));
  assert.ok(!isNoindex('<p>noindex</p>'));
});
