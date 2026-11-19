import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import {
  HOME_DEFAULT_VIEW, HOME_RECENT, HOME_SCREENS, HOME_START, HOME_TILE_SIZE_STORAGE_KEY, HOME_VIEW_STORAGE_KEY,
  homeMost, homeRecent, homeRemember, homeScreen, homeScript, homeSearch, homeSetup, homeShownCount,
} from './home-view.mjs';
import { viewOf } from './view-layout.mjs';
import { TILE_SIZE_STORAGE_KEY, VIEW_STORAGE_KEY } from './gallery-filter.mjs';
import { fakeCard, fakeElement, plain, runInlineScript } from './test-support/inline-script-dom.mjs';

const setup = homeSetup(homeRecent(), 'cov01');
const of = (search, view = null, tile = null) => viewOf(search, view, tile, setup);

test('home view: medium tiles by default, remembered apart from the gallery', () => {
  assert.equal(HOME_DEFAULT_VIEW, 'tiles');
  assert.deepEqual(of(''), { view: 'tiles', tile: 'm' });
  assert.deepEqual(of(''), HOME_START, 'the HTML is in the default view');
  assert.deepEqual(of('?page=2', 'grid'), { view: 'grid', tile: 'm' }, 'no paging here: a page param does not decide');
  assert.notEqual(HOME_VIEW_STORAGE_KEY, VIEW_STORAGE_KEY);
  assert.notEqual(HOME_TILE_SIZE_STORAGE_KEY, TILE_SIZE_STORAGE_KEY);
  assert.deepEqual(setup.keys, { view: HOME_VIEW_STORAGE_KEY, tile: HOME_TILE_SIZE_STORAGE_KEY });
  assert.equal(setup.cover, 'cov01');
  assert.equal(homeSetup(homeRecent()).cover, null);
});

test('home view: a link decides over the memory', () => {
  assert.deepEqual(of('?view=grid'), { view: 'grid', tile: 'm' });
  assert.deepEqual(of('?tile=s'), { view: 'tiles', tile: 's' }, 'a tile size alone means tiles');
  assert.deepEqual(of('?view=grid', 'tiles', 'l'), { view: 'grid', tile: 'l' }, 'the remembered tile size waits for a switch back');
  assert.deepEqual(of('?tile=s', 'grid', 'l'), { view: 'tiles', tile: 's' }, 'a linked tile size is never big pictures');
  assert.deepEqual(of('?view=bogus&tile=xl', 'grid', 'l'), { view: 'tiles', tile: 'm' }, 'a bad link is the default, not the memory');
});

test('home view: the remembered view and tile size apply to a plain link', () => {
  assert.deepEqual(of('', 'grid'), { view: 'grid', tile: 'm' });
  assert.deepEqual(of('', null, 'l'), { view: 'tiles', tile: 'l' });
  assert.deepEqual(of('?utm_source=instagram', 'grid', 's'), { view: 'grid', tile: 's' }, 'other params do not decide');
  for (const stored of [null, '', 'tiles', 'bogus']) assert.deepEqual(of('', stored), { view: 'tiles', tile: 'm' }, String(stored));
  assert.deepEqual(homeRemember({ view: 'grid', tile: 'l' }, setup), { view: 'grid', tile: 'l' });
  assert.deepEqual(homeRemember({ view: 'tiles', tile: 'm' }, setup), { view: null, tile: null }, 'defaults are forgotten');
});

test('home view: only a view other than the default goes into the URL, other params stay', () => {
  assert.equal(homeSearch('', { view: 'tiles', tile: 'm' }, setup), '', 'the plain home page stays /');
  assert.equal(homeSearch('', { view: 'tiles', tile: 's' }, setup), '?tile=s');
  assert.equal(homeSearch('', { view: 'grid', tile: 's' }, setup), '?view=grid', 'no tile size with big pictures');
  assert.equal(homeSearch('?view=grid&tile=l', { view: 'tiles', tile: 'm' }, setup), '', 'the old view is replaced');
  assert.equal(homeSearch('?utm_source=ig&tile=s', { view: 'tiles', tile: 'l' }, setup), '?utm_source=ig&tile=l');
  for (const state of [{ view: 'grid', tile: 'm' }, { view: 'tiles', tile: 's' }, { view: 'tiles', tile: 'l' }, { view: 'tiles', tile: 'm' }]) {
    assert.deepEqual(of(homeSearch('', state, setup)), state, JSON.stringify(state));
  }
  // The plain "/" cannot tell the default from nothing: whoever remembered another view sees theirs.
  assert.deepEqual(of(homeSearch('', { view: 'tiles', tile: 'm' }, setup), 'grid'), { view: 'grid', tile: 'm' });
});

