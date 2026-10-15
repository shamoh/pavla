import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PAGES, FEATURED_ON, NO_COLLECTION, czechOrder,
  countStatuses, matchesFilters, offersOption, statusOptions, yearFilterOptions, pageAfterFilterChange, pageLinks, pageSizeOf, pageSizeToRemember, paginate, rememberedPageSize,
  DEFAULT_TILE_PAGE_SIZES, DEFAULT_TILE_SIZE, TILE_SIZES, TILE_WIDTHS, stepTileSize, tileSizeFromParams, tileSizeToRemember, DEFAULT_VIEW, PAGE_SIZE_STORAGE_KEY, TILE_PAGE_SIZE_STORAGE_KEY, VIEWS, pageSizeStorageKey, viewPageSizes, withView, facetChoices, facetDisplay, viewFromParams, viewToParams, viewToRemember, CARD_IMAGE_SIZES, TILE_PHONE_COLUMNS, viewImageSizes, facetValues, pagingFromParams, pagingToParams, sortTags, stateFromForm, stateFromParams, stateToParams, tagChoices, toggleTag, withPageSize,
} from './gallery-filter.mjs';

const work = (status, extra = {}) => ({ tags: ['krajina'], technique: 'akvarel', year: '2026', collection: '', status, ...extra });
const all = { tag: [], technique: '', year: '', collection: '', status: '', featured: '', q: '' };
const allState = { ...all, page: 1, perPage: null, view: 'grid', tile: 'm' };
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
  const state = { ...all, status: 'unsold', tag: ['krajina'], technique: 'akvarel', year: '2026', collection: 'k' };
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
    { ...allState, tag: ['voda'], year: '2026', collection: 'plener', status: 'unsold' },
  );
  assert.equal(stateFromParams(new URLSearchParams('status=bogus')).status, '');
  assert.equal(stateFromParams(new URLSearchParams('status=available')).status, 'unsold', 'an old shared link still works');
  assert.deepEqual(stateFromParams(new URLSearchParams('')), allState);
});

test('stateToParams leaves out empty filters and round-trips any combination', () => {
  assert.equal(stateToParams(all).toString(), '');
  const state = { tag: ['řeka a mlha'], technique: 'akvarel', year: '2025', collection: 'plener', status: 'gone', featured: '1', q: 'mlha', page: 3, perPage: 48, view: 'tiles', tile: 'l' };
  assert.equal(stateToParams({ ...all, technique: 'akvarel', status: 'kept' }).toString(), 'technique=akvarel&status=kept');
  assert.deepEqual(stateFromParams(new URLSearchParams(stateToParams(state).toString())), state);
});

test('page: read from and written to the URL only when > 1, bad values mean page 1', () => {
  assert.equal(stateFromParams(new URLSearchParams('page=3')).page, 3);
  for (const bad of ['page=0', 'page=-2', 'page=2.5', 'page=abc', '']) assert.equal(stateFromParams(new URLSearchParams(bad)).page, 1, bad);
  assert.equal(stateToParams({ ...allState, page: 1 }).toString(), '');
  assert.equal(stateToParams({ ...allState, tag: ['voda'], page: 2 }).toString(), 'tag=voda&page=2');
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
  assert.equal(stateToParams({ ...allState, tag: ['voda'], page: 'all' }).toString(), 'tag=voda&page=all');
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
  assert.deepEqual(withPageSize({ ...allState, tag: ['voda'], page: 3 }, 24), { ...allState, tag: ['voda'], page: 1, perPage: 24 });
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
  assert.equal(shown({ featured: FEATURED_ON, tag: ['voda'] }), 1);
  assert.equal(shown({ featured: FEATURED_ON, status: 'unsold' }), 1);
  assert.equal(stateToParams({ ...allState, featured: FEATURED_ON }).toString(), 'featured=1');
  assert.equal(stateFromParams(new URLSearchParams('featured=1')).featured, '1');
  assert.equal(stateFromParams(new URLSearchParams('featured=yes')).featured, '', 'only 1 switches it on');
  assert.equal(stateFromParams(new URLSearchParams('')).featured, '');
});

