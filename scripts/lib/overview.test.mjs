import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW_MAX_BYTES, attributeLines, escText, formatValue, headingAnchors, notesByFile, overviewReadme, overviewSizeAdvice } from './overview.mjs';

const works = [
  {
    yamlPath: 'tvorba/plener/rano.yaml', photoPath: 'tvorba/plener/rano.jpg', id: 'a1b2c', collection: 'plener', pageUrl: 'https://x.cz/tvorba/2026/rano-a1b2c/',
    data: { meta_draft: false, meta_instagram: true, id: 'a1b2c', date: '2026-06-14', featured: true, size_cm: [41, 30], tags: ['mlha', 'řeka'], title: 'Ráno', private_note: 'koupila teta' },
  },
  {
    yamlPath: 'tvorba/plener/vecer.yaml', photoPath: null, id: 'b2c3d', collection: 'plener', pageUrl: '',
    data: { meta_draft: true, id: 'b2c3d', date: '2026-07-01', title: 'Večer', description: '' },
  },
  { yamlPath: 'tvorba/sam.yaml', photoPath: 'tvorba/sam.jpg', id: 'c3d4e', collection: null, pageUrl: '', data: { id: 'c3d4e', date: '2020-01-01', title: 'Sám' } },
];
const collections = [
  { slug: 'zima', yamlPath: 'tvorba/zima/_index.yaml', data: { title: 'Zima' } },
  { slug: 'plener', yamlPath: 'tvorba/plener/_index.yaml', data: { title: 'Plenér', private_note: 'jen pro nás' } },
];
const uncollected = { yamlPath: 'tvorba/_index.yaml', data: { description: 'Obrazy mimo kolekce.' } };
const noted = {
  problems: ['tvorba/plener/vecer.yaml: chybí název (title) [chybi-nazev]'],
  advice: [
    'tvorba/plener/rano.yaml: je ve výběru autorky (featured: true), ale není v kanálu pro Pinterest [featured-bez-pinu]',
    'Štítky: „mlha“ a „řeka“ jsou vždy spolu [stitky-vzdy-spolu]',
    'roky/2026.yaml: description by měl končit tečkou [text-bez-tecky]',
  ],
  todo: ['tvorba/plener/vecer.yaml: support, technique'],
  pending: [],
  detected: ['tvorba/sam.yaml: tl 1×2 ⚠ PODEZŘELÝ ořez [podezrely-orez]', 'tvorba/plener/rano.yaml: tl 0×0'],
};

