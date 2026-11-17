import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePixels, applyGuess, archiveDays, gameDiagnostics, diagnosticsText, monthGroups, unplayedDays, daysWord, dayFromParam, dayMarks, gameDate, keptPuzzle, roundPuzzle, chooseDecoys, confusingCrops, dailyPuzzles, drawPixels, dropsFor, effectSettings, effectStrength, effectStyle, waveRipple, frameSource, gameLevels, inZone, prepareLevel, puzzleForLevel, finishRound, archiveRoom, archiveRoomTitle, cappedText, magicWord, tapBurst, groupDigits, rankForms, gameRanks, statsTitle, rulesHtml, gameDay, gameFrame, gameHash, gameHint, gameRandom, gameRank, gameShareText, gameShuffle, gameLooks, dropsWord, lookForDay, techniqueFamily, lookKey, representativeSample, windowHtml,
  collectionHtml, gameCollection, simulatedRounds,
  PLAN_DETAIL_GAP, PLAN_HORIZON, PLAN_MAX_DETAILS, PLAN_WORK_GAP, extendPlan, planDay, planDetailOf, planDetails, planDaysByYear, planDetailsText, planUsage, planYearOf, planYearText, planYearsShown, plannedPuzzles, mergePlanDays, pragueDate, gameDiagnostics as diagnosticsOf,
  lookalikeDistance, newProgress, newRound, paletteDistance, rankLookalikes, regionDetail, regionEdges, regionPalette, rgbToLab, winTitle,
  PLACE_OVERLAP, GAME_CANDIDATES, candidatePool, nextStepsHtml, perfectDay, PERFECT_DAY_TEXT, roundKey, roundOrder, yearDay, dayId, dayLabel, dayOfId, PLAN_FILE_VERSION, planYearDays,
} from './detail-game.mjs';

/** Raw pixels of `width` × `height` coloured by `paint(x, y)` = [r, g, b]. */
function pixels(width, height, paint) {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(paint(x, y), (y * width + x) * 3);
  }
  return { data, width, height, channels: 3 };
}

const WHITE = [250, 250, 245];
const colour = (lab, weight = 1) => ({ lab, weight, hex: '#000000' });

/** Works with the colours of `lab` and one close-up each. */
function library(n, lab = (i) => [50, i * 3, 0]) {
  const works = [];
  const analyses = {};
  for (let i = 0; i < n; i++) {
    const id = `w${String(i).padStart(2, '0')}`;
    works.push({ id, technique: 'akvarel', year: 2026, collection: '', collectionTitle: '', tags: ['krajina'] });
    analyses[id] = { places: [{ detail: 15, palette: [colour(lab(i))] }], crops: [{ x: 0.5, y: 0.5, size: 0.2, detail: 15, palette: [colour(lab(i))] }] };
  }
  return { works, analyses };
}

test('rgbToLab: white, black and a known red', () => {
  assert.deepEqual(rgbToLab(255, 255, 255).map((v) => Math.round(v) + 0), [100, 0, 0]);
  assert.deepEqual(rgbToLab(0, 0, 0).map((v) => Math.round(v) + 0), [0, 0, 0]);
  assert.deepEqual(rgbToLab(255, 0, 0).map(Math.round), [53, 80, 67]);
});

test('regionPalette: the fullest colour first, with its share and hex', () => {
  const picture = pixels(10, 10, (x) => (x < 7 ? [255, 0, 0] : [0, 0, 255]));
  const palette = regionPalette(picture, 0, 0, 10, 10);
  assert.deepEqual(palette.map((c) => [c.hex, c.weight]), [['#ff0000', 0.7], ['#0000ff', 0.3]]);
  assert.equal(regionPalette(picture, 0, 0, 10, 10, 1).length, 1);
  assert.deepEqual(regionPalette(picture, 8, 0, 2, 2).map((c) => c.hex), ['#0000ff'], 'only the rectangle');
});

test('regionDetail: a blank paper is near 0, a change of colour is not', () => {
  assert.ok(regionDetail(pixels(10, 10, () => WHITE), 0, 0, 10, 10) < 0.01);
  assert.ok(regionDetail(pixels(10, 10, (x) => (x < 5 ? WHITE : [20, 60, 120])), 0, 0, 10, 10) > 20);
});

test('regionEdges: a soft wash has few crisp changes, however big its spread', () => {
  const wash = pixels(40, 40, (x) => { const v = 60 + x * 4; return [v, v, v]; });
  const stripes = pixels(40, 40, (x) => (x % 4 < 2 ? [60, 60, 60] : [200, 200, 200]));
  assert.ok(regionDetail(wash, 0, 0, 40, 40) > 10, 'a big spread');
  assert.ok(regionEdges(wash, 0, 0, 40, 40) < 2);
  assert.ok(regionEdges(stripes, 0, 0, 40, 40) > 10);
  assert.equal(regionEdges(wash, 0, 0, 1, 1), 0);
});

test('analyzePixels: a smooth wash is no close-up', () => {
  const wash = pixels(100, 100, (x, y) => { const v = 40 + x + y / 2; return [v, v, v]; });
  assert.deepEqual(analyzePixels(wash, { minDetail: 1 }).crops, []);
  assert.ok(analyzePixels(wash, { minDetail: 1, minEdges: 0 }).crops.length > 0, 'for its spread alone it would be');
});

test('analyzePixels: the writing at the bottom stays out', () => {
  const picture = pixels(100, 100, (x, y) => (y > 85 && (x + y) % 3 === 0 ? [20, 20, 20] : WHITE));
  assert.deepEqual(analyzePixels(picture).crops, []);
});

test('analyzePixels: the close-up is where the painting is, away from the edges, inside the picture', () => {
  const picture = pixels(100, 50, (x, y) => {
    if (x < 3) return [0, 0, 0]; // a dark edge of the photo: must stay out
    return x > 60 && x < 85 && y > 15 && y < 40 && (x + y) % 4 < 2 ? [150, 30, 30] : WHITE;
  });
  const { crops, places } = analyzePixels(picture);
  assert.ok(crops.length >= 1);
  assert.ok(crops[0].x > 0.5 && crops[0].x < 0.95, `x ${crops[0].x}`);
  assert.ok(crops[0].y > 0.2 && crops[0].y < 0.85, `y ${crops[0].y}`);
  assert.equal(crops[0].size, 0.14);
  assert.ok(crops[0].palette.some((c) => c.hex === '#961e1e'), 'the colours of the close-up');
  assert.ok(places.length > 1 && places.every((p) => p.palette.length >= 1 && Number.isInteger(p.detail)), 'the grid of places');
  for (const [a, b] of crops.flatMap((c, i) => crops.slice(i + 1).map((d) => [c, d]))) {
    assert.ok(Math.abs(a.x - b.x) * 100 >= 7 || Math.abs(a.y - b.y) * 50 >= 7, 'no overlap');
  }
});

test('analyzePixels: with overlap the places sharing a part of their side follow, those sharing nothing stay the same', () => {
  const noisy = pixels(100, 100, (x, y) => ((x * 7 + y * 13) % 5 < (x < 30 || y > 50 ? 1 : 3) ? [30, 60, 120] : WHITE));
  const options = { size: 0.2, count: 20 };
  const strict = analyzePixels(noisy, options).crops;
  const loose = analyzePixels(noisy, { ...options, overlap: 0.4 }).crops;
  assert.ok(strict.every((c) => !c.overlaps));
  assert.deepEqual(loose.slice(0, strict.length), strict);
  const extra = loose.slice(strict.length);
  assert.ok(extra.length > 0 && extra.every((c) => c.overlaps), 'more places, all marked');
  assert.ok(loose.length <= 20);
  for (const [i, a] of loose.entries()) {
    for (const b of loose.slice(i + 1)) {
      const apart = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      assert.ok(apart >= a.size * 0.6 - 0.011, `at most 40 % shared: ${apart}`);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.size / 2, 'each its own numbered detail (planDetailOf)');
    }
  }
});

test('PLACE_OVERLAP: a slight overlap in every level, under half a side (every place its own number)', () => {
  assert.ok(PLACE_OVERLAP > 0 && PLACE_OVERLAP < 0.5);
  assert.ok(gameLevels().every((l) => l.overlap === undefined), 'one rule for all levels');
});

test('analyzePixels: a blank paper has no close-up', () => {
  assert.deepEqual(analyzePixels(pixels(60, 60, () => WHITE)).crops, []);
});

test('gameRandom, gameHash, gameShuffle: the same seed = the same order, nothing lost', () => {
  assert.equal(gameHash('a'), gameHash('a'));
  assert.notEqual(gameHash('a'), gameHash('b'));
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = gameShuffle(list, gameRandom(7));
  assert.deepEqual(shuffled, gameShuffle(list, gameRandom(7)));
  assert.deepEqual([...shuffled].sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5, 6, 7, 8], 'the list stays');
  const n = gameRandom(1)();
  assert.ok(n >= 0 && n < 1);
});

test('gameDay: counted from the first day, over a change of the clock', () => {
  assert.equal(gameDay('2026-11-01', '2026-11-01'), 0);
  assert.equal(gameDay('2026-11-04', '2026-11-01'), 3);
  assert.equal(gameDay('2027-04-01', '2026-11-01'), 151);
  assert.equal(gameDay('2026-10-31', '2026-11-01'), -1);
});

test('paletteDistance: 0 when the work has the colour, by share', () => {
  assert.equal(paletteDistance([colour([50, 0, 0])], [colour([50, 0, 0]), colour([0, 0, 0])]), 0);
  assert.equal(paletteDistance([colour([50, 0, 0])], [colour([60, 0, 0])]), 10);
  assert.equal(paletteDistance([colour([50, 0, 0], 3), colour([10, 0, 0], 1)], [colour([50, 0, 0])]), 10);
});

test('lookalikeDistance: the most similar place decides; how much is going on counts too', () => {
  const crop = { detail: 10, palette: [colour([50, 0, 0])] };
  const place = (lab, detail = 10) => ({ detail, palette: [colour(lab)] });
  assert.equal(lookalikeDistance(crop, { places: [place([90, 0, 0]), place([50, 0, 0])] }), 0, 'one place is enough');
  assert.equal(lookalikeDistance(crop, { places: [place([60, 0, 0])] }), 10);
  assert.equal(lookalikeDistance(crop, { places: [place([50, 0, 0], 30)] }), 10);
  const two = { places: [{ detail: 10, palette: [colour([50, 0, 0], 1), colour([0, 0, 0], 1)] }] };
  assert.equal(lookalikeDistance(crop, two), 12.5, 'a place with another colour besides is not the same: compared both ways');
});

test('rankLookalikes: the closest first; another technique or subject is farther', () => {
  const { works, analyses } = library(4, (i) => [50 + i * 4, 0, 0]);
  const [target, ...pool] = works;
  const crop = analyses[target.id].crops[0];
  const rank = (list, t = target) => rankLookalikes({ target: t, crop, pool: list, analyses }).map((r) => r.id);
  assert.deepEqual(rank(pool), ['w01', 'w02', 'w03']);
  assert.deepEqual(rank(pool.map((w) => (w.id === 'w01' ? { ...w, technique: 'tuš' } : w))), ['w02', 'w03', 'w01'], 'a drawing among paintings is far');
  const near = rankLookalikes({ target, crop, pool: pool.map((w) => (w.id === 'w01' ? { ...w, technique: 'olej' } : w)), analyses });
  const same = rankLookalikes({ target, crop, pool, analyses });
  assert.equal(near[near.findIndex((r) => r.id === 'w01')].distance - same.find((r) => r.id === 'w01').distance, 6, 'another painting technique is a little farther');
  assert.deepEqual(rank(pool.map((w) => (w.id === 'w01' ? { ...w, tags: ['zvířata'] } : w))), ['w02', 'w01', 'w03']);
  assert.deepEqual(rank(pool.map((w) => (w.id === 'w01' ? { ...w, tags: ['zvířata', 'krajina'] } : w))), ['w01', 'w02', 'w03'], 'one common tag is enough');
  assert.deepEqual(rank(pool.map((w) => ({ ...w, tags: ['x'] })), { ...target, tags: [] }), ['w01', 'w02', 'w03'], 'a target without tags compares colours only');
});