test('offersOption: an option is offered when it shows some works, but not all of them', () => {
  assert.deepEqual([[0, 5], [1, 5], [4, 5], [5, 5], [0, 0]].map(([n, total]) => offersOption(n, total)), [false, true, true, false, false]);
});

test('statusOptions: every option with some works, in order, with counts (offering is up to facetChoices)', () => {
  assert.deepEqual(statusOptions(['available', 'sold', 'not-for-sale', 'not-for-sale']), [
    { value: 'unsold', label: 'na prodej', count: 1 },
    { value: 'kept', label: 'ještě mám', count: 3 },
    { value: 'gone', label: 'už nemám', count: 1 },
  ]);
  assert.deepEqual(statusOptions(['available', 'available']), [
    { value: 'unsold', label: 'na prodej', count: 2 }, { value: 'kept', label: 'ještě mám', count: 2 },
  ], '"už nemám" shows nothing');
  assert.deepEqual(statusOptions([]), [], 'no works');
});

test('yearFilterOptions: the years of the works with counts, newest first, also a single one', () => {
  assert.deepEqual(yearFilterOptions([2025, 2026, 2025, 2025]), [{ value: '2026', count: 1 }, { value: '2025', count: 3 }]);
  assert.deepEqual(yearFilterOptions([2026, 2026]), [{ value: '2026', count: 2 }]);
  assert.deepEqual(yearFilterOptions([]), []);
});

test('facetDisplay: a filter with no option narrowing the shown works is off and shows the common value', () => {
  const off = facetChoices(shelf, { ...all, year: '2026' }, 'technique', ['kresba', 'akvarel']);
  assert.deepEqual(facetDisplay(off), { off: true, common: 1 }, 'both 2026 works are akvarel');
  assert.deepEqual(facetDisplay(facetChoices(shelf, all, 'technique', ['akvarel', 'kresba'])), { off: false, common: -1 });
  const picked = facetChoices(shelf, { ...all, technique: 'akvarel', year: '2026' }, 'technique', ['akvarel', 'kresba']);
  assert.equal(facetDisplay(picked).off, false, 'a picked option keeps the filter on');
  assert.deepEqual(facetDisplay(facetChoices(shelf, all, 'featured', [FEATURED_ON])), { off: false, common: -1 });
  assert.deepEqual(facetDisplay(facetChoices(shelf, { ...all, year: '2026', status: 'gone' }, 'featured', [FEATURED_ON])), { off: true, common: -1 }, 'none featured');
});

test('several tags narrow together: a work must have every picked tag', () => {
  const state = { ...all, tag: ['krajina', 'voda'] };
  assert.ok(matchesFilters(work('sold', { tags: ['krajina', 'voda', 'plenér'] }), state));
  assert.ok(!matchesFilters(work('sold', { tags: ['krajina'] }), state));
  assert.ok(!matchesFilters(work('sold', { tags: ['voda'] }), state));
  assert.ok(matchesFilters(work('sold', { tags: [] }), all), 'no tag picked = every work');
});

test('tags in the URL: one parameter per tag, canonical order, duplicates and empty ones dropped', () => {
  assert.deepEqual(stateFromParams(new URLSearchParams('tag=voda&tag=krajina&tag=voda&tag=')).tag, ['krajina', 'voda']);
  assert.deepEqual(stateFromParams(new URLSearchParams('tag=krajina')).tag, ['krajina'], 'an old link with one tag still works');
  assert.equal(stateToParams({ ...allState, tag: ['krajina', 'voda'], status: 'unsold' }).toString(), 'tag=krajina&tag=voda&status=unsold');
  const state = { ...allState, tag: ['hory', 'chalupa', 'řeka'] };
  assert.deepEqual(stateFromParams(new URLSearchParams(stateToParams(state).toString())), state);
});

test('sortTags: Czech alphabet (ch after h, ř after r), no duplicates', () => {
  assert.deepEqual(sortTags(['řeka', 'chalupa', 'hory', 'rybník', 'hory', '']), ['hory', 'chalupa', 'rybník', 'řeka']);
});

test('toggleTag picks a tag or drops a picked one', () => {
  assert.deepEqual(toggleTag([], 'voda'), ['voda']);
  assert.deepEqual(toggleTag(['voda'], 'krajina'), ['krajina', 'voda']);
  assert.deepEqual(toggleTag(['krajina', 'voda'], 'voda'), ['krajina']);
  assert.deepEqual(toggleTag(['voda'], 'voda'), []);
});

