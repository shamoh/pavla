import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashId, MAIN_VIEW, viewId, viewIndex } from './work-viewer.mjs';

test('viewId names the work, its details and its mockups', () => {
  assert.equal(viewId({ kind: 'main' }), MAIN_VIEW);
  assert.equal(viewId({ kind: 'main' }), 'obraz');
  assert.equal(viewId({ kind: 'detail', name: 'oci' }), 'detail-oci');
  assert.equal(viewId({ kind: 'mockup', name: 'obyvak-svetly' }), 'mockup-obyvak-svetly');
});

test('hashId reads the id from a location hash', () => {
  assert.equal(hashId('#detail-oci'), 'detail-oci');
  assert.equal(hashId('detail-oci'), 'detail-oci');
  assert.equal(hashId('#detail-%C5%A1ipka'), 'detail-šipka');
  for (const hash of ['', '#', null, undefined, '#%E0%A4%A']) assert.equal(hashId(hash), '', String(hash));
});

test('viewIndex finds the view a hash names, -1 for none or an unknown one', () => {
  const ids = ['obraz', 'detail-oblicej', 'detail-oci', 'mockup-obyvak-svetly'];
  assert.equal(viewIndex('#obraz', ids), 0);
  assert.equal(viewIndex('#detail-oci', ids), 2);
  assert.equal(viewIndex('#mockup-obyvak-svetly', ids), 3);
  for (const hash of ['', '#', '#detail-nos', '#oci', '#mockup-', '#viewer', '#%E0%A4%A']) assert.equal(viewIndex(hash, ids), -1, hash);
});
