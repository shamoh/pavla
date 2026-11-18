import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  CACHE_PREFIX, IMAGE_CACHE_LIMIT, INSTALL_HELP, INSTALL_METHODS, OFFLINE_PATH, appCaches, backTarget, buildAssets, gameOfflineFiles, installMode, isIos, isoDay, pageKey,
  precacheFiles, requestStrategy, swScript,
} from './app-install.mjs';

const ORIGIN = 'https://pavla.example';
const strategy = (href, { method = 'GET', mode = 'cors', base = '/' } = {}) => requestStrategy(new URL(href, ORIGIN), method, mode, ORIGIN, base);

test('appCaches: pages and build files per build, pictures and fonts across builds, all with our prefix', () => {
  const c = appCaches('v26.1118.0930');
  assert.deepEqual(c, { pages: 'pavla-pages-v26.1118.0930', files: 'pavla-files-v26.1118.0930', images: 'pavla-images', fonts: 'pavla-fonts' });
  assert.ok(Object.values(c).every((n) => n.startsWith(CACHE_PREFIX)));
  assert.equal(appCaches('v1 <x>').pages, 'pavla-pages-v1x', 'only safe characters');
  assert.throws(() => appCaches(''), /needs a version/);
});

test('requestStrategy: pages network first, build files cache first, pictures and fonts from the cache refreshed behind', () => {
  assert.deepEqual(strategy('/tvorba/?tag=voda', { mode: 'navigate' }), { how: 'network', cache: 'pages', page: true });
  assert.deepEqual(strategy('/_astro/Base.abc123.css'), { how: 'cache', cache: 'files' });
  for (const file of ['/tvorba/2026/mak-a1b2c/1200.avif', '/fotky/portret/800.webp', '/favicon.svg', '/icon-192.png', '/x.JPG']) {
    assert.deepEqual(strategy(file), { how: 'swr', cache: 'images' }, file);
  }
  assert.deepEqual(strategy('/detail-dne/dnes.json'), { how: 'network', cache: 'pages', page: false }, 'data fresh when online');
  assert.deepEqual(strategy('https://fonts.googleapis.com/css2?family=Work+Sans'), { how: 'swr', cache: 'fonts' });
  assert.deepEqual(strategy('https://fonts.gstatic.com/s/worksans/v1.woff2'), { how: 'cache', cache: 'fonts' });
});

test('requestStrategy: left to the browser: other methods, other sites (statistics, forms), the worker itself, outside the base', () => {
  assert.equal(strategy('/', { method: 'POST', mode: 'navigate' }).how, 'pass');
  assert.equal(strategy('https://www.googletagmanager.com/gtag/js?id=G-1').how, 'pass');
  assert.equal(strategy('https://api.web3forms.com/submit').how, 'pass');
  assert.equal(strategy('/sw.js').how, 'pass');
  assert.equal(strategy('/jine/', { mode: 'navigate', base: '/web/' }).how, 'pass');
  assert.equal(strategy('/web/sw.js', { base: '/web/' }).how, 'pass');
  assert.equal(strategy('/web/tvorba/', { mode: 'navigate', base: '/web/' }).how, 'network');
});

test('pageKey: one copy of a page whatever its filters', () => {
  assert.equal(pageKey(new URL('/tvorba/?tag=voda&page=2#x', ORIGIN)), `${ORIGIN}/tvorba/`);
});

test('precacheFiles: the start page, the offline page, the manifest and icons, under the base', () => {
  assert.deepEqual(precacheFiles('/'), ['/', `/${OFFLINE_PATH}`, '/site.webmanifest', '/favicon.svg', '/icon-192.png']);
  assert.ok(precacheFiles('/web/').every((f) => f.startsWith('/web/')));
});