test('overviewReadme: collections alphabetically, "Mimo kolekce" last, works newest first, every attribute', () => {
  const text = overviewReadme({ works, collections, uncollected, noted });
  const order = ['## Plenér', '### Večer · b2c3d · draft', '### Ráno · a1b2c ★', '## Zima', '## Mimo kolekce', '### Sám · c3d4e', '## Ostatní'];
  const at = order.map((h) => text.indexOf(h));
  assert.ok(at.every((i) => i > 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(text, /meta_draft: false · meta_instagram: true · id: a1b2c · date: 2026-06-14 · featured: true · size_cm: 41, 30 · tags: mlha, řeka · title: Ráno · private_note: koupila teta/);
  assert.match(text, /\[tvorba\/plener\/rano\.yaml\]\(\.\.\/tvorba\/plener\/rano\.yaml\) · \[foto\]\(\.\.\/tvorba\/plener\/rano\.jpg\) · \[web\]\(https:\/\/x\.cz\/tvorba\/2026\/rano-a1b2c\/\)/);
  assert.match(text, /\[tvorba\/plener\/vecer\.yaml\]\([^)]*\) · bez fotky\n/);
  assert.match(text, /title: Plenér · private_note: jen pro nás/, 'the attributes of a collection');
  assert.doesNotMatch(text, /description: \n|description:\s*$/m, 'empty attributes are left out');
  assert.doesNotMatch(text, /<img/, 'no pictures');
});

test('overviewReadme: messages of a work with their codes, "stav: OK" without any, other files under "Ostatní"', () => {
  const text = overviewReadme({ works, collections, uncollected, noted });
  const vecer = text.slice(text.indexOf('### Večer'), text.indexOf('### Ráno'));
  assert.match(vecer, /- `chybi-nazev` chybí název \(title\)\n- `doplnit` zbývá doplnit: support, technique/);
  assert.match(text.slice(text.indexOf('### Ráno')), /- `featured-bez-pinu` je ve výběru autorky/);
  assert.match(text.slice(text.indexOf('### Sám')), /- `podezrely-orez` tl 1×2/);
  assert.match(text.slice(text.indexOf('## Zima')), /^stav: OK$/m);
  const others = text.slice(text.indexOf('## Ostatní'));
  assert.match(others, /\*\*Štítky\*\*\n\n- `stitky-vzdy-spolu`/);
  assert.match(others, /\*\*roky\/2026\.yaml\*\*\n\n- `text-bez-tecky`/);
  assert.doesNotMatch(text, /tl 0×0/, 'corners found without suspicion are no message');
});

test('overviewReadme: the head counts works and codes, links the collections, same input = same text', () => {
  const text = overviewReadme({ works, collections, uncollected, noted });
  assert.match(text, /^# Přehled všech děl\n/);
  assert.match(text, /Děl 3: zveřejněných 2, rozpracovaných 1, s chybou 1\./);
  assert.match(text, /\[Plenér\]\(#plenér\) \(2\) · \[Zima\]\(#zima\) \(0\) · \[Mimo kolekce\]\(#mimo-kolekce\) \(1\) · \[Ostatní\]\(#ostatní\)/);
  const codes = text.slice(text.indexOf('## Hlášky'), text.indexOf('## Plenér'));
  assert.match(codes, /- `chybi-nazev` ×1 · Chyba: chybí název \(title\)\n(- [^\n]*\n)*- `doplnit` ×1 · Zbývá doplnit/);
  assert.ok(codes.indexOf('`chybi-nazev`') < codes.indexOf('`podezrely-orez`') && codes.indexOf('`podezrely-orez`') < codes.indexOf('`featured-bez-pinu`'), 'by level');
  assert.equal(overviewReadme({ works, collections, uncollected, noted }), text);
  assert.ok(!text.includes('\n\n\n') && text.endsWith('\n') && !text.endsWith('\n\n'));
});

test('overviewReadme: without works, collections and messages', () => {
  const text = overviewReadme({ works: [], noted: {} });
  assert.match(text, /Děl 0: zveřejněných 0, rozpracovaných 0, s chybou 0\./);
  assert.match(text, /## Hlášky\n\nŽádné\.\n$/);
});

test('escText, formatValue and attributeLines: Markdown kept plain, values in one line, long texts apart', () => {
  assert.equal(escText('a *b* _c_ [d](e) <f> #g | h & i\n\n j'), 'a \\*b\\* \\_c\\_ \\[d\\](e) \\<f\\> #g | h &amp; i j');
  assert.equal(escText('meta_pinterest: true, `kód` ~x~'), 'meta_pinterest: true, \\`kód\\` \\~x\\~', 'an underscore inside a word stays');
  assert.equal(formatValue([41, 30]), '41, 30');
  assert.equal(formatValue({ les: 'Les u Stožce', voda: 'Jez' }), 'les=Les u Stožce; voda=Jez');
  assert.equal(formatValue({ photo: [800, 600], tl: [1, 2] }), 'photo=800, 600; tl=1, 2');
  assert.equal(formatValue(new Date('2026-06-14T00:00:00Z')), '2026-06-14');
  assert.equal(formatValue(false), 'false');
  const long = 'slovo '.repeat(30).trim();
  assert.deepEqual(attributeLines({ title: 'A', description: long, tags: [], price: null, note: ' ', mockups: false }), ['title: A · mockups: false', `description: ${long}`]);
  assert.deepEqual(attributeLines({}), []);
});

test('headingAnchors: like GitHub, repeated headings numbered', () => {
  const anchor = headingAnchors();
  assert.equal(anchor('Plenér Šumava 2026'), 'plenér-šumava-2026');
  assert.equal(anchor('Ráno · a1b2c ★'), 'ráno--a1b2c-');
  assert.equal(anchor('Plenér Šumava 2026'), 'plenér-šumava-2026-1');
});

test('notesByFile: levels by the list a message comes from, DOPLNIT lists as one message with a code', () => {
  const notes = notesByFile({ pending: ['tvorba/a.yaml: support'], misfits: ['tvorba/a.yaml: nevejde [nevejde-do-sceny]'], commentedOut: [] });
  assert.deepEqual(notes.get('tvorba/a.yaml'), {
    error: [], review: ['zveřejněný, pořád DOPLNIT: support [doplnit-zverejneny]', 'nevejde [nevejde-do-sceny]'], advice: [], todo: [],
  });
});

test('overviewSizeAdvice: only above the limit', () => {
  assert.equal(overviewSizeAdvice('export/README.md', OVERVIEW_MAX_BYTES), null);
  assert.match(overviewSizeAdvice('export/README.md', OVERVIEW_MAX_BYTES + 1), /^export\/README\.md: přehled má \d+ kB.* \[prehled-velky\]$/);
});
