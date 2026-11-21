import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CODE_ROOT } from './site-dir.mjs';
import { siteAddress, siteBase, siteRoot } from './site-url.mjs';
import { absolute, authorId } from './seo.mjs';

test('siteBase: "/" for a site on its own domain, the folder with both slashes for a site in a folder', () => {
  assert.equal(siteBase('https://pavla.kramolis.cz'), '/');
  assert.equal(siteBase('https://pavla.kramolis.cz/'), '/');
  assert.equal(siteBase('https://shamoh.github.io/web-tvorba-engine'), '/web-tvorba-engine/');
  assert.equal(siteBase('https://shamoh.github.io/web-tvorba-engine/'), '/web-tvorba-engine/');
  assert.equal(siteBase('https://host.test/a/b'), '/a/b/');
});

test('siteRoot and siteAddress: the home page and pages of the site, inside its folder', () => {
  assert.equal(siteRoot('https://pavla.kramolis.cz'), 'https://pavla.kramolis.cz/');
  assert.equal(siteRoot('https://shamoh.github.io/web-tvorba-engine'), 'https://shamoh.github.io/web-tvorba-engine/');
  for (const path of ['/kontakt/', 'kontakt/']) {
    assert.equal(siteAddress('https://pavla.kramolis.cz', path), 'https://pavla.kramolis.cz/kontakt/');
    assert.equal(siteAddress('https://shamoh.github.io/web-tvorba-engine', path), 'https://shamoh.github.io/web-tvorba-engine/kontakt/');
  }
  assert.equal(siteAddress('https://shamoh.github.io/web-tvorba-engine/', 'sitemap.xml'), 'https://shamoh.github.io/web-tvorba-engine/sitemap.xml');
});

test('the addresses of the structured data and share images stay inside the folder of the site (seo.mjs absolute)', () => {
  const site = { url: 'https://shamoh.github.io/web-tvorba-engine' };
  assert.equal(absolute(site, '/tvorba/2026/rano-k3f9a/og-1.jpg'), 'https://shamoh.github.io/web-tvorba-engine/tvorba/2026/rano-k3f9a/og-1.jpg');
  assert.equal(authorId(site), 'https://shamoh.github.io/web-tvorba-engine/#autorka');
  assert.equal(absolute(site, '/kontakt/'), siteAddress(site.url, '/kontakt/'));
  assert.equal(absolute({ url: 'https://pavla.kramolis.cz' }, '/kontakt/'), 'https://pavla.kramolis.cz/kontakt/');
});

/**
 * `new URL(path, <the address of the site>)` with a path of the site ("/kontakt/") drops the folder of a site in a folder:
 * full addresses go through absolute (seo.mjs) or siteAddress. Allowed only where the path has the base already.
 */
const BASED_PATHS = [
  ['src/layouts/Base.astro', 'Astro.url.pathname'], // the address of the page itself, with the base
  ['src/pages/tvorba/[section]/index.astro', 'target!'], // workUrl = url(): with the base
  ['src/components/MessageForm.astro', 'url(SENT_PATH)'], // url(): with the base
  ['scripts/lib/messages.mjs', 'sitePath(context.path)'], // location.pathname of the page in the browser: with the base
  ['scripts/lib/site-url.mjs', 'siteBase(siteUrl)'], // the base itself
];

test('no address of the site is made from a path without its folder: new URL(path, site.url) only with the base', () => {
  const sources = ['src', 'scripts'].flatMap((dir) => fs.readdirSync(path.join(CODE_ROOT, dir), { recursive: true }).map((f) => path.join(dir, f)))
    .filter((f) => /\.(mjs|ts|astro)$/.test(f) && !f.endsWith('.test.mjs') && !f.includes('test-support'));
  assert.ok(sources.length > 100, 'the sources were found');
  const siteAddressArg = String.raw`(site\.url|siteUrl|config\.site\.url|config\.site\?\.url|(?:[^,()]|\([^()]*\))*\?\?\s*config\.site\.url)`;
  const call = new RegExp(String.raw`new URL\(\s*((?:[^()]|\([^()]*\))+?),\s*${siteAddressArg}\s*\)`, 'g');
  const found = sources.flatMap((file) => [...fs.readFileSync(path.join(CODE_ROOT, file), 'utf8').matchAll(call)]
    .map((m) => [file.split(path.sep).join('/'), m[1].trim()]));
  const unexpected = found.filter(([file, arg]) => !BASED_PATHS.some(([f, a]) => f === file && a === arg));
  assert.deepEqual(unexpected, []);
  assert.equal(found.length, BASED_PATHS.length, 'every allowed one still in the code (else drop it from the list)');
  // the pattern finds what it should
  const probe = (code) => [...code.matchAll(call)].length;
  assert.equal(probe("new URL('/sitemap.xml', siteUrl)"), 1);
  assert.equal(probe('new URL(`/${photoDir(name)}/${w}.jpg`, site.url).href'), 1);
  assert.equal(probe("new URL('/detail-dne/data.json', textArg('--site-url') ?? config.site.url)"), 1);
  assert.equal(probe('new URL(workPinImage(work).src, site.url)'), 1);
  assert.equal(probe('new URL(ref, from)'), 0);
});