test('tagChoices: counts among the shown works, offers only chips that narrow without emptying', () => {
  const tags = ['krajina', 'voda', 'plenér', 'město'];
  const shown = [['krajina', 'voda'], ['krajina', 'plenér'], ['krajina', 'voda', 'voda']];
  assert.deepEqual(tagChoices(tags, shown, []), [
    { tag: 'krajina', count: 3, picked: false, offered: false }, // on every shown work: picking it changes nothing
    { tag: 'voda', count: 2, picked: false, offered: true },
    { tag: 'plenér', count: 1, picked: false, offered: true },
    { tag: 'město', count: 0, picked: false, offered: false }, // would leave nothing
  ]);
});

test('tagChoices: a picked chip always stays, even with nothing shown', () => {
  const choices = tagChoices(['krajina', 'voda'], [], ['voda']);
  assert.deepEqual(choices.map((c) => [c.tag, c.offered]), [['krajina', false], ['voda', true]]);
  assert.deepEqual(tagChoices(['voda'], [['voda'], ['voda']], ['voda']), [{ tag: 'voda', count: 2, picked: true, offered: true }]);
});

const shelf = [
  { tags: ['voda'], technique: 'akvarel', year: '2026', collection: 'plener', status: 'available', featured: true },
  { tags: ['voda'], technique: 'akvarel', year: '2026', collection: 'plener', status: 'sold', featured: false },
  { tags: ['les'], technique: 'kresba', year: '2025', collection: '', status: 'not-for-sale', featured: false },
  { tags: ['les'], technique: 'akvarel', year: '2025', collection: '', status: 'gifted', featured: true },
];

test('facetValues: the options a work falls under, several status options at once', () => {
  assert.deepEqual(facetValues(shelf[0], 'technique'), ['akvarel']);
  assert.deepEqual(facetValues(shelf[0], 'year'), ['2026']);
  assert.deepEqual(facetValues(shelf[2], 'collection'), [NO_COLLECTION], 'no collection');
  assert.deepEqual(facetValues(shelf[0], 'status'), ['unsold', 'kept']);
  assert.deepEqual(facetValues(shelf[3], 'status'), ['gone']);
  assert.deepEqual(facetValues(shelf[0], 'featured'), [FEATURED_ON]);
  assert.deepEqual(facetValues(shelf[1], 'featured'), []);
});

test('facetChoices: counts with the other filters, not offered when empty or the same as "vše"', () => {
  assert.deepEqual(facetChoices(shelf, all, 'technique', ['akvarel', 'kresba', 'linoryt']), [
    { value: 'akvarel', count: 3, picked: false, offered: true },
    { value: 'kresba', count: 1, picked: false, offered: true },
    { value: 'linoryt', count: 0, picked: false, offered: false },
  ]);
  // with "les" picked only the works of 2025 are left: years narrow nothing any more, techniques still do
  const les = { ...all, tag: ['les'] };
  assert.deepEqual(facetChoices(shelf, les, 'year', ['2026', '2025']).map((c) => [c.value, c.count, c.offered]), [['2026', 0, false], ['2025', 2, false]]);
  assert.deepEqual(facetChoices(shelf, les, 'technique', ['akvarel', 'kresba']).map((c) => [c.count, c.offered]), [[1, true], [1, true]]);
});

test('facetChoices: the filter itself is left out, so the other options of a picked one keep their counts', () => {
  const kresba = { ...all, technique: 'kresba' };
  assert.deepEqual(facetChoices(shelf, kresba, 'technique', ['akvarel', 'kresba']), [
    { value: 'akvarel', count: 3, picked: false, offered: true },
    { value: 'kresba', count: 1, picked: true, offered: true },
  ]);
  // other filters do count: the author's selection with kresba has nothing, but stays while picked
  assert.deepEqual(facetChoices(shelf, { ...kresba, featured: FEATURED_ON }, 'featured', [FEATURED_ON]), [{ value: FEATURED_ON, count: 0, picked: true, offered: true }]);
  assert.deepEqual(facetChoices(shelf, kresba, 'featured', [FEATURED_ON]), [{ value: FEATURED_ON, count: 0, picked: false, offered: false }]);
});

