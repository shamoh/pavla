// The game Detail dne on the home page (src/components/GameTeaser.astro, script src/lib/game-teaser.ts): today's three close-ups as
// the game shows them at the first guess, each a link into its level; a level the player has played shows its work with ✓ / ✗, a
// day played through shrinks to one line with the result and the archive. The home page is built once a week, the day changes
// every midnight: the build writes the puzzles of the days around it (teaserData, /detail-dne/dnes.json) and the browser picks today.
import {
  dailyPuzzles, dayId, dayLabel, dropsFor, effectSettings, effectStrength, effectStyle, gameDate, gameFrame, gameLevels, gameLooks,
  plannedPuzzles, roundKey, unplayedDays, waveRipple, windowHtml,
} from './detail-game.mjs';

/** The days dnes.json holds around the day of the build: one before (a time zone, a late build) and three weeks ahead. */
export const TEASER_DAYS = { before: 1, after: 21 };

/** The level in the address of the game (`?uroven=lehka`): its label without diacritics, in small letters. */
export function levelParam(level) {
  return level.label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The level of `?uroven=` (its levelParam or its id), null for anything else. */
export function levelFromParam(value, levels = gameLevels()) {
  const wanted = String(value ?? '').trim().toLowerCase();
  return wanted ? levels.find((level) => level.id === wanted || levelParam(level) === wanted) ?? null : null;
}

/**
 * What the home page needs of the game (/detail-dne/dnes.json): the first day, the puzzles of the days `from` to `to` as the game
 * plays them (plannedPuzzles, without a plan dailyPuzzles; day → level → `{ targetId, crop, look }`) and the works they ask for
 * (what a window and a played level show). `data` = the data of the game page (gameData).
 */
export function teaserData({ data, from, to }) {
  const levels = gameLevels();
  const known = new Map(data.works.map((w) => [w.id, w]));
  const hasWork = (id) => known.has(id);
  const days = {};
  for (let day = Math.max(0, from); day <= to; day++) {
    const puzzles = plannedPuzzles({ plan: data.plan, day, levels, hasWork, computed: dailyPuzzles({ day, levels, prepared: data.prepared }) });
    days[day] = Object.fromEntries(levels.map((level) => {
      const p = puzzles[level.id];
      return [level.id, p ? { targetId: p.targetId, crop: p.crop, look: p.look } : null];
    }));
  }
  const used = new Set(Object.values(days).flatMap((day) => Object.values(day).filter(Boolean).map((p) => p.targetId)));
  const works = Object.fromEntries([...used].map((id) => {
    const w = known.get(id);
    return [id, { id, title: w.title, url: w.url, folder: w.folder, widths: w.widths, ratio: w.ratio }];
  }));
  return { epoch: data.epoch, days, works };
}

/**
 * What the home page shows today (`today` = the day of the game, gameDay) for the progress of the player (`store` = what the game
 * keeps, GAME_STORE; empty for a new player): a tile for each level (`open`, `started` with its misses, `solved`, `lost`, the
 * puzzle of the round when the player has one, otherwise the one of the day), `done` when every level is played, the series
 * (`keep` = played yesterday, today not yet: it is to keep) and how many days of the archive wait. Null without the day (the
 * file is too old).
 */
export function teaserState({ teaser, store = {}, today }) {
  const day = teaser.days?.[today];
  if (!day) return null;
  const { epoch, works } = teaser;
  const progress = store.progress ?? {};
  const rounds = store.rounds ?? {};
  const played = progress.played ?? {};
  const levels = gameLevels();
  const tiles = levels.flatMap((level) => {
    const key = roundKey(today, level.id, epoch);
    const round = rounds[key];
    const kept = round?.puzzle?.targetId && works[round.puzzle.targetId] ? round.puzzle : null;
    const puzzle = kept ? { targetId: kept.targetId, crop: kept.crop, look: kept.look } : day[level.id];
    if (!puzzle || !works[puzzle.targetId]) return [];
    const result = played[key];
    const misses = round?.guesses?.length ?? 0;
    const state = result ? (result.solved ? 'solved' : 'lost') : misses ? 'started' : 'open';
    return [{ level: level.id, label: level.label, param: levelParam(level), drops: dropsFor(0, 1, false, level.drops), state, misses, puzzle }];
  });
  const done = tiles.length > 0 && tiles.every((t) => t.state === 'solved' || t.state === 'lost');
  const yesterday = dayId(gameDate(today - 1, epoch));
  const streak = progress.streak > 0 && progress.lastDay === dayId(gameDate(today, epoch))
    ? { count: progress.streak, keep: false }
    : progress.streak > 0 && progress.lastDay === yesterday ? { count: progress.streak, keep: true } : null;
  const waiting = done ? unplayedDays({ played, levels, before: today, epoch }).length : 0;
  return { label: dayLabel(gameDate(today, epoch)), tiles, done, streak, waiting };
}

/** The SVG filter of a wave of `scale` px in a window of 360 px (the windows of the home page share it by its scale). */
export function teaserWaveFilter(scale) {
  return `<filter id="teaser-wave-${scale}" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="${waveRipple(360)}" numOctaves="2" seed="4" /><feDisplacementMap in="SourceGraphic" scale="${scale}" xChannelSelector="R" yChannelSelector="G" /></filter>`;
}

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The HTML of the tiles of the day (teaserState), the address of the game `game` ("/detail-dne/") and of the pictures `pictures`
 * (the base of the site): a level to play is the window of the game after its misses (windowHtml, the same frame and look,
 * 360 px scaled by `--teaser-zoom`); a played one its whole work with ✓ / ✗ and its title. `waves` collects the scales of the
 * waves used (teaserWaveFilter).
 */
export function teaserTilesHtml(state, { works, game, pictures, waves = new Set() }) {
  const levels = new Map(gameLevels().map((l) => [l.id, l]));
  const looks = new Map(gameLooks().map((l) => [l.id, l]));
  return state.tiles.map((tile) => {
    const level = levels.get(tile.level);
    const work = works[tile.puzzle.targetId];
    const href = `${game}?uroven=${tile.param}`;
    if (tile.state === 'solved' || tile.state === 'lost') {
      const sign = tile.state === 'solved' ? '✓' : '✗';
      return `<a class="teaser-tile ${tile.state}" href="${href}"><span class="teaser-window whole"><img src="${pictures}/${work.folder}/${Math.min(...work.widths)}.webp" alt="${escapeHtml(work.title)}" loading="lazy" /></span>`
        + `<span class="teaser-label"><span class="sign" aria-hidden="true">${sign}</span> <b>${level.label}</b> · ${escapeHtml(work.title)}</span></a>`;
    }
    const look = looks.get(tile.puzzle.look) ?? gameLooks()[0];
    const style = effectStyle(look.effect, look.colour, effectStrength(tile.misses, level.guesses), effectSettings(), 360);
    if (style.wave) waves.add(style.wave);
    const frame = gameFrame(tile.puzzle.crop, tile.misses, level.guesses - 1, work.ratio, level.lastView);
    const src = `${pictures}/${work.folder}/${Math.max(...work.widths)}.webp`;
    const window = windowHtml({ src, ratio: work.ratio, frame, style, zoom: 'var(--teaser-zoom)', waveId: `teaser-wave-${style.wave}` });
    const note = tile.state === 'started' ? 'rozehráno' : `<span class="drops">až ${tile.drops} 💧</span>`;
    return `<a class="teaser-tile ${tile.state}" href="${href}" aria-label="Hrát úroveň ${level.label}"><span class="teaser-window">${window}</span>`
      + `<span class="teaser-label"><b>${level.label}</b><span class="note"> · ${note}</span></span></a>`;
  }).join('');
}

/**
 * The one line of a day played through (teaserState `done`): the result in signs, the works played as small pictures (each a link
 * to its page) and what next: the archive with the days waiting, or tomorrow.
 */
export function teaserDoneHtml(state, { works, game, pictures }) {
  const signs = state.tiles.map((t) => `<span class="sign ${t.state}" title="${t.label}: ${t.state === 'solved' ? 'uhodnuto' : 'neuhodnuto'}">${t.state === 'solved' ? '✓' : '✗'}</span>`).join('');
  const minis = state.tiles.map((t) => {
    const work = works[t.puzzle.targetId];
    return `<a class="mini" href="${work.url}" title="${escapeHtml(work.title)}"><img src="${pictures}/${work.folder}/${Math.min(...work.widths)}.webp" alt="${escapeHtml(work.title)}" loading="lazy" /></a>`;
  }).join('');
  const days = state.waiting === 1 ? 'den' : state.waiting >= 2 && state.waiting <= 4 ? 'dny' : 'dní';
  const next = state.waiting
    ? `Zítra nové · <a href="${game}#archiv">V archivu čeká ještě ${state.waiting} ${days} →</a>`
    : 'Zítra tu budou nové.';
  return `<p class="teaser-done"><span>Den ${state.label} máš za sebou <span class="signs">${signs}</span></span><span class="minis">${minis}</span><span class="next">${next}</span></p>`;
}

/** The series by the heading: to keep (played yesterday) or going on (played today), nothing without one. */
export function teaserStreakText(streak) {
  if (!streak) return '';
  return streak.keep ? `🔥 Série ${streak.count} · nepřeruš ji` : `🔥 Série ${streak.count}`;
}
