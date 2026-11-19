import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKIP_HEADER_ROOM, SKIP_HEADER_SCOPES, skipHeaderScope, skipHeaderScript, skipsHeader, startTop } from './skip-header.mjs';

const page = (over = {}) => ({ path: '/tvorba/2026/maky-ab12c/', scope: '/tvorba/', hash: '', navigation: 'navigate', ...over });

test('skipsHeader: a fresh visit of any page of the Tvorba section', () => {
  for (const path of ['/tvorba', '/tvorba/', '/tvorba/2026/', '/tvorba/kolekce/', '/tvorba/kolekce/2026-plener-sumava/', '/tvorba/2026/maky-ab12c/']) {
    assert.equal(skipsHeader(page({ path })), true, path);
  }
});

test('skipsHeader: never outside the section, with an anchor, after back / forward or reload', () => {
  assert.equal(skipsHeader(page({ path: '/' })), false);
  assert.equal(skipsHeader(page({ path: '/o-mne/' })), false);
  assert.equal(skipsHeader(page({ path: '/tvorbax/' })), false);
  assert.equal(skipsHeader(page({ hash: '#podobne' })), false);
  assert.equal(skipsHeader(page({ navigation: 'back_forward' })), false);
  assert.equal(skipsHeader(page({ navigation: 'reload' })), false);
  assert.equal(skipsHeader(page({ navigation: '' })), false);
  assert.equal(skipsHeader(page({ scope: '' })), false);
});

test('skipsHeader: the scope carries the base path of the site', () => {
  assert.equal(skipsHeader(page({ scope: '/web/tvorba/', path: '/web/tvorba/' })), true);
  assert.equal(skipsHeader(page({ scope: '/web/tvorba/', path: '/tvorba/' })), false);
});

/** Runs the inline script in a fake window; returns where it scrolled (null = nowhere). */
function run({ path = '/tvorba/', hash = '', navigation = 'navigate', mainTop = 120, scrollY = 0, main = true } = {}) {
  let scrolled = null;
  const win = {
    performance: { getEntriesByType: (kind) => (kind === 'navigation' && navigation ? [{ type: navigation }] : []) },
    scrollTo: (x, y) => { scrolled = [x, y]; },
    scrollY,
  };
  const doc = { querySelector: (s) => (s === 'main' && main ? { getBoundingClientRect: () => ({ top: mainTop }) } : null) };
  new Function('window', 'performance', 'location', 'document', skipHeaderScript('/tvorba/'))(win, win.performance, { pathname: path, hash }, doc);

  return scrolled;
}

test('skipHeaderScript: self-contained, scrolls main just under the top edge on a fresh visit', () => {
  const script = skipHeaderScript('/tvorba/');
  assert.doesNotMatch(script, /\bimport\b|\b__name\b/);
  assert.deepEqual(run({ mainTop: 120 }), [0, 120 - SKIP_HEADER_ROOM]);
  // Already scrolled a bit (the browser was quicker): the same place of the page.
  assert.deepEqual(run({ mainTop: 20, scrollY: 100 }), [0, 120 - SKIP_HEADER_ROOM]);
  // A header lower than the room: never above the top of the page.
  assert.deepEqual(run({ mainTop: 10 }), [0, 0]);
});

test('skipHeaderScript: stays put outside the section, with an anchor, after back / forward, without main', () => {
  assert.equal(run({ path: '/kontakt/' }), null);
  assert.equal(run({ hash: '#x' }), null);
  assert.equal(run({ navigation: 'back_forward' }), null);
  assert.equal(run({ navigation: '' }), null);
  assert.equal(run({ main: false }), null);
});

test('skipHeaderScope: Tvorba and the game, with the base path of the site; nothing elsewhere', () => {
  assert.deepEqual(SKIP_HEADER_SCOPES, ['/tvorba/', '/detail-dne/']);
  assert.equal(skipHeaderScope('/tvorba/2026/maky-ab12c/'), '/tvorba/');
  assert.equal(skipHeaderScope('/tvorba'), '/tvorba/', 'the dev server serves it without the slash');
  assert.equal(skipHeaderScope('/detail-dne/'), '/detail-dne/');
  assert.equal(skipHeaderScope('/detail-dne'), '/detail-dne/');
  assert.equal(skipHeaderScope('/web/detail-dne/', '/web/'), '/web/detail-dne/');
  for (const path of ['/', '/o-mne/', '/kontakt/', '/detail-dnes/', '/tvorbax/']) assert.equal(skipHeaderScope(path), '', path);
  assert.equal(skipsHeader({ path: '/detail-dne/', scope: skipHeaderScope('/detail-dne/'), hash: '', navigation: 'navigate' }), true);
});

test('startTop: the title of a page drawn by its script on top; flush on a phone, the room of Tvorba otherwise, never above the page', () => {
  // the root 300 px down in the window, scrolled by 100: its top is at 400 in the page
  assert.equal(startTop(300, 100, true), 400);
  assert.equal(startTop(300, 100, false), 400 - SKIP_HEADER_ROOM);
  assert.equal(startTop(300, 100, false, 30), 370);
  // already scrolled past it, or at the very top: never a negative scroll
  assert.equal(startTop(-50, 20, true), 0);
  assert.equal(startTop(5, 0, false), 0);
});
