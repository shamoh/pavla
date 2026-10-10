// README.md in the export folders of the content repository: GitHub shows it right under the list of files, so the
// author sees at a glance what is ready (photos as thumbnails, the text of the post ready to copy). Czech: for Pavla.
//   export/<platform>/README.md                          overview: every work with exports, a thumbnail, a link
//   export/<platform>/[<collection>/]<slug>/README.md    one work: all its photos (and the text of the post)

import { captionFacts } from './instagram.mjs';
import { withParams } from './pinterest.mjs';

/**
 * UTM parameters of the link in an Instagram story (the link sticker): Google Analytics files the visit under
 * instagram / story even though the app of Instagram sends no referrer. The page itself is the same.
 */
export const STORY_UTM = { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'story' };

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
 * README of the Instagram folder of a work: { work, year, files: { captions, scenes, panorama, story, details } (file names;
 * panorama and story optional),
 * post (the text of the post, instagramPost), collection (title), pageUrl (the work's page on the site) }.
 */
export function instagramReadme({ work, year, files, post, collection = '', pageUrl = '' }) {
  const info = [publishedLine(work, 'instagram'), ...about({ collection, pageUrl })];
  const parts = [
    `# Instagram: ${escMd(work.title)}`,
    '',
    `${escMd(captionFacts(work, year))}. Fotky příspěvku jsou 4:5 (1080 × 1350), příběh 9:16. Klikni na fotku pro plnou velikost a stažení.`,
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
  if (files.panorama?.length) {
    parts.push('', '## Panorama pro karusel', '',
      `Obraz přes ${files.panorama.length} navazující snímky: při listování karuselem plynule ubíhá. Dej je hned za první fotku `
      + 's popiskem, v tomto pořadí (pak scény a detaily). Všechny fotky příspěvku nahraj najednou jako jeden karusel.', '',
      thumbs(files.panorama, Math.round(THUMB * 0.8)));
  }
  if (files.scenes.length) parts.push('', '## Ve scénách ateliéru', '', thumbs(files.scenes));
  if (files.details.length) parts.push('', '## Detaily', '', thumbs(files.details));
  if (files.story) {
    parts.push('', '## Příběh (story)', '',
      'Fotka 9:16 pro příběh. Pod popiskem je volné místo na nálepku s odkazem'
      + (pageUrl ? ': vlož nálepku „Odkaz“ s adresou níže (tlačítkem vpravo nahoře ji zkopíruješ; značky na konci řeknou '
        + 'Google Analytics, že návštěva přišla z příběhu).' : '.')
      + ' Příběh zmizí po 24 hodinách, pokud ho neuložíš do Výběru (např. podle kolekce).',
      ...(pageUrl ? ['', fence(withParams(pageUrl, STORY_UTM))] : []),
      '', thumbs([files.story], Math.round(THUMB * 0.8)));
  }
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

/**
 * "Příběh kolekce" of an overview: the stories of the works of a collection one after another (Instagram plays the
 * frames of a story in a row; every frame gets the sticker with the link to its work) and the link of the collection.
 */
function collectionStory(entries) {
  const frames = entries.filter((e) => e.story).sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
  if (!frames.length) return [];
  const url = frames.find((e) => e.collectionUrl)?.collectionUrl;
  return [
    '', '### Příběh kolekce', '',
    `Ochutnávka kolekce: přidej do příběhu ${frames.length === 1 ? 'tento snímek' : 'tyto snímky v tomhle pořadí'}, na každý nálepku „Odkaz“ `
      + 's adresou jeho obrazu (níže, tlačítkem vpravo nahoře ji zkopíruješ). Instagram je přehraje jeden po druhém.', '',
    frames.map((e) => `<a href="${e.folder}/${e.story}"><img src="${e.folder}/${e.story}" width="110" alt="${escMd(e.title)}"></a>`).join('\n'),
    ...frames.flatMap((e, i) => ['', `${i + 1}. ${escMd(e.title)}`, '', ...(e.storyUrl ? [fence(e.storyUrl)] : [])]),
    ...(url ? ['', 'Odkaz na celou kolekci (na poslední snímek nebo do profilu):', '', fence(url)] : []),
  ];
}

/** Heading of the works without a collection in an overview. */
export const NO_COLLECTION = 'Mimo kolekce';

/**
 * Overview README of a platform: `entries` [{ title, folder (relative to the platform folder), thumb (file name in
 * it), note, collection (title, '' = none), url (where it is published, '' = not yet) }], grouped under a heading per
 * collection (alphabetically, the works without one last), in the given order within a group.
 * Instagram: a collection whose works have a story (`story`: its file name, `storyUrl`: the link of its sticker, `date`)
 * also gets "Příběh kolekce": the stories in the order of their dates and the links ready to copy, and the link of the
 * collection itself (`collectionUrl`, with the UTM of stories) for the last frame or the profile.
 */
export function exportIndex(platform, entries) {
  const p = PLATFORM[platform];
  const head = platform === 'instagram'
    ? ['# Fotky pro Instagram', '', 'Obrazy s `meta_instagram: true`. Každý má svou složku (stejně jako v `tvorba/`): fotky s popiskem, ve scénách ateliéru, panorama pro karusel (široké obrazy), příběh, detaily a text příspěvku.']
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
    if (platform === 'instagram' && key) lines.push(...collectionStory(groups.get(key)));
  }
  return `${lines.join('\n')}\n`;
}
