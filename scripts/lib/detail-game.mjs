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
export function gameLevels() {
  return [
    { id: 'lehka', label: 'Lehká', size: 0.24, zone: 'center', pick: 'clear', options: 9, reach: 0.4, lastView: 0.85, guesses: 4, hints: true, drops: 1, looks: ['clear', 'black-white', 'old-photo', 'morning-mist', 'mosaic'] },
    { id: 'stredni', label: 'Střední', size: 0.16, zone: 'any', pick: 'confusing', maxConfusion: 14, options: 9, reach: 0.9, lastView: 0.5, guesses: 4, hints: false, drops: 2, looks: ['curtain', 'water', 'magic-colours', 'dusk', 'puddle'] },
    { id: 'tezka', label: 'Těžká', size: 0.11, zone: 'edge', pick: 'confusing', maxConfusion: 16, options: 9, reach: 1, lastView: 0.35, guesses: 3, hints: false, drops: 3, looks: ['dream', 'colour-blocks', 'mirage', 'flooded-postcard', 'embroidery'] },
  ];
}

/**
 * The looks of a close-up: a named pair of an effect (mist, raster, pixel, wave) and colours (gray, sepia, hue), null = untouched.
 * Each level draws from its own five (`level`), so no look is in two levels; a quiz of a visitor offers the same ones.
 */
export function gameLooks() {
  return [
    { id: 'clear', label: 'Čistý pohled', level: 'lehka', effect: null, colour: null },
    { id: 'black-white', label: 'Černobílá fotka', level: 'lehka', effect: null, colour: 'gray' },
    { id: 'old-photo', label: 'Stará fotka', level: 'lehka', effect: null, colour: 'sepia' },
    { id: 'morning-mist', label: 'Ranní mlha', level: 'lehka', effect: 'mist', colour: null },
    { id: 'mosaic', label: 'Mozaika', level: 'lehka', effect: 'pixel', colour: null },
    { id: 'curtain', label: 'Za záclonou', level: 'stredni', effect: 'raster', colour: null },
    { id: 'water', label: 'Na hladině', level: 'stredni', effect: 'wave', colour: null },
    { id: 'magic-colours', label: 'Kouzelné barvy', level: 'stredni', effect: null, colour: 'hue' },
    { id: 'dusk', label: 'Za šera', level: 'stredni', effect: 'mist', colour: 'gray' },
    { id: 'puddle', label: 'Odraz v kaluži', level: 'stredni', effect: 'wave', colour: 'gray' },
    { id: 'dream', label: 'Sen', level: 'tezka', effect: 'mist', colour: 'hue' },
    { id: 'colour-blocks', label: 'Barevné kostky', level: 'tezka', effect: 'pixel', colour: 'hue' },
    { id: 'mirage', label: 'Fata morgána', level: 'tezka', effect: 'wave', colour: 'hue' },
    { id: 'flooded-postcard', label: 'Zatopená pohlednice', level: 'tezka', effect: 'wave', colour: 'sepia' },
    { id: 'embroidery', label: 'Výšivka', level: 'tezka', effect: 'pixel', colour: 'sepia' },
  ];
}

/** The first day of the game (day 0, shown as #1). */
export const GAME_EPOCH = '2026-11-01';
/** The longer side of the small picture the analysis reads. */
export const ANALYSIS_SIZE = 240;

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
 * - `crops`: up to `count` close-ups that do not overlap, the most detailed first, each `{ x, y, size, detail, palette }` (x, y =
 *   centre as a share of width and height, size = a share of the shorter side). Places under `minDetail` (blank paper) or under
 *   `minEdges` (a smooth wash) are no close-ups, so a work without any cannot be a puzzle.
 * - `places`: the whole picture in a grid of windows of the same size, each `{ detail, palette }`: what a close-up of another
 *   work is compared with, because a work may look like a close-up in one place only.
 */
