// Browser side of the cinema (scripts/lib/cinema.mjs; markup and look src/components/Cinema.astro): the works of a
// listing one after another over the whole screen (Fullscreen API; opened by a link only after the first click, tap
// or key, a browser allows it no sooner; iPhone has none for pages, the window stays), in a random order, each for
// its interval, fading into the next. No controls until the mouse moves or a tap; then the collection on top, the
// intervals, pause, captions, colours, link and ×, the arrows on the sides; the caption of the work over its bottom is
// a link to its page. "Barvy: …" switches the colours of the cinema (its own, cinema.palette = Noc by default,
// remembered apart from those of the pages); "Celá obrazovka" while the browser has not gone to the whole screen by
// itself (opened by a link). The pictures are AVIF where the browser can (<picture>, cinemaSources), else WebP, else
// JPEG. Keys: ← → step, Space pause, ↓ the page of the work, ↑ its collection, S "Seznam" (the listing), L the heart of the favourites (src/lib/favorites.ts;
// also its button after the title in the caption), Esc closes. A finger (or the mouse)
// moves the work along and brings its neighbour (src/lib/follow-swipe.ts); a finger up = its collection, down = the
// page of the work, like ↑ ↓; two fingers pinched together = "Seznam", like S. The screen stays on while it runs
// (Screen Wake Lock). Where it is in the address, the
// history and the statistics of the show is up to the gallery (the hooks).
import { autoHide } from '../../scripts/lib/work-viewer.mjs';
import { CINEMA_STORAGE_KEYS, cinemaRunCounts, pinchedIn, captionMode, cinemaPalette, cinemaSources, fitBox, imageWidth, intervalLabel, lingerMs, CINEMA_HINT_KEY, HINT_MS, cinemaHint, fullscreenHint, shuffledOrder, wrapIndex } from '../../scripts/lib/cinema.mjs';
import { EVENTS, SHARE_COPY, SHARE_NATIVE, trackEvent } from '../../scripts/lib/analytics.mjs';
import { paletteEventParams } from '../../scripts/lib/palettes.mjs';
import { copiedText } from '../../scripts/lib/share.mjs';
import { keepTogether } from '../../scripts/lib/typography.mjs';
import { followSwipe } from './follow-swipe';
import { beat, onFavoritesChange, paintHearts, toggleStoredFavorite } from './favorites';

/** A work of the show: its id and collection (slug, '' without) with the data-cinema of its card (cinemaCard). */
export interface CinemaWork {
  id: string; collection: string; title: string; featured: boolean; sale: string; meta: string; text: string; url: string;
  base: string; widths: number[]; ratio: number; cutout: boolean;
}
export interface CinemaSettings {
  intervals: number[]; defaultInterval: number; fadeMs: number; controlsMs: number; captionMs: number; marginPercent: number; palette: string;
  swipe: { fraction: number; minPx: number; flickPxPerMs: number; pinch: number };
}
/**
 * How the show was closed or left (CINEMA_CLOSE_METHODS by reason): its button or link (button, click), a key, the end
 * of the whole screen, two fingers pinched together, a finger up or down.
 */
export type CloseMethod = 'button' | 'key' | 'fullscreen' | 'pinch' | 'click' | 'swipe';
type ListMethod = 'button' | 'key' | 'pinch';
/** What the statistics get of a run: how long, how many works, how many steps by a finger, and how it ended. */
export interface CinemaRun { ms: number; shown: number; swipes: number; keys: number; swipes_missed: number; method?: CloseMethod }