test('facetChoices: status options overlap, each counted on its own', () => {
  assert.deepEqual(facetChoices(shelf, all, 'status', ['unsold', 'kept', 'gone']).map((c) => [c.value, c.count, c.offered]), [
    ['unsold', 1, true], ['kept', 2, true], ['gone', 2, true],
  ]);
  assert.deepEqual(facetChoices(shelf, { ...all, year: '2026' }, 'status', ['unsold', 'kept', 'gone']).map((c) => [c.count, c.offered]), [
    [1, true], [1, true], [1, true],
  ]);
  assert.deepEqual(facetChoices(shelf, { ...all, collection: 'plener' }, 'collection', ['plener']), [{ value: 'plener', count: 2, picked: true, offered: true }]);
});

test('collection filter "žádná": only works in no collection, counted among the options', () => {
  const state = { ...all, collection: NO_COLLECTION };
  assert.ok(matchesFilters(work('sold'), state));
  assert.ok(!matchesFilters(work('sold', { collection: 'plener' }), state));
  assert.deepEqual(facetChoices(shelf, all, 'collection', [NO_COLLECTION, 'plener']).map((c) => [c.value, c.count, c.offered]), [
    [NO_COLLECTION, 2, true], ['plener', 2, true],
  ]);
  // Every shown work is in no collection: "žádná" gives the same as "vše", not offered.
  assert.deepEqual(facetChoices(shelf, { ...all, year: '2025' }, 'collection', [NO_COLLECTION]).map((c) => [c.count, c.offered]), [[2, false]]);
  assert.deepEqual(stateFromParams(new URLSearchParams('collection=none')).collection, NO_COLLECTION);
  assert.equal(stateToParams(state).toString(), 'collection=none');
});

test('stateFromForm: a greyed (off) select shows a shared value, which never becomes a filter', () => {
  // Collection picked: every shown work is from 2000, so the year select is off and shows "2000".
  const state = { ...all, collection: 'tatry' };
  const next = stateFromForm(state, [
    { key: 'collection', value: '', off: false }, // the visitor switched the collection to "vše"
    { key: 'year', value: '2000', off: true },
  ]);
  assert.equal(next.collection, '');
  assert.equal(next.year, '', 'the shown year is not picked');
  assert.deepEqual(stateFromForm(state, [{ key: 'year', value: '2026', off: false }]).year, '2026', 'an active select is read');
  assert.equal(state.collection, 'tatry', 'the state itself is not changed');
});

test('search in titles: ?q= tidied, every word in the title, written back, round-trips with other filters', () => {
  const state = stateFromParams(new URLSearchParams('q=%20%20ranni%20%20MLHA&tag=voda'));
  assert.equal(state.q, 'ranni MLHA');
  assert.ok(matchesFilters(work('sold', { title: 'Ranní mlha u jezu', tags: ['voda'] }), state));
  assert.ok(!matchesFilters(work('sold', { title: 'Ranní slunce', tags: ['voda'] }), state), 'every word must match');
  assert.ok(matchesFilters(work('sold'), all), 'no query: a work without a title passes too');
  assert.ok(matchesFilters(work('sold', { title: 'Krmelec', description: 'Ranní mlha nad lesem.', tags: ['voda'] }), state), 'words found in the description');
  assert.ok(matchesFilters(work('sold', { search: 'ranni mlha', tags: ['voda'] }), state), 'the prepared text of a card');
  assert.equal(stateToParams(state).toString(), 'tag=voda&q=ranni+MLHA');
  assert.deepEqual(stateFromParams(stateToParams(state)), state);
});

test('pagingFromParams / pagingToParams: the paging of any listing', () => {
  assert.deepEqual(pagingFromParams(new URLSearchParams('page=3&perPage=24')), { page: 3, perPage: 24 });
  assert.deepEqual(pagingFromParams(new URLSearchParams('page=all&perPage=12')), { page: 'all', perPage: null }, 'the default size is not kept');
  assert.deepEqual(pagingFromParams(new URLSearchParams('page=-2&perPage=13')), { page: 1, perPage: null });
  assert.equal(pagingToParams(new URLSearchParams('year=2025'), { page: 2, perPage: 48 }).toString(), 'year=2025&page=2&perPage=48');
  assert.equal(pagingToParams(new URLSearchParams(), { page: 1, perPage: null }).toString(), '');
});

