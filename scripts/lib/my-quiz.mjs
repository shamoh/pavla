// "Můj Detail dne": a quiz anyone makes of one work (the button on the page of a work → the editor /detail-dne/muj-kviz/)
// and sends to others as an address (/detail-dne/muj/?obraz=…): one round of the game, one level, no drops. The site keeps
// nothing, so the address holds the whole quiz: the work, the level, the centre of the close-up, the distortion and the
// eight other works offered (drawn once by the editor, so the quiz stays the same however the site grows).
import { chooseDecoys, gameFrame, gameHash, gameLevels, gameLooks, gameRandom, gameShuffle } from './detail-game.mjs';
import { levelFromParam, levelParam } from './detail-teaser.mjs';
import { cropRect, touches } from './game-exclusions.mjs';
import { workDistance } from './affinity.mjs';
import { storageKey } from './storage-prefix.mjs';

/** The pages: the editor of a work and the player (the address of a quiz; without it the page tells how to make one). */
export const QUIZ_EDITOR_PATH = '/detail-dne/muj-kviz/';
export const QUIZ_PATH = '/detail-dne/muj/';
/** The parameters of the address of a quiz, in this order. */
export const QUIZ_PARAMS = ['obraz', 'uroven', 'x', 'y', 'zkresleni', 'nabidka'];
/** The other works offered with the right one (the game offers nine). */
export const QUIZ_DECOYS = 8;
/** The most alike works kept for each work in the data of the quiz, to draw the offer from. */
export const QUIZ_SIMILAR = 24;
/** sessionStorage: the quiz opened (its address is cleaned right away) and its round, so a reload plays on. */
export const QUIZ_STORE = storageKey('myQuiz');

/** No view of a hand-picked close-up keeps away from the edges and the signature (the author chose the place herself). */
export const QUIZ_SAFE = { margin: 0, bottom: 0 };

/** A share of the picture as the address writes it: a percent with one decimal ("42.5"). */
const percent = (share) => String(Math.round(share * 1000) / 10);

/**
 * The parameters of the address of `quiz` ({ workId, level (id), x, y (centre, shares), look (id), offer (the eight other
 * ids) }), in QUIZ_PARAMS order.
 */
export function quizToParams({ workId, level, x, y, look, offer }) {
  const params = new URLSearchParams();
  params.set('obraz', workId);
  params.set('uroven', levelParam(gameLevels().find((l) => l.id === level) ?? gameLevels()[0]));
  params.set('x', percent(x));
  params.set('y', percent(y));
  params.set('zkresleni', look);
  params.set('nabidka', offer.join(','));
  return params;
}

/** The whole address of a quiz on the site `siteUrl` (no trailing slash): the pages pass the origin they run on, so a local quiz stays local. */
/**
 * What the page of a quiz plays when it opens. An address of a quiz (`own` = the params of the page has `obraz`) is always a
 * new round of it, even the same quiz played to the end before (the visitor opened the link again to play again); without one
 * (a reload of the cleaned address) the quiz and the round `kept` for the tab go on; else nothing. `round` null = a new one.
 */
export function quizOnOpen(own, kept) {
  if (own.has('obraz')) return { params: own.toString(), round: null, fresh: true };
  if (kept?.params) return { params: kept.params, round: kept.round ?? null, fresh: false };
  return { params: '', round: null, fresh: false };
}

/** The window of the editor showing the quiz as the player sees it (its data-window); never the id of a look. */
export const QUIZ_PREVIEW = 'preview';

/**
 * The windows the editor paints, each with its look: a window per look of `level` (data-window = the id of the look) and the preview
 * with the chosen `look`. Every look comes from the catalog, so a window is never painted with a look that does not exist.
 */
export function quizWindows({ level, look, looks = gameLooks() }) {
  const own = looks.filter((l) => l.level === level);
  const chosen = own.find((l) => l.id === look) ?? own[0];
  return [...own.map((l) => ({ window: l.id, look: l })), ...(chosen ? [{ window: QUIZ_PREVIEW, look: chosen }] : [])];
}

export const quizUrl = (siteUrl, quiz) => `${siteUrl}${QUIZ_PATH}?${quizToParams(quiz).toString()}`;

