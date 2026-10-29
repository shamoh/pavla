// Recommendations for the descriptions of works, collections, years, the home page and photos: nothing wrong enough to
// stop a run, only what would make the site better (shown in the run summary under "Doporučení",
// scripts/lib/summary.mjs). Messages are Czech ("<file>: <what and how>") because Pavla reads them. Texts still starting with DOPLNIT are left to the checks.

import { untranslatedWords } from './instagram.mjs';
import { todoKeys } from './metadata-yaml.mjs';
import { plainText } from './rich-text.mjs';
import { COLLECTION_SKELETON_TEXT, TODO, UNCOLLECTED_SKELETON_TEXT, yearSkeletonText } from './schema.mjs';
import { SEARCH_TITLE_MAX } from './seo.mjs';
import { detailKey, isInstagramUrl, isOnSale, validSize, wantsFler, wantsInstagram, wantsMockups, workPath } from './works.mjs';

/** The first letter (after quotes, brackets and digits) is a small one: "ráno" yes, "„ráno“" yes, "3 ovce" no. */
export const startsLowercase = (text) => /^[^\p{L}\p{N}]*\p{Ll}/u.test(text);
/** Ends a sentence: a full stop, "!", "?" or "…", possibly followed by a closing quote or bracket. */
export const endsSentence = (text) => /[.!?…]["“”»)]*$/.test(text);
/** Ends with a single full stop ("Ráno." yes, "Ráno..." and "Ráno…" no). */
export const endsWithFullStop = (text) => /[^.]\.$|^\.$/.test(text);

/** A text worth advising on: a non-empty string that is not a DOPLNIT placeholder. */
const textOf = (value) => (typeof value === 'string' && value.trim() && !value.trim().startsWith(TODO) ? value.trim() : null);

/** Advice on a sentence (description, caption of a detail): a capital letter first, a full stop last. */
function sentenceAdvice(where, at, value) {
  const text = textOf(value);
  if (!text) return [];
  return [
    startsLowercase(text) && `${where}: ${at} začíná malým písmenem [text-male-pismeno]`,
    !endsSentence(text) && `${where}: ${at} by měl končit tečkou [text-bez-tecky]`,
  ].filter(Boolean);
}

/** Advice on a title: a capital letter first, no full stop last. */
function titleAdvice(where, value) {
  const title = textOf(value);
  if (!title) return [];
  return [
    startsLowercase(title) && `${where}: title začíná malým písmenem [nazev-male-pismeno]`,
    endsWithFullStop(title) && `${where}: title by neměl končit tečkou [nazev-s-teckou]`,
  ].filter(Boolean);
}

/**
 * Characters of a work title that fit the page title search results show (SEARCH_TITLE_MAX with " · <site title>"
 * after it, Base.astro).
 */
export const workTitleChars = (siteTitle = '') => SEARCH_TITLE_MAX - [...` · ${siteTitle}`].length;

/**
 * Recommendations for all works (drafts too, they are the ones being written): ["<file>: <advice>"]. `siteTitle`
 * (site.title of site.config.yaml) ends every page title, so it decides how long a work title may be.
 */
export function workAdvice(works, { siteTitle = '' } = {}) {
  const advice = [];
  const titleChars = workTitleChars(siteTitle);
  for (const w of works) {
    const where = workPath(w);
    const data = w.data ?? {};
    if (!Array.isArray(data.tags) || data.tags.length === 0) advice.push(`${where}: nemá štítky (tags), podle nich se v galerii filtruje [bez-stitku]`);
    advice.push(...titleAdvice(where, data.title));
    const title = textOf(data.title);
    if (title && [...title].length > titleChars) {
      advice.push(`${where}: název má ${[...title].length} znaků, ve výsledcích vyhledávání a v záložce prohlížeče se zkrátí; celý se vejde do ${titleChars} znaků [dlouhy-nazev]`);
    }
    advice.push(...sentenceAdvice(where, 'text', plainText(data.text) || data.text));
    if (data.details && typeof data.details === 'object') {
      for (const [name, caption] of Object.entries(data.details)) advice.push(...sentenceAdvice(where, `popisek detailu ${name}`, caption));
    }
    if (isOnSale(data.status) && !wantsMockups(data)) {
      advice.push(`${where}: je na prodej, ale nemá mockupy (mockups: true ukáže obraz v interiéru na webu i na Fleru) [prodej-bez-mockupu]`);
    }
  }
  return advice;
}

// The gallery selects have a fixed width on a computer (WorkGallery.astro, so the filters stay on one line): closed,
// a longer option is cut ("…"), opened, the list shows it whole. These many characters of a name still show whole
// (measured in the browser at max-width 11em / 13em with ordinary Czech text; the worst case of the whole row is
// every filter shown with the longest texts and 9999 works, which still fits a 1280 px window).
/** Characters of a technique the closed "Technika" select shows whole (its count may be cut). */
export const TECHNIQUE_CHARS = 14;
/** Characters of a collection title the closed "Kolekce" select shows whole (its count may be cut). */
export const COLLECTION_TITLE_CHARS = 19;

/** Advice on a collection title too long for the closed "Kolekce" select of the gallery. */
function collectionTitleAdvice(where, value) {
  const title = textOf(value);
  if (!title || [...title].length <= COLLECTION_TITLE_CHARS) return [];
  return [`${where}: název kolekce má ${[...title].length} znaků, ve výběru Kolekce v galerii se zkrátí (celý je vidět po rozbalení); celý se vejde do ${COLLECTION_TITLE_CHARS} znaků [dlouhy-nazev-kolekce]`];
}

/**
 * Advice on techniques too long for the closed "Technika" select of the gallery, once per technique with the number
 * of its works (drafts too). ["Technika „…“: …"]
 */
export function techniqueAdvice(works) {
  const counts = new Map();
  for (const w of works) {
    const t = textOf(w.data?.technique);
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts]
    .filter(([t]) => [...t].length > TECHNIQUE_CHARS)
    .sort((a, b) => a[0].localeCompare(b[0], 'cs'))
    .map(([t, n]) => `Technika „${t}“ (${worksCount(n)}) má ${[...t].length} znaků, ve výběru Technika v galerii se zkrátí (celá je vidět po rozbalení); celá se vejde do ${TECHNIQUE_CHARS} znaků [dlouha-technika]`);
}

/**
 * The sample sentence of a new skeleton (COLLECTION_SKELETON_TEXT, yearSkeletonText, UNCOLLECTED_SKELETON_TEXT) still
 * as the text: it is on the site, so a recommendation to write an own one. Compared by meaning (plainText).
 */
function sampleAdvice(where, text, sample) {
  if (!sample || typeof text !== 'string' || plainText(text) !== plainText(sample)) return [];
  return [`${where}: text je pořád vzorová věta z kostry („${sample.trim()}“), je vidět na webu; napiš místo ní vlastní text [vzorovy-text]`];
}

/**
 * Recommendations for the texts of collections (title, text), years, the home page and the works without a
 * collection (text), as prepareCollections / prepareYears / prepareHome / prepareUncollected give them
 * ({ yamlPath, data }), and of photos (alt, caption),
 * as preparePhotos gives them ({ name, data }).
 */
export function pageAdvice({ collections = [], years = [], home = null, uncollected = null, photos = [] }) {
  const pages = [
    ...collections.map((c) => [c, true, COLLECTION_SKELETON_TEXT]), ...years.map((y) => [y, false, yearSkeletonText(y.year)]),
    ...(home ? [[home, false, null]] : []), ...(uncollected ? [[uncollected, false, UNCOLLECTED_SKELETON_TEXT]] : []),
  ];
  return [
    ...pages.flatMap(([page, titled, sample]) => [
      ...(titled ? [...titleAdvice(page.yamlPath, page.data?.title), ...collectionTitleAdvice(page.yamlPath, page.data?.title)] : []),
      ...sentenceAdvice(page.yamlPath, 'text', plainText(page.data?.text) || page.data?.text),
      ...sampleAdvice(page.yamlPath, page.data?.text, sample),
    ]),
    ...photos.flatMap((p) => ['alt', 'caption'].flatMap((key) => sentenceAdvice(`fotky/${p.name}.yaml`, key, p.data?.[key]))),
  ];
}

/**
 * Descriptions with attributes still marked DOPLNIT at their technical comment (`todoKeys` of
 * scripts/lib/metadata-yaml.mjs): `files` [{ file (relative to the content repository), text }], one line
 * "<file>: <attributes in file order>" per file, for the block "Zbývá doplnit" of the run summary (formatSummary).
 * `skip`: files reported elsewhere (published works under "Ke kontrole").
 */
export function todoAdvice(files, skip = new Set()) {
  return files
    .filter(({ file }) => !skip.has(file))
    .map(({ file, text }) => [file, todoKeys(text)])
    .filter(([, keys]) => keys.length)
    .map(([file, keys]) => `${file}: ${keys.join(', ')}`);
}

// Care of the site: what a visitor would miss (published works only) and what was forgotten (drafts, links).

/** The master photo of a work should have at least this many px on its shorter side (the height of an Instagram photo). */
export const MIN_PHOTO_SIDE = 1350;

/** A draft older than this many days (since its description came into git) is a recommendation. */
export const DRAFT_DAYS = 30;

/** Instagram photos ready for this many days without the link of the post (`instagram`) are a recommendation. */
export const INSTAGRAM_LINK_DAYS = 14;

/** A year, collection or home page with at least this many published works should have more than one featured. */
export const FEATURED_GROUP = 3;

const hasText = (v) => typeof v === 'string' && v.trim() !== '';
const isPublished = (w) => w.data?.meta_draft !== true;

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/**
 * What a published work lacks on the site: its size (size_cm: the size on the site, the scale of mockups, the studio
 * scenes for Instagram) and its description (its page, search results, the pin). For every work: a detail photo
 * without a caption (`details`; a DOPLNIT placeholder is checked elsewhere). `works`: { yamlPath|…, data, details: [{ name }] }.
 */
export function careAdvice(works) {
  const advice = [];
  for (const w of works) {
    const where = workPath(w);
    const data = w.data ?? {};
    if (isPublished(w)) {
      if (!validSize(data.size_cm)) advice.push(`${where}: nemá rozměr (size_cm): na webu chybí, mockupy nedrží měřítko a nevzniknou scény ateliéru pro Instagram [bez-rozmeru]`);
      if (!hasText(data.text)) advice.push(`${where}: nemá text: ukáže se na stránce obrazu, ve výsledcích vyhledávání i v pinu [bez-popisu]`);
    }
    const captions = new Map(Object.entries(data.details && typeof data.details === 'object' ? data.details : {}).map(([k, v]) => [detailKey(k), v]));
    for (const { name } of w.details ?? []) {
      if (!hasText(captions.get(detailKey(name)))) advice.push(`${where}: detailní fotka „${name}“ nemá popisek (details: ${name}: …) [detail-bez-popisku]`);
    }
  }
  return advice;
}

/** A link of a work on a platform (`fler`, `instagram`): a non-empty http(s) address. */
const hasLink = (v) => typeof v === 'string' && /^https?:\/\/\S+/.test(v.trim());

/**
 * Attributes of a work that do not fit together (drafts too, unless said otherwise): what was forgotten when one of
 * them changed. `works`: { yamlPath|…, data }, `today` (YYYY-MM-DD).
 */
export function consistencyAdvice(works, today) {
  const advice = [];
  for (const w of works) {
    const where = workPath(w);
    const data = w.data ?? {};
    if (isPublished(w) && data.featured === true && data.meta_pinterest !== true) {
      advice.push(`${where}: je ve výběru autorky (featured: true), ale není v kanálu pro Pinterest; zvaž meta_pinterest: true [featured-bez-pinu]`);
    }
    if (hasLink(data.fler) && !isOnSale(data.status)) {
      advice.push(`${where}: má odkaz na Fler, ale není na prodej (status: ${data.status ?? 'není'}); nabídku na Fleru ukonči a odkaz smaž [fler-neni-na-prodej]`);
    }
    if (wantsFler(data) && !isOnSale(data.status)) {
      advice.push(`${where}: má fotky pro Fler (meta_fler: true), ale není na prodej (status: ${data.status ?? 'není'}); dej meta_fler: false, nebo změň stav [fler-bez-prodeje]`);
    } else if (isPublished(w) && wantsFler(data) && !hasLink(data.fler)) {
      advice.push(`${where}: má fotky pro Fler (meta_fler: true), ale chybí odkaz na Fler; po přidání na Fler ho doplň (fler: https://www.fler.cz/…), fotky pro Fler pak zmizí [prodej-bez-fleru]`);
    }
    if (data.price !== undefined && data.price !== null && data.price !== '' && NOT_SOLD.includes(data.status)) {
      advice.push(`${where}: má cenu (price), ale neprodává se (status: ${data.status}); cenu smaž, nebo změň stav [cena-neprodava]`);
    }
    if (wantsMockups(data) && !validSize(data.size_cm)) {
      advice.push(`${where}: má mockupy (mockups: true), ale nemá rozměr (size_cm), mockupy nedrží skutečné měřítko [mockupy-bez-rozmeru]`);
    }
    if (data.meta_instagram_grid !== undefined && data.meta_instagram_grid !== null && data.meta_instagram_grid !== false && !wantsInstagram(data)) {
      advice.push(`${where}: má mřížku pro Instagram (meta_instagram_grid), ale nemá fotky pro Instagram, takže mřížka nevznikne; dej meta_instagram: true, nebo mřížku smaž [mrizka-bez-instagramu]`);
    }
    const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : data.date;
    if (typeof date === 'string' && today && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today) {
      advice.push(`${where}: datum ${date} je v budoucnu; zkontroluj ho (date) [datum-v-budoucnu]`);
    }
  }
  return advice;
}

/** Statuses of works that are not sold (a price makes no sense there; sold keeps it as a record). */
const NOT_SOLD = ['not-for-sale', 'gifted'];

/** Master photos too small for sharp Instagram photos and enlargements: `photos` [{ where, width, height }]. */
export function photoSizeAdvice(photos) {
  return photos
    .filter((p) => Math.min(p.width, p.height) < MIN_PHOTO_SIDE)
    .map((p) => `${p.where}: fotka obrazu je malá (${p.width} × ${p.height} px), fotky pro Instagram a zvětšení na webu nebudou ostré; nahraj větší, aspoň ${MIN_PHOTO_SIDE} px na kratší straně [mala-fotka]`);
}

/**
 * Drafts waiting too long: `drafts` [{ where, added (YYYY-MM-DD: since when the description is in git) }], `today`
 * (YYYY-MM-DD). A draft without a known date (not committed yet, no history) is left out.
 */
export function draftAgeAdvice(drafts, today) {
  return drafts
    .filter((d) => d.added && daysBetween(d.added, today) > DRAFT_DAYS)
    .map((d) => `${d.where}: je rozpracovaný už ${daysBetween(d.added, today)} dní (od ${d.added}); doplň ho a zveřejni (meta_draft: false), nebo ho smaž [dlouhy-draft]`);
}

/**
 * Published works with Instagram photos (`meta_instagram: true`) ready for long without the link of the post:
 * `works` [{ where, data, ready (YYYY-MM-DD: since when the photos are in git, or null) }], `today` (YYYY-MM-DD).
 */
export function instagramLinkAdvice(works, today) {
  return works
    .filter((w) => isPublished(w) && wantsInstagram(w.data) && !isInstagramUrl(w.data?.instagram))
    .filter((w) => w.ready && daysBetween(w.ready, today) > INSTAGRAM_LINK_DAYS)
    .map((w) => `${w.where}: fotky pro Instagram jsou připravené od ${w.ready} (${daysBetween(w.ready, today)} dní), ale chybí odkaz na příspěvek; po zveřejnění ho doplň (instagram: https://www.instagram.com/p/…) [instagram-bez-odkazu]`);
}

/**
 * Pages whose cover is picked from the author's selection (no own cover photo, no `cover`) with too few featured
 * works for it to change: `pages` [{ where, label ("roku 2025", "kolekce …"), works (published works of the page),
 * own (true when the page has its own cover photo or `cover`) }]. None featured: always the newest work; one: always that one.
 */
export function featuredAdvice(pages) {
  return pages.flatMap((p) => {
    if (p.own || p.works.length < FEATURED_GROUP) return [];
    const featured = p.works.filter((w) => w.data?.featured === true).length;
    if (featured === 0) return [`${p.where}: úvodní obraz ${p.label} je vždy nejnovější obraz; označ pár nejlepších featured: true, budou se na něm střídat [featured-zadny]`];
    if (featured === 1) return [`${p.where}: ve výběru autorky ${p.label} je jen 1 obraz, úvodní obraz se nestřídá; označ featured: true ještě další [featured-jeden]`];
    return [];
  });
}

// Tags: the gallery shows every tag used as a chip, so the list should stay short and clear. The advice speaks only
// where Pavla can do something about it (merge, shorten or drop a tag); a tag on most works is an honest description,
// it gets no advice, only the statistics (tagStats) in the run summary. Counted over all works, drafts too (they are
// the ones being tagged now).

/** The gallery chips should fit into this many rows on a wide screen. */
export const TAG_ROWS = 2;
/**
 * One row of chips in characters of the chip text: the page is 1320 px wide without its 2 × 48 px gutters, the chips
 * use 0.88 rem Work Sans, about 7.7 px a character (src/components/WorkGallery.astro, src/layouts/Base.astro).
 */
export const TAG_ROW_CHARS = 158;
/** Padding, border and the gap of a chip, in characters. */
const CHIP_EXTRA = 5;
/** A tag longer than this is named as a candidate for a shorter word when the chips do not fit. */
export const TAG_LONG = 12;
/** Two tags this similar (shared works of their works together, Jaccard index) add nothing to each other as filters. */
export const TAG_TOGETHER = 0.9;
/** …but only once both have at least this many works (two tags on the same single work are no pattern yet). */
export const TAG_TOGETHER_MIN = 3;

/** The tags of a work worth counting: non-empty strings, not a DOPLNIT placeholder, each once. */
const tagsOfWork = (w) => [...new Set((Array.isArray(w.data?.tags) ? w.data.tags : []).filter((t) => textOf(t)).map((t) => t.trim()))];

/** Works per tag, most used first, then in Czech alphabetical order: [{ tag, count }]. */
export function tagStats(works) {
  const counts = new Map();
  for (const w of works) for (const t of tagsOfWork(w)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'cs'));
}

