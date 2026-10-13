// README.md in the export folders of the content repository: GitHub shows it right under the list of files, so the
// author sees at a glance what is ready (photos as thumbnails, the text of the post ready to copy). Czech: for Pavla.
//   export/<platform>/README.md                          overview: every work with exports, a thumbnail, a link
//   export/<platform>/[<collection>/]<slug>/README.md    one work: all its photos (and the text of the post)
// export/draft/ is the same for the cut previews of drafts (draftReadme, draftIndex).

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
const about = ({ collection, pageUrl, code }) => [
  // the permanent code of the work (id): finds it on the site (search, /tvorba/<code>/) and in the content repository
  ...(code ? [`Kód obrazu: \`${code}\``] : []),
  ...(collection ? [`Kolekce: ${escMd(collection)}`] : []),
  ...(pageUrl ? [`Na webu: <${pageUrl}>`] : []),
];

/**
 * README of the Instagram folder of a work: { work, year, files: { captions, scenes, panorama, story, grid, details } (file
 * names; panorama, story and grid optional, grid see gridSection),
 * post (the text of the post, instagramPost), collection (title), pageUrl (the work's page on the site) }.
 */
export function instagramReadme({ work, year, files, post, collection = '', pageUrl = '' }) {
  const info = [publishedLine(work, 'instagram'), ...about({ collection, pageUrl, code: work.id })];
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
  if (files.grid) parts.push(...gridSection(files.grid));
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

/**
 * The profile grid in the README of a work: the preview, the tiles as they lie (`cols` in a row) and the order of
 * publishing with the text of every post ready to copy. `grid`: { tiles (file names in reading order), preview,
 * posts (gridPosts: in the order of publishing), cols }.
 */
function gridSection({ tiles, preview, posts, cols = 3 }) {
  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) rows.push(thumbs(tiles.slice(i, i + cols), 120));
  return [
    '', `## Mřížka na profilu (${cols} × ${tiles.length / cols})`, '',
    `Obraz rozřezaný na ${tiles.length} příspěvků 3:4, které na profilu dají dohromady jednu fotku (mezery mřížky jsou`
      + ' v obraze vynechané, takže na sebe dlaždice navazují). Takhle bude vypadat na profilu:', '',
    `<a href="${preview}"><img src="${preview}" width="360" alt="náhled mřížky"></a>`, '',
    'Dlaždice, jak leží na profilu:', '',
    rows.join('\n<br>\n'), '',
    '**Zveřejňuj pozpátku**, od pravé dolní dlaždice: nejnovější příspěvek je na profilu vlevo nahoře. Všechny za sebou,'
      + ' nic mezi ně, a celkový počet příspěvků na profilu drž v násobcích tří (jinak se mřížka posune). Připnuté'
      + ' příspěvky mřížku posouvají taky.',
    ...posts.flatMap((p, i) => ['', `${i + 1}. \`${p.file}\``, '', fence(p.text)]),
  ];
}

const STATUS = { available: 'na prodej', reserved: 'rezervováno' };

/**
 * README of the Fler folder of a work: { work, year, files: { original, mockups } (file names), collection (title),
 * pageUrl (the work's page on the site) }.
 */
