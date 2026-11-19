// "Detail dne": a daily game. Everyone gets the same close-up of one work and guesses the work among thumbnails with
// similar colours; every miss zooms out and adds a hint, the end is always the whole work.
// The functions the page needs are copied into it by their source text (PROTOTYPE_FUNCTIONS in prototypes.mjs), so they
// use no constants of this module, only each other and their parameters. Only the analysis of pictures runs in Node.

/**
 * The three puzzles of a day, from the easiest. `size` = the close-up as a share of the shorter side, `zone` = the part of
 * the picture it comes from (center, edge, any), `pick` = clear (the most detailed one) or confusing (the one most other works look
 * like, up to `maxConfusion`), `options` = thumbnails, `reach` = how close the false thumbnails are (1 = the very closest),
 * `lastView` = how far the last miss zooms out, `guesses`, `hints`, `drops` = what the drops are multiplied by, `looks` =
 * ids of the looks of gameLooks that may cover the close-up, one picked for each day; every miss clears it a little.
 */
/** Where the game keeps the progress of a player in localStorage (the game and the home page read it); a new format = a new key. */
export const GAME_STORE = 'pavla.detailDne.v2';

export function gameLevels() {
  return [
    { id: 'easy', label: 'Lehká', size: 0.24, zone: 'center', planCentre: 0.25, pick: 'clear', options: 9, reach: 0.4, lastView: 0.85, guesses: 4, hints: true, drops: 1, looks: ['clear', 'black-white', 'old-photo', 'morning-mist', 'mosaic'] },
    { id: 'medium', label: 'Střední', size: 0.16, zone: 'any', pick: 'confusing', maxConfusion: 14, options: 9, reach: 0.9, lastView: 0.5, guesses: 4, hints: false, drops: 2, looks: ['curtain', 'water', 'magic-colours', 'dusk', 'puddle'] },
    { id: 'hard', label: 'Těžká', size: 0.11, zone: 'edge', pick: 'confusing', maxConfusion: 16, planConfusion: 18, options: 9, reach: 1, lastView: 0.35, guesses: 3, hints: false, drops: 3, looks: ['dream', 'colour-blocks', 'mirage', 'flooded-postcard', 'embroidery'] },
  ];
}

/**
 * How many looks a level has (gameLooks): each comes about once in that many days and never two days in a row (lookForDay),
 * so fewer than `min` repeat too soon; more than `max` is too many to name and offer in the quiz editor. The levels have about
 * the same count: they differ by at most `spread`, and a harder level never has fewer than an easier one. Rather tune or add
 * looks than drop them.
 */
export const LOOK_COUNTS = { min: 5, max: 10, spread: 1 };

/**
 * The looks of a close-up: a named pair of an effect (mist, raster, pixel, wave) and colours (gray, sepia, hue), null = untouched.
 * Each level draws from its own five (`level`), so no look is in two levels; a quiz of a visitor offers the same ones.
 */
/** The looks of the game (`note` = one line on what the look does to the picture, shown in the editor of a quiz). */
export function gameLooks() {
  return [
    { id: 'clear', label: 'Čistý pohled', note: 'Výřez beze změny, jen hodně zblízka.', level: 'easy', effect: null, colour: null },
    { id: 'black-white', label: 'Černobílá fotka', note: 'Barvy zmizí, zůstanou jen světla a stíny.', level: 'easy', effect: null, colour: 'gray' },
    { id: 'old-photo', label: 'Stará fotka', note: 'Barvy zhnědnou jako na staré fotce.', level: 'easy', effect: null, colour: 'sepia' },
    { id: 'morning-mist', label: 'Ranní mlha', note: 'Výřez se rozmaže jako v mlze.', level: 'easy', effect: 'mist', colour: null },
    { id: 'mosaic', label: 'Mozaika', note: 'Výřez se poskládá z velkých čtverečků.', level: 'easy', effect: 'pixel', colour: null },
    { id: 'curtain', label: 'Za záclonou', note: 'Výřez je vidět jen po tečkách jako přes záclonu.', level: 'medium', effect: 'raster', colour: null },
    { id: 'water', label: 'Na hladině', note: 'Výřez se vlní jako odraz na vodě.', level: 'medium', effect: 'wave', colour: null },
    { id: 'magic-colours', label: 'Kouzelné barvy', note: 'Barvy se prohodí za jiné, tvary zůstanou.', level: 'medium', effect: null, colour: 'hue' },
    { id: 'dusk', label: 'Za šera', note: 'Barvy zmizí a výřez se rozmaže jako za šera.', level: 'medium', effect: 'mist', colour: 'gray' },
    { id: 'puddle', label: 'Odraz v kaluži', note: 'Barvy zmizí a výřez se vlní jako v kaluži.', level: 'medium', effect: 'wave', colour: 'gray' },
    { id: 'dream', label: 'Sen', note: 'Barvy se prohodí za jiné a výřez se rozmaže.', level: 'hard', effect: 'mist', colour: 'hue' },
    { id: 'colour-blocks', label: 'Barevné kostky', note: 'Barvy se prohodí za jiné a výřez se rozpadne na čtverečky.', level: 'hard', effect: 'pixel', colour: 'hue' },
    { id: 'mirage', label: 'Fata morgána', note: 'Barvy se prohodí za jiné a výřez se vlní jako ve vedru.', level: 'hard', effect: 'wave', colour: 'hue' },
    { id: 'flooded-postcard', label: 'Zatopená pohlednice', note: 'Barvy zhnědnou a výřez se vlní jako pod vodou.', level: 'hard', effect: 'wave', colour: 'sepia' },
    { id: 'embroidery', label: 'Výšivka', note: 'Barvy zhnědnou a výřez se poskládá ze čtverečků jako výšivka.', level: 'hard', effect: 'pixel', colour: 'sepia' },
  ];
}

import { GAME_AFFINITY_SCALE, GAME_AFFINITY_WEIGHTS, techniqueFamily, workDistance } from './affinity.mjs';

/** The first day of the game (day 0, shown as #1). */
export const GAME_EPOCH = '2026-11-01';
/** The longer side of the small picture the analysis reads. */
export const ANALYSIS_SIZE = 240;
/** The richest places of a picture its answers come from (the days computed before the plan of the days were made of them). */
export const ANSWER_CROPS = 8;

/** CIE Lab of an sRGB colour (D65). */
export function rgbToLab(r, g, b) {
  const linear = (c) => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047);
  const y = f(0.2126 * lr + 0.7152 * lg + 0.0722 * lb);
  const z = f((0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * The main colours of a rectangle of raw pixels: the pixels fall into coarse Lab bins, the fullest `count` bins with their
 * average colour and share (`lab`, `hex`, `weight`).
 */
export function regionPalette({ data, width, channels }, x0, y0, w, h, count = 5) {
  const bins = new Map();
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * width + x) * channels;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const [L, A, B] = rgbToLab(r, g, b);
      const key = `${Math.round(L / 12)}:${Math.round(A / 12)}:${Math.round(B / 12)}`;
      const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bin.n++; bin.r += r; bin.g += g; bin.b += b;
      bins.set(key, bin);
    }
  }
  const hex2 = (v) => Math.round(v).toString(16).padStart(2, '0');
  return [...bins.values()].sort((a, b) => b.n - a.n).slice(0, count).map((bin) => {
    const [r, g, b] = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    return {
      lab: rgbToLab(r, g, b).map((v) => Math.round(v)),
      hex: `#${hex2(r)}${hex2(g)}${hex2(b)}`,
      weight: Math.round((bin.n / (w * h)) * 100) / 100,
    };
  });
}

/** How much is going on in a rectangle: the spread of lightness and colour (a blank paper or a clear sky is near 0). */
export function regionDetail({ data, width, channels }, x0, y0, w, h) {
  const sum = [0, 0, 0];
  const squares = [0, 0, 0];
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * width + x) * channels;
      rgbToLab(data[i], data[i + 1], data[i + 2]).forEach((v, c) => { sum[c] += v; squares[c] += v * v; });
    }
  }
  const n = w * h;
  const spread = (c) => Math.sqrt(Math.max(0, squares[c] / n - (sum[c] / n) ** 2));
  return spread(0) + 0.5 * (spread(1) + spread(2));
}

/**
 * How much of a rectangle is a crisp change, not a smooth wash: the average difference of lightness between neighbouring pixels.
 * A soft gradient can have a big spread (regionDetail) and still give the player nothing to recognise.
 */
export function regionEdges({ data, width, channels }, x0, y0, w, h) {
  const light = (x, y) => {
    const i = (y * width + x) * channels;
    return rgbToLab(data[i], data[i + 1], data[i + 2])[0];
  };
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y0 + h - 1; y++) {
    for (let x = x0; x < x0 + w - 1; x++) {
      const here = light(x, y);
      sum += Math.abs(here - light(x + 1, y)) + Math.abs(here - light(x, y + 1));
      n += 2;
    }
  }
  return n ? sum / n : 0;
}

/**
 * What the game needs to know of a picture (raw pixels `{ data, width, height, channels }`), all inside the margins (the edges
 * of the paper stay out, the bottom one is wider: the title and signature are written there):
 * - `crops`: up to `count` close-ups that do not overlap, the most detailed first (with `overlap` > 0 followed by those that share
 *   up to that share of the side with another one, `overlaps: true`, so the ones that share nothing stay the same), each `{ x, y, size, detail, palette }` (x, y =
 *   centre as a share of width and height, size = a share of the shorter side). Places under `minDetail` (blank paper) or under
 *   `minEdges` (a smooth wash) are no close-ups, so a work without any cannot be a puzzle.
 * - `places`: the whole picture in a grid of windows of the same size, each `{ detail, palette }`: what a close-up of another
 *   work is compared with, because a work may look like a close-up in one place only.
 */