/** Rows the chips of these tags ("Vše" first, then "#<tag> <count>") take in the gallery, wrapped like the page does. */
export function tagRows(stats, rowChars = TAG_ROW_CHARS) {
  const widths = ['Vše'.length + CHIP_EXTRA, ...stats.map(({ tag, count }) => tag.length + String(count).length + 2 + CHIP_EXTRA)];
  let rows = 1;
  let used = 0;
  for (const w of widths) {
    if (used && used + w > rowChars) { rows++; used = 0; }
    used += w;
  }
  return rows;
}

/** A tag to compare with others: small letters, no diacritics ("Plenér" → "plener"). */
export const tagKey = (tag) => tag.toLocaleLowerCase('cs').normalize('NFD').replace(/\p{M}/gu, '');

/** A tag without its ending vowels, enough to tell Czech word forms of one word: "hory" / "hora" → "hor". */
export const tagStem = (tag) => tagKey(tag).replace(/[aeiouy]+$/, '');

/**
 * Two tags that are most likely one: the same word but for capitals or diacritics ("plener" / "Plenér"), or another
 * form of it, differing only in the ending vowels ("strom" / "stromy", "hora" / "hory", "květina" / "květiny");
 * stems shorter than 3 letters are left alone.
 */
export function sameTag(a, b) {
  if (tagKey(a) === tagKey(b)) return true;
  const stem = tagStem(a);
  return stem.length >= 3 && stem === tagStem(b);
}

