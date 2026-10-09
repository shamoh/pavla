import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comboMatches, nextActive, typedActive } from './combobox.mjs';

const labels = ['vše', 'žádná', 'Plenér Šumava 2026', 'Kresby, pastely a kvaš 2025–2026', 'Plenér Krkonoše 2006'];

test('comboMatches: all without typing; typed words narrow it in the same order, the kept options stay on top', () => {
  assert.deepEqual(comboMatches(labels, ''), [0, 1, 2, 3, 4]);
  assert.deepEqual(comboMatches(labels, 'plener', 2), [0, 1, 2, 4], 'order kept, "vše" and "žádná" kept');
  assert.deepEqual(comboMatches(labels, 'krkonose PLENER', 2), [0, 1, 4], 'every word, any case and diacritics');
  assert.deepEqual(comboMatches(labels, 'vse', 2), [0, 1], 'kept options are never searched for');
  assert.deepEqual(comboMatches(labels, 'zadna', 1), [0, 1], '"žádná" searched (and found) when not kept');
});

test('nextActive: arrows move and wrap; from none down to the first, up to the last', () => {
  assert.equal(nextActive(-1, 1, 3), 0);
  assert.equal(nextActive(-1, -1, 3), 2);
  assert.equal(nextActive(2, 1, 3), 0, 'wraps to the first');
  assert.equal(nextActive(0, -1, 3), 2, 'wraps to the last');
  assert.equal(nextActive(1, 1, 3), 2);
  assert.equal(nextActive(0, 1, 0), -1, 'no options');
});

test('typedActive: the first match after the kept options, else the first one; an emptied field "vše"', () => {
  assert.equal(typedActive([0, 1, 4], 'krkonose', 2), 2, 'Plenér Krkonoše (position 2 in the list)');
  assert.equal(typedActive([0, 1], 'xyz', 2), 0, 'nothing found: "vše"');
  assert.equal(typedActive([0, 1, 2, 3, 4], '', 2), 0, 'text deleted: "vše", as the hint shows');
  assert.equal(typedActive([0, 1, 2, 3, 4], '   ', 2), 0, 'only spaces count as empty');
  assert.equal(typedActive([], 'x', 1), -1);
});