test('czechOrder: Czech alphabetical order (ch after h, diacritics), by title or a given name, a new array', () => {
  const items = [{ title: 'Řeky 2021–2023' }, { title: 'Chalupa' }, { title: 'Hory' }, { title: 'Cesty' }, { title: 'Rybníky' }, { title: 'Čápi' }];
  assert.deepEqual(czechOrder(items).map((i) => i.title), ['Cesty', 'Čápi', 'Hory', 'Chalupa', 'Rybníky', 'Řeky 2021–2023']);
  assert.equal(items[0].title, 'Řeky 2021–2023', 'input left as it was');
  const techniques = [['tempera', 1], ['akvarel', 23], ['kresba tužkou', 8], ['kvaš', 4]];
  assert.deepEqual(czechOrder(techniques, ([t]) => t).map(([t]) => t), ['akvarel', 'kresba tužkou', 'kvaš', 'tempera']);
});

test('viewFromParams: tiles from the link, anything else is the default grid', () => {
  assert.deepEqual(VIEWS, ['grid', 'tiles']);
  assert.equal(viewFromParams(new URLSearchParams('view=tiles')), 'tiles');
  for (const q of ['', 'view=grid', 'view=bogus', 'view=']) assert.equal(viewFromParams(new URLSearchParams(q)), DEFAULT_VIEW, q);
  assert.equal(stateFromParams(new URLSearchParams('view=tiles&page=2')).view, 'tiles');
});

test('stateToParams writes only the tiles view and round-trips it with filters and paging', () => {
  assert.equal(stateToParams({ ...allState, view: 'grid' }).toString(), '');
  const state = { ...allState, tag: ['les'], page: 2, perPage: 24, view: 'tiles' };
  assert.equal(stateToParams(state).toString(), 'tag=les&page=2&perPage=24&view=tiles');
  assert.deepEqual(stateFromParams(new URLSearchParams(stateToParams(state).toString()), [12, 24, 48]), state);
});

const SIZES = { grid: [12, 24, 48], tiles: [36, 72, 144] };

test('viewPageSizes and pageSizeStorageKey: each view its own page sizes and memory', () => {
  assert.deepEqual(DEFAULT_TILE_PAGE_SIZES, [36, 72, 144]);
  assert.deepEqual(viewPageSizes('grid', SIZES), [12, 24, 48]);
  assert.deepEqual(viewPageSizes('tiles', SIZES), [36, 72, 144]);
  assert.equal(pageSizeStorageKey('grid'), PAGE_SIZE_STORAGE_KEY);
  assert.equal(pageSizeStorageKey('tiles'), TILE_PAGE_SIZE_STORAGE_KEY);
  assert.notEqual(PAGE_SIZE_STORAGE_KEY, TILE_PAGE_SIZE_STORAGE_KEY);
});

test('stateFromParams checks perPage against the sizes of the view it is given', () => {
  assert.equal(stateFromParams(new URLSearchParams('view=tiles&perPage=72'), SIZES.tiles).perPage, 72);
  assert.equal(stateFromParams(new URLSearchParams('view=tiles&perPage=24'), SIZES.tiles).perPage, null, 'a size of the other view is ignored');
  assert.equal(stateFromParams(new URLSearchParams('view=tiles&perPage=36'), SIZES.tiles).perPage, null, 'the default is not stored');
});

test('withView: its own page size (remembered or default), the page with the first shown work, "all" stays', () => {
  const grid = { ...allState, page: 4 };
  // grid page 4 of 12 starts at work 36 = tiles page 2 of 36
  assert.deepEqual(withView(grid, 'tiles', SIZES), { ...grid, view: 'tiles', perPage: null, page: 2 });
  assert.deepEqual(withView(grid, 'tiles', SIZES, '72'), { ...grid, view: 'tiles', perPage: 72, page: 1 });
  assert.deepEqual(withView(grid, 'tiles', SIZES, '24'), { ...grid, view: 'tiles', perPage: null, page: 2 }, 'a grid size is no tiles size');
  // tiles page 3 of 36 starts at work 72 = grid page 4 of 24
  const tiles = { ...allState, view: 'tiles', page: 3 };
  assert.deepEqual(withView(tiles, 'grid', SIZES, '24'), { ...tiles, view: 'grid', perPage: 24, page: 4 });
  assert.equal(withView({ ...grid, page: ALL_PAGES }, 'tiles', SIZES).page, ALL_PAGES);
  assert.equal(withView({ ...grid, page: 1 }, 'tiles', SIZES).page, 1);
  assert.equal(withView(grid, 'bogus', SIZES), grid);
});

