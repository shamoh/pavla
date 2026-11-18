import test from 'node:test';
import assert from 'node:assert/strict';
import { gameFrame, gameLevels } from './detail-game.mjs';
import {
  GAME_KEY, SKIP_KEY, areasInImage, contentExclusions, cropRect, excludePrepared, exclusionProblems, planViews, puzzleView, touches,
} from './game-exclusions.mjs';

const [easy, medium] = gameLevels();

test('exclusionProblems: nothing is fine; places are [left, top, width, height] inside the photo', () => {
  for (const ok of [undefined, null, [[1840, 0, 260, 3000]], [[0, 0, 10, 10], [100, 200, 50, 50]]]) {
    assert.deepEqual(exclusionProblems(ok, 4000, 3000, 'tvorba/a.yaml'), [], JSON.stringify(ok));
  }
  const one = (value) => exclusionProblems(value, 4000, 3000, 'tvorba/a.yaml')[0];
  assert.match(one('ano'), /^tvorba\/a\.yaml: meta_game_skip musí být seznam míst.* \[spatne-vynechane-misto\]$/);
  assert.match(one(false), /musí být seznam míst/, 'false belongs to game');
  assert.match(one([]), /musí být seznam míst/);
  assert.match(one([[1, 2, 3]]), /\[zleva, shora, šířka, výška\]/);
  assert.match(one([[1.5, 2, 3, 4]]), /celých pixelech/);
  assert.match(one([[0, 0, 0, 10]]), /kladnou šířku/);
  assert.match(one([[0, 0, 10, 10], [3900, 0, 200, 10]]), /^tvorba\/a\.yaml: meta_game_skip místo 2 sahá mimo fotku \(4100 × 10 px, fotka má 4000 × 3000\)/);
  assert.deepEqual([GAME_KEY, SKIP_KEY], ['game', 'meta_game_skip']);
});

test('areasInImage: pixels of the photo as shares of the web picture, trimmed by the corners (offset), clipped', () => {
  const image = { offset: { left: 100, top: 50 }, width: 1000, height: 500 };
  assert.deepEqual(areasInImage([[600, 50, 100, 500]], image), [{ x0: 0.5, y0: 0, x1: 0.6, y1: 1 }]);
  assert.deepEqual(areasInImage([[0, 0, 200, 100]], image), [{ x0: 0, y0: 0, x1: 0.1, y1: 0.1 }], 'clipped at the edge');
  assert.deepEqual(areasInImage([[0, 0, 50, 50]], image), [], 'wholly in the cut-off background');
});

test('cropRect and touches: a square of the shorter side, in shares of a wide and a tall picture', () => {
  assert.deepEqual(cropRect({ x: 0.5, y: 0.5, size: 0.2 }, 0.5), { x0: 0.45, y0: 0.4, x1: 0.55, y1: 0.6 });
  const tall = cropRect({ x: 0.5, y: 0.5, size: 0.2 }, 2);
  assert.ok(Math.abs(tall.x1 - tall.x0 - 0.2) < 1e-9 && Math.abs(tall.y1 - tall.y0 - 0.1) < 1e-9);
  assert.equal(touches({ x0: 0, y0: 0, x1: 0.5, y1: 0.5 }, { x0: 0.5, y0: 0, x1: 1, y1: 1 }), false, 'edges do not count');
  assert.equal(touches({ x0: 0, y0: 0, x1: 0.51, y1: 0.5 }, { x0: 0.5, y0: 0, x1: 1, y1: 1 }), true);
});

