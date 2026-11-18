// What the author keeps out of the game Detail dne (in the description of a work, content repository only):
//   meta_game: false                            the work is never in the game: no puzzle and no thumbnail of the offer (nudes)
//   meta_game_skip:                             places of the picture no close-up may touch (the ring binding of a sketchbook,
//     - [left, top, width, height]              tape, a clip), each a rectangle in the pixels of the master photo, as meta_corners
// The pipeline turns the rectangles into shares of the web picture (the game's coordinates: the photo may be trimmed by its
// corners, `offset`), leaves the excluded works and places out of the plan of the days (excludePrepared) and lets a puzzle of a
// work with excluded places zoom out only as far as no view of it touches them (puzzleView, `view` of the planned puzzle).
import { gameFrame } from './detail-game.mjs';

/** `false` = the work is out of the game (its options true / false are checked by the schema, optionProblems). */
export const GAME_KEY = 'meta_game';
/** The places of a work no close-up may touch. */
export const SKIP_KEY = 'meta_game_skip';

/** Problems of a `meta_game_skip` value for a master photo of `width` × `height` px (Czech, `<where>: …`, code spatne-vynechane-misto). */
export function exclusionProblems(value, width, height, where) {
  if (value === undefined || value === null) return [];
  const p = (msg) => [`${where}: ${SKIP_KEY} ${msg} [spatne-vynechane-misto]`];
  if (!Array.isArray(value) || !value.length) return p('musí být seznam míst, každé na řádku jako - [zleva, shora, šířka, výška] v pixelech fotky (bez míst atribut zakomentuj)');
  for (const [i, area] of value.entries()) {
    const which = value.length > 1 ? `místo ${i + 1} ` : '';
    if (!Array.isArray(area) || area.length !== 4 || !area.every((n) => Number.isInteger(n))) {
      return p(`${which}musí být [zleva, shora, šířka, výška] v celých pixelech fotky, např. [1840, 0, 260, 3000]`);
    }
    const [left, top, w, h] = area;
    if (left < 0 || top < 0 || w <= 0 || h <= 0) return p(`${which}musí mít kladnou šířku a výšku a nezáporné zleva a shora`);
    if (width && height && (left + w > width || top + h > height)) {
      return p(`${which}sahá mimo fotku (${left + w} × ${top + h} px, fotka má ${width} × ${height})`);
    }
  }
  return [];
}

/**
 * Rectangles of the photo (px, [left, top, width, height]) as shares of the web picture, which is the part of the photo from
 * `offset` of `width` × `height` px ({ x0, y0, x1, y1 } from 0 to 1, clipped; a rectangle wholly outside it is left out).
 */
export function areasInImage(areas, { offset = { left: 0, top: 0 }, width, height }) {
  return areas.map(([left, top, w, h]) => ({
    x0: Math.max(0, (left - offset.left) / width),
    y0: Math.max(0, (top - offset.top) / height),
    x1: Math.min(1, (left + w - offset.left) / width),
    y1: Math.min(1, (top + h - offset.top) / height),
  })).filter((a) => a.x1 > a.x0 && a.y1 > a.y0);
}

/** The square a close-up or a view shows ({ x, y, size }: centre in shares, size a share of the shorter side) in shares of the picture. */
export function cropRect({ x, y, size }, ratio) {
  const w = size * Math.min(1, ratio);
  const h = size * Math.min(1, 1 / ratio);
  return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}

/** Whether two rectangles of shares overlap (touching edges do not). */
export const touches = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * The answers of every level (prepareGame: level id → work id → crops) without what the author keeps out: `exclusions` = work id →
 * false (the work is out: no answers, and it is taken from every list of lookalikes, so it is never offered either) or
 * `{ areas, ratio }` (shares of the web picture, its height / width: crops touching an area are out, a work left with none too).
 */
export function excludePrepared(prepared, exclusions = {}) {
  const out = (id) => exclusions[id] === false;
  return Object.fromEntries(Object.entries(prepared ?? {}).map(([level, answers]) => [level, Object.fromEntries(Object.entries(answers)
    .filter(([id]) => !out(id))
    .map(([id, crops]) => {
      const areas = exclusions[id]?.areas ?? [];
      const kept = crops
        .filter((c) => !areas.some((a) => touches(cropRect(c.crop, exclusions[id].ratio), a)))
        .map((c) => (c.ranked ? { ...c, ranked: c.ranked.filter((r) => !out(r)) } : c));
      return [id, kept];
    })
    .filter(([, crops]) => crops.length))]));
}

/**
 * How far the puzzle of `crop` of a work (height / width `ratio`) in `level` may zoom out: the largest last view (share of the
 * shorter side, at most level.lastView) whose every view on the way (gameFrame) stays off the `areas`; null when the level's own
 * is fine (no areas or none touched). Never below the close-up itself.
 */
export function puzzleView({ crop, ratio, level, areas = [] }) {
  if (!areas.length) return null;
  const clear = (last) => Array.from({ length: level.guesses }, (_, m) => gameFrame(crop, m, level.guesses - 1, ratio, last))
    .every((frame) => !areas.some((a) => touches(cropRect(frame, ratio), a)));
  if (clear(level.lastView)) return null;
  const steps = 60;
  for (let i = 1; i <= steps; i++) {
    const last = level.lastView - ((level.lastView - crop.size) * i) / steps;
    if (clear(last)) return Math.round(last * 1000) / 1000;
  }
  return crop.size;
}

/**
 * The exclusions of the works of the content (`works` from prepareContent: `{ id, data, masterPath }`; meta_game false wins over
 * meta_game_skip) for the plan, as
 * excludePrepared and puzzleView take them: work id → false or `{ areas, ratio }`. `picture(work)` resolves where the web
 * picture lies in the photo (`{ offset, width, height }`, the photo trimmed by its corners as the web images are).
 */
export async function contentExclusions(works, picture) {
  const out = {};
  for (const w of works) {
    const value = w.data?.[SKIP_KEY];
    if (w.data?.[GAME_KEY] === false) out[w.data.id] = false;
    else if (Array.isArray(value) && value.length && w.masterPath && w.data.id) {
      const image = await picture(w);
      out[w.data.id] = { areas: areasInImage(value, image), ratio: image.height / image.width };
    }
  }
  return out;
}

/**
 * The planned days from day `from` on (the days the pipeline plans again; the earlier ones stay as they are) with the `view` of
 * each puzzle whose work has excluded places (puzzleView); a puzzle that needs none has none. `days` = day → { date, <level>: puzzle }.
 */
export function planViews(days, { exclusions = {}, levels, from }) {
  return Object.fromEntries(Object.entries(days).map(([key, entry]) => {
    if (Number(key) < from) return [key, entry];
    const out = { ...entry };
    for (const level of levels) {
      const puzzle = entry[level.id];
      if (!puzzle?.targetId) continue;
      const { view: _old, ...rest } = puzzle;
      const ex = exclusions[puzzle.targetId];
      const view = ex ? puzzleView({ crop: puzzle.crop, ratio: ex.ratio, level, areas: ex.areas }) : null;
      out[level.id] = view ? { ...rest, view } : rest;
    }
    return [key, out];
  }));
}
