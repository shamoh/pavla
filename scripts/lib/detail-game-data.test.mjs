import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_EPOCH } from './detail-game.mjs';
import { ANALYSIS_DIR, analysisSettings, archiveData, gameData, gameWorkFields, imageFingerprint } from './detail-game-data.mjs';
import { gameLevels } from './detail-game.mjs';

test('imageFingerprint: the same bytes the same, other bytes another', () => {
  assert.match(imageFingerprint(Buffer.from('obraz')), /^[0-9a-f]{16}$/);
  assert.equal(imageFingerprint(Buffer.from('obraz')), imageFingerprint(Buffer.from('obraz')));
  assert.notEqual(imageFingerprint(Buffer.from('obraz')), imageFingerprint(Buffer.from('obrazy')));
});

test('analysisSettings: another close-up size or level = another setting; the place of the analyses next to the plan', () => {
  const levels = gameLevels();
  assert.match(analysisSettings(levels), /^[0-9a-f]{8}$/);
  assert.equal(analysisSettings(levels), analysisSettings(gameLevels()));
  assert.notEqual(analysisSettings(levels), analysisSettings(levels.map((l, i) => (i ? l : { ...l, size: l.size + 0.01 }))));
  assert.notEqual(analysisSettings(levels), analysisSettings(levels.slice(1)));
  assert.equal(analysisSettings(levels), analysisSettings(levels.map((l) => ({ ...l, label: 'jinak', guesses: 9 }))), 'what the analysis does not use changes nothing');
  assert.equal(ANALYSIS_DIR.split(/[\\/]/).join('/'), 'game/detail-dne/analysis');
});

const work = (id) => ({
  id, title: `Dílo ${id}`, sub: 'akvarel · 20 × 30 cm', year: 2026, technique: 'akvarel', tags: ['krajina'], collection: '', collectionTitle: '',
  text: 'Text.', url: `/tvorba/2026/dilo-${id}/`, folder: `tvorba/2026/dilo-${id}`, widths: [480, 960], ratio: 0.75, secret: 'x',
});

test('gameData: the works of the answers and their thumbnails only, with what the page needs; the first day and the site', () => {
  const prepared = { easy: { a: [{ crop: { x: 0.5, y: 0.5, size: 0.2, colours: ['#112233'] }, ranked: ['b', 'c'] }] }, hard: {} };
  const data = gameData({ works: ['a', 'b', 'c', 'd'].map(work), prepared, site: 'https://example.cz' });
  assert.equal(data.epoch, GAME_EPOCH);
  assert.equal(data.site, 'https://example.cz');
  assert.deepEqual(data.works.map((w) => w.id), ['a', 'b', 'c'], 'nothing refers to d');
  assert.deepEqual(Object.keys(data.works[0]).sort(), ['collection', 'collectionTitle', 'folder', 'id', 'ratio', 'sub', 'technique', 'text', 'title', 'url', 'widths', 'year']);
  assert.equal(data.prepared, prepared);
  assert.deepEqual(gameData({ works: [work('a')], prepared: {}, site: '' }).works, [], 'no answers, no works');
});

test('gameData: the planned days go in with their works (thumbnails too), also those no answer of today refers to', () => {
  const prepared = { easy: { a: [{ crop: { x: 0.5, y: 0.5, size: 0.2, colours: [] }, ranked: ['b'] }] } };
  const plan = { version: 1, details: { d: [] }, days: { 0: { date: '2026-11-01', easy: { targetId: 'd', detail: 1, crop: {}, optionIds: ['d', 'e'], look: 'clear' } } } };
  const data = gameData({ works: ['a', 'b', 'c', 'd', 'e'].map(work), prepared, site: '', plan });
  assert.deepEqual(data.works.map((w) => w.id), ['a', 'b', 'd', 'e']);
  assert.deepEqual(data.plan, { days: plan.days, archive: [] }, 'only the days: the numbers of the details stay in the repository');
  assert.deepEqual(gameData({ works: [work('a')], prepared, site: '' }).plan, { days: {}, archive: [] }, 'no plan yet');
  assert.deepEqual(gameData({ works: [work('a')], prepared, site: '', plan: { days: {}, archive: [2024, 2025] } }).plan.archive, [2024, 2025]);
});

test('archiveData: a year of the plan with the works its days refer to, in the shape of the data of the page', () => {
  const days = { 3: { date: '2024-11-04', easy: { targetId: 'b', detail: 2, crop: {}, optionIds: ['b', 'c', 'gone'], look: 'clear' } } };
  const data = archiveData({ year: 2024, days, works: ['a', 'b', 'c'].map(work) });
  assert.equal(data.year, 2024);
  assert.equal(data.days, days);
  assert.deepEqual(data.works.map((w) => w.id), ['b', 'c'], 'only the referred ones still on the site');
  assert.deepEqual(data.works[0], gameWorkFields(work('b')));
});