export function analyzePixels(pixels, { size = 0.14, margin = 0.08, bottom = 0.18, count = 8, minDetail = 8, minEdges = 3, overlap = 0 } = {}) {
  const { width, height } = pixels;
  const side = Math.max(4, Math.round(Math.min(width, height) * size));
  const [mx, my] = [Math.round(width * margin), Math.round(height * margin)];
  const lastY = height - Math.round(height * bottom);
  const step = Math.max(1, Math.round(side / 4));
  const candidates = [];
  for (let y = my; y + side <= lastY; y += step) {
    for (let x = mx; x + side <= width - mx; x += step) {
      candidates.push({ x, y, detail: regionDetail(pixels, x, y, side, side) });
    }
  }
  candidates.sort((a, b) => b.detail - a.detail || a.y - b.y || a.x - b.x);
  const picked = [];
  for (const place of candidates) {
    if (picked.length === count || place.detail < minDetail) break;
    if (!picked.every((p) => Math.max(Math.abs(p.x - place.x), Math.abs(p.y - place.y)) >= side)) continue;
    place.edges = regionEdges(pixels, place.x, place.y, side, side);
    if (place.edges >= minEdges) picked.push(place);
  }
  // then the places that share up to `overlap` of the side with another one, after all of those that share nothing
  const apart = Math.ceil(side * (1 - overlap));
  for (const place of overlap > 0 ? candidates : []) {
    if (picked.length === count || place.detail < minDetail) break;
    if (picked.includes(place) || !picked.every((p) => Math.max(Math.abs(p.x - place.x), Math.abs(p.y - place.y)) >= apart)) continue;
    place.edges ??= regionEdges(pixels, place.x, place.y, side, side);
    if (place.edges >= minEdges) picked.push({ ...place, overlaps: true });
  }
  const share = (v) => Math.round(v * 1000) / 1000;
  const places = [];
  for (let y = my; y + side <= lastY; y += side) {
    for (let x = mx; x + side <= width - mx; x += side) {
      places.push({ detail: Math.round(regionDetail(pixels, x, y, side, side)), palette: regionPalette(pixels, x, y, side, side, 3).map(({ lab, weight }) => ({ lab, weight })) });
    }
  }
  return {
    places,
    crops: picked.map((p) => ({
      x: share((p.x + side / 2) / width),
      y: share((p.y + side / 2) / height),
      size: share(side / Math.min(width, height)),
      detail: Math.round(p.detail),
      edges: Math.round(p.edges * 10) / 10,
      palette: regionPalette(pixels, p.x, p.y, side, side, 3),
      ...(p.overlaps ? { overlaps: true } : {}),
    })),
  };
}

/** A number of a text, always the same for the same text. */
export function gameHash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}

/** Random numbers 0–1 of a seed: everyone with the same seed gets the same ones (mulberry32). */
export function gameRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy (Fisher–Yates). */
export function gameShuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The number of the day `date` (YYYY-MM-DD) counted from `epoch` (day 0). */
export function gameDay(date, epoch) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`)) / 86400000);
}

/**
 * How far the colours of `palette` (a close-up) are from `other` (a work): for each colour the distance to the nearest
 * colour there, by share. Small = the work has the colours of the close-up somewhere.
 */
export function paletteDistance(palette, other) {
  const total = palette.reduce((sum, c) => sum + c.weight, 0) || 1;
  return palette.reduce((sum, c) => {
    const nearest = Math.min(...other.map((o) => Math.hypot(c.lab[0] - o.lab[0], c.lab[1] - o.lab[1], c.lab[2] - o.lab[2])));
    return sum + (c.weight * nearest) / total;
  }, 0);
}

/**
 * How much the most similar place of a work (its analysis) looks like a close-up: the colours compared both ways and how much is
 * going on there. Small = the player has to look twice.
 */
export function lookalikeDistance(crop, analysis) {
  let best = Infinity;
  for (const place of analysis.places) {
    const distance = (paletteDistance(crop.palette, place.palette) + paletteDistance(place.palette, crop.palette)) / 2 + Math.abs(crop.detail - place.detail) / 2;
    if (distance < best) best = distance;
  }
  return best;
}

/** What a technique looks like to a player (painting or drawing): scripts/lib/affinity.mjs, the measure of how alike works are. */
export { techniqueFamily };

/**
 * The other works by how much they look like a close-up, the closest first: how alike the close-up looks (lookalikeDistance) plus how
 * alike the whole works are (workDistance of scripts/lib/affinity.mjs with GAME_AFFINITY_WEIGHTS × GAME_AFFINITY_SCALE): a player
 * rules out a drawing among paintings or another subject at a glance, and the colours and mood of the whole work (`colourProfile` of
 * the works, when they have one) tip the balance. [{ id, distance, confusion }]: `confusion` is the same without the colours of the
 * whole work, what the levels measure how confusing a close-up is by (confusingCrops, level.maxConfusion), so the colours change
 * which works are offered, never which works can be a puzzle.
 */
export function rankLookalikes({ target, crop, pool, analyses, weights = GAME_AFFINITY_WEIGHTS, scale = GAME_AFFINITY_SCALE }) {
  const round = (v) => Math.round(v * 1000) / 1000;
  return pool
    .map((work) => {
      const look = lookalikeDistance(crop, analyses[work.id]);
      return {
        id: work.id,
        distance: round(look + scale * workDistance(target, work, weights)),
        confusion: round(look + scale * workDistance(target, work, { ...weights, colour: 0 })),
      };
    })
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

/**
 * The false thumbnails of a close-up from the ids of its `ranked` lookalikes: `reach` 1 = always the very closest, 0 = any of
 * them; they are picked by `random` from the closest part.
 */
export function chooseDecoys({ ranked, count, reach, random }) {
  const part = Math.min(ranked.length, count + Math.round((1 - reach) * Math.max(0, ranked.length - count)));
  return gameShuffle(ranked.slice(0, part), random).slice(0, count);
}

/**
 * Whether a close-up comes from a part of the picture: center (around the middle: its centre less than `centre` from the middle
 * of the picture, as a share of its sides), edge (away from it), any.
 */
export function inZone(crop, zone, centre = 0.22) {
  const away = Math.max(Math.abs(crop.x - 0.5), Math.abs(crop.y - 0.5));
  return zone === 'center' ? away < centre : zone === 'edge' ? away > 0.28 : true;
}

/**
 * The close-ups of a work, the most confusing first, each `{ crop, ranked, confusion }`: `confusion` = the average distance of the
 * `count` closest lookalikes (small = many other works could be the answer).
 */
export function confusingCrops({ target, pool, analyses, count }) {
  return analyses[target.id].crops
    .map((crop) => {
      const ranked = rankLookalikes({ target, crop, pool, analyses });
      // how confusing: the closest lookalikes by the close-up, technique and subject (not the colours of the whole work)
      const closest = [...ranked].sort((a, b) => a.confusion - b.confusion).slice(0, count);
      return { crop, ranked, confusion: closest.reduce((sum, r) => sum + r.confusion, 0) / Math.max(1, closest.length) };
    })
    .sort((a, b) => a.confusion - b.confusion || b.crop.detail - a.crop.detail);
}

/**
 * How many other works a close-up is compared with at most (rankLookalikes looks at every place of each): with more works on the
 * site, only the nearest ones by the whole work (candidatePool), so the work grows with the number of works, not with its square.
 * Over the number of works today (85 in 2026-11): the games prepared so far stay the same.
 */
export const GAME_CANDIDATES = 120;

/**
 * The works of `pool` a close-up of `target` is compared with: all of them up to `limit`, otherwise the `limit` nearest by the
 * whole work (workDistance with the weights of the game: colours, mood, technique, subject), as a false thumbnail far from the work
 * in all of it never makes it among the closest lookalikes anyway.
 */
export function candidatePool(target, pool, limit = GAME_CANDIDATES, weights = GAME_AFFINITY_WEIGHTS) {
  if (pool.length <= limit) return pool;
  return pool
    .map((work) => ({ work, distance: workDistance(target, work, weights) }))
    .sort((a, b) => a.distance - b.distance || (a.work.id < b.work.id ? -1 : 1))
    .slice(0, limit)
    .map(({ work }) => work);
}

/**
 * What a level can ask (Node, before the page): work id → up to `keep` close-ups `{ crop, ranked }` (crop without the numbers of
 * its colours, ranked = ids of the closest `nearest` other works, among the `candidates` nearest ones, candidatePool). A work
 * without a close-up for the level is no answer there, but can be a false thumbnail; so the page needs no pictures analysed and
 * picks a puzzle at once. `plan` = the places of the plan of the days (prepareGame with `places`): a level with `planConfusion`
 * takes close-ups up to that one there and a level with `planCentre` a wider middle (more places); the answers of the days
 * computed so far keep `maxConfusion` and the middle of inZone.
 */
export function prepareLevel({ level, works, analyses, keep = 3, nearest = 30, candidates = GAME_CANDIDATES, plan = false }) {
  const usable = works.filter((w) => analyses[w.id]?.places?.length);
  const maxConfusion = plan ? level.planConfusion ?? level.maxConfusion : level.maxConfusion;
  const centre = plan ? level.planCentre : undefined;
  const answers = {};
  for (const target of usable) {
    const crops = (analyses[target.id].crops ?? []).filter((crop) => inZone(crop, level.zone, centre));
    if (!crops.length) continue;
    const pool = candidatePool(target, usable.filter((w) => w.id !== target.id), candidates);
    const single = { ...analyses, [target.id]: { ...analyses[target.id], crops } };
    const count = level.options - 1;
    if (pool.length < count) continue;
    const found = level.pick === 'clear'
      ? [...crops].sort((a, b) => b.detail - a.detail).map((crop) => ({ crop, ranked: rankLookalikes({ target, crop, pool, analyses }) }))
      : confusingCrops({ target, pool, analyses: single, count }).filter((c) => c.confusion <= maxConfusion);
    if (!found.length) continue;
    answers[target.id] = found.slice(0, keep).map(({ crop, ranked }) => ({
      crop: { x: crop.x, y: crop.y, size: crop.size, colours: crop.palette.map((c) => c.hex) },
      ranked: ranked.slice(0, nearest).map((r) => r.id),
    }));
  }
  return answers;
}

/**
 * The puzzle of a level on a day: the same for everyone. The works of `answers` take turns in a shuffled order, a work in `taken`
 * (the other levels of the day) waits for the next one. Null when none is left.
 */
export function puzzleForLevel({ day, level, answers, taken = [], seed = 'detail-dne' }) {
  const order = gameShuffle(Object.keys(answers).sort(), gameRandom(gameHash(`${seed}:${level.id}`)));
  const count = order.length;
  const start = ((day % (count || 1)) + count) % (count || 1);
  const targetId = Array.from({ length: count }, (_, i) => order[(start + i) % count]).find((id) => !taken.includes(id));
  if (!targetId) return null;
  const random = gameRandom(gameHash(`${seed}:${level.id}:${day}`));
  const { crop, ranked } = answers[targetId][Math.floor(random() * answers[targetId].length)];
  const decoys = chooseDecoys({ ranked, count: level.options - 1, reach: level.reach, random });
  const optionIds = gameShuffle([targetId, ...decoys], random);
  const lookId = lookForDay({ level, day, seed });
  const { effect, colour } = gameLooks().find((look) => look.id === lookId);
  return {
    day,
    level: level.id,
    targetId,
    crop,
    optionIds,
    look: lookId,
    effect,
    colour,
  };
}

/**
 * The look of a level on a day: the looks of the level take turns in blocks of their count, each block shuffled by itself, so every
 * look comes as often as the others and never on two days in a row (a block that would start with the last look of the previous one
 * swaps its first two). Days before the first work too.
 */
export function lookForDay({ level, day, seed = 'detail-dne' }) {
  const count = level.looks.length;
  if (count < 3) return level.looks[((day % count) + count) % count];
  const block = (b) => {
    const order = gameShuffle([...level.looks], gameRandom(gameHash(`${seed}:${level.id}:looks:${b}`)));
    const before = gameShuffle([...level.looks], gameRandom(gameHash(`${seed}:${level.id}:looks:${b - 1}`)));
    if (order[0] === before[count - 1]) [order[0], order[1]] = [order[1], order[0]];
    return order;
  };
  const b = Math.floor(day / count);
  return block(b)[day - b * count];
}

/** The count of drops in words, as Czech says it: 1 kapka, 2–4 kapky, 0 and 5 and more kapek. */
export function dropsWord(count) {
  const n = Math.abs(count);
  return n === 1 ? 'kapka' : n >= 2 && n <= 4 ? 'kapky' : 'kapek';
}

/** The puzzles of a day by level id: three different works (`prepared` = level id → answers). */
export function dailyPuzzles({ day, levels, prepared }) {
  const puzzles = {};
  const taken = [];
  for (const level of levels) {
    const puzzle = puzzleForLevel({ day, level, answers: prepared[level.id] ?? {}, taken });
    puzzles[level.id] = puzzle;
    if (puzzle) taken.push(puzzle.targetId);
  }
  return puzzles;
}

/**
 * How strong what covers the close-up is after `misses`: 1 at the first guess, less with each miss, nothing at the last guess
 * (and at the end of the round). The earlier a player guesses, the harder it is, and the more drops it gives.
 */
export function effectStrength(misses, guesses, over = false) {
  return over ? 0 : Math.max(0, 1 - misses / Math.max(1, guesses - 1));
}

/**
 * How strong each effect is at full strength, as a share of the window, so a look is as hard on a phone as on a computer.
 * mist = blur (% of the window: 1 = 5 px of a window of 500 px); rasterStep = the distance of the dots as a share of the window (%);
 * rasterDot = their radius as a share of half of it (%: 100 = dots touch, 141 = nothing left between them); pixelStep = a block of the
 * mosaic as a share of the window (%); wave = how far the ripple moves the picture (% of the window); hue = the shift of colours in degrees.
 */
export function effectSettings() {
  return { mist: 1, rasterStep: 9, rasterDot: 100, pixelStep: 2, wave: 4, hue: 150 };
}

/**
 * The `baseFrequency` of the turbulence of the wave filter for a window of `size` px: always about 6 ripples across and 10 down, so the
 * waves look the same in a window of any size (the frequency of SVG is per px).
 */
export function waveRipple(size) {
  const per = (count) => Math.round((count / Math.max(1, size)) * 10000) / 10000;
  return `${per(6)} ${per(10)}`;
}

/**
 * The look of a close-up at `strength`: `filter` and `mask` for CSS, `wave` = the scale of the SVG filter #game-wave, `pixels` = blocks of
 * the mosaic across the window (0 = no mosaic, drawPixels). mist = out of focus, raster = seen through dots (they grow until nothing is left
 * between them), pixel = a mosaic (its blocks get finer), wave = rippling; gray, sepia, hue = other colours. `size` = the window in px
 * (the blur and the wave are in px of it; the windows of the prototypes are 360 px, windowHtml).
 */
export function effectStyle(effect, colour, strength, settings = effectSettings(), size = 360) {
  const filters = [];
  let mask = '';
  let wave = 0;
  let pixels = 0;
  if (strength > 0) {
    if (colour === 'gray') filters.push(`grayscale(${strength})`);
    if (colour === 'sepia') filters.push(`sepia(${strength})`);
    if (colour === 'hue') filters.push(`hue-rotate(${Math.round(settings.hue * strength)}deg)`);
    if (effect === 'mist' && settings.mist) filters.push(`blur(${Math.round((settings.mist / 100) * size * strength * 10) / 10}px)`);
    wave = effect === 'wave' ? Math.round((settings.wave / 100) * size * strength) : 0;
    if (wave) filters.push('url(#game-wave)');
    if (effect === 'pixel' && settings.pixelStep) pixels = Math.round(100 / (settings.pixelStep * strength));
    if (effect === 'raster') {
      const radius = Math.round(141 - (141 - settings.rasterDot) * strength);
      mask = `radial-gradient(circle closest-side, #000 ${radius}%, transparent ${radius + 4}%) 0 0 / ${settings.rasterStep}% ${settings.rasterStep}%`;
    }
  }
  return { filter: filters.join(' '), mask, wave, pixels };
}

