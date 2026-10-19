// Texts the author writes (`text`, `closing`, `description` of every description file): their meaning and their simple
// formatting. Line breaks inside a paragraph mean a space and an empty line starts a new paragraph, whatever block
// style the YAML uses (normalizeText), so the pipeline may rewrap them freely (scripts/lib/metadata-yaml.mjs).
// Formatting (`text`, `closing`) is a small subset of Markdown the author can write without learning anything, never HTML:
//   [text](address)   a link: https://…, http://…, mailto:… or an address on the site starting with "/"
//   **text**          bold
//   *text*            italic
// Everything else stays plain text (HTML is escaped). A link with any other address stays text on the page and is an
// error of the pipeline (linkProblems).

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const BOLD = /\*\*(?=\S)(.+?)(?<=\S)\*\*/g;
const ITALIC = /(?<![*\w])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![*\w])/g;
/** Marker of a link put aside while bold and italic are applied to the rest (never in a text: a control character). */
const SLOT = '\u0000';

/**
 * Paragraphs of a text: split by empty lines, the lines of one paragraph joined by a space, whitespace collapsed.
 * Empty paragraphs are dropped. Each still with its formatting.
 */
export const paragraphs = (text) => (typeof text === 'string' ? text.split(/\n[ \t]*\n/) : [])
  .map((p) => p.split('\n').map((l) => l.trim()).filter(Boolean).join(' ').replace(/[ \t]+/g, ' '))
  .filter(Boolean);

/** The meaning of a text: its paragraphs separated by one empty line, no line breaks inside ('' without any). */
export const normalizeText = (text) => paragraphs(text).join('\n\n');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A link address that may stay a link: external (https, http, mailto) or on the site ("/…", not "//…"). */
export const isAllowedHref = (href) => /^(https?:\/\/[^\s/]+|mailto:\S+@\S+)/i.test(href) || /^\/(?!\/)/.test(href);
/** An address on the site (relative to its base). */
export const isInternalHref = (href) => /^\/(?!\/)/.test(href);

const emphasis = (html) => html.replace(BOLD, '<strong>$1</strong>').replace(ITALIC, '<em>$1</em>');

/**
 * HTML of one paragraph of a formatted text. `url`: maps an address on the site to its final address (the base of
 * the site, src/lib/site.ts `url`). External links open in the same tab, with rel="noopener".
 */
export function richTextHtml(text, { url = (p) => p } = {}) {
  const links = [];
  const plain = String(text ?? '').replace(LINK, (whole, label, href) => {
    links.push({ whole, label, href });
    return `${SLOT}${links.length - 1}${SLOT}`;
  });
  const html = emphasis(escapeHtml(plain));
  return html.replace(new RegExp(`${SLOT}(\\d+)${SLOT}`, 'g'), (_, i) => {
    const { whole, label, href } = links[Number(i)];
    if (!isAllowedHref(href)) return emphasis(escapeHtml(whole));
    const target = isInternalHref(href) ? url(href) : href;
    const rel = isInternalHref(href) ? '' : ' rel="noopener"';
    return `<a href="${escapeHtml(target)}"${rel}>${emphasis(escapeHtml(label))}</a>`;
  });
}

/** Markers of bold and italic put in while the rest of a text is escaped (control characters, never in a text). */
const BOLD_MARK = '\u0001';
const ITALIC_MARK = '\u0002';
/** Characters Markdown (GitHub) would take for formatting, escaped; as escText of scripts/lib/overview.mjs. */
const escapeMarkdown = (s) => s
  .replace(/[\\`*[\]<>~#|]|(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, (c) => `\\${c}`)
  .replace(/&/g, '&amp;');
const markdownEmphasis = (s) => escapeMarkdown(s.replace(BOLD, `${BOLD_MARK}$1${BOLD_MARK}`).replace(ITALIC, `${ITALIC_MARK}$1${ITALIC_MARK}`))
  .replaceAll(BOLD_MARK, '**').replaceAll(ITALIC_MARK, '*');

/**
 * Markdown (GitHub) of one paragraph of a formatted text, looking the same as on the site: bold, italic and links
 * kept, everything else escaped. `url`: maps an address on the site to a full one (a link must work outside the site,
 * e.g. in a README of the content repository). A link with an address that cannot stay a link stays text.
 */
export function richTextMarkdown(text, { url = (p) => p } = {}) {
  const links = [];
  const plain = String(text ?? '').replace(/\s+/g, ' ').trim().replace(LINK, (whole, label, href) => {
    links.push({ whole, label, href });
    return `${SLOT}${links.length - 1}${SLOT}`;
  });
  return markdownEmphasis(plain).replace(new RegExp(`${SLOT}(\\d+)${SLOT}`, 'g'), (_, i) => {
    const { whole, label, href } = links[Number(i)];
    if (!isAllowedHref(href)) return escapeMarkdown(whole);
    return `[${markdownEmphasis(label)}](${isInternalHref(href) ? url(href) : href})`;
  });
}

/** The text without its formatting (link labels stay): for places that take plain text only. */
export const richTextPlain = (text) => String(text ?? '').replace(LINK, '$1').replace(BOLD, '$1').replace(ITALIC, '$1');

/**
 * A text as one plain line (search engines, tooltips, captions of images, search): no formatting, paragraphs joined
 * by a space ('' for anything that is no text).
 */
export const plainText = (text) => paragraphs(text).map(richTextPlain).join(' ');

/** A text shown on a page as one plain line, '' while it still starts with DOPLNIT (a placeholder of a skeleton). */
export const ownText = (text) => {
  const plain = plainText(text);
  return /^DOPLNIT\b/.test(plain) ? '' : plain;
};

/**
 * What search engines (and link previews, pins) get of a description file: its own `description`, otherwise its
 * `text` (ownText); '' without either.
 */
export const searchDescription = (data) => ownText(data?.description) || ownText(data?.text);

/** HTML paragraphs of a formatted text (`url`: see richTextHtml). */
export const richParagraphs = (text, options) => paragraphs(text).map((p) => richTextHtml(p, options));

/** Problems of the links of a formatted text (Czech, for the run summary): addresses that cannot stay links. */
export function linkProblems(where, key, text) {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(LINK)]
    .filter(([, , href]) => !isAllowedHref(href))
    .map(([whole, , href]) => `${where}: odkaz „${whole}“ v ${key} má adresu „${href}“, která nejde použít; napiš celou adresu začínající https:// (jiný web), mailto: (e-mail) nebo / (stránka tohoto webu, např. /tvorba/) [spatny-odkaz-v-textu]`);
}