export interface CinemaHooks {
  /** A work shown or another interval picked (the address). */
  shown: (id: string, interval: number) => void;
  /**
   * Closed: why, the run (CinemaRun) and how it was asked for (`run.method`, none for Back); `leaving` = to another page
   * (a work, a collection, "Seznam" of a show of favourites), the page goes on.
   */
  closed: (reason: 'close' | 'back' | 'work' | 'collection' | 'list' | 'selection', run: CinemaRun, leaving: boolean) => void;
  /** The link of the show shared or copied. */
  shared: (method: string) => void;
  /**
   * "Seznam" (and the key S, two fingers pinched together): the works of the show (`ids`, in the order of the listing) as a listing, its address and
   * tooltip. An address on this page (the listing with its filters) closes the show; another ("Můj výběr" of a show of
   * favourites) leaves to it. Null or no hook = no "Seznam".
   */
  list?: (ids: string[]) => { href: string; title: string } | null;
}

const CAPTION_LABELS: Record<string, string> = { timed: 'Popisky: na chvíli', on: 'Popisky: stále', off: 'Popisky: skryté' };
const CAPTION_TITLES: Record<string, string> = {
  timed: 'Popisek každého obrazu na chvíli; klik = vždy',
  on: 'Popisek stále; klik = skrýt',
  off: 'Bez popisků (s ovládáním vidět); klik = na chvíli',
};

const storage = (key: string) => ({
  get: () => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (v: string | null) => { try { v === null ? localStorage.removeItem(key) : localStorage.setItem(key, v); } catch { /* ignore */ } },
});

