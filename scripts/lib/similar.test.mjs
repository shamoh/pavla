import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIMILAR_COUNT, galleryStatePath, similarLabel, similarLinkTitle, similarWorks, worksCount } from './similar.mjs';

const w = (id, technique, tags, collection = '') => ({ id, technique, tags, collection, year: 2026, status: 'not-for-sale' });
// newest first, as getWorks
const works = [
  w('a0001', 'akvarel', ['krajina', 'voda', 'plenér'], 'sumava'),
  w('a0002', 'akvarel', ['krajina', 'voda'], 'sumava'),
  w('a0003', 'akvarel', ['krajina', 'voda'], ''),
  w('a0004', 'akvarel', ['krajina', 'voda', 'les'], ''),
  w('a0005', 'akvarel', ['krajina'], 'sumava'),
  w('a0006', 'tuš', ['krajina', 'voda'], ''),
  w('a0007', 'akvarel', ['zvířata'], ''),
  w('a0008', 'olej', ['portrét'], ''),
];

test('similarWorks: the most specific filter leaving at least `count` other works, its first works', () => {
  const r = similarWorks(works[0], works, { count: 3 });
  assert.deepEqual(r.state.tag, ['krajina', 'voda']);
  assert.equal(r.state.technique, 'akvarel');
  assert.equal(r.state.collection, '', 'the collection would leave too few');
  assert.deepEqual(r.works.map((x) => x.id), ['a0002', 'a0003', 'a0004']);
  assert.equal(r.total, 4, 'the gallery shows the work itself too');
  assert.equal(r.works.length, 3);
});

test('similarWorks: without the related works, fewer criteria when they would leave too few', () => {
  const r = similarWorks(works[0], works, { exclude: ['a0002', 'a0003'], count: 3 });
  assert.ok(r.works.every((x) => !['a0001', 'a0002', 'a0003'].includes(x.id)));
  assert.equal(r.works.length, 3);
});

test('similarWorks: one criterion with the most works when none leaves three, null without any', () => {
  const r = similarWorks(works[7], works);
  assert.equal(r, null, 'oil and portrait: nothing shared');
  const few = similarWorks(w('z0001', 'kvaš', ['zvířata']), works);
  assert.deepEqual(few.state.tag, ['zvířata']);
  assert.deepEqual(few.works.map((x) => x.id), ['a0007']);
  assert.equal(few.total, 1);
});

test('galleryStatePath, similarLabel, similarLinkTitle, worksCount', () => {
  const state = { tag: ['krajina', 'voda'], technique: 'akvarel', collection: 'sumava' };
  assert.equal(galleryStatePath(state), '/tvorba/?tag=krajina&tag=voda&technique=akvarel&collection=sumava');
  const title = (slug) => (slug === 'sumava' ? 'Plenér Šumava' : slug);
  assert.equal(similarLabel(state, title), 'akvarel · Plenér Šumava · #krajina · #voda');
  assert.equal(similarLinkTitle(state, title), 'Všechny obrazy: akvarel · Plenér Šumava · #krajina · #voda');
  assert.deepEqual([1, 2, 4, 5, 12].map(worksCount), ['1 obraz', '2 obrazy', '4 obrazy', '5 obrazů', '12 obrazů']);
});

test('similarWorks: never the collection; null when every similar work is a related one', () => {
  const r = similarWorks(works[4], works);
  assert.equal(r.state.collection, '', 'the collection is no criterion');
  assert.equal(similarWorks(works[6], works, { exclude: ['a0001', 'a0002', 'a0003', 'a0004', 'a0005'] }), null,
    'akvarel only: all of them related, nothing new to show');
});

test('similarWorks: six by default (one row of small pictures), a broader filter to fill it', () => {
  assert.equal(SIMILAR_COUNT, 6);
  const r = similarWorks(works[0], works);
  // no criterion leaves six: the one with the most works (akvarel and krajina five each, the technique first)
  assert.equal(r.state.technique, 'akvarel');
  assert.deepEqual(r.state.tag, []);
  assert.deepEqual(r.works.map((x) => x.id), ['a0002', 'a0003', 'a0004', 'a0005', 'a0007']);
});