const quoted = (tag) => `„${tag}“`;
/** "u 1 díla", "u 3 děl". */
const worksAt = (n) => `u ${n} ${n === 1 ? 'díla' : 'děl'}`;
const worksCount = (n) => `${n} ${n === 1 ? 'dílo' : n >= 2 && n <= 4 ? 'díla' : 'děl'}`;

/** Recommendations for the tags of all works, under "Štítky" in the run summary: ["Štítky: <advice>"]. */
export function tagAdvice(works) {
  const stats = tagStats(works);
  const worksOf = new Map(stats.map(({ tag }) => [tag, new Set()]));
  works.forEach((w, i) => tagsOfWork(w).forEach((t) => worksOf.get(t).add(i)));
  const advice = [];
  // 1. one tag in two spellings or forms
  const merged = new Set();
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const [a, b] = [stats[i], stats[j]];
      if (!sameTag(a.tag, b.tag)) continue;
      merged.add(`${a.tag}|${b.tag}`);
      advice.push(`Štítky: ${quoted(a.tag)} (${worksCount(a.count)}) a ${quoted(b.tag)} (${worksCount(b.count)}) jsou nejspíš jeden štítek, sjednoť je na jeden tvar [stitky-dva-tvary]`);
    }
  }
  // 2. two tags that always come together: as filters one adds nothing to the other
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const [a, b] = [stats[i], stats[j]];
      if (merged.has(`${a.tag}|${b.tag}`) || Math.min(a.count, b.count) < TAG_TOGETHER_MIN) continue;
      const [wa, wb] = [worksOf.get(a.tag), worksOf.get(b.tag)];
      const both = [...wa].filter((w) => wb.has(w)).length;
      const either = wa.size + wb.size - both;
      if (both / either < TAG_TOGETHER) continue;
      const apart = either - both;
      const how = apart ? `skoro vždy spolu (spolu ${worksAt(both)}, jen jeden z nich ${worksAt(apart)})` : `vždy spolu (${worksAt(both)})`;
      advice.push(`Štítky: ${quoted(a.tag)} a ${quoted(b.tag)} jsou ${how}; jako filtr v galerii jeden nic nepřidá, zvaž, jestli potřebuješ oba [stitky-vzdy-spolu]`);
    }
  }
  // 3. too many chips for the gallery: name the cheapest ones to merge, shorten or drop
  const rows = tagRows(stats);
  if (rows > TAG_ROWS) {
    const single = stats.filter((s) => s.count === 1).map((s) => quoted(s.tag));
    const long = stats.filter((s) => s.tag.length > TAG_LONG).sort((a, b) => b.tag.length - a.tag.length).map((s) => quoted(s.tag));
    const candidates = [
      single.length && `jen u jednoho díla ${single.join(', ')}`,
      long.length && `dlouhé ${long.join(', ')}`,
    ].filter(Boolean);
    advice.push(
      `Štítky: v galerii zaberou asi ${rows} ${rows <= 4 ? 'řádky' : 'řádků'} (${stats.length} štítků), přehledné je nejvýš ${TAG_ROWS}; ` +
      'zvaž sloučení, kratší slova nebo vynechání málo užitých' + (candidates.length ? ` (${candidates.join('; ')})` : '') + ' [stitky-moc]',
    );
  }
  return advice;
}

