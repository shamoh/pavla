import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_KEY, PANEL_STATES, clearDraft, hasContent, loadDraft, newDraft, nextPanelState, saveDraft } from './message-draft.mjs';
import { pageContext, workContext } from './messages.mjs';

/** In-memory sessionStorage. */
function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const ovce = workContext({ title: 'Ovce', id: 'v39nd', year: 2026 }, '/tvorba/2026/ovce-v39nd/');
const kolekce = pageContext('/tvorba/kolekce/', 'Kolekce');

test('nextPanelState: open, grow, shrink, minimize and close; actions that do not apply keep the state', () => {
  assert.equal(nextPanelState('closed', 'open'), 'compact');
  assert.equal(nextPanelState('compact', 'expand'), 'expanded');
  assert.equal(nextPanelState('expanded', 'shrink'), 'compact');
  assert.equal(nextPanelState('expanded', 'minimize'), 'minimized');
  assert.equal(nextPanelState('minimized', 'open'), 'compact');
  assert.equal(nextPanelState('expanded', 'open'), 'expanded', 'opening an open panel keeps its size');
  assert.equal(nextPanelState('compact', 'close'), 'closed');
  assert.equal(nextPanelState('closed', 'expand'), 'closed');
  assert.equal(nextPanelState('closed', 'nonsense'), 'closed');
  for (const s of PANEL_STATES) assert.ok(PANEL_STATES.includes(nextPanelState(s, 'open')));
});

test('newDraft and hasContent: the kind follows the page; an address alone counts as content', () => {
  assert.equal(newDraft(ovce).type, 'work');
  assert.equal(newDraft(kolekce).panel, 'closed');
  assert.equal(hasContent(newDraft(ovce)), false);
  assert.equal(hasContent({ ...newDraft(ovce), text: '  ' }), false);
  assert.equal(hasContent({ ...newDraft(ovce), email: 'a@b.cz' }), true);
});

test('loadDraft: a written draft travels to the next page with the context where it started', () => {
  const storage = memoryStorage();
  saveDraft(storage, { ...newDraft(ovce, 'expanded'), text: 'Je ještě volný?' });
  const draft = loadDraft(storage, kolekce);
  assert.equal(draft.text, 'Je ještě volný?');
  assert.equal(draft.panel, 'expanded');
  assert.deepEqual(draft.context, ovce);
});

test('loadDraft: an empty draft takes the new page, keeps an open panel open and the address', () => {
  const storage = memoryStorage();
  saveDraft(storage, { ...newDraft(ovce, 'compact') });
  const draft = loadDraft(storage, kolekce);
  assert.deepEqual(draft.context, kolekce);
  assert.equal(draft.type, 'greeting');
  assert.equal(draft.panel, 'compact');
  saveDraft(storage, { ...newDraft(ovce, 'minimized') });
  assert.equal(loadDraft(storage, kolekce).panel, 'closed', 'nothing minimized means nothing to come back to');
});

test('loadDraft: nothing stored, a broken value or no storage = a new draft for the page', () => {
  assert.deepEqual(loadDraft(memoryStorage(), ovce), newDraft(ovce));
  const broken = memoryStorage();
  broken.setItem(DRAFT_KEY, '{oops');
  assert.deepEqual(loadDraft(broken, ovce), newDraft(ovce));
  broken.setItem(DRAFT_KEY, JSON.stringify({ panel: 'huge', text: 1 }));
  assert.deepEqual(loadDraft(broken, ovce), newDraft(ovce));
  assert.deepEqual(loadDraft(undefined, ovce), newDraft(ovce));
});

test('saveDraft and clearDraft: a blocked storage is skipped, clearing forgets the draft', () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('no'); } };
  assert.doesNotThrow(() => saveDraft(blocked, newDraft(ovce)));
  assert.doesNotThrow(() => clearDraft(blocked));
  const storage = memoryStorage();
  saveDraft(storage, { ...newDraft(ovce), text: 'x' });
  clearDraft(storage);
  assert.equal(storage.getItem(DRAFT_KEY), null);
});
