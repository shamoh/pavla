import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURED_ON,
  countStatuses, matchesFilters, offersOption, statusOptions, pageAfterFilterChange, pageLinks, pageSizeOf, pageSizeToRemember, paginate, rememberedPageSize,
  stateFromParams, stateToParams, withPageSize,
} from './gallery-filter.mjs';

const work = (status, extra = {}) => ({ tags: ['krajina'], technique: 'akvarel', year: '2026', collection: '', status, ...extra });
const all = { tag: '', technique: '', year: '', collection: '', status: '', featured: '' };
const allState = { ...all, page: 1, perPage: null };
const statuses = ['available', 'reserved', 'sold', 'gifted', 'not-for-sale'];
const passing = (state) => statuses.filter((s) => matchesFilters(work(s), { ...all, ...state }));

test('no active filter shows every work', () => {
  assert.deepEqual(passing({}), statuses);
});

test('status "unsold" (na prodej) shows works for sale that are not sold, never not-for-sale or gifted', () => {
  assert.deepEqual(passing({ status: 'unsold' }), ['available', 'reserved']);
});

test('status "kept" (ještě mám) shows all but sold and gifted, "gone" (už nemám) just those', () => {
  assert.deepEqual(passing({ status: 'kept' }), ['available', 'reserved', 'not-for-sale']);
  assert.deepEqual(passing({ status: 'gone' }), ['sold', 'gifted']);
});

test('collection filter shows only works of that collection', () => {
  const state = { ...all, collection: 'plener-sumava' };
  assert.ok(matchesFilters(work('sold', { collection: 'plener-sumava' }), state));
  assert.ok(!matchesFilters(work('sold', { collection: 'jine' }), state));
  assert.ok(!matchesFilters(work('sold'), state));
});

test('every filter combines with the others', () => {
  const state = { ...all, status: 'unsold', tag: 'krajina', technique: 'akvarel', year: '2026', collection: 'k' };
  const base = { collection: 'k' };
  assert.ok(matchesFilters(work('reserved', base), state));
  assert.ok(!matchesFilters(work('sold', base), state));
  assert.ok(!matchesFilters(work('reserved', { ...base, tags: ['kvetiny'] }), state));
  assert.ok(!matchesFilters(work('reserved', { ...base, technique: 'kresba' }), state));
  assert.ok(!matchesFilters(work('reserved', { ...base, year: '2025' }), state));
  assert.ok(!matchesFilters(work('reserved', { collection: 'jina' }), state));
});

test('countStatuses counts works per status option', () => {
  assert.deepEqual(countStatuses(['available', 'reserved', 'sold', 'gifted', 'not-for-sale', 'available']), { unsold: 3, kept: 4, gone: 2 });
  assert.deepEqual(countStatuses([]), { unsold: 0, kept: 0, gone: 0 });
});

test('stateFromParams reads every filter and drops an unknown status', () => {
  assert.deepEqual(
    stateFromParams(new URLSearchParams('tag=voda&year=2026&collection=plener&status=unsold')),
    { ...allState, tag: 'voda', year: '2026', collection: 'plener', status: 'unsold' },
  );
  assert.equal(stateFromParams(new URLSearchParams('status=bogus')).status, '');
  assert.equal(stateFromParams(new URLSearchParams('status=available')).status, 'unsold', 'an old shared link still works');
  assert.deepEqual(stateFromParams(new URLSearchParams('')), allState);
});

test('stateToParams leaves out empty filters and round-trips any combination', () => {
  assert.equal(stateToParams(all).toString(), '');
  const state = { tag: 'řeka a mlha', technique: 'akvarel', year: '2025', collection: 'plener', status: 'gone', featured: '1', page: 3, perPage: 48 };
  assert.equal(stateToParams({ ...all, technique: 'akvarel', status: 'kept' }).toString(), 'technique=akvarel&status=kept');
  assert.deepEqual(stateFromParams(new URLSearchParams(stateToParams(state).toString())), state);
});

