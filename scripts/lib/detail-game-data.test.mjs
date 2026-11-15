import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_EPOCH } from './detail-game.mjs';
import { gameData } from './detail-game-data.mjs';

const work = (id) => ({
  id, title: `Dílo ${id}`, sub: 'akvarel · 20 × 30 cm', year: 2026, technique: 'akvarel', tags: ['krajina'], collection: '', collectionTitle: '',
  text: 'Text.', url: `/tvorba/2026/dilo-${id}/`, folder: `tvorba/2026/dilo-${id}`, widths: [480, 960], ratio: 0.75, secret: 'x',
});

test('gameData: the works of the answers and their thumbnails only, with what the page needs; the first day and the site', () => {
  const prepared = { lehka: { a: [{ crop: { x: 0.5, y: 0.5, size: 0.2, colours: ['#112233'] }, ranked: ['b', 'c'] }] }, tezka: {} };
  const data = gameData({ works: ['a', 'b', 'c', 'd'].map(work), prepared, site: 'https://example.cz' });
  assert.equal(data.epoch, GAME_EPOCH);
  assert.equal(data.site, 'https://example.cz');
  assert.deepEqual(data.works.map((w) => w.id), ['a', 'b', 'c'], 'nothing refers to d');
  assert.deepEqual(Object.keys(data.works[0]).sort(), ['collection', 'collectionTitle', 'folder', 'id', 'ratio', 'sub', 'technique', 'text', 'title', 'url', 'widths', 'year']);
  assert.equal(data.prepared, prepared);
  assert.deepEqual(gameData({ works: [work('a')], prepared: {}, site: '' }).works, [], 'no answers, no works');
});
