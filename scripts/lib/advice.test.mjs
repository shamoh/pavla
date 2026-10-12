import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_TITLE_CHARS, TAG_ROWS, TECHNIQUE_CHARS, endsSentence, endsWithFullStop, hashtagAdvice, pageAdvice, pinterestAdvice, sameTag, startsLowercase, tagAdvice, tagKey, tagRows, tagStats, techniqueAdvice, todoAdvice, workAdvice, workTitleChars,
  DRAFT_DAYS, FEATURED_GROUP, INSTAGRAM_LINK_DAYS, MIN_PHOTO_SIDE, careAdvice, daysBetween, draftAgeAdvice, featuredAdvice, instagramLinkAdvice, photoSizeAdvice,
} from './advice.mjs';

const good = {
  title: 'Ráno u jezu', tags: ['voda'], description: 'Mlha nad vodou.', details: { mlha: 'Hladina v mlze.' },
  status: 'available', mockups: true,
};
const work = (data, extra = {}) => ({ slug: 'rano', dir: 'plener', data: { ...good, ...data }, ...extra });

test('startsLowercase looks at the first letter, past quotes and brackets; a digit first is fine', () => {
  for (const t of ['ráno', '„ráno“', '(ráno)', 'čáp']) assert.ok(startsLowercase(t), t);
  for (const t of ['Ráno', '„Ráno“', '3 ovce', 'Čáp']) assert.ok(!startsLowercase(t), t);
});

test('endsSentence accepts . ! ? … also before a closing quote; endsWithFullStop only a single full stop', () => {
  for (const t of ['Ráno.', 'Ráno!', 'Ráno?', 'Ráno…', 'Řekla „ráno.“', '(Ráno.)']) assert.ok(endsSentence(t), t);
  for (const t of ['Ráno', 'Ráno,', 'Ráno:']) assert.ok(!endsSentence(t), t);
  assert.ok(endsWithFullStop('Ráno.'));
  for (const t of ['Ráno', 'Ráno...', 'Ráno…', 'Ráno!']) assert.ok(!endsWithFullStop(t), t);
});

test('workAdvice: nothing for a well written work', () => {
  assert.deepEqual(workAdvice([work({})]), []);
});

test('workAdvice: tags, title, description and detail captions, in the file of the work', () => {
  const advice = workAdvice([work({
    tags: [], title: 'ráno u jezu.', description: 'mlha nad vodou', details: { mlha: 'hladina v mlze', most: 'Most.' },
  })]);
  assert.deepEqual(advice, [
    'tvorba/plener/rano.yaml: nemá štítky (tags), podle nich se v galerii filtruje',
    'tvorba/plener/rano.yaml: title začíná malým písmenem',
    'tvorba/plener/rano.yaml: title by neměl končit tečkou',
    'tvorba/plener/rano.yaml: description začíná malým písmenem',
    'tvorba/plener/rano.yaml: description by měl končit tečkou',
    'tvorba/plener/rano.yaml: popisek detailu mlha začíná malým písmenem',
    'tvorba/plener/rano.yaml: popisek detailu mlha by měl končit tečkou',
  ]);
  assert.match(workAdvice([work({ tags: undefined }, { yamlPath: 'tvorba/x.yaml' })])[0], /^tvorba\/x\.yaml: nemá štítky/);
});

test('workAdvice: a work on sale without mockups; sold, not for sale or with mockups is fine', () => {
  assert.deepEqual(workAdvice([work({ mockups: false }), work({ status: 'reserved', mockups: undefined })]).map((a) => a.slice(a.indexOf(': ') + 2)), [
    'je na prodej, ale nemá mockupy (mockups: true ukáže obraz v interiéru na webu i na Fleru)',
    'je na prodej, ale nemá mockupy (mockups: true ukáže obraz v interiéru na webu i na Fleru)',
  ]);
  assert.deepEqual(workAdvice([work({ status: 'sold', mockups: false }), work({ status: 'not-for-sale', mockups: false })]), []);
});

