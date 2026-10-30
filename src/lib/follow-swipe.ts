// A swipe that follows the finger (or the mouse): the picture shown moves with it and its neighbour slides in beside
// it, from the side it comes from. Let go far enough or with a quick flick (dragStep, site.config.yaml cinema.swipe)
// and the neighbour slides into its place, otherwise both slide back. Used by the cinema (src/lib/cinema.ts) and the
// viewer of a work page. Up and down moves are left alone (touch-action: pan-y on the surface keeps sideways ones here),
// unless `vertical` takes them: a finger (not the mouse) moved up or down far enough or with a flick. The picture moves
// up or down with the finger meanwhile (a hint where it leads) and slides back when nothing happens.
import { dragStep } from '../../scripts/lib/cinema.mjs';

type Dir = 1 | -1;
export interface FollowSwipe {
  /** Where the pointer is followed. */
  surface: HTMLElement;
  /** The element shown now: it moves with the finger. */
  shown: () => HTMLElement;
  /** The neighbour in `dir` (1 = next, from the right), ready and visible beside the shown one; null = none. */
  neighbour: (dir: Dir) => HTMLElement | null;
  /** The neighbour slid into place: from now on it is the one shown. */
  stepped: (dir: Dir) => void;
  /** Both slid back; `near` = the neighbour that was beside (to hide again). */
  settled?: (near: HTMLElement | null) => void;
  /** A drag began (the cinema stops its timer). */
  started?: () => void;
  /** A press without a move. */
  tapped?: (e: PointerEvent) => void;
  /**
   * A finger (or pen) moved up (1) or down (-1) far enough or with a flick (dragStep over the height); returns whether
   * it leads somewhere (false: the picture slides back).
   */
  vertical?: (dir: Dir) => boolean;
  /** A press to leave alone (on a button or a link). */
  ignore?: (e: PointerEvent) => boolean;
  swipe: { fraction: number; minPx: number; flickPxPerMs: number };
}

const SLIDE_MS = 280;
/** A move shorter than this (CSS px) is still a tap. */
const TAP_PX = 8;

const place = (el: HTMLElement, x: number, ms = 0, axis: 'X' | 'Y' = 'X') => {
  el.style.transition = ms ? `transform ${ms}ms ease-out` : 'none';
  el.style.transform = `translate${axis}(${x}px)`;
};
/** How much of a vertical move the picture follows: it hints, it does not leave. */
const UPRIGHT_FOLLOW = 0.6;
const unplace = (el: HTMLElement) => {
  el.style.transition = '';
  el.style.transform = '';
};

export function followSwipe(o: FollowSwipe): void {
  type Drag = { id: number; x: number; y: number; t: number; moving: boolean; upright: boolean; type: string; dir: Dir | 0; near: HTMLElement | null; here: HTMLElement };
  let drag: Drag | null = null;
  // the click that ends a swipe is no click on what lies under the finger
  let swallowClick = false;
  const slideMs = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : SLIDE_MS);

  o.surface.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || drag || o.ignore?.(e)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moving: false, upright: false, type: e.pointerType, dir: 0, near: null, here: o.shown() };
  });
  o.surface.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    // up or down: the picture follows the finger (a finger, and only when up and down lead somewhere)
    if (drag.upright) {
      if (o.vertical && drag.type !== 'mouse') place(drag.here, dy * UPRIGHT_FOLLOW, 0, 'Y');
      return;
    }
    if (!drag.moving) {
      // up or down first: no sideways drag any more, maybe a vertical swipe
      if (Math.abs(dy) >= TAP_PX && Math.abs(dy) > Math.abs(dx)) {
        drag.upright = true;
        if (o.vertical && drag.type !== 'mouse') { o.started?.(); place(drag.here, dy * UPRIGHT_FOLLOW, 0, 'Y'); }
        return;
      }
      if (Math.abs(dx) < TAP_PX || Math.abs(dx) <= Math.abs(dy)) return;
      drag.moving = true;
      try { o.surface.setPointerCapture(e.pointerId); } catch { /* the pointer is gone already */ }
      o.started?.();
    }
    const dir: Dir = dx < 0 ? 1 : -1;
    if (dir !== drag.dir) {
      if (drag.near) { unplace(drag.near); o.settled?.(drag.near); }
      drag.dir = dir;
      drag.near = o.neighbour(dir);
    }
    const width = innerWidth;
    // nothing on that side: the picture gives way only a little
    place(drag.here, drag.near ? dx : dx / 4);
    if (drag.near) place(drag.near, dx + dir * width);
  });
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.upright) {
      if (!o.vertical || d.type === 'mouse') return;
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 0);
      const up = cancelled ? 0 : dragStep(e.clientY - d.y, e.clientX - d.x, innerHeight, performance.now() - d.t, o.swipe);
      const ms = slideMs();
      if (up && o.vertical(up as Dir)) {
        // on its way out: it goes on in the direction of the finger; back to its place later (Back may bring the page
        // back as it was)
        place(d.here, -up * innerHeight * 0.5, ms, 'Y');
        setTimeout(() => unplace(d.here), 1000);
        return;
      }
      place(d.here, 0, ms, 'Y');
      setTimeout(() => { unplace(d.here); o.settled?.(null); }, ms);
      return;
    }
    if (!d.moving) {
      if (!cancelled) o.tapped?.(e);
      return;
    }
    swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
    const width = innerWidth;
    const s = cancelled ? 0 : dragStep(e.clientX - d.x, e.clientY - d.y, width, performance.now() - d.t, o.swipe);
    const ms = slideMs();
    if (s && s === d.dir && d.near) {
      const near = d.near;
      place(d.here, -s * width, ms);
      place(near, 0, ms);
      setTimeout(() => { unplace(d.here); unplace(near); o.stepped(s as Dir); }, ms);
    } else {
      place(d.here, 0, ms);
      if (d.near) place(d.near, (d.dir || 1) * width, ms);
      setTimeout(() => { unplace(d.here); if (d.near) unplace(d.near); o.settled?.(d.near); }, ms);
    }
  };
  o.surface.addEventListener('pointerup', (e) => end(e, false));
  o.surface.addEventListener('pointercancel', (e) => end(e, true));
  o.surface.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}
