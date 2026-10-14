// export/README.md of the content repository: one page with everything about every work, grouped by collections, for
// searching in the browser (GitHub renders it). Every attribute of every description (also meta_* and private_*: the
// content repository is private), links to the description, the photo and the page on the site, and what the run says
// about it, each message with its code (scripts/lib/codes.mjs), so searching for a code finds every case. Czech: for
// Pavla and Libor. No pictures and as few characters as possible: the whole file must stay small enough for GitHub to
// render; written whole by every run (cheap: text only), git shows what changed.

import { CODES, LEVELS, LEVEL_LABELS, coded, codesOf, withoutCodes } from './codes.mjs';
import { groupProblems } from './summary.mjs';
import { NO_COLLECTION_TITLE } from './gallery-filter.mjs';

/** Levels of the messages of a pipeline run (the weekly health check has its own report). */
const RUN_LEVELS = LEVELS.filter((l) => l !== 'health');

/** Size above which GitHub may stop rendering the overview: the run then recommends a look (prehled-velky). */
export const OVERVIEW_MAX_BYTES = 400_000;

/** A text value longer than this goes on a line of its own (descriptions, notes). */
const INLINE_CHARS = 80;

/**
 * Markdown-safe text in one line: line breaks as spaces, the characters that would turn into formatting, links or
 * HTML escaped. An underscore only at the edge of a word (inside one, like meta_draft, GitHub keeps it as it is); the
 * lines never start with the text, so #, - and digits need nothing.
 */