export function flerReadme({ work, year, files, collection = '', pageUrl = '' }) {
  const info = [publishedLine(work, 'fler'), ...about({ collection, pageUrl, code: work.id })];
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

/**
 * `entries` grouped by their `collection` (title, '' = none): { groups: Map(title -> entries in the given order),
 * order: the titles alphabetically, the works without a collection last }.
 */
function byCollection(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = e.collection || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return { groups, order: [...groups.keys()].sort((a, b) => (!a) - (!b) || a.localeCompare(b, 'cs')) };
}

/**
 * The entries of an overview split by the folder of their collection, for a README in each such folder (works without
 * a collection are left out): [{ dir, title, entries }] sorted by dir, the folders of the entries relative to `dir`.
 */
export function collectionIndexes(entries) {
  const groups = new Map();
  for (const e of entries) {
    const at = e.folder.lastIndexOf('/');
    if (at < 0) continue;
    const dir = e.folder.slice(0, at);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push({ ...e, folder: e.folder.slice(at + 1) });
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([dir, list]) => ({ dir, title: list[0].collection || dir, entries: list }));
}

/**
 * The head of an overview: in the README of a collection folder (`within`: the title of the collection) its title in
 * the heading and a link back to the whole overview one folder up.
 */
const overviewHead = (title, text, within) => (within
  ? [`# ${title}: ${escMd(within)}`, '', '[← Všechny](../README.md)', '', text]
  : [`# ${title}`, '', text]);

/** The heading of a group of an overview; none in the README of a collection folder (it is in its title). */
const groupHead = (key, within) => (within ? ['', '<table>'] : ['', `## ${escMd(key || NO_COLLECTION)}`, '', '<table>']);

/** Heading of the works without a collection in an overview. */
export const NO_COLLECTION = 'Mimo kolekce';

/**
 * Overview README of a platform: `entries` [{ title, folder (relative to the platform folder), thumb (file name in
 * it), code (id of the work, shown after its title), note, collection (title, '' = none), url (where it is published,
 * '' = not yet) }], grouped under a heading per
 * collection (alphabetically, the works without one last), in the given order within a group.
 * Instagram: a collection whose works have a story (`story`: its file name, `storyUrl`: the link of its sticker, `date`)
 * also gets "Příběh kolekce": the stories in the order of their dates and the links ready to copy, and the link of the
 * collection itself (`collectionUrl`, with the UTM of stories) for the last frame or the profile.
 * `within`: the title of a collection, for the README of its folder (collectionIndexes): its works only, no group
 * heading, a link back to the whole overview.
 */
export function exportIndex(platform, entries, { within = '' } = {}) {
  const p = PLATFORM[platform];
  const head = platform === 'instagram'
    ? overviewHead('Fotky pro Instagram', 'Obrazy s `meta_instagram: true`. Každý má svou složku (stejně jako v `tvorba/`): fotky s popiskem, ve scénách ateliéru, panorama pro karusel (široké obrazy), příběh, detaily a text příspěvku.', within)
    : overviewHead('Fotky pro Fler', 'Obrazy na prodej (`available`, `reserved`). Každý má svou složku (stejně jako v `tvorba/`): originál a mockupy s podpisem.', within);
  if (!entries.length) return `${[...head, '', 'Zatím žádné.'].join('\n')}\n`;
  const done = entries.filter((e) => e.url).length;
  const { groups, order } = byCollection(entries);
  const lines = [...head, '', `Celkem ${entries.length}, z toho ${p.done} ${done}, ${p.todo} ${entries.length - done}.`];
  for (const key of order) {
    lines.push(...groupHead(key, within));
    for (const e of groups.get(key)) {
      const state = e.url ? `✓ <a href="${e.url}">${p.done}</a>` : `○ ${p.todo}`;
      lines.push(`<tr><td><a href="${e.folder}/"><img src="${e.folder}/${e.thumb}" width="120" alt="${escMd(e.title)}"></a></td>`
        + `<td><a href="${e.folder}/"><b>${escMd(e.title)}</b></a>${e.code ? ` <code>${escMd(e.code)}</code>` : ''}<br>${escMd(e.note ?? '')}<br>${state}</td></tr>`);
    }
    lines.push('</table>');
    if (platform === 'instagram' && key) lines.push(...collectionStory(groups.get(key)));
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- cut previews of drafts (export/draft/)

/** The longer side of the cut previews in export/draft/ in px (the artifact of the run has them in full size). */
export const DRAFT_EDGE = 2000;

/** The four corner close-ups of a draft as a 2 × 2 table: top left, top right / bottom left, bottom right. */
const cornerTable = (files) => {
  const cell = (k) => `<td><a href="${files[`frames-${k}`]}"><img src="${files[`frames-${k}`]}" width="400" alt="${files[`frames-${k}`]}"></a></td>`;
  return `<table>\n<tr>${cell('tl')}${cell('tr')}</tr>\n<tr>${cell('bl')}${cell('br')}</tr>\n</table>`;
};

/** Why a draft has no cut previews (`noPreviews` of draftReadme), for its README. */
const NO_PREVIEWS = {
  photo: 'Fotka obrazu zatím chybí: náhledy ořezu vzniknou, až ji nahraješ vedle popisu.',
  errors: 'Náhledy ořezu zatím nejsou: vzniknou, až půjde fotku s rohy z `meta_corners` zpracovat (viz chyby výše).',
};

/**
 * The state of a description in short, for the overview of drafts: "✗ 1 · ⚠ 2 · 💡 3 · ✎ 4" (errors, "Ke kontrole",
 * recommendations, attributes to fill in; groups without messages left out), '' when the run says nothing.
 * `notes`: workNotes in scripts/lib/summary.mjs.
 */
export function noteMarks(notes) {
  return [['✗', notes?.errors], ['⚠', notes?.review], ['💡', notes?.advice], ['✎', notes?.todo]]
    .filter(([, items]) => items?.length).map(([mark, items]) => `${mark} ${items.length}`).join(' · ');
}

/** The fingerprint of the previews in the README of a draft (an HTML comment, GitHub does not show it). */
const fingerprintComment = (fingerprint) => `<!-- otisk: ${fingerprint} -->`;

/** The fingerprint written into a README of a draft by draftReadme, or null. */
export const readmeFingerprint = (text) => /<!-- otisk: ([0-9a-f]+) -->/.exec(String(text ?? ''))?.[1] ?? null;

/**
 * README of the folder of a draft in export/draft/: { work, year, files: { backgrounds, cut, frames } (file names; null
 * = no previews yet), corners (meta_corners as YAML lines), collection (title), fingerprint (of the previews, kept as
 * a comment), notes (workNotes in scripts/lib/summary.mjs: what the run summary says about this work; null = none) }.
 */
export function draftReadme({ work, year, files, corners = '', collection = '', fingerprint = '', notes = null, noPreviews = 'errors' }) {
  const sections = notes ? [
    ['✗ Chyby', 'Brání zveřejnění, oprav je v popisu obrazu.', notes.errors],
    ['⚠ Ke kontrole', 'Nic nezastaví, ale stojí za pohled.', notes.review],
    ['💡 Doporučení', 'Nic nebrání zveřejnění, jen by to web vylepšilo.', notes.advice],
    ['✎ Zbývá doplnit', 'Údaje, u kterých v komentáři ještě zůstalo DOPLNIT: zkontroluj hodnotu, pak slovo DOPLNIT smaž.', notes.todo],
  ].filter(([, , items]) => items.length) : [];
  const state = !notes ? [] : [
    '',
    '## Stav popisu',
    '',
    sections.length ? 'Totéž, co o tomto obraze říká souhrn posledního běhu zpracování.' : 'Poslední běh zpracování u tohoto obrazu nic nehlásí.',
    ...sections.flatMap(([title, text, items]) => ['', `### ${title} (${items.length})`, '', text, '', ...items.map((i) => `- ${escMd(i)}`)]),
  ];
  const images = !files ? ['', '## Náhledy ořezu', '', NO_PREVIEWS[noPreviews] ?? NO_PREVIEWS.errors] : [
    '',
    '## Na papíru webu',
    '',
    'Obraz po ořezu na světlém a tmavém papíru: takhle bude vypadat na webu.',
    '',
    thumbs([files.backgrounds], 800),
    '',
    '## Ořez',
    '',
    'Celá fotka s čarami ořezu; čísla jsou pixely původní fotky (jako v `meta_corners`).',
    '',
    thumbs([files.cut], 800),
    '',
    '## Rámečky',
    '',
    'Celá fotka s rámečky vzdáleností od krajů, podle nich se rohy dají opravit ručně. Nahoře rohy fotky zblízka',
    '(300 × 300 bodů fotky, dvakrát zvětšené; klikni pro plnou velikost), čáry po 5 bodech do 100 a po 10 do 130 od krajů rohu:',
    'číslo u čáry je hodnota pro `meta_corners`.',
    '',
    ...(files['frames-tl'] ? [cornerTable(files), ''] : []),
    thumbs([files.frames], 800),
  ];
  const parts = [
    `# Rozpracováno: ${escMd(work.title)}`,
    '',
    (files
      ? `${escMd(captionFacts(work, year))}. Náhledy ořezu pozadí (podlahy nebo zdi kolem obrazu), než obraz zveřejníš (\`meta_draft: false\`): pak tahle složka sama zmizí.`
        + ` Zmenšené na ${DRAFT_EDGE} px, v plné velikosti jsou ke stažení jako „nahledy-orezu“ dole na stránce běhu zpracování. Klikni na obrázek pro plnou velikost.`
      : `${escMd(captionFacts(work, year))}. Rozpracovaný obraz: až ho zveřejníš (\`meta_draft: false\`), tahle složka sama zmizí.`),
    ...(work.id || collection ? ['', about({ collection, code: work.id }).join('  \n')] : []),
    ...state,
    ...images,
    ...(corners ? ['', '## Použité rohy', '', '```yaml', corners, '```'] : []),
    ...(fingerprint ? ['', fingerprintComment(fingerprint)] : []),
  ];
  return `${parts.join('\n')}\n`;
}

/** The legend of noteMarks in the overview of drafts. */
const MARKS_LEGEND = '✗ chyby, ⚠ ke kontrole, 💡 doporučení, ✎ zbývá doplnit (počty)';

/**
 * Overview README of export/draft/: `entries` [{ title, code (id), folder, thumb (null = no preview), note, collection (title,
 * '' = none), marks (noteMarks: the state of its description) }], grouped like exportIndex; `within` like exportIndex.
 */
export function draftIndex(entries, { within = '' } = {}) {
  const head = [
    ...overviewHead('Rozpracované obrazy', 'Obrazy s `meta_draft: true`, stav jejich popisu a náhledy ořezu pozadí. Každý má svou složku (stejně jako v `tvorba/`); po zveřejnění zmizí.', within),
    '', `Značky stavu popisu (podrobně v README obrazu): ${MARKS_LEGEND}.`,
  ];
  if (!entries.length) return `${[...head, '', 'Zatím žádné.'].join('\n')}\n`;
  const { groups, order } = byCollection(entries);
  const lines = [...head, '', `Celkem ${entries.length}.`];
  for (const key of order) {
    lines.push(...groupHead(key, within));
    for (const e of groups.get(key)) {
      const thumb = e.thumb ? `<a href="${e.folder}/"><img src="${e.folder}/${e.thumb}" width="160" alt="${escMd(e.title)}"></a>` : 'bez náhledu';
      lines.push(`<tr><td>${thumb}</td>`
        + `<td><a href="${e.folder}/"><b>${escMd(e.title)}</b></a>${e.code ? ` <code>${escMd(e.code)}</code>` : ''}<br>${escMd(e.note ?? '')}${e.marks ? `<br>${e.marks}` : ''}</td></tr>`);
    }
    lines.push('</table>');
  }
  return `${lines.join('\n')}\n`;
}
