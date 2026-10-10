// README.md in the export folders of the content repository: GitHub shows it right under the list of files, so the
// author sees at a glance what is ready (photos as thumbnails, the text of the post ready to copy). Czech: for Pavla.
//   export/<platform>/README.md                          overview: every work with exports, a thumbnail, a link
//   export/<platform>/[<collection>/]<slug>/README.md    one work: all its photos (and the text of the post)

import { captionFacts } from './instagram.mjs';

/** Width of the thumbnails in px (GitHub keeps the width attribute of an <img>). */
export const THUMB = 260;

const escMd = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
const thumbs = (files, width = THUMB) => files.map((f) => `<a href="${f}"><img src="${f}" width="${width}" alt="${f}"></a>`).join('\n');
/** A ``` block that a text containing ``` cannot close. */
const fence = (text) => {
  const ticks = '`'.repeat(Math.max(3, ...[...String(text).matchAll(/`+/g)].map((m) => m[0].length + 1)));
  return `${ticks}text\n${String(text).trimEnd()}\n${ticks}`;
};

/** Where a work is already published, per platform: its attribute and the words of the lines. */
const PLATFORM = {
  instagram: { attr: 'instagram', label: 'Na Instagramu', done: 'na Instagramu', todo: 'zatím nezveřejněno' },
  fler: { attr: 'fler', label: 'Na Fleru', done: 'na Fleru', todo: 'zatím nepřidáno' },
};

/** The link of a work on a platform (its `instagram` / `fler` attribute), or '' while it is not there yet. */
export const publishedUrl = (work, platform) => {
  const v = work?.[PLATFORM[platform].attr];
  return typeof v === 'string' && /^https?:\/\//.test(v.trim()) ? v.trim() : '';
};

/** "Na Instagramu: <url>" or "… zatím nezveřejněno (…)": the line saying whether a work is published on a platform. */
const publishedLine = (work, platform) => {
  const p = PLATFORM[platform], url = publishedUrl(work, platform);
  return url ? `${p.label}: <${url}>` : `${p.label}: ${p.todo} (odkaz doplň do popisu obrazu jako \`${p.attr}:\`)`;
};

/** "Kolekce …" and "Na webu: <url>" lines of a work (only those it has). */
const about = ({ collection, pageUrl }) => [
  ...(collection ? [`Kolekce: ${escMd(collection)}`] : []),
  ...(pageUrl ? [`Na webu: <${pageUrl}>`] : []),
];

/**
 * README of the Instagram folder of a work: { work, year, files: { captions, scenes, details } (file names),
 * post (the text of the post, instagramPost), collection (title), pageUrl (the work's page on the site) }.
 */
export function instagramReadme({ work, year, files, post, collection = '', pageUrl = '' }) {
  const info = [publishedLine(work, 'instagram'), ...about({ collection, pageUrl })];
  const parts = [
    `# Instagram: ${escMd(work.title)}`,
    '',
    `${escMd(captionFacts(work, year))}. Fotky jsou 4:5 (1080 × 1350). Klikni na fotku pro plnou velikost a stažení.`,
    ...(info.length ? ['', info.join('  \n')] : []),
    '',
    '## Text příspěvku',
    '',
    'Tlačítkem vpravo nahoře u textu ho zkopíruješ.',
    '',
    fence(post),
    '',
    '## S popiskem',
    '',
    'Na papíru barev webu (Papír, Pergamen, Noc). V mřížce profilu se ukazuje první fotka příspěvku: drž jednu barvu.',
    '',
    thumbs(files.captions),
  ];
  if (files.scenes.length) parts.push('', '## Ve scénách ateliéru', '', thumbs(files.scenes));
  if (files.details.length) parts.push('', '## Detaily', '', thumbs(files.details));
  return `${parts.join('\n')}\n`;
}

const STATUS = { available: 'na prodej', reserved: 'rezervováno' };

/**
 * README of the Fler folder of a work: { work, year, files: { original, mockups } (file names), collection (title),
 * pageUrl (the work's page on the site) }.
 */
export function flerReadme({ work, year, files, collection = '', pageUrl = '' }) {
  const info = [publishedLine(work, 'fler'), ...about({ collection, pageUrl })];
  const facts = [captionFacts(work, year), work.support].filter(Boolean).join(', ');
  const price = typeof work.price === 'number' ? `${work.price.toLocaleString('cs-CZ')} Kč` : '';
  const description = typeof work.description === 'string' && !/^\s*DOPLNIT/.test(work.description) ? work.description.trim() : '';
  const parts = [
    `# Fler: ${escMd(work.title)}`,
    '',
    `${escMd(facts)}.`,
    '',
    [STATUS[work.status] && `Stav: **${STATUS[work.status]}**`, price && `Cena: **${price}**`].filter(Boolean).join(' · '),
    ...(info.length ? ['', info.join('  \n')] : []),
    ...(description ? ['', '## Popis', '', fence(description)] : []),
    '',
    '## Originál',
    '',
    thumbs(files.original),
  ];
  if (files.mockups.length) parts.push('', '## Mockupy', '', thumbs(files.mockups));
  parts.push('', 'Všechny fotky mají podpis v pravém dolním rohu. Klikni na fotku pro plnou velikost a stažení.');
  return `${parts.join('\n')}\n`;
}

/** Heading of the works without a collection in an overview. */
export const NO_COLLECTION = 'Mimo kolekce';

/**
 * Overview README of a platform: `entries` [{ title, folder (relative to the platform folder), thumb (file name in
 * it), note, collection (title, '' = none), url (where it is published, '' = not yet) }], grouped under a heading per
 * collection (alphabetically, the works without one last), in the given order within a group.
 */
export function exportIndex(platform, entries) {
  const p = PLATFORM[platform];
  const head = platform === 'instagram'
    ? ['# Fotky pro Instagram', '', 'Obrazy s `meta_instagram: true`. Každý má svou složku (stejně jako v `tvorba/`): fotky s popiskem, ve scénách ateliéru, detaily a text příspěvku.']
    : ['# Fotky pro Fler', '', 'Obrazy na prodej (`available`, `reserved`). Každý má svou složku (stejně jako v `tvorba/`): originál a mockupy s podpisem.'];
  if (!entries.length) return `${[...head, '', 'Zatím žádné.'].join('\n')}\n`;
  const done = entries.filter((e) => e.url).length;
  const groups = new Map();
  for (const e of entries) {
    const key = e.collection || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const order = [...groups.keys()].sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'cs'));
  const lines = [...head, '', `Celkem ${entries.length}, z toho ${p.done} ${done}, ${p.todo} ${entries.length - done}.`];
  for (const key of order) {
    lines.push('', `## ${escMd(key || NO_COLLECTION)}`, '', '<table>');
    for (const e of groups.get(key)) {
      const state = e.url ? `✓ <a href="${e.url}">${p.done}</a>` : `○ ${p.todo}`;
      lines.push(`<tr><td><a href="${e.folder}/"><img src="${e.folder}/${e.thumb}" width="120" alt="${escMd(e.title)}"></a></td>`
        + `<td><a href="${e.folder}/"><b>${escMd(e.title)}</b></a><br>${escMd(e.note ?? '')}<br>${state}</td></tr>`);
    }
    lines.push('</table>');
  }
  return `${lines.join('\n')}\n`;
}
