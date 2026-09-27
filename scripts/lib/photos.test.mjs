import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusCrop, isValidFocus, photoFocus } from './photos.mjs';

test('focusCrop cuts the sides of a wide image, placed by the horizontal focus', () => {
  // 3000 × 1000 to 3:2 → 1500 × 1000
  assert.deepEqual(focusCrop(3000, 1000, 3 / 2), { left: 750, top: 0, width: 1500, height: 1000 });
  assert.deepEqual(focusCrop(3000, 1000, 3 / 2, [0, 50]), { left: 0, top: 0, width: 1500, height: 1000 });
  assert.deepEqual(focusCrop(3000, 1000, 3 / 2, [100, 50]), { left: 1500, top: 0, width: 1500, height: 1000 });
});

test('focusCrop cuts top and bottom of a tall image, placed by the vertical focus', () => {
  // 1800 × 2400 to 3:2 → 1800 × 1200
  assert.deepEqual(focusCrop(1800, 2400, 3 / 2), { left: 0, top: 600, width: 1800, height: 1200 });
  assert.deepEqual(focusCrop(1800, 2400, 3 / 2, [50, 25]), { left: 0, top: 300, width: 1800, height: 1200 });
});

test('focusCrop keeps an image that already has the aspect ratio', () => {
  assert.deepEqual(focusCrop(2400, 1600, 3 / 2, [90, 10]), { left: 0, top: 0, width: 2400, height: 1600 });
});

test('isValidFocus and photoFocus', () => {
  assert.ok(isValidFocus([0, 100]));
  for (const f of [[101, 0], [-1, 0], [50], '50 50', ['a', 'b'], null]) assert.ok(!isValidFocus(f), String(f));
  assert.deepEqual(photoFocus({ focus: [10, 20] }), [10, 20]);
  assert.deepEqual(photoFocus({ focus: [500, 20] }), [50, 50]);
  assert.deepEqual(photoFocus(undefined), [50, 50]);
});
