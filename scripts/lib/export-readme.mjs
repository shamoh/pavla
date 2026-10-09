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
  const info = about({ collection, pageUrl });
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
  const info = about({ collection, pageUrl });
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

/**
 * Overview README of a platform: `entries` [{ title, folder (relative to the platform folder), thumb (file name in
 * it), note }], in the order given.
 */
export function exportIndex(platform, entries) {
  const head = platform === 'instagram'
    ? ['# Fotky pro Instagram', '', 'Obrazy s `meta_instagram: true`. Každý má svou složku (stejně jako v `tvorba/`): fotky s popiskem, ve scénách ateliéru, detaily a text příspěvku.']
    : ['# Fotky pro Fler', '', 'Obrazy na prodej (`available`, `reserved`). Každý má svou složku (stejně jako v `tvorba/`): originál a mockupy s podpisem.'];
  if (!entries.length) return `${[...head, '', 'Zatím žádné.'].join('\n')}\n`;
  const rows = entries.map((e) => `<tr><td><a href="${e.folder}/"><img src="${e.folder}/${e.thumb}" width="120" alt="${escMd(e.title)}"></a></td>`
    + `<td><a href="${e.folder}/"><b>${escMd(e.title)}</b></a><br>${escMd(e.note ?? '')}</td></tr>`);
  return `${[...head, '', `Celkem ${entries.length}.`, '', '<table>', ...rows, '</table>'].join('\n')}\n`;
}
