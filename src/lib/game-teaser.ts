// The game Detail dne on the home page (src/components/GameTeaser.astro, logic scripts/lib/detail-teaser.mjs): once the section
// comes near the screen, today's puzzles from /detail-dne/dnes.json drawn for the progress of this browser (GAME_STORE, read only).
// Without JavaScript, the file or today's day the section stays as built: a sentence and a link into the game.
import { GAME_STORE, drawPixels, gameDay } from '../../scripts/lib/detail-game.mjs';
import { teaserDoneHtml, teaserState, teaserStreakText, teaserTilesHtml, teaserWaveFilter } from '../../scripts/lib/detail-teaser.mjs';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export function startTeaser(root: HTMLElement) {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(GAME_STORE) ?? 'null') ?? {}; } catch { return {}; }
  };
  const box = root.querySelector('[data-teaser-tiles]') as HTMLElement;
  const filters = root.querySelector('[data-teaser-filters]') as SVGElement;
  let teaser: any = null;

  /** The windows are the window of the game (360 px) scaled to the width of a tile. */
  function fit() {
    const tile = box.querySelector('.teaser-window') as HTMLElement | null;
    if (tile) root.style.setProperty('--teaser-zoom', String(tile.clientWidth / 360));
  }

  function render() {
    const state = teaserState({ teaser, store: read(), today: gameDay(localDate(), teaser.epoch) });
    if (!state?.tiles.length) return;
    const options = { works: teaser.works, game: root.dataset.game as string, pictures: root.dataset.pictures as string };
    root.classList.toggle('done', state.done);
    (root.querySelector('[data-teaser-streak]') as HTMLElement).textContent = teaserStreakText(state.streak);
    if (state.done) {
      box.innerHTML = teaserDoneHtml(state, options);
    } else {
      const waves = new Set<number>();
      box.innerHTML = teaserTilesHtml(state, { ...options, waves });
      filters.innerHTML = [...waves].map(teaserWaveFilter).join('');
      for (const canvas of box.querySelectorAll<HTMLCanvasElement>('canvas[data-frame]')) {
        const img = canvas.previousElementSibling as HTMLImageElement;
        const draw = () => drawPixels(canvas, img, JSON.parse(canvas.dataset.frame as string), Number(canvas.dataset.blocks));
        if (img.complete && img.naturalWidth) draw();
        else img.addEventListener('load', draw, { once: true });
      }
    }
    root.classList.add('live');
    fit();
  }

  async function start() {
    try {
      const response = await fetch(root.dataset.src as string);
      if (!response.ok) return;
      teaser = await response.json();
    } catch {
      return;
    }
    render();
    addEventListener('resize', fit);
    // back from the game (the page kept by the browser) or a round played in another tab: the progress of now
    addEventListener('pageshow', (event) => { if (event.persisted) render(); });
    addEventListener('storage', (event) => { if (event.key === GAME_STORE) render(); });
  }

  // the big pictures of the windows only once the section comes near the screen
  if (!('IntersectionObserver' in window)) {
    start();
    return;
  }
  const watch = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    watch.disconnect();
    start();
  }, { rootMargin: '600px 0px' });
  watch.observe(root);
}
