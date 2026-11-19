import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID_ALPHABET, ID_FIRST } from './works.mjs';
import {
  FAVORITE_SOURCES, OVER_LINK_TITLE, SELECTION_PATH, favoriteEventParams, favoriteLabel, favoritesLinkState, favoritesOpenParams, worksWord,
  FAVORITES_LINK_MAX, SELECTION_PARAM, isFavoriteId, ownSelection, readFavorites, selectionFromSearch, selectionLink, shownFavorites, toggleFavorite,
} from './favorites.mjs';

test('an id of a work: the alphabet of works.mjs, five characters, a letter first', () => {
  for (const id of ['a2345', 'zzzzz', 'k9m3p']) assert.equal(isFavoriteId(id), true, id);
  for (const id of ['2abcd', 'abcd', 'abcdef', 'abc1d', 'Abcde', 'e2345', '', null, 12345]) assert.equal(isFavoriteId(id), false, String(id));
  // the same alphabet as the ids of works (copied into the function, it has to stay self-contained)
  for (const c of ID_FIRST) assert.equal(isFavoriteId(`${c}2222`), true, c);
  for (const c of ID_ALPHABET) assert.equal(isFavoriteId(`a222${c}`), true, c);
});

test('the kept favourites: valid ids once each, broken text = none', () => {
  assert.deepEqual(readFavorites('["a2345","b2345","a2345","nope",3]'), ['a2345', 'b2345']);
  assert.deepEqual(readFavorites(null), []);
  assert.deepEqual(readFavorites('{"a":1}'), []);
  assert.deepEqual(readFavorites('not json'), []);
});

test('a heart adds a work at the end and a second click removes it', () => {
  const first = toggleFavorite(['a2345'], 'b2345');
  assert.deepEqual(first, { list: ['a2345', 'b2345'], added: true });
  assert.deepEqual(toggleFavorite(first.list, 'a2345'), { list: ['b2345'], added: false });
});

test('the favourites of a gallery: in the order of the shown works, others left out', () => {
  assert.deepEqual(shownFavorites(['c2345', 'a2345', 'x2345'], ['a2345', 'b2345', 'c2345']), ['a2345', 'c2345']);
  assert.deepEqual(shownFavorites([], ['a2345']), []);
});

test('the link to "Můj výběr": none without favourites or with too many for an address', () => {
  const options = { page: '/tvorba/vyber/', param: SELECTION_PARAM, max: FAVORITES_LINK_MAX };
  assert.equal(selectionLink(['a2345', 'b2345'], options), '/tvorba/vyber/?obrazy=a2345,b2345');
  assert.equal(selectionLink([], options), null);
  const most = Array.from({ length: FAVORITES_LINK_MAX }, (_, i) => `a${String(i).padStart(4, '2')}`);
  const link = selectionLink(most, options);
  assert.ok(link && link.length < 2000, 'the longest link stays short enough to send on');
  assert.equal(selectionLink([...most, 'b2345'], options), null);
});

test('"Můj výběr" from its address: known works once each, the rest left out', () => {
  const knownIds = ['a2345', 'b2345', 'c2345'];
  assert.deepEqual(selectionFromSearch('?obrazy=b2345,%20a2345,b2345,zzzzz,,', { param: SELECTION_PARAM, knownIds }), ['b2345', 'a2345']);
  assert.deepEqual(selectionFromSearch('?jine=a2345', { param: SELECTION_PARAM, knownIds }), []);
});

test('an own selection: every work of it is liked here', () => {
  assert.equal(ownSelection(['a2345', 'b2345'], ['b2345', 'a2345', 'c2345']), true);
  assert.equal(ownSelection(['a2345', 'd2345'], ['a2345']), false);
  assert.equal(ownSelection([], ['a2345']), false);
});

test('"♥ Moje oblíbené" of a gallery: nothing, a link, or a grey count over the cap', () => {
  const options = { page: SELECTION_PATH, param: SELECTION_PARAM, max: 2 };
  assert.deepEqual(favoritesLinkState([], options), { kind: 'none', count: 0, href: null });
  assert.deepEqual(favoritesLinkState(['a2345', 'b2345'], options), { kind: 'link', count: 2, href: '/tvorba/vyber/?obrazy=a2345,b2345' });
  assert.deepEqual(favoritesLinkState(['a2345', 'b2345', 'c2345'], options), { kind: 'over', count: 3, href: null });
  assert.match(OVER_LINK_TITLE, /Zužte filtr/);
});

test('the label of a heart says what a click does', () => {
  assert.equal(favoriteLabel(false), 'Přidat do oblíbených');
  assert.equal(favoriteLabel(true), 'Odebrat z oblíbených');
});

test('"N obrazů" in Czech', () => {
  assert.deepEqual([1, 2, 4, 5, 11, 22].map(worksWord), ['1 obraz', '2 obrazy', '4 obrazy', '5 obrazů', '11 obrazů', '22 obrazů']);
});

test('the events of the favourites: the work and its place; "Můj výběr" with its count and whether it is own', () => {
  assert.deepEqual(favoriteEventParams({ workId: 'a2345', workTitle: 'Buky', source: 'gallery' }), { work_id: 'a2345', work_title: 'Buky', source: 'gallery' });
  assert.deepEqual(favoriteEventParams({ workId: 'a2345', source: 'cinema' }), { work_id: 'a2345', work_title: '', source: 'cinema' });
  assert.deepEqual(favoritesOpenParams(['a2345'], ['a2345']), { results: 1, own: 'yes' });
  assert.deepEqual(favoritesOpenParams(['a2345', 'b2345'], ['a2345']), { results: 2, own: 'no' });
  assert.deepEqual(FAVORITE_SOURCES, ['gallery', 'home', 'selection', 'work', 'cinema']);
});
