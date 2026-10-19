import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OVERVIEW_MAX_BYTES, attributeLines, escText, formatValue, headingAnchors, notesByFile, overviewReadme, overviewSizeAdvice, sizeMark, workHeading, workLines, pagesReadme } from './overview.mjs';

const works = [
  {
    yamlPath: 'tvorba/plener/rano.yaml', photoPath: 'tvorba/plener/rano.jpg', id: 'a1b2c', collection: 'plener', pageUrl: 'https://x.cz/tvorba/2026/rano-a1b2c/',
    data: { meta_draft: false, meta_instagram: true, id: 'a1b2c', date: '2026-06-14', featured: true, size_cm: [41, 30], tags: ['mlha', 'řeka'], title: 'Ráno', private_note: 'koupila teta' },
  },
  {
    yamlPath: 'tvorba/plener/vecer.yaml', photoPath: null, id: 'b2c3d', collection: 'plener', pageUrl: '',
    data: { meta_draft: true, id: 'b2c3d', date: '2026-07-01', title: 'Večer', text: '' },
  },
  { yamlPath: 'tvorba/sam.yaml', photoPath: 'tvorba/sam.jpg', id: 'c3d4e', collection: null, pageUrl: '', data: { id: 'c3d4e', date: '2020-01-01', title: 'Sám' } },
];
const collections = [
  { slug: 'zima', yamlPath: 'tvorba/zima/_index.yaml', data: { title: 'Zima' } },
  { slug: 'plener', yamlPath: 'tvorba/plener/_index.yaml', data: { title: 'Plenér', private_note: 'jen pro nás' } },
];
const uncollected = { yamlPath: 'tvorba/_index.yaml', data: { text: 'Obrazy mimo kolekce.\n' } };
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
  const order = ['## Plenér', '### Večer · b2c3d @ 2026-07-01', '### Ráno ★ · a1b2c @ 2026-06-14 [ 41 x 30 ]', '## Zima', '## Mimo kolekce', '### Sám · c3d4e @ 2020-01-01', '## Ostatní'];
  const at = order.map((h) => text.indexOf(h));
  assert.ok(at.every((i) => i > 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(text, /\ninstagram: - · tags: mlha, řeka · private_note: koupila teta\n/, 'switches as words, told attributes left out');
  assert.match(text, /\ndraft\n/, 'a draft');
  assert.doesNotMatch(text, /(^|· )(meta_\w+|id|date|title|featured|size_cm|text|description|mockups): /m, 'attributes told elsewhere');
  assert.match(text, /\n\[rano\.yaml\]\(\.\.\/tvorba\/plener\/rano\.yaml\) · \[foto\]\(\.\.\/tvorba\/plener\/rano\.jpg\) · \[web\]\(https:\/\/x\.cz\/tvorba\/2026\/rano-a1b2c\/\)/);
  assert.match(text, /\n\[vecer\.yaml\]\(\.\.\/tvorba\/plener\/vecer\.yaml\) · bez fotky\n/, 'only the file name as the text, the whole path in the link');
  assert.match(text, /\n## Plenér\n\n\[[^\n]*\n\nprivate_note: jen pro nás\n/, 'the attributes of a collection, its title is the heading');
  assert.match(text, /\n## Mimo kolekce\n\n\[[^\n]*\n\nObrazy mimo kolekce\.\n/, 'a description on a line of its own');
  assert.doesNotMatch(text, /description: \n|description:\s*$/m, 'empty attributes are left out');
  assert.doesNotMatch(text, /<img/, 'no pictures');
});

test('overviewReadme: messages of a work with their marks and codes, "✓" without any, other files under "Ostatní"', () => {
  const text = overviewReadme({ works, collections, uncollected, noted });
  const vecer = text.slice(text.indexOf('### Večer'), text.indexOf('### Ráno'));
  assert.match(vecer, /- ✗ `chybi-nazev` chybí název \(title\)\n- ✎ `doplnit` zbývá doplnit: support, technique/);
  assert.match(text.slice(text.indexOf('### Ráno')), /- 💡 `featured-bez-pinu` je ve výběru autorky/);
  assert.match(text.slice(text.indexOf('### Sám')), /- ⚠ `podezrely-orez` tl 1×2/);
  assert.match(text.slice(text.indexOf('## Zima')), /^✓$/m);
  assert.match(text, /Značky: ✓ bez hlášek, ✗ chyba, ⚠ ke kontrole, 💡 doporučení, ✎ zbývá doplnit\./);
  const others = text.slice(text.indexOf('## Ostatní'));
  assert.match(others, /\*\*Štítky\*\*\n\n- 💡 `stitky-vzdy-spolu`/);
  assert.match(others, /\*\*roky\/2026\.yaml\*\*\n\n- 💡 `text-bez-tecky`/);
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
  assert.equal(anchor('Ráno ★ · a1b2c'), 'ráno---a1b2c');
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

test('workHeading: title, id, star, date and size, each only when set', () => {
  assert.equal(workHeading({ title: 'Ráno', featured: true, date: '2026-09-27', size_cm: [21, 15] }, 'a1b2c', 'x'), 'Ráno ★ · a1b2c @ 2026-09-27 [ 21 x 15 ]');
  assert.equal(workHeading({ title: 'Ráno', featured: false, date: new Date('2026-09-27T00:00:00Z') }, 'a1b2c', 'x'), 'Ráno · a1b2c @ 2026-09-27');
  assert.equal(workHeading({}, '', 'tvorba/x.yaml'), 'tvorba/x.yaml');
  assert.equal(sizeMark([21, 15]), '[ 21 x 15 ]');
  for (const bad of [undefined, [0, 0], [21], 'DOPLNIT']) assert.equal(sizeMark(bad), '', String(bad));
});

test('workLines: the text first, then its description for search engines, switches that are on as words, nothing told elsewhere', () => {
  const d = {
    meta_corners: { photo: [1, 1] }, meta_draft: true, meta_instagram: true, meta_pinterest: true, id: 'a1b2c', date: '2026-09-27',
    text: 'Ráno u jezu.', description: 'Pro Google.', featured: true, instagram: 'https://www.instagram.com/p/x/', mockups: true, size_cm: [21, 15],
    status: 'sold', title: 'Ráno',
  };
  assert.deepEqual(workLines(d), ['Ráno u jezu.', 'Google: Pro Google.', 'draft · instagram: https://www.instagram.com/p/x/ · pinterest · mockups · status: sold']);
  assert.deepEqual(workLines({ ...d, description: undefined, text: 'Řádek\n  dva.\n' })[0], 'Řádek dva.', 'a text of more lines on one line');
  assert.deepEqual(workLines({ ...d, instagram: undefined }).at(-1), 'draft · instagram: - · pinterest · mockups · status: sold', 'Instagram photos without a link yet');
  assert.deepEqual(workLines({ meta_draft: false, meta_instagram: false, meta_pinterest: false, mockups: false, instagram: 'https://www.instagram.com/p/x/' }),
    ['instagram: https://www.instagram.com/p/x/'], 'a link without Instagram photos is an attribute; switches that are off say nothing');
  assert.deepEqual(workLines({}), []);
});

test('workLines: each detail photo on a line of its own under the description, the default status left out', () => {
  const d = { text: 'Ráno u jezu.', details: { mlha: 'Mlha nad vodou.', brana: '' }, status: 'not-for-sale', technique: 'akvarel' };
  assert.deepEqual(workLines(d), ['Ráno u jezu.', 'detail mlha: Mlha nad vodou.', 'detail brana', 'technique: akvarel']);
  assert.deepEqual(workLines({ ...d, status: 'sold' }).at(-1), 'status: sold · technique: akvarel');
  assert.deepEqual(workLines({ details: {}, status: 'available' }), ['status: available'], 'no details, no lines');
  assert.deepEqual(workLines({ details: 'les' }), ['details: les'], 'a wrong value stays an attribute (the checks report it)');
});

test('workLines: text and captions of details formatted as on the site, links to the site with its full address', () => {
  const d = { text: 'Ráno **u jezu**.\n\nDruhý odstavec, [kolekce](/tvorba/kolekce/x/).\n', description: 'Pro *Google*.', details: { mlha: 'Mlha *nad* vodou.' } };
  assert.deepEqual(workLines(d, { siteUrl: 'https://pavla.example' }), [
    'Ráno **u jezu**.',
    'Druhý odstavec, [kolekce](https://pavla.example/tvorba/kolekce/x/).',
    'Google: Pro \\*Google\\*.',
    'detail mlha: Mlha *nad* vodou.',
  ]);
});

test('pagesReadme: the home page, the pages and the years, links to the description and the site, texts formatted', () => {
  const text = pagesReadme({
    siteUrl: 'https://pavla.example',
    home: { yamlPath: '_index.yaml', data: { heading: 'Barvy\na voda\n', text: 'Ahoj **světe**.\n', button: 'Tvorba', empty_text: 'Brzy.', empty_closing: 'Viz [IG](https://ig.example/).\n' } },
    pages: [
      { name: '404', yamlPath: 'stranky/404.yaml', data: { title: 'T', heading: 'H', text: 'Nic.\n', closing: 'Zkuste [tvorbu](/tvorba/).\n', description: 'Pro Google.' } },
      { name: 'o-mne', yamlPath: 'stranky/o-mne.yaml', data: { text: 'První.\n\nDruhý *odstavec*.\n' } },
    ],
    years: [{ year: '2025', yamlPath: 'roky/2025.yaml', data: { text: '' } }, { year: '2026', yamlPath: 'roky/2026.yaml', data: { text: 'Rok.\n' } }],
  });
  assert.deepEqual(text.match(/^(##+ .*|---)$/gm), ['## Úvodní stránka', '---', '## Stránky', '### O mně', '### Stránka nenalezena (404)', '---', '## Roky', '### Rok 2026', '### Rok 2025']);
  assert.doesNotMatch(pagesReadme({ home: { yamlPath: '_index.yaml', data: {} } }), /---|## Stránky|## Roky/, 'no empty parts');
  assert.match(text, /## Úvodní stránka\n\n\[\\_index\.yaml\]\(\.\.\/\.\.\/_index\.yaml\) · \[web\]\(https:\/\/pavla\.example\/\)\n\nNadpis: Barvy \/ a voda\n\nAhoj \*\*světe\*\*\.\n\nTlačítko: Tvorba\n\nPrázdný web: Brzy\.\n\nPrázdný web, pod ní: Viz \[IG\]\(https:\/\/ig\.example\/\)\.\n/);
  assert.match(text, /### O mně\n\n\[o-mne\.yaml\]\(\.\.\/\.\.\/stranky\/o-mne\.yaml\) · \[web\]\(https:\/\/pavla\.example\/o-mne\/\)\n\nPrvní\.\n\nDruhý \*odstavec\*\.\n/);
  assert.match(text, /### Stránka nenalezena \(404\)\n\n\[404\.yaml\]\(\.\.\/\.\.\/stranky\/404\.yaml\)\n\nUkáže se na každé adrese.*\n\nTitulek: T\n\nNadpis: H\n\nNic\.\n\nZávěr: Zkuste \[tvorbu\]\(https:\/\/pavla\.example\/tvorba\/\)\.\n\nGoogle: Pro Google\.\n/, 'no web link: any address');
  assert.match(text, /### Rok 2025\n\n.*\n\n_\(bez textu\)_\n$/);
});
