// Behaviour of the message form in the browser: the inline form on the contact page and the corner panel on every
// other page (src/components/MessageForm.astro, MessagePanel.astro). Three parts, each with one job:
//   draft store  – the unsent message and the look of the panel, kept in sessionStorage (scripts/lib/message-draft.mjs)
//   form binding – fields <-> draft, validation and sending (scripts/lib/messages.mjs)
//   panel binding – launcher, panel states (compact / expanded / minimized / closed), tip, hiding while scrolling
// Both the form and the panel only change the draft and re-render from it, so the text survives every change of size.

import {
  WEB3FORMS_URL, contextFromQuery, contextLabel, defaultType, messageEventParams, needsEmail, validateMessage, web3formsBody,
} from '../../scripts/lib/messages.mjs';
import { EVENTS, trackEvent } from '../../scripts/lib/analytics.mjs';
import { clearDraft, hasContent, loadDraft, newDraft, nextPanelState, saveDraft } from '../../scripts/lib/message-draft.mjs';

type Context = { kind: 'work' | 'page'; path: string; title: string; id?: string; year?: number; onSale?: boolean } | null;
type PanelState = 'closed' | 'compact' | 'expanded' | 'minimized';
interface Draft { panel: PanelState; type: string; typeChosen: boolean; text: string; email: string; context: Context }

/** Seconds the panel shows the thanks before it folds back to the launcher. */
const THANKS_MS = 4000;
/** The tip next to the launcher: once per tab, after a moment, for a few seconds. */
const TIP_KEY = 'pavla.message.tip';
const TIP_DELAY_MS = 1500;
const TIP_SHOW_MS = 6000;
/** Phones hide the launcher while scrolling down (it would cover the pictures) and bring it back on the way up. */
const PHONE = '(max-width: 640px)';

const storage: Storage | undefined = (() => {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
})();

// ---------------------------------------------------------------------------------------------------------------
// Draft store

interface Store {
  get(): Draft;
  set(patch: Partial<Draft>): void;
  replace(draft: Draft): void;
}

