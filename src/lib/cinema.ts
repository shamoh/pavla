// Browser side of the cinema (scripts/lib/cinema.mjs; markup and look src/components/Cinema.astro): the works of a
// listing one after another over the whole screen (Fullscreen API; opened by a link only after the first click, tap
// or key, a browser allows it no sooner; iPhone has none for pages, the window stays), in a random order, each for
// its interval, fading into the next. No controls until the mouse moves or a tap; then the collection on top, the
// intervals, pause, captions, link and ×, the arrows on the sides; the caption of the work over its bottom is a link
// to its page; "Celá obrazovka" while the browser has not gone to the whole screen by itself (opened by a link).
// The pictures are AVIF where the browser can (<picture>, cinemaSources), else WebP, else JPEG. Keys: ← → step, Space pause, ↓ the page of the work, ↑ its collection, Esc closes. A finger (or the
// mouse) moves the work along and brings its neighbour (src/lib/follow-swipe.ts). The screen stays on while it runs
// (Screen Wake Lock). Where it is in the address, the history and the statistics is up to the gallery (the hooks).
import { autoHide } from '../../scripts/lib/work-viewer.mjs';
import { CINEMA_STORAGE_KEYS, captionMode, cinemaSources, fitBox, imageWidth, intervalLabel, shuffledOrder, wrapIndex } from '../../scripts/lib/cinema.mjs';
import { SHARE_COPY, SHARE_NATIVE } from '../../scripts/lib/analytics.mjs';
import { copiedText } from '../../scripts/lib/share.mjs';
import { followSwipe } from './follow-swipe';

/** A work of the show: its id and collection (slug, '' without) with the data-cinema of its card (cinemaCard). */
export interface CinemaWork {
  id: string; collection: string; title: string; meta: string; text: string; url: string;
  base: string; widths: number[]; ratio: number; cutout: boolean;
}
export interface CinemaSettings {
  intervals: number[]; defaultInterval: number; fadeMs: number; controlsMs: number; captionMs: number; marginPercent: number;
  swipe: { fraction: number; minPx: number; flickPxPerMs: number };
}
export interface CinemaHooks {
  /** A work shown or another interval picked (the address). */
  shown: (id: string, interval: number) => void;
  /** Closed: why, how long it ran and how many works it showed. Leaving to a work or a collection, the page goes on. */
  closed: (reason: 'button' | 'esc' | 'back' | 'work' | 'collection', run: { ms: number; shown: number }) => void;
  /** The link of the show shared or copied. */
  shared: (method: string) => void;
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
  const intervalsBox = $('.cinema-intervals');
  const pauseButton = $<HTMLButtonElement>('.cinema-pause');
  const captionsButton = $<HTMLButtonElement>('.cinema-captions');
  const toast = $('.cinema-toast');
  const captionsStore = storage(CINEMA_STORAGE_KEYS.captions);
  const intervalStore = storage(CINEMA_STORAGE_KEYS.interval);