export function analyzePixels(pixels, { size = 0.14, margin = 0.08, bottom = 0.18, count = 8, minDetail = 8, minEdges = 3 } = {}) {
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

/**
 * What a technique looks like to a player: `colour` = a painting (watercolour, oil, acrylic, gouache, pastel, also with lines in it),
 * `drawing` = lines in black or one colour (ink, brush pen, marker, pencil, a print). A player tells the two apart at a glance, the
 * techniques of one family hardly.
 */
export function techniqueFamily(technique) {
  return /akvarel|olej|akryl|kvaš|pastel|tempera/i.test(String(technique ?? '')) ? 'colour' : 'drawing';
}

/**
 * The other works by how much they look like a close-up, the closest first. Another technique of the same family (techniqueFamily)
 * counts as `familyGap` farther, one of the other family as `techniqueGap`, a work without a common tag as `tagGap` farther: a player
 * rules out a drawing among paintings or another subject at a glance, whatever its colours.
 */
export function rankLookalikes({ target, crop, pool, analyses, techniqueGap = 25, familyGap = 6, tagGap = 8 }) {
  const tags = target.tags ?? [];
  const sameSubject = (work) => !tags.length || (work.tags ?? []).some((tag) => tags.includes(tag));
  const family = techniqueFamily(target.technique);
  const techniqueDistance = (work) => (work.technique === target.technique ? 0 : techniqueFamily(work.technique) === family ? familyGap : techniqueGap);
  return pool
    .map((work) => ({
      id: work.id,
      distance: lookalikeDistance(crop, analyses[work.id]) + techniqueDistance(work) + (sameSubject(work) ? 0 : tagGap),
    }))
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

/** Whether a close-up comes from a part of the picture: center (around the middle), edge (away from it), any. */
export function inZone(crop, zone) {
  const away = Math.max(Math.abs(crop.x - 0.5), Math.abs(crop.y - 0.5));
  return zone === 'center' ? away < 0.22 : zone === 'edge' ? away > 0.28 : true;
}

/**
 * The close-ups of a work, the most confusing first, each `{ crop, ranked, confusion }`: `confusion` = the average distance of the
 * `count` closest lookalikes (small = many other works could be the answer).
 */
export function confusingCrops({ target, pool, analyses, count }) {
  return analyses[target.id].crops
    .map((crop) => {
      const ranked = rankLookalikes({ target, crop, pool, analyses });
      const closest = ranked.slice(0, count);
      return { crop, ranked, confusion: closest.reduce((sum, r) => sum + r.distance, 0) / Math.max(1, closest.length) };
    })
    .sort((a, b) => a.confusion - b.confusion || b.crop.detail - a.crop.detail);
}

/**
 * What a level can ask (Node, before the page): work id → up to `keep` close-ups `{ crop, ranked }` (crop without the numbers of
 * its colours, ranked = ids of the closest `nearest` other works). A work without a close-up for the level is no answer there,
 * but can be a false thumbnail; so the page needs no pictures analysed and picks a puzzle at once.
 */
export function prepareLevel({ level, works, analyses, keep = 3, nearest = 30 }) {
  const usable = works.filter((w) => analyses[w.id]?.places?.length);
  const answers = {};
  for (const target of usable) {
    const crops = (analyses[target.id].crops ?? []).filter((crop) => inZone(crop, level.zone));
    if (!crops.length) continue;
    const pool = usable.filter((w) => w.id !== target.id);
    const single = { ...analyses, [target.id]: { ...analyses[target.id], crops } };
    const count = level.options - 1;
    if (pool.length < count) continue;
    const found = level.pick === 'clear'
      ? [...crops].sort((a, b) => b.detail - a.detail).map((crop) => ({ crop, ranked: rankLookalikes({ target, crop, pool, analyses }) }))
      : confusingCrops({ target, pool, analyses: single, count }).filter((c) => c.confusion <= level.maxConfusion);
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
 * How strong each effect is at full strength. mist = blur in px; rasterStep = the distance of the dots as a share of the window (%);
 * rasterDot = their radius as a share of half of it (%: 100 = dots touch, 141 = nothing left between them); pixelStep = a block of the
 * mosaic as a share of the window (%); wave = the ripple in px; hue = the shift of colours in degrees.
 */
export function effectSettings() {
  return { mist: 7, rasterStep: 9, rasterDot: 100, pixelStep: 3, wave: 20, hue: 150 };
}

/**
 * The look of a close-up at `strength`: `filter` and `mask` for CSS, `wave` = the scale of the SVG filter #game-wave, `pixels` = blocks of
 * the mosaic across the window (0 = no mosaic, drawPixels). mist = out of focus, raster = seen through dots (they grow until nothing is left
 * between them), pixel = a mosaic (its blocks get finer), wave = rippling; gray, sepia, hue = other colours.
 */
export function effectStyle(effect, colour, strength, settings = effectSettings()) {
  const filters = [];
  let mask = '';
  let wave = 0;
  let pixels = 0;
  if (strength > 0) {
    if (colour === 'gray') filters.push(`grayscale(${strength})`);
    if (colour === 'sepia') filters.push(`sepia(${strength})`);
    if (colour === 'hue') filters.push(`hue-rotate(${Math.round(settings.hue * strength)}deg)`);
    if (effect === 'mist' && settings.mist) filters.push(`blur(${Math.round(settings.mist * strength * 10) / 10}px)`);
    wave = effect === 'wave' ? Math.round(settings.wave * strength) : 0;
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
  return { targetId: puzzle.targetId, crop: puzzle.crop, optionIds: puzzle.optionIds, look: puzzle.look };
}

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

/**
 * The day of the address `?den=<number>` (the number of the day as the page shows it, #1 = day 0): today without it, or when it is
 * not a played day yet (the future, before the first day, not a number).
 */
export function dayFromParam(value, today) {
  if (value === null || value === undefined || !/^\d+$/.test(String(value))) return today;
  const day = Number(value) - 1;
  return day >= 0 && day <= today ? day : today;
}

/** The days of the archive, the newest first: every day before `today`, back to the first day. */
export function archiveDays(today) {
  return Array.from({ length: Math.max(0, today) }, (_, i) => today - 1 - i);
}

/** How a player did in each level on `day` (`played` of the progress): 'solved', 'lost' or null (not played). */
export function dayMarks(played, day, levels) {
  return levels.map((level) => {
    const result = played[`${day}:${level.id}`];
    return result ? (result.solved ? 'solved' : 'lost') : null;
  });
}

/** The newest day of the archive before `before` with a level the player has not played, or null when all are done. */
export function unplayedDay({ played, levels, before }) {
  for (let day = before - 1; day >= 0; day--) {
    if (dayMarks(played, day, levels).includes(null)) return day;
  }
  return null;
}

/** The state of a puzzle before the first guess. */
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

/** The rank for the drops collected and how many drops the next one needs (`next` null at the top). */
export function gameRank(drops) {
  const ranks = [[0, 'Vylitý kelímek'], [20, 'Mokrý štětec'], [60, 'Kapka na papíře'], [130, 'Plenérista'], [250, 'Mistr akvarelu']];
  const index = ranks.reduce((found, [from], i) => (drops >= from ? i : found), 0);
  return { title: ranks[index][1], next: ranks[index + 1]?.[0] ?? null, nextTitle: ranks[index + 1]?.[1] ?? null };
}

/** What a player collected, before the first game. */
export function newProgress() {
  return { drops: 0, streak: 0, best: 0, lastDay: null, played: {}, collected: [], pigments: [] };
}

/**
 * The progress after finishing the puzzle of a `level` on `day`: `{ progress, gained, rankUp }`. Each puzzle counts once. A series
 * is days played in a row (more games on one day count once, a lost game keeps it, a day left out starts a new one); the days of the
 * archive leave it alone. A solved puzzle gives drops, the work into the collection and the colours of the close-up as pigments.
 */
export function finishRound(progress, { day, today, level, multiplier = 1, solved, misses, workId, pigments = [] }) {
  const key = `${day}:${level}`;
  if (progress.played[key]) return { progress, gained: 0, rankUp: false };
  const archive = day !== today;
  const streak = archive || progress.lastDay === today ? progress.streak : progress.lastDay === today - 1 ? progress.streak + 1 : 1;
  const gained = solved ? dropsFor(misses, streak, archive, multiplier) : 0;
  const drops = progress.drops + gained;
  return {
    gained,
    rankUp: gameRank(drops).title !== gameRank(progress.drops).title,
    progress: {
      drops,
      streak,
      best: Math.max(progress.best, streak),
      lastDay: archive ? progress.lastDay : today,
      played: { ...progress.played, [key]: { solved, misses, drops: gained } },
      collected: solved && !progress.collected.includes(workId) ? [...progress.collected, workId] : progress.collected,
      pigments: solved ? [...new Set([...progress.pigments, ...pigments])] : progress.pigments,
    },
  };
}

/** The text to share, without giving the work away: the level and one mark for each guess. */
export function gameShareText({ day, level, misses, solved, url }) {
  const marks = '🟨'.repeat(misses) + (solved ? '🟩' : '');
  return `Detail dne #${day + 1} · ${level} ${marks}\nPoznáš obraz podle detailu?\n${url}`;
}
