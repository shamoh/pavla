import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePixels, applyGuess, archiveDays, gameDiagnostics, diagnosticsText, monthGroups, unplayedDays, daysWord, dayFromParam, dayMarks, gameDate, keptPuzzle, roundPuzzle, chooseDecoys, confusingCrops, dailyPuzzles, drawPixels, dropsFor, effectSettings, effectStrength, effectStyle, waveRipple, frameSource, gameLevels, inZone, prepareLevel, puzzleForLevel, finishRound, gameDay, gameFrame, gameHash, gameHint, gameRandom, gameRank, gameShareText, gameShuffle, gameLooks, dropsWord, lookForDay, techniqueFamily, lookKey, representativeSample, windowHtml,
  lookalikeDistance, newProgress, newRound, paletteDistance, rankLookalikes, regionDetail, regionEdges, regionPalette, rgbToLab, winTitle,
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
  assert.deepEqual(levels.map((l) => l.id), ['lehka', 'stredni', 'tezka']);
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
  for (const level of ['lehka', 'stredni', 'tezka']) assert.equal(looks.filter((l) => l.level === level).length, 5, level);
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

test('gameRank: by the drops, with the next one; none above the top', () => {
  assert.deepEqual(gameRank(0), { title: 'Vylitý kelímek', next: 20, nextTitle: 'Mokrý štětec' });
  assert.equal(gameRank(19).title, 'Vylitý kelímek');
  assert.equal(gameRank(20).title, 'Mokrý štětec');
  assert.deepEqual(gameRank(999), { title: 'Mistr akvarelu', next: null, nextTitle: null });
});

test('finishRound: drops by the level, collection and pigments; each puzzle once, each level of a day apart', () => {
  const win = { day: 3, today: 3, level: 'tezka', multiplier: 3, solved: true, misses: 0, workId: 'w', pigments: ['#111111', '#222222'] };
  const first = finishRound(newProgress(), win);
  assert.equal(first.gained, 30);
  assert.deepEqual(first.progress.collected, ['w']);
  assert.deepEqual(first.progress.pigments, ['#111111', '#222222']);
  assert.deepEqual(first.progress.played['3:tezka'], { solved: true, misses: 0, drops: 30 });
  const again = finishRound(first.progress, win);
  assert.equal(again.progress, first.progress, 'already played');
  assert.equal(again.gained, 0);
  const other = finishRound(first.progress, { ...win, level: 'lehka', multiplier: 1, workId: 'x' });
  assert.equal(other.gained, 10);
  assert.equal(other.progress.streak, 1, 'more games on one day are one day of the series');
});

test('finishRound: the series goes on day by day, survives a lost game, restarts after a gap, ignores the archive', () => {
  const play = (progress, day, today = day, solved = true) => finishRound(progress, { day, today, level: 'l', solved, misses: 0, workId: `w${day}`, pigments: [] }).progress;
  let p = play(newProgress(), 1);
  p = play(p, 2);
  assert.equal(p.streak, 2);
  p = play(p, 3, 3, false);
  assert.deepEqual([p.streak, p.drops], [3, 21], 'lost: no drops, the series goes on');
  assert.deepEqual(p.collected, ['w1', 'w2'], 'lost: nothing collected');
  const archive = play(p, 0, 3);
  assert.deepEqual([archive.streak, archive.lastDay, archive.drops], [3, 3, 26], 'the archive leaves the series alone, half the drops');
  p = play(p, 9);
  assert.deepEqual([p.streak, p.best], [1, 3], 'a day left out starts a new series');
});

test('finishRound: says when a new rank is reached', () => {
  const near = { ...newProgress(), drops: 15 };
  assert.equal(finishRound(near, { day: 1, today: 1, level: 'l', solved: true, misses: 0, workId: 'w' }).rankUp, true);
  assert.equal(finishRound(near, { day: 1, today: 1, level: 'l', solved: false, misses: 4, workId: 'w' }).rankUp, false);
});

