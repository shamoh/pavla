import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoverRef, validateCollectionCovers } from './collections.mjs';

test('parseCoverRef splits "<id>#<detail>" and normalises the detail name like detail photos', () => {
  assert.deepEqual(parseCoverRef('vjr39'), { id: 'vjr39', detail: null });
  assert.deepEqual(parseCoverRef('vjr39#1-kvety'), { id: 'vjr39', detail: '1-kvety' });
  assert.deepEqual(parseCoverRef(' vjr39#1 Květy '), { id: 'vjr39', detail: '1-kvety' });
});

const works = [
  { id: 'vjr39', dir: 'zahrada', collection: 'zahrada', slug: 'pivonky', data: { title: 'Pivoňky' }, details: [{ name: '1-kvety' }] },
  { id: 'q6bn6', dir: 'zahrada', collection: 'zahrada', slug: 'kytice', data: { title: 'Kytice' }, details: [] },
];
const check = (data, coverPath = null) => validateCollectionCovers([{ slug: 'zahrada', dir: 'zahrada', data, coverPath }], works);

test('validateCollectionCovers accepts a work, a detail photo of a work, no cover and a valid focus', () => {
  assert.deepEqual(check({ cover: 'vjr39' }), []);
  assert.deepEqual(check({ cover: 'vjr39#1-kvety', focus: [0, 100] }), []);
  assert.deepEqual(check({}), []);
  assert.deepEqual(check({ cover: '', focus: null }), []);
});

test('validateCollectionCovers reports a missing detail, a detail of a work without details and a bad focus', () => {
  assert.match(check({ cover: 'vjr39#listy' })[0], /Pivoňky has no detail photo "listy" \(folder tvorba\/zahrada\/pivonky\/\)/);
  assert.match(check({ cover: 'q6bn6#1-kvety' })[0], /Kytice has no detail photo "1-kvety"/);
  assert.match(check({ focus: [50] })[0], /focus must be \[x, y\]/);
  assert.match(check({ focus: '50 50' })[0], /focus must be \[x, y\]/);
});

test('validateCollectionCovers reports a cover next to a cover photo', () => {
  assert.match(check({ cover: 'vjr39#1-kvety' }, '/x/kolekce/zahrada.jpg')[0], /both set, keep one/);
});

test('coverSource picks the same image as the site: own photo, cover work or detail, newest work', async () => {
  const { coverSource } = await import('./collections.mjs');
  const all = [
    { id: 'vjr39', collection: 'zahrada', data: { date: '2025-05-28' }, masterPath: '/m/pivonky.jpg', details: [{ name: '1-kvety', path: '/m/pivonky/1-kvety.jpg' }] },
    { id: 'q6bn6', collection: 'zahrada', data: { date: '2025-08-20' }, masterPath: '/m/kytice.jpg', details: [] },
    { id: 'drft1', collection: 'zahrada', data: { date: '2025-12-01', draft: true }, masterPath: '/m/draft.jpg', details: [] },
    { id: 'jinde', collection: 'jina', data: { date: '2025-12-02' }, masterPath: '/m/jinde.jpg', details: [] },
  ];
  const c = (data, coverPath = null) => ({ slug: 'zahrada', data, coverPath });
  assert.equal(coverSource(c({}, '/k/zahrada.jpg'), all), '/k/zahrada.jpg');
  assert.equal(coverSource(c({ cover: 'vjr39' }), all), '/m/pivonky.jpg');
  assert.equal(coverSource(c({ cover: 'vjr39#1 Květy' }), all), '/m/pivonky/1-kvety.jpg');
  // newest published work of the collection (not the draft, not another collection)
  assert.equal(coverSource(c({}), all), '/m/kytice.jpg');
  assert.equal(coverSource({ slug: 'prazdna', data: {}, coverPath: null }, all), null);
  assert.equal(coverSource(c({}), [{ ...all[1], masterPath: null }]), null);
  // without cover: the newest work of the author's selection (featured) wins over the newest work
  const featured = all.map((w) => (w.id === 'vjr39' ? { ...w, data: { ...w.data, featured: true } } : w));
  assert.equal(coverSource(c({}), featured), '/m/pivonky.jpg');
  assert.equal(coverSource(c({ cover: 'q6bn6' }), featured), '/m/kytice.jpg', 'an explicit cover still decides');
});

test('titleFromFolder moves a leading year (or range) to the end of the title', async () => {
  const { titleFromFolder } = await import('./collections.mjs');
  assert.equal(titleFromFolder('2026-plener-sumava'), 'Plener sumava 2026');
  assert.equal(titleFromFolder('2026 Plenér Šumava'), 'Plenér Šumava 2026');
  assert.equal(titleFromFolder('2025-2026 Ovce'), 'Ovce 2025–2026');
  assert.equal(titleFromFolder('zatisi'), 'Zatisi');
});