/** Runs the generated worker in a sandbox with fake caches and fetch; returns its listeners and the state. */
function runWorker(source, { online = true, responses = {} } = {}) {
  const stores = new Map();
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    const key = (r) => (typeof r === 'string' ? new URL(r, ORIGIN).href : r.url);
    return {
      put: async (r, res) => { m.set(key(r), res); },
      match: async (r) => m.get(key(r)),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (r) => m.delete(key(r)),
      addAll: async (list) => list.forEach((u) => m.set(key(u), { ok: true, type: 'basic', body: `pre:${u}`, clone() { return this; } })),
    };
  };
  const cachesApi = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    match: async (r) => {
      for (const name of stores.keys()) { const hit = await (await open(name)).match(r); if (hit) return hit; }
      return undefined;
    },
  };
  const listeners = {};
  const fetches = [];
  const context = {
    self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: ORIGIN }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: cachesApi, URL, Response: { error: () => ({ error: true }) }, Promise, Set, Math, Object, JSON,
    fetch: async (req) => {
      fetches.push(req.url);
      if (!online) throw new TypeError('offline');
      const body = responses[req.url] ?? `net:${req.url}`;
      return { ok: true, type: 'basic', body, clone() { return this; } };
    },
  };
  vm.runInNewContext(source, context);
  const respond = async (href, mode = 'cors') => {
    let answer;
    const waits = [];
    listeners.fetch({ request: { url: new URL(href, ORIGIN).href, method: 'GET', mode }, respondWith: (p) => { answer = p; }, waitUntil: (p) => waits.push(p) });
    const result = answer ? await answer : undefined;
    await Promise.all(waits);
    return result;
  };
  return { listeners, stores, fetches, respond, set online(v) { online = v; } };
}

test('swScript: the worker stores a seen page and serves it offline, an unseen page gets the offline page', async () => {
  const w = runWorker(swScript('v1'));
  await new Promise((done) => w.listeners.install({ waitUntil: (p) => p.then(done) }));
  assert.equal((await w.respond('/tvorba/?tag=voda', 'navigate')).body, `net:${ORIGIN}/tvorba/?tag=voda`);
  w.online = false;
  assert.equal((await w.respond('/tvorba/?tag=les', 'navigate')).body, `net:${ORIGIN}/tvorba/?tag=voda`, 'the stored page, any filters');
  assert.equal((await w.respond('/o-mne/', 'navigate')).body, `pre:/${OFFLINE_PATH}`);
  assert.equal(await w.respond('https://www.googletagmanager.com/gtag/js'), undefined, 'not answered');
});

test('swScript: pictures from the cache at once and refreshed behind; build files cached for good', async () => {
  const w = runWorker(swScript('v1'));
  const first = await w.respond('/tvorba/2026/mak/800.webp');
  assert.equal(first.body, `net:${ORIGIN}/tvorba/2026/mak/800.webp`);
  w.online = false;
  assert.equal((await w.respond('/tvorba/2026/mak/800.webp')).body, first.body, 'offline from the cache');
  w.online = true;
  await w.respond('/_astro/a.js');
  const before = w.fetches.length;
  await w.respond('/_astro/a.js');
  assert.equal(w.fetches.length, before, 'cache first: no second download');
});

test('swScript: a new build deletes our old caches but keeps pictures and caches of others', async () => {
  const w = runWorker(swScript('v2'));
  for (const n of ['pavla-pages-v1', 'pavla-files-v1', 'pavla-images', 'jine-cache']) w.stores.set(n, new Map());
  await new Promise((done) => w.listeners.activate({ waitUntil: (p) => p.then(done) }));
  assert.deepEqual([...w.stores.keys()].sort(), ['jine-cache', 'pavla-images']);
});

test('swScript: at most IMAGE_CACHE_LIMIT pictures, the oldest go first', async () => {
  const w = runWorker(swScript('v1'));
  for (let i = 0; i <= IMAGE_CACHE_LIMIT; i++) await w.respond(`/p/${i}.webp`);
  const images = w.stores.get('pavla-images');
  assert.equal(images.size, IMAGE_CACHE_LIMIT);
  assert.equal(images.has(`${ORIGIN}/p/0.webp`), false);
});