test('workAdvice leaves DOPLNIT texts and empty ones to the checks', () => {
  assert.deepEqual(workAdvice([work({ title: 'DOPLNIT název', description: 'DOPLNIT popis', details: { mlha: 'DOPLNIT popisek detailu', most: '' } })]), []);
  assert.deepEqual(workAdvice([work({ description: undefined, details: undefined })]), []);
});

test('pageAdvice: title and description of a collection, description of a year and of the home page', () => {
  const advice = pageAdvice({
    collections: [
      { yamlPath: 'tvorba/plener/_index.yaml', data: { title: 'plenér Šumava.', description: 'v září' } },
      { yamlPath: 'tvorba/zahrada/_index.yaml', data: { title: 'Ze zahrady', description: 'Květiny ze zahrady.' } },
    ],
    years: [{ yamlPath: 'roky/2026.yaml', data: { description: 'Rok, kdy jsem malovala' } }, { yamlPath: 'roky/2025.yaml', data: { description: '' } }],
    home: { yamlPath: '_index.yaml', data: { description: 'maluji pro radost.' } },
  });
  assert.deepEqual(advice, [
    'tvorba/plener/_index.yaml: title začíná malým písmenem',
    'tvorba/plener/_index.yaml: title by neměl končit tečkou',
    'tvorba/plener/_index.yaml: description začíná malým písmenem',
    'tvorba/plener/_index.yaml: description by měl končit tečkou',
    'roky/2026.yaml: description by měl končit tečkou',
    '_index.yaml: description začíná malým písmenem',
  ]);
});

test('pageAdvice: alt and caption of a photo of a page, in its file', () => {
  assert.deepEqual(pageAdvice({ photos: [
    { name: 'portret', data: { alt: 'pavla na plenéru', caption: 'Na Šumavě.' } },
    { name: 'kontakt', data: { alt: 'Pavla maluje u potoka.', caption: 'můj ateliér' } },
    { name: 'o-mne', data: { alt: 'DOPLNIT popis fotky', caption: '' } },
  ] }), [
    'fotky/portret.yaml: alt začíná malým písmenem',
    'fotky/portret.yaml: alt by měl končit tečkou',
    'fotky/kontakt.yaml: caption začíná malým písmenem',
    'fotky/kontakt.yaml: caption by měl končit tečkou',
  ]);
});

test('pageAdvice: nothing without pages, for DOPLNIT texts, or for a year with a title by mistake', () => {
  assert.deepEqual(pageAdvice({}), []);
  assert.deepEqual(pageAdvice({
    collections: [{ yamlPath: 'tvorba/k/_index.yaml', data: { title: 'DOPLNIT název', description: 'DOPLNIT popis' } }],
    years: [{ yamlPath: 'roky/2026.yaml', data: { title: 'rok.', description: 'Dobrý rok.' } }],
    home: { yamlPath: '_index.yaml', data: {} },
  }), []);
});

const tagged = (...lists) => lists.map((tags, i) => ({ slug: `d${i}`, data: { tags } }));

test('tagStats: works per tag, most used first, then alphabetically; placeholders, blanks and repeats left out', () => {
  const works = tagged(['voda', 'krajina'], ['krajina', 'krajina'], ['chalupa', 'DOPLNIT štítek', ' '], ['hory'], [], {});
  works.push({ slug: 'x', data: {} });
  assert.deepEqual(tagStats(works), [
    { tag: 'krajina', count: 2 }, { tag: 'hory', count: 1 }, { tag: 'chalupa', count: 1 }, { tag: 'voda', count: 1 },
  ]);
});

test('tagRows: chips wrap like the gallery row; "Vše" counts too', () => {
  assert.equal(tagRows([]), 1);
  assert.equal(tagRows([{ tag: 'krajina', count: 9 }]), 1);
  // "Vše" = 8 characters, each chip "#abcd 1" = 4 + 1 + 2 + 5 = 12: 8 + 12 + 12 fits 32, a third chip does not
  const four = Array.from({ length: 4 }, (_, i) => ({ tag: `abc${i}`, count: 1 }));
  assert.equal(tagRows(four.slice(0, 2), 32), 1);
  assert.equal(tagRows(four.slice(0, 3), 32), 2);
  assert.equal(tagRows(four, 32), 2);
});

