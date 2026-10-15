import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMN_DEFAULTS, COLUMN_ORDERS, COLUMN_PLACES, VIEW_KINDS, balanceColumns, columnCount, columnPlan, columnSettings, columnsFor, inlineScript, orderColumns, viewOf, viewScript, viewSetup,
} from './view-layout.mjs';
import fs from 'node:fs';
import YAML from 'yaml';
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

test('columnSettings: defaults, site.config.yaml, bad values stop the build', () => {
  assert.deepEqual(COLUMN_DEFAULTS, { maxGap: 2, maxTop: 12, order: 'alternate' });
  assert.deepEqual(columnSettings(undefined), COLUMN_DEFAULTS);
  assert.deepEqual(columnSettings({ maxTop: 40 }), { ...COLUMN_DEFAULTS, maxTop: 40 });
  assert.deepEqual(columnSettings({ maxGap: 1, maxTop: 0, order: 'none' }), { maxGap: 1, maxTop: 0, order: 'none' });
  for (const [key, value] of [['maxGap', 0.5], ['maxGap', '2'], ['maxTop', -1], ['maxTop', null], ['order', 'random']]) {
    assert.throws(() => columnSettings({ [key]: value }), new RegExp(`columns\\.${key}`), `${key} ${value}`);
  }
  assert.throws(() => columnSettings({ maxgap: 3 }), /unknown maxgap/);
  assert.deepEqual(gallery.columns, COLUMN_DEFAULTS, 'every grid setup carries them');
  const config = YAML.parse(fs.readFileSync(new URL('../../site.config.yaml', import.meta.url), 'utf8'));
  for (const place of COLUMN_PLACES) assert.deepEqual(columnsFor(config, place), COLUMN_DEFAULTS, `site.config.yaml ${place}.columns`);
});

test('columnsFor: the home page and the galleries each on their own', () => {
  assert.deepEqual(COLUMN_PLACES, ['home', 'gallery']);
  const config = { home: { columns: { maxTop: 40, order: 'center' } }, gallery: { pageSizes: [12], columns: { maxGap: 1 } } };
  assert.deepEqual(columnsFor(config, 'home'), { ...COLUMN_DEFAULTS, maxTop: 40, order: 'center' });
  assert.deepEqual(columnsFor(config, 'gallery'), { ...COLUMN_DEFAULTS, maxGap: 1 });
  assert.deepEqual(columnsFor({}, 'gallery'), COLUMN_DEFAULTS, 'none = the defaults');
  assert.deepEqual(columnsFor(undefined, 'home'), COLUMN_DEFAULTS);
  assert.throws(() => columnsFor({ gallery: { columns: { order: 'x' } } }, 'gallery'), /gallery\.columns\.order/, 'the error names the place');
  assert.throws(() => columnsFor({ home: { columns: { maxtop: 1 } } }, 'home'), /home\.columns: unknown maxtop/);
  assert.throws(() => columnsFor({ columns: { maxGap: 3 } }, 'home'), /moved to home\.columns and gallery\.columns/, 'the old shared place');
  assert.throws(() => columnsFor({}, 'year'), /unknown place/);
});

test('columnPlan: gaps first (up to maxGap), then half of the rest above (up to maxTop), the rest below', () => {
  const settings = { maxGap: 2, maxTop: 40, order: 'none' };
  assert.deepEqual(columnPlan(5, 0, 12, settings), { extra: 0, top: 0 }, 'the tallest column');
  assert.deepEqual(columnPlan(5, 30, 12, settings), { extra: 7.5, top: 0 }, 'only wider gaps');
  assert.deepEqual(columnPlan(5, 100, 12, settings), { extra: 12, top: 26 }, 'gaps at most 2 × 12, the rest centred');
  assert.deepEqual(columnPlan(5, 300, 12, settings), { extra: 12, top: 40 }, 'at most maxTop above');
  assert.deepEqual(columnPlan(1, 200, 12, settings), { extra: 0, top: 40 }, 'one work: no gap to widen');
  assert.deepEqual(columnPlan(5, 100, 12, { ...settings, maxGap: 1 }), { extra: 0, top: 40 }, 'maxGap 1: gaps never widen');
  assert.deepEqual(columnPlan(5, 100, 12, { ...settings, maxTop: 0 }), { extra: 12, top: 0 }, 'maxTop 0: always on top');
  assert.deepEqual(columnPlan(3, 50, 36, { maxGap: 2, maxTop: 12 }), { extra: 25, top: 0 }, 'the site settings');
});

test('orderColumns: ranked by the number of works, then the newest; placed by the order', () => {
  // A=6 (with the newest work), B=6, C=5, D=5, E=4, F=4, as balanced: A C E F D B
  const cols = { A: [0, 1, 2, 3, 4, 5], B: [6, 7, 8, 9, 10, 11], C: [12, 13, 14, 15, 16], D: [17, 18, 19, 20, 21], E: [22, 23, 24, 25], F: [26, 27, 28, 29] };
  const name = (g) => Object.keys(cols).find((k) => cols[k] === g);
  const balanced = [cols.A, cols.C, cols.E, cols.F, cols.D, cols.B];
  const placed = (order) => orderColumns(balanced, order).map(name).join(' ');
  assert.deepEqual(COLUMN_ORDERS, ['none', 'alternate', 'edges', 'center']);
  assert.equal(placed('none'), 'A C E F D B');
  assert.equal(placed('alternate'), 'A F B E C D');
  assert.equal(placed('edges'), 'A C E F D B');
  assert.equal(placed('center'), 'E C A B D F');
  // odd: counts 1..5
  const five = [[0], [1, 2], [3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13, 14]];
  const counts = (order) => orderColumns(five, order).map((g) => g.length);
  assert.deepEqual(counts('alternate'), [5, 1, 4, 2, 3]);
  assert.deepEqual(counts('edges'), [5, 3, 1, 2, 4]);
  assert.deepEqual(counts('center'), [1, 3, 5, 4, 2]);
  // a tie: the column with the newer works first
  assert.deepEqual(orderColumns([[1, 3], [0, 2]], 'alternate'), [[0, 2], [1, 3]]);
  assert.deepEqual(orderColumns([[0]], 'center'), [[0]]);
});
