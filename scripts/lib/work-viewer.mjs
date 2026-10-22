// Addresses of the pictures in the viewer of a work page: /tvorba/<year>/<slug>-<id>/#<view>, where <view> is
// "obraz" (the work itself), "detail-<detail name>" or "mockup-<scene>". A link with it opens that picture directly;
// an unknown one leaves the page as it is and drops the hash.

import { ownText } from './rich-text.mjs';
import { summarize } from './seo.mjs';

/** The view of the work itself. */
export const MAIN_VIEW = 'obraz';

/** Id of a view in the viewer: { kind: 'main' } | { kind: 'detail' | 'mockup', name } (name = slug of the file). */
export const viewId = ({ kind, name }) => (kind === 'main' ? MAIN_VIEW : `${kind}-${name}`);

/** The id a location hash names ("#detail-oci" → "detail-oci"), '' without one or when it cannot be decoded. */
export function hashId(hash) {
  try {
    return decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  } catch {
    return '';
  }
}

/** Index in `ids` (view ids in the order of the viewer) of the view a location hash names, or -1. */
export function viewIndex(hash, ids) {
  const id = hashId(hash);
  return id ? ids.indexOf(id) : -1;
}

/** Heading of the mockups on a work page: a work on sale could hang at the visitor's, any other on some wall. */
export const mockupsHeading = (onSale) => (onSale ? 'Jak by mohl vypadat u vás' : 'Jak by mohl vypadat na zdi');

/** Note under the mockups: they are pictures made up, the work itself is sold and kept without a frame. */
export const MOCKUPS_NOTE = 'Vizualizace – rám je jen pro představu.';

/** What a mockup shows, under it, in the viewer and in its alt: "<label of the scene> (vizualizace)". */
export const mockupCaption = (label) => `${label} (vizualizace)`;

/** Longest text of the work in the caption of the viewer: a long one would push the picture off the screen. */
export const VIEWER_TEXT_MAX = 240;

/** Caption of the work itself in the viewer: "<title> · <its text, plain and shortened>", the title alone without text. */
export function workCaption(work) {
  const text = summarize(ownText(work.text), VIEWER_TEXT_MAX);
  return text ? `${work.title} · ${text}` : work.title;
}

/** Minimum horizontal move (CSS px) of a swipe in the viewer. */
export const SWIPE_PX = 50;

/**
 * Step of a swipe from a pointer moved by (dx, dy): 1 = next (moved to the left), -1 = previous, 0 = no swipe
 * (too short, or more up and down than sideways).
 */
export function swipeStep(dx, dy, min = SWIPE_PX) {
  if (Math.abs(dx) < min || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** How long the arrows of the viewer stay after the last move of the mouse or a tap (ms). */
export const CONTROLS_MS = 3000;

/**
 * Controls that show for a while and then fade: show() shows them for `ms` again, hold(true) keeps them while the
 * pointer is over one, hide() hides them now, toggle() = a tap on the picture. `setVisible(bool)` applies the state;
 * the timer functions can be replaced (tests).
 */
export function autoHide(setVisible, { ms = CONTROLS_MS, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null;
  let held = false;
  let visible = false;
  const set = (v) => {
    if (v !== visible) setVisible(v);
    visible = v;
  };
  const stop = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const arm = () => {
    stop();
    if (!held) timer = setTimer(() => { timer = null; set(false); }, ms);
  };
  const controls = {
    get visible() { return visible; },
    show() { set(true); arm(); },
    hold(on) {
      held = on;
      if (on) set(true);
      arm();
    },
    hide() {
      held = false;
      stop();
      set(false);
    },
    toggle() { if (visible) controls.hide(); else controls.show(); },
  };
  return controls;
}