test('tagKey and sameTag: capitals, diacritics and word forms, not short or different words', () => {
  assert.equal(tagKey('Plenér'), 'plener');
  const same = [['plener', 'plenér'], ['Krajina', 'krajina'], ['strom', 'stromy'], ['květina', 'květiny'], ['hora', 'hory'], ['les', 'lesy'], ['louka', 'louky']];
  for (const [a, b] of same) assert.ok(sameTag(a, b), `${a} ${b}`);
  const different = [['moře', 'most'], ['voda', 'vodopád'], ['krajina', 'kresba'], ['zima', 'léto'], ['zima', 'zimní'], ['ovoce', 'ovce'], ['a', 'o']];
  for (const [a, b] of different) assert.ok(!sameTag(a, b), `${a} ${b}`);
});

test('tagAdvice: nothing for a short, clean list', () => {
  assert.deepEqual(tagAdvice(tagged(['krajina', 'voda'], ['krajina'], ['město'], ['krajina', 'zima'])), []);
  assert.deepEqual(tagAdvice([]), []);
});

test('tagAdvice: one tag in two spellings, once, not also as a pair together', () => {
  const advice = tagAdvice(tagged(['plenér'], ['plenér'], ['plenér'], ['plener'], ['květiny'], ['květina', 'louka']));
  assert.deepEqual(advice, [
    'Štítky: „plenér“ (3 díla) a „plener“ (1 dílo) jsou nejspíš jeden štítek, sjednoť je na jeden tvar',
    'Štítky: „květina“ (1 dílo) a „květiny“ (1 dílo) jsou nejspíš jeden štítek, sjednoť je na jeden tvar',
  ]);
  // the same works with both forms: only the spelling advice
  assert.equal(tagAdvice(tagged(['strom', 'stromy'], ['strom', 'stromy'], ['strom', 'stromy'])).length, 1);
});

test('tagAdvice: two tags always together (from 3 works), not when they also come apart', () => {
  const always = tagged(['město', 'ulice'], ['město', 'ulice'], ['město', 'ulice'], ['krajina']);
  assert.deepEqual(tagAdvice(always), [
    'Štítky: „město“ a „ulice“ jsou vždy spolu (u 3 děl); jako filtr v galerii jeden nic nepřidá, zvaž, jestli potřebuješ oba',
  ]);
  const nearly = tagged(...Array.from({ length: 10 }, () => ['plenér', 'příroda']), ['příroda']);
  assert.deepEqual(tagAdvice(nearly), [
    'Štítky: „příroda“ a „plenér“ jsou skoro vždy spolu (spolu u 10 děl, jen jeden z nich u 1 díla); jako filtr v galerii jeden nic nepřidá, zvaž, jestli potřebuješ oba',
  ]);
  assert.deepEqual(tagAdvice(tagged(['město', 'ulice'], ['město', 'ulice'])), [], 'two works are no pattern yet');
  assert.deepEqual(tagAdvice(tagged(['krajina', 'voda'], ['krajina', 'voda'], ['krajina', 'voda'], ['krajina'])), [], '3 of 4 is not "always"');
});

test('tagAdvice: too many chips for the gallery, naming tags of one work and long ones', () => {
  const many = Array.from({ length: 40 }, (_, i) => [`stitek${String.fromCharCode(97 + (i % 26))}${i}`]);
  const works = tagged(...many, ['akvarelová krajina'], ...many);
  const advice = tagAdvice(works);
  assert.equal(advice.length, 1);
  assert.match(advice[0], new RegExp(`^Štítky: v galerii zaberou asi 5 řádků \\(41 štítků\\), přehledné je nejvýš ${TAG_ROWS}; `));
  assert.match(advice[0], /\(jen u jednoho díla „akvarelová krajina“; dlouhé „akvarelová krajina“\)$/);
});

