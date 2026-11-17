import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEASER_DAYS, levelFromParam, levelParam, teaserData, teaserDoneHtml, teaserState, teaserStreakText, teaserTilesHtml, teaserWaveFilter,
} from './detail-teaser.mjs';
import { gameLevels, roundKey } from './detail-game.mjs';

const EPOCH = '2026-11-01';
const work = (id) => ({ id, title: `Obraz ${id}`, url: `/tvorba/2026/${id}/`, folder: `tvorba/2026/${id}`, widths: [480, 960, 1600], ratio: 0.75, sub: '', text: '' });
const crop = { x: 0.5, y: 0.5, size: 0.2 };
const puzzle = (targetId, look) => ({ targetId, crop, optionIds: [targetId, 'zz'], look, detail: 1 });
// a plan of two days (16 and 17 = 2026-11-17 and 18), every level with a work of its own
const data = {
  epoch: EPOCH,
  works: ['a', 'b', 'c', 'd', 'e', 'f', 'zz'].map(work),
  prepared: {},
  plan: {
    days: {
      16: { easy: puzzle('a', 'clear'), medium: puzzle('b', 'water'), hard: puzzle('c', 'dream') },
      17: { easy: puzzle('d', 'mosaic'), medium: puzzle('e', 'curtain'), hard: puzzle('f', 'embroidery') },
    },
  },
};
const teaser = teaserData({ data, from: 15, to: 17 });

test('levelParam / levelFromParam: the level in the address without diacritics, its id too', () => {
  assert.deepEqual(gameLevels().map(levelParam), ['lehka', 'stredni', 'tezka']);
  assert.equal(levelFromParam('stredni').id, 'medium');
  assert.equal(levelFromParam('TEZKA').id, 'hard');
  assert.equal(levelFromParam('easy').id, 'easy');
  assert.equal(levelFromParam('nic'), null);
  assert.equal(levelFromParam(null), null);
  assert.equal(levelFromParam(''), null);
});

test('teaserData: the days asked for with their puzzles, only the works they ask for', () => {
  assert.deepEqual(Object.keys(teaser.days), ['15', '16', '17']);
  assert.deepEqual(teaser.days[16].medium, { targetId: 'b', crop, look: 'water' });
  assert.deepEqual(teaser.days[15], { easy: null, medium: null, hard: null }, 'a day without a plan or answers has no puzzles');
  assert.deepEqual(Object.keys(teaser.works).sort(), ['a', 'b', 'c', 'd', 'e', 'f'], 'no thumbnails, only the works asked for');
  assert.deepEqual(teaser.works.a, { id: 'a', title: 'Obraz a', url: '/tvorba/2026/a/', folder: 'tvorba/2026/a', widths: [480, 960, 1600], ratio: 0.75 });
  assert.equal(teaser.epoch, EPOCH);
  assert.deepEqual(Object.keys(teaserData({ data, from: -3, to: 0 }).days), ['0'], 'never before the first day');
  assert.ok(TEASER_DAYS.after >= 14, 'longer than a week between two builds');
});

test('teaserState: a new player gets three levels to play, nothing without the day', () => {
  const state = teaserState({ teaser, today: 16 });
  assert.equal(state.label, '2026#321');
  assert.deepEqual(state.tiles.map((t) => [t.level, t.state, t.param, t.drops]), [['easy', 'open', 'lehka', 10], ['medium', 'open', 'stredni', 20], ['hard', 'open', 'tezka', 30]]);
  assert.equal(state.done, false);
  assert.equal(state.streak, null);
  assert.equal(teaserState({ teaser, today: 30 }), null, 'a day the file does not have');
  assert.deepEqual(teaserState({ teaser, today: 15 }).tiles, [], 'a day without puzzles');
});

test('teaserState: played, started and kept rounds, the series to keep', () => {
  const key = (level) => roundKey(16, level, EPOCH);
  const store = {
    progress: { streak: 4, lastDay: '2026-320', played: { [key('easy')]: { solved: true, misses: 0 } } },
    rounds: { [key('easy')]: { guesses: ['a'], puzzle: puzzle('a', 'clear') }, [key('hard')]: { guesses: ['x', 'y'], puzzle: puzzle('f', 'dream') } },
  };
  const state = teaserState({ teaser, store, today: 16 });
  assert.deepEqual(state.tiles.map((t) => [t.level, t.state, t.misses]), [['easy', 'solved', 1], ['medium', 'open', 0], ['hard', 'started', 2]]);
  assert.equal(state.tiles[2].puzzle.targetId, 'f', 'the round keeps its own puzzle');
  assert.deepEqual(state.streak, { count: 4, keep: true }, 'played yesterday: keep it');
  const today = teaserState({ teaser, store: { progress: { streak: 5, lastDay: '2026-321', played: {} } }, today: 16 });
  assert.deepEqual(today.streak, { count: 5, keep: false });
  assert.equal(teaserState({ teaser, store: { progress: { streak: 5, lastDay: '2026-300', played: {} } }, today: 16 }).streak, null, 'a broken series is not shown');
  const gone = teaserState({ teaser, store: { rounds: { [key('medium')]: { guesses: ['q'], puzzle: puzzle('gone', 'water') } } }, today: 16 });
  assert.equal(gone.tiles[1].puzzle.targetId, 'b', 'a kept work no longer in the file: the planned one');
});

