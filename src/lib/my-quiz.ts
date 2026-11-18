// The player of a quiz of a visitor ("Můj Detail dne", /detail-dne/muj/; scripts/lib/my-quiz.mjs): one round of the game of one
// work in one level, from its address. The address is cleaned right after (the quiz and its round stay in sessionStorage, so a
// reload plays on); "Zkopírovat odkaz" gives it back. No drops, no series: the same stage, thumbnails and hints as the game
// (the pure functions of scripts/lib/detail-game.mjs and the look of src/styles/detail-game.css).
import {
  applyGuess, drawPixels, effectSettings, effectStrength, effectStyle, gameFrame, newRound, optionHtml, waveRipple, winTitle, withoutMotion,
} from '../../scripts/lib/detail-game.mjs';
import { QUIZ_EDITOR_PATH, QUIZ_PATH, QUIZ_SAFE, QUIZ_STORE, quizEventParams, quizFromParams, quizOnOpen, quizShareText, quizToParams, quizUrl, quizView } from '../../scripts/lib/my-quiz.mjs';
import { EVENTS, SHARE_COPY, SHARE_NATIVE, trackEvent } from '../../scripts/lib/analytics.mjs';

type Work = { id: string; title: string; sub: string; year: number; technique: string; collection: string; collectionTitle: string; text: string; url: string; folder: string; widths: number[]; ratio: number };
type Area = { x0: number; y0: number; x1: number; y1: number };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const esc = (text: unknown) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** The quiz kept for this tab: { params (the address of the quiz), round }. */
function stored(): { params: string; round: any } | null {
  try { return JSON.parse(sessionStorage.getItem(QUIZ_STORE) ?? 'null'); } catch { return null; }
}
function keep(value: { params: string; round: any }) {
  try { sessionStorage.setItem(QUIZ_STORE, JSON.stringify(value)); } catch { /* the round lasts as long as the page */ }
}

