// The plan of the days of the game "Detail dne" (extendPlan, scripts/lib/detail-game.mjs) as files of the site data, kept in git:
//   game/detail-dne/details.json  the numbered details (places worth guessing) of the works, `{ version, details }`
//   game/detail-dne/<year>.json   the days of that year, `{ version, year, days }`, one line per day, by its key
//                                 (dayId: "2026-320" = the 320th day of 2026, in the title of the game 2026#320)
//   game/detail-dne/analysis/<id>.json  the analysis of the picture of a work with its fingerprint (prepareGame), made again only
//                                 for a new or changed picture or other settings of the analysis
// A year once over never changes again (its file stays as it is); this year's file grows day by day. Every full run of the
// pipeline (scripts/process-images.mjs) extends the plan: the days up to tomorrow stay as they are, the next two weeks are planned
// again from the works on the site now. The build puts this year and the year before into the data of the page
// (src/pages/detail-dne/data.json.ts); every older year is its own file on the site, read when a player opens one of its days
// (src/pages/detail-dne/plan/[year].json.ts).
import fs from 'node:fs/promises';
import path from 'node:path';
import { colourProfile } from './affinity.mjs';
import { colourSettings } from './colors.mjs';
import {
  GAME_EPOCH, PLAN_FILE_VERSION, PLAN_LOCKED, extendPlan, gameDay, gameLevels, planDaysByYear, planDetailsText, planYearDays, planYearText, planYearsShown, pragueDate,
} from './detail-game.mjs';
import { prepareGame } from './detail-game-data.mjs';
import { excludePrepared, planViews } from './game-exclusions.mjs';
import { prototypeWorks } from './prototypes.mjs';

export { pragueDate };

/** The folder of the plan, relative to the site data (the repository of the site, or .demo/site). */
export const PLAN_DIR = path.join('game', 'detail-dne');
/** The file of the numbered details in PLAN_DIR. */
export const DETAILS_FILE = 'details.json';
/**
 * The places of works kept out of the game, for the site (the quiz of a visitor may not pick them): `{ version, areas: { <work
 * id>: [[x0, y0, x1, y1], …] } }` in shares of the web picture, rounded; nothing else of meta_game_skip leaves the content repository.
 */
export const SKIPS_FILE = 'skips.json';

/** The text of SKIPS_FILE from the exclusions of the plan (contentExclusions): only the works with places, sorted. */
export function skipsText(exclusions = {}) {
  const r = (v) => Math.round(v * 10000) / 10000;
  const areas = Object.fromEntries(Object.entries(exclusions)
    .filter(([, e]) => e && e.areas?.length)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([id, e]) => [id, e.areas.map((a) => [r(a.x0), r(a.y0), r(a.x1), r(a.y1)])]));
  return `${JSON.stringify({ version: 1, areas })}\n`;
}

/** The places kept out of the game of `siteDir` (SKIPS_FILE): work id → [{ x0, y0, x1, y1 }], {} without the file. */
export async function readSkips(siteDir) {
  const file = await readJson(path.join(siteDir, PLAN_DIR, SKIPS_FILE));
  return Object.fromEntries(Object.entries(file?.areas ?? {}).map(([id, list]) => [id, list.map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 }))]));
}

const readJson = async (file) => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
};

/** The years of `siteDir` with a plan file, oldest first. */
export async function planYears(siteDir) {
  const names = await fs.readdir(path.join(siteDir, PLAN_DIR)).catch(() => []);
  return names.map((n) => n.match(/^(\d{4})\.json$/)?.[1]).filter(Boolean).map(Number).sort((a, b) => a - b);
}

/**
 * The days of `year` in the plan of `siteDir`, by the day of the game (planYearDays); {} without its file, when it cannot be read
 * or is of another version (PLAN_FILE_VERSION: the plan starts again from the days computed so far).
 */
export async function readPlanYear(siteDir, year, epoch = GAME_EPOCH) {
  const file = await readJson(path.join(siteDir, PLAN_DIR, `${year}.json`));
  return file?.version === PLAN_FILE_VERSION ? planYearDays(file.days, epoch) : {};
}

/**
 * The whole plan of `siteDir`: `{ details, days }` of all years ({} parts when there is none yet or a file cannot be read: the
 * plan then starts from the days computed so far).
 */
export async function readPlan(siteDir) {
  const details = (await readJson(path.join(siteDir, PLAN_DIR, DETAILS_FILE)))?.details ?? {};
  const days = {};
  for (const year of await planYears(siteDir)) Object.assign(days, await readPlanYear(siteDir, year));

  return { details, days };
}

