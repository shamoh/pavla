// The markup of the game Detail dne, the same on the page /detail-dne/ (src/pages/detail-dne/index.astro) and in its prototype
// (scripts/prototypes/detail-game.html, scripts/lib/prototypes.mjs): the script (src/lib/detail-game.ts, startGame) fills its
// [data-…] places, the look is src/styles/detail-game.css.

import { rulesHtml } from './detail-game.mjs';

/** The whole game: `src` = the address of its data (data-src; the prototype gives the data to startGame instead). */
export function gamePageHtml({ src = '' } = {}) {
  const attr = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<div class="detail-game"${src ? ` data-src="${attr(src)}"` : ''}>
  <svg width="0" height="0" class="filters" aria-hidden="true"><filter id="game-wave" x="0" y="0" width="100%" height="100%"><feTurbulence data-wave-ripple type="turbulence" baseFrequency="0.012 0.02" numOctaves="2" seed="4" /><feDisplacementMap data-wave-map in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
  <div class="top">
    <header class="game-head">
      <h1>Detail dne <span data-number></span></h1>
      <a class="stats" href="#pravidla" data-stats></a>
    </header>
    <div class="archive-bar" data-archive-bar hidden></div>
    <div class="levels" data-levels></div>
  </div>
  <div data-content><p class="empty">Připravuji dnešní detail…</p></div>
  <section class="shelf" id="archiv">
    <h2>Archiv</h2>
    <p class="note">Starší dny můžeš dohrát kdykoli, za poloviční kapky a bez vlivu na sérii. <span data-archive-room></span></p>
    <div data-archive></div>
  </section>
  <section class="shelf">
    <h2>Moje sbírka</h2>
    <p class="note">Každý uhodnutý obraz sem přibude, nejnovější první. Tečky pod ním jsou barvy detailů, podle kterých se hádal
      (z každého až tři, uhodnutý víckrát jich má víc).</p>
    <div class="collection" data-collection></div>
  </section>
  ${rulesHtml()}
  <section class="shelf diagnostics" data-diagnostics-section hidden>
    <h2>Diagnostika</h2>
    <p class="note">Jen na zkoušku hry: co je teď na obrazovce, aby šlo napsat, která hádanka a který krok je moc snadný nebo složitý.</p>
    <button class="action quiet copy" type="button" data-copy-diagnostics>Zkopírovat diagnostiku</button>
    <dl data-diagnostics></dl>
  </section>
</div>`;
}