export const escText = (s) => String(s ?? '')
  .replace(/\s+/g, ' ').trim()
  .replace(/[\\`*[\]<>~]|(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, (c) => `\\${c}`)
  .replace(/&/g, '&amp;');

/** A value of an attribute in one line: lists joined by ", ", maps as "key=value; …", nested the same way. */
export function formatValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => `${k}=${formatValue(v)}`).join('; ');
  return String(value);
}

const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && !v.trim())
  || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !Object.keys(v).length);

/**
 * The attributes of a description in file order, empty ones left out: short ones in one paragraph "key: value · …",
 * long texts each in a paragraph of its own.
 */
export function attributeLines(data) {
  const short = [];
  const long = [];
  for (const [key, value] of Object.entries(data ?? {})) {
    if (isEmpty(value)) continue;
    const text = escText(formatValue(value));
    (typeof value === 'string' && text.length > INLINE_CHARS ? long : short).push(`${key}: ${text}`);
  }
  return [...(short.length ? [short.join(' · ')] : []), ...long];
}

/** The anchor GitHub gives a heading: lower case, without punctuation, spaces as "-", repeated ones numbered. */
export function headingAnchors() {
  const seen = new Map();
  return (text) => {
    const base = String(text).toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

/**
 * What a run says about each file, by level, every message with a code: `noted` = the lists of a run
 * ({ problems, pending, detected, misfits, commentedOut, advice, todo }, each "<file>: <message>"). pending and todo
 * are lists of attributes still marked DOPLNIT, here as one message each. Returns Map file -> { error, review, advice, todo }.
 */
export function notesByFile(noted) {
  const files = new Map();
  const add = (level, list, map = (m) => m) => {
    for (const { file, messages } of groupProblems(list ?? [])) {
      if (!files.has(file)) files.set(file, Object.fromEntries(RUN_LEVELS.map((l) => [l, []])));
      files.get(file)[level].push(...messages.map(map));
    }
  };
  add('error', noted.problems);
  add('review', noted.pending, (keys) => coded('doplnit-zverejneny', `zveřejněný, pořád DOPLNIT: ${keys}`));
  add('review', (noted.detected ?? []).filter((d) => codesOf(d).includes('podezrely-orez')));
  add('review', noted.misfits);
  add('review', noted.commentedOut);
  add('advice', noted.advice);
  add('todo', noted.todo, (keys) => coded('doplnit', `zbývá doplnit: ${keys}`));
  return files;
}

/** "- `kód` text" lines of the messages of a file, by level; "stav: OK" without any. */
function messageLines(notes) {
  const items = RUN_LEVELS.flatMap((level) => (notes?.[level] ?? []).map((m) => {
    const codes = codesOf(m);
    return `- ${codes.length ? codes.map((c) => `\`${c}\``).join(' ') : `\`${level}\``} ${escText(withoutCodes(m))}`;
  }));
  return items.length ? items : ['stav: OK'];
}

/** Counts of the codes in the given notes: Map code -> count. */
function countCodes(allNotes) {
  const counts = new Map();
  for (const notes of allNotes) {
    for (const level of RUN_LEVELS) {
      for (const m of notes?.[level] ?? []) for (const c of new Set(codesOf(m))) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The overview: {
 *   works [{ yamlPath, photoPath (relative to the content repository, null = none), id, data, collection (slug, null),
 *     pageUrl ('' = not on the site) }],
 *   collections [{ slug, yamlPath, data }], uncollected ({ yamlPath, data } of tvorba/_index.yaml, or null),
 *   noted (the lists of the run, notesByFile) }.
 * Collections in Czech alphabetical order by title, "Mimo kolekce" last; works by date, newest first.
 */
export function overviewReadme({ works, collections = [], uncollected = null, noted = {} }) {
  const notes = notesByFile(noted);
  const anchor = headingAnchors();
  const link = (p) => `../${p.split('/').map(encodeURIComponent).join('/')}`;
  const titleOf = (c) => (typeof c.data?.title === 'string' && c.data.title.trim() ? c.data.title.trim() : c.slug);
  const groups = [
    ...[...collections].sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'cs'))
      .map((c) => ({ title: titleOf(c), meta: c, works: works.filter((w) => w.collection === c.slug) })),
    { title: NO_COLLECTION_TITLE, meta: uncollected, works: works.filter((w) => !w.collection) },
  ].filter((g) => g.works.length || g.meta);
  const byDate = (a, b) => String(b.data?.date ?? '').localeCompare(String(a.data?.date ?? '')) || String(a.data?.title ?? '').localeCompare(String(b.data?.title ?? ''), 'cs');

  const shown = new Set();
  const body = [];
  const toc = [];
  for (const g of groups) {
    const head = escText(g.title);
    toc.push(`[${head}](#${anchor(g.title)}) (${g.works.length})`);
    body.push('', `## ${head}`, '');
    if (g.meta) {
      shown.add(g.meta.yamlPath);
      body.push(`[${g.meta.yamlPath}](${link(g.meta.yamlPath)})`, '', ...attributeLines(g.meta.data).flatMap((l) => [l, '']), ...messageLines(notes.get(g.meta.yamlPath)));
    }
    for (const w of [...g.works].sort(byDate)) {
      shown.add(w.yamlPath);
      const d = w.data ?? {};
      const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : w.yamlPath;
      const heading = `${title}${w.id ? ` · ${w.id}` : ''}${d.featured === true ? ' ★' : ''}${d.meta_draft === true ? ' · draft' : ''}`;
      anchor(heading);
      body.push('', `### ${escText(heading)}`, '',
        [`[${w.yamlPath}](${link(w.yamlPath)})`, w.photoPath ? `[foto](${link(w.photoPath)})` : 'bez fotky', ...(w.pageUrl ? [`[web](${w.pageUrl})`] : [])].join(' · '),
        '', ...attributeLines(d).flatMap((l) => [l, '']), ...messageLines(notes.get(w.yamlPath)));
    }
  }
  // messages of other files (years, photos, the home page) and general ones (tags, techniques)
  const others = [...notes].filter(([file]) => !shown.has(file));
  if (others.length) {
    toc.push(`[Ostatní](#${anchor('Ostatní')})`);
    body.push('', '## Ostatní', '');
    for (const [file, n] of others) body.push(`**${escText(file || 'Obecně')}**`, '', ...messageLines(n), '');
  }

  const counts = countCodes([...notes.values()]);
  const codeLines = [...counts]
    .sort(([a, x], [b, y]) => LEVELS.indexOf(CODES[a].level) - LEVELS.indexOf(CODES[b].level) || y - x || a.localeCompare(b))
    .map(([code, n]) => `- \`${code}\` ×${n} · ${LEVEL_LABELS[CODES[code].level]}: ${CODES[code].text}`);
  const published = works.filter((w) => w.data?.meta_draft !== true).length;
  const withErrors = works.filter((w) => notes.get(w.yamlPath)?.error.length).length;
  const head = [
    '# Přehled všech děl',
    '',
    'Všechno o každém obrazu na jedné stránce: všechny údaje z popisu a co o něm říká poslední běh zpracování. '
      + 'Hledej v prohlížeči (Ctrl+F / Cmd+F): název, kód obrazu, štítek, nebo kód hlášky (např. `bez-rozmeru`) najde všechny stejné případy. '
      + 'Píše ho automatika při každém běhu, ručně needitovat.',
    '',
    `Děl ${works.length}: zveřejněných ${published}, rozpracovaných ${works.length - published}, s chybou ${withErrors}.`,
    '',
    toc.join(' · '),
    '',
    '## Hlášky',
    '',
    ...(codeLines.length ? codeLines : ['Žádné.']),
  ];
  return `${[...head, ...body].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/** The recommendation when the overview grew too big for GitHub to render (`bytes`: its size), or null. */
export const overviewSizeAdvice = (file, bytes) => (bytes > OVERVIEW_MAX_BYTES
  ? coded('prehled-velky', `${file}: přehled má ${Math.round(bytes / 1000)} kB, GitHub velké soubory nemusí zobrazit (nad ${Math.round(OVERVIEW_MAX_BYTES / 1000)} kB); dej vědět Liborovi`)
  : null);