export function createCinema(root: HTMLElement, settings: CinemaSettings, collections: Record<string, { title: string; url: string }>, hooks: CinemaHooks) {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const layers = [...root.querySelectorAll<HTMLElement>('.cinema-layer')];
  const caption = $<HTMLAnchorElement>('.cinema-caption');
  const toCollection = $<HTMLAnchorElement>('.cinema-collection');
  const toList = $<HTMLAnchorElement>('.cinema-list');
  const intervalsBox = $('.cinema-intervals');
  const pauseButton = $<HTMLButtonElement>('.cinema-pause');
  const captionsButton = $<HTMLButtonElement>('.cinema-captions');
  const toast = $('.cinema-toast');
  const captionsStore = storage(CINEMA_STORAGE_KEYS.captions);
  const intervalStore = storage(CINEMA_STORAGE_KEYS.interval);
  const paletteStore = storage(CINEMA_STORAGE_KEYS.palette);
  const palettes: { id: string; label: string }[] = JSON.parse(root.dataset.palettes!);
  const paletteButton = $<HTMLButtonElement>('.cinema-palette');
  const heartButton = $<HTMLButtonElement>('.cinema-heart');

  type Show = { works: CinemaWork[]; order: string[]; index: number; interval: number; paused: boolean; full: boolean; shown: number; counter: ReturnType<typeof cinemaRunCounts>; since: number };
  let show: Show | null = null;
  const byId = new Map<string, CinemaWork>();
  let cur = 0; // the layer shown
  let seq = 0; // the newest change of the picture; an older one still loading gives way
  let timer: ReturnType<typeof setTimeout> | undefined;
  let due = 0; // when the timer moves on to the next work (0 = no timer running)
  let inerted: HTMLElement[] = [];
  const work = (i: number) => byId.get(show!.order[wrapIndex(i, show!.order.length)])!;
  const fadeMs = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(settings.fadeMs, 200) : settings.fadeMs);

  const controls = autoHide((visible) => {
    root.classList.toggle('show', visible);
    root.classList.toggle('idle', !visible);
  }, { ms: settings.controlsMs });

  function say(text: string, ms = 2200) {
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout((say as any).timer);
    (say as any).timer = setTimeout(() => toast.classList.remove('on'), ms);
  }
  // the first opening in this tab: the controls and how to move on (cinemaHint) for a while, once; opened by a link
  // there is no whole screen yet (a browser allows it only after a click, a tap or a key): how to get it, every time
  const touch = () => matchMedia('(pointer: coarse)').matches;
  const fullscreenLater = () => Boolean(root.requestFullscreen) && !document.fullscreenElement;
  // where the show is for the hint (cinemaHint): `assumeFull` = it has just asked for the whole screen (the button)
  const screen = (assumeFull = false) => (!root.requestFullscreen ? '' : document.fullscreenElement || assumeFull ? 'full' : 'window');
  function hint(method: 'button' | 'link') {
    let first = false;
    try {
      first = !sessionStorage.getItem(CINEMA_HINT_KEY);
      sessionStorage.setItem(CINEMA_HINT_KEY, '1');
    } catch { /* storage blocked: no hint rather than one every time */ }
    if (first) showHint(method === 'button');
    else if (method === 'link' && fullscreenLater()) say(fullscreenHint(touch()), HINT_MS);
  }
  /** The whole hint with the controls, with how to go to the whole screen or out of it (cinemaHint). */
  function showHint(assumeFull = false) {
    controls.show();
    say(cinemaHint(touch(), screen(assumeFull)), HINT_MS);
  }

  // ---- pictures ----
  const box = (w: CinemaWork) => fitBox(w.ratio, innerWidth, root.clientHeight || innerHeight, settings.marginPercent);
  const sources = (w: CinemaWork, cssWidth: number) => cinemaSources(w.base, imageWidth(w.widths, cssWidth, devicePixelRatio || 1));
  /** The files of `files` in a <picture> (its two <source>s, then the <img>): the browser takes the first it can show. */
  function fillPicture(picture: HTMLPictureElement, files: ReturnType<typeof cinemaSources>) {
    const img = picture.querySelector('img')!;
    if (img.dataset.src === files.jpg) return img;
    const [avif, webp] = picture.querySelectorAll('source');
    avif.srcset = files.avif;
    webp.srcset = files.webp;
    img.src = files.jpg;
    img.dataset.src = files.jpg;
    return img;
  }
  /** Work `w` in `layer`, as large as fits the screen, in the width it needs; resolves once it can be shown. */
  function paint(layer: HTMLElement, w: CinemaWork) {
    const img = layer.querySelector('img')!;
    const { width, height } = box(w);
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.classList.toggle('cutout', w.cutout);
    img.alt = w.title;
    layer.dataset.id = w.id;
    fillPicture(layer.querySelector('picture')!, sources(w, width));
    return img.decode().catch(() => {});
  }
  // the neighbours loaded ahead, in the format the browser will pick (a <picture> of its own, never shown)
  const ahead = new Map<string, HTMLPictureElement>();
  function preload(i: number) {
    const w = work(i);
    if (ahead.has(w.id)) return;
    const picture = document.createElement('picture');
    picture.append(Object.assign(document.createElement('source'), { type: 'image/avif' }), Object.assign(document.createElement('source'), { type: 'image/webp' }), new Image());
    fillPicture(picture, sources(w, box(w).width));
    ahead.set(w.id, picture);
    if (ahead.size > 6) ahead.delete(ahead.keys().next().value!);
  }
  addEventListener('resize', () => { if (show) for (const l of layers) if (l.dataset.id) paint(l, byId.get(l.dataset.id)!); });

  // ---- captions: for a while (the default), always, never; with the controls always ----
  const captionsMode = () => captionMode(captionsStore.get());
  let captionTimer: ReturnType<typeof setTimeout> | undefined;
  function captionShown() {
    clearTimeout(captionTimer);
    root.classList.remove('cap-faded');
    if (captionsMode() === 'timed') captionTimer = setTimeout(() => root.classList.add('cap-faded'), settings.captionMs);
  }
  function applyCaptions() {
    const mode = captionsMode();
    for (const m of ['timed', 'on', 'off']) root.classList.toggle(`cap-${m}`, m === mode);
    captionsButton.textContent = CAPTION_LABELS[mode];
    captionsButton.title = CAPTION_TITLES[mode];
    captionShown();
  }
  captionsButton.addEventListener('click', () => {
    const modes = ['timed', 'on', 'off'];
    const next = modes[(modes.indexOf(captionsMode()) + 1) % modes.length];
    captionsStore.set(next === 'timed' ? null : next);
    applyCaptions();
  });
  // ---- colours: the cinema's own (data-palette on it), remembered apart from the pages ----
  function applyPalette() {
    const id = cinemaPalette(paletteStore.get(), settings);
    root.dataset.palette = id;
    const label = palettes.find((p) => p.id === id)?.label ?? id;
    paletteButton.textContent = `Barvy: ${label}`;
    paletteButton.title = `Barvy promítání (${palettes.map((p) => p.label).join(', ')}), jen pro promítání`;
  }
  paletteButton.addEventListener('click', () => {
    const at = palettes.findIndex((p) => p.id === root.dataset.palette);
    const next = palettes[(at + 1) % palettes.length].id;
    paletteStore.set(next === settings.palette ? null : next);
    applyPalette();
    trackEvent(EVENTS.palette, { ...paletteEventParams(next), source: 'cinema' });
  });
  applyPalette();

  function setCaption(w: CinemaWork) {
    $('.cinema-title').textContent = keepTogether(w.title);
    $('.cinema-star').hidden = !w.featured;
    $('.cinema-meta').textContent = w.meta;
    $('.cinema-sale').textContent = w.sale;
    $('.cinema-text').textContent = w.text;
    caption.href = w.url;
    caption.title = w.text;
    heartButton.dataset.heart = w.id;
    paintHearts(root);
    const c = collections[w.collection];
    toCollection.hidden = !c;
    if (c) {
      toCollection.href = c.url;
      $('.cinema-collection-title').textContent = keepTogether(c.title);
    }
    captionShown();
  }

  // ---- the heart of the favourites: its button in the caption (a link: the click stays here) and the key L ----
  function toggleHeart() {
    if (!show) return;
    const w = work(show.index);
    const added = toggleStoredFavorite(w.id, 'cinema', w.title);
    if (added) beat(heartButton);
    say(added ? '♥ Přidáno do oblíbených' : 'Odebráno z oblíbených');
    linger();
  }
  heartButton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleHeart(); });
  onFavoritesChange(() => paintHearts(root));

  // ---- the show ----
  function schedule(ms = show ? show.interval * 1000 : 0) {
    clearTimeout(timer);
    due = 0;
    if (!show || show.paused) return;
    due = Date.now() + ms;
    timer = setTimeout(() => { due = 0; step(1); }, ms);
  }
  /** Stops the timer; the time it had left. */
  function stopTimer() {
    clearTimeout(timer);
    const left = due ? due - Date.now() : 0;
    due = 0;
    return left;
  }
  // a move of the mouse or a tap: someone is looking, the work stays at least the shortest interval (lingerMs)
  function linger() {
    if (due && due - Date.now() < lingerMs(0, settings)) schedule(lingerMs(due - Date.now(), settings));
  }
  /** Shown: work `index` in the layer `layer` (after a fade or a swipe). */
  function landed(index: number) {
    show!.index = index;
    show!.shown++;
    setCaption(work(index));
    hooks.shown(work(index).id, show!.interval);
    preload(index + 1);
    preload(index - 1);
    schedule();
  }
  async function step(delta: number) {
    if (!show) return;
    const mine = ++seq;
    stopTimer();
    const index = wrapIndex(show.index + delta, show.order.length);
    const next = layers[1 - cur];
    await paint(next, work(index));
    if (mine !== seq || !show) return;
    const prev = layers[cur];
    for (const l of [prev, next]) l.style.transition = `opacity ${fadeMs()}ms ease`;
    next.classList.add('current');
    prev.classList.remove('current');
    cur = 1 - cur;
    landed(index);
  }

  // ---- the whole screen and the screen kept on ----
  function fullscreen() {
    if (!show || document.fullscreenElement || !root.requestFullscreen) return;
    root.requestFullscreen().then(() => { if (show) show.full = true; renderFullscreen(); }).catch(() => {});
  }
  // "Celá obrazovka": only while the browser could go to the whole screen and has not (iPhone has no such thing)
  // F (f or F, any layout that types it): in and out of the whole screen; out by F the show goes on in the window
  function toggleFullscreen() {
    if (!show) return;
    if (!document.fullscreenElement) { fullscreen(); return; }
    show.full = false;
    document.exitFullscreen().catch(() => {});
  }
  const fullscreenButton = $<HTMLButtonElement>('.cinema-fullscreen');
  const renderFullscreen = () => { fullscreenButton.hidden = !root.requestFullscreen || Boolean(document.fullscreenElement); };
  fullscreenButton.addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', () => {
    renderFullscreen();
    // leaving the whole screen (Esc, the browser) closes the cinema too
    if (!document.fullscreenElement && show?.full) close('close', 'fullscreen');
  });
  let wake: { release: () => Promise<void> } | null = null;
  async function lock() {
    if (!show || show.paused || wake || !('wakeLock' in navigator)) return;
    try {
      const sentinel = await (navigator as any).wakeLock.request('screen');
      wake = sentinel;
      sentinel.addEventListener('release', () => { wake = null; });
    } catch { /* not allowed (no secure context, battery saver) */ }
  }
  function release() { wake?.release().catch(() => {}); wake = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lock(); });

  // ---- controls ----
  function renderIntervals() {
    intervalsBox.replaceChildren(...settings.intervals.map((v) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: intervalLabel(v) });
      b.title = `Každý obraz ${intervalLabel(v)}`;
      b.setAttribute('aria-pressed', String(Boolean(show && v === show.interval && !show.paused)));
      b.addEventListener('click', () => {
        if (!show) return;
        show.interval = v;
        show.paused = false;
        // remembered for the next show; a link with its own interval still decides
        intervalStore.set(v === settings.defaultInterval ? null : String(v));
        renderIntervals();
        renderPause();
        hooks.shown(work(show.index).id, v);
        lock();
        schedule();
      });
      return b;
    }));
  }
  function renderPause() {
    const paused = Boolean(show?.paused);
    pauseButton.textContent = paused ? '▶' : '❚❚';
    pauseButton.setAttribute('aria-label', paused ? 'Pokračovat (mezerník)' : 'Pozastavit (mezerník)');
    pauseButton.title = pauseButton.getAttribute('aria-label')!;
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  function togglePause() {
    if (!show) return;
    show.paused = !show.paused;
    renderPause();
    renderIntervals();
    if (show.paused) release(); else lock();
    schedule();
    say(show.paused ? 'Pozastaveno' : `Dál po ${intervalLabel(show.interval)}`);
  }
  pauseButton.addEventListener('click', togglePause);
  // the address of the show (the whole screen shows no address bar): the share sheet of a phone, else copied
  $('.cinema-share').addEventListener('click', async () => {
    const url = location.href;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: document.title, url }); hooks.shared(SHARE_NATIVE); } catch { /* closed */ }
      return;
    }
    let ok = true;
    try { await navigator.clipboard.writeText(url); } catch { ok = false; }
    if (ok) hooks.shared(SHARE_COPY);
    say(copiedText(ok, url, 'Odkaz'));
  });
  // "?" in the controls (a phone has no keys) and the key ?: the hint again
  $('.cinema-help').addEventListener('click', () => showHint());
  $('.cinema-close').addEventListener('click', () => close('close', 'button'));
  $('.cinema-prev').addEventListener('click', () => step(-1));
  $('.cinema-next').addEventListener('click', () => step(1));
  // leaving to the page of the work or its collection: the address keeps the show, Back returns to it
  caption.addEventListener('click', () => leave('work', 'click'));
  toCollection.addEventListener('click', () => leave('collection', 'click'));
  // "Seznam" (the key S): the works of the show as a listing (hooks.list), again after every heart (the key L too);
  // with a modifier key the browser opens the link elsewhere and the show goes on
  toList.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    toListing('button');
  });
  function renderList() {
    const list = show && hooks.list ? hooks.list(show.works.map((w) => w.id)) : null;
    toList.hidden = !list;
    if (list) {
      toList.href = list.href;
      toList.title = `${list.title} (S)`;
    } else {
      toList.removeAttribute('href');
    }
  }
  onFavoritesChange(renderList);
  /** The listing of "Seznam": this page = the show closes, another = it leaves to it; false without "Seznam". */
  function toListing(method: ListMethod) {
    if (!show || toList.hidden) return false;
    const target = new URL(toList.href, location.href);
    if (target.pathname === location.pathname) {
      close('list', method);
      return true;
    }
    // the only listing on another page: "Můj výběr" of a show of favourites
    leave('selection', method);
    location.assign(target.href);

    return true;
  }
  /** The run so far for the statistics, `method` = how it ends. */
  const runOf = (s: Show, method?: CloseMethod): CinemaRun => ({ ms: Date.now() - s.since, shown: s.shown, ...s.counter.counts, ...(method ? { method } : {}) });
  function leave(reason: 'work' | 'collection' | 'selection', method: CloseMethod) {
    if (show) hooks.closed(reason, runOf(show, method), true);
  }
  // ↓ or a finger down: the page of the work; ↑ or a finger up: its collection (none: it says so); whether it leaves
  function toWork(method: 'key' | 'swipe') {
    if (!show) return false;
    leave('work', method);
    location.assign(work(show.index).url);
    return true;
  }
  function toItsCollection(method: 'key' | 'swipe') {
    if (!show) return false;
    const c = collections[work(show.index).collection];
    if (!c) { say('Obraz není v žádné kolekci'); return false; }
    leave('collection', method);
    location.assign(c.url);
    return true;
  }
  // two fingers pinched together (like closing a photo of a phone gallery, pinchedIn) = "Seznam"; not on a zoomed page,
  // where a pinch zooms out (the cinema leaves zooming in to the browser: touch-action: pinch-zoom). Touch events, not
  // pointers: a browser may take two fingers for zooming and cancel their pointers (follow-swipe lets go of them).
  let pinch: { start: number; last: number } | null = null;
  const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const zoomed = () => (window.visualViewport?.scale ?? 1) > 1.01;
  root.addEventListener('touchstart', (e) => {
    // the second finger starts a pinch; one alone or a third = none
    pinch = show && e.touches.length === 2 && !zoomed() ? { start: spread(e.touches), last: spread(e.touches) } : null;
  }, { passive: true });
  root.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) pinch.last = spread(e.touches); }, { passive: true });
  root.addEventListener('touchend', () => {
    if (!pinch) return;
    const p = pinch;
    pinch = null;
    if (!zoomed() && pinchedIn(p.start, p.last, settings.swipe)) toListing('pinch');
  }, { passive: true });
  root.addEventListener('touchcancel', () => { pinch = null; }, { passive: true });
  for (const el of root.querySelectorAll<HTMLElement>('.cinema-controls, .cinema-caption')) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') controls.hold(true); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') controls.hold(false); });
  }
  root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && show) { controls.show(); linger(); } });
  document.addEventListener('keydown', (e) => {
    if (!show) return;
    if (e.key === 'Escape') { close('close', 'key'); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (e.key === ' ' && !target?.closest('button, a')) { e.preventDefault(); togglePause(); fullscreen(); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); return; }
    if (e.key === '?') { e.preventDefault(); showHint(); return; }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); toggleHeart(); return; }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); toListing('key'); return; }
    const act: Record<string, () => void> = {
      // steps by keys are counted (cinemaRunCounts), those by ‹ › not
      ArrowLeft: () => { show!.counter.stepped('key'); step(-1); },
      ArrowRight: () => { show!.counter.stepped('key'); step(1); },
      ArrowDown: () => toWork('key'),
      ArrowUp: () => toItsCollection('key'),
    };
    if (act[e.key]) { e.preventDefault(); act[e.key](); }
    fullscreen();
  });

  let swipeLeft = 0; // the time the timer had left when a swipe began
  followSwipe({
    surface: root,
    shown: () => layers[cur],
    neighbour: (dir) => {
      if (!show || show.order.length < 2) return null;
      const near = layers[1 - cur];
      seq++; // a fade on its way gives way to the finger
      paint(near, work(show.index + dir));
      near.style.transition = 'none';
      near.style.opacity = '1';
      return near;
    },
    stepped: (dir, pointerType) => {
      // a step by a finger (not the mouse) for the statistics
      show!.counter.stepped(pointerType);
      const here = layers[cur];
      const near = layers[1 - cur];
      here.style.transition = 'none';
      here.classList.remove('current');
      near.style.opacity = '';
      near.classList.add('current');
      cur = 1 - cur;
      landed(wrapIndex(show!.index + dir, show!.order.length));
    },
    // a swipe that slid back: the time left, at least the shortest interval
    settled: (near) => { if (near) near.style.opacity = ''; schedule(lingerMs(swipeLeft, settings)); },
    started: () => { swipeLeft = stopTimer(); },
    // a finger swipe that slid back: is the threshold swipe.fraction right? (cinema_close swipes_missed)
    missed: (pointerType) => show?.counter.missed(pointerType),
    tapped: (e) => {
      linger();
      // a tap: the controls on, the next tap off (a mouse shows them by moving)
      if (e.pointerType === 'mouse') controls.show(); else controls.toggle();
      fullscreen();
    },
    vertical: (dir) => (dir > 0 ? toItsCollection('swipe') : toWork('swipe')),
    ignore: (e) => Boolean((e.target as HTMLElement).closest('button, a')),
    swipe: settings.swipe,
  });

  // ---- open and close ----
  function open(works: CinemaWork[], firstId: string | null, interval: number, method: 'button' | 'link') {
    if (!works.length) return false;
    byId.clear();
    ahead.clear();
    for (const w of works) byId.set(w.id, w);
    const ids = works.map((w) => w.id);
    show = { works, order: shuffledOrder(ids, firstId), index: 0, interval, paused: false, full: false, shown: 1, counter: cinemaRunCounts(), since: Date.now() };
    // over everything: the rest of the page is out of reach (keyboard, screen readers) while it runs
    document.body.append(root);
    inerted = [...document.body.children].filter((el): el is HTMLElement => el !== root && el instanceof HTMLElement && !el.inert);
    for (const el of inerted) el.inert = true;
    document.documentElement.classList.add('cinema-open');
    root.hidden = false;
    for (const l of layers) { l.classList.remove('current'); l.style.transition = 'none'; delete l.dataset.id; }
    cur = 0;
    layers[0].classList.add('current');
    paint(layers[0], work(0));
    setCaption(work(0));
    applyCaptions();
    renderIntervals();
    renderPause();
    renderFullscreen();
    renderList();
    controls.hide();
    root.focus({ preventScroll: true });
    if (method === 'button') fullscreen();
    preload(1);
    preload(-1);
    lock();
    schedule();
    hint(method);
    return true;
  }
  /** Closed here: `method` = how (none for Back, which comes from the gallery). */
  function close(reason: 'close' | 'back' | 'list', method?: CloseMethod) {
    if (!show) return;
    const run = runOf(show, method);
    show = null;
    seq++;
    stopTimer();
    clearTimeout(captionTimer);
    root.hidden = true;
    document.documentElement.classList.remove('cinema-open');
    for (const el of inerted) el.inert = false;
    inerted = [];
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    release();
    hooks.closed(reason, run, false);
  }
  return {
    open,
    close,
    get isOpen() { return show !== null; },
    get current() { return show ? work(show.index).id : null; },
  };
}