test('teaserState: a day played through is done, with the days of the archive waiting', () => {
  const played = Object.fromEntries(['easy', 'medium', 'hard'].map((l, i) => [roundKey(16, l, EPOCH), { solved: i < 2 }]));
  const state = teaserState({ teaser, store: { progress: { played } }, today: 16 });
  assert.equal(state.done, true);
  assert.deepEqual(state.tiles.map((t) => t.state), ['solved', 'solved', 'lost']);
  assert.equal(state.waiting, 16, 'every day before today waits');
});

test('teaserTilesHtml: windows of the game for the levels to play, the work for a played one, links into the levels', () => {
  const key = roundKey(16, 'easy', EPOCH);
  const state = teaserState({ teaser, store: { progress: { played: { [key]: { solved: true } } } }, today: 16 });
  const waves = new Set();
  const html = teaserTilesHtml(state, { works: teaser.works, game: '/detail-dne/', pictures: '', waves });
  assert.match(html, /<a class="teaser-tile solved" href="\/detail-dne\/\?uroven=lehka">/);
  assert.match(html, /src="\/tvorba\/2026\/a\/480\.webp" alt="Obraz a"/, 'a played level: the small picture of its work');
  assert.match(html, /✓<\/span> <b>Lehká<\/b> · Obraz a/);
  assert.match(html, /href="\/detail-dne\/\?uroven=stredni" aria-label="Hrát úroveň Střední"/);
  assert.match(html, /src="\/tvorba\/2026\/b\/1600\.webp"/, 'a window: the biggest picture, as the stage');
  assert.match(html, /--zoom:var\(--teaser-zoom\)/);
  assert.match(html, /až 20 💧/);
  assert.match(html, /url\(#teaser-wave-\d+\)/, 'the wave of "Na hladině" points to its own filter');
  assert.equal(waves.size, 1);
  assert.doesNotMatch(html, /Obraz b|Obraz c/, 'a level to play never names its work');
});

test('teaserTilesHtml: a started round shows its view after the misses', () => {
  const key = roundKey(16, 'hard', EPOCH);
  const state = teaserState({ teaser, store: { rounds: { [key]: { guesses: ['x'], puzzle: puzzle('c', 'clear') } } }, today: 16 });
  const html = teaserTilesHtml(state, { works: teaser.works, game: '/detail-dne/', pictures: '' });
  assert.match(html, /<a class="teaser-tile started"/);
  assert.match(html, /Těžká<\/b><span class="note"> · rozehráno/);
});

test('teaserDoneHtml: the result, the works as links, the archive or tomorrow', () => {
  const played = Object.fromEntries(['easy', 'medium', 'hard'].map((l, i) => [roundKey(16, l, EPOCH), { solved: i !== 1 }]));
  const state = teaserState({ teaser, store: { progress: { played } }, today: 16 });
  const html = teaserDoneHtml(state, { works: teaser.works, game: '/detail-dne/', pictures: '' });
  assert.match(html, /Den 2026#321 máš za sebou/);
  assert.match(html, /✓<\/span><span class="sign lost"[^>]*>✗<\/span><span class="sign solved"/);
  assert.match(html, /<a class="mini" href="\/tvorba\/2026\/b\/" title="Obraz b">/);
  assert.match(html, /<a href="\/detail-dne\/#archiv">V archivu čeká ještě 16 dní →<\/a>/);
  assert.match(teaserDoneHtml({ ...state, waiting: 0 }, { works: teaser.works, game: '/detail-dne/', pictures: '' }), /Zítra tu budou nové\./);
  assert.match(teaserDoneHtml({ ...state, waiting: 3 }, { works: teaser.works, game: '/detail-dne/', pictures: '' }), /čeká ještě 3 dny/);
});

test('teaserStreakText and teaserWaveFilter', () => {
  assert.equal(teaserStreakText(null), '');
  assert.equal(teaserStreakText({ count: 5, keep: true }), '🔥 Série 5 · nepřeruš ji');
  assert.equal(teaserStreakText({ count: 5, keep: false }), '🔥 Série 5');
  assert.match(teaserWaveFilter(14), /^<filter id="teaser-wave-14"[\s\S]*scale="14"/);
});

test('teaser titles are escaped', () => {
  const evil = { ...teaser, works: { ...teaser.works, a: { ...teaser.works.a, title: '<b>"x"</b>' } } };
  const played = Object.fromEntries(['easy', 'medium', 'hard'].map((l) => [roundKey(16, l, EPOCH), { solved: true }]));
  const state = teaserState({ teaser: evil, store: { progress: { played } }, today: 16 });
  const html = teaserDoneHtml(state, { works: evil.works, game: '/detail-dne/', pictures: '' }) + teaserTilesHtml(state, { works: evil.works, game: '/detail-dne/', pictures: '' });
  assert.doesNotMatch(html, /<b>"x"/);
  assert.match(html, /&lt;b&gt;&quot;x&quot;&lt;\/b&gt;/);
});