test('gameShareText: the level and a mark for each guess, no name of the work', () => {
  assert.equal(gameShareText({ day: 11, level: 'Těžká', misses: 2, solved: true, url: 'https://x.cz' }), 'Detail dne #12 · Těžká 🟨🟨🟩\nPoznáš obraz podle detailu?\nhttps://x.cz');
  assert.match(gameShareText({ day: 0, level: 'Lehká', misses: 4, solved: false, url: 'u' }), /^Detail dne #1 · Lehká 🟨🟨🟨🟨\n/);
});

test('roundPuzzle / keptPuzzle: a played day stays as it was while its works are on the site', () => {
  const computed = { day: 3, level: 'lehka', targetId: 'n', crop: { x: 0.4 }, optionIds: ['n', 'm'], look: 'clear', effect: 'none', colour: 'none' };
  const old = { day: 3, level: 'lehka', targetId: 'a', crop: { x: 0.5, y: 0.5, size: 0.2, colours: ['#fff'] }, optionIds: ['b', 'a', 'c'], look: 'mosaic', effect: 'pixel', colour: null };
  const kept = roundPuzzle(old);
  assert.deepEqual(kept, { targetId: 'a', crop: old.crop, optionIds: ['b', 'a', 'c'], look: 'mosaic' });
  assert.deepEqual(JSON.parse(JSON.stringify(kept)), kept, 'it goes into the storage as it is');
  const all = () => true;
  assert.deepEqual(keptPuzzle({ computed, round: { puzzle: kept }, hasWork: all, day: 3, level: 'lehka' }), old);
  assert.equal(keptPuzzle({ computed, round: { puzzle: kept }, hasWork: (id) => id !== 'c', day: 3, level: 'lehka' }), computed, 'a work left the site');
  assert.equal(keptPuzzle({ computed, round: { guesses: [] }, hasWork: all, day: 3, level: 'lehka' }), computed, 'a round from before');
  assert.equal(keptPuzzle({ computed, round: undefined, hasWork: all, day: 3, level: 'lehka' }), computed);
  assert.equal(keptPuzzle({ computed: null, round: undefined, hasWork: all, day: 3, level: 'lehka' }), null);
  const gone = keptPuzzle({ computed, round: { puzzle: { ...kept, look: 'no-more' } }, hasWork: all, day: 3, level: 'lehka' });
  assert.equal(gone.look, 'clear', 'a look taken out of the catalogue: the one of the day');
});

test('gameDate: back from the number of a day, also over the change of the clock', () => {
  assert.equal(gameDate(0, '2026-11-01'), '2026-11-01');
  assert.equal(gameDate(14, '2026-11-01'), '2026-11-15');
  assert.equal(gameDate(150, '2026-11-01'), '2027-03-31');
  for (const day of [0, 1, 30, 200, 400]) assert.equal(gameDay(gameDate(day, '2026-11-01'), '2026-11-01'), day);
});

test('dayFromParam: #1 = day 0; today without it, for the future, before the first day and for nonsense', () => {
  assert.equal(dayFromParam('1', 14), 0);
  assert.equal(dayFromParam('15', 14), 14);
  assert.equal(dayFromParam('16', 14), 14);
  assert.equal(dayFromParam('0', 14), 14);
  assert.equal(dayFromParam('-3', 14), 14);
  assert.equal(dayFromParam('2.5', 14), 14);
  assert.equal(dayFromParam('abc', 14), 14);
  assert.equal(dayFromParam(null, 14), 14);
  assert.equal(dayFromParam(undefined, 14), 14);
});

test('archiveDays: every day before today, the newest first; none on the first day', () => {
  assert.deepEqual(archiveDays(3), [2, 1, 0]);
  assert.deepEqual(archiveDays(0), []);
  assert.deepEqual(archiveDays(-2), []);
});

test('dayMarks: how a day went in each level', () => {
  const levels = gameLevels();
  const played = { '5:lehka': { solved: true }, '5:stredni': { solved: false }, '5:tezka': { solved: true }, '4:lehka': { solved: true } };
  assert.deepEqual(dayMarks(played, 5, levels), ['solved', 'lost', 'solved']);
  assert.deepEqual(dayMarks(played, 4, levels), ['solved', null, null]);
  assert.deepEqual(dayMarks({}, 1, levels), [null, null, null]);
});

test('unplayedDays / daysWord: the days of the archive still waiting, the newest first, and their count in words', () => {
  const levels = gameLevels();
  const played = { '2:lehka': { solved: true }, ...Object.fromEntries(levels.map((l) => [`1:${l.id}`, { solved: false }])) };
  assert.deepEqual(unplayedDays({ played, levels, before: 4 }), [3, 2, 0]);
  assert.deepEqual(unplayedDays({ played, levels, before: 0 }), []);
  assert.deepEqual([0, 1, 2, 4, 5, 11].map(daysWord), ['dní', 'den', 'dny', 'dny', 'dní', 'dní']);
});

test('diagnosticsText: the address, then a row a line', () => {
  assert.equal(diagnosticsText([['Den', '#4'], ['Stav', 'pokus 1 z 4']], 'https://x/detail-dne/?den=4'), 'https://x/detail-dne/?den=4\nDen: #4\nStav: pokus 1 z 4');
  assert.equal(diagnosticsText([['Den', '#1']]), 'Den: #1');
});

test('monthGroups: the days by month, the newest first, with how many days still wait; one month = one group', () => {
  assert.deepEqual(monthGroups([14, 13, 0], '2026-11-01'), [{ month: '2026-11', days: [14, 13, 0], waiting: 0 }]);
  const levels = gameLevels();
  const played = { ...Object.fromEntries(levels.map((l) => [`30:${l.id}`, { solved: true }])), '0:lehka': { solved: false } };
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
  assert.equal(first['Den'], '#4 · 2026-11-04 · archiv');
  assert.match(first['Úroveň'], /^Střední \(stredni\) · 9 náhledů · 4 pokusy · nápovědy ne · kapky ×2$/);
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
  assert.equal(Object.fromEntries(gameDiagnostics({ day: 5, today: 5, date: 'd', level, puzzle, round: newRound(), work }))['Den'], '#6 · d · dnes');
});

test('finishRound: a day of the archive gives half the drops, keeps the series and the last day', () => {
  const today = 10;
  const progress = { ...newProgress(), streak: 4, best: 4, lastDay: 10 };
  const { progress: after, gained } = finishRound(progress, { day: 3, today, level: 'stredni', multiplier: 2, solved: true, misses: 0, workId: 'a' });
  assert.equal(gained, dropsFor(0, 4, true, 2));
  assert.equal(gained, 10);
  assert.equal(after.streak, 4);
  assert.equal(after.lastDay, 10);
  assert.deepEqual(after.collected, ['a']);
});
