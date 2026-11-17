// Browser side of the game Detail dne (/detail-dne/, markup and look src/pages/detail-dne/index.astro, rules
// scripts/lib/detail-game.mjs): three puzzles a day, the same for everyone; the data comes ready from the build
// (/detail-dne/data.json, scripts/lib/detail-game-data.mjs). The progress (drops, series, rank, the collection) stays in this
// browser only (localStorage, GAME_STORE), the page works without it too, it only forgets. The days before today are the archive
// (?den=2026-320, the key of the day dayId; half the drops, the series stays): every round keeps its puzzle (roundPuzzle), so a played day stays the same when
// new works change the order of the days. Events of Google Analytics: game_start, game_end and share (source game).
// The layout never moves while a round goes on: the stage, the status and the thumbnails keep their place and size, the card
// of the end comes under the thumbnails. On a phone the stage is as big as it can be with all thumbnails still on the screen.
// The prototype of the game (.prototypes/detail-dne.html, scripts/lib/prototypes.mjs) runs this same code, bundled, with its own
// options (GameOptions): the data inside the page, its own memory, a look or a collection chosen by its tuning, days to come.
import { EVENTS, SHARE_COPY, SHARE_NATIVE, gameEventParams, trackEvent } from '../../scripts/lib/analytics.mjs';
import { SKIP_HEADER_ROOM, skipHeaderScope, skipsHeader } from '../../scripts/lib/skip-header.mjs';
import {
  applyGuess, archiveDays, cappedText, groupDigits, dailyPuzzles, dayId, dayLabel, nextStepsHtml, perfectDay, PERFECT_DAY_TEXT, daysWord, diagnosticsText, gameDiagnostics, monthGroups, unplayedDays, dayFromParam, dayMarks, gameDate, keptPuzzle, roundPuzzle, drawPixels, dropsFor, dropsWord, effectSettings, effectStrength, effectStyle, waveRipple, finishRound, gameDay, gameFrame,
  collectionHtml, archiveRoom, archiveRoomTitle, rankForms, statsTitle, roundKey as gameRoundKey, gameCollection, gameLevels, gameLooks, gameRank, gameShareText, mergePlanDays, planYearOf, plannedPuzzles, newProgress, newRound, winTitle,
} from '../../scripts/lib/detail-game.mjs';

/** Where the progress of a player is kept; a new format of it = a new key. */
export const GAME_STORE = 'pavla.detailDne.v2';

type GameWork = {
  id: string; title: string; sub: string; year: number; technique: string; collection: string; collectionTitle: string;
  text: string; url: string; folder: string; widths: number[]; ratio: number;
};
type GameData = { epoch: string; site: string; works: GameWork[]; prepared: Record<string, Record<string, unknown[]>>; plan?: { days: Record<string, any>; archive?: number[] } };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const LEVELS = gameLevels();
const LOOKS = gameLooks();

const escapeHtml = (text: unknown) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
/** When the stage and the thumbnails stand side by side: a big screen, or one on its side (a phone); the same query as in the page's CSS. */
const TWO_COLUMNS = '(min-width: 800px), (orientation: landscape) and (min-width: 560px)';
/** How many days the archive shows before "Starší dny". */
const ARCHIVE_SHOWN = 14;
const MARK_WORDS: Record<string, string> = { solved: 'uhodnuto', lost: 'neuhodnuto', open: 'čeká' };

/** What the page of the site leaves as it is and the prototype sets its own way. */
export type GameOptions = {
  /** The data of the game (otherwise read from data-src of the root). */
  data?: GameData;
  /** Where the pages of the site and the files of the plan are (the base path of the site). */
  base?: string;
  /** Where the pictures of the works are (folder/<width>.webp). */
  pictures?: string;
  /** The key of the memory of the player in localStorage. */
  store?: string;
  /** The look of the close-up instead of the one of the day (an id of gameLooks), or null. */
  look?: () => string | null;
  /** The rounds "Moje sbírka" shows instead of the player's own (a made-up player), or null. */
  collectionRounds?: () => Record<string, any> | null;
  /** The last day that can be opened (today; the prototype goes on into the days to come). */
  lastDay?: number;
};

/** What the page of the game can be told from outside (the tuning of the prototype). */
export type GameControl = { render: () => void; openDay: (day: number) => Promise<void>; reset: () => void; day: () => number; today: number };

