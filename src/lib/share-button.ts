// Browser side of "Sdílet" on a work page (scripts/lib/share.mjs): the button marked data-share-link shares the
// address of the page in the share sheet of a phone (navigator.share) or, where there is none, copies it and says so.
// Its data-method tells the GA event `share` which of the two happened (the click is tracked in Base.astro).
// Buttons marked data-copy copy a value (the code of the work) the same way (applyCopyButtons).
import { SHARE_COPY, SHARE_NATIVE } from '../../scripts/lib/analytics.mjs';
import { copiedText } from '../../scripts/lib/share.mjs';

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
      let ok = true;
      try { await navigator.clipboard.writeText(url); } catch { ok = false; }
      if (status) status.textContent = copiedText(ok, url, 'Odkaz');
      if (status) setTimeout(() => { status.textContent = ''; }, 2500);
    });
  });
}

/**
 * Buttons marked data-copy (e.g. next to the code of a work) copy their value and say so in the [data-copy-status]
 * next to them ("<data-copy-what> zkopírován"). Hidden until the browser can copy, so they never do nothing.
 */
export function applyCopyButtons() {
  if (!navigator.clipboard) return;
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
    const value = button.dataset.copy ?? '';
    const status = button.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
    button.hidden = false;
    button.addEventListener('click', async () => {
      let ok = true;
      try { await navigator.clipboard.writeText(value); } catch { ok = false; }
      if (!status) return;
      status.textContent = copiedText(ok, value, button.dataset.copyWhat ?? 'Text');
      setTimeout(() => { status.textContent = ''; }, 2500);
    });
  });
}
