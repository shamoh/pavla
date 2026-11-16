import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slashlessLinks, withTrailingSlash } from './page-links.mjs';

test('withTrailingSlash: a page gets its slash, the query and anchor stay', () => {
  assert.equal(withTrailingSlash('/tvorba'), '/tvorba/');
  assert.equal(withTrailingSlash('/tvorba/kolekce'), '/tvorba/kolekce/');
  assert.equal(withTrailingSlash('/tvorba?tag=voda&tag=les'), '/tvorba/?tag=voda&tag=les');
  assert.equal(withTrailingSlash('/kontakt#formular'), '/kontakt/#formular');
  assert.equal(withTrailingSlash('/web/o-mne'), '/web/o-mne/');
});

test('withTrailingSlash: already with the slash, files, other sites and anything else stay', () => {
  for (const href of ['/', '/tvorba/', '/tvorba/?tag=voda', '/#autorka', '/sitemap.xml', '/favicon.ico',
    '/tvorba/2026/maky-ab12c/960.webp', 'https://www.instagram.com/pavla', '//example.com/x', 'mailto:a@b.cz', '#nahoru', '', undefined]) {
    assert.equal(withTrailingSlash(href), href, String(href));
  }
});

test('slashlessLinks: every link to a page without its slash, once per page', () => {
  const pages = [
    { path: '/', html: '<a href="/tvorba">a</a><a href="/tvorba">b</a><a href="/o-mne/">c</a><link rel="icon" href="/favicon.svg">' },
    { path: '/kontakt/', html: '<a href="/tvorba/kolekce?year=2025">x</a><a href="https://fler.cz/x">y</a><a data-href="/nic">z</a>' },
    { path: '/o-mne/', html: '<a href="/tvorba/">ok</a>' },
  ];
  assert.deepEqual(slashlessLinks(pages), [
    { path: '/', href: '/tvorba' },
    { path: '/kontakt/', href: '/tvorba/kolekce?year=2025' },
  ]);
});
