// The cinema of a listing of works: the works of the listing (with its filters) one after another in the whole screen,
// in a random order, each for `interval` seconds, fading into the next; no controls until the mouse moves or a tap.
// The address keeps the listing, the work shown and a picked interval (?…&cinema=<id>&interval=45), so the same show
// can be sent as a link. Settings: site.config.yaml `cinema` (cinemaSettings). On the site: "▶ Promítat" of the
// gallery (src/components/WorkGallery.astro, Cinema.astro, src/lib/cinema.ts); the values were found in the
// prototype promitani.html (npm run prototypes, scripts/prototypes/cinema.html).
// The functions from cinemaFromParams on are self-contained (no helpers of this module): the prototype copies them as text.

import { ownText } from './rich-text.mjs';
import { summarize } from './seo.mjs';
import { VIEWER_TEXT_MAX } from './work-viewer.mjs';
import { AUTO, PALETTES } from './palettes.mjs';
import { isOnSale } from './works.mjs';
import { galleryFilterPath } from './gallery-filter.mjs';

/** The settings of the cinema when site.config.yaml leaves them out. */
export const CINEMA_DEFAULTS = {
  intervals: [5, 10, 15, 45, 180], // seconds a work stays, offered in the controls
  defaultInterval: 15, // one of them; never written to the address
  fadeMs: 1000, // the fade from one work to the next
  controlsMs: 3000, // how long the controls stay after the last move of the mouse or a tap
  captionMs: 4000, // captions "for a while" (the default): how long the caption of a work stays before it fades
  marginPercent: 0, // the paper around a work, % of the shorter side of the screen
  palette: 'noc', // the colours of the cinema (an id of PALETTES or auto), apart from those of the pages
  swipe: { fraction: 0.2, minPx: 50, flickPxPerMs: 0.5 }, // a step by a finger: far enough, or a quick flick
};

/** The settings of the cinema from site.config.yaml (`config.cinema`), with the defaults; a bad value is an error. */
export function cinemaSettings(config) {
  const own = config?.cinema ?? {};
  const s = { ...CINEMA_DEFAULTS, ...own, swipe: { ...CINEMA_DEFAULTS.swipe, ...(own.swipe ?? {}) } };
  const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!Array.isArray(s.intervals) || !s.intervals.length || !s.intervals.every((v) => Number.isInteger(v) && v > 0)) {
    throw new Error('site.config.yaml cinema.intervals: a list of whole seconds');
  }
  if (!s.intervals.includes(s.defaultInterval)) throw new Error('site.config.yaml cinema.defaultInterval: one of cinema.intervals');
  for (const k of ['fadeMs', 'controlsMs', 'captionMs']) if (!(Number.isInteger(s[k]) && s[k] >= 0)) throw new Error(`site.config.yaml cinema.${k}: whole milliseconds`);
  if (!(typeof s.marginPercent === 'number' && s.marginPercent >= 0 && s.marginPercent < 50)) throw new Error('site.config.yaml cinema.marginPercent: 0 to 50');
  if (!cinemaPalettes().some((p) => p.id === s.palette)) throw new Error(`site.config.yaml cinema.palette: one of ${cinemaPalettes().map((p) => p.id).join(', ')}`);
  for (const k of ['fraction', 'minPx', 'flickPxPerMs']) if (!positive(s.swipe[k])) throw new Error(`site.config.yaml cinema.swipe.${k}: a positive number`);
  return { ...s, intervals: [...s.intervals].sort((a, b) => a - b) };
}

/**
 * What the cinema needs of a work, as data-cinema of its card (JSON): the title, whether it is the author's selection
 * (`featured`), its sale (`sale`: the label of `statusLabel` for a work on sale, none otherwise), "technique · size · year", its text
 * (plain, shortened as in the viewer of a work), the address of its page (`url`), the folder of its pictures (`base`,
 * <base>/<width>.webp), their widths, the ratio height / width and whether it is cut out (transparent surroundings).
 */
export function cinemaCard(work, { url, base, size, statusLabel }) {
  return {
    title: work.title,
    featured: Boolean(work.featured),
    sale: isOnSale(work.status) ? statusLabel[work.status] : '',
    meta: [work.technique, size, work.year].filter(Boolean).join(' · '),
    text: summarize(ownText(work.text), VIEWER_TEXT_MAX),
    url,
    base,
    widths: work.image.widths,
    ratio: +(work.image.height / work.image.width).toFixed(4),
    cutout: Boolean(work.image.transparent),
  };
}

/**
 * Keys in localStorage: the captions picked (CAPTION_MODES), the interval and the colours of the cinema (its own,
 * never those of the pages); nothing stored = the defaults.
 */
export const CINEMA_STORAGE_KEYS = { captions: 'pavla.cinema.captions', interval: 'pavla.cinema.interval', palette: 'pavla.cinema.palette' };

/**
 * `?cinema=random`: the show starts with any work of the listing ("▶ Promítat", links); once a work is shown the address
 * names it instead.
 */
export const CINEMA_RANDOM = 'random';

/** The work a show opened by `id` starts with (null = any). */
export const cinemaFirst = (id) => (id === CINEMA_RANDOM ? null : id);

/** The show of the works on sale (the footer "Obrazy na prodej"), without the site base (url() adds it). */
export const saleShowPath = () => `${galleryFilterPath('status', 'unsold')}&cinema=${CINEMA_RANDOM}`;

