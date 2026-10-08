import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectionLink, encodeYearCounts, matchesYear, overviewLink, parseYearCounts, worksLabel, worksPlural, yearCounts,
  yearFromParams, yearOptions, yearToParams,
} from './collection-filter.mjs';

test('yearCounts: works per year, newest first', () => {
  assert.deepEqual(yearCounts([{ year: 2025 }, { year: 2026 }, { year: 2025 }]), [[2026, 1], [2025, 2]]);
  assert.deepEqual(yearCounts([]), []);
});

test('encodeYearCounts and parseYearCounts are inverse', () => {
  const counts = [[2026, 2], [2025, 3]];
  assert.equal(encodeYearCounts(counts), '2026:2|2025:3');
  assert.deepEqual(parseYearCounts('2026:2|2025:3'), counts);
  assert.deepEqual(parseYearCounts(encodeYearCounts([])), []);
});

test('yearOptions counts collections per year, newest first', () => {
  assert.deepEqual(yearOptions([[2026, 2025], [2025], [2024], [2025]]), [
    { year: 2026, count: 1 },
    { year: 2025, count: 3 },
    { year: 2024, count: 1 },
  ]);
});

test('yearOptions leaves out a year with all collections, the same as "Vše"', () => {
  assert.deepEqual(yearOptions([[2026, 2025], [2026]]), [{ year: 2025, count: 1 }]);
  assert.deepEqual(yearOptions([[2026], [2026]]), []);
  assert.deepEqual(yearOptions([[2026, 2025]]), []);
  assert.deepEqual(yearOptions([]), []);
});

test('yearOptions counts a collection once per year', () => {
  assert.deepEqual(yearOptions([[2025, 2025], [2026]]), [{ year: 2026, count: 1 }, { year: 2025, count: 1 }]);
});

test('yearFromParams accepts only an offered year', () => {
  const offered = [2026, 2025];
  assert.equal(yearFromParams(new URLSearchParams('year=2025'), offered), '2025');
  assert.equal(yearFromParams(new URLSearchParams('year=2019'), offered), '');
  assert.equal(yearFromParams(new URLSearchParams('year=abc'), offered), '');
  assert.equal(yearFromParams(new URLSearchParams(''), offered), '');
  assert.equal(yearFromParams(new URLSearchParams('year=2025'), []), '');
});

test('yearToParams writes only a picked year', () => {
  assert.equal(yearToParams('2025').toString(), 'year=2025');
  assert.equal(yearToParams('').toString(), '');
});

test('matchesYear: a collection with a work of the year, every collection without a year', () => {
  assert.equal(matchesYear(['2026', '2025'], '2025'), true);
  assert.equal(matchesYear([2026], '2025'), false);
  assert.equal(matchesYear([2026], 2026), true);
  assert.equal(matchesYear([2026], ''), true);
  assert.equal(matchesYear([], ''), true);
});

test('worksPlural: dílo, díla, děl', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 12].map(worksPlural), ['děl', 'dílo', 'díla', 'díla', 'děl', 'děl']);
});

test('worksLabel: all works, or those of the picked year of all', () => {
  assert.equal(worksLabel(5, 5), '5 děl');
  assert.equal(worksLabel(1, 1), '1 dílo');
  assert.equal(worksLabel(3, 3), '3 díla');
  assert.equal(worksLabel(2, 5), '2 z 5 děl');
  assert.equal(worksLabel(1, 2), '1 z 2 děl');
});

test('collectionLink carries the year only when it narrows the collection', () => {
  const href = '/tvorba/kolekce/kresby/';
  assert.equal(collectionLink(href, '2025', 3, 4), '/tvorba/kolekce/kresby/?year=2025');
  assert.equal(collectionLink(href, '2026', 4, 4), href);
  assert.equal(collectionLink(href, '', 4, 4), href);
  assert.equal(collectionLink('/tvorba/?collection=none', '2019', 1, 12), '/tvorba/?collection=none&year=2019', 'a link with a query');
});

test('overviewLink filters the overview only to an offered year', () => {
  const href = '/tvorba/kolekce/';
  assert.equal(overviewLink(href, 2025, [2026, 2025]), '/tvorba/kolekce/?year=2025');
  assert.equal(overviewLink(href, 2024, [2026, 2025]), href);
  assert.equal(overviewLink(href, undefined, [2026, 2025]), href);
  assert.equal(overviewLink(href, 2025, []), href);
});
