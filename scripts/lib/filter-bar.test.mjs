import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAR_START, HIDE_AFTER, REVEAL_AFTER, activeFilters, filteredCount, scrollBar, withoutFilter, withoutFilters, worksCount } from './filter-bar.mjs';

const none = { tag: [], technique: '', year: '', collection: '', status: '', featured: '', q: '' };
const label = (key, value) => ({ collection: { 'demo-mesto': 'Město 2026' }, status: { unsold: 'na prodej' } }[key]?.[value] ?? value);

test('activeFilters: tags first, then the selects in form order, the author\'s selection, the search last', () => {
  assert.deepEqual(activeFilters(none, label), []);
  const state = { tag: ['krajina', 'voda'], technique: 'akvarel', year: '2026', collection: 'demo-mesto', status: 'unsold', featured: '1', q: 'ranní mlha' };
  assert.deepEqual(activeFilters(state, label), [
    { key: 'tag', value: 'krajina', text: '#krajina' },
    { key: 'tag', value: 'voda', text: '#voda' },
    { key: 'technique', value: 'akvarel', text: 'akvarel' },
    { key: 'year', value: '2026', text: '2026' },
    { key: 'collection', value: 'demo-mesto', text: 'Město 2026' },
    { key: 'status', value: 'unsold', text: 'na prodej' },
    { key: 'featured', value: '1', text: 'doporučené' },
    { key: 'q', value: 'ranní mlha', text: '„ranní mlha“' },
  ]);
});

test('withoutFilter: the "×" of a chip turns just that filter off, back to the first page', () => {
  const state = { ...none, tag: ['krajina', 'voda'], technique: 'akvarel', featured: '1', page: 3, perPage: 24 };
  assert.deepEqual(withoutFilter(state, { key: 'tag', value: 'krajina' }), { ...state, tag: ['voda'], page: 1 });
  assert.deepEqual(withoutFilter(state, { key: 'technique', value: 'akvarel' }), { ...state, technique: '', page: 1 });
  assert.deepEqual(withoutFilter(state, { key: 'featured', value: '1' }), { ...state, featured: '', page: 1 });
  assert.deepEqual(withoutFilter({ ...state, q: 'mlha' }, { key: 'q', value: 'mlha' }), { ...state, q: '', page: 1 }, 'the search too');
  assert.equal(withoutFilter({ ...state, page: 'all' }, { key: 'tag', value: 'voda' }).page, 'all', 'paging stays off');
});

test('worksCount: the number of works with the right noun', () => {
  assert.deepEqual([0, 1, 3, 6].map(worksCount), ['0 děl', '1 dílo', '3 díla', '6 děl']);
});

/** The bar after scrolling through `ys` with the form off screen. */
const run = (ys, start = BAR_START, form = false) => ys.reduce((s, y) => scrollBar(s, y, form), start);

test('scrollBar: slides in only after scrolling up far enough since the turn', () => {
  const down = run([500, 1000, 1500]);
  assert.equal(down.visible, false);
  assert.equal(run([1500 - REVEAL_AFTER + 1], down).visible, false, 'a small move up is no reason');
  assert.equal(run([1490, 1480, 1500 - REVEAL_AFTER], down).visible, true, 'step by step adds up');
});

test('scrollBar: slides away after scrolling down a little, a tiny jitter keeps it', () => {
  const shown = run([1000, 900]);
  assert.equal(shown.visible, true);
  assert.equal(run([900 + HIDE_AFTER - 1], shown).visible, true);
  assert.equal(run([900 + HIDE_AFTER], shown).visible, false);
});

test('scrollBar: never while the filter form is on screen; the same position changes nothing else', () => {
  const shown = run([1000, 900]);
  assert.equal(scrollBar(shown, 800, true).visible, false);
  assert.equal(run([200, 100], BAR_START, true).visible, false);
  assert.deepEqual(scrollBar(shown, 900, false), shown);
  assert.equal(scrollBar(shown, 900, true).visible, false);
});

test('withoutFilters: every filter off, back to page 1; view, tile size, page size and "Zobrazit vše" stay', () => {
  const state = {
    tag: ['krajina', 'voda'], technique: 'akvarel', year: '2026', collection: 'demo-mesto', status: 'unsold', featured: '1', q: 'mlha',
    page: 3, perPage: 24, view: 'tiles', tile: 's',
  };
  assert.deepEqual(withoutFilters(state), { ...none, page: 1, perPage: 24, view: 'tiles', tile: 's' });
  assert.equal(withoutFilters({ ...state, page: 'all' }).page, 'all');
  assert.deepEqual(activeFilters(withoutFilters(state), label), [], 'nothing left for the bar');
  assert.deepEqual(withoutFilters({ ...none, page: 1 }), { ...none, page: 1 }, 'nothing to cancel: the same state');
});

test('filteredCount: the total without a filter, "shown z total" with one', () => {
  assert.equal(filteredCount(58, 58, false), '58 děl');
  assert.equal(filteredCount(12, 58, true), '12 z 58 děl');
  assert.equal(filteredCount(0, 58, true), '0 z 58 děl');
  assert.equal(filteredCount(1, 1, true), '1 z 1 díla');
  assert.equal(filteredCount(3, 3, false), '3 díla');
});
