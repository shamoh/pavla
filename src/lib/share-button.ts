// Browser side of "Sdílet" on a work page (scripts/lib/share.mjs): the button marked data-share-link shares the
// address of the page in the share sheet of a phone (navigator.share) or, where there is none, copies it and says so.
// Its data-method tells the GA event `share` which of the two happened (the click is tracked in Base.astro).
import { SHARE_COPY, SHARE_NATIVE } from '../../scripts/lib/analytics.mjs';

export function applyShareButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-share-link]').forEach((button) => {
    const url = button.dataset.url ?? location.href;
    const title = button.dataset.title ?? document.title;
    const native = typeof navigator.share === 'function';
    button.dataset.method = native ? SHARE_NATIVE : SHARE_COPY;
    const label = native ? 'Sdílet odkaz' : 'Zkopírovat odkaz';
    button.setAttribute('aria-label', label);
    button.title = label;
    const status = button.parentElement?.querySelector<HTMLElement>('[data-share-status]');
    button.addEventListener('click', async () => {
      if (native) {
        try { await navigator.share({ title, url }); } catch { /* closed by the visitor */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        if (status) status.textContent = 'Odkaz zkopírován';
      } catch {
        if (status) status.textContent = url;
      }
      if (status) setTimeout(() => { status.textContent = ''; }, 2500);
    });
  });
}