test('excludePrepared: a work out of the game is gone from answers and lookalikes, places touching an area go', () => {
  const prepared = {
    easy: {
      a: [{ crop: { x: 0.2, y: 0.5, size: 0.2 }, ranked: ['b', 'c'] }, { crop: { x: 0.5, y: 0.5, size: 0.2 }, ranked: ['c'] }],
      b: [{ crop: { x: 0.5, y: 0.5, size: 0.2 }, ranked: ['a'] }],
      c: [{ crop: { x: 0.5, y: 0.5, size: 0.2 }, ranked: ['a', 'b'] }],
    },
  };
  const out = excludePrepared(prepared, { b: false, c: { areas: [{ x0: 0.45, y0: 0, x1: 0.55, y1: 1 }], ratio: 1 }, a: { areas: [{ x0: 0.45, y0: 0, x1: 0.55, y1: 1 }], ratio: 1 } });
  assert.deepEqual(Object.keys(out.easy), ['a'], 'b out of the game, c left without places');
  assert.deepEqual(out.easy.a, [{ crop: { x: 0.2, y: 0.5, size: 0.2 }, ranked: ['c'] }]);
  assert.deepEqual(excludePrepared(prepared, {}), prepared, 'nothing kept out: the same');
});

test('puzzleView: as far as the level zooms when nothing is near, less when a view would touch an area, never below the close-up', () => {
  const crop = { x: 0.2, y: 0.3, size: easy.size };
  assert.equal(puzzleView({ crop, ratio: 0.75, level: easy, areas: [] }), null);
  assert.equal(puzzleView({ crop, ratio: 0.75, level: easy, areas: [{ x0: 0.95, y0: 0.95, x1: 1, y1: 1 }] }), null, 'the level never gets there');
  const areas = [{ x0: 0.48, y0: 0, x1: 0.52, y1: 1 }];
  const view = puzzleView({ crop, ratio: 0.75, level: easy, areas });
  assert.ok(view > crop.size && view < easy.lastView, String(view));
  for (let m = 0; m < easy.guesses; m++) {
    const frame = gameFrame(crop, m, easy.guesses - 1, 0.75, view);
    assert.equal(areas.some((a) => touches(cropRect(frame, 0.75), a)), false, `try ${m + 1}`);
  }
  assert.equal(puzzleView({ crop: { x: 0.5, y: 0.5, size: 0.16 }, ratio: 1, level: medium, areas }), 0.16, 'no way round it');
});

test('planViews: only the days planned again, a view where a work has areas, an old view gone when it needs none', () => {
  const crop = { x: 0.2, y: 0.3, size: easy.size };
  const days = {
    5: { date: '2026-11-06', easy: { targetId: 'a', crop, optionIds: ['a'], look: 'clear' } },
    6: { date: '2026-11-07', easy: { targetId: 'a', crop, optionIds: ['a'], look: 'clear' } },
    7: { date: '2026-11-08', easy: { targetId: 'b', crop, optionIds: ['b'], look: 'clear', view: 0.3 } },
  };
  const exclusions = { a: { areas: [{ x0: 0.48, y0: 0, x1: 0.52, y1: 1 }], ratio: 0.75 } };
  const out = planViews(days, { exclusions, levels: [easy], from: 6 });
  assert.equal(out[5], days[5], 'a kept day stays');
  assert.ok(out[6].easy.view > crop.size && out[6].easy.view < easy.lastView);
  assert.equal('view' in out[7].easy, false);
});

test('contentExclusions: false for a work out (game false wins over its places), areas in shares of its web picture with its ratio, nothing for the others', async () => {
  const works = [
    { data: { id: 'a1b2c', game: false, meta_game_skip: [[0, 0, 10, 10]] }, masterPath: '/w.jpg' },
    { data: { id: 'd3e4f', meta_game_skip: [[500, 0, 100, 1000]] }, masterPath: '/x.jpg' },
    { data: { id: 'g5h6i' }, masterPath: '/y.jpg' },
    { data: { id: 'j7k8l', game: true }, masterPath: '/z.jpg' },
  ];
  const asked = [];
  const out = await contentExclusions(works, async (w) => { asked.push(w.data.id); return { offset: { left: 0, top: 0 }, width: 1000, height: 1000 }; });
  assert.deepEqual(out, { a1b2c: false, d3e4f: { areas: [{ x0: 0.5, y0: 0, x1: 0.6, y1: 1 }], ratio: 1 } });
  assert.deepEqual(asked, ['d3e4f'], 'the photo only of a work with areas');
});
