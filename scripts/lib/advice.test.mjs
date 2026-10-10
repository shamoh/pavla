import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_TITLE_CHARS, TAG_ROWS, TECHNIQUE_CHARS, endsSentence, endsWithFullStop, hashtagAdvice, pageAdvice, pinterestAdvice, sameTag, startsLowercase, tagAdvice, tagKey, tagRows, tagStats, techniqueAdvice, workAdvice, workTitleChars,
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
