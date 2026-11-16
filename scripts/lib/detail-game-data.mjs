// The data of the game "Detail dne" (scripts/lib/detail-game.mjs), prepared in Node from the pictures of the site: for the page
// /detail-dne/ (src/pages/detail-dne/data.json.ts) and for the prototypes (scripts/lib/prototypes.mjs). The browser gets
// it ready and only plays.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ANALYSIS_SIZE, ANSWER_CROPS, GAME_EPOCH, PLACE_OVERLAP, PLAN_PLACES_PER_LEVEL, analyzePixels, gameHash, gameLevels, prepareLevel, representativeSample } from './detail-game.mjs';

/** How many works the sample of the game "Detail dne" has (detail-vzorek.html). */
export const SAMPLE_SIZE = 12;

/** Works of the sample picked by hand (ids, the line „Vzorek“ of detail-vzorek.html); the rest is picked automatically. */
export const SAMPLE_PICKS = [];

/** Where the analysis of each picture is kept (relative to the site data, a file a work: <id>.json), next to the plan of the days. */
export const ANALYSIS_DIR = path.join('game', 'detail-dne', 'analysis');
/** The version of the analysis of a picture: a new way to analyse (analyzePixels, regionPalette…) = a higher one, all analysed again. */
export const ANALYSIS_VERSION = 1;

/**
 * What the kept analysis of a picture was made with: the version, the size of the picture analysed, the places per level, their
 * overlap and the levels with their close-up size. Another setting = the picture is analysed again.
 */
export function analysisSettings(levels) {
  const settings = { version: ANALYSIS_VERSION, size: ANALYSIS_SIZE, count: PLAN_PLACES_PER_LEVEL, overlap: PLACE_OVERLAP, levels: levels.map((l) => [l.id, l.size]) };
  return gameHash(JSON.stringify(settings)).toString(16).padStart(8, '0');
}

/** The fingerprint of a picture: of its bytes, so the same picture is never analysed twice. */
export const imageFingerprint = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16);

const readJson = async (file) => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * The analysis of the picture of `work` (analyzePixels of every level, all places worth guessing, those that overlap marked): the
 * kept one (ANALYSIS_DIR of `dataRoot`) while the picture and the settings are the same, otherwise made now.
 * `{ levels (level id → analysis), file (the kept file), record (what to keep), fresh }`.
 */
async function pictureAnalysis(work, dataRoot, levels, settings, sharp) {
  const bytes = await fs.readFile(path.join(dataRoot, 'public', work.folder, `${Math.min(...work.widths)}.jpg`));
  const image = imageFingerprint(bytes);
  const file = path.join(ANALYSIS_DIR, `${work.id}.json`);
  const kept = await readJson(path.join(dataRoot, file));
  if (kept?.image === image && kept.settings === settings && levels.every((l) => kept.levels?.[l.id])) return { levels: kept.levels, file, record: kept, fresh: false };
  const { data, info } = await sharp(bytes).resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = { data, width: info.width, height: info.height, channels: info.channels };
  const analysed = Object.fromEntries(levels.map((level) => [level.id, analyzePixels(pixels, { size: level.size, count: PLAN_PLACES_PER_LEVEL, overlap: PLACE_OVERLAP })]));
  return { levels: analysed, file, record: { image, settings, levels: analysed }, fresh: true };
}

/**
 * What the levels of the game "Detail dne" can ask of the pictures of `works` (each `{ id, folder, widths, technique, tags }`), from
 * the smallest JPEG in public/ of `dataRoot`: `prepared` = level id → prepareLevel, `sample` = ids of a fixed representative sample
 * (representativeSample, on the analysis of the middle level) of the works that are answers in every level (too few of them: in any
 * level) to try the looks on, `picks` first. A picture that cannot be read is left out, so it is never in a puzzle.
 * Each picture is analysed once (pictureAnalysis): its analysis is kept in ANALYSIS_DIR of `dataRoot` with the fingerprint of the
 * picture and the settings, and read again while both stay the same; only how alike the works are (prepareLevel) is worked out
 * every time, from the kept analyses of all works. `save` (the pipeline, scripts/lib/game-plan.mjs) writes the new analyses and
 * removes those of works gone; without it (the build of the site, the prototypes) they are only read. `analysis` = `{ written,
 * removed, reused }` (paths relative to `dataRoot`, a count).
 * The answers come from the ANSWER_CROPS richest places that overlap nothing, as ever (the days computed so far stay the same). With
 * `places` (the plan of the days) also `places` = level id → every place worth guessing of each work (up to PLAN_PLACES_PER_LEVEL,
 * then those sharing up to PLACE_OVERLAP of their side, in the same shape as the answers): a work rich in detail gets many, a plain
 * wash few. Slower (the thumbnails of every place are ranked), so the build of the site leaves it out.
 */