/** Writes `plan` into its files (one per year and the details), only those that changed: their paths relative to `siteDir`. */
export async function writePlan(siteDir, plan, epoch = GAME_EPOCH) {
  const files = { [DETAILS_FILE]: planDetailsText(plan.details) };
  for (const [year, days] of Object.entries(planDaysByYear(plan.days, epoch))) files[`${year}.json`] = planYearText(Number(year), days);
  const changed = [];
  await fs.mkdir(path.join(siteDir, PLAN_DIR), { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(siteDir, PLAN_DIR, name);
    if ((await fs.readFile(file, 'utf8').catch(() => null)) === text) continue;
    await fs.writeFile(file, text);
    changed.push(path.join(PLAN_DIR, name));
  }

  return changed;
}

/**
 * What the page gets of the plan of `siteDir` in `thisYear`: `days` of this year and the one before (planYearsShown) and
 * `archive` = the older years with a plan file, each the file /detail-dne/plan/<year>.json of the site.
 */
export async function sitePlan(siteDir, thisYear) {
  const shown = planYearsShown(thisYear);
  const years = await planYears(siteDir);
  const days = {};
  for (const year of years.filter((y) => shown.includes(y))) Object.assign(days, await readPlanYear(siteDir, year));

  return { days, archive: years.filter((y) => y < shown[0]) };
}

/**
 * The year the site is built in: the year in Prague, or DETAIL_DNE_YEAR of the environment (to try the archive files: with a year
 * two later than the first one of the game its days become an archive file).
 */
export function planBuildYear(env = process.env, date = new Date()) {
  return /^\d{4}$/.test(env.DETAIL_DNE_YEAR ?? '') ? Number(env.DETAIL_DNE_YEAR) : Number(pragueDate(date).slice(0, 4));
}

/**
 * The works of the site as the game takes them (the public copies and info.json of `siteDir`, with their colour profile as the
 * site has it), so the plan is made of what the site will show.
 */
export async function planWorks(siteDir, config) {
  const settings = colourSettings(config);
  const works = [];
  for (const work of prototypeWorks(siteDir)) {
    const info = JSON.parse(await fs.readFile(path.join(siteDir, 'public', work.folder, 'info.json'), 'utf8'));
    works.push({ ...work, colourProfile: colourProfile(info.colors, settings) });
  }

  return works;
}

/**
 * Extends the plan of `siteDir` on `date` (a Date; the day in Prague) and writes the files that changed:
 * `{ changed (paths, with the analyses of pictures written or removed), days (in the plan), ahead (the date of the last planned
 * day), analysis (prepareGame: written, removed, reused), plan ({ details, days }) }`. `exclusions` = what the author keeps out
 * (scripts/lib/game-exclusions.mjs, contentExclusions): applied to the days planned again, with the `view` of their puzzles.
 */
export async function updateGamePlan({ siteDir, config, date = new Date(), exclusions = {} }) {
  const works = await planWorks(siteDir, config);
  // the analysis of a picture is kept (game/detail-dne/analysis/), made again only for a new or changed picture
  const game = await prepareGame(works, siteDir, undefined, undefined, { places: true, save: true });
  const { analysis } = game;
  // what the author keeps out of the game (game, meta_game_skip; scripts/lib/game-exclusions.mjs): only the days planned again
  // change, the analyses stay as they are
  const prepared = excludePrepared(game.prepared, exclusions);
  const places = excludePrepared(game.places, exclusions);
  const levels = gameLevels();
  const today = gameDay(pragueDate(date), GAME_EPOCH);
  const extended = extendPlan({ plan: await readPlan(siteDir), prepared, places, levels, today, epoch: GAME_EPOCH });
  const plan = { ...extended, days: planViews(extended.days, { exclusions, levels, from: today + PLAN_LOCKED + 1 }) };
  const changed = [...analysis.written, ...analysis.removed, ...await writePlan(siteDir, plan)];
  const skipsFile = path.join(siteDir, PLAN_DIR, SKIPS_FILE);
  const skips = skipsText(exclusions);
  if ((await fs.readFile(skipsFile, 'utf8').catch(() => null)) !== skips) {
    await fs.writeFile(skipsFile, skips);
    changed.push(path.join(PLAN_DIR, SKIPS_FILE));
  }
  const keys = Object.keys(plan.days).map(Number);

  return { changed, days: keys.length, ahead: plan.days[Math.max(...keys)]?.date ?? null, analysis, plan };
}