/** A pair [effect, colour] as short text: `mist`, `mist/gray`, `none`, `none/gray`. */
export function lookKey([effect, colour]) {
  return `${effect ?? 'none'}${colour ? `/${colour}` : ''}`;
}

/**
 * The HTML of a window of the game on `frame` of a picture (`src`, height / width `ratio`), 360 px drawn and scaled by `zoom`, under
 * `style` (effectStyle; its wave points to the SVG filter `waveId`, a mosaic gets a canvas for drawPixels with its frame and blocks).
 * The raster masks `.clip`, the size of the window (its dots are a share of it); the filter is on `.view`, which the page makes reach
 * beyond the window, so a wave or a mist never tears the edge. The prototypes show many windows side by side with it, each looks the
 * same as the stage of the game.
 */
export function windowHtml({ src, ratio, frame, style, zoom = 1, waveId = 'game-wave' }) {
  const scale = 1 / (frame.size * Math.min(1, ratio));
  const x = 180 - frame.x * 360 * scale;
  const y = 180 - frame.y * ratio * 360 * scale;
  const filter = style.wave ? style.filter.replace('#game-wave', `#${waveId}`) : style.filter;
  const mask = style.mask ? `mask:${style.mask};-webkit-mask:${style.mask};` : '';
  const pixels = style.pixels ? `<canvas data-frame='${JSON.stringify(frame)}' data-blocks="${style.pixels}"></canvas>` : '';
  return `<div class="tile" style="--zoom:${zoom}"><div class="window"><div class="clip" style="${mask}"><div class="view" style="filter:${filter}"><img src="${src}" alt="" style="transform:translate(${x}px,${y}px) scale(${scale})" />${pixels}</div></div></div></div>`;
}

/**
 * A fixed sample of `count` works as different as possible, to try every look on: the ones picked by hand (`fixed`) first, without
 * them the one closest to the average, then always the one farthest from all chosen (the colours of its places in Lab, how much is
 * going on there, another technique counts as `techniqueGap` farther). Only works of `ids` (the answers of the game) with an analysis,
 * a picked one that is not among them any more is skipped; ties by id, so it stays the same.
 */
export function representativeSample({ works, analyses, ids, count = 12, techniqueGap = 25, fixed = [] }) {
  const features = works
    .filter((w) => ids.includes(w.id) && analyses[w.id]?.places?.length)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((work) => {
      const sum = [0, 0, 0];
      let weight = 0;
      let detail = 0;
      for (const place of analyses[work.id].places) {
        detail += place.detail;
        for (const colour of place.palette) {
          colour.lab.forEach((v, c) => { sum[c] += v * colour.weight; });
          weight += colour.weight;
        }
      }
      return { work, lab: sum.map((v) => v / (weight || 1)), detail: detail / analyses[work.id].places.length };
    });
  const distance = (a, b) => Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2], a.detail - b.detail)
    + (a.work.technique === b.work.technique ? 0 : techniqueGap);
  if (!features.length) return [];
  const mean = { work: {}, lab: [0, 1, 2].map((c) => features.reduce((t, f) => t + f.lab[c], 0) / features.length), detail: features.reduce((t, f) => t + f.detail, 0) / features.length };
  const near = (f) => Math.hypot(f.lab[0] - mean.lab[0], f.lab[1] - mean.lab[1], f.lab[2] - mean.lab[2], f.detail - mean.detail);
  const picked = fixed.map((id) => features.find((f) => f.work.id === id)).filter(Boolean).slice(0, count);
  const chosen = picked.length ? picked : [features.reduce((best, f) => (near(f) < near(best) ? f : best))];
  while (chosen.length < Math.min(count, features.length)) {
    const gap = (f) => Math.min(...chosen.map((c) => distance(f, c)));
    const rest = features.filter((f) => !chosen.includes(f));
    chosen.push(rest.reduce((best, f) => (gap(f) > gap(best) ? f : best)));
  }
  return chosen.map((f) => f.work.id);
}

/** The square of a picture of `width` × `height` px that a `frame` shows (gameFrame), in px. */
export function frameSource(frame, width, height) {
  const side = frame.size * Math.min(width, height);
  return { x: frame.x * width - side / 2, y: frame.y * height - side / 2, side };
}

/**
 * Draws a mosaic of `blocks` × `blocks` of what `frame` shows of `img` on `canvas`, which CSS stretches over the window with
 * `image-rendering: pixelated`. Each block is the average of its part of the picture.
 */
export function drawPixels(canvas, img, frame, blocks) {
  const { x, y, side } = frameSource(frame, img.naturalWidth, img.naturalHeight);
  canvas.width = blocks;
  canvas.height = blocks;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(img, x, y, side, side, 0, 0, blocks, blocks);
}

/**
 * What the stage shows after `misses` misses: `x`, `y` = centre (share of width, height), `size` = share of the shorter
 * side, from the close-up up to `last` of the shorter side. Every view stays inside the `safe` part of the picture of height / width
 * `ratio` (as analyzePixels: `margin` from every edge, `bottom` from the lower one): the edges of the paper, the title and the signature
 * give a work away at once, so no view of a puzzle ever shows them, however far it zooms out. A view too big for it shrinks to fit.
 * A quiz with a place picked by hand passes `{ margin: 0, bottom: 0 }`.
 */
export function gameFrame(crop, misses, maxMisses, ratio, last = 0.5, safe = { margin: 0.08, bottom: 0.18 }) {
  const across = Math.min(1, ratio);
  const down = Math.min(1, 1 / ratio);
  const fit = Math.min((1 - 2 * safe.margin) / across, (1 - safe.margin - safe.bottom) / down);
  const top = Math.min(last, fit);
  const start = Math.min(crop.size, top);
  const size = start * (top / start) ** (Math.min(misses, maxMisses) / Math.max(1, maxMisses));
  const inside = (v, low, high) => Math.min(high, Math.max(low, v));
  return {
    x: inside(crop.x, safe.margin + (size * across) / 2, 1 - safe.margin - (size * across) / 2),
    y: inside(crop.y, safe.margin + (size * down) / 2, 1 - safe.bottom - (size * down) / 2),
    size,
  };
}