/**
 * The quiz of an address (URLSearchParams) for the works the site has (`works`: id → work): the puzzle as the game plays it
 * ({ workId, level (the level object), crop { x, y, size }, look (the look object), optionIds (the nine shuffled, the same for
 * everybody: by the address), offer }) or null when something is missing, unknown or out of the game (`excluded`: id → false).
 */
export function quizFromParams(params, works, excluded = {}) {
  const workId = params.get('obraz');
  const level = levelFromParam(params.get('uroven'));
  const x = Number(params.get('x')) / 100;
  const y = Number(params.get('y')) / 100;
  const look = gameLooks().find((l) => l.id === params.get('zkresleni') && l.level === level?.id);
  const offer = String(params.get('nabidka') ?? '').split(',').filter(Boolean);
  const known = (id) => works.has(id) && excluded[id] !== false;
  if (!known(workId) || !level || !look || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  if (offer.length !== QUIZ_DECOYS || new Set(offer).size !== QUIZ_DECOYS || offer.includes(workId) || !offer.every(known)) return null;
  const crop = { x, y, size: level.size };
  const optionIds = gameShuffle([workId, ...offer], gameRandom(gameHash(quizToParams({ workId, level: level.id, x, y, look: look.id, offer }).toString())));
  return { workId, level, crop, look, optionIds, offer };
}

/**
 * Where the close-up of a work of height / width `ratio` lies when the author taps at `[x, y]` (shares of the picture): the
 * square of the level around it, kept whole inside the picture (gameFrame without the safe margins).
 */
export function quizCrop([x, y], level, ratio) {
  const frame = gameFrame({ x, y, size: level.size }, 0, Math.max(1, level.guesses - 1), ratio, level.size, QUIZ_SAFE);
  return { x: frame.x, y: frame.y, size: level.size };
}

/** Whether a close-up (or a view) of a work touches one of its places kept out of the game (areas in shares). */
export const cropExcluded = (crop, ratio, areas = []) => areas.some((a) => touches(cropRect(crop, ratio), a));

/**
 * How far the quiz zooms out at its last try: the level's own, or less so that no view touches the places kept out (as
 * puzzleView, but with the views of a hand-picked close-up, QUIZ_SAFE). Never below the close-up.
 */
export function quizView({ crop, ratio, level, areas = [] }) {
  const clear = (last) => Array.from({ length: level.guesses }, (_, m) => gameFrame(crop, m, level.guesses - 1, ratio, last, QUIZ_SAFE))
    .every((frame) => !cropExcluded(frame, ratio, areas));
  if (!areas.length || clear(level.lastView)) return level.lastView;
  for (let i = 1; i <= 60; i++) {
    const last = level.lastView - ((level.lastView - crop.size) * i) / 60;
    if (clear(last)) return last;
  }
  return crop.size;
}

/**
 * For every work the others most like it, closest first (workDistance: colours, mood, technique, tags), at most `keep`, without
 * the works out of the game (`excluded`: id → false): what the offer of a quiz is drawn from.
 */
export function quizSimilar(works, excluded = {}, keep = QUIZ_SIMILAR) {
  const ins = works.filter((w) => excluded[w.id] !== false);
  return Object.fromEntries(ins.map((w) => [w.id, ins
    .filter((o) => o.id !== w.id)
    .map((o) => ({ id: o.id, d: workDistance(w, o) }))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    .slice(0, keep)
    .map((o) => o.id)]));
}

/** The eight other works of a quiz of `workId` in `level` (chooseDecoys: easy ones farther, hard ones the closest), by `seed`. */
export function quizOffer({ workId, level, similar, seed }) {
  return chooseDecoys({ ranked: similar[workId] ?? [], count: QUIZ_DECOYS, reach: level.reach, random: gameRandom(gameHash(`${workId}:${level.id}:${seed}`)) });
}

/** The parameters of the events of a quiz (game_start, game_end, share with source quiz). */
export function quizEventParams(quiz, end = null) {
  const params = { source: 'quiz', level: quiz.level.id, look: quiz.look.id, work_id: quiz.workId };
  return end ? { ...params, solved: end.solved ? 'yes' : 'no', misses: end.misses } : params;
}

/** The text sent with the address of a quiz (the editor's share, the player's copy): the level and whose work it is. */
export function quizShareText({ level, author }) {
  return `Můj Detail dne (${level.label}): poznáš, ze kterého obrazu je tenhle výřez?${author ? ` Obrazy: ${author}` : ''}`;
}
