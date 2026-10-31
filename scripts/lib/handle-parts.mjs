// The name, addresses and accounts of the author (the footer "Pavla Kramolišová", pavla@kramolis.cz, @pavla.kramolisova
// on the contact page) in three shades of the text: her given name, her surname and the rest (@, dots, the domain,
// spaces). src/components/NameShades.astro wraps each part in a <span>, so a link around it stays one link and copies
// as the same text.

import { slugify } from './works.mjs';

/** `text` in lower case without diacritics, letter for letter (the same length, so its positions are those of `text`). */
const fold = (text) => text.split('').map((c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()[0] ?? c).join('');

/** The shortest part of a name that still marks it ("kramolis" of "kramolisova" in kramolis.cz). */
const MIN_NAME = 5;

/** The longest beginning of `name` (at least MIN_NAME letters, or the whole shorter name) in `lower` outside `taken`. */
function findName(lower, name, taken = null) {
  for (let length = name.length; length >= Math.min(MIN_NAME, name.length) && length > 0; length--) {
    const part = name.slice(0, length);
    for (let at = lower.indexOf(part); at >= 0; at = lower.indexOf(part, at + 1)) {
      if (!taken || at + length <= taken.at || at >= taken.at + taken.length) return { at, length };
    }
  }
  return null;
}

/**
 * Splits `text` into [{ text, kind }]: kind `given` / `surname` = the longest beginning of the first / last word
 * of `author` found in it (both without diacritics, in any case: "Kramolišová" and kramolis.cz alike), `rest` = everything around them. Without either name
 * the whole text is one part of kind null (shown as any text). The parts joined are always `text`.
 */
export function handleParts(text, author) {
  const value = String(text ?? '');
  const words = String(author ?? '').trim().split(/\s+/).map(slugify).filter(Boolean);
  const lower = fold(value);
  const given = words.length ? findName(lower, words[0]) : null;
  const surname = words.length > 1 ? findName(lower, words.at(-1), given) : null;
  const names = [given && { ...given, kind: 'given' }, surname && { ...surname, kind: 'surname' }].filter(Boolean).sort((a, b) => a.at - b.at);
  if (!names.length) return value ? [{ text: value, kind: null }] : [];
  const parts = [];
  let from = 0;
  for (const name of names) {
    parts.push({ text: value.slice(from, name.at), kind: 'rest' }, { text: value.slice(name.at, name.at + name.length), kind: name.kind });
    from = name.at + name.length;
  }
  parts.push({ text: value.slice(from), kind: 'rest' });
  return parts.filter((p) => p.text);
}