test('techniqueAdvice: a technique longer than the closed select shows, once with its works', () => {
  const w = (technique) => ({ data: { technique } });
  assert.deepEqual(techniqueAdvice([w('akvarel'), w('kresba tužkou'), w('tisk z výšky')]), [], `up to ${TECHNIQUE_CHARS} characters`);
  assert.deepEqual(techniqueAdvice([w('akvarel a kresba tuší'), w('akvarel a kresba tuší'), w('DOPLNIT'), w(undefined)]), [
    `Technika „akvarel a kresba tuší“ (2 díla) má 21 znaků, ve výběru Technika v galerii se zkrátí (celá je vidět po rozbalení); celá se vejde do ${TECHNIQUE_CHARS} znaků`,
  ]);
});

test('pageAdvice: a collection title longer than the closed select shows', () => {
  const at = (title) => pageAdvice({ collections: [{ yamlPath: 'tvorba/k/_index.yaml', data: { title, description: 'Text.' } }] });
  assert.deepEqual(at('Plenér Šumava 2026'), []);
  assert.deepEqual(at('X'.repeat(COLLECTION_TITLE_CHARS)), []);
  assert.deepEqual(at('Plenér Štěkeň podzim 2025'), [
    `tvorba/k/_index.yaml: název kolekce má 25 znaků, ve výběru Kolekce v galerii se zkrátí (celý je vidět po rozbalení); celý se vejde do ${COLLECTION_TITLE_CHARS} znaků`,
  ]);
});

test('workAdvice: a title too long for the page title in search results, with the site title after it', () => {
  const site = 'Pavla Kramolišová';
  assert.equal(workTitleChars(site), 40, '60 - " · Pavla Kramolišová"');
  const at = (title) => workAdvice([{ yamlPath: 'tvorba/x.yaml', data: { title, tags: ['voda'] } }], { siteTitle: site });
  assert.deepEqual(at('V'.repeat(40)), []);
  assert.deepEqual(at('Ranní mlha nad Modravskými slatěmi v září po dešti'), [
    'tvorba/x.yaml: název má 50 znaků, ve výsledcích vyhledávání a v záložce prohlížeče se zkrátí; celý se vejde do 40 znaků',
  ]);
  assert.deepEqual(at('DOPLNIT název, který je opravdu hodně dlouhý a ještě delší'), [], 'a placeholder is not advised on');
});

test('pageAdvice: the description of the works without a collection, like other page texts', () => {
  const at = (description) => pageAdvice({ uncollected: { yamlPath: 'tvorba/_index.yaml', data: { description } } });
  assert.deepEqual(at('Samostatné listy a dárky.'), []);
  assert.deepEqual(at('samostatné listy'), [
    'tvorba/_index.yaml: description začíná malým písmenem', 'tvorba/_index.yaml: description by měl končit tečkou',
  ]);
  assert.deepEqual(at(undefined), [], 'no description = the default text');
});

test('hashtagAdvice: only works with Instagram exports, every word without an English hashtag', () => {
  const settings = { en: { akvarel: 'watercolor', krajina: 'landscape' } };
  const works = [
    { yamlPath: 'tvorba/a.yaml', data: { meta_instagram: true, technique: 'akvarel', tags: ['krajina', 'mlha'] } },
    { yamlPath: 'tvorba/b.yaml', data: { meta_instagram: true, technique: 'kvaš', tags: ['mlha'] } },
    { yamlPath: 'tvorba/c.yaml', data: { meta_instagram: false, technique: 'kvaš', tags: ['mlha'] } },
    { yamlPath: 'tvorba/d.yaml', data: { meta_instagram: true, technique: 'akvarel', tags: ['krajina'] } },
  ];
  assert.deepEqual(hashtagAdvice(works, settings), [
    'tvorba/a.yaml: štítek „mlha“ nemá v textu příspěvku pro Instagram anglický hashtag (překlad doplní Libor do nastavení webu, instagramPost.en)',
    'tvorba/b.yaml: štítky „kvaš“, „mlha“ nemají v textu příspěvku pro Instagram anglický hashtag (překlad doplní Libor do nastavení webu, instagramPost.en)',
  ]);
  assert.deepEqual(hashtagAdvice(works, { en: { akvarel: 'a', krajina: 'b', kvaš: 'c', mlha: 'd' } }), []);
});