export async function startQuiz(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(name: string) => root.querySelector(`[data-${name}]`) as T;
  // the short texts from stranky/detail-dne.yaml (QUIZ_LINES), given by the page
  const texts = JSON.parse(root.dataset.texts ?? '{}') as Record<string, string>;
  // the address of the quiz: from the page's own address (then cleaned), else the one kept for this tab
  const own = new URLSearchParams(location.search);
  const open = quizOnOpen(own, stored());
  let params = open.params;
  if (open.fresh) {
    keep({ params, round: newRound() });
    try { history.replaceState(history.state, '', `${BASE}${QUIZ_PATH}`); } catch { /* opened from the disk */ }
  }
  const showInfo = (problem = '') => {
    $('info').hidden = false;
    $('quiz').hidden = true;
    if (problem) $('problem').textContent = problem;
  };
  if (!params) return showInfo();
  let data: { author: string; works: Work[]; skips: Record<string, Area[]> };
  try {
    data = await (await fetch(root.dataset.src as string)).json();
  } catch {
    return showInfo(texts.quiz_load_failed);
  }
  const byId = new Map(data.works.map((w) => [w.id, w]));
  const quiz = quizFromParams(new URLSearchParams(params), byId);
  if (!quiz) return showInfo(texts.quiz_broken);
  const work = byId.get(quiz.workId)!;
  const options = quiz.optionIds.map((id: string) => byId.get(id)!);
  const level = quiz.level;
  const areas = data.skips[work.id] ?? [];
  const view = quizView({ crop: quiz.crop, ratio: work.ratio, level, areas });
  const picture = (w: Work, largest: boolean) => `${BASE}/${w.folder}/${largest ? Math.max(...w.widths) : Math.min(...w.widths)}.webp`;
  const address = quizUrl(`${location.origin}${BASE}`, { workId: quiz.workId, level: level.id, x: quiz.crop.x, y: quiz.crop.y, look: quiz.look.id, offer: quiz.offer });
  let round = open.round ?? newRound();
  const misses = () => round.guesses.length - (round.solved ? 1 : 0);
  $('level').textContent = level.label;
  // the box at the end of a round: its text from stranky/detail-dne.yaml (quiz_drops_text), rendered by the page
  const dropsText = ($('drops-text') as unknown as HTMLTemplateElement | null)?.innerHTML.trim() ?? '';
  ($('make') as HTMLAnchorElement).href = `${BASE}${QUIZ_EDITOR_PATH}?obraz=${work.id}`;

  function place() {
    const stage = root.querySelector('.stage') as HTMLElement;
    const img = stage.querySelector('img') as HTMLImageElement;
    const size = stage.clientWidth;
    stage.style.setProperty('--bleed', `${Math.max(16, Math.ceil(size * 0.08))}px`);
    if (round.over) {
      const scale = 1 / Math.max(1, work.ratio);
      img.style.transform = `translate(${(size - size * scale) / 2}px, ${(size - size * work.ratio * scale) / 2}px) scale(${scale})`;
    } else {
      const frame = gameFrame(quiz.crop, round.guesses.length, level.guesses - 1, work.ratio, view, QUIZ_SAFE);
      const scale = 1 / (frame.size * Math.min(1, work.ratio));
      img.style.transform = `translate(${size / 2 - frame.x * size * scale}px, ${size / 2 - frame.y * work.ratio * size * scale}px) scale(${scale})`;
      const look = effectStyle(quiz.look.effect, quiz.look.colour, effectStrength(round.guesses.length, level.guesses, round.over), effectSettings(), size);
      const viewEl = stage.querySelector('.view') as HTMLElement;
      const clip = viewEl.parentElement as HTMLElement;
      viewEl.style.filter = look.filter;
      clip.style.mask = look.mask;
      clip.style.setProperty('-webkit-mask', look.mask);
      const canvas = stage.querySelector('.pixels') as HTMLCanvasElement;
      canvas.hidden = !look.pixels;
      if (look.pixels) {
        if (img.complete) drawPixels(canvas, img, frame, look.pixels);
        else img.addEventListener('load', () => drawPixels(canvas, img, frame, look.pixels), { once: true });
      }
      root.querySelector('[data-wave-map]')?.setAttribute('scale', String(look.wave));
      root.querySelector('[data-wave-ripple]')?.setAttribute('baseFrequency', waveRipple(size));
    }
    if (round.over) {
      const viewEl = stage.querySelector('.view') as HTMLElement;
      viewEl.style.filter = '';
      (viewEl.parentElement as HTMLElement).style.mask = '';
      (viewEl.parentElement as HTMLElement).style.setProperty('-webkit-mask', '');
      (stage.querySelector('.pixels') as HTMLCanvasElement).hidden = true;
    }
  }

  /** The look of the stage now (its frame, distortion and mask), where the next one moves from. */
  function stageNow() {
    const img = root.querySelector('.stage img') as HTMLImageElement | null;
    const view = root.querySelector('.stage .view') as HTMLElement | null;
    return img && view ? { transform: img.style.transform, filter: view.style.filter, mask: (view.parentElement as HTMLElement).style.mask } : null;
  }

  /**
   * Draws the round. The new picture never moves from the whole work to its close-up (that would show the work looked for): it
   * gets the stage `from` (the one before a guess) or its own at once, without transitions; only from `from` it then moves.
   */
  function render(from: ReturnType<typeof stageNow> = null) {
    const pips = Array.from({ length: level.guesses }, (_, i) => {
      const kind = i < misses() ? 'miss' : i === misses() && round.solved ? 'hit' : i === round.guesses.length && !round.over ? 'now' : 'left';
      return `<span class="pip ${kind}"></span>`;
    }).join('');
    const ask = round.over ? (round.solved ? winTitle(misses()) : 'Tenhle byl záludný') : 'Ze kterého obrazu je tento detail?';
    const tries = round.over ? `<span class="pips" aria-hidden="true">${pips}</span>` : `<span class="pips" aria-hidden="true">${pips}</span><b>Pokus ${round.guesses.length + 1} z ${level.guesses}</b> · ${esc(quiz.look.label)}`;
    const lastHint = round.hints[round.hints.length - 1];
    const hint = !level.hints ? '' : round.over ? `<p class="hint"><b>${esc(work.title)}</b></p>`
      : lastHint ? `<p class="hint"><b>Nápověda:</b> ${esc(lastHint)}</p>`
        : round.guesses.length ? '<p class="hint waiting">Tentokrát nápověda není, detail se aspoň oddálil.</p>' : '<p class="hint waiting">Po omylu přijde nápověda.</p>';
    const result = !round.over ? '' : `<div class="result ${round.solved ? 'won' : 'lost'}">
      <p class="verdict"><span class="sign" aria-hidden="true">${round.solved ? '✓' : '✗'}</span> ${round.solved ? winTitle(misses()) : 'Tentokrát ne <span class="gain">byl to tenhle obraz</span>'}</p>
      <h2>${esc(work.title)}</h2>
      <p class="sub">${esc(work.sub)}${work.year ? ` · ${work.year}` : ''}</p>
      ${work.text ? `<p class="text">${esc(work.text)}</p>` : ''}
      <div class="actions">
        <a class="action quiet" href="${work.url}" title="Prohlédnout obraz">Obraz</a>
        ${work.collection ? `<a class="action quiet" href="${BASE}/tvorba/kolekce/${work.collection}/" title="Kolekce ${esc(work.collectionTitle)}">Kolekce</a>` : ''}
      </div>
      ${dropsText ? `<div class="done">${dropsText}</div>` : ''}
    </div>`;
    $('content').innerHTML = `<div class="game">
      <div class="stage${round.over ? ' reveal' : ''}"><div class="clip"><div class="view"><img src="${picture(work, true)}" alt="${round.over ? esc(work.title) : 'Výřez z obrazu'}" /><canvas class="pixels" hidden></canvas></div></div>${round.over ? `<a class="whole-link" href="${work.url}" aria-label="Prohlédnout obraz ${esc(work.title)}" title="Prohlédnout obraz"></a>` : ''}</div>
      <div class="side">
        <div class="status${round.over ? (round.solved ? ' won' : ' lost') : ''}" aria-live="polite"><p class="ask">${ask}</p><p class="tries">${tries}</p>${hint}</div>
        <div class="options">${options.map((w: Work) => optionHtml({ work: w, src: picture(w, false), round, targetId: work.id })).join('')}</div>
        ${result}
      </div>
    </div>`;
    const img = root.querySelector('.stage img') as HTMLImageElement;
    const view = root.querySelector('.stage .view') as HTMLElement;
    const clip = view.parentElement as HTMLElement;
    withoutMotion([img, view], () => {
      if (!from) return place();
      img.style.transform = from.transform;
      view.style.filter = from.filter;
      clip.style.mask = from.mask;
      clip.style.setProperty('-webkit-mask', from.mask);
    });
    if (from) requestAnimationFrame(place);
  }

  function guess(id: string) {
    const before = round;
    round = applyGuess(round, { targetId: work.id }, options, id, level.guesses, level.hints);
    if (round === before) return;
    keep({ params, round });
    if (!before.guesses.length) trackEvent(EVENTS.gameStart, quizEventParams(quiz));
    if (round.over) trackEvent(EVENTS.gameEnd, quizEventParams(quiz, { solved: round.solved, misses: misses() }));
    render(stageNow());
  }

  async function copy(button: HTMLElement) {
    const text = quizShareText({ level, author: data.author });
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text, url: address });
        trackEvent(EVENTS.share, { method: SHARE_NATIVE, ...quizEventParams(quiz) });
      } else {
        await navigator.clipboard.writeText(address);
        button.textContent = texts.quiz_copied;
        trackEvent(EVENTS.share, { method: SHARE_COPY, ...quizEventParams(quiz) });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        ($('address') as HTMLInputElement).hidden = false;
        ($('address') as HTMLInputElement).value = address;
        ($('address') as HTMLInputElement).select();
      }
    }
  }

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const option = target.closest('button.option') as HTMLButtonElement | null;
    if (option && !option.disabled) guess(option.dataset.id as string);
    const share = target.closest('[data-copy]') as HTMLElement | null;
    if (share) copy(share);
  });
  addEventListener('resize', () => requestAnimationFrame(place));
  $('info').hidden = true;
  $('quiz').hidden = false;
  // the params of the page itself are its address now: the copy button gives them back
  params = quizToParams({ workId: quiz.workId, level: level.id, x: quiz.crop.x, y: quiz.crop.y, look: quiz.look.id, offer: quiz.offer }).toString();
  keep({ params, round });
  render();
}
