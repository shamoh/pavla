// The page links of a paged listing (the gallery, the collections overview), drawn into the <nav> of Pager.astro:
// "← Předchozí", the page numbers with gaps (pageLinks), "Další →" and "Zobrazit vše (N)"; with paging off only
// "Zobrazit po stránkách". Every link is a real URL (`href(page)`), so it opens in a new tab too; a listing handles
// plain clicks itself (data-page on each link).
import { ALL_PAGES, pageLinks } from '../../scripts/lib/gallery-filter.mjs';

type Page = number | typeof ALL_PAGES;

/** Draws the links for `page` of `pages` (`total` items); hidden with fewer than two pages. */
export function renderPager(pager: HTMLElement, page: Page, pages: number, total: number, href: (page: Page) => string) {
  pager.hidden = pages < 2;
  pager.replaceChildren();
  if (pages < 2) return;
  const link = (label: string, to: Page, attrs: Record<string, string> = {}) => {
    const a = document.createElement('a');
    a.href = href(to);
    a.textContent = label;
    a.dataset.page = String(to);
    for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v);
    return a;
  };
  const gap = () => Object.assign(document.createElement('span'), { textContent: '…', className: 'gap' });
  if (page === ALL_PAGES) {
    pager.append(link('Zobrazit po stránkách', 1, { class: 'mode' }));
    return;
  }
  if (page > 1) pager.append(link('← Předchozí', page - 1, { rel: 'prev', class: 'step' }));
  for (const p of pageLinks(page, pages)) {
    pager.append(p === null ? gap() : link(String(p), p, p === page ? { 'aria-current': 'page' } : { 'aria-label': `Strana ${p}` }));
  }
  if (page < pages) pager.append(link('Další →', page + 1, { rel: 'next', class: 'step' }));
  pager.append(link(`Zobrazit vše (${total})`, ALL_PAGES, { class: 'mode' }));
}

/** The page a click on the pager asks for, or null (not a page link, or a click meant for a new tab). */
export function pagerTarget(e: MouseEvent): Page | null {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-page]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return null;
  return a.dataset.page === ALL_PAGES ? ALL_PAGES : Number(a.dataset.page);
}
