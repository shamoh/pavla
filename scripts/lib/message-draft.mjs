// The unsent message of a visitor: what is written and how the panel looks, kept while they move around the site.
// It lives in sessionStorage of the tab (gone when the tab is closed, never sent anywhere), so going to another
// work and back keeps the text. Pure functions over a Storage-like object, used by src/lib/message-form.ts.

import { defaultType } from './messages.mjs';

/** Key in sessionStorage. */
export const DRAFT_KEY = 'pavla.message';

/**
 * Looks of the panel: closed = only the launcher; compact = small panel in the corner; expanded = the same panel
 * grown for a longer text; minimized = hidden with the text kept, the launcher says there is a draft.
 */
export const PANEL_STATES = ['closed', 'compact', 'expanded', 'minimized'];

/**
 * What the panel buttons do, as transitions between PANEL_STATES. The text is the same field in every state,
 * so no transition can lose it; only `discard` (closing with confirmation) and sending clear it.
 */
const TRANSITIONS = {
  open: { closed: 'compact', minimized: 'compact', compact: 'compact', expanded: 'expanded' },
  expand: { compact: 'expanded', expanded: 'expanded' },
  shrink: { expanded: 'compact', compact: 'compact' },
  minimize: { compact: 'minimized', expanded: 'minimized' },
  close: { compact: 'closed', expanded: 'closed', minimized: 'closed' },
};

/** The state after `action`; an action that does not apply leaves the state as it is. */
export function nextPanelState(state, action) {
  return TRANSITIONS[action]?.[state] ?? state;
}

/**
 * A new draft for a page. `context`: the page the message is about (scripts/lib/messages.mjs), null for none.
 * `typeChosen`: the visitor picked the kind themselves, so a later page does not change it.
 */
export function newDraft(context, panel = 'closed') {
  return { panel, type: defaultType(context), typeChosen: false, text: '', email: '', context };
}

/** True when the visitor has written something worth keeping (closing then asks first). */
export const hasContent = (draft) => Boolean(draft && (draft.text.trim() || draft.email.trim()));

/**
 * The draft for a page that just loaded: the stored one when the visitor wrote something (with its own context,
 * the page where they started), otherwise a new one for this page. An empty draft only keeps the look of the panel.
 * A broken or unreadable value is ignored.
 */
export function loadDraft(storage, context) {
  let stored = null;
  try {
    stored = JSON.parse(storage?.getItem(DRAFT_KEY) ?? 'null');
  } catch {
    stored = null;
  }
  if (!isDraft(stored)) return newDraft(context);
  if (hasContent(stored)) return stored;
  return { ...newDraft(context, stored.panel === 'minimized' ? 'closed' : stored.panel), email: stored.email };
}

/** Stores the draft; storage that is full or blocked (private mode) is silently skipped. */
export function saveDraft(storage, draft) {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // The draft is a convenience; without storage the form still works on this page.
  }
}

/** Forgets the draft (after sending or discarding). */
export function clearDraft(storage) {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to do.
  }
}

function isDraft(d) {
  return Boolean(d) && typeof d === 'object' && PANEL_STATES.includes(d.panel) && typeof d.type === 'string'
    && typeof d.text === 'string' && typeof d.email === 'string' && 'context' in d;
}