  type Show = { works: CinemaWork[]; order: string[]; index: number; interval: number; paused: boolean; full: boolean; shown: number; since: number };
  let show: Show | null = null;
  const byId = new Map<string, CinemaWork>();
  let cur = 0; // the layer shown
  let seq = 0; // the newest change of the picture; an older one still loading gives way
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inerted: HTMLElement[] = [];
  const work = (i: number) => byId.get(show!.order[wrapIndex(i, show!.order.length)])!;
  const fadeMs = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(settings.fadeMs, 200) : settings.fadeMs);

  const controls = autoHide((visible) => {
    root.classList.toggle('show', visible);
    root.classList.toggle('idle', !visible);
  }, { ms: settings.controlsMs });

  function say(text: string) {
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout((say as any).timer);
    (say as any).timer = setTimeout(() => toast.classList.remove('on'), 2200);
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
  function setCaption(w: CinemaWork) {
    $('.cinema-title').textContent = w.title;
    $('.cinema-meta').textContent = w.meta;
    $('.cinema-text').textContent = w.text;
    caption.href = w.url;
    caption.title = w.text;
    const c = collections[w.collection];
    toCollection.hidden = !c;
    if (c) {
      toCollection.href = c.url;
      $('.cinema-collection-title').textContent = c.title;
    }
    captionShown();
  }

  // ---- the show ----
  function schedule() {
    clearTimeout(timer);
    if (show && !show.paused) timer = setTimeout(() => step(1), show.interval * 1000);
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
    clearTimeout(timer);
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
  const fullscreenButton = $<HTMLButtonElement>('.cinema-fullscreen');
  const renderFullscreen = () => { fullscreenButton.hidden = !root.requestFullscreen || Boolean(document.fullscreenElement); };
  fullscreenButton.addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', () => {
    renderFullscreen();
    // leaving the whole screen (Esc, the browser) closes the cinema too
    if (!document.fullscreenElement && show?.full) close('esc');
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
  $('.cinema-close').addEventListener('click', () => close('button'));
  $('.cinema-prev').addEventListener('click', () => step(-1));
  $('.cinema-next').addEventListener('click', () => step(1));
  // leaving to the page of the work or its collection: the address keeps the show, Back returns to it
  caption.addEventListener('click', () => leave('work'));
  toCollection.addEventListener('click', () => leave('collection'));
  function leave(reason: 'work' | 'collection') {
    if (show) hooks.closed(reason, { ms: Date.now() - show.since, shown: show.shown });
  }
  for (const el of root.querySelectorAll<HTMLElement>('.cinema-controls, .cinema-caption')) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') controls.hold(true); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') controls.hold(false); });
  }
  root.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && show) controls.show(); });
  document.addEventListener('keydown', (e) => {
    if (!show) return;
    if (e.key === 'Escape') { close('esc'); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (e.key === ' ' && !target?.closest('button, a')) { e.preventDefault(); togglePause(); fullscreen(); return; }
    const w = work(show.index);
    const act: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      ArrowDown: () => { leave('work'); location.assign(w.url); },
      ArrowUp: () => { const c = collections[w.collection]; if (c) { leave('collection'); location.assign(c.url); } },
    };
    if (act[e.key]) { e.preventDefault(); act[e.key](); }
    fullscreen();
  });

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
    stepped: (dir) => {
      const here = layers[cur];
      const near = layers[1 - cur];
      here.style.transition = 'none';
      here.classList.remove('current');
      near.style.opacity = '';
      near.classList.add('current');
      cur = 1 - cur;
      landed(wrapIndex(show!.index + dir, show!.order.length));
    },
    settled: (near) => { if (near) near.style.opacity = ''; schedule(); },
    started: () => clearTimeout(timer),
    tapped: (e) => {
      // a tap: the controls on, the next tap off (a mouse shows them by moving)
      if (e.pointerType === 'mouse') controls.show(); else controls.toggle();
      fullscreen();
    },
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
    show = { works, order: shuffledOrder(ids, firstId), index: 0, interval, paused: false, full: false, shown: 1, since: Date.now() };
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
    controls.hide();
    root.focus({ preventScroll: true });
    if (method === 'button') fullscreen();
    preload(1);
    preload(-1);
    lock();
    schedule();
    return true;
  }
  function close(reason: 'button' | 'esc' | 'back') {
    if (!show) return;
    const run = { ms: Date.now() - show.since, shown: show.shown };
    show = null;
    seq++;
    clearTimeout(timer);
    clearTimeout(captionTimer);
    root.hidden = true;
    document.documentElement.classList.remove('cinema-open');
    for (const el of inerted) el.inert = false;
    inerted = [];
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    release();
    hooks.closed(reason, run);
  }
  return {
    open,
    close,
    get isOpen() { return show !== null; },
    get current() { return show ? work(show.index).id : null; },
  };
}