/**
 * Works in the feed for Pinterest (meta_pinterest: true) whose technique or tags have no English keyword in the
 * description of the pin: ["<file>: …"]. `dictionary` = pinterestKeywords.en of site.config.yaml (scripts/lib/pinterest.mjs).
 */
export function pinterestAdvice(works, dictionary = {}) {
  return works
    .filter((w) => w.data?.meta_pinterest === true)
    .map((w) => [w, untranslatedWords(w.data, { en: dictionary })])
    .filter(([, words]) => words.length)
    .map(([w, words]) => `${workPath(w)}: ${words.length === 1 ? 'štítek' : 'štítky'} ${words.map((x) => `„${x}“`).join(', ')} `
      + `${words.length === 1 ? 'nemá' : 'nemají'} v popisu pinu pro Pinterest anglické klíčové slovo (překlad doplní Libor do nastavení webu, pinterestKeywords.en) [stitek-bez-prekladu]`);
}

/**
 * Works with Instagram exports (meta_instagram: true) whose technique or tags have no English hashtag in the text of
 * the post: ["<file>: …"]. `settings` = instagramPost of site.config.yaml (see scripts/lib/instagram.mjs).
 */
export function hashtagAdvice(works, settings = {}) {
  return works
    .filter((w) => w.data?.meta_instagram === true)
    .map((w) => [w, untranslatedWords(w.data, settings)])
    .filter(([, words]) => words.length)
    .map(([w, words]) => `${workPath(w)}: ${words.length === 1 ? 'štítek' : 'štítky'} ${words.map((x) => `„${x}“`).join(', ')} `
      + `${words.length === 1 ? 'nemá' : 'nemají'} v textu příspěvku pro Instagram anglický hashtag (překlad doplní Libor do nastavení webu, instagramPost.en) [stitek-bez-prekladu]`);
}
