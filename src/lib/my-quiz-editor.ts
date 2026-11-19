// The editor of a quiz of a visitor ("Můj Detail dne", /detail-dne/muj-kviz/?obraz=<id>; scripts/lib/my-quiz.mjs): the level, the
// place of the close-up (a tap anywhere into the picture, or a place the game would pick), the distortion of the level and the
// eight other works drawn by the level; "Sdílet můj Detail dne" gives the address of the quiz (/detail-dne/muj/?…).
import {
  drawPixels, effectSettings, effectStrength, effectStyle, gameFrame, gameLevels, gameLooks, gameShuffle, waveRipple,
} from '../../scripts/lib/detail-game.mjs';
import { levelFromParam } from '../../scripts/lib/detail-teaser.mjs';
import { QUIZ_SAFE, cropExcluded, quizWindows, quizCrop, quizEventParams, quizOffer, quizShareText, quizToParams, quizUrl } from '../../scripts/lib/my-quiz.mjs';
import { GAME_TWO_COLUMNS, skipHeaderScope, skipsHeader, startTop } from '../../scripts/lib/skip-header.mjs';
import { EVENTS, SHARE_COPY, SHARE_NATIVE, trackEvent } from '../../scripts/lib/analytics.mjs';

type Work = { id: string; title: string; sub: string; url: string; folder: string; widths: number[]; ratio: number };
type Crop = { x: number; y: number; size: number };
type Area = { x0: number; y0: number; x1: number; y1: number };
type Data = { author: string; works: Work[]; similar: Record<string, string[]>; picks: Record<string, Record<string, Crop[]>>; skips: Record<string, Area[]> };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const LEVELS = gameLevels();
const LOOKS = gameLooks();
const esc = (text: unknown) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export async function startQuizEditor(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector(`[data-${name}]`) as T;
  // the short texts from stranky/detail-dne.yaml (QUIZ_LINES), given by the page
  const texts = JSON.parse(root.dataset.texts ?? '{}') as Record<string, string>;
  const fail = (text: string) => { $('editor').hidden = true; $('problem').hidden = false; $('problem-text').textContent = text; };
  const id = new URLSearchParams(location.search).get('obraz') ?? '';
  let data: Data;
  try { data = await (await fetch(root.dataset.src as string)).json(); } catch { return fail(texts.editor_load_failed); }
  const byId = new Map(data.works.map((w) => [w.id, w]));
  const work = byId.get(id);
  if (!work) return fail(texts.editor_no_work);
  const areas = data.skips[work.id] ?? [];
  const src = (w: Work, largest: boolean) => `${BASE}/${w.folder}/${largest ? Math.max(...w.widths) : Math.min(...w.widths)}.webp`;
  const state = { level: levelFromParam(new URLSearchParams(location.search).get('uroven')) ?? LEVELS[0], crop: { x: 0.5, y: 0.5, size: LEVELS[0].size } as Crop, look: '', offer: [] as string[], pick: 0, seed: Math.random().toString(36).slice(2, 8) };
  const looksOf = () => LOOKS.filter((l) => l.level === state.level.id);
  const picks = () => (data.picks[state.level.id]?.[work.id] ?? []).filter((c) => !cropExcluded(c, work.ratio, areas));

  $('title').textContent = work.title;
  ($('work-link') as HTMLAnchorElement).href = work.url;
  ($('whole-img') as HTMLImageElement).src = src(work, true);
  ($('whole-img') as HTMLImageElement).alt = work.title;
  // the places kept out of the game, hatched over the picture
  $('skips').innerHTML = areas.map((a) => `<span class="skip" style="left:${a.x0 * 100}%;top:${a.y0 * 100}%;width:${(a.x1 - a.x0) * 100}%;height:${(a.y1 - a.y0) * 100}%"></span>`).join('');

  /**
   * A new level: its size around the same place (the very first time a place the game would pick, or the middle), its first
   * distortion, a new offer. A level never moves the place the visitor chose.
   */
  function setLevel(level: any, first = false) {
    state.level = level;
    state.pick = 0;
    const pick = first ? picks()[0] : undefined;
    state.crop = quizCrop(pick ? [pick.x, pick.y] : [state.crop.x, state.crop.y], level, work!.ratio);
    if (!looksOf().some((l) => l.id === state.look)) state.look = gameShuffle(looksOf().map((l) => l.id), Math.random)[0];
    state.offer = quizOffer({ workId: work!.id, level, similar: data.similar, seed: state.seed });
    render();
  }

  /** A window on the work like the stage of the game (its first try): the frame, the distortion, the mosaic, the wave. */
  function paint(box: HTMLElement, look: any) {
    const size = box.clientWidth || 300;
    const frame = gameFrame(state.crop, 0, state.level.guesses - 1, work!.ratio, state.level.lastView, QUIZ_SAFE);
    const style = effectStyle(look.effect, look.colour, effectStrength(0, state.level.guesses), effectSettings(), size);
    box.style.setProperty('--bleed', `${Math.max(12, Math.ceil(size * 0.08))}px`);
    const waveId = `wave-${box.dataset.window}`;
    box.innerHTML = `<svg width="0" height="0" class="filters" aria-hidden="true"><filter id="${waveId}" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="${waveRipple(size)}" numOctaves="2" seed="4" /><feDisplacementMap in="SourceGraphic" scale="${style.wave}" xChannelSelector="R" yChannelSelector="G" /></filter></svg>`
      + `<div class="clip" style="${style.mask ? `mask:${style.mask};-webkit-mask:${style.mask}` : ''}"><div class="view" style="filter:${style.filter.replace('#game-wave', `#${waveId}`)}"><img src="${src(work!, true)}" alt="" /><canvas class="pixels" hidden></canvas></div></div>`;
    const img = box.querySelector('img') as HTMLImageElement;
    const scale = 1 / (frame.size * Math.min(1, work!.ratio));
    img.style.transform = `translate(${size / 2 - frame.x * size * scale}px, ${size / 2 - frame.y * work!.ratio * size * scale}px) scale(${scale})`;
    if (style.pixels) {
      const canvas = box.querySelector('canvas') as HTMLCanvasElement;
      canvas.hidden = false;
      const draw = () => drawPixels(canvas, img, frame, style.pixels);
      if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
    }
  }

  function render() {
    const blocked = cropExcluded(state.crop, work!.ratio, areas);
    $('levels').innerHTML = LEVELS.map((l) => `<button type="button" class="level${l.id === state.level.id ? ' on' : ''}" data-pick-level="${l.id}" aria-pressed="${l.id === state.level.id}">${l.label}</button>`).join('');
    $('level-note').textContent = `Výřez ${Math.round(state.level.size * 100)} % kratší strany obrazu · ${state.level.guesses} pokusy${state.level.hints ? ' · po omylu nápověda' : ''}`;
    const w = state.crop.size * Math.min(1, work!.ratio);
    const h = state.crop.size * Math.min(1, 1 / work!.ratio);
    Object.assign($('frame').style, { left: `${(state.crop.x - w / 2) * 100}%`, top: `${(state.crop.y - h / 2) * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` });
    $('frame').classList.toggle('blocked', blocked);
    $('blocked').hidden = !blocked;
    ($('auto') as HTMLButtonElement).disabled = !picks().length;
    $('looks').innerHTML = looksOf().map((l) => `<button type="button" class="look${l.id === state.look ? ' on' : ''}" data-pick-look="${l.id}" aria-pressed="${l.id === state.look}"><span class="window" data-window="${l.id}"></span><span class="name">${esc(l.label)}</span></button>`).join('');
    $('look-note').textContent = LOOKS.find((l) => l.id === state.look)?.note ?? '';
    for (const { window, look } of quizWindows({ level: state.level.id, look: state.look })) {
      const box = root.querySelector<HTMLElement>(`[data-window="${window}"]`);
      if (box) paint(box, look);
    }
    $('offer').innerHTML = state.offer.map((o) => byId.get(o)).filter(Boolean).map((o) => `<img src="${src(o!, false)}" alt="" title="${esc(o!.title)}" />`).join('');
    const quiz = { workId: work!.id, level: state.level.id, x: state.crop.x, y: state.crop.y, look: state.look, offer: state.offer };
    const ready = !blocked && state.offer.length === 8;
    ($('share') as HTMLButtonElement).disabled = !ready;
    ($('play') as HTMLAnchorElement).href = ready ? `${BASE}/detail-dne/muj/?${quizToParams(quiz).toString()}` : '#';
    $('play').toggleAttribute('aria-disabled', !ready);
    $('address').hidden = true;
  }

  async function share() {
    const quiz = { workId: work!.id, level: state.level.id, x: state.crop.x, y: state.crop.y, look: state.look, offer: state.offer };
    const address = quizUrl(`${location.origin}${BASE}`, quiz);
    const params = { level: state.level, look: LOOKS.find((l) => l.id === state.look)!, workId: work!.id };
    const text = quizShareText({ level: state.level, author: data.author });
    const input = $('address') as HTMLInputElement;
    input.value = address;
    input.hidden = false;
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: 'Můj Detail dne', text, url: address });
        trackEvent(EVENTS.share, { method: SHARE_NATIVE, ...quizEventParams(params) });
      } else {
        await navigator.clipboard.writeText(address);
        $('share-status').textContent = texts.editor_copied;
        trackEvent(EVENTS.share, { method: SHARE_COPY, ...quizEventParams(params) });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { input.select(); $('share-status').textContent = texts.editor_copy_by_hand; }
    }
  }

  $('whole').addEventListener('click', (event) => {
    const box = ($('whole-img') as HTMLImageElement).getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
    state.crop = quizCrop([x, y], state.level, work!.ratio);
    render();
  });
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const level = target.closest('[data-pick-level]') as HTMLElement | null;
    if (level) setLevel(LEVELS.find((l) => l.id === level.dataset.pickLevel));
    const look = target.closest('[data-pick-look]') as HTMLElement | null;
    if (look) { state.look = look.dataset.pickLook as string; render(); }
    if (target.closest('[data-auto]')) {
      const list = picks();
      if (list.length) { state.pick = (state.pick + 1) % list.length; const c = list[state.pick]; state.crop = quizCrop([c.x, c.y], state.level, work!.ratio); render(); }
    }
    if (target.closest('[data-share]')) share();
    if (target.closest('[data-play]') && target.closest('[aria-disabled]')) event.preventDefault();
  });
  addEventListener('resize', () => requestAnimationFrame(render));
  $('editor').hidden = false;
  setLevel(state.level, true);
  // only once it is drawn (before that the page is too short to scroll): a fresh visit, and always on a phone, has the title of the
  // editor on top, as the game and the quiz (scripts/lib/skip-header.mjs)
  const phoneLike = !matchMedia(GAME_TWO_COLUMNS).matches || innerHeight < 700;
  const entry = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  const page = { path: location.pathname, scope: skipHeaderScope(location.pathname, BASE || '/'), hash: location.hash, navigation: entry?.type ?? '' };
  if (skipsHeader(page) || phoneLike) scrollTo({ top: startTop(root.getBoundingClientRect().top, scrollY, phoneLike) });
}