test('page: read from and written to the URL only when > 1, bad values mean page 1', () => {
  assert.equal(stateFromParams(new URLSearchParams('page=3')).page, 3);
  for (const bad of ['page=0', 'page=-2', 'page=2.5', 'page=abc', '']) assert.equal(stateFromParams(new URLSearchParams(bad)).page, 1, bad);
  assert.equal(stateToParams({ ...allState, page: 1 }).toString(), '');
  assert.equal(stateToParams({ ...allState, tag: 'voda', page: 2 }).toString(), 'tag=voda&page=2');
});

test('paginate splits items into pages and clamps the page', () => {
  assert.deepEqual(paginate(30, 1, 12), { page: 1, pages: 3, start: 0, end: 12 });
  assert.deepEqual(paginate(30, 3, 12), { page: 3, pages: 3, start: 24, end: 30 });
  assert.deepEqual(paginate(30, 9, 12), { page: 3, pages: 3, start: 24, end: 30 });
  assert.deepEqual(paginate(12, 2, 12), { page: 1, pages: 1, start: 0, end: 12 });
  // nothing matches the filters: one empty page
  assert.deepEqual(paginate(0, 4, 12), { page: 1, pages: 1, start: 0, end: 0 });
});

test('pageLinks shows first, last and the neighbours of the current page with gaps', () => {
  assert.deepEqual(pageLinks(1, 1), [1]);
  assert.deepEqual(pageLinks(2, 3), [1, 2, 3]);
  assert.deepEqual(pageLinks(6, 12), [1, null, 5, 6, 7, null, 12]);
  assert.deepEqual(pageLinks(1, 12), [1, 2, null, 12]);
  assert.deepEqual(pageLinks(12, 12), [1, null, 11, 12]);
  assert.deepEqual(pageLinks(3, 12), [1, 2, 3, 4, null, 12]);
});

test('paging off: page=all is read, written and round-trips with filters', () => {
  assert.equal(stateFromParams(new URLSearchParams('page=all')).page, 'all');
  assert.equal(stateFromParams(new URLSearchParams('page=ALL')).page, 1);
  assert.equal(stateToParams({ ...allState, tag: 'voda', page: 'all' }).toString(), 'tag=voda&page=all');
  const state = { ...allState, collection: 'plener', status: 'unsold', page: 'all' };
  assert.deepEqual(stateFromParams(stateToParams(state)), state);
});

test('paging off: paginate returns every item, pages still tells how many pages there would be', () => {
  assert.deepEqual(paginate(30, 'all', 12), { page: 'all', pages: 3, start: 0, end: 30 });
  assert.deepEqual(paginate(0, 'all', 12), { page: 'all', pages: 1, start: 0, end: 0 });
});

test('a filter change goes back to page 1, but keeps paging off', () => {
  assert.equal(pageAfterFilterChange(3), 1);
  assert.equal(pageAfterFilterChange(1), 1);
  assert.equal(pageAfterFilterChange('all'), 'all');
});

test('perPage: only offered sizes, the default is never written to the URL', () => {
  assert.equal(stateFromParams(new URLSearchParams('perPage=24')).perPage, 24);
  assert.equal(stateFromParams(new URLSearchParams('perPage=48')).perPage, 48);
  for (const bad of ['perPage=12', 'perPage=13', 'perPage=abc', 'perPage=1000', '']) {
    assert.equal(stateFromParams(new URLSearchParams(bad)).perPage, null, bad);
  }
  assert.equal(stateToParams({ ...allState, perPage: 24, page: 2 }).toString(), 'page=2&perPage=24');
  // other offered sizes come from the site config
  assert.equal(stateFromParams(new URLSearchParams('perPage=6'), [9, 6]).perPage, 6);
  assert.equal(stateFromParams(new URLSearchParams('perPage=24'), [9, 6]).perPage, null);
});