export async function prepareGame(works, dataRoot, levels = gameLevels(), picks = SAMPLE_PICKS, { places = false, save = false } = {}) {
  const { default: sharp } = await import('sharp');
  const settings = analysisSettings(levels);
  const analyses = Object.fromEntries(levels.map((level) => [level.id, {}]));
  const analysis = { written: [], removed: [], reused: 0 };
  for (const work of works) {
    try {
      const found = await pictureAnalysis(work, dataRoot, levels, settings, sharp);
      for (const level of levels) analyses[level.id][work.id] = found.levels[level.id];
      if (!found.fresh) analysis.reused++;
      else if (save) {
        await fs.mkdir(path.join(dataRoot, ANALYSIS_DIR), { recursive: true });
        await fs.writeFile(path.join(dataRoot, found.file), `${JSON.stringify(found.record)}\n`);
        analysis.written.push(found.file);
      }
    } catch (error) {
      console.warn(`Detail dne: ${work.folder}: ${error.message}`);
    }
  }
  if (save) {
    const ids = new Set(works.map((w) => w.id));
    for (const name of await fs.readdir(path.join(dataRoot, ANALYSIS_DIR)).catch(() => [])) {
      if (!name.endsWith('.json') || ids.has(name.slice(0, -5))) continue;
      await fs.rm(path.join(dataRoot, ANALYSIS_DIR, name), { force: true });
      analysis.removed.push(path.join(ANALYSIS_DIR, name));
    }
  }
  // the answers from the first ANSWER_CROPS places that overlap nothing only (picked richest first, so the same as an analysis
  // that stops there)
  const answerAnalyses = Object.fromEntries(levels.map((level) => [level.id, Object.fromEntries(Object.entries(analyses[level.id])
    .map(([id, a]) => [id, { ...a, crops: a.crops.filter((c) => !c.overlaps).slice(0, ANSWER_CROPS) }]))]));
  const prepared = Object.fromEntries(levels.map((level) => [level.id, prepareLevel({ level, works, analyses: answerAnalyses[level.id] })]));
  // works every level may ask for, so the sample shows each of them in every level; with too few of them, any answer
  const answerSets = Object.values(prepared).map((answers) => Object.keys(answers));
  const everywhere = answerSets.reduce((common, ids) => common.filter((id) => ids.includes(id)), answerSets[0] ?? []);
  const ids = everywhere.length >= SAMPLE_SIZE ? everywhere : [...new Set(answerSets.flat())];
  const middle = levels[Math.floor(levels.length / 2)];
  const sample = representativeSample({ works, analyses: answerAnalyses[middle.id], ids, count: SAMPLE_SIZE, fixed: picks });
  if (!places) return { prepared, sample, analysis };

  return { prepared, sample, analysis, places: Object.fromEntries(levels.map((level) => [level.id, prepareLevel({ level, works, analyses: analyses[level.id], keep: PLAN_PLACES_PER_LEVEL, plan: true })])) };
}

/**
 * The data file of the page /detail-dne/: the first day of the game, the address of the site (for sharing), the works the page can
 * show (`works`: what a thumbnail, a hint and the card of the end need, with the address of their page), the prepared answers of
 * every level (the days the plan does not have) and the plan (`plan`: `days` of this year and the one before, day → level →
 * puzzle, and `archive` = the older years, each a file of its own, archiveData; sitePlan of scripts/lib/game-plan.mjs). Only works in
 * some answer, among its thumbnails or in the shown days go in; a work nothing refers to would only make the file bigger.
 */
export function gameData({ works, prepared, site, plan = null }) {
  const answered = Object.values(prepared).flatMap((answers) => Object.entries(answers).flatMap(([id, crops]) => [id, ...crops.flatMap((c) => c.ranked)]));
  const used = new Set([...planWorkIds(plan?.days), ...answered]);
  return {
    epoch: GAME_EPOCH,
    site,
    works: works.filter((w) => used.has(w.id)).map(gameWorkFields),
    prepared,
    plan: { days: plan?.days ?? {}, archive: plan?.archive ?? [] },
  };
}

/** What the page needs of a work of the game: a thumbnail, a hint and the card of the end, with the address of its page. */
export function gameWorkFields(w) {
  return {
    id: w.id, title: w.title, sub: w.sub, year: w.year, technique: w.technique, collection: w.collection, collectionTitle: w.collectionTitle,
    text: w.text, url: w.url, folder: w.folder, widths: w.widths, ratio: w.ratio,
  };
}

/** The works the planned `days` refer to (the works asked for and their thumbnails). */
export function planWorkIds(days) {
  return Object.values(days ?? {}).flatMap((day) => Object.values(day).flatMap((p) => (p?.targetId ? [p.targetId, ...p.optionIds] : [])));
}

/**
 * The archive file of a year of the plan (/detail-dne/plan/<year>.json): `{ year, days, works }`, the days as in the data of the
 * page and the works they refer to that are still on the site (gameWorkFields), so the page can play a day of that year as it
 * plays the days it has.
 */
export function archiveData({ year, days, works }) {
  const used = new Set(planWorkIds(days));
  return { year, days, works: works.filter((w) => used.has(w.id)).map(gameWorkFields) };
}
