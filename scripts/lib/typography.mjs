// Czech typography of the texts on the site: words that must not be split at the end of a line are joined by a
// non-breaking space (U+00A0) instead of a plain one. The author writes ordinary spaces, the site does the rest:
//   - a one-letter word (prepositions and conjunctions k, s, v, z, o, u, a, i) stays with the next word: "v lese",
//   - a number stays with its unit: "5 cm", "2 500 Kč", "20 %",
//   - a multiplication sign stays with both numbers: "30 × 40 cm" (also "30 x 40"),
//   - an abbreviation stays with the next word: "např. akvarel", "tzv. mokré", "sv. Vít",
//   - a date stays whole: "15. 11. 2026", an ordinal number stays with its word: "1. místo", "15. listopadu",
//   - a range of numbers is never split at its dash: "2019–2024" (also "2019 – 2024" and "2019 - 2024", written
//     as "2019–2024"; "2019-2024" keeps its hyphen), joined by word joiners (U+2060, invisible),
//   - a dash in a sentence never starts a line: "chvíle – kdy" (the space before it; also "-" used as a dash),
//   - three dots are the ellipsis: "kopretiny..." -> "kopretiny…" (one character; never inside an address).
// keepTogether for a plain text (titles, headings: Astro escapes them), keepTogetherHtml for HTML of a formatted text
// (scripts/lib/rich-text.mjs richTextHtml): only its text changes, never a tag, and a rule works across a tag too
// ("a <strong>s barvou</strong>"). Only for showing: never in data, addresses, <title>, JSON-LD or attributes.

const NBSP = '\u00a0';
/** An invisible character a line never breaks at (around the dash of a range of numbers). */
const JOIN = '\u2060';
/** Stands in for a tag of HTML while the rules run (a control character, never in a text; not a space). */
const TAG = '\u0003';
/** What may stand before a word for it to be a word of its own: the start, a space, a bracket, a quote, a tag. */
const BEFORE = `(?<=^|[\\s(\\[„“‚"'${NBSP}${TAG}])`;

/** Units a number stays with (written after a space; a longer one first, so "mm" is not "m" + "m"). */
export const UNITS = ['mm', 'cm', 'dm', 'km', 'm', 'ml', 'l', 'kg', 'g', 'Kč', 'EUR', '€', '%', '°C', '°', 'ks', 'min', 'h', 's'];
/** Abbreviations that stay with the next word (written with their dot, any case of the first letter). */
export const ABBREVIATIONS = ['např', 'tzv', 'tj', 'tzn', 'resp', 'cca', 'č', 'sv', 'str', 'ing', 'mgr', 'mudr', 'dr', 'doc', 'prof'];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const RULES = [
  // three dots (exactly three) -> the ellipsis, except in a word that is an address (with "/" or "www.")
  [/[^\s]*(?<!\.)\.{3}(?!\.)[^\s]*/g, (word) => (/\/|www\./i.test(word) ? word : word.replace(/(?<!\.)\.{3}(?!\.)/g, '…'))],
  // a range of numbers: "2019–2024", "2019 – 2024", "2019 - 2024" -> "2019–2024"; "2019-2024" keeps its hyphen
  [/(?<=\d)(?: *– *| +- +)(?=\d)/g, `${JOIN}–${JOIN}`],
  [/(?<=\d)-(?=\d)/g, `${JOIN}-${JOIN}`],
  // a dash in a sentence stays with the word before it ("-" with spaces around used as a dash too)
  [/(?<=\S) +(?=[–—-] +\S)/g, NBSP],
  // a date: "15. 11. 2026", "15. 11."
  [/(?<=(?:^|[^\d])\d{1,2}\.) +(?=\d{1,2}\.)/g, NBSP],
  [/(?<=(?:^|[^\d])\d{1,2}\.) +(?=\d{4}(?!\d))/g, NBSP],
  // an ordinal number and its word: "1. místo", "15. listopadu" (a lower-case word: never the end of a sentence)
  [/(?<=(?:^|[^\d.])\d{1,3}\.) +(?=\p{Ll})/gu, NBSP],
  // one-letter words
  [new RegExp(`${BEFORE}([ksvzouaiKSVZOUAI]) +(?=\\S)`, 'g'), `$1${NBSP}`],
  // abbreviations ("cca" also without its dot)
  [new RegExp(`${BEFORE}(${ABBREVIATIONS.map(escapeRegExp).join('|')})(\\.|(?<=cca)) +(?=\\S)`, 'gi'), `$1$2${NBSP}`],
  // a multiplication sign between two numbers: "30 × 40", "30 x 40"
  [/(?<=\d) +([×x]) +(?=\d)/g, `${NBSP}$1${NBSP}`],
  [/(?<=\d) +× +/g, `${NBSP}×${NBSP}`],
  // a number and its unit (the unit a word of its own)
  [new RegExp(`(?<=\\d) +(?=(?:${UNITS.map(escapeRegExp).join('|')})(?![\\p{L}\\d]))`, 'gu'), NBSP],
  // thousands written with a space: "2 500 Kč"
  [/(?<=(?:^|[^\d])\d{1,3}) (?=\d{3}(?!\d))/g, NBSP],
];

/** A plain text with its non-breaking spaces (see above); anything else as it is ('' for no text). */
export const keepTogether = (text) => (typeof text === 'string' ? RULES.reduce((t, [re, to]) => t.replace(re, to), text) : text ?? '');

/** HTML with the non-breaking spaces in its text, its tags untouched (text never has a bare "<" or ">"). */
export function keepTogetherHtml(html) {
  const tags = [];
  const text = String(html ?? '').replace(/<[^>]*>/g, (tag) => {
    tags.push(tag);
    return TAG;
  });
  let i = 0;
  return keepTogether(text).replace(new RegExp(TAG, 'g'), () => tags[i++]);
}