test('pinterestAdvice: only works in the feed for Pinterest, every word without an English keyword', () => {
  const dictionary = { akvarel: 'watercolor', plenér: 'plein air' };
  const works = [
    { yamlPath: 'tvorba/a.yaml', data: { meta_pinterest: true, technique: 'akvarel', tags: ['plenér', 'mlha'] } },
    { yamlPath: 'tvorba/b.yaml', data: { meta_pinterest: false, meta_instagram: true, technique: 'kvaš' } },
    { yamlPath: 'tvorba/c.yaml', data: { meta_pinterest: true, technique: 'akvarel' } },
  ];
  assert.deepEqual(pinterestAdvice(works, dictionary), [
    'tvorba/a.yaml: štítek „mlha“ nemá v popisu pinu pro Pinterest anglické klíčové slovo (překlad doplní Libor do nastavení webu, pinterestKeywords.en)',
  ]);
  assert.deepEqual(pinterestAdvice(works, { ...dictionary, mlha: 'fog' }), []);
});

test('todoAdvice: one recommendation per description with attributes still marked DOPLNIT, in file order', () => {
  const draft = '# DOPLNIT Název.\ntitle: Ráno\n\n# Kód.\nid: k3f9a\n\n# vlastní poznámka\n# DOPLNIT Popis.\ndescription: ""\n';
  const done = '# Název.\ntitle: Večer\n';
  const advice = todoAdvice([
    { file: 'tvorba/rano.yaml', text: draft },
    { file: 'tvorba/vecer.yaml', text: done },
    { file: 'roky/2026.yaml', text: '# DOPLNIT Pár vět o roce.\ndescription: ""\n' },
  ]);
  assert.deepEqual(advice, [
    'tvorba/rano.yaml: title, description',
    'roky/2026.yaml: description',
  ]);
});

test('todoAdvice: files reported elsewhere (published works under "Ke kontrole") are skipped', () => {
  const text = '# DOPLNIT Název.\ntitle: Ráno\n';
  assert.deepEqual(todoAdvice([{ file: 'tvorba/rano.yaml', text }], new Set(['tvorba/rano.yaml'])), []);
  assert.deepEqual(todoAdvice([]), []);
});

test('careAdvice: a published work without size or description; a draft only for its detail photos', () => {
  const published = { yamlPath: 'tvorba/rano.yaml', data: { meta_draft: false, description: '  ' }, details: [] };
  assert.deepEqual(careAdvice([published]).map((a) => a.split(':')[1].trim()), ['nemá rozměr (size_cm)', 'nemá popis (description)']);
  const complete = { yamlPath: 'tvorba/vecer.yaml', data: { size_cm: [30, 40], description: 'Večer.' }, details: [] };
  assert.deepEqual(careAdvice([complete]), []);
  const draft = { yamlPath: 'tvorba/novy.yaml', data: { meta_draft: true }, details: [] };
  assert.deepEqual(careAdvice([draft]), [], 'a draft is filled in under "Zbývá doplnit"');
});

test('careAdvice: a detail photo without a caption (missing or empty), names compared like the pipeline does', () => {
  const w = {
    yamlPath: 'tvorba/rano.yaml', data: { meta_draft: true, details: { '1-Květ': 'Květ zblízka.', mlha: '' } },
    details: [{ name: '1-kvet' }, { name: 'mlha' }, { name: 'brana' }],
  };
  assert.deepEqual(careAdvice([w]), [
    'tvorba/rano.yaml: detailní fotka „mlha“ nemá popisek (details: mlha: …)',
    'tvorba/rano.yaml: detailní fotka „brana“ nemá popisek (details: brana: …)',
  ]);
});