test('rankLookalikes: the colours of the whole work change the order, never the confusion of the levels', () => {
  const { works, analyses } = library(4, (i) => [50 + i * 4, 0, 0]);
  const [target, ...pool] = works;
  const crop = analyses[target.id].crops[0];
  const profile = (warm) => ({ shares: { modra: warm ? 0 : 1, oranzova: warm ? 1 : 0 }, mood: { warm: warm ? 1 : -1, light: 0, vivid: 0 }, analysed: true });
  const t = { ...target, colourProfile: profile(false) };
  // w01 is the closest by the close-up, but all warm against a cool target; w02 and w03 are cool too
  const coloured = pool.map((w) => ({ ...w, colourProfile: profile(w.id === 'w01') }));
  const ranked = rankLookalikes({ target: t, crop, pool: coloured, analyses });
  assert.deepEqual(ranked.map((r) => r.id), ['w02', 'w03', 'w01'], 'the warm w01 drops behind the cool ones');
  const plain = rankLookalikes({ target, crop, pool, analyses });
  for (const r of ranked) assert.equal(r.confusion, plain.find((p) => p.id === r.id).distance, 'confusion without the colours of the whole work');
});

test('techniqueFamily: paintings and drawings, as a player sees them', () => {
  for (const t of ['akvarel', 'olej', 'akvarel a fix', 'akvarel a brush pen', 'Akryl', 'kvaš']) assert.equal(techniqueFamily(t), 'colour', t);
  for (const t of ['tuš', 'brush pen', 'kresba fixem', 'brush pen a pero', 'tisk z výšky', '', undefined]) assert.equal(techniqueFamily(t), 'drawing', String(t));
});

test('chooseDecoys: at full reach the closest ones, otherwise from all of them', () => {
  const ranked = Array.from({ length: 11 }, (_, i) => `w${i}`);
  const pick = (reach, seed = 3) => chooseDecoys({ ranked, count: 3, reach, random: gameRandom(seed) });
  assert.deepEqual([...pick(1)].sort(), ['w0', 'w1', 'w2']);
  assert.ok(new Set(Array.from({ length: 30 }, (_, s) => pick(0, s)).flat()).size > 3);
});

test('inZone: around the middle, away from it, anywhere', () => {
  assert.equal(inZone({ x: 0.5, y: 0.6 }, 'center'), true);
  assert.equal(inZone({ x: 0.9, y: 0.5 }, 'center'), false);
  assert.equal(inZone({ x: 0.9, y: 0.5 }, 'edge'), true);
  assert.equal(inZone({ x: 0.55, y: 0.5 }, 'edge'), false);
  assert.equal(inZone({ x: 0.75, y: 0.5 }, 'center') || inZone({ x: 0.75, y: 0.5 }, 'edge'), false, 'between them, neither');
  assert.equal(inZone({ x: 0.75, y: 0.5 }, 'any'), true);
});

test('confusingCrops: the close-up that others look like comes first', () => {
  const { works, analyses } = library(5, () => [50, 0, 0]);
  const [target, ...pool] = works;
  const clear = { x: 0.2, y: 0.2, size: 0.2, detail: 15, palette: [colour([10, 60, 60])] };
  const similar = analyses[target.id].crops[0];
  analyses[target.id].crops = [clear, similar];
  const [first, second] = confusingCrops({ target, pool, analyses, count: 3 });
  assert.equal(first.crop, similar);
  assert.equal(first.confusion, 0);
  assert.equal(second.crop, clear);
  assert.ok(second.confusion > 50);
});

const LEVEL = { id: 'l', zone: 'any', pick: 'confusing', maxConfusion: 14, options: 4, reach: 1, looks: ['morning-mist', 'dusk'] };

test('gameLevels: from the easiest; harder = smaller close-up, more drops; always 3 × 3 thumbnails', () => {
  const levels = gameLevels();
  assert.deepEqual(levels.map((l) => l.id), ['easy', 'medium', 'hard']);
  for (const [easier, harder] of [[levels[0], levels[1]], [levels[1], levels[2]]]) {
    assert.ok(harder.size < easier.size && harder.drops > easier.drops && harder.lastView < easier.lastView);
  }
  assert.deepEqual(levels.map((l) => l.options), [9, 9, 9], 'the same grid in every level: everything fits on a phone');
  assert.deepEqual(levels.map((l) => l.hints), [true, false, false], 'only the easy level rules out more');
  const looks = new Map(gameLooks().map((look) => [look.id, look]));
  for (const level of levels) {
    assert.equal(level.looks.length, 5, `${level.id}: five looks`);
    assert.ok(level.looks.every((id) => looks.get(id)?.level === level.id), `${level.id}: only its own looks`);
  }
  assert.ok(levels[0].looks.includes('clear'), 'the easy level may be clean');
  assert.ok(levels[2].looks.every((id) => looks.get(id).effect && looks.get(id).colour), 'the hard level always deforms and its colours always lie');
});

test('prepareLevel: a work nothing looks like is no answer, but is a thumbnail; only what the page needs', () => {
  const { works, analyses } = library(8, (i) => (i === 0 ? [10, 70, 70] : [50, i, 0]));
  const answers = prepareLevel({ level: LEVEL, works, analyses });
  assert.ok(!answers.w00, 'nothing looks like it');
  assert.equal(Object.keys(answers).length, 7);
  assert.deepEqual(Object.keys(answers.w01[0]), ['crop', 'ranked']);
  assert.deepEqual(answers.w01[0].crop, { x: 0.5, y: 0.5, size: 0.2, colours: ['#000000'] });
  assert.equal(answers.w01[0].ranked[0], 'w02');
  assert.ok(answers.w01[0].ranked.includes('w00'));
  assert.deepEqual(prepareLevel({ level: { ...LEVEL, maxConfusion: -1 }, works, analyses }), {});
});

test('prepareLevel: the zone and the pick of the level; a work without analysis is left out', () => {
  const { works, analyses } = library(6);
  analyses.w00.crops = [{ x: 0.9, y: 0.5, size: 0.2, detail: 5, palette: [colour([50, 0, 0])] }, { x: 0.5, y: 0.5, size: 0.2, detail: 20, palette: [colour([50, 0, 0])] }, { x: 0.5, y: 0.45, size: 0.2, detail: 40, palette: [colour([50, 0, 0])] }];
  delete analyses.w05;
  const clear = prepareLevel({ level: { ...LEVEL, pick: 'clear', zone: 'center' }, works, analyses });
  assert.deepEqual(clear.w00.map((c) => c.crop.y), [0.45, 0.5], 'the most detailed first, none from the edge');
  assert.ok(!clear.w05);
  assert.ok(!clear.w00[0].ranked.includes('w05'));
  const edge = prepareLevel({ level: { ...LEVEL, pick: 'clear', zone: 'edge' }, works, analyses });
  assert.deepEqual(Object.keys(edge), ['w00'], 'no close-up in the zone = no answer');
  const few = prepareLevel({ level: { ...LEVEL, options: 7 }, works, analyses });
  assert.deepEqual(few, {}, 'too few works for the thumbnails');
});

test('candidatePool: every work up to the limit (the same list); over it the nearest by the whole work', () => {
  const { works } = library(10);
  works.slice(5).forEach((w) => Object.assign(w, { technique: 'olej', tags: ['zatisi'] }));
  const [target, ...pool] = works;
  assert.equal(candidatePool(target, pool, 9), pool, 'not over the limit: untouched, the games prepared so far stay the same');
  assert.equal(candidatePool(target, pool), pool, 'today (GAME_CANDIDATES over the number of works) untouched');
  assert.ok(GAME_CANDIDATES >= 100);
  assert.deepEqual(candidatePool(target, pool, 4).map((w) => w.id), ['w01', 'w02', 'w03', 'w04'], 'the same technique and subject first');
  assert.deepEqual(candidatePool(target, [...pool].reverse(), 4).map((w) => w.id).sort(), ['w01', 'w02', 'w03', 'w04'], 'whatever the order of the pool');
});

test('prepareLevel: a close-up compared with the candidates only; the plan may take more confusing ones (planConfusion)', () => {
  const { works, analyses } = library(10);
  works.slice(5).forEach((w) => Object.assign(w, { technique: 'olej', tags: ['zatisi'] }));
  const narrow = prepareLevel({ level: LEVEL, works, analyses, candidates: 8 });
  assert.equal(narrow.w00[0].ranked.length, 8);
  assert.deepEqual([...narrow.w00[0].ranked].sort(), candidatePool(works[0], works.slice(1), 8).map((w) => w.id).sort(), 'the farthest work left out');
  assert.deepEqual(prepareLevel({ level: LEVEL, works, analyses, candidates: 9 }), prepareLevel({ level: LEVEL, works, analyses }), 'all of them = as before');
  const strict = { ...LEVEL, maxConfusion: -1, planConfusion: 1000 };
  assert.deepEqual(prepareLevel({ level: strict, works, analyses }), {}, 'the answers keep maxConfusion');
  assert.equal(Object.keys(prepareLevel({ level: strict, works, analyses, plan: true })).length, 10, 'the places of the plan take planConfusion');
  assert.deepEqual(prepareLevel({ level: { ...LEVEL, maxConfusion: -1 }, works, analyses, plan: true }), {}, 'without planConfusion the plan keeps maxConfusion');
});

test('inZone: the middle of the picture, wider when asked (the plan of the easy level)', () => {
  const crop = { x: 0.5 + 0.235, y: 0.5 };
  assert.equal(inZone(crop, 'center'), false);
  assert.equal(inZone(crop, 'center', 0.25), true);
  assert.equal(inZone({ x: 0.5, y: 0.5 + 0.26 }, 'center', 0.25), false);
  assert.equal(inZone(crop, 'edge', 0.25), false, 'the edge stays the same');
});

test('prepareLevel: the plan takes a wider middle with planCentre, the answers keep theirs', () => {
  const { works, analyses } = library(8);
  analyses.w00.crops = [{ x: 0.5, y: 0.735, size: 0.2, detail: 30, palette: [colour([50, 0, 0])] }, { x: 0.5, y: 0.5, size: 0.2, detail: 20, palette: [colour([50, 0, 0])] }];
  const level = { ...LEVEL, pick: 'clear', zone: 'center', planCentre: 0.25 };
  assert.deepEqual(prepareLevel({ level, works, analyses, keep: 20 }).w00.map((c) => c.crop.y), [0.5]);
  assert.deepEqual(prepareLevel({ level, works, analyses, keep: 20, plan: true }).w00.map((c) => c.crop.y), [0.735, 0.5]);
});