test('installMode: the prompt where offered, how-to on iPhone and other phones, nothing in the app or on a computer without it', () => {
  assert.equal(installMode({ standalone: true, prompt: true, ios: true, phone: true }), 'hidden');
  assert.equal(installMode({ standalone: false, prompt: true, ios: false, phone: false }), 'prompt');
  assert.equal(installMode({ standalone: false, prompt: false, ios: true, phone: true }), 'ios');
  assert.equal(installMode({ standalone: false, prompt: false, ios: false, phone: true }), 'menu');
  assert.equal(installMode({ standalone: false, prompt: false, ios: false, phone: false }), 'hidden');
  assert.ok(INSTALL_HELP.ios.includes('Přidat na plochu') && INSTALL_HELP.menu.includes('Nainstalovat'));
  assert.deepEqual(Object.values(INSTALL_METHODS), ['accepted', 'dismissed', 'help_ios', 'help_menu', 'installed']);
});

test('isIos: iPhone, iPad (also as Macintosh with touch), not a Mac or Android', () => {
  assert.equal(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);
  assert.equal(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false);
  assert.equal(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5), false);
});

test('backTarget: back in history from a page of the site, otherwise home; none on the start page', () => {
  const at = (pathname, referrer, base = '/') => backTarget({ pathname, referrer, origin: ORIGIN, base });
  assert.equal(at('/', `${ORIGIN}/tvorba/`), null);
  assert.equal(at('/tvorba/', `${ORIGIN}/`), 'history');
  assert.equal(at('/tvorba/', ''), '/', 'opened right here (a shortcut)');
  assert.equal(at('/tvorba/', 'https://www.instagram.com/'), '/');
  assert.equal(at('/web/', '', '/web/'), null);
  assert.equal(at('/web/tvorba/', `${ORIGIN}/web/`, '/web/'), 'history');
});

test('isoDay: the local day and the days after it, across a month', () => {
  assert.equal(isoDay(new Date(2026, 10, 18, 23, 59)), '2026-11-18');
  assert.equal(isoDay(new Date(2026, 10, 30, 8), 1), '2026-12-01');
});

test('gameOfflineFiles: the close-up of every level largest, every offered work smallest, only the asked days', () => {
  const data = {
    works: [
      { id: 'a', folder: 'tvorba/2026/a-a', widths: [480, 960, 1600] },
      { id: 'b', folder: 'tvorba/2026/b-b', widths: [480, 960] },
      { id: 'c', folder: 'tvorba/2025/c-c', widths: [480] },
    ],
    plan: { days: {
      16: { date: '2026-11-18', easy: { targetId: 'a', optionIds: ['b', 'a', 'gone'] }, hard: { targetId: 'c', optionIds: ['c'] } },
      17: { date: '2026-11-19', easy: { targetId: 'b', optionIds: ['b'] } },
      18: { date: '2026-11-20', easy: { targetId: 'a', optionIds: ['a'] } },
    } },
  };
  assert.deepEqual(gameOfflineFiles(data, ['2026-11-18', '2026-11-19']), [
    '/tvorba/2026/a-a/1600.webp', '/tvorba/2026/b-b/480.webp', '/tvorba/2026/a-a/480.webp', '/tvorba/2025/c-c/480.webp', '/tvorba/2026/b-b/960.webp',
  ]);
  assert.deepEqual(gameOfflineFiles(data, ['2027-01-01']), []);
  assert.deepEqual(gameOfflineFiles(null, ['2026-11-18']), []);
});

test('buildAssets: scripts and styles of a page and the modules a script imports, only build files of this site', () => {
  const page = '<link rel="stylesheet" href="/_astro/index.a1.css"><script type="module" src="/_astro/page.b2.js"></script><img src="/tvorba/x.webp"><script src="https://www.googletagmanager.com/gtag/js"></script>';
  assert.deepEqual(buildAssets(page, `${ORIGIN}/detail-dne/`), [`${ORIGIN}/_astro/index.a1.css`, `${ORIGIN}/_astro/page.b2.js`]);
  const script = 'import{a as b}from"./shared.c3.js";import"./side.d4.js";const m=()=>import("./lazy.e5.js");const h=`<img src="${u}"><a href="x.js#a">`;';
  assert.deepEqual(buildAssets(script, `${ORIGIN}/_astro/page.b2.js`), [`${ORIGIN}/_astro/shared.c3.js`, `${ORIGIN}/_astro/side.d4.js`, `${ORIGIN}/_astro/lazy.e5.js`]);
});
