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
 * The attributes of a description in file order, empty ones and `skip` left out: `flags` first, then short ones
 * "key: value", all in one paragraph joined by " · ", long texts each in a paragraph of its own.
 */
export function attributeLines(data, { skip = [], flags = [] } = {}) {
  const short = [...flags];
  const long = [];
  for (const [key, value] of Object.entries(data ?? {})) {
    if (skip.includes(key) || isEmpty(value)) continue;
    const text = escText(formatValue(value));
    (typeof value === 'string' && text.length > INLINE_CHARS ? long : short).push(`${key}: ${text}`);
  }
  return [...(short.length ? [short.join(' · ')] : []), ...long];
}

/**
 * Attributes of a work told elsewhere or as a word (they are in the heading, the line of the description or the flags),
 * never as "key: value": title, id, date, size_cm, featured (heading), description (its own line), meta_corners (only
 * for the pipeline), the switches meta_draft, meta_instagram (with the link instagram), meta_pinterest, mockups (flags).
 */
const WORK_TOLD = ['title', 'id', 'date', 'size_cm', 'featured', 'description', 'meta_corners', 'meta_draft', 'meta_instagram', 'meta_pinterest', 'mockups'];

/** The size of a work for its heading: "[ 21 x 15 ]", '' without a valid one. */
export const sizeMark = (size) => (Array.isArray(size) && size.length === 2 && size.every((n) => Number(n) > 0) ? `[ ${size[0]} x ${size[1]} ]` : '');

/** The day of a work for its heading: "2026-09-27" ('' without one). */
const dayOf = (date) => (date instanceof Date ? date.toISOString().slice(0, 10) : typeof date === 'string' ? date.trim() : '');

/**
 * The heading of a work, Markdown ready: "<title> · <id> ★ @ <date> [ w x h ]" (star only for featured: true, date and
 * size only when set; only the title is escaped, the brackets of the size are no link). `fallback`: the title when the
 * work has none.
 */
export function workHeading(d, id, fallback) {
  const title = escText(typeof d.title === 'string' && d.title.trim() ? d.title.trim() : fallback);
  const day = dayOf(d.date);
  const size = sizeMark(d.size_cm);
  return `${title}${id ? ` · ${id}` : ''}${d.featured === true ? ' ★' : ''}${day ? ` @ ${day}` : ''}${size ? ` ${size}` : ''}`;
}

/** Status of a work that is the default (nothing to tell): left out of the attributes. */
const DEFAULT_STATUS = 'not-for-sale';

/** Detail photos of a work, each a line "detail <name>: <caption>" ("detail <name>" without a caption). */
const detailLines = (details) => (details && typeof details === 'object' && !Array.isArray(details)
  ? Object.entries(details).map(([name, caption]) => {
    const text = escText(formatValue(caption));
    return `detail ${escText(name)}${text ? `: ${text}` : ''}`;
  })
  : []);

/**
 * The lines of a work under its links: its description (a paragraph of its own), each detail photo with its caption
 * (a line each), then the switches that are on as words ("draft", "instagram: <link or ->", "pinterest", "mockups")
 * and the other attributes (attributeLines; the default status not-for-sale left out). The link `instagram` goes with
 * meta_instagram: true; without it, it is an attribute like any other.
 */
export function workLines(d) {
  const description = typeof d.description === 'string' && d.description.trim() ? [escText(d.description)] : [];
  const details = detailLines(d.details);
  const instagram = typeof d.instagram === 'string' && d.instagram.trim() ? escText(d.instagram) : '-';
  const flags = [
    ...(d.meta_draft === true ? ['draft'] : []),
    ...(d.meta_instagram === true ? [`instagram: ${instagram}`] : []),
    ...(d.meta_pinterest === true ? ['pinterest'] : []),
    ...(d.mockups === true ? ['mockups'] : []),
  ];
  const skip = [
    ...WORK_TOLD,
    ...(d.meta_instagram === true ? ['instagram'] : []),
    ...(details.length ? ['details'] : []),
    ...(d.status === DEFAULT_STATUS ? ['status'] : []),
  ];
  return [...description, ...details, ...attributeLines(d, { skip, flags })];
}

/** The lines of a collection (or "Mimo kolekce") under its link: its description first, the title is the heading. */
const collectionLines = (d) => [
  ...(typeof d?.description === 'string' && d.description.trim() ? [escText(d.description)] : []),
  ...attributeLines(d, { skip: ['title', 'description'] }),
];

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

/** Marks of the levels (the same as the READMEs of drafts, noteMarks), and of a file without messages. */
export const LEVEL_MARKS = { error: '✗', review: '⚠', advice: '💡', todo: '✎' };
export const OK_MARK = '✓';

/** "- <mark> `kód` text" lines of the messages of a file, by level; "✓" without any. */
function messageLines(notes) {
  const items = RUN_LEVELS.flatMap((level) => (notes?.[level] ?? []).map((m) => {
    const codes = codesOf(m);
    return `- ${LEVEL_MARKS[level]} ${codes.length ? codes.map((c) => `\`${c}\``).join(' ') : `\`${level}\``} ${escText(withoutCodes(m))}`;
  }));
  return items.length ? items : [OK_MARK];
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
      body.push(`[${g.meta.yamlPath}](${link(g.meta.yamlPath)})`, '', ...collectionLines(g.meta.data).flatMap((l) => [l, '']), ...messageLines(notes.get(g.meta.yamlPath)));
    }
    for (const w of [...g.works].sort(byDate)) {
      shown.add(w.yamlPath);
      const d = w.data ?? {};
      const heading = workHeading(d, w.id, w.yamlPath);
      anchor(heading);
      body.push('', `### ${heading}`, '',
        [`[${escText(w.yamlPath.split('/').pop())}](${link(w.yamlPath)})`, w.photoPath ? `[foto](${link(w.photoPath)})` : 'bez fotky', ...(w.pageUrl ? [`[web](${w.pageUrl})`] : [])].join(' · '),
        '', ...workLines(d).flatMap((l) => [l, '']), ...messageLines(notes.get(w.yamlPath)));
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
      + `Značky: ${OK_MARK} bez hlášek, ${LEVEL_MARKS.error} chyba, ${LEVEL_MARKS.review} ke kontrole, ${LEVEL_MARKS.advice} doporučení, ${LEVEL_MARKS.todo} zbývá doplnit. `
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