/**
 * The hint on the first opening of the cinema in a tab (sessionStorage `CINEMA_HINT_KEY`, every new tab once more):
 * the controls and this line for `HINT_MS`. `touch` = a finger is the pointer (a phone, a tablet); `fullscreen` = opened
 * by a link where the browser could go to the whole screen: it may only after a click, a tap or a key, so the hint says
 * so (fullscreenHint; any key does, F is the one known from video players).
 */
export const CINEMA_HINT_KEY = 'pavla.cinema.hinted';
export const HINT_MS = 4000;
export function cinemaHint(touch, fullscreen = false) {
  const moves = touch ? 'tahem do stran listovat · dolů obraz · nahoru kolekce' : '← → listovat · ↓ obraz · ↑ kolekce';
  return fullscreen ? `${moves} · ${fullscreenHint(touch)}` : moves;
}

/** How to go to the whole screen; alone on every opening by a link once the whole hint was shown in the tab. */
export function fullscreenHint(touch) {
  return touch ? 'ťuknutí = celá obrazovka' : 'klik nebo F = celá obrazovka';
}

/**
 * How long the work shown stays when the visitor moves the mouse or swipes with `leftMs` to go: at least the shortest
 * interval offered, never less than it had (someone looking at it should not see it go at once).
 */
export function lingerMs(leftMs, settings) {
  return Math.max(leftMs, Math.min(...settings.intervals) * 1000);
}

/** The colours the cinema offers, in the order of its switch: every palette of the site, then "by the system". */
export function cinemaPalettes(palettes = PALETTES) {
  return [...palettes.map((p) => ({ id: p.id, label: p.label })), { id: AUTO, label: 'podle systému' }];
}

/** The colours of the cinema: the remembered ones (`stored`) when offered, otherwise the default of the settings. */
export function cinemaPalette(stored, settings, palettes = PALETTES) {
  return cinemaPalettes(palettes).some((p) => p.id === stored) ? stored : settings.palette;
}

/**
 * The captions of the works, in the order of their switch: `timed` = each for captionMs, then it fades (the default),
 * `on` = always, `off` = never; with the controls shown the caption is always there.
 */
export const CAPTION_MODES = ['timed', 'on', 'off'];

/** The captions mode remembered (`stored`, from localStorage), the default for none or an unknown one. */
export function captionMode(stored) {
  return ['timed', 'on', 'off'].includes(stored) ? stored : 'timed';
}

/**
 * The cinema in the address (URL search params): { id: the work shown or null, interval: an offered one }. The interval
 * of a link decides, then the one remembered (`stored`), then the default.
 */
export function cinemaFromParams(params, settings, stored = null) {
  const offered = (v) => settings.intervals.includes(Number(v)) && v !== null && v !== '';
  const linked = params.get('interval');
  return {
    id: params.get('cinema') || null,
    interval: offered(linked) ? Number(linked) : offered(stored) ? Number(stored) : settings.defaultInterval,
  };
}

/** The label of an interval in the controls: "15 s", "1 min", "3 min". */
export function intervalLabel(seconds) {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}

/** Writes the cinema into URL search `params` (id null = closed: both left out; the default interval left out). */
export function cinemaToParams(params, { id, interval }, settings) {
  params.delete('cinema');
  params.delete('interval');
  if (!id) return params;
  params.set('cinema', id);
  if (interval !== settings.defaultInterval) params.set('interval', String(interval));
  return params;
}

/**
 * The order of the show: every id once in a random order (`random` like Math.random), `first` at the start when it
 * is one of them. Stepping past the end starts the same order again.
 */
export function shuffledOrder(ids, first = null, random = Math.random) {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const at = order.indexOf(first);
  if (at > 0) order.unshift(...order.splice(at, 1));
  return order;
}

/** Index `i` of a show of `n` works, round and round (-1 = the last). */
export function wrapIndex(i, n) {
  return n ? ((i % n) + n) % n : 0;
}

/**
 * The step of a drag by (dx, dy) CSS px in `ms` over a screen `width` px wide: 1 = next (dragged to the left),
 * -1 = previous, 0 = back where it was (too short and too slow, or more up and down than sideways).
 */
export function dragStep(dx, dy, width, ms, swipe) {
  const ax = Math.abs(dx);
  if (ax <= Math.abs(dy) || ax < swipe.minPx) return 0;
  const far = ax >= width * swipe.fraction;
  const flick = ms > 0 && ax / ms >= swipe.flickPxPerMs;
  if (!far && !flick) return 0;
  return dx < 0 ? 1 : -1;
}

/** The size (CSS px) of a work of `ratio` (height / width) as large as fits a screen w × h with `marginPercent`. */
export function fitBox(ratio, w, h, marginPercent) {
  const margin = (Math.min(w, h) * marginPercent) / 100;
  const width = Math.max(0, Math.min(w - 2 * margin, (h - 2 * margin) / ratio));
  return { width, height: width * ratio };
}

/**
 * The files of a picture of the cinema in width `width` (<base>/<width>.<format>, as the pipeline makes them): AVIF for
 * the <source> the browser takes first (smallest), WebP as the next, JPEG for the <img> itself.
 */
export function cinemaSources(base, width) {
  return { avif: `${base}/${width}.avif`, webp: `${base}/${width}.webp`, jpg: `${base}/${width}.jpg` };
}

/** The smallest of the `widths` of a picture sharp at `cssWidth` CSS px on a screen of `dpr`; the largest when none is. */
export function imageWidth(widths, cssWidth, dpr = 1) {
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((w) => w >= cssWidth * dpr) ?? sorted[sorted.length - 1];
}
