// Checks of the texts and structured data of a built site (npm run check:images, scripts/check-images.mjs), over the
// pages search engines may index: every page has its own title and description (no two the same, the description
// at most DESCRIPTION_MAX characters) and valid structured data (JSON-LD with the schema.org context and a type on
// every node). The same checks run in the weekly health check over the deployed site (evaluatePageTexts).

import { isNoindex } from './sitemap.mjs';

/** Longest description a search result shows whole (summarize in scripts/lib/seo.mjs cuts to it). */
export const DESCRIPTION_MAX = 160;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** HTML text back to plain text: named, decimal and hex entities. */
export const decodeEntities = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return ENTITIES[e.toLowerCase()] ?? m;
});

/** The title, the meta description and the texts of the JSON-LD scripts of a page ('' / [] when missing). */
export function pageMeta(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '';
  const jsonLd = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  return { title: decodeEntities(title).trim(), description: decodeEntities(description).trim(), jsonLd };
}

/**
 * The texts of each problem (`code` + `detail`): English for the console ("Kontrola kódu", npm run check:images),
 * Czech for the report of the weekly health check.
 */
const PROBLEM_TEXTS = {
  noTitle: ['no <title>', 'chybí titulek'],
  sameTitle: [(d) => `the same title as ${d}`, (d) => `stejný titulek jako ${d}`],
  noDescription: ['no meta description', 'chybí popis'],
  sameDescription: [(d) => `the same description as ${d}`, (d) => `stejný popis jako ${d}`],
  longDescription: [(d) => `description longer than ${DESCRIPTION_MAX} characters (${d})`, (d) => `popis delší než ${DESCRIPTION_MAX} znaků (${d})`],
  noJsonLd: ['no structured data (JSON-LD)', 'chybí strukturovaná data (JSON-LD)'],
  invalidJson: [(d) => `JSON-LD is not valid JSON (${d})`, (d) => `JSON-LD není platný JSON (${d})`],
  notObject: ['JSON-LD is not an object', 'JSON-LD není objekt'],
  noContext: ['JSON-LD without the schema.org @context', 'JSON-LD bez @context schema.org'],
  emptyGraph: ['JSON-LD with an empty @graph', 'JSON-LD s prázdným @graph'],
  noType: [(d) => `JSON-LD node ${d} without @type`, (d) => `JSON-LD: uzel ${d} bez @type`],
};

/** The text of a problem ({ code, detail }) in `lang` ('en' or 'cs'), without its page. */
export function problemText({ code, detail }, lang = 'en') {
  const text = PROBLEM_TEXTS[code][lang === 'cs' ? 1 : 0];
  return typeof text === 'function' ? text(detail) : text;
}

/** Problems ({ code, detail }) of one JSON-LD text: not JSON, without the schema.org context, a node without @type. [] = valid. */
export function jsonLdProblems(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [{ code: 'invalidJson', detail: e.message }];
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [{ code: 'notObject' }];
  const problems = [];
  if (!/^https?:\/\/schema\.org\/?$/.test(String(data['@context'] ?? ''))) problems.push({ code: 'noContext' });
  const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
  if (nodes.length === 0) problems.push({ code: 'emptyGraph' });
  nodes.forEach((node, i) => {
    if (!node || typeof node !== 'object' || !node['@type']) problems.push({ code: 'noType', detail: i + 1 });
  });
  return problems;
}

/**
 * Problems of the texts and structured data of indexable built pages (`pages`: [{ path, html }]) as
 * [{ path, code, detail }], sorted by path and then by their English text (problemText): a missing or repeated
 * title or description, a description over DESCRIPTION_MAX characters, missing or invalid JSON-LD.
 */
export function pageProblems(pages) {
  const metas = pages.map((p) => ({ path: p.path, ...pageMeta(p.html) }));
  const problems = [];
  const add = (path, code, detail) => problems.push(detail === undefined ? { path, code } : { path, code, detail });
  const repeated = (key) => {
    const seen = new Map();
    for (const m of metas) if (m[key]) seen.set(m[key], [...(seen.get(m[key]) ?? []), m.path]);
    return seen;
  };
  const others = (paths, path) => paths.filter((p) => p !== path).join(', ');
  const titles = repeated('title');
  const descriptions = repeated('description');
  for (const m of metas) {
    if (!m.title) add(m.path, 'noTitle');
    else if (titles.get(m.title).length > 1) add(m.path, 'sameTitle', others(titles.get(m.title), m.path));
    if (!m.description) add(m.path, 'noDescription');
    else {
      if (descriptions.get(m.description).length > 1) add(m.path, 'sameDescription', others(descriptions.get(m.description), m.path));
      if (m.description.length > DESCRIPTION_MAX) add(m.path, 'longDescription', m.description.length);
    }
    if (m.jsonLd.length === 0) add(m.path, 'noJsonLd');
    for (const text of m.jsonLd) problems.push(...jsonLdProblems(text).map((p) => ({ path: m.path, ...p })));
  }
  const key = (p) => `${p.path}: ${problemText(p)}`;
  return problems.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** Czech noun after a number: 1 stránka, 2–4 stránky, 0 and 5+ stránek. */
const pagesCount = (n) => `${n} ${n === 1 ? 'stránka' : n >= 2 && n <= 4 ? 'stránky' : 'stránek'}`;

/**
 * Czech result of the text checks over the pages of the deployed site (`pages`: [{ path, html }] as the weekly
 * health check read them, null = not read) for its report; pages with noindex are left out, at most `limit`
 * problems listed.
 */
export function evaluatePageTexts(pages, { limit = 10 } = {}) {
  if (pages === null) return { ok: true, message: 'Texty stránek pro vyhledávače nebyly zkontrolovány.' };
  const indexable = pages.filter((p) => !isNoindex(p.html));
  const problems = pageProblems(indexable);
  if (problems.length === 0) {
    return { ok: true, message: `Texty stránek pro vyhledávače jsou v pořádku (${pagesCount(indexable.length)}: vlastní titulky a popisy, platná strukturovaná data).` };
  }
  const lines = [`Texty stránek pro vyhledávače mají ${problems.length} ${problems.length === 1 ? 'problém' : problems.length <= 4 ? 'problémy' : 'problémů'}:`];
  lines.push(...problems.slice(0, limit).map((p) => `- ${p.path}: ${problemText(p, 'cs')}`));
  if (problems.length > limit) lines.push(`- … a dalších ${problems.length - limit}`);
  lines.push('„Kontrola kódu“ to hlídá před sloučením, nasazený web je tedy nejspíš z commitu, který jí neprošel; spusť `npm run build` a `npm run check:images`.');
  return { ok: false, message: lines.join('\n') };
}