test('gameLevels: the easy level takes a wider middle into the plan, a little over its answers', () => {
  const easy = gameLevels().find((l) => l.id === 'easy');
  assert.equal(easy.zone, 'center');
  assert.ok(easy.planCentre > 0.22 && easy.planCentre < 0.28, 'between the middle of the answers and the edge');
  assert.deepEqual(gameLevels().map((l) => l.planCentre ?? null), [0.25, null, null]);
});

test('gameLevels: only the hard level takes more confusing places into the plan, a little over its answers', () => {
  const levels = gameLevels();
  assert.deepEqual(levels.map((l) => l.planConfusion ?? null), [null, null, 18]);
  const hard = levels.find((l) => l.id === 'hard');
  assert.ok(hard.planConfusion > hard.maxConfusion && hard.planConfusion - hard.maxConfusion <= 4);
});

/** Answers of a level: every work with the others as lookalikes. */
const answersOf = (n) => {
  const ids = Array.from({ length: n }, (_, i) => `w${String(i).padStart(2, '0')}`);
  return Object.fromEntries(ids.map((id) => [id, [{ crop: { x: 0.5, y: 0.5, size: 0.2, colours: ['#111111'] }, ranked: ids.filter((other) => other !== id) }]]));
};

test('puzzleForLevel: the same for everyone, the answer among the options, no repeat before all had a turn', () => {
  const answers = answersOf(12);
  const puzzle = puzzleForLevel({ day: 5, level: LEVEL, answers });
  assert.deepEqual(puzzle, puzzleForLevel({ day: 5, level: LEVEL, answers: Object.fromEntries(Object.entries(answers).reverse()) }), 'the order does not matter');
  assert.equal(puzzle.optionIds.length, 4);
  assert.equal(new Set(puzzle.optionIds).size, 4);
  assert.ok(puzzle.optionIds.includes(puzzle.targetId));
  const look = gameLooks().find((l) => l.id === puzzle.look);
  assert.ok(LEVEL.looks.includes(puzzle.look) && look.effect === puzzle.effect && look.colour === puzzle.colour, 'a look of the level with its effect and colours');
  const targets = Array.from({ length: 12 }, (_, day) => puzzleForLevel({ day, level: LEVEL, answers }).targetId);
  assert.equal(new Set(targets).size, 12);
  assert.equal(puzzleForLevel({ day: 12, level: LEVEL, answers }).targetId, targets[0], 'then again from the start');
  assert.ok(answers[puzzleForLevel({ day: -1, level: LEVEL, answers }).targetId], 'a day before the first works too');
  assert.equal(puzzleForLevel({ day: 0, level: LEVEL, answers: {} }), null);
});

test('puzzleForLevel: a taken work waits; all taken = no puzzle', () => {
  const answers = answersOf(5);
  const first = puzzleForLevel({ day: 0, level: LEVEL, answers });
  assert.notEqual(puzzleForLevel({ day: 0, level: LEVEL, answers, taken: [first.targetId] }).targetId, first.targetId);
  assert.equal(puzzleForLevel({ day: 0, level: LEVEL, answers, taken: Object.keys(answers) }), null);
});

test('dailyPuzzles: three different works every day, a level without answers has none', () => {
  const levels = [LEVEL, { ...LEVEL, id: 'm' }, { ...LEVEL, id: 'n' }];
  const prepared = { l: answersOf(6), m: answersOf(6), n: answersOf(6) };
  for (let day = 0; day < 20; day++) {
    const puzzles = dailyPuzzles({ day, levels, prepared });
    assert.equal(new Set(levels.map((l) => puzzles[l.id].targetId)).size, 3, `day ${day}`);
  }
  assert.equal(dailyPuzzles({ day: 0, levels, prepared: { l: answersOf(6) } }).m, null);
});

test('puzzleForLevel: only the looks of the level, all of them in time', () => {
  const answers = answersOf(12);
  const level = { ...LEVEL, looks: ['morning-mist', 'curtain', 'clear'] };
  const seen = new Set(Array.from({ length: 200 }, (_, day) => puzzleForLevel({ day, level, answers }).look));
  assert.deepEqual([...seen].sort(), ['clear', 'curtain', 'morning-mist']);
});

test('lookForDay: every look as often as the others, never on two days in a row', () => {
  const level = { id: 'l', looks: ['a', 'b', 'c', 'd', 'e'] };
  const days = Array.from({ length: 400 }, (_, i) => lookForDay({ level, day: i - 50 }));
  for (let i = 1; i < days.length; i++) assert.notEqual(days[i], days[i - 1], `day ${i - 50}`);
  for (let start = 0; start < 400; start += 5) assert.equal(new Set(days.slice(start, start + 5)).size, 5, 'each block has all of them');
  assert.equal(lookForDay({ level, day: 7 }), lookForDay({ level, day: 7 }), 'the same for everyone');
  assert.notDeepEqual(days.slice(50, 70), Array.from({ length: 20 }, (_, i) => lookForDay({ level: { ...level, id: 'm' }, day: i })), 'each level its own order');
  assert.deepEqual([0, 1, 2, 3].map((day) => lookForDay({ level: { id: 'l', looks: ['a', 'b'] }, day })), ['a', 'b', 'a', 'b'], 'two looks alternate');
  assert.equal(lookForDay({ level: { id: 'l', looks: ['a'] }, day: 3 }), 'a');
});

test('dropsWord: Czech plural of the drops', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 11, 22, 100].map(dropsWord), ['kapek', 'kapka', 'kapky', 'kapky', 'kapky', 'kapek', 'kapek', 'kapek', 'kapek']);
});

test('gameLooks: unique names and pairs, five for each level, each pair in one level only', () => {
  const looks = gameLooks();
  assert.equal(new Set(looks.map((l) => l.id)).size, looks.length);
  assert.equal(new Set(looks.map((l) => l.label)).size, looks.length);
  assert.equal(new Set(looks.map((l) => lookKey([l.effect, l.colour]))).size, looks.length, 'no pair under two names');
  for (const level of ['easy', 'medium', 'hard']) assert.equal(looks.filter((l) => l.level === level).length, 5, level);
  const effects = new Set([null, 'mist', 'raster', 'pixel', 'wave']);
  const colours = new Set([null, 'gray', 'sepia', 'hue']);
  assert.ok(looks.every((l) => effects.has(l.effect) && colours.has(l.colour)), 'only effects and colours effectStyle knows');
  assert.ok(!looks.some((l) => l.effect === 'mist' && l.colour === 'sepia'), 'mist in sepia leaves nothing to see');
});

test('lookKey: a pair as short text', () => {
  for (const [look, key] of [[[null, null], 'none'], [['mist', null], 'mist'], [['raster', 'gray'], 'raster/gray'], [[null, 'hue'], 'none/hue']]) assert.equal(lookKey(look), key);
});

test('effectStrength: full at the first guess, nothing at the last one', () => {
  assert.deepEqual([0, 1, 2, 3].map((m) => Math.round(effectStrength(m, 4) * 100)), [100, 67, 33, 0]);
  assert.deepEqual([0, 1, 2].map((m) => effectStrength(m, 3)), [1, 0.5, 0]);
  assert.equal(effectStrength(0, 4, true), 0, 'the end of the round');
  assert.equal(effectStrength(9, 4), 0);
  assert.equal(effectStrength(0, 1), 1, 'one guess only');
});

test('effectStyle: each effect and colour by the settings, nothing without strength', () => {
  const settings = effectSettings();
  assert.deepEqual(effectStyle(null, null, 1), { filter: '', mask: '', wave: 0, pixels: 0 });
  assert.deepEqual(effectStyle('mist', 'gray', 1, settings, 500), { filter: `grayscale(1) blur(${settings.mist * 5}px)`, mask: '', wave: 0, pixels: 0 });
  assert.equal(effectStyle('mist', null, 0.5, { ...settings, mist: 2 }, 200).filter, 'blur(2px)');
  assert.deepEqual(effectStyle('wave', 'hue', 0.5, { ...settings, wave: 4, hue: 100 }, 500), { filter: 'hue-rotate(50deg) url(#game-wave)', mask: '', wave: 10, pixels: 0 });
  assert.equal(effectStyle(null, 'sepia', 1).filter, 'sepia(1)');
  assert.deepEqual(effectStyle('raster', 'gray', 0), { filter: '', mask: '', wave: 0, pixels: 0 });
  assert.deepEqual(effectStyle('wave', null, 0.5, { ...settings, wave: 0, pixels: 0 }), { filter: '', mask: '', wave: 0, pixels: 0 }, 'no wave, no filter');
});

test('effectStyle: the blur and the wave are shares of the window, the same look in a small and a big one', () => {
  const settings = { ...effectSettings(), mist: 1, wave: 4 };
  assert.equal(effectStyle('mist', null, 1, settings, 250).filter, 'blur(2.5px)');
  assert.equal(effectStyle('mist', null, 1, settings, 500).filter, 'blur(5px)');
  assert.equal(effectStyle('mist', null, 1, settings).filter, 'blur(3.6px)', 'a window of a prototype: 360 px');
  assert.equal(effectStyle('wave', null, 1, settings, 250).wave, 10);
  assert.equal(effectStyle('wave', null, 1, settings, 500).wave, 20);
});

test('waveRipple: about 6 ripples across and 10 down in a window of any size', () => {
  assert.equal(waveRipple(500), '0.012 0.02');
  assert.equal(waveRipple(250), '0.024 0.04');
  assert.equal(waveRipple(0), '6 10', 'no window: no division by zero');
});

