import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import { MARK_CORNERS, MARK_ICONS, MARK_PLACES, SALE_ICONS, TILE_MARK_DEFAULTS, tileMarks, tileMarksFor, workMarks } from './tile-marks.mjs';

test('tileMarks: the chosen defaults, site.config.yaml holds them', () => {
  assert.deepEqual(tileMarks(undefined), TILE_MARK_DEFAULTS);
  assert.deepEqual(TILE_MARK_DEFAULTS, {
    size: 10, min: 12, max: 22, opacity: 90,
    featured: { corner: 'tl', tiles: ['s', 'm', 'l'] },
    sale: { corner: 'br', icon: 'cart', tiles: ['m', 'l'] },
  });
  const config = YAML.parse(fs.readFileSync(new URL('../../site.config.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(tileMarksFor(config, 'gallery'), TILE_MARK_DEFAULTS, 'the gallery has the defaults');
  assert.deepEqual(tileMarksFor(config, 'home'), {
    ...TILE_MARK_DEFAULTS, size: 8, min: 10, opacity: 60, sale: { ...TILE_MARK_DEFAULTS.sale, tiles: [] },
  }, 'the home page: only a smaller, fainter star');
});

test('tileMarksFor: the home page and the galleries each on their own', () => {
  assert.deepEqual(MARK_PLACES, ['home', 'gallery']);
  const config = { home: { tileMarks: { opacity: 50 } }, gallery: { pageSizes: [12], tileMarks: { sale: { icon: 'tag' } } } };
  assert.deepEqual(tileMarksFor(config, 'home'), { ...TILE_MARK_DEFAULTS, opacity: 50 });
  assert.deepEqual(tileMarksFor(config, 'gallery').sale.icon, 'tag');
  assert.deepEqual(tileMarksFor({}, 'home'), TILE_MARK_DEFAULTS, 'none = the defaults');
  assert.throws(() => tileMarksFor({ home: { tileMarks: { size: 0 } } }, 'home'), /home\.tileMarks\.size/, 'the error names the place');
  assert.throws(() => tileMarksFor({ gallery: { tileMarks: { sale: { colour: 1 } } } }, 'gallery'), /gallery\.tileMarks\.sale: unknown colour/);
  assert.throws(() => tileMarksFor({ tileMarks: {} }, 'home'), /moved to home\.tileMarks and gallery\.tileMarks/, 'the old shared place');
  assert.throws(() => tileMarksFor({}, 'year'), /unknown place/);
  assert.deepEqual(workMarks({ featured: true, onSale: true }, tileMarksFor({ home: { tileMarks: { sale: { tiles: [] } } } }, 'home')).map((m) => m.kind), ['featured'], 'no cart');
});

test('tileMarks: missing values from the defaults, tile sizes in their order', () => {
  assert.deepEqual(tileMarks({ size: 14, sale: { icon: 'tag' } }), { ...TILE_MARK_DEFAULTS, size: 14, sale: { ...TILE_MARK_DEFAULTS.sale, icon: 'tag' } });
  assert.deepEqual(tileMarks({ featured: { tiles: ['l', 's'] } }).featured.tiles, ['s', 'l']);
  assert.deepEqual(tileMarks({ sale: { tiles: [] } }).sale.tiles, [], 'never');
});

test('tileMarks: a bad or unknown value stops the build, naming the place', () => {
  const cases = [
    [{ size: 0 }, /tileMarks\.size/], [{ opacity: 120 }, /tileMarks\.opacity/], [{ min: '12' }, /tileMarks\.min/],
    [{ min: 30, max: 20 }, /tileMarks\.min must be at most max/],
    [{ featured: { corner: 'top' } }, /tileMarks\.featured\.corner/], [{ sale: { icon: 'coin' } }, /tileMarks\.sale\.icon/],
    [{ sale: { tiles: ['xl'] } }, /tileMarks\.sale\.tiles/], [{ sale: { tiles: 'm' } }, /tileMarks\.sale\.tiles/],
    [{ colour: 'red' }, /tileMarks: unknown colour/], [{ featured: { icon: 'cart' } }, /tileMarks\.featured: unknown icon/],
  ];
  for (const [raw, error] of cases) assert.throws(() => tileMarks(raw), error, JSON.stringify(raw));
});

test('workMarks: star, cart or both; a second mark in the same corner goes beside the first', () => {
  const marks = TILE_MARK_DEFAULTS;
  assert.deepEqual(workMarks({ featured: false, onSale: false }, marks), []);
  assert.deepEqual(workMarks({ featured: true, onSale: false }, marks), [{ kind: 'featured', corner: 'tl', tiles: ['s', 'm', 'l'], icon: 'star', beside: false }]);
  assert.deepEqual(workMarks({ featured: false, onSale: true }, marks), [{ kind: 'sale', corner: 'br', tiles: ['m', 'l'], icon: 'cart', beside: false }]);
  assert.deepEqual(workMarks({ featured: true, onSale: true }, marks).map((m) => [m.kind, m.corner, m.beside]), [['featured', 'tl', false], ['sale', 'br', false]]);
  const same = tileMarks({ sale: { corner: 'tl' } });
  assert.deepEqual(workMarks({ featured: true, onSale: true }, same).map((m) => m.beside), [false, true]);
  assert.deepEqual(workMarks({ featured: true, onSale: true }, tileMarks({ featured: { tiles: [] } })).map((m) => m.kind), ['sale'], 'switched off');
});

test('icons: every corner and sale icon has its silhouette', () => {
  assert.deepEqual(MARK_CORNERS, ['tl', 'tr', 'bl', 'br']);
  for (const icon of ['star', ...SALE_ICONS]) assert.match(MARK_ICONS[icon], /currentColor/, icon);
});