export async function startGame(root: HTMLElement, options: GameOptions = {}): Promise<GameControl | undefined> {
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector(`[data-${name}]`) as T;
  const content = $('content');
  const base = options.base ?? BASE;
  const storeKey = options.store ?? GAME_STORE;
  /** A picture of a work: the largest for the stage (the close-up is zoomed in), the smallest for a thumbnail. */
  const picture = (work: GameWork, largest: boolean) => `${options.pictures ?? BASE}/${work.folder}/${largest ? Math.max(...work.widths) : Math.min(...work.widths)}.webp`;
  let data: GameData;
  try {
    if (options.data) data = options.data;
    else {
      const response = await fetch(root.dataset.src as string);
      if (!response.ok) throw new Error(String(response.status));
      data = await response.json();
    }
  } catch {
    content.innerHTML = '<p class="empty">Dnešní detail se nepodařilo načíst. Zkuste stránku obnovit.</p>';
    return undefined;
  }
  const byId = new Map(data.works.map((w) => [w.id, w]));
  const today = gameDay(localDate(), data.epoch);
  const lastDay = options.lastDay ?? today;
  /** The day on the screen: today, or a day of the archive. */
  let day = dayFromParam(new URLSearchParams(location.search).get('den'), today, data.epoch);
  /** A day of the game in its title: "2026#320" (dayLabel); its key "2026-320" (dayId: plan, address, events). */
  const labelOf = (d: number) => dayLabel(gameDate(d, data.epoch));
  const idOf = (d: number) => dayId(gameDate(d, data.epoch));
  const daily = new Map<number, Record<string, any>>();
  const dailyOf = (d: number) => {
    // the planned day (game/detail-dne/), a level without it (or with a work gone from the site) computed as before
    if (!daily.has(d)) daily.set(d, plannedPuzzles({ plan: data.plan, day: d, levels: LEVELS, hasWork: (id: string) => byId.has(id), computed: dailyPuzzles({ day: d, levels: LEVELS, prepared: data.prepared }) }));
    return daily.get(d)!;
  };
  /** The archive years of the plan already read (their days added to data.plan, their works to byId). */
  const loadedYears = new Set<number>();
  /**
   * Before a day of an archive year is shown (older than the year before this one, data.plan.archive): its file
   * /detail-dne/plan/<year>.json is read once; without it the days of that year are computed as before.
   */
  async function ensureDay(d: number) {
    const year = planYearOf(d, data.epoch);
    if (!data.plan?.archive?.includes(year) || loadedYears.has(year)) return;
    loadedYears.add(year);
    try {
      const response = await fetch(`${base}/detail-dne/plan/${year}.json`);
      if (!response.ok) throw new Error(String(response.status));
      const part = await response.json();
      data.plan = mergePlanDays(data.plan, part) as GameData['plan'];
      for (const w of (part.works ?? []) as GameWork[]) if (!byId.has(w.id)) byId.set(w.id, w);
      daily.clear();
    } catch { /* the days of that year are computed */ }
  }
  /** The puzzle of a level on the shown day: the one the player's round kept, otherwise the one of the day. */
  const puzzleOf = (levelId: string) => keptPuzzle({ computed: dailyOf(day)[levelId] ?? null, round: store.rounds[roundKey(levelId)], hasWork: (id: string) => byId.has(id), day, level: levelId });
  const archive = () => day !== today;
  let allDays = false;
  /** Months of the archive the player opened or closed by hand (YYYY-MM → open), kept while the page is open. */
  const monthsOpen = new Map<string, boolean>();

  const load = () => {
    try { return JSON.parse(localStorage.getItem(storeKey) ?? 'null') ?? {}; } catch { return {}; }
  };
  const store = { progress: newProgress(), rounds: {} as Record<string, any>, level: LEVELS[0].id, ...load() };
  const save = () => {
    try { localStorage.setItem(storeKey, JSON.stringify(store)); } catch { /* the game goes on without memory */ }
  };

  let puzzle: any = null;
  let optionWorks: GameWork[] = [];
  const levelOf = (id: string) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
  /** The key of a round of the shown day in the progress: "2026-320:easy" (roundKey, the key of the day as in the plan). */
  const roundKey = (levelId: string) => gameRoundKey(day, levelId, data.epoch);
  const currentRound = () => store.rounds[roundKey(store.level)] ?? newRound();
  const missesOf = (round: any) => round.guesses.length - (round.solved ? 1 : 0);
  const lookNow = () => LOOKS.find((l) => l.id === (options.look?.() ?? puzzle.look)) ?? LOOKS[0];

  /** Puts the part of the work around `frame` into the window (in shares of the window, so it survives a resize). */
  function showFrame(img: HTMLImageElement, work: GameWork, frame: { x: number; y: number; size: number }) {
    const stage = img.clientWidth;
    const scale = 1 / (frame.size * Math.min(1, work.ratio));
    const x = stage / 2 - frame.x * stage * scale;
    const y = stage / 2 - frame.y * work.ratio * stage * scale;
    img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  /** The whole work in the window. */
  function showWhole(img: HTMLImageElement, work: GameWork) {
    const stage = img.clientWidth;
    const scale = 1 / Math.max(1, work.ratio);
    img.style.transform = `translate(${(stage - stage * scale) / 2}px, ${(stage - stage * work.ratio * scale) / 2}px) scale(${scale})`;
  }

  /** What covers the close-up now: the raster on the window itself, the filter on the picture reaching beyond it. */
  function showCover(round: any) {
    const view = root.querySelector('.view') as HTMLElement | null;
    if (!view || !puzzle) return;
    const level = levelOf(store.level);
    const { effect, colour } = lookNow();
    const clip = view.parentElement as HTMLElement;
    // the blur and the wave are shares of the window: as hard on a phone as on a computer
    const size = clip.clientWidth;
    const look = effectStyle(effect, colour, effectStrength(round.guesses.length, level.guesses, round.over), effectSettings(), size);
    view.style.filter = look.filter;
    clip.style.mask = look.mask;
    clip.style.setProperty('-webkit-mask', look.mask);
    const canvas = view.querySelector('.pixels') as HTMLCanvasElement;
    const img = view.querySelector('img') as HTMLImageElement;
    canvas.hidden = !look.pixels;
    if (look.pixels) {
      const work = byId.get(puzzle.targetId)!;
      const frame = gameFrame(puzzle.crop, round.guesses.length, level.guesses - 1, work.ratio, level.lastView);
      if (img.complete) drawPixels(canvas, img, frame, look.pixels);
      else img.addEventListener('load', () => drawPixels(canvas, img, frame, look.pixels), { once: true });
    }
    root.querySelector('[data-wave-map]')?.setAttribute('scale', String(look.wave));
    root.querySelector('[data-wave-ripple]')?.setAttribute('baseFrequency', waveRipple(size));
  }

  /**
   * The stage and the thumbnails always fit on the screen under the game's top, measured once for each level and width (the toolbar
   * of a mobile browser comes and goes while playing, and nothing may change with it):
   * - one column (a phone upright): the stage as big as it can be with the status and all thumbnails under it (MIN_STAGE only on an absurdly small screen);
   * - two columns (TWO_COLUMNS: a computer, a phone on its side): the stage takes its half but no more than the height of the screen,
   *   and the thumbnails get narrower until the status and all of them fit by the stage too (a phone on its side is low).
   */
  const fitted = new Map<string, { stage: number; options: number | null }>();
  const SCREEN_GAP = 12;
  /** The smallest the stage gets: everything fits on the screen first, only on an absurdly small one it gives up. */
  const MIN_STAGE = 120;
  function fitStage() {
    const stage = root.querySelector('.stage') as HTMLElement | null;
    if (!stage) return;
    const options = root.querySelector('.options') as HTMLElement;
    const status = root.querySelector('.status') as HTMLElement;
    const wide = matchMedia(TWO_COLUMNS).matches;
    const key = `${innerWidth}:${store.level}:${archive()}`;
    if (!fitted.has(key)) {
      stage.style.width = '';
      options.style.maxWidth = '';
      const full = stage.clientWidth;
      const top = stage.getBoundingClientRect().top - root.getBoundingClientRect().top;
      if (wide) {
        const free = innerHeight - top - SCREEN_GAP;
        // three rows of 4 : 3 thumbnails, three in a row, gaps of 6 px: height = 3 × (width - 12) / 3 × 3 / 4 + 12 = (width - 12) × 3 / 4 + 12
        const forOptions = innerHeight - top - status.offsetHeight - 10 - SCREEN_GAP;
        const widest = Math.round(((forOptions - 12) * 4) / 3 + 12);
        fitted.set(key, { stage: Math.round(Math.max(MIN_STAGE, Math.min(full, free))), options: widest < options.clientWidth ? Math.max(160, widest) : null });
      } else {
        const below = status.offsetHeight + options.offsetHeight + 12 + 10 + SCREEN_GAP;
        fitted.set(key, { stage: Math.round(Math.max(MIN_STAGE, Math.min(full, innerHeight - top - below))), options: null });
      }
    }
    const fit = fitted.get(key)!;
    stage.style.width = `${fit.stage}px`;
    // the picture reaches beyond the window by a share of it, more than the wave and the blur take (effectSettings: 4 % + 1 %)
    stage.style.setProperty('--bleed', `${Math.max(16, Math.ceil(fit.stage * 0.08))}px`);
    options.style.maxWidth = fit.options ? `${fit.options}px` : '';
  }

  function placePicture(round: any) {
    const img = root.querySelector('.stage img') as HTMLImageElement | null;
    if (!img || !puzzle) return;
    const work = byId.get(puzzle.targetId)!;
    const level = levelOf(store.level);
    if (round.over) showWhole(img, work);
    else showFrame(img, work, gameFrame(puzzle.crop, round.guesses.length, level.guesses - 1, work.ratio, level.lastView));
    showCover(round);
  }

  /** The drops of the win fall in the colours of the close-up. */
  function rain(colours: string[]) {
    const stage = root.querySelector('.stage') as HTMLElement;
    const height = stage.clientHeight + 40;
    for (let i = 0; i < 36; i++) {
      const drop = document.createElement('span');
      drop.className = 'drop';
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.background = colours[i % colours.length];
      drop.style.setProperty('--t', `${1 + Math.random() * 1.2}s`);
      drop.style.setProperty('--d', `${Math.random() * 0.9}s`);
      drop.style.setProperty('--h', `${height}px`);
      stage.append(drop);
    }
    setTimeout(() => stage.querySelectorAll('.drop').forEach((d) => d.remove()), 3500);
  }

  function renderStats() {
    const { progress } = store;
    const rank = gameRank(progress.drops);
    $('stats').innerHTML = `<span>💧 <b>${groupDigits(progress.drops)}</b><span class="word"> ${dropsWord(progress.drops)}</span></span><span>Série <b>${progress.streak}</b></span><span class="rank"></span>`;
    fitRank();
    // the rules in a few lines in the bubble (a link down to the whole rules), the player's rank marked in their list
    $('stats').title = statsTitle(progress);
    const ranks = root.querySelectorAll<HTMLElement>('[data-rank]');
    ranks.forEach((li) => li.classList.toggle('current', Number(li.dataset.rank) === Math.min(rank.index, ranks.length - 1)));
    $('archive-room').innerHTML = roomText(false);
  }

  /**
   * The rank always in the top line by the title: the longest of its forms (rankForms) with which the line of the stats does not
   * overflow (CSS keeps it one line next to the title, `.stats` overflow hidden); the whole in the bubble. On a narrow phone at least
   * the number ("#2"), for which the word "kapek" after the drops gives way (`.tight`); when not even that fits, no rank, and the
   * word only as long as the drops and the series fit with it. Hidden by CSS on a phone on its side (offsetParent null).
   */
  function fitRank() {
    const stats = $('stats');
    const rank = stats.querySelector('.rank') as HTMLElement | null;
    if (!rank) return;
    const fits = () => stats.scrollWidth <= stats.clientWidth;
    stats.classList.remove('tight');
    rank.hidden = false;
    const forms = rankForms(store.progress.drops);
    for (const form of forms) {
      rank.innerHTML = form;
      if (!rank.offsetParent || fits()) return;
    }
    stats.classList.add('tight');
    if (fits()) return;
    rank.hidden = true;
    stats.classList.remove('tight');
    if (!fits()) stats.classList.add('tight');
  }

  /** The drops the archive still gives today (archiveRoom). */
  const room = () => archiveRoom(store.progress, today, data.epoch);
  /** The cap of the archive in words, short for the bar over the levels, a sentence for the note of the archive (one line), what it means in the bubble of both. */
  function roomText(short: boolean) {
    const { cap, left } = room();
    const title = ` title="${escapeHtml(archiveRoomTitle({ cap, left }))}"`;
    if (!left) return `<span class="room full"${title}>${short ? `strop ${cap} 💧 dnes vyčerpán` : `Dnešních ${cap} 💧 z archivu už máš, další až zítra.`}</span>`;
    const near = left <= cap / 2 ? ' near' : '';
    return `<span class="room${near}"${title}>${short ? `zbývá ${left} z ${cap} 💧` : `Z archivu se za den započte nejvýš ${cap} 💧, dnes ještě ${left}.`}</span>`;
  }

  function renderLevels() {
    $('levels').innerHTML = LEVELS.map((level) => {
      const played = store.progress.played[roundKey(level.id)];
      const state = played ? (played.solved ? '✓' : '✗') : `×${level.drops} 💧`;
      // a level not played yet is pale yellow: the player sees what still waits today
      const todo = !played && puzzleOf(level.id) ? ' todo' : '';
      return `<button class="level${todo}" type="button" data-level="${level.id}" aria-pressed="${level.id === store.level}">${level.label} <small>${state}</small></button>`;
    }).join('');
  }

  /** "Moje sbírka": the solved works, the newest first, each with the colours of its close-ups (gameCollection). */
  let collectionOpen = false;
  function renderCollection() {
    const made = options.collectionRounds?.() ?? null;
    const items = gameCollection({ rounds: made ?? store.rounds, collected: made ? [] : store.progress.collected, hasWork: (id: string) => byId.has(id) });
    $('collection').innerHTML = collectionHtml({
      items, open: collectionOpen,
      work: (id: string) => {
        const w = byId.get(id);
        return w ? { title: w.title, href: w.url, src: picture(w, false) } : null;
      },
    });
  }
  $('collection').addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-collection-toggle]')) return;
    collectionOpen = !collectionOpen;
    renderCollection();
  });

  /**
   * The status over the thumbnails, always the same lines: the question (the verdict at the end), the look with the guess and the drops
   * (what was won), and in a level with hints the last hint (a line waiting for it before the first miss, the title at the end).
   */
  /** What a hit at this try gives: on a day of the archive no more than the archive still gives today, "(strop)" when less. */
  function worth(misses: number, level: any) {
    const full = dropsFor(misses, 1, archive(), level.drops);
    if (!archive()) return `${full} 💧`;
    const left = room().left;
    return left < full ? `${left} 💧 (strop)` : `${full} 💧`;
  }

  function statusHtml(round: any, level: any, outcome?: any) {
    const played = store.progress.played[roundKey(store.level)];
    const drops = outcome?.gained ?? played?.drops ?? 0;
    const ask = round.over ? (round.solved ? winTitle(missesOf(round)) : 'Tenhle byl záludný') : 'Ze kterého obrazu je tento detail?';
    // one pip for each try: the misses, the try now (or the hit at the end), the ones left
    const pips = Array.from({ length: level.guesses }, (_, i) => {
      const kind = i < missesOf(round) ? 'miss' : i === missesOf(round) && round.solved ? 'hit' : i === round.guesses.length && !round.over ? 'now' : 'left';
      return `<span class="pip ${kind}"></span>`;
    }).join('');
    const tried = `<span class="pips" aria-hidden="true">${pips}</span>`;
    const tries = round.over
      ? `${tried}${round.solved ? `+${drops} 💧${played?.capped ? ' (strop archivu)' : ''} a obraz do tvé sbírky` : archive() ? 'Zkus jiný den z archivu.' : 'Zítra je tu nový detail.'}`
      : `${tried}<b>Pokus ${round.guesses.length + 1} z ${level.guesses}</b> · za ${worth(round.guesses.length, level)} · ${escapeHtml(lookNow().label)}`;
    const lastHint = round.hints[round.hints.length - 1];
    const hint = !level.hints ? ''
      : round.over ? `<p class="hint"><b>${escapeHtml(byId.get(puzzle.targetId)!.title)}</b></p>`
        : lastHint ? `<p class="hint"><b>Nápověda:</b> ${escapeHtml(lastHint)}</p>`
          // no attribute rules out one or two works (gameHint): then only the zoom helps
          : round.guesses.length ? '<p class="hint waiting">Tentokrát nápověda není, detail se aspoň oddálil.</p>'
            : '<p class="hint waiting">Po omylu přijde nápověda.</p>';
    return `<div class="status${round.over ? (round.solved ? ' won' : ' lost') : ''}" aria-live="polite"><p class="ask">${ask}</p><p class="tries">${tries}</p>${hint}</div>`;
  }

  /**
   * The card of the end, under the thumbnails: the verdict first and clearly (won / not this time), then the work, and one line of
   * quiet links (the work, its collection, sharing). No way on to another level or day here: the levels are over the stage, the
   * archive under the game; the whole work on the stage is a link to its page too.
   */
  function resultHtml(outcome?: any) {
    const work = byId.get(puzzle.targetId)!;
    const round = currentRound();
    const played = store.progress.played[roundKey(store.level)];
    const drops = outcome?.gained ?? played?.drops ?? 0;
    const rank = gameRank(store.progress.drops);
    const rankUp = outcome?.rankUp ? `<p class="rankup">Nová hodnost: ${escapeHtml(rank.title)}!</p>` : '';
    // a day of the archive over the cap of today: what was left out and when the archive gives drops again
    const capped = round.solved && played?.capped
      ? `<p class="capped" title="${escapeHtml(archiveRoomTitle(room()))}">${cappedText({ gained: drops, capped: played.capped })}</p>` : '';
    const verdict = round.solved
      ? `<p class="verdict"><span class="sign" aria-hidden="true">✓</span> ${winTitle(missesOf(round))} ${drops || !played?.capped ? `<span class="gain">+${drops} 💧</span>` : ''}</p>`
      : `<p class="verdict"><span class="sign" aria-hidden="true">✗</span> Tentokrát ne <span class="gain">byl to tenhle obraz</span></p>`;
    const text = work.text ? `<p class="text">${escapeHtml(work.text)}</p>` : '';
    const collection = work.collection
      ? `<a class="action quiet" href="${base}/tvorba/kolekce/${work.collection}/" title="Kolekce ${escapeHtml(work.collectionTitle)}">Kolekce</a>` : '';
    // always: the levels of the day still to play, or (the day done) the way down to the archive
    const left = LEVELS.filter((l) => puzzleOf(l.id) && !store.progress.played[roundKey(l.id)]);
    const waiting = left.length ? 0 : unplayedDays({ played: store.progress.played, levels: LEVELS, before: today + 1, epoch: data.epoch }).filter((d) => d !== day).length;
    const done = nextStepsHtml({ left, label: labelOf(day), archive: archive(), waiting });
    // every level of the day solved at the first guess
    const perfect = perfectDay(LEVELS.filter((l) => puzzleOf(l.id)).map((l) => store.progress.played[roundKey(l.id)]))
      ? `<p class="perfect"><span aria-hidden="true">🎉</span> ${PERFECT_DAY_TEXT}</p>` : '';
    return `<div class="result ${round.solved ? 'won' : 'lost'}">
      ${verdict}
      ${capped}
      ${rankUp}
      <h2>${escapeHtml(work.title)}</h2>
      <p class="sub">${escapeHtml(work.sub)}${work.year ? ` · ${work.year}` : ''}</p>
      ${text}
      <div class="actions">
        <a class="action quiet" href="${work.url}" title="Prohlédnout obraz">Obraz</a>
        ${collection}
        <button class="action quiet" type="button" data-share>Sdílet</button>
      </div>
      ${perfect}
      <p class="done">${done}</p>
    </div>`;
  }

  /** A date of the game in words: "14. listopadu", short "14. 11.". */
  const dateWords = (d: number, short = false) => new Date(`${gameDate(d, data.epoch)}T12:00:00Z`)
    .toLocaleDateString('cs-CZ', short ? { day: 'numeric', month: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'long', timeZone: 'UTC' });

  /** Over the levels on a day of the archive only (a move to another day, never during a round): which day, the way back. */
  function renderArchiveBar() {
    const bar = $('archive-bar');
    bar.hidden = !archive();
    if (!archive()) return;
    bar.innerHTML = `<button class="step" type="button" data-day="${day - 1}" aria-label="Starší den"${day > 0 ? '' : ' disabled'}>‹</button>
      <span class="which"><span class="when">Archiv · ${dateWords(day)}</span> ${roomText(true)}</span>
      <button class="step" type="button" data-day="${day + 1}" aria-label="Novější den"${day < lastDay ? '' : ' disabled'}>›</button>
      <button class="today" type="button" data-day="${today}">Dnes</button>`;
  }

  /** The day of the week of a day of the game, short: "pá". */
  const weekday = (d: number) => new Date(`${gameDate(d, data.epoch)}T12:00:00Z`).toLocaleDateString('cs-CZ', { weekday: 'short', timeZone: 'UTC' });

  /**
   * Today and the days before, the newest first: a tile with the date (today "Dnes"), the day of the week and a dot for each level
   * (green solved, red not, pale yellow still waiting). The number of the day is in the bubble.
   */
  function renderArchive() {
    const days = [today, ...archiveDays(today)];
    const tile = (d: number) => {
      const marks = dayMarks(store.progress.played, d, LEVELS, data.epoch).map((m) => m ?? 'open');
      const dots = marks.map((m) => `<span class="dot ${m}"></span>`).join('');
      const told = `Detail dne ${labelOf(d)} · ${dateWords(d)} · ${marks.map((m, i) => `${LEVELS[i].label} ${MARK_WORDS[m]}`).join(', ')}`;
      const waits = marks.includes('open') ? ' waits' : '';
      return `<button class="day${waits}" type="button" data-day="${d}" aria-pressed="${d === day}" title="${told}" aria-label="${told}">`
        + `<b>${d === today ? 'Dnes' : dateWords(d, true)}</b><small>${d === today ? dateWords(d, true) : weekday(d)}</small><span class="dots">${dots}</span></button>`;
    };
    // all in one month: the newest days and "Starší dny"; more months: every month folds (its name and how many days wait), the
    // newest one and the one of the shown day open, the others closed until the player opens them
    const groups = monthGroups(days, data.epoch, store.progress.played, LEVELS);
    if (groups.length < 2) {
      const shown = allDays ? days : days.slice(0, ARCHIVE_SHOWN + 1);
      $('archive').innerHTML = `<div class="days">${shown.map(tile).join('')}</div>${shown.length < days.length ? `<button class="action quiet" type="button" data-all-days>Starší dny (${days.length - shown.length})</button>` : ''}`;
      return;
    }
    const month = (key: string) => new Date(`${key}-15T12:00:00Z`).toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    $('archive').innerHTML = groups.map((g, i) => {
      const open = monthsOpen.get(g.month) ?? (i === 0 || g.days.includes(day));
      const waits = g.waiting ? `<span class="waiting">čeká ${g.waiting} ${daysWord(g.waiting)}</span>` : '<span class="all-done">vše dohráno</span>';
      return `<details class="month" data-month="${g.month}"${open ? ' open' : ''}><summary><span class="name">${month(g.month)}</span>${waits}</summary><div class="days">${g.days.map(tile).join('')}</div></details>`;
    }).join('');
  }

  /** The diagnostics under the game (only while the family tests it): what is on the screen now, so a remark can name it. */
  let diagnostics: [string, string][] = [];
  function renderDiagnostics() {
    const box = $('diagnostics');
    if (!box) return;
    if (!puzzle) {
      diagnostics = [['Den', `${idOf(day)} (${labelOf(day)}) · ${gameDate(day, data.epoch)}`], ['Úroveň', `${store.level} bez hádanky`]];
      box.innerHTML = '<p class="empty">Žádná hádanka.</p>';
      return;
    }
    const level = levelOf(store.level);
    const round = currentRound();
    const stage = root.querySelector('.stage') as HTMLElement | null;
    const rows = gameDiagnostics({
      day, today, date: gameDate(day, data.epoch), level, puzzle, round, work: byId.get(puzzle.targetId)!,
      kept: !!store.rounds[roundKey(store.level)]?.puzzle, titleOf: (id: string) => byId.get(id)?.title ?? id, size: stage?.clientWidth ?? 360,
    });
    rows.push(
      ['Obrazovka', `${innerWidth} × ${innerHeight} px · ${matchMedia(TWO_COLUMNS).matches ? 'dva sloupce' : 'jeden sloupec'} · okno ${stage?.clientWidth ?? 0} px · ${devicePixelRatio}× hustota`],
      ['Data', `začátek ${data.epoch} · ${data.works.length} děl · odpovědi ${LEVELS.map((l) => `${l.id} ${Object.keys(data.prepared[l.id] ?? {}).length}`).join(', ')}`],
    );
    diagnostics = rows as [string, string][];
    box.innerHTML = rows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  }

  function render(outcome?: any) {
    puzzle = puzzleOf(store.level);
    $('number').textContent = labelOf(day);
    renderStats();
    renderLevels();
    renderArchiveBar();
    renderArchive();
    renderCollection();
    if (!puzzle) {
      content.innerHTML = '<p class="empty">Pro tuhle úroveň je zatím málo obrazů.</p>';
      renderDiagnostics();
      return;
    }
    optionWorks = puzzle.optionIds.map((id: string) => byId.get(id));
    const round = currentRound();
    const level = levelOf(store.level);
    const work = byId.get(puzzle.targetId)!;
    content.innerHTML = `<div class="game">
      <div class="stage${round.over ? ' reveal' : ''}"><div class="clip"><div class="view"><img src="${picture(work, true)}" alt="${round.over ? escapeHtml(work.title) : 'Výřez z obrazu'}" /><canvas class="pixels" hidden></canvas></div></div>${round.over ? `<a class="whole-link" href="${work.url}" aria-label="Prohlédnout obraz ${escapeHtml(work.title)}" title="Prohlédnout obraz"></a>` : ''}</div>
      <div class="side">
        ${statusHtml(round, level, outcome)}
        <div class="options">
          ${optionWorks.map((w) => {
            const classes = ['option'];
            if (round.over && w.id === puzzle.targetId) classes.push('right');
            else if (round.guesses.includes(w.id)) classes.push('wrong', 'out');
            else if (round.ruledOut.includes(w.id) || round.over) classes.push('out');
            const named = round.over ? escapeHtml(w.title) : round.reasons[w.id] ? `Vyřazeno: ${escapeHtml(round.reasons[w.id])}` : 'Obraz';
            const disabled = round.over || classes.includes('out') ? 'disabled' : '';
            const because = !round.over && round.reasons[w.id] ? `<span class="because">${escapeHtml(round.reasons[w.id])}</span>` : '';
            return `<button class="${classes.join(' ')}" type="button" data-id="${w.id}" aria-label="${named}" ${disabled}><img src="${picture(w, false)}" alt="" />${because}</button>`;
          }).join('')}
        </div>
        ${round.over ? resultHtml(outcome) : ''}
      </div>
    </div>`;
    fitStage();
    renderDiagnostics();
    const img = content.querySelector('.stage img') as HTMLImageElement;
    const view = content.querySelector('.view') as HTMLElement;
    img.style.transition = 'none';
    view.style.transition = 'none';
    // a finished round opened again shows the whole work; only the moment of the end moves
    if (outcome) {
      showFrame(img, work, gameFrame(puzzle.crop, round.guesses.length - 1, level.guesses - 1, work.ratio, level.lastView));
      showCover({ ...round, over: false, guesses: round.guesses.slice(0, -1) });
    } else placePicture(round);
    img.getBoundingClientRect();
    img.style.transition = '';
    view.style.transition = '';
    if (outcome) {
      requestAnimationFrame(() => placePicture(round));
      if (round.solved) {
        rain(puzzle.crop.colours);
        navigator.vibrate?.([30, 40, 60]);
      }
      // the card of the end may be under the screen: there after the picture has come out, a scroll, not a jump
      setTimeout(() => content.querySelector('.result')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 1600);
    }
  }

  function guess(id: string) {
    const before = currentRound();
    const level = levelOf(store.level);
    const round = applyGuess(before, puzzle, optionWorks, id, level.guesses, level.hints);
    if (round === before) return;
    // the round keeps its puzzle from the first guess on
    store.rounds[roundKey(store.level)] = { ...round, puzzle: before.puzzle ?? roundPuzzle(puzzle) };
    const event = { level: level.id, day, today, id: idOf(day), look: puzzle.look };
    if (!before.guesses.length) trackEvent(EVENTS.gameStart, gameEventParams(event));
    let outcome;
    if (round.over) {
      outcome = finishRound(store.progress, { day, today, level: level.id, epoch: data.epoch, multiplier: level.drops, solved: round.solved, misses: missesOf(round), workId: puzzle.targetId });
      store.progress = outcome.progress;
      trackEvent(EVENTS.gameEnd, gameEventParams(event, { solved: round.solved, misses: missesOf(round), drops: outcome.gained, streak: outcome.progress.streak, work: byId.get(puzzle.targetId)! }));
    }
    save();
    if (outcome) {
      render(outcome);
      return;
    }
    // a miss: the picture zooms out in place instead of a new page
    const old = root.querySelector('.stage img') as HTMLImageElement;
    const oldView = root.querySelector('.view') as HTMLElement;
    const [transform, filter, mask] = [old.style.transform, oldView.style.filter, (oldView.parentElement as HTMLElement).style.mask];
    render();
    const fresh = root.querySelector('.stage img') as HTMLImageElement;
    const view = root.querySelector('.view') as HTMLElement;
    const clip = view.parentElement as HTMLElement;
    fresh.style.transition = 'none';
    view.style.transition = 'none';
    fresh.style.transform = transform;
    view.style.filter = filter;
    clip.style.mask = mask;
    clip.style.setProperty('-webkit-mask', mask);
    fresh.getBoundingClientRect();
    fresh.style.transition = '';
    view.style.transition = '';
    requestAnimationFrame(() => placePicture(round));
  }

  async function share(button: HTMLElement) {
    const round = currentRound();
    const url = `${data.site.replace(/\/$/, '')}/detail-dne/${archive() ? `?den=${idOf(day)}` : ''}`;
    const level = levelOf(store.level);
    const perfect = perfectDay(LEVELS.filter((l) => puzzleOf(l.id)).map((l) => store.progress.played[roundKey(l.id)]));
    const text = gameShareText({ label: labelOf(day), level: level.label, misses: missesOf(round), solved: round.solved, guesses: level.guesses, perfect, url });
    const params = { source: 'game', ...gameEventParams({ level: store.level, day, today, id: idOf(day), look: puzzle.look }) };
    try {
      if (navigator.share) {
        await navigator.share({ text });
        trackEvent(EVENTS.share, { method: SHARE_NATIVE, ...params });
      } else {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Zkopírováno';
        trackEvent(EVENTS.share, { method: SHARE_COPY, ...params });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') button.textContent = 'Sdílení se nepovedlo';
    }
  }

  /** The diagnostics to the clipboard, with the address of the day, to paste into a message. */
  async function copyDiagnostics(button: HTMLElement) {
    try {
      await navigator.clipboard.writeText(diagnosticsText(diagnostics, location.href));
      button.textContent = 'Zkopírováno';
    } catch {
      button.textContent = 'Kopírování se nepovedlo';
    }
    setTimeout(() => { button.textContent = 'Zkopírovat diagnostiku'; }, 2500);
  }

  /** Another day: its address (?den= only for the archive), the game from its top. */
  async function openDay(next: number) {
    if (!Number.isInteger(next) || next < 0 || next > lastDay) return;
    await ensureDay(next);
    day = next;
    const params = new URLSearchParams(location.search);
    if (archive()) params.set('den', idOf(day));
    else params.delete('den');
    const query = params.toString();
    try {
      history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    } catch { /* a page opened from the disk may not change its address */ }
    render();
    toGame(true);
  }

  /** Another level (the levels over the game, a level in the box of the end): the game from its top, ready to play. */
  function openLevel(id: string) {
    store.level = levelOf(id).id;
    save();
    render();
    toGame(true);
  }

  // a month of the archive opened or closed by hand stays so after the archive is drawn again
  root.addEventListener('toggle', (event) => {
    const month = event.target as HTMLDetailsElement;
    if (month.matches?.('details[data-month]')) monthsOpen.set(month.dataset.month as string, month.open);
  }, true);
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const option = target.closest('.option') as HTMLButtonElement | null;
    if (option && !option.disabled) guess(option.dataset.id as string);
    const level = target.closest('[data-level]') as HTMLElement | null;
    if (level) openLevel(level.dataset.level as string);
    const shareButton = target.closest('[data-share]') as HTMLElement | null;
    if (shareButton) share(shareButton);
    const dayButton = target.closest('[data-day]') as HTMLButtonElement | null;
    if (dayButton && !dayButton.disabled) openDay(Number(dayButton.dataset.day));
    if (target.closest('[data-to-archive]')) {
      event.preventDefault();
      $('archive').closest('section')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    const copy = target.closest('[data-copy-diagnostics]') as HTMLElement | null;
    if (copy) copyDiagnostics(copy);
    if (target.closest('[data-all-days]')) {
      allDays = true;
      renderArchive();
    }
  });
  /**
   * Where the game starts on the screen: its title at the top. On a phone upright and on any low screen (a phone on its side) right at
   * the top, so the stage and all thumbnails fit (fitStage measures from there); otherwise SKIP_HEADER_ROOM under it, as the pages of
   * Tvorba open (scripts/lib/skip-header.mjs).
   */
  const phoneLike = () => !matchMedia(TWO_COLUMNS).matches || innerHeight < 700;
  function toGame(smooth = false) {
    const top = Math.max(0, root.getBoundingClientRect().top + scrollY - (phoneLike() ? 0 : SKIP_HEADER_ROOM));
    scrollTo({ top, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
  }
  addEventListener('resize', () => {
    fitRank();
    fitStage();
    placePicture(currentRound());
    renderDiagnostics();
  });
  // a phone turned during a round: the game in its new layout at the top again, as after loading (after the browser has laid it out)
  matchMedia('(orientation: landscape)').addEventListener('change', () => requestAnimationFrame(() => {
    fitStage();
    placePicture(currentRound());
    if (phoneLike()) toGame();
  }));
  await ensureDay(day);
  render();
  // only once it is drawn: before that the page is too short to scroll. A fresh visit opens past the header of the site, the title
  // of the game on top (as the pages of Tvorba, scripts/lib/skip-header.mjs; the script of the layout comes too early for it).
  const entry = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  const page = { path: location.pathname, scope: skipHeaderScope(location.pathname, BASE || '/'), hash: location.hash, navigation: entry?.type ?? '' };
  if (skipsHeader(page) || phoneLike()) toGame();

  return {
    render,
    openDay,
    reset: () => {
      store.progress = newProgress();
      store.rounds = {};
      save();
      render();
    },
    day: () => day,
    today,
  };
}