function createStore(initial: Draft): Store {
  let draft = initial;
  return {
    get: () => draft,
    set(patch) {
      draft = { ...draft, ...patch };
      saveDraft(storage, draft);
    },
    replace(next) {
      draft = next;
      saveDraft(storage, draft);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Form binding

interface FormView {
  render(): void;
  focus(): void;
  showFields(): void;
}

function bindForm(form: HTMLFormElement, store: Store, onSent: () => void): FormView {
  const q = <T extends Element>(sel: string) => form.querySelector<T>(sel)!;
  const type = q<HTMLSelectElement>('select[name="type"]');
  const text = q<HTMLTextAreaElement>('textarea[name="message"]');
  const email = q<HTMLInputElement>('input[name="email"]');
  const trap = q<HTMLInputElement>('input[name="botcheck"]');
  const fields = q<HTMLElement>('[data-msg-fields]');
  const done = q<HTMLElement>('[data-msg-done]');
  const doneNote = q<HTMLElement>('[data-msg-done-note]');
  const chip = q<HTMLElement>('[data-msg-context]');
  const chipLabel = q<HTMLElement>('[data-msg-context-label]');
  const emailHint = q<HTMLElement>('[data-msg-email-hint]');
  const status = q<HTMLElement>('[data-msg-status]');
  const submit = q<HTMLButtonElement>('button[type="submit"]');
  const { mode, accessKey, siteTitle, siteUrl, siteEmail } = form.dataset;

  const error = (field: string, message = '') => {
    form.querySelector<HTMLElement>(`[data-error-for="${field}"]`)!.textContent = message;
  };

  function render() {
    const d = store.get();
    type.value = d.type;
    if (text.value !== d.text) text.value = d.text;
    if (email.value !== d.email) email.value = d.email;
    const label = contextLabel(d.context);
    chip.hidden = !label;
    chipLabel.textContent = label ?? '';
    emailHint.textContent = needsEmail(d.type) ? '(potřebuji ho pro odpověď)' : '(nepovinný, abych mohla odpovědět)';
  }

  text.addEventListener('input', () => { store.set({ text: text.value }); error('text'); });
  email.addEventListener('input', () => { store.set({ email: email.value }); error('email'); });
  type.addEventListener('change', () => { store.set({ type: type.value, typeChosen: true }); error('email'); render(); });
  q<HTMLButtonElement>('[data-msg-context-remove]').addEventListener('click', () => {
    const d = store.get();
    store.set({ context: null, type: d.typeChosen ? d.type : defaultType(null) });
    render();
    text.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = store.get();
    const errors = validateMessage(d) as Record<string, string>;
    error('text', errors.text);
    error('email', errors.email);
    if (errors.text) return text.focus();
    if (errors.email) return email.focus();

    submit.disabled = true;
    status.textContent = 'Odesílám…';
    try {
      // A robot ticked the hidden box: look like it worked, send nothing.
      if (!trap.checked && mode === 'live') await send(accessKey!, { title: siteTitle!, url: siteUrl! }, d);
      else await new Promise((r) => setTimeout(r, 600));
      if (!trap.checked) trackEvent(EVENTS.message, messageEventParams(d));
      showDone(mode === 'live' || trap.checked
        ? (d.email.trim() ? `Odpovím vám na ${d.email.trim()}.` : '')
        : 'Tohle je náhled na testovacích datech: zpráva se nikam neodeslala.');
      clearDraft(storage);
      onSent();
    } catch {
      status.textContent = siteEmail
        ? `Zprávu se nepodařilo odeslat. Zkuste to prosím znovu, nebo napište na ${siteEmail}.`
        : 'Zprávu se nepodařilo odeslat. Zkuste to prosím znovu.';
    } finally {
      submit.disabled = false;
    }
  });

  function showDone(note: string) {
    status.textContent = '';
    doneNote.textContent = note;
    doneNote.hidden = !note;
    fields.hidden = true;
    done.hidden = false;
    done.focus({ preventScroll: true });
  }

  return {
    render,
    focus: () => text.focus({ preventScroll: true }),
    showFields() {
      fields.hidden = false;
      done.hidden = true;
      render();
    },
  };
}

async function send(accessKey: string, site: { title: string; url: string }, d: Draft) {
  const res = await fetch(WEB3FORMS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(web3formsBody(accessKey, site, d, d.context)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(body.message || `Web3Forms: ${res.status}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Panel binding

function bindPanel(root: HTMLElement) {
  const pageContext = JSON.parse(root.dataset.context || 'null') as Context;
  const store = createStore(loadDraft(storage, pageContext));
  const launcher = root.querySelector<HTMLButtonElement>('[data-msg-launcher]')!;
  const launcherLabel = root.querySelector<HTMLElement>('[data-msg-launcher-label]')!;
  const panel = root.querySelector<HTMLElement>('[data-msg-panel]')!;
  const confirm = root.querySelector<HTMLElement>('[data-msg-confirm]')!;
  const tip = root.querySelector<HTMLElement>('[data-msg-tip]')!;
  let foldTimer: number | undefined;

  const form = bindForm(root.querySelector<HTMLFormElement>('form[data-message-form]')!, store, () => {
    foldTimer = window.setTimeout(() => {
      store.replace(newDraft(pageContext, 'closed'));
      form.showFields();
      apply();
    }, THANKS_MS);
  });

  function apply() {
    const { panel: state } = store.get();
    const open = state === 'compact' || state === 'expanded';
    root.dataset.state = state;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    const draft = state === 'minimized' && hasContent(store.get());
    launcherLabel.textContent = draft ? 'Rozepsaná zpráva' : 'Napište mi';
    launcher.title = draft ? 'Pokračovat v rozepsané zprávě' : 'Napište mi k této stránce – dotaz, vzkaz nebo chybu na webu';
    if (open) hideTip();
  }

  function go(action: string) {
    const before = store.get().panel;
    store.set({ panel: nextPanelState(before, action) as PanelState });
    confirm.hidden = true;
    apply();
    if (action === 'open' || action === 'expand' || action === 'shrink') form.focus();
    if (action === 'minimize' || action === 'close') launcher.focus({ preventScroll: true });
  }

  function open(type?: string) {
    window.clearTimeout(foldTimer);
    if (!hasContent(store.get())) {
      // Nothing written yet: the message is about this page (and the kind the button asked for).
      store.replace({ ...newDraft(pageContext, store.get().panel), ...(type && { type, typeChosen: true }) });
      form.showFields();
    }
    form.render();
    go('open');
  }

  function close() {
    if (hasContent(store.get())) {
      confirm.hidden = false;
      confirm.querySelector<HTMLButtonElement>('[data-msg-action="keep"]')!.focus();
      return;
    }
    go('close');
  }

  function discard() {
    clearDraft(storage);
    store.replace(newDraft(pageContext, 'closed'));
    form.showFields();
    go('close');
  }

  launcher.addEventListener('click', () => open());
  root.querySelectorAll<HTMLButtonElement>('[data-msg-action]').forEach((b) => b.addEventListener('click', () => {
    const action = b.dataset.msgAction!;
    if (action === 'close') close();
    else if (action === 'discard') discard();
    else if (action === 'keep') { confirm.hidden = true; form.focus(); }
    else go(action);
  }));
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    go(hasContent(store.get()) ? 'minimize' : 'close');
  });
  // Elsewhere on the page: "Zeptat se na obraz" (data-message-open="<kind>") and the footer link.
  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-message-open]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger.dataset.messageOpen || undefined);
  });

  // Tip: what the launcher is for, once per tab; and on hover or focus.
  let tipTimer: number | undefined;
  function showTip() { if (!['compact', 'expanded'].includes(store.get().panel)) tip.hidden = false; }
  function hideTip() { window.clearTimeout(tipTimer); tip.hidden = true; }
  launcher.addEventListener('mouseenter', showTip);
  launcher.addEventListener('mouseleave', hideTip);
  launcher.addEventListener('focus', () => { if (launcher.matches(':focus-visible')) showTip(); });
  launcher.addEventListener('blur', hideTip);
  try {
    if (!storage?.getItem(TIP_KEY)) {
      storage?.setItem(TIP_KEY, '1');
      tipTimer = window.setTimeout(() => {
        showTip();
        tipTimer = window.setTimeout(hideTip, TIP_SHOW_MS);
      }, TIP_DELAY_MS);
    }
  } catch {
    // No storage, no tip.
  }

  // Phones: tuck the launcher away while scrolling down, bring it back when scrolling up or at the end of the page.
  const phone = window.matchMedia(PHONE);
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 4;
    if (Math.abs(y - lastY) < 8) return;
    root.classList.toggle('tucked', phone.matches && y > lastY && !atEnd);
    lastY = y;
  }, { passive: true });

  form.render();
  apply();
}

// ---------------------------------------------------------------------------------------------------------------
// Inline form (contact page)

function bindInline(form: HTMLFormElement) {
  // Came by the footer link of a page without JavaScript: the message is about that page.
  const context = contextFromQuery(new URLSearchParams(location.search)) as Context;
  const store = createStore(loadDraft(storage, context));
  const view = bindForm(form, store, () => store.replace(newDraft(null)));
  view.render();
}

/** Wires up whatever this page has: the panel, the inline form, or neither. */
export function mountMessages() {
  const panel = document.querySelector<HTMLElement>('[data-message-panel]');
  if (panel) bindPanel(panel);
  const inline = document.querySelector<HTMLFormElement>('form[data-message-form="inline"]');
  if (inline) bindInline(inline);
}