test('pageSizeOf and withPageSize: picking a size goes to page 1 with paging on', () => {
  assert.equal(pageSizeOf(allState), 12);
  assert.equal(pageSizeOf({ ...allState, perPage: 48 }), 48);
  assert.deepEqual(withPageSize({ ...allState, tag: 'voda', page: 3 }, 24), { ...allState, tag: 'voda', page: 1, perPage: 24 });
  assert.deepEqual(withPageSize({ ...allState, page: 'all', perPage: 48 }, 12), { ...allState, page: 1, perPage: null });
  assert.equal(withPageSize(allState, 7).perPage, null);
});

test('rememberedPageSize applies a remembered size only when the link does not decide', () => {
  const q = (s) => new URLSearchParams(s);
  assert.equal(rememberedPageSize(q(''), '24'), 24);
  assert.equal(rememberedPageSize(q('tag=voda&status=unsold'), '48'), 48);
  // the link decides: explicit size or page (page 2 must show the same works to everyone)
  assert.equal(rememberedPageSize(q('perPage=48'), '24'), null);
  assert.equal(rememberedPageSize(q('page=2'), '24'), null);
  assert.equal(rememberedPageSize(q('page=all'), '24'), null);
  // nothing, the default or garbage remembered
  for (const stored of [null, '', '12', '13', 'abc']) assert.equal(rememberedPageSize(q(''), stored), null, String(stored));
  // sizes come from the site config
  assert.equal(rememberedPageSize(q(''), '6', [9, 6]), 6);
});

test('pageSizeToRemember forgets the default size', () => {
  assert.equal(pageSizeToRemember(24), '24');
  assert.equal(pageSizeToRemember(12), null);
  assert.equal(pageSizeToRemember(7), null);
});

test('author\'s selection: only featured works, combines with other filters, ?featured=1 in the URL', () => {
  const works = [
    { tags: ['voda'], technique: 'akvarel', year: '2026', collection: 'plener', status: 'available', featured: true },
    { tags: ['voda'], technique: 'akvarel', year: '2026', collection: 'plener', status: 'sold', featured: false },
    { tags: ['les'], technique: 'kresba', year: '2025', collection: '', status: 'not-for-sale', featured: true },
  ];
  const shown = (state) => works.filter((w) => matchesFilters(w, { ...all, ...state })).length;
  assert.equal(shown({}), 3);
  assert.equal(shown({ featured: FEATURED_ON }), 2);
  assert.equal(shown({ featured: FEATURED_ON, tag: 'voda' }), 1);
  assert.equal(shown({ featured: FEATURED_ON, status: 'unsold' }), 1);
  assert.equal(stateToParams({ ...allState, featured: FEATURED_ON }).toString(), 'featured=1');
  assert.equal(stateFromParams(new URLSearchParams('featured=1')).featured, '1');
  assert.equal(stateFromParams(new URLSearchParams('featured=yes')).featured, '', 'only 1 switches it on');
  assert.equal(stateFromParams(new URLSearchParams('')).featured, '');
});

test('offersOption: an option is offered when it shows some works, but not all of them', () => {
  assert.deepEqual([[0, 5], [1, 5], [4, 5], [5, 5], [0, 0]].map(([n, total]) => offersOption(n, total)), [false, true, true, false, false]);
});

test('statusOptions offers only options showing something other than "vše", in order, with counts', () => {
  assert.deepEqual(statusOptions(['available', 'sold', 'not-for-sale', 'not-for-sale']), [
    { value: 'unsold', label: 'na prodej', count: 1 },
    { value: 'kept', label: 'ještě mám', count: 3 },
    { value: 'gone', label: 'už nemám', count: 1 },
  ]);
  assert.deepEqual(statusOptions(['available', 'not-for-sale', 'not-for-sale']), [{ value: 'unsold', label: 'na prodej', count: 1 }],
    'nothing gone: "ještě mám" is the same as "vše", "už nemám" shows nothing');
  assert.deepEqual(statusOptions(['sold', 'gifted']), [], 'everything gone: "už nemám" = "vše"');
  assert.deepEqual(statusOptions([]), [], 'no works, no status filter');
});
