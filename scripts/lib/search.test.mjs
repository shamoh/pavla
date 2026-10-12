import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEARCH_MAX, exactId, matchesQuery, normalizeQuery, queryWords, searchKey, searchText } from './search.mjs';

test('searchKey: lower case without diacritics', () => {
  assert.equal(searchKey('Plenér Štěkeň 2025'), 'plener steken 2025');
  assert.equal(searchKey(undefined), '');
});

test('normalizeQuery: spaces collapsed and trimmed, cut to SEARCH_MAX', () => {
  assert.equal(normalizeQuery('  ranní   mlha '), 'ranní mlha');
  assert.equal(normalizeQuery(null), '');
  assert.equal(normalizeQuery('x'.repeat(SEARCH_MAX + 5)).length, SEARCH_MAX);
});

test('queryWords: the words to look for, [] for no query', () => {
  assert.deepEqual(queryWords(' Ráno  U '), ['rano', 'u']);
  assert.deepEqual(queryWords('   '), []);
});

test('matchesQuery: every word a substring, any case and diacritics, never a regular expression', () => {
  assert.ok(matchesQuery('Plenér Štěkeň 2025', 'stek'));
  assert.ok(matchesQuery('Plenér Štěkeň 2025', '2025 PLENER'), 'words in any order');
  assert.ok(!matchesQuery('Plenér Štěkeň 2025', 'stek sumava'), 'all words must match');
  assert.ok(matchesQuery('Ráno u rybníka', ''), 'no query = everything');
  assert.ok(!matchesQuery('Ráno u rybníka', '.*'), 'no regular expressions');
  assert.ok(matchesQuery('Kresby, pastely a kvaš (2025)', 'kvas (2025)'), 'brackets are just characters');
});

test('searchText: a work is found by its id (as in the Instagram post text)', () => {
  assert.equal(matchesQuery(searchText({ id: 'jujn2', title: 'Bobří hráz' }), 'jujn2'), true);
  assert.equal(matchesQuery(searchText({ id: 'jujn2', title: 'Bobří hráz' }), 'JUJN2'), true, 'whatever the case');
  assert.equal(matchesQuery(searchText({ slug: 'plener', title: 'Plenér' }), 'jujn2'), false);
});

test('exactId: only the whole id of a shown work, alone, whatever the case and spaces', () => {
  const ids = ['jujn2', 'df9aa'];
  assert.equal(exactId('jujn2', ids), 'jujn2');
  assert.equal(exactId('  JUJN2 ', ids), 'jujn2');
  assert.equal(exactId('jujn', ids), null, 'a part of an id');
  assert.equal(exactId('jujn2x', ids), null);
  assert.equal(exactId('jujn2 most', ids), null, 'an id among other words');
  assert.equal(exactId('rk9ct', ids), null, 'an id of a work not shown');
  assert.equal(exactId('', ids), null);
});

test('searchText: title and description as one key, a word may be in either', () => {
  const text = searchText({ title: 'Krmelec', description: 'Na okraji lesa, v lednu.' });
  assert.equal(text, 'krmelec na okraji lesa, v lednu.');
  assert.ok(matchesQuery(text, 'krmelec LESA'));
  assert.equal(searchText({ title: 'Máky' }), 'maky', 'no description');
});
