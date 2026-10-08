// Keeps a row of years on one line (scripts/lib/year-row.mjs): the years are the elements marked data-year-item="<year>"
// (newest first), the picked one has aria-current="page" or aria-pressed="true". The years that do not fit are hidden
// behind a control "2017–2003 ▾" placed after the last year; it unfolds them in place (the row then wraps) and folds
// them back ("▴ méně", class `open`: styled apart from the years, the arrow first and marked, no chip border; the
// arrow is the same "▾" turned upside down by CSS, so both look exactly alike).
// A picked hidden year starts the row unfolded. Without JavaScript the row just wraps.
import { hiddenYearsLabel, pickedIsHidden, visibleCount } from '../../scripts/lib/year-row.mjs';

/** Fits `row` to one line and keeps it fitted when its width changes; `toggleClass` styles the control. */
export function fitYearRow(row: HTMLElement, toggleClass = 'year-more') {
  const years = [...row.querySelectorAll<HTMLElement>('[data-year-item]')];
  if (years.length === 0) return;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = toggleClass;
  years.at(-1)!.after(toggle);
  const picked = () => years.findIndex((y) => y.getAttribute('aria-current') === 'page' || y.getAttribute('aria-pressed') === 'true');
  let open = false;
  let shown = years.length;

  /** Shows the first `k` years (all when unfolded) and the control for the rest. */
  const render = (k: number) => {
    row.classList.toggle('one-line', !open);
    years.forEach((y, i) => { y.hidden = !open && i >= k; });
    toggle.hidden = k >= years.length;
    const label = hiddenYearsLabel(years.slice(k).map((y) => y.dataset.yearItem));
    const arrow = (text: string) => Object.assign(document.createElement('span'), { className: 'arrow', textContent: text, ariaHidden: 'true' });
    toggle.classList.toggle('open', open);
    toggle.replaceChildren(...(open ? [arrow('▾'), ' méně'] : [`${label} `, arrow('▾')]));
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Skrýt starší roky' : `Starší roky ${label}`);
  };
  const fit = () => {
    const wasOpen = open;
    open = false;
    shown = visibleCount(years.length, (k) => { render(k); return row.scrollWidth <= row.clientWidth; });
    open = wasOpen;
    render(shown);
  };

  fit();
  if (pickedIsHidden(picked(), shown)) { open = true; render(shown); }
  toggle.addEventListener('click', () => {
    open = !open;
    if (open) render(shown);
    else fit();
  });
  // Refit when the row gets wider or narrower (window, rotation), only its width matters.
  let width = row.clientWidth;
  new ResizeObserver(() => {
    if (row.clientWidth === width) return;
    width = row.clientWidth;
    fit();
  }).observe(row);
}