test('home counts: per view and screen, fewer on smaller ones, from site.config.yaml with defaults', () => {
  assert.equal(homeShownCount({ view: 'grid', tile: 's' }, 'wide', setup), 6);
  assert.equal(homeShownCount({ view: 'tiles', tile: 'l' }, 'wide', setup), 20);
  assert.equal(homeShownCount({ view: 'tiles', tile: 'm' }, 'wide', setup), 30);
  assert.equal(homeShownCount({ view: 'tiles', tile: 's' }, 'wide', setup), 63);
  for (const kind of ['grid', 's', 'm', 'l']) {
    assert.ok(HOME_RECENT.phone[kind] <= HOME_RECENT.tablet[kind] && HOME_RECENT.tablet[kind] < HOME_RECENT.wide[kind], kind);
  }
  assert.equal(homeShownCount({ view: 'tiles', tile: 'm' }, 'tablet', setup), HOME_RECENT.tablet.m);
  assert.equal(homeShownCount({ view: 'tiles', tile: 'm' }, 'phone', setup), HOME_RECENT.phone.m);
  assert.equal(homeMost(homeRecent()), 63);
  assert.deepEqual(homeRecent({ wide: { s: 72 } }).wide, { ...HOME_RECENT.wide, s: 72 });
  assert.deepEqual(homeRecent({ wide: { s: 72 } }).tablet, HOME_RECENT.tablet, 'a missing screen is the default');
  assert.equal(homeMost(homeRecent({ tablet: { m: 80 } })), 80);
  for (const bad of [0, -3, 2.5, '30']) assert.throws(() => homeRecent({ tablet: { m: bad } }), /home\.recent\.tablet\.m/, String(bad));
  const config = YAML.parse(fs.readFileSync(new URL('../../site.config.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(homeRecent(config.home?.recent), HOME_RECENT, 'site.config.yaml holds the documented counts');
});

test('homeScreen: the first matching media query, otherwise wide', () => {
  const at = (width) => (query) => width <= Number(query.match(/max-width: (\d+)px/)[1]);
  assert.deepEqual(HOME_SCREENS.map(([name]) => name), ['phone', 'tablet']);
  assert.equal(homeScreen(setup, at(390)), 'phone');
  assert.equal(homeScreen(setup, at(640)), 'phone');
  assert.equal(homeScreen(setup, at(641)), 'tablet');
  assert.equal(homeScreen(setup, at(1100)), 'tablet');
  assert.equal(homeScreen(setup, at(1101)), 'wide');
});

test('home setup: the view setup with counts, screens and the cover, as JSON', () => {
  assert.deepEqual(setup.linkKeys, ['view', 'tile']);
  assert.deepEqual(setup.screens, HOME_SCREENS);
  assert.deepEqual(JSON.parse(JSON.stringify(setup)), setup);
});

test('homeScript: self-contained, valid script', () => {
  assert.doesNotThrow(() => new Function(homeScript));
  assert.doesNotMatch(homeScript, /\bimport\b|\b__name\b/);
});

// "Nejnovější" on the home page: the grid #recent with data-view, then the inline script. Without grid.viewSetup the
// page script never wires the view switch (big pictures | tiles | − | +) and nothing lays the works out.
const homeGrid = (count = 40) => fakeElement({
  attributes: { id: 'recent', 'data-view': JSON.stringify(setup) },
  children: Array.from({ length: count }, (_, i) => fakeCard(`w${String(i).padStart(4, '0')}`)),
});
const shownCards = (grid) => grid.children.filter((card) => !card.hidden).length;

test('homeScript: starts the grid right before it (view, count of the screen, address)', () => {
  const { grid, address } = runInlineScript(homeScript, [homeGrid()], { search: '?view=grid' });
  assert.deepEqual(plain(grid.viewState), { view: 'grid', tile: 'm' });
  assert.deepEqual(plain(grid.viewSetup), setup);
  assert.equal(shownCards(grid), setup.recent.wide.grid);
  assert.equal(grid.classList.contains('tiles'), false);
  assert.equal(address, '/?view=grid');
});

test('homeScript: a remembered tile size and the count of a phone, a non-default size goes to the address', () => {
  const { grid, address } = runInlineScript(homeScript, [homeGrid()], { stored: { [HOME_TILE_SIZE_STORAGE_KEY]: 's' }, width: 400 });
  assert.deepEqual(plain(grid.viewState), { view: 'tiles', tile: 's' });
  assert.equal(shownCards(grid), setup.recent.phone.s);
  assert.equal(grid.classList.contains('tiles-s'), true);
  assert.equal(address, '/?tile=s');
  assert.equal(runInlineScript(homeScript, [homeGrid()]).address, '/', 'the default view stays out of the address');
});

test('homeScript: never shows the work of the cover among the newest', () => {
  const { grid } = runInlineScript(homeScript, [homeGrid()], { search: '?view=grid' });
  assert.equal(grid.children.find((card) => card.getAttribute('data-id') === 'cov01'), undefined, 'the fake grid has no cover');
  const withCover = homeGrid();
  withCover.children[0] = fakeCard('cov01');
  runInlineScript(homeScript, [withCover], { search: '?view=grid' });
  assert.equal(withCover.children[0].hidden, true);
  assert.equal(shownCards(withCover), setup.recent.wide.grid);
});

test('homeScript: still finds the grid when the grid component puts its own script right after it (the hearts of favourites)', () => {
  const heartsScript = fakeElement({ tagName: 'SCRIPT', attributes: { type: 'module', src: '/_astro/WorkGrid.js' } });
  const { grid } = runInlineScript(homeScript, [homeGrid(), heartsScript, fakeElement({ tagName: 'SCRIPT' })], { search: '?view=grid' });
  assert.deepEqual(plain(grid.viewState), { view: 'grid', tile: 'm' }, 'the page script needs grid.viewState and grid.viewSetup');
  assert.equal(shownCards(grid), setup.recent.wide.grid);
});

test('homeScript: no grid before it = does nothing (no error)', () => {
  assert.doesNotThrow(() => runInlineScript(homeScript, [fakeElement({ tagName: 'P' })]));
  assert.doesNotThrow(() => runInlineScript(homeScript, []));
});
