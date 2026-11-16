// Opening a work by its code (id) from the header of every page (src/components/CodeJump.astro): a visitor copies the
// code from Instagram ("pavla.kramolis.cz · jujn2"), pastes it and lands on the work. The field takes the code itself
// or anything around it: the whole line of a post, an address of the work (its short link /tvorba/<id>/ or its page
// /tvorba/<year>/<slug>-<id>/), any case. The page then opens the short link of the work, which leads to its page.

import { idFromPath, isValidId, workShortPath } from './works.mjs';
import { CODE_METHODS, EVENTS } from './analytics.mjs';

/** The code of a work in what a visitor typed or pasted: the last word that is a valid id, null without one. */
export function codeFromInput(text) {
  const input = String(text ?? '').trim().toLowerCase();
  if (!input) return null;
  // an address of a work: its short link or its page
  const path = /\/tvorba\/[^\s?#]*/.exec(input)?.[0];
  if (path) {
    const short = /^\/tvorba\/([a-z0-9]+)\/?$/.exec(path)?.[1];
    if (isValidId(short)) return short;
    // an address of another page of the gallery (a year, a collection) has no code
    return idFromPath(path.endsWith('/') ? path : `${path}/`);
  }
  // the protocol of an address is no code ("https" looks like one)
  const words = input.replace(/\bhttps?:\/\//g, ' ').split(/[^a-z0-9]+/).filter(isValidId);
  return words.at(-1) ?? null;
}

/** Where the code of a work leads (its short link, without the base of the site). */
export const codePath = (id) => workShortPath(id);

/** Messages of the field (Czech, shown under it). */
export const CODE_MESSAGES = {
  invalid: 'To není kód obrazu (5 znaků, např. jujn2).',
  missing: (id) => `Obraz s kódem ${id} tu není.`,
  failed: 'Obraz se teď nepodařilo otevřít, zkuste to znovu.',
};

/** The statistics event of a work opened by its code: { name, params: { work_id, method } } (EVENTS.code). */
export const codeEvent = (id, method) => ({ name: EVENTS.code, params: { work_id: id, method: CODE_METHODS[method] ?? CODE_METHODS.enter } });

/**
 * An input event that brought a whole code at once: a paste (also from the clipboard bar of a phone keyboard, which
 * types the text in one go) rather than typing letter by letter. `inputType` and `data` of the InputEvent.
 */
export const isBulkInput = ({ inputType, data } = {}) => inputType === 'insertFromPaste' || inputType === 'insertFromDrop'
  || (typeof data === 'string' && data.length >= 5);

/**
 * Whether a key pressed on the page opens the field ("#", also with AltGr on a Czech keyboard): not while typing in
 * a field and not with Ctrl / Cmd. `target`: { tagName, isContentEditable } of the focused element.
 */
export const opensCodeJump = ({ key, ctrlKey, metaKey } = {}, target = {}) => key === '#' && !ctrlKey && !metaKey
  && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) && !target?.isContentEditable;
