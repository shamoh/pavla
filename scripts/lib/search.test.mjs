import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEARCH_MAX, matchesQuery, normalizeQuery, queryWords, searchKey, searchText } from './search.mjs';

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

test('searchText: title and description as one key, a word may be in either', () => {
  const text = searchText({ title: 'Krmelec', description: 'Na okraji lesa, v lednu.' });
  assert.equal(text, 'krmelec na okraji lesa, v lednu.');
  assert.ok(matchesQuery(text, 'krmelec LESA'));
  assert.equal(searchText({ title: 'Máky' }), 'maky', 'no description');
});
