import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_STORAGE_PREFIX, STORAGE_PREFIX, STORAGE_PREFIX_GLOBAL, isStoragePrefix, storageKey, storagePrefixOf, withStoragePrefix } from './storage-prefix.mjs';
import { demoSiteConfig } from './test-support/demo-site.mjs';
import { CODE_ROOT } from './site-dir.mjs';
import { FAVORITES_STORE } from './favorites.mjs';
import { GAME_STORE } from './detail-game.mjs';
import { PALETTE_KEY } from './palettes.mjs';
import { CACHE_PREFIX, appCaches } from './app-install.mjs';

test('storagePrefixOf: the prefix of the site, the default without one, an error for a bad one', () => {
  assert.equal(storagePrefixOf({ site: { storagePrefix: 'pavla' } }), 'pavla');
  assert.equal(storagePrefixOf({ site: { storagePrefix: 'kacka-web' } }), 'kacka-web');
  for (const config of [undefined, {}, { site: {} }, { site: { storagePrefix: '' } }, { site: { storagePrefix: null } }]) {
    assert.equal(storagePrefixOf(config), DEFAULT_STORAGE_PREFIX);
  }
  for (const bad of ['Pavla', 'pavla.web', 'pavla-', '-pavla', '1web', 'pa vla', 'pavla--web', 42, true]) {
    assert.throws(() => storagePrefixOf({ site: { storagePrefix: bad } }), /site\.storagePrefix must be/, String(bad));
    assert.equal(isStoragePrefix(bad), false, String(bad));
  }
  assert.equal(storagePrefixOf(demoSiteConfig()), 'ukazka', 'the test site has its own');
});

test('outside the build the prefix is the default; every name of the browser starts with it', () => {
  assert.equal(STORAGE_PREFIX, DEFAULT_STORAGE_PREFIX);
  assert.equal(storageKey('favorites'), 'web.favorites');
  for (const key of [FAVORITES_STORE, GAME_STORE, PALETTE_KEY]) assert.ok(key.startsWith(`${STORAGE_PREFIX}.`), key);
  assert.equal(CACHE_PREFIX, `${STORAGE_PREFIX}-`);
  for (const name of Object.values(appCaches('v1'))) assert.ok(name.startsWith(CACHE_PREFIX), name);
});

test('the build defines the prefix of the site (astro.config.mjs) under the name the module reads', () => {
  const astroConfig = fs.readFileSync(path.join(CODE_ROOT, 'astro.config.mjs'), 'utf8');
  assert.match(astroConfig, /define: \{ \[STORAGE_PREFIX_GLOBAL\]: JSON\.stringify\(storagePrefixOf\(config\)\) \}/);
  const source = fs.readFileSync(new URL('./storage-prefix.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes(`typeof ${STORAGE_PREFIX_GLOBAL} === 'string' ? ${STORAGE_PREFIX_GLOBAL} :`));
});

test('no name of the browser is written out in the code: all of them go through storageKey or STORAGE_PREFIX', () => {
  const roots = ['scripts/lib', 'src'].map((d) => path.join(CODE_ROOT, d));
  const files = roots.flatMap((root) => fs.readdirSync(root, { recursive: true }).map((f) => path.join(root, f)))
    .filter((f) => /\.(mjs|ts|astro)$/.test(f) && !f.endsWith('.test.mjs'));
  const written = files.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\(\s*['"`]/g)]
    .map(() => path.relative(CODE_ROOT, f)));
  assert.deepEqual(written, []);
});

test('withStoragePrefix: a name of this build with the prefix of another site; a name without the prefix is an error', () => {
  assert.equal(withStoragePrefix(FAVORITES_STORE, 'pavla'), 'pavla.favorites');
  assert.equal(withStoragePrefix(`${CACHE_PREFIX}images`, 'ukazka'), 'ukazka-images');
  assert.equal(withStoragePrefix(storageKey('cinema.interval'), 'kacka-web'), 'kacka-web.cinema.interval');
  for (const bad of ['favorites', 'webfavorites', 'jine.favorites', '']) assert.throws(() => withStoragePrefix(bad, 'pavla'), /no name of the browser/, bad);
});
