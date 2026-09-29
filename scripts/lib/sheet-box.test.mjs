import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boxRegion, parseSheetXmp, rotateBox, sheetXmp } from './sheet-box.mjs';

test('sheetXmp and parseSheetXmp round-trip; anything else is no box', () => {
  assert.deepEqual(parseSheetXmp(sheetXmp([0.02, 0.03, 0.98, 0.97])), [0.02, 0.03, 0.98, 0.97]);
  assert.deepEqual(parseSheetXmp(Buffer.from(sheetXmp([0.1, 0.2, 0.9, 0.8]))), [0.1, 0.2, 0.9, 0.8]);
  for (const bad of [undefined, null, '', '<x:xmpmeta/>', 'pavla:sheet="0.1 0.2 0.3"', 'pavla:sheet="0.9 0.1 0.1 0.9"', 'pavla:sheet="0 0 1.5 1"']) {
    assert.equal(parseSheetXmp(bad), null, String(bad));
  }
});

test('rotateBox follows the rotation of the image', () => {
  const box = [0.1, 0.2, 0.7, 0.9]; // left, top, right, bottom
  assert.deepEqual(rotateBox(box, 0), box);
  // clockwise: the left margin becomes the top margin, the bottom margin the left one
  assert.deepEqual(rotateBox(box, 90).map((n) => +n.toFixed(6)), [0.1, 0.1, 0.8, 0.7]);
  assert.deepEqual(rotateBox(box, -90).map((n) => +n.toFixed(6)), [0.2, 0.3, 0.9, 0.9]);
  assert.deepEqual(rotateBox(box, 270), rotateBox(box, -90));
  assert.deepEqual(rotateBox(box, 180).map((n) => +n.toFixed(6)), [0.3, 0.1, 0.9, 0.8]);
  // four quarter turns are the identity
  assert.deepEqual([90, 90, 90, 90].reduce((b, d) => rotateBox(b, d), box).map((n) => +n.toFixed(6)), box);
});

test('boxRegion converts the box to pixels', () => {
  assert.deepEqual(boxRegion([0.02, 0.03, 0.98, 0.97], 1000, 500), { left: 20, top: 15, width: 960, height: 470 });
  assert.deepEqual(boxRegion([0, 0, 1, 1], 30, 20), { left: 0, top: 0, width: 30, height: 20 });
});