test('photoSizeAdvice: the shorter side under MIN_PHOTO_SIDE', () => {
  const advice = photoSizeAdvice([
    { where: 'a.yaml', width: 4000, height: MIN_PHOTO_SIDE - 1 },
    { where: 'b.yaml', width: MIN_PHOTO_SIDE, height: 3000 },
  ]);
  assert.equal(advice.length, 1);
  assert.match(advice[0], new RegExp(`^a\\.yaml: fotka obrazu je malá \\(4000 × ${MIN_PHOTO_SIDE - 1} px\\)`));
});

test('daysBetween: whole days between two dates', () => {
  assert.equal(daysBetween('2026-09-30', '2026-10-12'), 12);
  assert.equal(daysBetween('2026-10-12', '2026-10-12'), 0);
});

test('draftAgeAdvice: a draft in git longer than DRAFT_DAYS; unknown date = nothing', () => {
  const today = '2026-10-12';
  const advice = draftAgeAdvice([
    { where: 'stary.yaml', added: '2026-08-01' },
    { where: 'novy.yaml', added: '2026-10-01' },
    { where: 'necommitnuty.yaml', added: undefined },
    { where: 'hranice.yaml', added: '2026-09-12' },
  ], today);
  assert.equal(daysBetween('2026-09-12', today), DRAFT_DAYS, 'exactly DRAFT_DAYS is not yet too long');
  assert.deepEqual(advice, ['stary.yaml: je rozpracovaný už 72 dní (od 2026-08-01); doplň ho a zveřejni (meta_draft: false), nebo ho smaž']);
});

test('instagramLinkAdvice: published, meta_instagram, no link, photos ready longer than INSTAGRAM_LINK_DAYS', () => {
  const today = '2026-10-12';
  const old = '2026-09-01';
  const advice = instagramLinkAdvice([
    { where: 'ceka.yaml', data: { meta_instagram: true }, ready: old },
    { where: 'odkaz.yaml', data: { meta_instagram: true, instagram: 'https://www.instagram.com/p/AbC/' }, ready: old },
    { where: 'bez.yaml', data: { meta_instagram: false }, ready: old },
    { where: 'draft.yaml', data: { meta_instagram: true, meta_draft: true }, ready: old },
    { where: 'cerstve.yaml', data: { meta_instagram: true }, ready: '2026-10-05' },
    { where: 'nezname.yaml', data: { meta_instagram: true }, ready: undefined },
  ], today);
  assert.equal(advice.length, 1);
  assert.match(advice[0], /^ceka\.yaml: fotky pro Instagram jsou připravené od 2026-09-01 \(41 dní\)/);
  assert.ok(daysBetween('2026-10-05', today) <= INSTAGRAM_LINK_DAYS);
});

test('featuredAdvice: none or one featured on a page with enough works and no own cover', () => {
  const works = (n, featured) => Array.from({ length: n }, (_, i) => ({ data: { featured: i < featured } }));
  const advice = featuredAdvice([
    { where: 'roky/2025.yaml', label: 'roku 2025', works: works(FEATURED_GROUP, 0), own: false },
    { where: 'roky/2024.yaml', label: 'roku 2024', works: works(5, 1), own: false },
    { where: 'roky/2023.yaml', label: 'roku 2023', works: works(5, 2), own: false },
    { where: 'roky/2022.yaml', label: 'roku 2022', works: works(5, 0), own: true },
    { where: 'roky/2021.yaml', label: 'roku 2021', works: works(FEATURED_GROUP - 1, 0), own: false },
  ]);
  assert.deepEqual(advice.map((a) => a.split(':')[0]), ['roky/2025.yaml', 'roky/2024.yaml']);
  assert.match(advice[0], /vždy nejnovější obraz/);
  assert.match(advice[1], /jen 1 obraz/);
});
