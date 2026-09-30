import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverProblems, coverShareSource, hasCoverRef, hasFocus, parseCoverRef } from './covers.mjs';

const works = [
  { id: 'k3f9a', slug: 'rano', dir: '', year: '2026', data: { title: 'Ráno' }, masterPath: '/m/rano.jpg', details: [{ name: '1-mlha', path: '/m/rano/1-mlha.jpg' }] },
  { id: 'm7q2x', slug: 'vecer', dir: '', year: '2025', data: { title: 'Večer' }, masterPath: '/m/vecer.jpg', details: [] },
  { id: 'd4r4f', slug: 'skica', dir: '', year: '2026', data: { title: 'Skica', draft: true }, masterPath: '/m/skica.jpg', details: [] },
];
const in2026 = { inScope: (w) => w.year === '2026', scope: '2026' };

test('parseCoverRef and hasCoverRef', () => {
  assert.deepEqual(parseCoverRef('k3f9a#1 Mlha'), { id: 'k3f9a', detail: '1-mlha' });
  assert.equal(hasCoverRef({ cover: ' ' }), false);
  assert.equal(hasCoverRef({ cover: 'k3f9a' }), true);
  assert.equal(hasCoverRef(undefined), false);
});

test('coverProblems: fine for a work or detail of the place, no cover, a valid focus', () => {
  for (const data of [{ cover: 'k3f9a' }, { cover: 'k3f9a#1-mlha', focus: [20, 80] }, {}, { cover: '' }, { focus: null }]) {
    assert.deepEqual(coverProblems({ where: 'roky/2026.yaml', data, photoPath: null, works, ...in2026 }), []);
  }
});

test('coverProblems: another place, a draft, an unknown id or detail, a photo too, a bad focus', () => {
  const p = (data, photoPath = null) => coverProblems({ where: 'roky/2026.yaml', data, photoPath, works, ...in2026 }).join('\n');
  assert.match(p({ cover: 'm7q2x' }), /\(Večer\) is not in 2026/);
  assert.match(p({ cover: 'd4r4f' }), /is a draft/);
  assert.match(p({ cover: 'zzzzz' }), /zzzzz is not the id of any work/);
  assert.match(p({ cover: 'k3f9a#lodka' }), /has no detail photo "lodka"/);
  assert.match(p({ cover: 'k3f9a' }, '/c/roky/2026.jpg'), /cover k3f9a and the cover photo 2026\.jpg both set/);
  assert.match(p({ cover: 'k3f9a', focus: [120, 0] }), /focus must be \[x, y\]/);
});

test('coverShareSource: own photo and detail whole or cropped, a work only when cropped; nothing when random', () => {
  const src = (data, photoPath = null) => coverShareSource({ photoPath, data, works });
  assert.deepEqual(src({}, '/c/uvod.jpg'), { source: '/c/uvod.jpg', focus: null });
  assert.equal(src({ cover: 'k3f9a' }), null, 'a whole work: the site shares its own og.jpg');
  assert.deepEqual(src({ cover: 'k3f9a', focus: [20, 30] }), { source: '/m/rano.jpg', focus: [20, 30] });
  assert.deepEqual(src({ cover: 'k3f9a#1-mlha' }), { source: '/m/rano/1-mlha.jpg', focus: null });
  assert.equal(src({}), null);
  assert.equal(src({ cover: 'd4r4f', focus: [50, 50] }), null, 'a draft is not on the web');
});

test('focus only with cover: without it, or with an own photo, it is reported', () => {
  const p = (data, photoPath = null) => coverProblems({ where: 'uvod.yaml', data, photoPath, works }).join('\n');
  assert.match(p({ focus: [50, 50] }), /focus only crops the work chosen by cover/);
  assert.match(p({ focus: [50, 50] }, '/c/uvod.jpg'), /focus does not apply to the own cover photo uvod\.jpg/);
  assert.equal(p({ cover: 'k3f9a', focus: [50, 50] }), '');
  assert.equal(p({ focus: null }), '');
  assert.equal(hasFocus({ focus: null }), false);
  assert.equal(hasFocus({ focus: [] }), false);
  assert.equal(hasFocus({ focus: [1, 2] }), true);
});