test('effectStyle: the raster has the step of the settings and its dots grow as it weakens', () => {
  const settings = { ...effectSettings(), rasterStep: 8, rasterDot: 100 };
  assert.equal(effectStyle('raster', null, 1, settings).mask, 'radial-gradient(circle closest-side, #000 100%, transparent 104%) 0 0 / 8% 8%');
  assert.match(effectStyle('raster', null, 0.5, settings).mask, /#000 121%/);
});

test('effectStyle: the mosaic has finer blocks as it weakens, none at the end', () => {
  const settings = { ...effectSettings(), pixelStep: 5 };
  assert.deepEqual(effectStyle('pixel', null, 1, settings), { filter: '', mask: '', wave: 0, pixels: 20 });
  assert.equal(effectStyle('pixel', null, 0.5, settings).pixels, 40);
  assert.equal(effectStyle('pixel', null, 0, settings).pixels, 0);
  assert.equal(effectStyle('pixel', 'gray', 1, settings).filter, 'grayscale(1)', 'with colours');
  assert.equal(effectStyle('mist', null, 1, settings).pixels, 0);
});

test('windowHtml: the frame in the middle of the window, its effects, a canvas for the mosaic', () => {
  const html = windowHtml({ src: 'a.jpg', ratio: 1, frame: { x: 0.5, y: 0.5, size: 0.5 }, style: { filter: 'blur(2px) url(#game-wave)', mask: 'm', wave: 9, pixels: 0 }, zoom: 0.5, waveId: 'wave-9' });
  assert.match(html, /--zoom:0\.5/);
  assert.match(html, /translate\(-180px,-180px\) scale\(2\)/);
  assert.match(html, /<div class="clip" style="mask:m;-webkit-mask:m;"><div class="view" style="filter:blur\(2px\) url\(#wave-9\)">/, 'the raster on the window, the filter on what reaches beyond it');
  assert.ok(!html.includes('<canvas'));
  const mosaic = windowHtml({ src: 'a.jpg', ratio: 1, frame: { x: 0.5, y: 0.5, size: 0.5 }, style: { filter: '', mask: '', wave: 0, pixels: 30 } });
  assert.match(mosaic, /<canvas data-frame='\{"x":0\.5,"y":0\.5,"size":0\.5\}' data-blocks="30">/);
});

test('representativeSample: different colours and techniques, always the same, answers only', () => {
  const places = (lab, detail = 10) => ({ places: [{ detail, palette: [{ lab, weight: 1 }] }] });
  const works = [
    { id: 'a', technique: 'akvarel' }, { id: 'b', technique: 'akvarel' }, { id: 'c', technique: 'akvarel' },
    { id: 'd', technique: 'kresba' }, { id: 'e', technique: 'akvarel' }, { id: 'f', technique: 'akvarel' },
  ];
  const analyses = { a: places([50, 0, 0]), b: places([52, 0, 0]), c: places([90, 0, 0]), d: places([50, 1, 0]), e: places([20, 40, 40]), f: places([51, 0, 0]) };
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const sample = representativeSample({ works, analyses, ids, count: 4 });
  assert.equal(sample.length, 4);
  assert.ok(!sample.includes('f'), 'not an answer');
  assert.ok(sample.includes('d') && sample.includes('c') && sample.includes('e'), 'the other technique and the far colours');
  assert.ok(!(sample.includes('a') && sample.includes('b')), 'not two of the same');
  assert.deepEqual(representativeSample({ works: [...works].reverse(), analyses, ids, count: 4 }), sample, 'the order does not matter');
  assert.deepEqual(representativeSample({ works, analyses, ids: [], count: 4 }), []);
  assert.equal(representativeSample({ works, analyses, ids, count: 99 }).length, 5, 'at most all answers');
  const fixed = representativeSample({ works, analyses, ids, count: 3, fixed: ['b', 'f', 'a'] });
  assert.deepEqual(fixed.slice(0, 2), ['b', 'a'], 'picked by hand first, one that is no answer skipped');
  assert.equal(fixed.length, 3);
  assert.ok(!fixed.includes('f'));
});

test('frameSource: the square of the frame in px of the picture, by its shorter side', () => {
  assert.deepEqual(frameSource({ x: 0.5, y: 0.5, size: 0.5 }, 1000, 500), { x: 375, y: 125, side: 250 });
  assert.deepEqual(frameSource({ x: 0.5, y: 0.25, size: 0.5 }, 500, 1000), { x: 125, y: 125, side: 250 });
});

test('drawPixels: the frame of the picture into blocks × blocks', () => {
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const canvas = { getContext: () => context };
  const img = { naturalWidth: 1000, naturalHeight: 500 };
  drawPixels(canvas, img, { x: 0.5, y: 0.5, size: 0.5 }, 20);
  assert.deepEqual([canvas.width, canvas.height], [20, 20]);
  assert.deepEqual(calls, [[img, 375, 125, 250, 250, 0, 0, 20, 20]]);
  assert.equal(context.imageSmoothingEnabled, true, 'blocks are averages');
});

test('gameFrame: from the close-up out, by hand only inside the picture', () => {
  const free = { margin: 0, bottom: 0 };
  const crop = { x: 0.95, y: 0.5, size: 0.2 };
  const first = gameFrame(crop, 0, 3, 1, 0.5, free);
  assert.equal(first.size, 0.2);
  assert.equal(first.x, 0.9, 'moved in');
  const sizes = [0, 1, 2, 3].map((m) => gameFrame(crop, m, 3, 1, 0.5, free).size);
  assert.deepEqual([...sizes].sort((a, b) => a - b), sizes);
  assert.ok(Math.abs(sizes[3] - 0.5) < 1e-9, 'even the last view is not the whole work');
  assert.equal(gameFrame({ x: 0.01, y: 0.5, size: 0.2 }, 0, 3, 0.5, 0.5, free).x, 0.05, 'on a wide picture the size is a share of its height');
});

test('gameFrame: no view of a puzzle ever shows the edges, the title or the signature', () => {
  const near = (a, b) => a >= b - 1e-9;
  for (const ratio of [0.5, 0.75, 1, 1.4]) {
    for (const [x, y] of [[0, 0], [1, 1], [0.5, 0.95], [0.02, 0.6]]) {
      for (const last of [0.35, 0.5, 0.85]) {
        for (let misses = 0; misses <= 3; misses++) {
          const f = gameFrame({ x, y, size: 0.11 }, misses, 3, ratio, last);
          const [halfX, halfY] = [(f.size * Math.min(1, ratio)) / 2, (f.size * Math.min(1, 1 / ratio)) / 2];
          assert.ok(near(f.x - halfX, 0.08) && near(0.92, f.x + halfX), `left and right: ${ratio} ${x} ${last} ${misses}`);
          assert.ok(near(f.y - halfY, 0.08) && near(0.82, f.y + halfY), `top and bottom: ${ratio} ${y} ${last} ${misses}`);
        }
      }
    }
  }
  assert.ok(Math.abs(gameFrame({ x: 0.5, y: 0.5, size: 0.24 }, 3, 3, 0.75, 0.85).size - 0.74) < 1e-9, 'a view too big for the safe part shrinks to fit');
  assert.equal(gameFrame({ x: 0.5, y: 0.5, size: 0.24 }, 0, 3, 1, 0.85).size, 0.24, 'the close-up itself stays');
});

test('gameHint: at most a few works, otherwise no hint', () => {
  const target = { id: 't', year: 2026, technique: 'akvarel', collection: '', collectionTitle: '' };
  const others = ['a', 'b', 'c'].map((id) => ({ ...target, id, year: 2025 }));
  assert.equal(gameHint(target, [target, ...others]), null, 'it would rule out too many');
  assert.deepEqual(Object.keys(gameHint(target, [target, ...others], 3).reasons), ['a', 'b', 'c']);
});

test('gameHint: rules out the fewest, never the answer, each with its own reason; nothing to rule out = no hint', () => {
  const target = { id: 't', year: 2026, technique: 'akvarel', collection: 'a', collectionTitle: 'Plenér' };
  const works = [target, { ...target, id: 'x', year: 2025 }, { ...target, id: 'y', year: 2024, collection: 'b', collectionTitle: 'Kurz' }];
  assert.deepEqual(gameHint(target, works), { text: 'Hledaný obraz je z kolekce Plenér. Obrazy odjinud jsou vyřazené.', reasons: { y: 'Kurz' } });
  assert.deepEqual(gameHint(target, [target, works[1]]), { text: 'Hledaný obraz je z roku 2026. Obrazy z jiných let jsou vyřazené.', reasons: { x: 'z roku 2025' } });
  assert.deepEqual(gameHint(target, [target, { ...target, id: 'o', technique: 'olej' }]).reasons, { o: 'olej' });
  assert.equal(gameHint(target, [target, { ...target, id: 'x' }]), null);
  const alone = gameHint({ ...target, collection: '', collectionTitle: '' }, [{ ...target, collection: '', collectionTitle: '' }, { ...target, id: 'x' }]);
  assert.deepEqual(alone, { text: 'Hledaný obraz není v žádné kolekci. Obrazy z kolekcí jsou vyřazené.', reasons: { x: 'Plenér' } });
  const inOne = gameHint(target, [target, { ...target, id: 'z', collection: '', collectionTitle: '' }]);
  assert.deepEqual(inOne.reasons, { z: 'bez kolekce' });
});

test('applyGuess: a miss rules out with a hint, a hit ends it, the last miss ends it, an impossible guess changes nothing', () => {
  const base = { technique: 'akvarel', collection: '', collectionTitle: '' };
  const works = [{ ...base, id: 't', year: 2026 }, { ...base, id: 'a', year: 2026 }, { ...base, id: 'b', year: 2025 }, { ...base, id: 'c', year: 2026 }, { ...base, id: 'd', year: 2026 }];
  const puzzle = { targetId: 't' };
  const miss = applyGuess(newRound(), puzzle, works, 'a');
  assert.deepEqual(miss.ruledOut, ['a', 'b']);
  assert.deepEqual(miss.hints, ['Hledaný obraz je z roku 2026. Obrazy z jiných let jsou vyřazené.']);
  assert.deepEqual(miss.reasons, { b: 'z roku 2025' }, 'the guess itself has no reason, only what the hint ruled out');
  assert.equal(miss.over, false);
  assert.equal(applyGuess(miss, puzzle, works, 'a'), miss, 'the same again');
  assert.equal(applyGuess(miss, puzzle, works, 'b'), miss, 'ruled out');
  const win = applyGuess(miss, puzzle, works, 't');
  assert.deepEqual([win.solved, win.over, win.guesses], [true, true, ['a', 't']]);
  assert.equal(applyGuess(win, puzzle, works, 'c'), win, 'after the end');
  const lost = applyGuess(applyGuess(miss, puzzle, works, 'c'), puzzle, works, 'd', 3);
  assert.deepEqual([lost.solved, lost.over], [false, true]);
});

test('applyGuess: without hints a miss rules out only the guess', () => {
  const base = { technique: 'akvarel', collection: '', collectionTitle: '' };
  const works = [{ ...base, id: 't', year: 2026 }, { ...base, id: 'a', year: 2026 }, { ...base, id: 'b', year: 2025 }];
  const miss = applyGuess(newRound(), { targetId: 't' }, works, 'a', 4, false);
  assert.deepEqual([miss.ruledOut, miss.hints], [['a'], []]);
});

test('dropsFor, winTitle: fewer misses = more; a series adds up to 5; the archive gives half', () => {
  assert.deepEqual([0, 1, 2, 3].map((m) => dropsFor(m, 1)), [10, 6, 3, 1]);
  assert.equal(dropsFor(0, 3), 12);
  assert.equal(dropsFor(0, 50), 15);
  assert.equal(dropsFor(1, 50, true), 3);
  assert.equal(dropsFor(0, 3, false, 3), 36, 'times the level');
  assert.equal(dropsFor(1, 1, true, 2), 6);
  assert.equal(winTitle(0), 'Mistrovské oko!');
  assert.equal(winTitle(9), 'Trefa!');
});

test('gameRank: by the drops, with the next one; stars past the last rank, never an end', () => {
  assert.deepEqual(gameRank(0), { index: 0, title: 'Vylitý kelímek', next: 60, nextTitle: 'Mokrý štětec' });
  assert.equal(gameRank(59).title, 'Vylitý kelímek');
  assert.equal(gameRank(60).title, 'Mokrý štětec');
  assert.deepEqual(gameRank(149799), { index: 20, title: 'Legenda ateliéru', next: 149800, nextTitle: 'Druhé oko autorky' });
  assert.deepEqual(gameRank(149800), { index: 21, title: 'Druhé oko autorky', next: 166000, nextTitle: 'Druhé oko autorky ★2' });
  assert.deepEqual(gameRank(166000 + 16200 * 3), { index: 25, title: 'Druhé oko autorky ★5', next: 166000 + 16200 * 4, nextTitle: 'Druhé oko autorky ★6' });
});

test('gameRanks: a perfect player reaches each after days, then weeks, then months, never more than half a year apart', () => {
  const ranks = gameRanks();
  assert.equal(new Set(ranks.map(([, t]) => t)).size, ranks.length, 'unique titles');
  // the drops of a player who solves all three levels at the first guess every day (the series full from day 6)
  const perDay = (d) => gameLevels().reduce((sum, l) => sum + dropsFor(0, d, false, l.drops), 0);
  const dayOf = (drops) => { let total = 0; let d = 0; while (total < drops) total += perDay(++d); return d; };
  const days = ranks.slice(1).map(([from]) => dayOf(from));
  assert.deepEqual(days, [1, 3, 6, 10, 15, 22, 32, 46, 66, 96, 136, 196, 286, 406, 586, 766, 946, 1126, 1306, 1486, 1666]);
  const gaps = days.map((d, i) => d - (days[i - 1] ?? 0));
  assert.ok(gaps.every((g, i) => g <= 180 && (i === 0 || g >= gaps[i - 1])), 'the gaps grow, at most half a year');
  assert.equal(perDay(6) * 180, 16200, 'a star past the last one = half a year too');
});

/** The first day of the game in the tests of the progress: day 0 = 2026-305, the key of a day = 2026-(305 + day). */
const E = '2026-11-01';

test('roundKey, roundOrder: the key of a round by the key of its day (as in the plan), in order', () => {
  assert.equal(roundKey(15, 'easy', E), '2026-320:easy');
  assert.equal(roundKey(61, 'hard', E), '2027-1:hard');
  assert.ok(roundOrder('2027-1:hard') > roundOrder('2026-365:easy'));
  assert.ok(roundOrder('2026-320:easy') > roundOrder('2026-99:easy'), 'by the number, not as text');
  assert.ok(Number.isNaN(roundOrder('15:easy')));
});

test('finishRound: drops by the level and the collection; each puzzle once, each level of a day apart', () => {
  const win = { day: 3, today: 3, level: 'hard', epoch: E, multiplier: 3, solved: true, misses: 0, workId: 'w' };
  const first = finishRound(newProgress(), win);
  assert.equal(first.gained, 30);
  assert.deepEqual(first.progress.collected, ['w']);
  assert.equal('pigments' in first.progress, false, 'the colours come from the rounds now (gameCollection)');
  assert.deepEqual(first.progress.played['2026-308:hard'], { solved: true, misses: 0, drops: 30 });
  assert.equal(first.progress.lastDay, '2026-308', 'the last day of the series by its key');
  const again = finishRound(first.progress, win);
  assert.equal(again.progress, first.progress, 'already played');
  assert.equal(again.gained, 0);
  const other = finishRound(first.progress, { ...win, level: 'easy', multiplier: 1, workId: 'x' });
  assert.equal(other.gained, 10);
  assert.equal(other.progress.streak, 1, 'more games on one day are one day of the series');
});

test('finishRound: the series goes on day by day, survives a lost game, restarts after a gap, ignores the archive', () => {
  const play = (progress, day, today = day, solved = true) => finishRound(progress, { day, today, level: 'l', epoch: E, solved, misses: 0, workId: `w${day}` }).progress;
  let p = play(newProgress(), 1);
  p = play(p, 2);
  assert.equal(p.streak, 2);
  p = play(p, 3, 3, false);
  assert.deepEqual([p.streak, p.drops], [3, 21], 'lost: no drops, the series goes on');
  assert.deepEqual(p.collected, ['w1', 'w2'], 'lost: nothing collected');
  const archive = play(p, 0, 3);
  assert.deepEqual([archive.streak, archive.lastDay, archive.drops], [3, '2026-308', 26], 'the archive leaves the series alone, half the drops');
  p = play(p, 9);
  assert.deepEqual([p.streak, p.best], [1, 3], 'a day left out starts a new series');
  let year = play(newProgress(), 60);
  year = play(year, 61);
  assert.deepEqual([year.streak, year.lastDay], [2, '2027-1'], 'the series goes on over New Year (2026-365 → 2027-1)');
});

test('finishRound: says when a new rank is reached', () => {
  const near = { ...newProgress(), drops: 55 };
  assert.equal(finishRound(near, { day: 1, today: 1, level: 'l', epoch: E, solved: true, misses: 0, workId: 'w' }).rankUp, true);
  assert.equal(finishRound(near, { day: 1, today: 1, level: 'l', epoch: E, solved: false, misses: 4, workId: 'w' }).rankUp, false);
});

test('gameShareText: the day, the level, a mark for each guess and a few words on how it went, no name of the work', () => {
  assert.equal(gameShareText({ label: '2026#316', level: 'Těžká', misses: 1, solved: true, guesses: 3, url: 'https://x.cz' }), 'Detail dne 2026#316 · Těžká 🟨🟩\nNa druhý pokus.\nPoznáš obraz podle detailu?\nhttps://x.cz');
  const words = (o) => gameShareText({ label: 'x', level: 'Lehká', guesses: 4, url: 'u', ...o }).split('\n')[1];
  assert.equal(words({ misses: 0, solved: true }), 'Hned napoprvé!');
  assert.equal(words({ misses: 1, solved: true }), 'Na druhý pokus.');
  assert.equal(words({ misses: 2, solved: true }), 'Na třetí pokus, bylo to těsné.');
  assert.equal(words({ misses: 3, solved: true }), 'Až na poslední pokus, uf!');
  assert.equal(words({ misses: 2, solved: true, guesses: 3 }), 'Až na poslední pokus, uf!', 'the hard level has three tries');
  assert.equal(words({ misses: 4, solved: false }), 'Tentokrát vyhrál obraz.');
  assert.equal(words({ misses: 0, solved: true, perfect: true }), 'Všechny tři obtížnosti napoprvé! 🎉');
  assert.match(gameShareText({ label: '2026#305', level: 'Lehká', misses: 4, solved: false, url: 'u' }), /^Detail dne 2026#305 · Lehká 🟨🟨🟨🟨\n/);
});

test('roundPuzzle / keptPuzzle: a played day stays as it was while its works are on the site', () => {
  const computed = { day: 3, level: 'easy', targetId: 'n', crop: { x: 0.4 }, optionIds: ['n', 'm'], look: 'clear', effect: 'none', colour: 'none' };
  const old = { day: 3, level: 'easy', targetId: 'a', crop: { x: 0.5, y: 0.5, size: 0.2, colours: ['#fff'] }, optionIds: ['b', 'a', 'c'], look: 'mosaic', effect: 'pixel', colour: null };
  const kept = roundPuzzle(old);
  assert.deepEqual(kept, { targetId: 'a', crop: old.crop, optionIds: ['b', 'a', 'c'], look: 'mosaic' });
  assert.deepEqual(JSON.parse(JSON.stringify(kept)), kept, 'it goes into the storage as it is');
  const all = () => true;
  assert.deepEqual(keptPuzzle({ computed, round: { puzzle: kept }, hasWork: all, day: 3, level: 'easy' }), old);
  assert.equal(keptPuzzle({ computed, round: { puzzle: kept }, hasWork: (id) => id !== 'c', day: 3, level: 'easy' }), computed, 'a work left the site');
  assert.equal(keptPuzzle({ computed, round: { guesses: [] }, hasWork: all, day: 3, level: 'easy' }), computed, 'a round from before');
  assert.equal(keptPuzzle({ computed, round: undefined, hasWork: all, day: 3, level: 'easy' }), computed);
  assert.equal(keptPuzzle({ computed: null, round: undefined, hasWork: all, day: 3, level: 'easy' }), null);
  const gone = keptPuzzle({ computed, round: { puzzle: { ...kept, look: 'no-more' } }, hasWork: all, day: 3, level: 'easy' });
  assert.equal(gone.look, 'clear', 'a look taken out of the catalogue: the one of the day');
});

test('gameDate: back from the number of a day, also over the change of the clock', () => {
  assert.equal(gameDate(0, '2026-11-01'), '2026-11-01');
  assert.equal(gameDate(14, '2026-11-01'), '2026-11-15');
  assert.equal(gameDate(150, '2026-11-01'), '2027-03-31');
  for (const day of [0, 1, 30, 200, 400]) assert.equal(gameDay(gameDate(day, '2026-11-01'), '2026-11-01'), day);
});

test('yearDay, dayId, dayLabel: the year and the number of the day in it', () => {
  assert.deepEqual(yearDay('2026-01-01'), { year: 2026, number: 1 });
  assert.deepEqual(yearDay('2026-11-01'), { year: 2026, number: 305 });
  assert.deepEqual(yearDay('2026-12-31'), { year: 2026, number: 365 });
  assert.deepEqual(yearDay('2028-12-31'), { year: 2028, number: 366 }, 'a leap year');
  assert.equal(dayLabel('2026-11-16'), '2026#320');
  assert.equal(dayId('2026-11-16'), '2026-320');
  assert.equal(dayOfId('2026-320', '2026-11-01'), 15);
  assert.equal(dayOfId('2027-1', '2026-11-01'), 61);
  for (const bad of ['2026#320', '2026-0', '2026-366', '320', '', null, undefined]) assert.equal(dayOfId(bad, '2026-11-01'), null, String(bad));
  assert.equal(dayOfId('2028-366', '2026-11-01'), 791, 'a leap year has 366');
  assert.equal(dayLabel(gameDate(15, '2026-11-01')), '2026#320', 'day 15 of the game = 16 Nov');
});

test('dayFromParam: the key of the day (dayId); today without it, for the future, before the first day and for anything else', () => {
  const epoch = '2026-11-01';
  assert.equal(dayFromParam('2026-305', 14, epoch), 0, '1 Nov 2026');
  assert.equal(dayFromParam('2026-319', 14, epoch), 14);
  assert.equal(dayFromParam('2026#310', 14, epoch), 14, 'only the key');
  assert.equal(dayFromParam('2026-320', 14, epoch), 14, 'tomorrow: today');
  assert.equal(dayFromParam('2026-304', 14, epoch), 14, 'before the first day');
  assert.equal(dayFromParam('2026-0', 14, epoch), 14);
  assert.equal(dayFromParam('2026-366', 400, epoch), 400, '2026 has no day 366');
  assert.equal(dayFromParam('2027-1', 100, epoch), 61, '1 Jan 2027');
  assert.equal(dayFromParam(dayId(gameDate(9, epoch)), 14, epoch), 9, 'there and back');
  assert.equal(dayFromParam('1', 14, epoch), 14, 'no older addresses');
  assert.equal(dayFromParam(null, 14, epoch), 14);
  assert.equal(dayFromParam(undefined, 14, epoch), 14);
});

test('archiveDays: every day before today, the newest first; none on the first day', () => {
  assert.deepEqual(archiveDays(3), [2, 1, 0]);
  assert.deepEqual(archiveDays(0), []);
  assert.deepEqual(archiveDays(-2), []);
});

test('dayMarks: how a day went in each level', () => {
  const levels = gameLevels();
  const played = { '2026-310:easy': { solved: true }, '2026-310:medium': { solved: false }, '2026-310:hard': { solved: true }, '2026-309:easy': { solved: true } };
  assert.deepEqual(dayMarks(played, 5, levels, E), ['solved', 'lost', 'solved']);
  assert.deepEqual(dayMarks(played, 4, levels, E), ['solved', null, null]);
  assert.deepEqual(dayMarks({}, 1, levels, E), [null, null, null]);
  assert.deepEqual(dayMarks({ '5:easy': { solved: true } }, 5, levels, E), [null, null, null], 'the older keys are not read');
});

test('unplayedDays / daysWord: the days of the archive still waiting, the newest first, and their count in words', () => {
  const levels = gameLevels();
  const played = { '2026-307:easy': { solved: true }, ...Object.fromEntries(levels.map((l) => [`2026-306:${l.id}`, { solved: false }])) };
  assert.deepEqual(unplayedDays({ played, levels, before: 4, epoch: E }), [3, 2, 0]);
  assert.deepEqual(unplayedDays({ played, levels, before: 0, epoch: E }), []);
  assert.deepEqual([0, 1, 2, 4, 5, 11].map(daysWord), ['dní', 'den', 'dny', 'dny', 'dní', 'dní']);
});

test('perfectDay: every level of the day solved at the first guess', () => {
  const first = { solved: true, misses: 0, drops: 10 };
  assert.equal(perfectDay([first, first, first]), true);
  assert.equal(perfectDay([first, first, { solved: true, misses: 1 }]), false, 'one miss');
  assert.equal(perfectDay([first, first, { solved: false, misses: 3 }]), false, 'one lost');
  assert.equal(perfectDay([first, first, undefined]), false, 'a level not played yet');
  assert.equal(perfectDay([]), false);
  assert.match(PERFECT_DAY_TEXT, /autorka, nebo výborný znalec jejího díla!$/);
});

test('nextStepsHtml: always two lines, the levels left as buttons, then the archive or what comes next', () => {
  const easy = { id: 'easy', label: 'Lehká' };
  const medium = { id: 'medium', label: 'Střední' };
  const hard = { id: 'hard', label: 'Těžká' };
  const lines = (html) => html.match(/<span class="line">/g).length;
  const two = nextStepsHtml({ left: [medium, hard], label: '2026#320', archive: false, waiting: 0 });
  assert.equal(two, '<span class="line">Ještě můžeš hrát obtížnosti:</span><span class="line"><button class="to-level" type="button" data-level="medium">Střední</button> nebo <button class="to-level" type="button" data-level="hard">Těžká</button></span>');
  const one = nextStepsHtml({ left: [hard], label: '2026#320', archive: true, waiting: 5 });
  assert.equal(one, '<span class="line">Ještě ti zbývá jedna obtížnost:</span><span class="line"><button class="to-level" type="button" data-level="hard">Těžká</button></span>', 'levels first, the archive waits');
  assert.match(nextStepsHtml({ left: [easy, medium, hard], label: 'x', archive: false, waiting: 0 }), />Lehká<\/button>, <button[^>]*>Střední<\/button> nebo <button[^>]*>Těžká</);
  assert.equal(nextStepsHtml({ left: [], label: '2026#320', archive: false, waiting: 16 }), '<span class="line">Dnešní detaily máš za sebou.</span><span class="line"><a class="to-archive" href="#archiv" data-to-archive>V archivu čeká ještě 16 dní ↓</a></span>');
  assert.match(nextStepsHtml({ left: [], label: '2026#310', archive: true, waiting: 1 }), /^<span class="line">Den 2026#310 máš za sebou\.<\/span>.*ještě 1 den ↓/);
  assert.match(nextStepsHtml({ left: [], label: 'x', archive: false, waiting: 3 }), /ještě 3 dny ↓/);
  assert.match(nextStepsHtml({ left: [], label: 'x', archive: false, waiting: 0 }), /Zítra přijdou nové detaily\./);
  assert.match(nextStepsHtml({ left: [], label: '2026#310', archive: true, waiting: 0 }), /Archiv máš celý dohraný\./);
  for (const html of [two, one, nextStepsHtml({ left: [], label: '2026#999', archive: true, waiting: 365 })]) {
    assert.equal(lines(html), 2);
    for (const text of html.split('<span class="line">').slice(1).map((l) => l.replace(/<[^>]+>/g, ''))) assert.ok(text.length <= 32, `short enough for a phone: ${text}`);
  }
});

test('diagnosticsText: the address, then a row a line', () => {
  assert.equal(diagnosticsText([['Den', '#4'], ['Stav', 'pokus 1 z 4']], 'https://x/detail-dne/?den=4'), 'https://x/detail-dne/?den=4\nDen: #4\nStav: pokus 1 z 4');
  assert.equal(diagnosticsText([['Den', '#1']]), 'Den: #1');
});

test('monthGroups: the days by month, the newest first, with how many days still wait; one month = one group', () => {
  assert.deepEqual(monthGroups([14, 13, 0], '2026-11-01'), [{ month: '2026-11', days: [14, 13, 0], waiting: 0 }]);
  const levels = gameLevels();
  const played = { ...Object.fromEntries(levels.map((l) => [`2026-335:${l.id}`, { solved: true }])), '2026-305:easy': { solved: false } };
  assert.deepEqual(monthGroups([32, 30, 29, 0], '2026-11-01', played, levels), [
    { month: '2026-12', days: [32, 30], waiting: 1 },
    { month: '2026-11', days: [29, 0], waiting: 2 },
  ]);
  assert.deepEqual(monthGroups([], '2026-11-01'), []);
});

test('gameDiagnostics: the day, the level, the work, the view of this try and the CSS of the look, as rows', () => {
  const level = gameLevels()[1];
  const puzzle = { targetId: 'a', crop: { x: 0.4, y: 0.3, size: 0.16, colours: ['#112233'] }, optionIds: ['b', 'a', 'c'], look: 'dusk' };
  const work = { id: 'a', title: 'Les', technique: 'akvarel', year: 2026, ratio: 0.75 };
  const titleOf = (id) => ({ a: 'Les', b: 'Louka', c: 'Řeka' })[id];
  const rows = (round, kept) => Object.fromEntries(gameDiagnostics({ day: 3, today: 5, date: '2026-11-04', level, puzzle, round, work, kept, titleOf }));
  const first = rows(newRound(), false);
  assert.equal(first['Den'], '308. den roku 2026 · středa 4. listopadu 2026 · archiv');
  assert.equal(first['Klíč dne'], '2026-308 (v nadpisu 2026#308) · plán game/detail-dne/2026.json, den "2026-308" · adresa ?den=2026-308 · 3. den hry od začátku');
  assert.match(first['Úroveň'], /^Střední \(medium\) · 9 náhledů · 4 pokusy · nápovědy ne · kapky ×2$/);
  assert.match(first['Hádanka'], /^spočítaná pro den/);
  assert.equal(first['Stav'], 'pokus 1 z 4');
  assert.match(first['Vzhled'], /^Za šera \(dusk\) · efekt mist · barvy gray · síla teď 100 %$/);
  assert.equal(first['CSS teď'], `filter: ${effectStyle('mist', 'gray', 1).filter}`);
  assert.equal(first['Pohled teď'], 'střed 40 % × 30 % · velikost 16 %');
  assert.equal(first['Náhledy'], 'Louka (b) · ✓ Les (a) · Řeka (c)');
  assert.equal(first['Tipy'], '–');
  const missed = rows({ ...newRound(), guesses: ['b'], ruledOut: ['b', 'c'] }, true);
  assert.match(missed['Hádanka'], /^uložená v kole hráče/);
  assert.equal(missed['Stav'], 'pokus 2 z 4');
  assert.match(missed['Vzhled'], /síla teď 67 %$/);
  assert.equal(missed['Tipy'], 'Louka (b)');
  assert.equal(missed['Vyřazené nápovědou'], 'Řeka (c)');
  const won = rows({ ...newRound(), guesses: ['b', 'a'], solved: true, over: true }, true);
  assert.equal(won['Stav'], 'uhodnuto po 1 omylech');
  assert.equal(won['Pohled teď'], 'celý obraz');
  assert.equal(won['CSS teď'], 'nic');
  assert.equal(won['Vyřazené nápovědou'], '–');
  assert.equal(rows({ ...newRound(), guesses: ['b', 'c', 'x', 'y'], over: true }, true)['Stav'], 'neuhodnuto');
  assert.equal(rows(newRound(), false)['Den'].endsWith('archiv'), true);
  assert.equal(Object.fromEntries(gameDiagnostics({ day: 5, today: 5, date: '2026-11-06', level, puzzle, round: newRound(), work }))['Den'], '310. den roku 2026 · pátek 6. listopadu 2026 · dnes');
});

test('finishRound: the archive counts at most 30 drops a day, the rest is left out (capped), tomorrow again', () => {
  const today = 10;
  const win = (progress, day, level = 'hard', multiplier = 3, at = today) => finishRound(progress, { day, today: at, level, epoch: E, multiplier, solved: true, misses: 0, workId: `w${day}` });
  let step = win(newProgress(), 1);
  assert.equal(step.gained, 15);
  assert.deepEqual(archiveRoom(step.progress, today, E), { cap: 30, used: 15, left: 15 });
  step = win(step.progress, 2);
  assert.equal(step.gained, 15);
  step = win(step.progress, 3, 'easy', 1);
  assert.equal(step.gained, 0, 'the cap is reached');
  assert.deepEqual(step.progress.played['2026-308:easy'], { solved: true, misses: 0, drops: 0, capped: 5 });
  assert.deepEqual(step.progress.collected, ['w1', 'w2', 'w3'], 'the work goes into the collection all the same');
  assert.equal(step.progress.drops, 30);
  const partial = win({ ...step.progress, archiveDrops: 20 }, 4);
  assert.deepEqual([partial.gained, partial.progress.played['2026-309:hard'].capped], [10, 5], 'only what is left of the cap');
  assert.deepEqual(archiveRoom(step.progress, today + 1, E), { cap: 30, used: 0, left: 30 }, 'a new day, a new cap');
  const tomorrow = win(step.progress, 5, 'hard', 3, today + 1);
  assert.equal(tomorrow.gained, 15);
  const live = finishRound(step.progress, { day: today, today, level: 'hard', epoch: E, multiplier: 3, solved: true, misses: 0, workId: 'x' });
  assert.equal(live.gained, 30, 'today has no cap');
  assert.equal(live.progress.archiveDrops, 30, 'and leaves the cap alone');
  assert.deepEqual(archiveRoom({ drops: 5, played: {} }, today, E).left, 30, 'an older store without the fields');
});

test('statsTitle: a block for the drops, the series, the rank and the archive, blank lines between', () => {
  const text = statsTitle({ drops: 110, streak: 2 });
  const blocks = text.split('\n\n');
  assert.equal(blocks.length, 5);
  assert.equal(blocks[0].split('\n')[0], '💧 110 kapek');
  assert.equal(blocks[1].split('\n')[0], '🔥 Série 2 (2 dny v řadě)');
  assert.equal(blocks[2], '🏅 Hodnost #2 Mokrý štětec\nDo #3 Kapka na papíře zbývá 80 💧.');
  assert.match(blocks[3], /nejvýš 30 💧 za den/);
  assert.match(statsTitle({ drops: 1, streak: 5 }), /💧 1 kapka[\s\S]*Série 5 \(5 dní v řadě\)/);
  assert.match(statsTitle({ drops: 0, streak: 1 }), /Série 1 \(1 den v řadě\)/);
});

test('rankForms: the rank in the top line, from the whole one to the number alone, each shorter', () => {
  const forms = rankForms(130);
  assert.equal(forms[0], 'Hodnost #2 <b>Mokrý štětec</b> · další za 60 💧');
  assert.equal(forms[forms.length - 1], '<b>#2</b>');
  const text = (html) => html.replace(/<[^>]+>/g, '');
  assert.ok(forms.every((f, i) => i === 0 || text(f).length < text(forms[i - 1]).length));
  assert.equal(rankForms(166000)[2], '#23 <b>Druhé oko autorky ★2</b>', 'the stars go on counting');
  assert.equal(rankForms(0)[4], '<b>#1</b>', 'the number as in the list of the rules');
  assert.equal(rankForms(1000)[1], '#5 <b>První skica</b> · další za 250 💧');
  assert.equal(rankForms(100)[0], 'Hodnost #2 <b>Mokrý štětec</b> · další za 90 💧');
  assert.match(rankForms(133600)[0], /další za 16\u00a0200 💧/, 'big numbers grouped by thousands');
});

test('magicWord: the word typed in a row switches, keys that type nothing do not break it', () => {
  let state = { recent: '', matched: false };
  const type = (keys) => { for (const key of keys) state = magicWord(state.recent, key, 'diag'); return state; };
  assert.equal(type(['d', 'i', 'a']).matched, false);
  assert.equal(type(['g']).matched, true);
  state = { recent: '' };
  assert.equal(type(['x', 'D', 'Shift', 'I', 'A', 'ArrowLeft', 'G']).matched, true, 'capitals and Shift as well');
  state = { recent: '' };
  assert.equal(type(['d', 'i', 'x', 'a', 'g']).matched, false, 'another key in between breaks the word');
  assert.equal(type(['d', 'i', 'a', 'g', 'd']).matched, false, 'only once per word');
  assert.equal(magicWord('', 'Enter', 'diag').recent, '');
});

test('tapBurst: five taps within three seconds, then counting again', () => {
  let state = { taps: [] };
  const tap = (now) => { state = tapBurst(state.taps, now); return state.matched; };
  assert.deepEqual([0, 500, 1000, 1500].map(tap), [false, false, false, false]);
  assert.equal(tap(2000), true);
  assert.deepEqual(state.taps, []);
  assert.deepEqual([0, 1000, 2000, 3000].map(tap), [false, false, false, false]);
  assert.equal(tap(4000), false, 'the first tap is too old by now');
  assert.equal(tap(4100), false, 'still only four within three seconds');
  assert.equal(tap(4200), true);
});

test('cappedText: what the cap of the archive took, short', () => {
  assert.equal(cappedText({ gained: 10, capped: 5 }), 'Strop archivu: započteno 10 z 15 💧.');
  assert.equal(cappedText({ gained: 0, capped: 15 }), 'Strop archivu: dnes už bez kapek, další zítra.');
});

test('groupDigits: thousands apart by a non-breaking space, small numbers as they are', () => {
  assert.equal(groupDigits(0), '0');
  assert.equal(groupDigits(810), '810');
  assert.equal(groupDigits(1250), '1\u00a0250');
  assert.equal(groupDigits(16100), '16\u00a0100');
  assert.equal(groupDigits(149800), '149\u00a0800');
  assert.equal(groupDigits(1234567), '1\u00a0234\u00a0567');
});

test('statsTitle and rulesHtml: big numbers grouped by thousands', () => {
  assert.match(statsTitle({ drops: 16100, streak: 3 }), /💧 16\u00a0100 kapek/);
  assert.match(rulesHtml(), /149\u00a0800 💧/);
});

test('archiveRoomTitle: what the cap means for the player', () => {
  assert.match(archiveRoomTitle({ cap: 30, left: 20 }), /dnes ještě 20/);
  assert.match(archiveRoomTitle({ cap: 30, left: 0 }), /Hrát můžeš dál.*nové kapky z archivu dnes už nedostaneš/);
});

test('gamePageHtml: the diagnostics hidden until switched on', async () => {
  const { gamePageHtml } = await import('./detail-game-page.mjs');
  assert.match(gamePageHtml({}), /<section class="shelf diagnostics" data-diagnostics-section hidden>/);
});

test('rulesHtml: the drops of each level and try, the series, the cap of the archive, every rank to mark', () => {
  const html = rulesHtml();
  assert.match(html, /id="pravidla"/);
  assert.match(html, /<th scope="row">Napoprvé<\/th><td>10<\/td><td>20<\/td><td>30<\/td>/);
  assert.match(html, /<th scope="row">Na 4. pokus<\/th><td>1<\/td><td>2<\/td><td>–<\/td>/, 'the hard level has 3 tries');
  assert.match(html, /\+5 \/ \+10 \/ \+15 💧/);
  assert.match(html, /nejvýš 30 💧/);
  assert.equal((html.match(/data-rank="/g) ?? []).length, gameRanks().length);
  assert.match(html, /<li data-rank="2"><span>Kapka na papíře<\/span> <span class="from">190 💧<\/span><\/li>/);
});

test('finishRound: a day of the archive gives half the drops, keeps the series and the last day', () => {
  const today = 10;
  const progress = { ...newProgress(), streak: 4, best: 4, lastDay: '2026-315' };
  const { progress: after, gained } = finishRound(progress, { day: 3, today, level: 'medium', epoch: E, multiplier: 2, solved: true, misses: 0, workId: 'a' });
  assert.equal(gained, dropsFor(0, 4, true, 2));
  assert.equal(gained, 10);
  assert.equal(after.streak, 4);
  assert.equal(after.lastDay, '2026-315');
  assert.deepEqual(after.collected, ['a']);
});

/** A solved (or lost) round of `id` with the colours of its close-up, as rounds keep them. */
const kept = (id, colours, solved = true) => ({ guesses: [], solved, over: true, puzzle: { targetId: id, crop: { x: 0.5, y: 0.5, size: 0.2, colours }, optionIds: [id], look: 'clear' } });

test('gameCollection: solved works the newest first, the colours of their close-ups, each work once', () => {
  const rounds = {
    '2026-308:easy': kept('a', ['#111111', '#222222', '#333333']),
    '2026-308:medium': kept('b', ['#444444']),
    '2026-310:easy': kept('c', ['#555555']),
    '2026-314:hard': kept('d', ['#666666'], false),
    '2027-2:medium': kept('a', ['#333333', '#777777', '#888888']),
  };
  assert.deepEqual(gameCollection({ rounds }), [
    { id: 'a', colours: ['#333333', '#777777', '#888888', '#111111', '#222222'], times: 2 },
    { id: 'c', colours: ['#555555'], times: 1 },
    { id: 'b', colours: ['#444444'], times: 1 },
  ], 'the lost round of d is not in it; a again in 2027 = first, its colours of both close-ups, the newest first, each once');
  assert.equal(gameCollection({ rounds, maxColours: 2 })[0].colours.length, 2, 'at most maxColours');
  assert.deepEqual(gameCollection({ rounds, hasWork: (id) => id !== 'c' }).map((i) => i.id), ['a', 'b'], 'a work gone from the site is left out');
});

test('gameCollection: a work collected before rounds kept their puzzle comes last, without colours; nothing played = empty', () => {
  const rounds = { '2026-309:easy': kept('b', ['#444444']), '2026-310:easy': { guesses: ['x'], solved: true, over: true } };
  assert.deepEqual(gameCollection({ rounds, collected: ['old1', 'b', 'old2'] }), [
    { id: 'b', colours: ['#444444'], times: 1 },
    { id: 'old2', colours: [], times: 1 },
    { id: 'old1', colours: [], times: 1 },
  ]);
  assert.deepEqual(gameCollection({}), []);
});

test('collectionHtml: pictures with their colour dots, the newest limit, the whole collection on demand, escaped', () => {
  const items = Array.from({ length: 14 }, (_, i) => ({ id: `w${i}`, colours: i ? ['#abcdef'] : ['#111111', '#222222'], times: i === 1 ? 3 : 1 }));
  const work = (id) => (id === 'w13' ? null : { title: `Obraz <${id}>`, href: `/tvorba/2026/${id}/`, src: `/${id}/480.webp` });
  const html = collectionHtml({ items, work });
  assert.doesNotMatch(html, /z \d+ obraz|kompletní/, 'no count of works: the game asks for details');
  assert.equal(html.match(/class="piece"/g).length, 12, 'the newest 12');
  assert.match(html, /<a class="piece" href="\/tvorba\/2026\/w0\/" title="Obraz &lt;w0&gt;"><img src="\/w0\/480.webp" alt="Obraz &lt;w0&gt;" loading="lazy" \/><span class="dots" aria-hidden="true"><i style="background:#111111"><\/i><i style="background:#222222"><\/i><\/span><\/a>/);
  assert.match(html, /title="Obraz &lt;w1&gt; \(uhodnuto 3×\)"/);
  assert.match(html, /data-collection-toggle aria-expanded="false">Celá sbírka<\/button>$/);
  const open = collectionHtml({ items, work, open: true });
  assert.equal(open.match(/class="piece"/g).length, 13, 'a work gone (null) is left out');
  assert.match(open, /aria-expanded="true">Jen nejnovější<\/button>$/);
  assert.doesNotMatch(collectionHtml({ items: items.slice(0, 3), work }), /data-collection-toggle/, 'a small collection without the button');
  assert.match(collectionHtml({ items: [], work }), /^<p class="empty">/);
});

test('simulatedRounds: every level of every day, kept as rounds keep them, repeatable; a month fills the collection', () => {
  const levels = [LEVEL, { ...LEVEL, id: 'm' }, { ...LEVEL, id: 'n' }];
  const prepared = { l: answersOf(6), m: answersOf(6), n: answersOf(6) };
  const rounds = simulatedRounds({ start: 10, days: 30, levels, prepared, epoch: E, rates: { l: 1, m: 0.5, n: 0 } });
  assert.equal(Object.keys(rounds).length, 90);
  assert.deepEqual(rounds['2026-315:l'].puzzle, roundPuzzle(dailyPuzzles({ day: 10, levels, prepared }).l));
  assert.equal(Object.keys(rounds).filter((k) => k.endsWith(':l')).every((k) => rounds[k].solved), true);
  assert.equal(Object.keys(rounds).filter((k) => k.endsWith(':n')).some((k) => rounds[k].solved), false);
  assert.deepEqual(simulatedRounds({ start: 10, days: 30, levels, prepared, epoch: E }), simulatedRounds({ start: 10, days: 30, levels, prepared, epoch: E }));
  assert.equal(gameCollection({ rounds }).length, 6, 'all six works within a month');
});

// ---- the plan of the days ----
const PLAN_LEVELS = [LEVEL, { ...LEVEL, id: 'm' }, { ...LEVEL, id: 'n' }];
/** Answers of `n` works (ids from `from`), each with `places` close-ups at different places. */
const placesOf = (n, places = 2, from = 0) => {
  const ids = Array.from({ length: n }, (_, i) => `w${String(i + from).padStart(2, '0')}`);
  return Object.fromEntries(ids.map((id) => [id, Array.from({ length: places }, (_, p) => ({
    crop: { x: 0.2 + p * 0.3, y: 0.5, size: 0.2, colours: [`#00000${p}`] }, ranked: ids.filter((other) => other !== id),
  }))]));
};
const preparedOf = (n, places = 2, from = 0) => Object.fromEntries(PLAN_LEVELS.map((l) => [l.id, placesOf(n, places, from)]));
const targets = (plan, from, to) => Object.entries(plan.days).filter(([d]) => Number(d) >= from && Number(d) <= to)
  .flatMap(([d, e]) => PLAN_LEVELS.filter((l) => e[l.id]).map((l) => ({ day: Number(d), id: e[l.id].targetId, detail: e[l.id].detail })));

test('planDetails: every place of a work numbered for good, a new place gets the next number, at most PLAN_MAX_DETAILS', () => {
  const first = planDetails({}, { l: placesOf(1, 2) }, [LEVEL]);
  assert.deepEqual(first.w00.map((d) => [d.n, d.level, d.x]), [[1, 'l', 0.2], [2, 'l', 0.5]]);
  // the analysis now finds the second place a bit moved and a third one: the numbers stay, the new one is 3
  const moved = { l: { w00: [{ crop: { x: 0.52, y: 0.5, size: 0.2 } }, { crop: { x: 0.8, y: 0.5, size: 0.2 } }] } };
  assert.deepEqual(planDetails(first, moved, [LEVEL]).w00.map((d) => [d.n, d.x]), [[1, 0.2], [2, 0.5], [3, 0.8]]);
  assert.equal(planDetailOf(first.w00, 'l', { x: 0.52, y: 0.5, size: 0.2 }).n, 2);
  assert.equal(planDetailOf(first.w00, 'm', { x: 0.5, y: 0.5, size: 0.2 }), null, 'another level = another detail');
  const many = { l: { w00: Array.from({ length: PLAN_MAX_DETAILS + 10 }, (_, i) => ({ crop: { x: i / 100, y: 0.1, size: 0.005 } })) } };
  assert.equal(planDetails({}, many, [LEVEL]).w00.length, PLAN_MAX_DETAILS);
});

test('extendPlan: the past and tomorrow as computed, two weeks ahead, each day three different works with a detail', () => {
  const prepared = preparedOf(40);
  const plan = extendPlan({ prepared, levels: PLAN_LEVELS, today: 10, epoch: '2026-11-01' });
  assert.deepEqual(Object.keys(plan.days).map(Number), Array.from({ length: 10 + PLAN_HORIZON + 1 }, (_, i) => i));
  assert.equal(plan.days[0].date, '2026-11-01');
  const computed = dailyPuzzles({ day: 3, levels: PLAN_LEVELS, prepared });
  assert.equal(plan.days[3].l.targetId, computed.l.targetId, 'a day before the plan = what the game computed for it');
  assert.deepEqual(plan.days[3].l.optionIds, computed.l.optionIds);
  for (const [day, entry] of Object.entries(plan.days)) {
    const ids = PLAN_LEVELS.map((l) => entry[l.id].targetId);
    assert.equal(new Set(ids).size, 3, `day ${day}`);
    for (const l of PLAN_LEVELS) {
      assert.ok(entry[l.id].optionIds.includes(entry[l.id].targetId));
      assert.ok(Number.isInteger(entry[l.id].detail), `day ${day} has the number of its detail`);
      assert.ok(LEVEL.looks.includes(entry[l.id].look));
    }
  }
  assert.deepEqual(extendPlan({ prepared, levels: PLAN_LEVELS, today: 10, epoch: '2026-11-01' }), plan, 'the same input = the same plan');
});

test('extendPlan: locked days never change, not even with new works; the days after tomorrow are planned again', () => {
  const old = extendPlan({ prepared: preparedOf(40), levels: PLAN_LEVELS, today: 10, epoch: '2026-11-01' });
  const more = preparedOf(45);
  const next = extendPlan({ plan: old, prepared: more, levels: PLAN_LEVELS, today: 10, epoch: '2026-11-01' });
  for (let day = 0; day <= 11; day++) assert.deepEqual(next.days[day], old.days[day], `day ${day} is locked`);
  const later = extendPlan({ plan: next, prepared: more, levels: PLAN_LEVELS, today: 17, epoch: '2026-11-01' });
  for (let day = 0; day <= 18; day++) assert.deepEqual(later.days[day], next.days[day], `day ${day} as planned before`);
  assert.equal(Math.max(...Object.keys(later.days).map(Number)), 17 + PLAN_HORIZON);
});

test('extendPlan: a new work comes the day after tomorrow, several new ones one a day', () => {
  const old = extendPlan({ prepared: preparedOf(40), levels: PLAN_LEVELS, today: 30, epoch: '2026-11-01' });
  const next = extendPlan({ plan: old, prepared: { ...preparedOf(40), ...Object.fromEntries(PLAN_LEVELS.map((l) => [l.id, { ...preparedOf(40)[l.id], ...placesOf(3, 2, 40) }])) }, levels: PLAN_LEVELS, today: 30, epoch: '2026-11-01' });
  const fresh = ['w40', 'w41', 'w42'];
  const firstDay = fresh.map((id) => targets(next, 32, 60).find((t) => t.id === id)?.day);
  assert.deepEqual([...firstDay].sort(), [32, 33, 34], 'one new work a day from the day after tomorrow');
  for (let day = 32; day <= 30 + PLAN_HORIZON; day++) {
    assert.ok(targets(next, day, day).filter((t) => fresh.includes(t.id)).length <= 1, `day ${day}: at most one new work`);
  }
});

test('extendPlan: a work comes again after 14 days at least, PLAN_WORK_GAP once all had a turn; its details take turns', () => {
  let plan = {};
  for (let today = 0; today <= 120; today += 7) plan = extendPlan({ plan, prepared: preparedOf(80, 3), levels: PLAN_LEVELS, today, epoch: '2026-11-01' });
  const all = targets(plan, 2, 120);
  const last = {};
  const lastDetail = {};
  for (const t of all) {
    // never sooner than 14 days; once every work has had a turn (day 40 on), not before PLAN_WORK_GAP
    if (last[t.id] !== undefined) assert.ok(t.day - last[t.id] >= (t.day >= 40 ? PLAN_WORK_GAP : 14), `${t.id} again on day ${t.day} after ${t.day - last[t.id]} days`);
    last[t.id] = t.day;
    const key = `${t.id}#${t.detail}`;
    if (lastDetail[key] !== undefined) assert.ok(Object.keys(lastDetail).filter((k) => k.startsWith(`${t.id}#`)).length >= 2, `${key} repeated only after the other details of ${t.id}`);
    lastDetail[key] = t.day;
  }
});

test('extendPlan: too few works = the gap gives way, a day is never empty', () => {
  const plan = extendPlan({ prepared: preparedOf(5), levels: PLAN_LEVELS, today: 3, epoch: '2026-11-01' });
  for (let day = 5; day <= 3 + PLAN_HORIZON; day++) assert.equal(targets(plan, day, day).length, 3, `day ${day}`);
});

test('planDay: a detail used within PLAN_DETAIL_GAP waits while the work has another one', () => {
  const prepared = { l: placesOf(1, 2) };
  const details = planDetails({}, prepared, [LEVEL]);
  const days = { 0: { l: { targetId: 'w00', detail: 1, crop: {}, optionIds: ['w00'], look: 'dusk' } } };
  assert.equal(planDay({ day: 30, days, details, prepared, levels: [LEVEL] }).l.detail, 2);
  const both = { ...days, 10: { l: { targetId: 'w00', detail: 2, crop: {}, optionIds: ['w00'], look: 'dusk' } } };
  assert.equal(planDay({ day: 40, days: both, details, prepared, levels: [LEVEL] }).l.detail, 1, 'all used: the one used longest ago');
  assert.ok(PLAN_DETAIL_GAP >= 365);
  assert.deepEqual(planUsage(both, 11), { works: { w00: 10 }, details: { 'w00#1': 0, 'w00#2': 10 } });
  assert.deepEqual(planUsage(both, 5), { works: { w00: 0 }, details: { 'w00#1': 0 } }, 'only the days before');
});

test('plannedPuzzles: the plan first, a level with a work gone or without a plan computed; the look from the catalogue', () => {
  const computed = { l: { day: 4, level: 'l', targetId: 'c1', crop: {}, optionIds: ['c1'], look: 'dusk' }, m: null, n: null };
  const plan = { days: { 4: { date: '2026-11-05', l: { targetId: 'p1', detail: 2, crop: { x: 0.1, y: 0.2, size: 0.3 }, optionIds: ['p1', 'p2'], look: 'morning-mist' } } } };
  const has = (id) => id !== 'gone';
  const got = plannedPuzzles({ plan, day: 4, levels: PLAN_LEVELS, hasWork: has, computed });
  assert.deepEqual(got.l, { day: 4, level: 'l', targetId: 'p1', detail: 2, crop: { x: 0.1, y: 0.2, size: 0.3 }, optionIds: ['p1', 'p2'], look: 'morning-mist', effect: 'mist', colour: null, planned: true });
  assert.equal(got.m, null);
  const gone = plannedPuzzles({ plan: { days: { 4: { l: { ...plan.days[4].l, optionIds: ['p1', 'gone'] } } } }, day: 4, levels: PLAN_LEVELS, hasWork: has, computed });
  assert.equal(gone.l.targetId, 'c1');
  assert.equal(gone.l.planned, false);
  assert.equal(plannedPuzzles({ plan: null, day: 4, levels: PLAN_LEVELS, hasWork: has, computed }).l.targetId, 'c1', 'no plan = computed');
});

test('planYearText and planDetailsText: valid JSON, one line per day / per work, days in order', () => {
  const plan = extendPlan({ prepared: preparedOf(12), levels: PLAN_LEVELS, today: 2, epoch: '2026-11-01' });
  const text = planYearText(2026, plan.days);
  const file = JSON.parse(text);
  assert.equal(file.version, PLAN_FILE_VERSION);
  assert.equal(file.year, 2026);
  assert.deepEqual(Object.keys(file.days), Object.keys(plan.days).map((d) => `2026-${305 + Number(d)}`), 'by the key of the day: 1 Nov 2026 = 2026-305');
  assert.deepEqual(file.days['2026-305'], JSON.parse(JSON.stringify(plan.days[0])));
  assert.deepEqual(planYearDays(file.days, '2026-11-01'), JSON.parse(JSON.stringify(plan.days)), 'read back by the day of the game');
  assert.deepEqual(planYearDays({ ...file.days, 305: {}, 'x-1': {} }, '2026-11-01'), JSON.parse(JSON.stringify(plan.days)), 'what is no key is left out');
  assert.equal(text.split('\n').filter((l) => /^    "\d{4}-\d+": \{"date"/.test(l)).length, Object.keys(plan.days).length);
  const late = planYearText(2027, { 61: { date: '2027-01-01' }, 70: { date: '2027-01-10' } });
  assert.ok(late.indexOf('"2027-1": {') < late.indexOf('"2027-10": {'), 'days by number, not as text');
  assert.deepEqual(planYearDays(JSON.parse(late).days, '2026-11-01'), { 61: { date: '2027-01-01' }, 70: { date: '2027-01-10' } });
  const details = planDetailsText(plan.details);
  assert.deepEqual(JSON.parse(details), { version: 1, details: JSON.parse(JSON.stringify(plan.details)) });
  assert.equal(details.split('\n').filter((l) => /^    "w\d+": \[/.test(l)).length, 12);
});

test('the plan by years: the year of a day, the days split by it, this year and the one before shown, an archive merged', () => {
  assert.equal(planYearOf(0, '2026-11-01'), 2026);
  assert.equal(planYearOf(61, '2026-11-01'), 2027, '1 Jan 2027');
  const days = { 0: { date: '2026-11-01' }, 60: { date: '2026-12-31' }, 61: { date: '2027-01-01' } };
  assert.deepEqual(planDaysByYear(days, '2026-11-01'), { 2026: { 0: days[0], 60: days[60] }, 2027: { 61: days[61] } });
  assert.deepEqual(planYearsShown(2028), [2027, 2028]);
  const merged = mergePlanDays({ days: { 61: { date: '2027-01-01' } }, archive: [2026] }, { year: 2026, days: { 0: { date: '2026-11-01' }, 61: { date: 'not this' } } });
  assert.deepEqual(merged, { days: { 0: { date: '2026-11-01' }, 61: { date: '2027-01-01' } }, archive: [2026] }, 'the days already there stay');
  assert.equal(pragueDate(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
});