test('tile size: from the link, in the URL only with tiles and not the default', () => {
  assert.deepEqual(TILE_SIZES, ['s', 'm', 'l']);
  assert.equal(DEFAULT_TILE_SIZE, 'm');
  assert.ok(TILE_SIZES.every((t) => TILE_WIDTHS[t] > 0) && TILE_WIDTHS.s < TILE_WIDTHS.m && TILE_WIDTHS.m < TILE_WIDTHS.l);
  assert.equal(tileSizeFromParams(new URLSearchParams('tile=s')), 's');
  for (const q of ['', 'tile=xl', 'tile=']) assert.equal(tileSizeFromParams(new URLSearchParams(q)), 'm', q);
  assert.equal(stateToParams({ ...allState, view: 'tiles', tile: 's' }).toString(), 'view=tiles&tile=s');
  assert.equal(stateToParams({ ...allState, view: 'tiles', tile: 'm' }).toString(), 'view=tiles');
  assert.equal(stateToParams({ ...allState, view: 'grid', tile: 's' }).toString(), '', 'no tile size with big pictures');
  const state = { ...allState, view: 'tiles', tile: 's' };
  assert.deepEqual(stateFromParams(new URLSearchParams(stateToParams(state).toString())), state);
});

test('tile size: what to remember; stepping stops at either end', () => {
  assert.equal(tileSizeToRemember('s'), 's');
  assert.equal(tileSizeToRemember('m'), null);
  assert.equal(tileSizeToRemember('xl'), null);
  assert.equal(stepTileSize('m', -1), 's');
  assert.equal(stepTileSize('m', 1), 'l');
  assert.equal(stepTileSize('s', -1), 's');
  assert.equal(stepTileSize('l', 1), 'l');
  assert.equal(stepTileSize('bogus', 1), 'l');
});

test('views with another default (the home page): the default never goes into the URL nor the memory', () => {
  assert.equal(viewFromParams(new URLSearchParams(''), 'tiles'), 'tiles');
  assert.equal(viewFromParams(new URLSearchParams('view=grid'), 'tiles'), 'grid');
  assert.equal(viewToParams(new URLSearchParams(), { view: 'tiles', tile: 'm' }, 'tiles').toString(), '');
  assert.equal(viewToParams(new URLSearchParams(), { view: 'grid', tile: 'm' }, 'tiles').toString(), 'view=grid');
  assert.equal(viewToParams(new URLSearchParams(), { view: 'tiles', tile: 'l' }, 'tiles').toString(), 'tile=l');
  assert.equal(viewToParams(new URLSearchParams(), { view: 'tiles', tile: 'l' }).toString(), 'view=tiles&tile=l');
  assert.equal(viewToRemember('grid', 'tiles'), 'grid');
  assert.equal(viewToRemember('tiles', 'tiles'), null);
});

test('viewImageSizes: big pictures as the card, tiles by the column width and phone columns', () => {
  assert.equal(viewImageSizes('grid'), CARD_IMAGE_SIZES);
  assert.equal(viewImageSizes('grid', 's'), CARD_IMAGE_SIZES);
  assert.equal(viewImageSizes('tiles', 'm'), `(max-width: 640px) 34vw, ${Math.round(TILE_WIDTHS.m * 1.2)}px`);
  assert.equal(viewImageSizes('tiles', 's'), '(max-width: 640px) 25vw, 132px');
  assert.equal(viewImageSizes('tiles', 'l'), '(max-width: 640px) 50vw, 252px');
  assert.equal(viewImageSizes('tiles', 'xl'), viewImageSizes('tiles', 'm'));
  assert.deepEqual(Object.keys(TILE_PHONE_COLUMNS), TILE_SIZES);
});
