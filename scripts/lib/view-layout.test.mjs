import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_KINDS, balanceColumns, columnCount, inlineScript, viewOf, viewScript, viewSetup } from './view-layout.mjs';
import { CARD_IMAGE_SIZES, DEFAULT_VIEW, TILE_SIZE_STORAGE_KEY, VIEW_STORAGE_KEY, viewImageSizes } from './gallery-filter.mjs';

// The gallery: big pictures by default, a link with a view, tile size, page or page size decides.
const gallery = viewSetup({ defaultView: DEFAULT_VIEW, linkKeys: ['view', 'tile', 'page', 'perPage'], keys: { view: VIEW_STORAGE_KEY, tile: TILE_SIZE_STORAGE_KEY } });
const of = (search, view = null, tile = null) => viewOf(search, view, tile, gallery);

test('viewSetup: views, defaults and the sizes of the pictures of each kind', () => {
  assert.deepEqual(VIEW_KINDS, ['grid', 's', 'm', 'l']);
  assert.equal(gallery.sizes.grid, CARD_IMAGE_SIZES);
  for (const t of ['s', 'm', 'l']) assert.equal(gallery.sizes[t], viewImageSizes('tiles', t));
  assert.deepEqual(JSON.parse(JSON.stringify(gallery)), gallery, 'goes into the page as JSON');
});

test('viewOf (gallery): the link decides, a remembered view only without one', () => {
  assert.deepEqual(of(''), { view: 'grid', tile: 'm' });
  assert.deepEqual(of('', 'tiles'), { view: 'tiles', tile: 'm' });
  assert.deepEqual(of('?view=grid', 'tiles'), { view: 'grid', tile: 'm' }, 'the link decides');
  assert.deepEqual(of('?page=2', 'tiles'), { view: 'grid', tile: 'm' }, 'a link with a page shows the view it was sent from');
  assert.deepEqual(of('?perPage=24', 'tiles'), { view: 'grid', tile: 'm' });
  assert.deepEqual(of('?tile=s', 'tiles'), { view: 'grid', tile: 's' }, 'a tile size in the link decides too');
  assert.deepEqual(of('?tag=les', 'tiles'), { view: 'tiles', tile: 'm' }, 'filters alone do not decide');
  for (const stored of [null, '', 'grid', 'bogus']) assert.deepEqual(of('', stored), { view: 'grid', tile: 'm' }, String(stored));
});

test('viewOf (gallery): the tile size from the link, otherwise remembered', () => {
  assert.deepEqual(of('', 'tiles', 'l'), { view: 'tiles', tile: 'l' });
  assert.deepEqual(of('?view=tiles&tile=m', 'tiles', 'l'), { view: 'tiles', tile: 'm' }, 'the link decides');
  assert.deepEqual(of('?view=tiles', null, 's'), { view: 'tiles', tile: 's' }, 'a link without a size: the remembered one');
  for (const stored of [null, '', 'm', 'xl']) assert.equal(of('?view=tiles', null, stored).tile, 'm', String(stored));
  assert.deepEqual(of('?view=tiles&tile=xl', null, 'l'), { view: 'tiles', tile: 'm' }, 'a bad size in the link is the default');
});

test('columnCount follows CSS multi-column: count, width or both', () => {
  assert.equal(columnCount(1224, 6, 150, 12), 6, 'columns: 6 150px on a wide screen');
  assert.equal(columnCount(700, 6, 150, 12), 4);
  assert.equal(columnCount(1224, 3, 300, 36), 3);
  assert.equal(columnCount(600, 3, 300, 36), 1);
  assert.equal(columnCount(358, 3, NaN, 8), 3, 'columns: 3 on a phone');
  assert.equal(columnCount(100, NaN, 150, 12), 1);
  assert.equal(columnCount(500, NaN, NaN, 0), 1);
});

const totals = (heights, cols) => cols.map((c) => c.reduce((sum, i) => sum + heights[i], 0));
const spread = (heights, cols) => Math.max(...totals(heights, cols)) - Math.min(...totals(heights, cols));

test('balanceColumns: every item once, newest on top in each column', () => {
  const heights = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
  const cols = balanceColumns(heights, 4);
  assert.equal(cols.length, 4);
  assert.deepEqual(cols.flat().sort((a, b) => a - b), heights.map((_, i) => i));
  for (const c of cols) assert.deepEqual(c, [...c].sort((a, b) => a - b));
  assert.ok(cols.some((c) => c[0] === 0), 'the newest is on top of a column');
});

test('balanceColumns: evens out what filling in turn leaves uneven', () => {
  // in turn (each into the shortest column): 11 / 9 / 8
  const heights = [1, 1, 1, 10, 1, 1, 1, 1, 1, 1, 4, 4];
  const cols = balanceColumns(heights, 3);
  assert.ok(spread(heights, cols) <= 2, JSON.stringify(totals(heights, cols)));
  // tiles of the real ratios: the columns differ by less than a quarter of a tile
  const tiles = [0.75, 1.4, 0.7, 1, 0.66, 1.33, 0.25, 1.75, 0.7, 0.72, 1.41, 0.75, 1, 0.7, 0.8, 1.3, 0.7, 0.68, 0.75, 1.42];
  assert.ok(spread(tiles, balanceColumns(tiles, 5)) < 0.25, JSON.stringify(totals(tiles, balanceColumns(tiles, 5))));
});

test('balanceColumns: one column, more columns than items, equal items, a long list stays quick', () => {
  assert.deepEqual(balanceColumns([2, 3, 1], 1), [[0, 1, 2]]);
  assert.deepEqual(balanceColumns([2, 3], 3), [[0], [1], []]);
  assert.deepEqual(balanceColumns([1, 1, 1, 1, 1, 1], 3), [[0, 3], [1, 4], [2, 5]]);
  assert.deepEqual(balanceColumns([], 2), [[], []]);
  // "Zobrazit vše" of a large gallery
  const many = Array.from({ length: 1500 }, (_, i) => 0.5 + ((i * 7919) % 1000) / 1000);
  const started = performance.now();
  const cols = balanceColumns(many, 3);
  assert.ok(performance.now() - started < 500, 'quick');
  assert.ok(spread(many, cols) < 1.5, JSON.stringify(totals(many, cols)));
});

test('viewScript: self-contained, valid script that starts the grid right before it', () => {
  assert.doesNotThrow(() => new Function(viewScript));
  assert.match(viewScript, /startView\(document\.currentScript\.previousElementSibling\);\n\}\)\(\);$/);
  assert.doesNotMatch(viewScript, /\bimport\b|\b__name\b/);
  function demoStart() {}
  assert.match(inlineScript([demoStart], demoStart), /^\(function \(\) \{\nfunction demoStart\(\) \{\}\ndemoStart\(/);
});

test('inline scripts: every copied function lives in view-layout.mjs (the dev server rewrites calls of imported ones)', async () => {
  const { homeScript } = await import('./home-view.mjs');
  const source = (await import('node:fs')).readFileSync(new URL('./view-layout.mjs', import.meta.url), 'utf8');
  for (const script of [viewScript, homeScript]) {
    const names = [...script.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
    assert.ok(names.length >= 3, script.slice(0, 80));
    for (const name of names) assert.match(source, new RegExp(`^export function ${name}\\(`, 'm'), name);
  }
});
