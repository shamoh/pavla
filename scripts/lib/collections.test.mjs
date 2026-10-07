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
  assert.deepEqual(check({ cover: 'vjr39#1-kvety', aspect: '3:2', focus: [0, 100] }), []);
  assert.deepEqual(check({}), []);
  assert.deepEqual(check({ cover: '', aspect: null, focus: null }), []);
});

test('validateCollectionCovers reports a missing detail, a detail of a work without details and a bad focus', () => {
  assert.match(check({ cover: 'vjr39#listy' })[0], /obraz Pivoňky nemá detailní fotku „listy“ \(složka tvorba\/zahrada\/pivonky\/\)/);
  assert.match(check({ cover: 'q6bn6#1-kvety' })[0], /obraz Kytice nemá detailní fotku „1-kvety“/);
  assert.match(check({ cover: 'vjr39', aspect: '3:2', focus: [50] })[0], /focus musí být \[x, y\]/);
  assert.match(check({ cover: 'vjr39', aspect: '3:2', focus: '50 50' })[0], /focus musí být \[x, y\]/);
});

test('validateCollectionCovers reports a cover next to a cover photo', () => {
  assert.match(check({ cover: 'vjr39#1-kvety' }, '/x/kolekce/zahrada.jpg')[0], /nech jen jedno/);
});

test('coverSource: the share image source of a collection (own photo, cropped work, detail); none when random', async () => {
  const { coverSource } = await import('./collections.mjs');
  const all = [
    { id: 'vjr39', collection: 'zahrada', data: { date: '2025-05-28' }, masterPath: '/m/pivonky.jpg', details: [{ name: '1-kvety', path: '/m/pivonky/1-kvety.jpg' }] },
    { id: 'q6bn6', collection: 'zahrada', data: { date: '2025-08-20' }, masterPath: '/m/kytice.jpg', details: [] },
    { id: 'jinde', collection: 'jina', data: { date: '2025-12-02' }, masterPath: '/m/jinde.jpg', details: [] },
  ];
  const c = (data, coverPath = null) => ({ slug: 'zahrada', data, coverPath });
  assert.deepEqual(coverSource(c({}, '/k/zahrada.jpg'), all), { source: '/k/zahrada.jpg', crop: null });
  assert.deepEqual(coverSource(c({ cover: 'vjr39', aspect: '3:2', focus: [50, 40] }), all), { source: '/m/pivonky.jpg', crop: { ratio: 1.5, css: '3 / 2', focus: [50, 40] } });
  assert.deepEqual(coverSource(c({ cover: 'vjr39', focus: [50, 40] }), all), { source: '/m/pivonky.jpg', crop: { ratio: 1, css: '1 / 1', focus: [50, 40] } }, 'focus alone: 1:1');
  assert.deepEqual(coverSource(c({ aspect: '2:1' }, '/k/zahrada.jpg'), all), { source: '/k/zahrada.jpg', crop: { ratio: 2, css: '2 / 1', focus: [50, 50] } }, 'own photo, aspect alone: the centre');
  assert.equal(coverSource(c({ cover: 'vjr39' }), all), null, 'a whole work shares its own og.jpg');
  assert.deepEqual(coverSource(c({ cover: 'vjr39#1 Květy' }), all), { source: '/m/pivonky/1-kvety.jpg', crop: null });
  assert.equal(coverSource(c({}), all), null);
  assert.equal(coverSource(c({ cover: 'jinde', aspect: '1:1', focus: [1, 1] }), all), null, 'a work of another collection is not its cover');
});

test('titleFromFolder moves a leading year (or range) to the end of the title', async () => {
  const { titleFromFolder } = await import('./collections.mjs');
  assert.equal(titleFromFolder('2026-plener-sumava'), 'Plener sumava 2026');
  assert.equal(titleFromFolder('2026 Plenér Šumava'), 'Plenér Šumava 2026');
  assert.equal(titleFromFolder('2025-2026 Ovce'), 'Ovce 2025–2026');
  assert.equal(titleFromFolder('zatisi'), 'Zatisi');
});
