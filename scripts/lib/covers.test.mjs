import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverCrop, coverProblems, coverShareSource, hasCoverRef, hasFocus, parseAspect, parseCoverRef } from './covers.mjs';

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
  for (const data of [{ cover: 'k3f9a' }, { cover: 'k3f9a#1-mlha', aspect: '2:1', focus: [20, 80] }, {}, { cover: '' }, { focus: null, aspect: '' }]) {
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
  assert.match(p({ cover: 'k3f9a', aspect: '3:2', focus: [120, 0] }), /focus must be \[x, y\]/);
  assert.match(p({ cover: 'k3f9a', aspect: '3x2', focus: [50, 50] }), /aspect must be width:height/);
});

test('coverShareSource: own photo and detail whole or cropped, a work only when cropped; nothing when random', () => {
  const src = (data, photoPath = null) => coverShareSource({ photoPath, data, works });
  assert.deepEqual(src({}, '/c/uvod.jpg'), { source: '/c/uvod.jpg', crop: null });
  assert.deepEqual(src({ focus: [0, 50] }, '/c/uvod.jpg'), { source: '/c/uvod.jpg', crop: { ratio: 1, css: '1 / 1', focus: [0, 50] } });
  assert.equal(src({ cover: 'k3f9a' }), null, 'a whole work: the site shares its own og.jpg');
  assert.deepEqual(src({ cover: 'k3f9a', aspect: '16:9', focus: [20, 30] }), { source: '/m/rano.jpg', crop: { ratio: 16 / 9, css: '16 / 9', focus: [20, 30] } });
  assert.deepEqual(src({ cover: 'k3f9a#1-mlha' }), { source: '/m/rano/1-mlha.jpg', crop: null });
  assert.equal(src({}), null);
  assert.equal(src({ cover: 'd4r4f', aspect: '3:2', focus: [50, 50] }), null, 'a draft is not on the web');
});

test('aspect and focus crop only a chosen cover (cover or own photo); with a random one they are reported', () => {
  const p = (data, photoPath = null) => coverProblems({ where: 'uvod.yaml', data, photoPath, works }).join('\n');
  assert.match(p({ focus: [50, 50] }), /focus crops only a chosen cover/);
  assert.match(p({ aspect: '3:2', focus: [50, 50] }), /aspect and focus crop only a chosen cover/);
  for (const data of [{ focus: [50, 50] }, { aspect: '3:2' }, { aspect: '2:1', focus: [10, 10] }]) {
    assert.equal(p(data, '/c/uvod.jpg'), '', 'own photo');
    assert.equal(p({ cover: 'k3f9a', ...data }), '', 'cover');
  }
  assert.equal(p({ focus: null }), '');
  assert.equal(hasFocus({ focus: null }), false);
  assert.equal(hasFocus({ focus: [] }), false);
  assert.equal(hasFocus({ focus: [1, 2] }), true);
});

test('parseAspect and coverCrop: width:height; aspect or focus crops, the other one defaults to 1:1 / the centre', () => {
  assert.deepEqual(parseAspect('3:2'), { ratio: 1.5, css: '3 / 2' });
  assert.deepEqual(parseAspect(' 2,35 : 1 '), { ratio: 2.35, css: '2.35 / 1' });
  for (const bad of ['3/2', '0:1', '3:', 'široký', null, 1.5]) assert.equal(parseAspect(bad), null, String(bad));
  assert.deepEqual(coverCrop({ cover: 'k3f9a', aspect: '2:1', focus: [10, 20] }), { ratio: 2, css: '2 / 1', focus: [10, 20] });
  assert.deepEqual(coverCrop({ cover: 'k3f9a', focus: [10, 20] }), { ratio: 1, css: '1 / 1', focus: [10, 20] });
  assert.deepEqual(coverCrop({ cover: 'k3f9a', aspect: '3:2' }), { ratio: 1.5, css: '3 / 2', focus: [50, 50] });
  assert.equal(coverCrop({ cover: 'k3f9a' }), null, 'neither: whole');
  assert.equal(coverCrop({ aspect: '1:1', focus: [10, 20] }), null, 'nothing chosen');
  assert.deepEqual(coverCrop({ aspect: '3:2' }, true), { ratio: 1.5, css: '3 / 2', focus: [50, 50] }, 'own photo');
  assert.equal(coverCrop({ cover: 'k3f9a', aspect: '3x2' }), null, 'invalid');
});
