// The data of the game "Detail dne" (scripts/lib/detail-game.mjs), prepared in Node from the pictures of the site: for the page
// /detail-dne/ (src/pages/detail-dne/data.json.ts) and for the prototypes (scripts/lib/prototypes.mjs). The browser gets
// it ready and only plays.
import path from 'node:path';
import { ANALYSIS_SIZE, GAME_EPOCH, analyzePixels, gameLevels, prepareLevel, representativeSample } from './detail-game.mjs';

/** How many works the sample of the game "Detail dne" has (detail-vzorek.html). */
export const SAMPLE_SIZE = 12;

/** Works of the sample picked by hand (ids, the line „Vzorek“ of detail-vzorek.html); the rest is picked automatically. */
export const SAMPLE_PICKS = [];

/**
 * What the levels of the game "Detail dne" can ask of the pictures of `works` (each `{ id, folder, widths, technique, tags }`), from
 * the smallest JPEG in public/ of `dataRoot`: `prepared` = level id → prepareLevel, `sample` = ids of a fixed representative sample
 * (representativeSample, on the analysis of the middle level) of the works that are answers in every level (too few of them: in any
 * level) to try the looks on, `picks` first. A picture that cannot be read is left out, so it is never in a puzzle.
 */
export async function prepareGame(works, dataRoot, levels = gameLevels(), picks = SAMPLE_PICKS) {
  const { default: sharp } = await import('sharp');
  const analyses = Object.fromEntries(levels.map((level) => [level.id, {}]));
  for (const work of works) {
    try {
      const file = path.join(dataRoot, 'public', work.folder, `${Math.min(...work.widths)}.jpg`);
      const { data, info } = await sharp(file).resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const pixels = { data, width: info.width, height: info.height, channels: info.channels };
      for (const level of levels) analyses[level.id][work.id] = analyzePixels(pixels, { size: level.size });
    } catch (error) {
      console.warn(`Detail dne: ${work.folder}: ${error.message}`);
    }
  }
  const prepared = Object.fromEntries(levels.map((level) => [level.id, prepareLevel({ level, works, analyses: analyses[level.id] })]));
  // works every level may ask for, so the sample shows each of them in every level; with too few of them, any answer
  const answerSets = Object.values(prepared).map((answers) => Object.keys(answers));
  const everywhere = answerSets.reduce((common, ids) => common.filter((id) => ids.includes(id)), answerSets[0] ?? []);
  const ids = everywhere.length >= SAMPLE_SIZE ? everywhere : [...new Set(answerSets.flat())];
  const middle = levels[Math.floor(levels.length / 2)];
  return { prepared, sample: representativeSample({ works, analyses: analyses[middle.id], ids, count: SAMPLE_SIZE, fixed: picks }) };
}

/**
 * The data file of the page /detail-dne/: the first day of the game, the address of the site (for sharing), the works the page can
 * show (`works`: what a thumbnail, a hint and the card of the end need, with the address of their page) and the prepared answers of
 * every level. Only works in some answer or among its thumbnails go in; a work nothing refers to would only make the file bigger.
 */
export function gameData({ works, prepared, site }) {
  const used = new Set(Object.values(prepared).flatMap((answers) => Object.entries(answers).flatMap(([id, crops]) => [id, ...crops.flatMap((c) => c.ranked)])));
  return {
    epoch: GAME_EPOCH,
    site,
    works: works.filter((w) => used.has(w.id)).map((w) => ({
      id: w.id, title: w.title, sub: w.sub, year: w.year, technique: w.technique, collection: w.collection, collectionTitle: w.collectionTitle,
      text: w.text, url: w.url, folder: w.folder, widths: w.widths, ratio: w.ratio,
    })),
    prepared,
  };
}