/**
 * The hint after a miss: the attribute of the target that rules out the fewest of the `remaining` works, at least one and at most
 * `most`, so it helps without giving the answer away (no such attribute = no hint, only the zoom). `{ text, reasons }`: what the player
 * learns and what is ruled out, and for each ruled out id its own value, shown on its thumbnail so that the reason is visible. Or null.
 */
export function gameHint(target, remaining, most = 2) {
  const hints = [
    ['year', `Hledaný obraz je z roku ${target.year}. Obrazy z jiných let jsou vyřazené.`, (w) => `z roku ${w.year}`],
    ['technique', `Hledaný obraz je ${target.technique}. Jiné techniky jsou vyřazené.`, (w) => w.technique],
    ['collection',
      target.collection ? `Hledaný obraz je z kolekce ${target.collectionTitle}. Obrazy odjinud jsou vyřazené.` : 'Hledaný obraz není v žádné kolekci. Obrazy z kolekcí jsou vyřazené.',
      (w) => w.collectionTitle || 'bez kolekce'],
  ];
  let best = null;
  for (const [key, text, label] of hints) {
    const removed = remaining.filter((w) => w.id !== target.id && w[key] !== target[key]);
    if (removed.length && removed.length <= most && (!best || removed.length < Object.keys(best.reasons).length)) {
      best = { text, reasons: Object.fromEntries(removed.map((w) => [w.id, label(w)])) };
    }
  }
  return best;
}

/** What a player's round keeps of its puzzle, so a played day stays the same after new works change the order of the days. */
export function roundPuzzle(puzzle) {
  return { targetId: puzzle.targetId, crop: puzzle.crop, optionIds: puzzle.optionIds, look: puzzle.look, ...(puzzle.view ? { view: puzzle.view } : {}) };
}

/**
 * How far a puzzle zooms out at its last try (share of the shorter side): its own `view` when the plan gave it one (a work with
 * places the author keeps out of the game, puzzleView of scripts/lib/game-exclusions.mjs), otherwise its level's.
 */
export const lastViewOf = (puzzle, level) => puzzle?.view ?? level.lastView;

/**
 * The puzzle a player sees: the one their round kept (`round.puzzle`, roundPuzzle) while all its works are still on the site
 * (`hasWork`), otherwise the one of the day (`computed`, null without one).
 */
export function keptPuzzle({ computed, round, hasWork, day, level }) {
  const kept = round?.puzzle;
  if (!kept || ![kept.targetId, ...kept.optionIds].every(hasWork)) return computed;
  const look = gameLooks().find((l) => l.id === kept.look) ?? gameLooks().find((l) => l.id === computed?.look) ?? gameLooks()[0];
  return { day, level, ...kept, look: look.id, effect: look.effect, colour: look.colour };
}

/** The date (YYYY-MM-DD) of the day `day` counted from `epoch`; gameDay the other way. */
export function gameDate(day, epoch) {
  return new Date(Date.parse(`${epoch}T00:00:00Z`) + day * 86400000).toISOString().slice(0, 10);
}

/** The year of a date (YYYY-MM-DD) and its number in that year (1 January = 1): `{ year, number }`. */
export function yearDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  return { year, number: Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1 };
}

/**
 * The key of the day of a date (YYYY-MM-DD): "2026-320" = the year and the number of the day in it. The same everywhere: the key of
 * the day in the plan file (game/detail-dne/2026.json), the address of a day of the archive (`?den=2026-320`), the events of Google
 * Analytics and the diagnostics; only the title shows it its own way (dayLabel).
 */
export function dayId(date) {
  const { year, number } = yearDay(date);
  return `${year}-${number}`;
}

/** The day of dayId as the title of the game shows it: "2026#320". */
export function dayLabel(date) {
  const { year, number } = yearDay(date);
  return `${year}#${number}`;
}

/** The day of the game of a key of dayId ("2026-320"), null when it is no key or the year has no such day. */
export function dayOfId(id, epoch) {
  const found = String(id ?? '').match(/^(\d{4})-(\d{1,3})$/);
  if (!found) return null;
  const [year, number] = [Number(found[1]), Number(found[2])];
  const day = Math.round((Date.UTC(year, 0, number) - Date.parse(`${epoch}T00:00:00Z`)) / 86400000);
  return number >= 1 && yearDay(gameDate(day, epoch)).year === year ? day : null;
}

/**
 * The day of the game of the address `?den=<dayId>`: today without it, or when it is not a played day yet (the future, before the
 * first day, a day the year does not have, anything else).
 */
export function dayFromParam(value, today, epoch) {
  const day = dayOfId(value, epoch);
  return day !== null && day >= 0 && day <= today ? day : today;
}

/** The days of the archive, the newest first: every day before `today`, back to the first day. */
export function archiveDays(today) {
  return Array.from({ length: Math.max(0, today) }, (_, i) => today - 1 - i);
}

/**
 * The key of a round in the progress of a player (the rounds and `played`): the key of its day (dayId) and the level,
 * "2026-320:easy", the same as in the plan file; `epoch` = the first day of the game.
 */
export function roundKey(day, level, epoch) {
  const [year, month, date] = new Date(Date.parse(`${epoch}T00:00:00Z`) + day * 86400000).toISOString().slice(0, 10).split('-').map(Number);
  return `${year}-${Math.round((Date.UTC(year, month - 1, date) - Date.UTC(year, 0, 1)) / 86400000) + 1}:${level}`;
}

/** The order of a key of roundKey: its year and number in the year as one number (later = bigger), NaN for anything else. */
export function roundOrder(key) {
  const found = String(key).match(/^(\d{4})-(\d{1,3}):/);
  return found ? Number(found[1]) * 1000 + Number(found[2]) : NaN;
}

/** How a player did in each level on `day` (`played` of the progress, by roundKey): 'solved', 'lost' or null (not played). */
export function dayMarks(played, day, levels, epoch) {
  return levels.map((level) => {
    const result = played[roundKey(day, level.id, epoch)];
    return result ? (result.solved ? 'solved' : 'lost') : null;
  });
}

/** The days of the archive before `before` with a level the player has not played, the newest first. */
export function unplayedDays({ played, levels, before, epoch }) {
  return archiveDays(before).filter((day) => dayMarks(played, day, levels, epoch).includes(null));
}

/**
 * Whether a day went perfectly: `results` = what the player did in each level of the day that has a puzzle (`played` of the progress,
 * undefined for a level not played yet); every level solved at the first guess.
 */
export function perfectDay(results) {
  return results.length > 0 && results.every((r) => r?.solved === true && r.misses === 0);
}

/** The congratulation of a perfect day (perfectDay), over the box of the end. */
export const PERFECT_DAY_TEXT = 'Všechny tři napoprvé! Gratuluji, ty jsi snad sama autorka, nebo výborný znalec jejího díla!';

/**
 * The box under the result of a round, always two lines (each short enough for one line on a phone): what is left of the day and
 * where to go on. Levels of the day still to play (`left`, `{ id, label }`): their names as buttons (`data-level`: the page switches to
 * the level and goes up to the game). The whole day done: the archive (`waiting` days of it with a level not played, `data-to-archive`)
 * or what comes next. `label` = the day as the title names it (dayLabel), `archive` = a day of the archive.
 */
export function nextStepsHtml({ left, label, archive, waiting }) {
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const line = (text) => `<span class="line">${text}</span>`;
  if (left.length) {
    const buttons = left.map((l) => `<button class="to-level" type="button" data-level="${escape(l.id)}">${escape(l.label)}</button>`);
    const names = buttons.length === 1 ? buttons[0] : `${buttons.slice(0, -1).join(', ')} nebo ${buttons.at(-1)}`;
    return line(left.length === 1 ? 'Ještě ti zbývá jedna obtížnost:' : 'Ještě můžeš hrát obtížnosti:') + line(names);
  }
  const days = waiting === 1 ? 'den' : waiting >= 2 && waiting <= 4 ? 'dny' : 'dní';
  const next = waiting
    ? `<a class="to-archive" href="#archiv" data-to-archive>V archivu čeká ještě ${waiting} ${days} ↓</a>`
    : archive ? 'Archiv máš celý dohraný.' : 'Zítra přijdou nové detaily.';
  return line(archive ? `Den ${escape(label)} máš za sebou.` : 'Dnešní detaily máš za sebou.') + line(next);
}

/** A count of days in words, as Czech says it: 1 den, 2–4 dny, 0 and 5 and more dní. */
export function daysWord(count) {
  const n = Math.abs(count);
  return n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní';
}

/**
 * What is on the screen now, for the diagnostics under the game (only while the family tests it): the day, the level and its settings,
 * the work and its close-up, the view of this try, the look with the CSS it makes now, the thumbnails and the round, as rows
 * `[label, value]`. `kept` = the puzzle comes from the player's round (roundPuzzle), not from today's computation; `titleOf` = id → title.
 */
