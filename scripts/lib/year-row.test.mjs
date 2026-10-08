import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hiddenYearsLabel, pickedIsHidden, visibleCount } from './year-row.mjs';

test('hiddenYearsLabel: the range of the hidden years, newest first; one year alone', () => {
  assert.equal(hiddenYearsLabel([2017, 2016, 2010, 2003]), '2017–2003');
  assert.equal(hiddenYearsLabel([2003]), '2003');
  assert.equal(hiddenYearsLabel([]), '');
});

test('visibleCount: the most years that fit, down to none', () => {
  const widths = [50, 50, 50, 50, 50];
  // 200 px for the years, the control takes 80 px when some are hidden
  const fits = (k) => widths.slice(0, k).reduce((a, b) => a + b, 0) + (k < widths.length ? 80 : 0) <= 200;
  assert.equal(visibleCount(widths.length, fits), 2);
  assert.equal(visibleCount(widths.length, () => true), 5, 'everything fits: no control');
  assert.equal(visibleCount(widths.length, () => false), 0, 'only the control');
  assert.equal(visibleCount(0, () => true), 0);
});

test('pickedIsHidden: a picked older year unfolds the row', () => {
  assert.equal(pickedIsHidden(4, 3), true);
  assert.equal(pickedIsHidden(2, 3), false);
  assert.equal(pickedIsHidden(-1, 0), false, 'nothing picked');
});