export function gameDiagnostics({ day, today, date, level, puzzle, round, work, kept = false, titleOf = (id) => id, size = 360 }) {
  const share = (v) => `${Math.round(v * 1000) / 10} %`;
  const named = (ids) => (ids.length ? ids.map((id) => `${titleOf(id)} (${id})`).join(' · ') : '–');
  const look = gameLooks().find((l) => l.id === puzzle.look) ?? { id: puzzle.look, label: '?', effect: puzzle.effect ?? null, colour: puzzle.colour ?? null };
  const tries = round.guesses.length;
  const strength = effectStrength(tries, level.guesses, round.over);
  const style = effectStyle(look.effect, look.colour, strength, effectSettings(), size);
  const view = round.over ? null : gameFrame(puzzle.crop, tries, level.guesses - 1, work.ratio, lastViewOf(puzzle, level));
  const misses = tries - (round.solved ? 1 : 0);
  const state = round.over ? (round.solved ? `uhodnuto po ${misses} omylech` : 'neuhodnuto') : `pokus ${tries + 1} z ${level.guesses}`;
  return [
    ['Den', `${yearDay(date).number}. den roku ${yearDay(date).year} · ${new Date(`${date}T12:00:00Z`).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · ${day === today ? 'dnes' : day > today ? 'budoucí' : 'archiv'}`],
    ['Klíč dne', `${dayId(date)} (v nadpisu ${dayLabel(date)}) · plán game/detail-dne/${yearDay(date).year}.json, den "${dayId(date)}" · adresa ?den=${dayId(date)} · ${day}. den hry od začátku`],
    ['Úroveň', `${level.label} (${level.id}) · ${level.options} náhledů · ${level.guesses} pokusy · nápovědy ${level.hints ? 'ano' : 'ne'} · kapky ×${level.drops}`],
    ['Výběr výřezu', `velikost ${share(level.size)} · místo ${level.zone} · ${level.pick}${level.maxConfusion ? ` (max. ${level.maxConfusion})` : ''} · podobnost náhledů ${level.reach} · poslední pohled ${share(level.lastView)}`],
    ['Hádanka', `${kept ? 'uložená v kole hráče' : puzzle.planned ? `z plánu dnů, detail #${puzzle.detail ?? '?'}` : 'spočítaná pro den'} · vzhledy úrovně ${level.looks.join(', ')}`],
    ['Obraz', `${work.title} (${work.id}) · ${work.technique} · ${work.year} · výška/šířka ${Math.round(work.ratio * 100) / 100}`],
    ['Výřez', `střed ${share(puzzle.crop.x)} × ${share(puzzle.crop.y)} · velikost ${share(puzzle.crop.size)} · barvy ${(puzzle.crop.colours ?? []).join(' ')}`],
    ['Stav', state],
    ['Pohled teď', view ? `střed ${share(view.x)} × ${share(view.y)} · velikost ${share(view.size)}` : 'celý obraz'],
    ['Vzhled', `${look.label} (${look.id}) · efekt ${look.effect ?? 'žádný'} · barvy ${look.colour ?? 'beze změny'} · síla teď ${Math.round(strength * 100)} %`],
    ['CSS teď', [style.filter && `filter: ${style.filter}`, style.mask && `mask: ${style.mask}`, style.wave && `vlnění ${style.wave} px (vlny ${waveRipple(size)})`, style.pixels && `mozaika ${style.pixels} kostek na šířku`].filter(Boolean).join(' · ') || 'nic'],
    ['Nastavení efektů', Object.entries(effectSettings()).map(([key, value]) => `${key} ${value}${key === 'hue' ? '°' : key === 'rasterDot' ? ' % půlrozteče' : ' % okna'}`).join(' · ')],
    ['Náhledy', puzzle.optionIds.map((id) => `${id === puzzle.targetId ? '✓ ' : ''}${titleOf(id)} (${id})`).join(' · ')],
    ['Tipy', named(round.guesses)],
    ['Vyřazené nápovědou', named(round.ruledOut.filter((id) => !round.guesses.includes(id)))],
  ];
}

/** The diagnostics as plain text to paste into a message: the address first, then a row a line ("label: value"). */
export function diagnosticsText(rows, address = '') {
  return [...(address ? [address] : []), ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n');
}

/**
 * The days of the archive (newest first) in groups by month (`month` = YYYY-MM, `epoch` = the first day of the game), the newest
 * month first; one group = no headings needed. `waiting` = how many of its days have a level the player has not played (`played`
 * of the progress; without it 0).
 */
export function monthGroups(days, epoch, played = null, levels = []) {
  const groups = [];
  for (const day of days) {
    const month = gameDate(day, epoch).slice(0, 7);
    if (groups.at(-1)?.month !== month) groups.push({ month, days: [], waiting: 0 });
    const group = groups.at(-1);
    group.days.push(day);
    if (played && dayMarks(played, day, levels, epoch).includes(null)) group.waiting++;
  }
  return groups;
}

/** The state of a puzzle before the first guess. */
/**
 * One thumbnail of the offer (the daily game and the quiz of a visitor): a button while the round goes on (a miss red and faded,
 * a ruled out one faded with its reason over it), after the end a link to the page of the work with its title (the right one
 * green, the missed ones red, none faded any more). `work` = { id, title, url }, `src` = its small picture, `round` (newRound,
 * applyGuess), `targetId` = the right one.
 */
/** Room in px kept under the thumbnails at the bottom of the screen. */
export const SCREEN_GAP = 12;
/** The smallest the stage gets: everything fits on the screen first, only on an absurdly small one it gives up. */
export const MIN_STAGE = 120;

/**
 * The size of the stage (and the widest the thumbnails may be) so the stage, the status and all thumbnails fit on the screen under
 * the top of the game (the game and a quiz of a visitor, fitStage):
 * - one column (a phone upright): the stage as big as it can be with the status and all thumbnails under it (MIN_STAGE only on an
 *   absurdly small screen);
 * - two columns (`wide`: a computer, a phone on its side): the stage takes its half but no more than the height of the screen, and the
 *   thumbnails get narrower until the status and all of them fit by the stage too (a phone on its side is low).
 * All in px: `full` = the width the stage has without a limit, `screen` = the height of the window, `top` = the top of the stage
 * under the top of the game, `status` and `options` = their heights, `optionsWidth` = the width of the thumbnails now.
 * Returns { stage, options } (options = their widest, or null = as wide as they are).
 */
export function stageFit({ wide, full, screen, top, status, options, optionsWidth }) {
  if (wide) {
    const free = screen - top - SCREEN_GAP;
    // three rows of 4 : 3 thumbnails, three in a row, gaps of 6 px: height = 3 × (width - 12) / 3 × 3 / 4 + 12 = (width - 12) × 3 / 4 + 12
    const forOptions = screen - top - status - 10 - SCREEN_GAP;
    const widest = Math.round(((forOptions - 12) * 4) / 3 + 12);
    return { stage: Math.round(Math.max(MIN_STAGE, Math.min(full, free))), options: widest < optionsWidth ? Math.max(160, widest) : null };
  }
  const below = status + options + 12 + 10 + SCREEN_GAP;
  return { stage: Math.round(Math.max(MIN_STAGE, Math.min(full, screen - top - below))), options: null };
}

/**
 * Fits the stage of a drawn round in `root` (its .stage, .status and .options) to the screen (stageFit), measured once for each `key`
 * in `fitted` (the toolbar of a mobile browser comes and goes while playing, and nothing may change with it); the game keys it by the
 * width, level and archive, a quiz by the width. Sets the width of the stage, its bleed and the widest the thumbnails may be.
 */
export function fitStageIn(root, { wide, key, fitted }) {
  const stage = root.querySelector('.stage');
  if (!stage) return;
  const options = root.querySelector('.options');
  const status = root.querySelector('.status');
  if (!fitted.has(key)) {
    stage.style.width = '';
    options.style.maxWidth = '';
    fitted.set(key, stageFit({
      wide,
      full: stage.clientWidth,
      screen: innerHeight,
      top: stage.getBoundingClientRect().top - root.getBoundingClientRect().top,
      status: status.offsetHeight,
      options: options.offsetHeight,
      optionsWidth: options.clientWidth,
    }));
  }
  const fit = fitted.get(key);
  stage.style.width = `${fit.stage}px`;
  // the picture reaches beyond the window by a share of it, more than the wave and the blur take (effectSettings: 4 % + 1 %)
  stage.style.setProperty('--bleed', `${Math.max(16, Math.ceil(fit.stage * 0.08))}px`);
  options.style.maxWidth = fit.options ? `${fit.options}px` : '';
}

/**
 * Sets a freshly drawn stage (the game and a quiz) without its transitions (`apply`), so it never moves there from where the browser put it first:
 * a new picture is the whole work until it gets its frame, and a transition from there would show the whole work being looked
 * for. The transitions of `elements` are off while `apply` runs, the page is laid out (getBoundingClientRect) and then they are
 * back, so only a change after this one moves (a miss zooming out, the end showing the work).
 */
export function withoutMotion(elements, apply) {
  for (const el of elements) el.style.transition = 'none';
  apply();
  elements[0]?.getBoundingClientRect();
  for (const el of elements) el.style.transition = '';
}

export function optionHtml({ work, src, round, targetId }) {
  const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (round.over) {
    const mark = work.id === targetId ? ' right' : round.guesses.includes(work.id) ? ' wrong' : '';
    return `<a class="option done${mark}" href="${esc(work.url)}" title="${esc(work.title)}" aria-label="Prohlédnout obraz ${esc(work.title)}"><img src="${esc(src)}" alt="" /></a>`;
  }
  const classes = ['option'];
  if (round.guesses.includes(work.id)) classes.push('wrong', 'out');
  else if (round.ruledOut.includes(work.id)) classes.push('out');
  const reason = round.reasons[work.id];
  const named = reason ? `Vyřazeno: ${esc(reason)}` : 'Obraz';
  const disabled = classes.includes('out') ? ' disabled' : '';
  const because = reason ? `<span class="because">${esc(reason)}</span>` : '';
  return `<button class="${classes.join(' ')}" type="button" data-id="${work.id}" aria-label="${named}"${disabled}><img src="${esc(src)}" alt="" />${because}</button>`;
}

export function newRound() {
  return { guesses: [], ruledOut: [], reasons: {}, hints: [], solved: false, over: false };
}

/**
 * The state after guessing `id` (`works` = the works of the options, `maxGuesses` tries, `useHints`: a miss may rule out more, and
 * says why). A guess that cannot be made (the end, the same one again, a ruled out one) changes nothing.
 */
export function applyGuess(round, puzzle, works, id, maxGuesses = 4, useHints = true) {
  if (round.over || round.guesses.includes(id) || round.ruledOut.includes(id)) return round;
  const guesses = [...round.guesses, id];
  if (id === puzzle.targetId) return { ...round, guesses, solved: true, over: true };
  if (guesses.length >= maxGuesses) return { ...round, guesses, over: true };
  const out = [...round.ruledOut, id];
  const target = works.find((w) => w.id === puzzle.targetId);
  const hint = useHints ? gameHint(target, works.filter((w) => !out.includes(w.id))) : null;
  if (!hint) return { ...round, guesses, ruledOut: out };
  return { ...round, guesses, ruledOut: [...out, ...Object.keys(hint.reasons)], reasons: { ...round.reasons, ...hint.reasons }, hints: [...round.hints, hint.text] };
}

/**
 * The drops for a solved puzzle: fewer misses = more, a series of days adds up to 5, a day from the archive half without bonus;
 * all times `multiplier` of the level.
 */
export function dropsFor(misses, streak, archive = false, multiplier = 1) {
  const base = [10, 6, 3, 1][misses] ?? 1;
  return multiplier * (archive ? Math.ceil(base / 2) : base + Math.min(5, Math.max(0, streak - 1)));
}

/** The words for a solved puzzle: the fewer misses, the bigger. */
export function winTitle(misses) {
  return ['Mistrovské oko!', 'Bystré oko!', 'Trefa!', 'Na poslední chvíli!'][misses] ?? 'Trefa!';
}

/**
 * The ranks `[from, title]`: the drops a player who solves every level of every day at the first guess (90 drops a day once the
 * series is full) has at the end of day 1, 3, 6, 10, 15, 22, 32, 46, 66, 96, 136, 196, 286, 406, 586 and then every 180 days, so
 * a rank comes after days at first, then weeks, then months, never later than half a year (gameRank goes on past the last one).
 */
export function gameRanks() {
  return [
    [0, 'Vylitý kelímek'], [60, 'Mokrý štětec'], [190, 'Kapka na papíře'], [450, 'Čistá voda'], [810, 'První skica'],
    [1250, 'Barevná paleta'], [1850, 'Mokré do mokrého'], [2750, 'Lazura'], [4050, 'Bystré oko'], [5850, 'Skicář'],
    [8550, 'Plenérista'], [12100, 'Lovec světla'], [17500, 'Strážce odstínů'], [25600, 'Znalec papíru'], [36400, 'Mistr lazury'],
    [52600, 'Mistr akvarelu'], [68800, 'Velmistr akvarelu'], [85000, 'Znalec díla'], [101200, 'Strážce galerie'],
    [117400, 'Čestný člen ateliéru'], [133600, 'Legenda ateliéru'], [149800, 'Druhé oko autorky'],
  ];
}

/**
 * The rank for the drops collected: `{ index, title, next, nextTitle }` (`next` = the drops the next one needs). Past the last rank
 * of gameRanks a star every 16 200 drops (half a year of perfect days): "Druhé oko autorky ★2", ★3…, so the scale never ends.
 */
export function gameRank(drops) {
  const ranks = gameRanks();
  const step = 16200;
  const [top, topTitle] = ranks[ranks.length - 1];
  const starred = (stars) => (stars > 1 ? `${topTitle} ★${stars}` : topTitle);
  if (drops >= top) {
    const stars = 1 + Math.floor((drops - top) / step);
    return { index: ranks.length - 2 + stars, title: starred(stars), next: top + stars * step, nextTitle: starred(stars + 1) };
  }
  const index = ranks.reduce((found, [from], i) => (drops >= from ? i : found), 0);
  return { index, title: ranks[index][1], next: ranks[index + 1][0], nextTitle: ranks[index + 1][1] };
}

/** How many days of the archive, every level solved at the first guess, fill the cap of one real day (archiveCap). */
export const ARCHIVE_DAYS_A_DAY = 3;

/**
 * The most drops the archive gives in one real day: ARCHIVE_DAYS_A_DAY days of the archive with every level solved at the first guess
 * (half drops, each level times its multiplier: 5 + 10 + 15 = 30 a day, so 90), as much as one perfect real day with a full series.
 */
export function archiveCap(levels = gameLevels()) {
  return ARCHIVE_DAYS_A_DAY * levels.reduce((sum, level) => sum + dropsFor(0, 0, true, level.drops), 0);
}

/**
 * The drops the archive may still give today (`today` = the day of the game now): `{ cap, used, left }`. The days of the archive
 * count into the rank only up to `cap` drops a day (archiveCap), so a new player cannot leap many ranks by playing a year of the
 * archive at once; over it the rounds give no drops (the works still go into the collection).
 */
export function archiveRoom(progress, today, epoch) {
  const cap = archiveCap();
  const todayKey = roundKey(today, '', epoch).slice(0, -1);
  const used = progress.archiveDay === todayKey ? progress.archiveDrops ?? 0 : 0;
  return { cap, used, left: Math.max(0, cap - used) };
}

/**
 * A number of drops for the player: thousands apart by a non-breaking space ("16 100"), so big numbers read at a glance and never
 * break over two lines (self-contained, the same in every browser, unlike toLocaleString).
 */
export function groupDigits(number) {
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/**
 * The rank in the top line of the game, the longest first, each shorter than the one before (the game shows the first one that fits
 * in the line by the title, the whole in the bubble, statsTitle): `[number, title, the drops to the next one]` as HTML.
 */
export function rankForms(drops) {
  const rank = gameRank(drops);
  const number = `#${rank.index + 1}`;
  const next = ` · další za ${groupDigits(rank.next - drops)} 💧`;
  return [`Hodnost ${number} <b>${rank.title}</b>${next}`, `${number} <b>${rank.title}</b>${next}`, `${number} <b>${rank.title}</b>`, `Hodnost <b>${number}</b>`, `<b>${number}</b>`];
}

/**
 * The bubble over the drops, the series and the rank at the top of the game: a short block for each with a blank line between them
 * (the player's numbers, then what they mean), the cap of the archive, and where the whole rules are (rulesHtml; the line is a link
 * to them). `progress` = { drops, streak }.
 */
export function statsTitle({ drops, streak }) {
  const rank = gameRank(drops);
  const days = streak === 1 ? 'den' : streak >= 2 && streak <= 4 ? 'dny' : 'dní';
  const word = drops === 1 ? 'kapka' : drops >= 2 && drops <= 4 ? 'kapky' : 'kapek';
  return [
    `💧 ${groupDigits(drops)} ${word}`,
    'Za každý uhodnutý detail. Čím dřív a čím těžší úroveň, tím víc.',
    '',
    `🔥 Série ${streak} (${streak} ${days} v řadě)`,
    'Kolik dní po sobě hraješ. Každý další den přidá bonus, vynechaný den začne sérii znovu.',
    '',
    `🏅 Hodnost #${rank.index + 1} ${rank.title}`,
    `Do #${rank.index + 2} ${rank.nextTitle} zbývá ${groupDigits(rank.next - drops)} 💧.`,
    '',
    '📅 Archiv',
    `Za poloviční kapky, do hodnosti nejvýš ${archiveRoom({}, 0, '2026-01-01').cap} 💧 za den.`,
    '',
    'Celá pravidla najdeš pod hrou, stačí kliknout.',
  ].join('\n');
}

/**
 * The player's own numbers by the headings of the rules (`data-mine` of rulesHtml): the drops, the series, the rank with its number
 * and title, and what is left to the next one. Plain text; `progress` = { drops, streak }.
 */
export function rulesMine({ drops, streak }) {
  const rank = gameRank(drops);
  return {
    drops: ` · máš ${groupDigits(drops)}`,
    streak: ` · máš ${streak}`,
    rank: ` · máš #${rank.index + 1} ${rank.title}`,
    next: `Do #${rank.index + 2} ${rank.nextTitle} ti zbývá ${groupDigits(rank.next - drops)} 💧.`,
  };
}

/**
 * The bubble over the cap of the archive in the bar of an archive day: what it means for the player (`left` of `cap` drops the
 * archive still gives today, archiveRoom).
 */
export function archiveRoomTitle({ cap, left }) {
  return left
    ? `Z archivu se za den započte nejvýš ${cap} 💧, dnes ještě ${left}. Pak můžeš hrát dál a obrazy přibývají do sbírky, jen už bez kapek.`
    : `Dnešních ${cap} 💧 z archivu už máš. Hrát můžeš dál a uhodnuté obrazy přibývají do sbírky, ale nové kapky z archivu dnes už nedostaneš. Zítra zase až ${cap} 💧.`;
}

/**
 * The hidden switch of the diagnostics on a keyboard: `word` typed anywhere on the page. `recent` = the last characters typed so far,
 * `key` = KeyboardEvent.key; keys that type nothing (Shift, arrows) leave `recent` as it is. Returns `{ recent, matched }`.
 */
export function magicWord(recent, key, word) {
  if ([...key].length !== 1) return { recent, matched: false };
  const next = (recent + key.toLowerCase()).slice(-word.length);
  return { recent: next, matched: next === word };
}

/**
 * The hidden switch of the diagnostics on a phone: `count` taps within `within` ms (`taps` = the times of the taps so far, `now` = this
 * one). Returns `{ taps, matched }`; a match starts counting again.
 */
export function tapBurst(taps, now, count = 5, within = 3000) {
  const recent = [...taps, now].filter((time) => now - time <= within);
  return recent.length >= count ? { taps: [], matched: true } : { taps: recent, matched: false };
}

/**
 * The line in the card of the result when the cap of the archive took drops away (`gained` counted of `gained + capped`, finishRound):
 * short, the whole meaning is in its bubble (archiveRoomTitle).
 */
export function cappedText({ gained, capped }) {
  return gained ? `Strop archivu: započteno ${gained} z ${groupDigits(gained + capped)} 💧.` : 'Strop archivu: dnes už bez kapek, další zítra.';
}

/**
 * The section "Jak se hraje" under the game (built with the page, gamePageHtml): short blocks with an icon each (the day, the drops
 * with their table from gameLevels and dropsFor, the series, the archive and its cap, the ranks with the whole list folded, the
 * collection). The script of the game marks the player's rank in the list (`data-rank` = gameRank index) and fills the player's own
 * numbers next to the headings (`data-mine`, rulesMine): on a narrow phone the line at the top has no room for the rank, and a tap
 * on the drops leads here.
 */
export function rulesHtml() {
  const levels = gameLevels();
  const cap = archiveRoom({}, 0, '2026-01-01').cap;
  const most = Math.max(...levels.map((l) => l.guesses));
  const ordinal = ['Napoprvé', 'Na 2. pokus', 'Na 3. pokus', 'Na 4. pokus', 'Na 5. pokus'];
  const rows = Array.from({ length: most }, (_, m) => `<tr><th scope="row">${ordinal[m]}</th>${levels.map((l) => `<td>${m < l.guesses ? dropsFor(m, 1, false, l.drops) : '–'}</td>`).join('')}</tr>`).join('');
  const series = levels.map((l) => `+${5 * l.drops}`).join(' / ');
  const ranks = gameRanks();
  const list = ranks.map(([from, title], i) => `<li data-rank="${i}"><span>${title}</span> <span class="from">${groupDigits(from)} 💧</span></li>`).join('');
  return `<section class="shelf rules" id="pravidla">
    <h2>Jak se hraje</h2>
    <div class="rule-grid">
      <div class="rule"><h3><span aria-hidden="true">🔍</span> Tři detaily denně</h3>
        <p>Každý den tři výřezy z obrazů, v lehké, střední a těžké úrovni. Najdi mezi náhledy ten, ze kterého je. Po omylu se detail oddálí, v lehké úrovni přijde i nápověda.</p></div>
      <div class="rule"><h3><span aria-hidden="true">💧</span> Kapky<span class="mine" data-mine="drops" hidden></span></h3>
        <p>Za každý uhodnutý detail. Čím dřív a čím těžší úroveň, tím víc:</p>
        <table class="drops"><thead><tr><th></th>${levels.map((l) => `<th scope="col">${l.label}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="rule"><h3><span aria-hidden="true">🔥</span> Série<span class="mine" data-mine="streak" hidden></span></h3>
        <p>Hraj den po dni: každý další den v řadě přidá k zisku bonus, od šestého dne plný (${series} 💧 podle úrovně). Prohra sérii nepřeruší, vynechaný den ano.</p></div>
      <div class="rule"><h3><span aria-hidden="true">📅</span> Archiv</h3>
        <p>Zmeškané dny dohraješ kdykoli, za poloviční kapky a bez bonusu série. Z archivu se ale za den započte <b>nejvýš ${cap} 💧</b>, co je navíc, propadne. Obraz do sbírky přibude vždycky.</p></div>
      <div class="rule"><h3><span aria-hidden="true">🏅</span> Hodnosti<span class="mine" data-mine="rank" hidden></span></h3>
        <p class="mine-next" data-mine="next" hidden></p>
        <p>Kapky tě posouvají v hodnostech. Ze začátku přicházejí po dnech, pak po týdnech a nakonec po měsících, nejdéle za půl roku. Za poslední přibývají hvězdičky.</p>
        <details><summary>Všech ${ranks.length} hodností</summary><ol class="ranks">${list}</ol></details></div>
      <div class="rule"><h3><span aria-hidden="true">🖼️</span> Sbírka</h3>
        <p>Každý uhodnutý obraz se uloží do tvé sbírky, s tečkami barev detailů, podle kterých se hádal.</p></div>
    </div>
    <p class="note">Kapky, série, hodnost i sbírka se ukládají jen v tomto prohlížeči.</p>
  </section>`;
}

/**
 * What a player collected, before the first game. (Stores of older games also have `pigments`, one row of colours of all the
 * close-ups; the collection takes the colours from the rounds now, gameCollection, and leaves it alone.)
 */
export function newProgress() {
  return { drops: 0, streak: 0, best: 0, lastDay: null, archiveDay: null, archiveDrops: 0, played: {}, collected: [] };
}

/**
 * The progress after finishing the puzzle of a `level` on `day`: `{ progress, gained, rankUp }`. Each puzzle counts once (`played`
 * by roundKey; `lastDay` = the key of the last day of the series, "2026-320"). A series is days played in a row (more games on one
 * day count once, a lost game keeps it, a day left out starts a new one); the days of the archive leave it alone and give drops only
 * up to the cap of today (archiveRoom; `archiveDay` + `archiveDrops`, the round keeps `capped` = the drops left out). A solved puzzle
 * gives drops and the work into the collection (its colours come from the round, gameCollection).
 */
export function finishRound(progress, { day, today, level, epoch, multiplier = 1, solved, misses, workId }) {
  const key = roundKey(day, level, epoch);
  if (progress.played[key]) return { progress, gained: 0, rankUp: false };
  const archive = day !== today;
  // the key of a day (dayId) from the key of its round, so the function stands alone (the prototypes copy it as text)
  const dayKey = (d) => roundKey(d, '', epoch).slice(0, -1);
  const streak = archive || progress.lastDay === dayKey(today) ? progress.streak : progress.lastDay === dayKey(today - 1) ? progress.streak + 1 : 1;
  const full = solved ? dropsFor(misses, streak, archive, multiplier) : 0;
  const room = archive ? archiveRoom(progress, today, epoch) : null;
  const gained = room ? Math.min(full, room.left) : full;
  const drops = progress.drops + gained;
  return {
    gained,
    rankUp: gameRank(drops).title !== gameRank(progress.drops).title,
    progress: {
      drops,
      streak,
      best: Math.max(progress.best, streak),
      lastDay: archive ? progress.lastDay : dayKey(today),
      archiveDay: room ? dayKey(today) : progress.archiveDay ?? null,
      archiveDrops: room ? room.used + gained : progress.archiveDrops ?? 0,
      played: { ...progress.played, [key]: { solved, misses, drops: gained, ...(full > gained ? { capped: full - gained } : {}) } },
      collected: solved && !progress.collected.includes(workId) ? [...progress.collected, workId] : progress.collected,
    },
  };
}

/**
 * The collection of a player ("Moje sbírka"): every work solved in a round, the newest first, each
 * `{ id, colours, times }`: the colours of the close-ups it was guessed by (the newest first, at most `maxColours`, each once) and
 * how many rounds it was solved in. From the rounds (`rounds`, roundKey "2026-320:easy" → `{ solved, puzzle }`, roundPuzzle): the
 * newest day first, on one day the round played last first. A work in `collected` of the progress without a solved round (kept
 * before rounds kept their puzzle) comes last, without colours. Only the works still in the game (`hasWork`).
 */
export function gameCollection({ rounds = {}, collected = [], hasWork = () => true, maxColours = 6 }) {
  const solved = Object.entries(rounds)
    .filter(([, round]) => round?.solved && round.puzzle?.targetId)
    .map(([key, round]) => ({ day: roundOrder(key), puzzle: round.puzzle }))
    .reverse()
    .sort((a, b) => b.day - a.day);
  const items = new Map();
  for (const { puzzle } of solved) {
    const item = items.get(puzzle.targetId) ?? { id: puzzle.targetId, colours: [], times: 0 };
    item.times += 1;
    for (const colour of puzzle.crop?.colours ?? []) {
      if (item.colours.length < maxColours && !item.colours.includes(colour)) item.colours.push(colour);
    }
    items.set(item.id, item);
  }
  for (const id of [...collected].reverse()) {
    if (!items.has(id)) items.set(id, { id, colours: [], times: 1 });
  }

  return [...items.values()].filter((item) => hasWork(item.id));
}

/**
 * The HTML of "Moje sbírka": the works of `items` (gameCollection) as small pictures, each with a row of dots in the colours of
 * its close-ups, and with more than `limit` works only the newest `limit` and a button for the whole collection (`open`: shown
 * whole, the button folds it again; `data-collection-toggle`). No count of works: the game asks for details, not works, and a work
 * may have more of them over time. `work(id)`: `{ title, href, src }` of a work, or null (left out). Without a work the line saying
 * what will come here.
 */
export function collectionHtml({ items, work, limit = 12, open = false }) {
  const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const shown = items.map((item) => ({ ...item, work: work(item.id) })).filter((item) => item.work);
  if (!shown.length) return '<p class="empty">Každý uhodnutý obraz sem přibude, i s barvami detailu, podle kterého se hádal.</p>';
  const pieces = (open ? shown : shown.slice(0, limit)).map(({ work: w, colours, times }) => {
    const title = times > 1 ? `${w.title} (uhodnuto ${times}×)` : w.title;
    const dots = colours.map((c) => `<i style="background:${escape(c)}"></i>`).join('');
    return `<a class="piece" href="${escape(w.href)}" title="${escape(title)}"><img src="${escape(w.src)}" alt="${escape(w.title)}" loading="lazy" /><span class="dots" aria-hidden="true">${dots}</span></a>`;
  }).join('');
  const toggle = shown.length > limit
    ? `<button type="button" class="more" data-collection-toggle aria-expanded="${open}">${open ? 'Jen nejnovější' : 'Celá sbírka'}</button>`
    : '';

  return `<div class="collected">${pieces}</div>${toggle}`;
}

/**
 * The rounds of a made-up player for the prototype ("how will the collection look after a month"): every level of each of `days`
 * days from `start`, solved with the chance `rates[<level>]` (repeatable: by the day and level), kept as a round keeps them.
 */
export function simulatedRounds({ start, days, levels, prepared, epoch, rates = { easy: 0.95, medium: 0.8, hard: 0.6 } }) {
  const rounds = {};
  for (let day = start; day < start + days; day++) {
    const puzzles = dailyPuzzles({ day, levels, prepared });
    for (const level of levels) {
      const puzzle = puzzles[level.id];
      if (!puzzle) continue;
      const solved = gameRandom(gameHash(`simulace:${day}:${level.id}`))() < (rates[level.id] ?? 0.8);
      rounds[roundKey(day, level.id, epoch)] = { guesses: [], solved, over: true, puzzle: roundPuzzle(puzzle) };
    }
  }

  return rounds;
}

/**
 * The text to share, without giving the work away: the day (`label`, dayLabel: "2026#320"), the level and one mark for each guess,
 * a few words on how it went (by the misses of `guesses` tries; `perfect` = the whole day at the first guess, perfectDay) and the
 * invitation. The words say nothing of who shares it (no gender).
 */
export function gameShareText({ label, level, misses, solved, guesses = 4, perfect = false, url }) {
  const marks = '🟨'.repeat(misses) + (solved ? '🟩' : '');
  const words = !solved ? 'Tentokrát vyhrál obraz.'
    : perfect ? 'Všechny tři obtížnosti napoprvé! 🎉'
      : misses === 0 ? 'Hned napoprvé!'
        : misses >= guesses - 1 ? 'Až na poslední pokus, uf!'
          : misses === 1 ? 'Na druhý pokus.' : 'Na třetí pokus, bylo to těsné.';
  return `Detail dne ${label} · ${level} ${marks}\n${words}\nPoznáš obraz podle detailu?\n${url}`;
}

// ---- The plan of the days (game/detail-dne/, scripts/lib/game-plan.mjs) ----
// The pipeline keeps a plan of the days in git: every day played so far and two weeks ahead, each level with its whole puzzle
// (the work, the number of its detail, the close-up, the thumbnails, the look). A day once locked (the past, today, tomorrow)
// never changes, so new works never reshuffle what players have seen; the days after it are planned again by each run, so a new
// work is in the game within two days. Without a planned day the game computes it as before (dailyPuzzles).

/** How many days ahead the plan reaches (a spare, should the pipeline not run for a while). */
export const PLAN_HORIZON = 14;
/** How many days after today are locked as well (tomorrow may already be today somewhere, or in a page loaded late). */
export const PLAN_LOCKED = 1;
/** The days before the same work comes again (any level), while there are enough works. */
export const PLAN_WORK_GAP = 21;
/** The days before the same detail comes again, while the work has another one. */
export const PLAN_DETAIL_GAP = 365;
/** Most places worth guessing the analysis looks for in one level for the plan (a work rich in detail gets many). */
export const PLAN_PLACES_PER_LEVEL = 20;
/**
 * How much of its side a place may share with another one, in every level (after all places that share nothing): more places,
 * so a detail lasts a year. Under 0.5, so the centres stay over half a side apart and every place gets its own number (planDetailOf).
 */
export const PLACE_OVERLAP = 0.4;
/** Most details (places worth guessing) one work gets in all levels; the numbers stay, new places only add up to this. */
export const PLAN_MAX_DETAILS = 60;

/** The details of the works, numbered for good: `{ <work id>: [{ n, level, x, y, size }] }`, a new place gets the next number. */
export function planDetails(catalogue, prepared, levels, max = PLAN_MAX_DETAILS) {
  const out = Object.fromEntries(Object.entries(catalogue ?? {}).map(([id, list]) => [id, list.map((d) => ({ ...d }))]));
  for (const level of levels) {
    for (const [id, crops] of Object.entries(prepared[level.id] ?? {})) {
      const list = out[id] ?? (out[id] = []);
      for (const { crop } of crops) {
        if (planDetailOf(list, level.id, crop)) continue;
        if (list.length >= max) continue;
        list.push({ n: list.reduce((top, d) => Math.max(top, d.n), 0) + 1, level: level.id, x: crop.x, y: crop.y, size: crop.size });
      }
    }
  }

  return out;
}

/** The detail of a work (its list of planDetails) at the place of `crop` in `level`: the same level, the centre within half its size. */
export function planDetailOf(details, level, crop) {
  return (details ?? []).find((d) => d.level === level && Math.hypot(d.x - crop.x, d.y - crop.y) <= crop.size / 2) ?? null;
}

/** The day of the plan as the game plays it: each level `{ targetId, detail, crop, optionIds, look }` (as roundPuzzle, + detail). */
function planEntry(puzzle, details) {
  const detail = planDetailOf(details[puzzle.targetId], puzzle.level, puzzle.crop);
  return { targetId: puzzle.targetId, detail: detail?.n ?? null, crop: puzzle.crop, optionIds: puzzle.optionIds, look: puzzle.look };
}

/**
 * The plan after a run of the pipeline on `today` (a day of the game): the days up to today + `locked` are kept as they are (a
 * missing one = the puzzle the game computed for it, dailyPuzzles, written down now), the days after them up to today + `horizon`
 * are planned again (planDay). `plan` = the plan so far (`{ details, days }`, empty at first), `prepared` = the answers of
 * prepareGame (what the game computed so far), `places` = every place worth guessing (prepareGame with `places`; the answers
 * without it). The same input gives the same plan (a run without changes changes nothing).
 */
export function extendPlan({ plan = {}, prepared, places = prepared, levels, today, epoch, horizon = PLAN_HORIZON, locked = PLAN_LOCKED, seed = 'detail-dne' }) {
  const details = planDetails(planDetails(plan.details, prepared, levels), places, levels);
  const days = {};
  const lockedUntil = today + locked;
  for (let day = 0; day <= lockedUntil; day++) {
    const kept = plan.days?.[day];
    if (kept) { days[day] = kept; continue; }
    const puzzles = dailyPuzzles({ day, levels, prepared });
    const entry = { date: gameDate(day, epoch) };
    for (const level of levels) if (puzzles[level.id]) entry[level.id] = planEntry(puzzles[level.id], details);
    days[day] = entry;
  }
  for (let day = lockedUntil + 1; day <= today + horizon; day++) {
    days[day] = { date: gameDate(day, epoch), ...planDay({ day, days, details, prepared: places, levels, seed }) };
  }

  return { version: 1, details, days };
}

/** When each work and each of its details was last in the game before `day` (`{ works: id → day, details: 'id#n' → day }`). */
export function planUsage(days, before) {
  const works = {};
  const details = {};
  for (const [key, entry] of Object.entries(days)) {
    const day = Number(key);
    if (day >= before) continue;
    for (const puzzle of Object.values(entry)) {
      if (!puzzle?.targetId) continue;
      works[puzzle.targetId] = Math.max(works[puzzle.targetId] ?? -Infinity, day);
      if (puzzle.detail) details[`${puzzle.targetId}#${puzzle.detail}`] = Math.max(details[`${puzzle.targetId}#${puzzle.detail}`] ?? -Infinity, day);
    }
  }

  return { works, details };
}

/**
 * The puzzles of one planned day, level by level (each a different work). While works new to the game wait (never in the
 * plan, with an answer in some level), one level drawn by chance gets one of them: a new work comes the first planned day,
 * several new ones one a day, so the week stays a mix. The other levels draw from the works not in the game for PLAN_WORK_GAP
 * days (then 14; then rather more new works; then shorter waits, never an empty level), by chance weighted by how long a work
 * has waited and by how many details it has (more places = more often), much smaller when its details of the level were all in
 * the game within PLAN_DETAIL_GAP (it rather comes in another level). Then its detail of the level not used for the longest
 * time (the year of PLAN_DETAIL_GAP is kept while the work has another one), the thumbnails and the look.
 */
export function planDay({ day, days, details, prepared, levels, seed = 'detail-dne' }) {
  const usage = planUsage(days, day);
  const isNew = (id) => usage.works[id] === undefined;
  const dayRandom = gameRandom(gameHash(`${seed}:plan:${day}`));
  // the level for a new work: one where some new work is an answer, drawn by chance
  const newLevels = levels.filter((level) => Object.keys(prepared[level.id] ?? {}).some(isNew));
  const newLevel = newLevels.length ? newLevels[Math.floor(dayRandom() * newLevels.length)].id : null;
  const out = {};
  const taken = [];
  for (const level of levels) {
    const answers = prepared[level.id] ?? {};
    const random = gameRandom(gameHash(`${seed}:plan:${level.id}:${day}`));
    const all = Object.keys(answers).sort().filter((id) => !taken.includes(id));
    // where to draw from, the first non-empty: the new works (the level for them), works that waited PLAN_WORK_GAP days, 14
    // days, then rather more new works than a repeat that soon, then shorter waits; never an empty level
    const waited = (gap) => all.filter((id) => !isNew(id) && day - usage.works[id] >= gap);
    const tiers = [
      () => (level.id === newLevel ? all.filter(isNew) : []),
      () => waited(PLAN_WORK_GAP), () => waited(14), () => all.filter(isNew), () => waited(7), () => waited(3), () => all,
    ];
    let pool = [];
    for (const tier of tiers) {
      pool = tier();
      if (pool.length) break;
    }
    if (!pool.length) continue;
    // a work whose every detail of this level was in the game within PLAN_DETAIL_GAP rather waits for another level
    const hasFresh = (id) => answers[id].some((c) => {
      const used = usage.details[`${id}#${planDetailOf(details[id], level.id, c.crop)?.n}`];
      return used === undefined || day - used >= PLAN_DETAIL_GAP;
    });
    const weights = pool.map((id) => (isNew(id) ? 1 : Math.min(180, day - usage.works[id])) * Math.sqrt((details[id] ?? []).length || 1) * (hasFresh(id) ? 1 : 0.15) * (0.5 + random()));
    let pick = random() * weights.reduce((a, b) => a + b, 0);
    const targetId = pool.find((_, i) => (pick -= weights[i]) < 0) ?? pool[pool.length - 1];
    taken.push(targetId);
    // the detail: never used first, then the one used longest ago (a tie by chance)
    const crops = answers[targetId].map((c) => ({ ...c, detail: planDetailOf(details[targetId], level.id, c.crop), tie: random() }));
    const lastUse = (c) => usage.details[`${targetId}#${c.detail?.n}`] ?? -Infinity;
    const choice = [...crops].sort((a, b) => lastUse(a) - lastUse(b) || a.tie - b.tie)[0];
    const decoys = chooseDecoys({ ranked: choice.ranked, count: level.options - 1, reach: level.reach, random });
    out[level.id] = {
      targetId,
      detail: choice.detail?.n ?? null,
      crop: choice.crop,
      optionIds: gameShuffle([targetId, ...decoys], random),
      look: lookForDay({ level, day, seed }),
    };
  }

  return out;
}

/**
 * The puzzles of `day` as the game plays them: each level from the plan (`plan.days[day]`) while all its works are still in the game
 * (`hasWork`), otherwise the computed one (`computed`, dailyPuzzles; null without one). Each with `planned` (true = from the plan).
 */
export function plannedPuzzles({ plan, day, levels, hasWork, computed }) {
  const entry = plan?.days?.[day];
  return Object.fromEntries(levels.map((level) => {
    const kept = entry?.[level.id];
    if (!kept?.targetId || ![kept.targetId, ...kept.optionIds].every(hasWork)) {
      return [level.id, computed[level.id] ? { ...computed[level.id], planned: false } : null];
    }
    const look = gameLooks().find((l) => l.id === kept.look) ?? gameLooks().find((l) => l.id === lookForDay({ level, day })) ?? gameLooks()[0];
    return [level.id, { day, level: level.id, targetId: kept.targetId, detail: kept.detail, crop: kept.crop, optionIds: kept.optionIds, look: look.id, effect: look.effect, colour: look.colour, ...(kept.view ? { view: kept.view } : {}), planned: true }];
  }));
}

/** The date (YYYY-MM-DD) in Prague at `date`: the day of the game the players in the Czech Republic see (GitHub runs in UTC). */
export function pragueDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** The year (a number) of the day `day` of the game. */
export function planYearOf(day, epoch) {
  return Number(gameDate(day, epoch).slice(0, 4));
}

/** The days of a plan by the year of their date: `{ <year>: { <day>: entry } }`. */
export function planDaysByYear(days, epoch) {
  const years = {};
  for (const [key, entry] of Object.entries(days ?? {})) (years[planYearOf(Number(key), epoch)] ??= {})[key] = entry;
  return years;
}

/** The years whose days go into the data of the page: this year and the one before; older ones are archive files. */
export function planYearsShown(thisYear) {
  return [thisYear - 1, thisYear];
}

/** One line per key of `object`, keys sorted by `order`, as the plan files write them (git shows a change line by line). */
function planLines(object, order) {
  return Object.entries(object).sort(([a], [b]) => order(a, b)).map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');
}

/** The version of the plan file of a year: 2 = its days by their key (dayId, "2026-320"); another version is not read. */
export const PLAN_FILE_VERSION = 2;

/**
 * The text of the plan file of a year: `{ version, year, days }`, one line per day, the days in order, each by its key (dayId,
 * "2026-320"; `days` = the days of the game of that year, each with its `date`).
 */
export function planYearText(year, days) {
  const keyed = Object.fromEntries(Object.values(days).map((entry) => [dayId(entry.date), entry]));
  return `{\n  "version": ${PLAN_FILE_VERSION},\n  "year": ${year},\n  "days": {\n${planLines(keyed, (a, b) => Number(a.slice(5)) - Number(b.slice(5)))}\n  }\n}\n`;
}

/** The days of the game of a plan file (its `days` by dayId, planYearText); a key that is none is left out. */
export function planYearDays(days, epoch) {
  return Object.fromEntries(Object.entries(days ?? {}).map(([id, entry]) => [dayOfId(id, epoch), entry]).filter(([day]) => day !== null).map(([day, entry]) => [String(day), entry]));
}

/** The text of the file of the details of the works: `{ version, details }`, one line per work, by id. */
export function planDetailsText(details) {
  return `{\n  "version": 1,\n  "details": {\n${planLines(details, (a, b) => a.localeCompare(b))}\n  }\n}\n`;
}

/** The plan with the days of an archive file (`part.days`, the archive of a year) added; the days already there stay. */
export function mergePlanDays(plan, part) {
  return { ...plan, days: { ...(part?.days ?? {}), ...(plan?.days ?? {}) } };
}
