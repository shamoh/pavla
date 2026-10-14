import { test } from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { TEXT_WIDTH, commentedOutKeys, normalizeMetadata, schemaKeysIn, skeleton, todoKeys, unindentedText, yamlProblem } from './metadata-yaml.mjs';
import { COLLECTION_SKELETON_TEXT, COLLECTION_SCHEMA, HOME_SCHEMA, PHOTO_SCHEMA, TODO, UNCOLLECTED_SCHEMA, UNKNOWN_DOC, WORK_SCHEMA, YEAR_SCHEMA, fieldKeys } from './schema.mjs';

// A small schema keeps the expected texts readable.
const schema = {
  header: ['Nový soubor.'],
  fields: [
    { key: 'id', generated: true, doc: 'Kód, neměnit.', value: null },
    { key: 'demo', optional: true, doc: 'Jen testovací data.', value: true },
    { key: 'draft', doc: 'true = skryté.', value: true, missing: false },
    { key: 'title', doc: 'Název.', value: '' },
    { key: 'size', doc: ['Rozměr [a, b],', 'např. [30, 40].'], value: [0, 0], missing: null, previous: ['Rozměr, starý text.'] },
    { key: 'text', block: true, doc: 'Popis.', value: 'Pár vět.\n', missing: null },
  ],
};
const norm = (text, opts) => normalizeMetadata(text, schema, opts);

test('a complete file: header, technical comment above every attribute, empty line between them', () => {
  const r = norm('# Můj soubor.\n\nid: k3f9a\ndraft: false\ntitle: Ráno\nsize: [21, 15]\ntext: |\n  Řádek.\n');
  assert.equal(r.problem, null);
  assert.equal(r.text, [
    '# Můj soubor.',
    '',
    '# Kód, neměnit.',
    'id: k3f9a',
    '',
    '# true = skryté.',
    'draft: false',
    '',
    '# Název.',
    'title: Ráno',
    '',
    '# Rozměr [a, b],',
    '# např. [30, 40].',
    'size: [21, 15]',
    '',
    '# Popis.',
    'text: |',
    '  Řádek.',
    '',
  ].join('\n'));
  assert.deepEqual([r.added, r.unknown], [[], []]);
  // a second run changes nothing
  assert.equal(norm(r.text).changed, false);
});

test('a missing attribute is added with DOPLNIT and a value that means the same as its absence', () => {
  const r = norm('id: k3f9a\ntitle: Ráno\n');
  assert.deepEqual(r.added, ['draft', 'size', 'text']);
  const data = YAML.parse(r.text);
  assert.deepEqual(data, { id: 'k3f9a', draft: false, title: 'Ráno', size: null, text: null }, 'draft: false, not the skeleton default true');
  assert.match(r.text, new RegExp(`# ${TODO} true = skryté\\.\\ndraft: false`));
  assert.match(r.text, /# Název\.\ntitle: Ráno/, 'an attribute that was there is not marked');
  assert.doesNotMatch(r.text, /demo/, 'optional attributes are never added');
});

test('order follows the schema; values and how they are written stay (quotes, blocks, flow lists)', () => {
  const r = norm('text: |\n  A\n  B\ntitle: "Ráno"\nsize: [16.5, 4]\nid: k3f9a\ndraft: false\n');
  assert.deepEqual(Object.keys(YAML.parse(r.text)), ['id', 'draft', 'title', 'size', 'text']);
  assert.match(r.text, /title: "Ráno"/);
  assert.match(r.text, /size: \[16\.5, 4\]/);
  assert.match(r.text, /text: \|\n {2}A\n {2}B\n/);
});

test('own comments stay above the technical one; DOPLNIT stays until people remove it', () => {
  const first = norm('id: k3f9a\ntitle: Ráno\n');
  // the author writes a note above size and removes DOPLNIT from draft only
  const edited = first.text
    .replace(`# ${TODO} Rozměr`, '# změřeno v rámu\n# DOPLNIT Rozměr')
    .replace(`# ${TODO} true = skryté.`, '# true = skryté.');
  const r = norm(edited);
  assert.match(r.text, /# změřeno v rámu\n# DOPLNIT Rozměr \[a, b\],\n# např\. \[30, 40\]\.\nsize:/);
  assert.match(r.text, /\n# true = skryté\.\ndraft: false/);
  assert.equal(r.changed, false);
});

test('an outdated technical comment is replaced by the current wording, keeping DOPLNIT', () => {
  const r = norm(`id: k3f9a\ndraft: false\ntitle: Ráno\n# vlastní\n# ${TODO} Rozměr, starý text.\nsize: [1, 2]\ntext:\n`);
  assert.match(r.text, new RegExp(`# vlastní\\n# ${TODO} Rozměr \\[a, b\\],\\n# např\\. \\[30, 40\\]\\.\\nsize: \\[1, 2\\]`));
  assert.doesNotMatch(r.text, /starý text/);
});

test('unknown attributes stay, at the end, marked NEZNÁMÝ; once known the mark goes', () => {
  const r = norm('id: k3f9a\nmockup: true   # překlep\ndraft: false\ntitle: Ráno\nsize:\ntext:\n');
  assert.deepEqual(r.unknown, ['mockup']);
  assert.ok(r.text.endsWith(`text:\n\n# překlep\n# ${UNKNOWN_DOC}\nmockup: true\n`), r.text);
  assert.equal(norm(r.text).changed, false);

  const known = normalizeMetadata(r.text, { ...schema, fields: [...schema.fields, { key: 'mockup', doc: 'Mockupy.', value: false }] });
  assert.doesNotMatch(known.text, /NEZNÁMÝ/);
  assert.match(known.text, /# překlep\n# Mockupy\.\nmockup: true/);
});

test('old files: comments at the end of a line move above the attribute, old template texts go', () => {
  const r = norm([
    '# Popis obrazu – ODHAD podle fotky.',
    'id: k3f9a                   # unikátní kód obrazu, NEMĚNIT',
    'draft: false',
    'title: Ráno                 # podle nápisu na obraze',
    'size: [21, 15]              # šířka × výška v cm',
    'text: |',
    '  Popis.',
    '',
  ].join('\n'));
  assert.match(r.text, /^# Popis obrazu – ODHAD podle fotky\.\n\n# Kód, neměnit\.\nid: k3f9a\n/, 'the comment above the first attribute was the file comment');
  assert.match(r.text, /# podle nápisu na obraze\n# Název\.\ntitle: Ráno/);
  assert.doesNotMatch(r.text, /NEMĚNIT|šířka × výška/);
  assert.equal(norm(r.text).changed, false);
});

test('an optional attribute (demo) is kept in its place when present', () => {
  const r = norm('id: k3f9a\ndemo: true\ndraft: false\ntitle: Ráno\nsize:\ntext:\n');
  assert.match(r.text, /id: k3f9a\n\n# Jen testovací data\.\ndemo: true\n\n# true = skryté/);
});

test('invalid YAML or something else than attributes: reported, the text stays', () => {
  for (const text of ['title: [neuzavřené\n', '- a\n- b\n']) {
    const r = norm(text);
    assert.ok(r.problem);
    assert.equal(r.text, text);
    assert.equal(r.changed, false);
  }
});

test('skeleton: every attribute with its skeleton default, DOPLNIT everywhere except generated ones', () => {
  const text = skeleton(schema, { id: 'k3f9a', title: 'Ráno' });
  assert.deepEqual(YAML.parse(text), { id: 'k3f9a', draft: true, title: 'Ráno', size: [0, 0], text: 'Pár vět.\n' });
  assert.match(text, /^# Nový soubor\.\n\n# Kód, neměnit\.\nid: k3f9a\n/);
  assert.equal(text.match(new RegExp(`# ${TODO} `, 'g')).length, 4);
  assert.equal(normalizeMetadata(text, schema).changed, false);
});

test('the real schemas: skeletons contain every attribute; DOPLNIT on all but generated, settled and commented-out ones', () => {
  for (const s of [WORK_SCHEMA, COLLECTION_SCHEMA, PHOTO_SCHEMA, YEAR_SCHEMA, HOME_SCHEMA]) {
    const text = skeleton(s, { id: 'k3f9a', title: 'X', date: '2026-06-14', alt: 'X' });
    // optional attributes (meta_corners) are added later by the pipeline, never by a skeleton
    assert.deepEqual(schemaKeysIn(text, s), s.fields.filter((f) => !f.optional).map((f) => f.key), s.name);
    const marked = text.split('\n').filter((l) => l.startsWith(`# ${TODO} `)).length;
    const toCheck = s.fields.filter((f) => !f.generated && !f.optional && !f.settled && !f.commented);
    assert.equal(marked, toCheck.length, s.name);
    assert.equal(normalizeMetadata(text, s).changed, false, s.name);
  }
});

test('todoKeys: the attributes still marked DOPLNIT, in file order', () => {
  const text = skeleton(schema, { id: 'k3f9a', title: 'Ráno' })
    .replace(`# ${TODO} Název.`, '# Název.')
    .replace(`# ${TODO} Rozměr`, `# vlastní poznámka\n# ${TODO} Rozměr`);
  assert.deepEqual(todoKeys(text), ['draft', 'size', 'text']);
  assert.deepEqual(todoKeys(norm('id: k3f9a\ndraft: false\ntitle: Ráno\nsize: [1, 2]\ntext:\n').text), []);
  assert.deepEqual(todoKeys(`# ${TODO} nahoře v souboru\n\nid: k3f9a\n`), [], 'the file comment is not an attribute');
});

// A small schema with a commented-out attribute.
const withOff = { header: [], fields: [
  { key: 'title', doc: 'Název.', value: '' },
  { key: 'crop', commented: true, example: '"3:2"', doc: 'Ořez.', value: null, previous: ['Ořez, starý text.'] },
  { key: 'note', doc: 'Poznámka.', value: '' },
] };

test('commented-out attribute: there as a comment line under its technical comment, never DOPLNIT', () => {
  const r = normalizeMetadata('title: A\nnote: ""\n', withOff);
  assert.equal(r.text, '# Název.\ntitle: A\n\n# NEPOVINNÉ. Ořez.\n# crop: "3:2"\n\n# Poznámka.\nnote: ""\n');
  assert.deepEqual(r.added, [], 'not reported as added, nothing to fill in');
  assert.equal(normalizeMetadata(r.text, withOff).changed, false);
  assert.deepEqual(todoKeys(r.text), []);
  assert.deepEqual(schemaKeysIn(r.text, withOff), ['title', 'crop', 'note']);
  assert.equal(YAML.parse(r.text).crop, undefined);
});

test('commented-out attribute: switched on by removing "# ", an empty value is commented out again', () => {
  const on = normalizeMetadata('# Název.\ntitle: A\n\n# NEPOVINNÉ. Ořez.\ncrop: "2:1"\n\n# Poznámka.\nnote: ""\n', withOff);
  assert.equal(on.changed, false);
  assert.equal(YAML.parse(on.text).crop, '2:1');
  const empty = normalizeMetadata('title: A\n# moje\ncrop:\nnote: ""\n', withOff);
  assert.equal(empty.problem, null);
  assert.match(empty.text, /\n# moje\n# NEPOVINNÉ\. Ořez\.\n# crop: "3:2"\n/, 'the own comment stays');
  assert.equal(normalizeMetadata(empty.text, withOff).changed, false, 'and stays there on the next run');
});

test('commented-out attribute given a value in a skeleton: set and marked DOPLNIT, kept on the next run', () => {
  const text = skeleton(withOff, { crop: '2:1' });
  assert.match(text, /\n# DOPLNIT NEPOVINNÉ\. Ořez\.\ncrop: 2:1\n/);
  assert.deepEqual(todoKeys(text).includes('crop'), true);
  assert.equal(normalizeMetadata(text, withOff).changed, false);
  assert.match(skeleton(withOff, { crop: '' }), /\n# crop: "3:2"\n/, 'an empty value stays commented out');
});

test('commented-out attribute: an older wording of its comment is replaced', () => {
  const r = normalizeMetadata('title: A\n\n# Ořez, starý text.\n# crop: "3:2"\n\nnote: ""\n', withOff);
  assert.match(r.text, /# NEPOVINNÉ\. Ořez\.\n# crop: "3:2"/);
  // before it was a commented-out attribute: the comment without the mark
  const was = normalizeMetadata('title: A\n# Ořez.\ncrop:\nnote: ""\n', withOff);
  assert.match(was.text, /\ntitle: A\n\n# NEPOVINNÉ\. Ořez\.\n# crop: "3:2"\n\n# Poznámka/);
  assert.doesNotMatch(r.text, /starý text/);
});

test('commented-out attribute: an older wording written with the OPTIONAL mark is replaced, not doubled', () => {
  for (const line of ['# crop: "3:2"', 'crop: "2:1"']) {
    const r = normalizeMetadata(`title: A\n\n# NEPOVINNÉ. Ořez, starý text.\n${line}\n\nnote: ""\n`, withOff);
    assert.doesNotMatch(r.text, /starý text/, line);
    assert.equal(r.text.match(/NEPOVINNÉ/g).length, 1, line);
    assert.equal(normalizeMetadata(r.text, withOff).changed, false, line);
  }
});

test('the real work schema: an enum written on one line before is rewritten as a list, DOPLNIT kept', () => {
  const old = [
    '# DOPLNIT Stav prodeje: available (k prodeji) | reserved (rezervováno) | sold (prodáno)',
    '# | not-for-sale (není na prodej, na webu bez štítku).',
    'status: sold',
    '',
    '# true = rozpracovaný, na webu se nezobrazí; false = zveřejnit.',
    'meta_draft: true',
    '',
  ].join('\n');
  const r = normalizeMetadata(old, WORK_SCHEMA);
  assert.equal(r.problem, null);
  assert.match(r.text, /\n# DOPLNIT Stav obrazu, možnosti:\n# - available - k prodeji[^\n]*\n# - reserved - [^\n]*\n# - sold - prodáno[^\n]*\n# - gifted - darováno[^\n]*\n# - not-for-sale - [^\n]*\nstatus: sold\n/);
  assert.match(r.text, /# Rozpracovaný obraz, možnosti:\n# - true - rozpracovaný, na webu se nezobrazí\n# - false - zveřejnit\nmeta_draft: true\n/);
  assert.doesNotMatch(r.text, /\| not-for-sale|true = rozpracovaný/, 'the old wording is gone, not doubled');
  assert.equal(normalizeMetadata(r.text, WORK_SCHEMA).changed, false);
});

test('the real work schema: support and size_cm list the common papers; old wordings and the old example are replaced', () => {
  const old = [
    '# NEPOVINNÉ. Podklad, např. papír Arches 300 g. Bez něj se na webu nezobrazí.',
    '# support: papír Arches 300 g',
    '',
    '# DOPLNIT Šířka × výška v cm, např. [30, 40]. Povinné u zveřejněného obrazu:',
    '# podle rozměrů se dělají mockupy ve skutečné velikosti.',
    'size_cm: [38, 29]',
    '',
  ].join('\n');
  const r = normalizeMetadata(old, WORK_SCHEMA);
  assert.equal(r.problem, null);
  assert.match(r.text, /\n# NEPOVINNÉ\. Podklad, např\. papír\. [^\n]*Nejčastější možnosti jsou:\n(# - [^\n]*\n){5}# support: papír Canson XL Aquarelle \(300 g\), 100% celulóza\n/);
  assert.match(r.text, /\n# DOPLNIT Šířka × výška v cm[^\n]*\n# Podle rozměrů [^\n]*\n# - \[38, 29\] - Baohong\n(# - [^\n]*\n){6}size_cm: \[38, 29\]\n/);
  assert.doesNotMatch(r.text, /Arches|podle rozměrů se dělají/, 'the old wording is gone, not doubled');
  assert.equal(normalizeMetadata(r.text, WORK_SCHEMA).changed, false);
});

test('the real work schema: list items once written with an en dash (–) get a plain hyphen (-)', () => {
  const old = '# DOPLNIT Stav prodeje, možnosti:\n# - available – k prodeji (s cenou price)\n# - reserved – rezervováno (s cenou price)\n'
    + '# - sold – prodáno\n# - not-for-sale – není na prodej, na webu bez štítku\nstatus: sold\n';
  const r = normalizeMetadata(old, WORK_SCHEMA);
  assert.match(r.text, /\n# DOPLNIT Stav obrazu, možnosti:\n# - available - k prodeji[^\n]*\n(# - [^\n]*\n){4}status: sold\n/);
  assert.doesNotMatch(r.text, /–/, 'no en dash left anywhere in a new comment');
});

test('settled attribute: its default is final, never marked DOPLNIT, an old DOPLNIT goes', () => {
  const settled = { header: [], fields: [
    { key: 'title', doc: 'Název.', value: '' },
    { key: 'draft', settled: true, doc: 'true = skryté.', value: true, missing: false },
  ] };
  assert.equal(skeleton(settled, { title: 'A' }), '# DOPLNIT Název.\ntitle: A\n\n# true = skryté.\ndraft: true\n');
  const added = normalizeMetadata('title: A\n', settled);
  assert.match(added.text, /\n# true = skryté\.\ndraft: false\n/);
  assert.deepEqual(added.added, ['draft']);
  const old = normalizeMetadata(`title: A\n# ${TODO} true = skryté.\ndraft: true\n`, settled);
  assert.match(old.text, /\n# true = skryté\.\ndraft: true\n/);
});

test('own private_ attributes: kept among the private_ ones alphabetically, without NEZNÁMÝ, also when known before', () => {
  const r = normalizeMetadata(`id: k3f9a\n# ${UNKNOWN_DOC}\nprivate_zzz: z\nprivate_kupec: teta\ntitle: A\nprivate_note: n\n`, WORK_SCHEMA);
  assert.equal(r.problem, null);
  assert.deepEqual(r.unknown, []);
  const keys = Object.keys(YAML.parse(r.text));
  assert.deepEqual(keys.slice(-3), ['private_kupec', 'private_note', 'private_zzz']);
  assert.doesNotMatch(r.text, /NEZNÁMÝ/);
  assert.match(r.text, /\n\nprivate_kupec: teta\n/, 'no technical comment above an own attribute');
  assert.equal(normalizeMetadata(r.text, WORK_SCHEMA).changed, false, 'idempotent');
});

test('a former name or a derived_ attribute is a problem; the file stays as it is', () => {
  const old = 'title: A\ndraft: true\n';
  const r = normalizeMetadata(old, WORK_SCHEMA);
  assert.equal(r.problem, 'draft: přejmenováno na meta_draft, přejmenuj ho [prejmenovany-atribut]');
  assert.equal(r.text, old);
  assert.equal(r.changed, false);
  assert.match(normalizeMetadata('title: A\nderived_collection: x\n', WORK_SCHEMA).problem, /^derived_collection: údaje derived_ vyrábí automatika pro web/);
});

test('the comment of the file stays on top when its first attribute moves down (schema order)', () => {
  const r = normalizeMetadata('# Můj obraz.\n\ntitle: A\nid: k3f9a\n', WORK_SCHEMA);
  assert.match(r.text, /^# Můj obraz\.\n\n# Rozpracovaný obraz, možnosti:/);
  assert.equal(r.text.match(/Můj obraz/g).length, 1);
  // a skeleton starting with commented-out attributes is in line right away
  for (const s of [YEAR_SCHEMA, HOME_SCHEMA, COLLECTION_SCHEMA]) {
    const text = skeleton(s, { title: 'X' });
    assert.equal(normalizeMetadata(text, s).changed, false, s.name);
  }
});

test('copies of the technical comment right above it (left by an earlier run) go; the own comment above them stays', () => {
  const r = norm(`id: k3f9a\ndraft: false\ntitle: Ráno\n# vlastní\n# Rozměr [a, b],\n# např. [30, 40].\n# Rozměr, starý text.\nsize: [1, 2]\ntext:\n`);
  assert.match(r.text, /\ntitle: Ráno\n\n# vlastní\n# Rozměr \[a, b\],\n# např\. \[30, 40\]\.\nsize: \[1, 2\]/);
  assert.equal(r.text.match(/Rozměr \[a, b\]/g).length, 1);
  assert.doesNotMatch(r.text, /starý text/);
  assert.equal(norm(r.text).changed, false);
});

test('commented-out attribute: copies of its comment above it go (current, older and repeated), the own comment stays', () => {
  const current = normalizeMetadata('title: A\n\n# moje\n# NEPOVINNÉ. Ořez.\n# NEPOVINNÉ. Ořez.\n# crop: "3:2"\n\n# Poznámka.\nnote: ""\n', withOff);
  assert.equal(current.text, '# Název.\ntitle: A\n\n# moje\n# NEPOVINNÉ. Ořez.\n# crop: "3:2"\n\n# Poznámka.\nnote: ""\n');
  // the current wording written above the older one by a run that did not know the older one yet
  const older = normalizeMetadata('title: A\n\n# NEPOVINNÉ. Ořez.\n# NEPOVINNÉ. Ořez.\n# Ořez, starý text.\n# crop: "3:2"\n\nnote: ""\n', withOff);
  assert.match(older.text, /\ntitle: A\n\n# NEPOVINNÉ\. Ořez\.\n# crop: "3:2"\n\n# Poznámka/);
  assert.equal(normalizeMetadata(older.text, withOff).changed, false);
});

test('the comment of a deleted attribute left above the next one goes, also when the attribute is added again', () => {
  // people deleted "size" but not its comment (now above "text"), the pipeline adds "size" again with its comment
  const left = 'id: k3f9a\ndraft: false\ntitle: Ráno\n\n# Rozměr [a, b],\n# např. [30, 40].\n\n# Popis.\ntext:\n';
  const r = norm(left);
  assert.equal(r.text.match(/Rozměr \[a, b\]/g).length, 1);
  assert.ok(r.text.endsWith(`\ntitle: Ráno\n\n# ${TODO} Rozměr [a, b],\n# např. [30, 40].\nsize:\n\n# Popis.\ntext:\n`));
  assert.equal(norm(r.text).changed, false);
});

test('a doubled comment of another attribute goes (older wording, with DOPLNIT); the own comment around it stays', () => {
  const r = norm(`id: k3f9a\n\n# moje\n\n# ${TODO} Rozměr [a, b],\n# např. [30, 40].\n# Rozměr, starý text.\n# druhá moje\n# true = skryté.\ndraft: false\ntitle: Ráno\nsize: [1, 2]\ntext:\n`);
  assert.match(r.text, /\nid: k3f9a\n\n# moje\n\n# druhá moje\n# true = skryté\.\ndraft: false\n/);
  assert.equal(r.text.match(/Rozměr \[a, b\]/g).length, 1);
  assert.doesNotMatch(r.text, /starý text/);
  // only exact copies go: a changed wording is the author's own comment
  const edited = norm('id: k3f9a\n# Rozměr [a, b], ručně\n# např. [30, 40].\ndraft: false\ntitle: Ráno\nsize: [1, 2]\ntext:\n');
  assert.match(edited.text, /\n# Rozměr \[a, b\], ručně\n# např\. \[30, 40\]\.\n# true = skryté\.\ndraft: false/);
});

test('the comment of a deleted attribute is never taken for the file comment', () => {
  const r = norm('# Rozměr [a, b],\n# např. [30, 40].\n\nid: k3f9a\ndraft: false\ntitle: Ráno\nsize: [1, 2]\ntext:\n', { header: ['Nový soubor.'] });
  assert.match(r.text, /^# Nový soubor\.\n\n# Kód, neměnit\.\nid: k3f9a\n/);
  assert.equal(r.text.match(/Rozměr \[a, b\]/g).length, 1);
});

test('the real work schema: meta_corners deleted and found again has its comment once (also cleans doubled ones)', () => {
  const corners = { photo: [100, 80], tl: [1, 2], tr: [3, 4], br: [5, 6], bl: [7, 8] };
  const work = skeleton(WORK_SCHEMA, { id: 'k3f9a', title: 'Ráno', date: '2026-05-01', meta_corners: corners });
  const count = (text) => text.match(/^# Rohy obrazu na fotce/gm).length;
  const deleted = work.replace(/^meta_corners:\n( {2}.*\n)+/m, '');
  assert.equal(count(deleted), 1);
  const after = normalizeMetadata(deleted, WORK_SCHEMA);
  assert.doesNotMatch(after.text, /Rohy obrazu na fotce/);
  const again = normalizeMetadata(deleted, WORK_SCHEMA, { values: { meta_corners: corners } });
  assert.equal(count(again.text), 1);
  // a file doubled by the earlier pipeline: the stray copy above meta_draft goes
  const doubled = work.replace(/\n(# Rozpracovaný obraz)/, `\n${work.match(/^# Rohy obrazu[\s\S]*?(?=\nmeta_corners:)/m)[0]}\n\n$1`);
  assert.equal(count(doubled), 2);
  const cleaned = normalizeMetadata(doubled, WORK_SCHEMA);
  assert.equal(cleaned.text, work);
});

// A text longer than TEXT_WIDTH: words of different lengths, one double space.
const LONG = `${'Ráno nad rybníkem, mlha se drží nad hladinou a slunce '.repeat(4)}prosvítá  mezi olšemi.`;

test('a long one-paragraph text of a block attribute becomes a folded block: the same text, lines up to TEXT_WIDTH', () => {
  for (const written of [JSON.stringify(LONG), `|\n  ${LONG}`]) {
    const r = norm(`id: k3f9a\ndraft: false\ntitle: ${LONG}\nsize: [1, 2]\ntext: ${written}\n`);
    assert.equal(r.problem, null);
    assert.match(r.text, /\ntext: >-?\n {2}Ráno/);
    const block = r.text.slice(r.text.indexOf('text: >'));
    assert.ok(block.split('\n').length > 2, 'broken into more lines');
    assert.ok(block.split('\n').every((l) => l.length <= TEXT_WIDTH));
    assert.equal(YAML.parse(r.text).text.trimEnd(), LONG, 'the text stays');
    assert.equal(norm(r.text).changed, false, 'and stays so on the next run');
    assert.match(r.text, new RegExp(`\\ntitle: ${LONG.slice(0, 20)}.*\\n`), 'not a block attribute: left on its line');
  }
});

test('a short text, an empty one and a text of more lines keep their form', () => {
  const text = `id: k3f9a\ndraft: false\ntitle: A\nsize: [1, 2]\ntext: |\n  První řádek.\n  ${LONG}\n`;
  assert.match(norm(text).text, new RegExp(`\\ntext: \\|\\n {2}První řádek\\.\\n {2}${LONG.slice(0, 20)}`));
  assert.match(norm('id: k3f9a\ndraft: false\ntitle: A\nsize: [1, 2]\ntext: Krátký.\n').text, /\ntext: Krátký\.\n/);
  const empty = { header: [], fields: [{ key: 'text', block: true, doc: 'Popis.', value: '' }] };
  assert.equal(skeleton(empty), '# DOPLNIT Popis.\ntext: ""\n', 'an empty skeleton value on the line of its key');
});

test('the real schemas: a long description of a work, collection, year, home and "Mimo kolekce" is folded', () => {
  const long = 'Slovo a ještě jedno slovo, '.repeat(8).trim();
  for (const schema of [WORK_SCHEMA, COLLECTION_SCHEMA, YEAR_SCHEMA, HOME_SCHEMA, UNCOLLECTED_SCHEMA]) {
    const r = normalizeMetadata(`description: ${JSON.stringify(long)}\n`, schema);
    assert.equal(r.problem, null, schema.name);
    assert.match(r.text, /\ndescription: >-\n {2}Slovo/, schema.name);
    assert.equal(YAML.parse(r.text).description, long, schema.name);
  }
});

test('stray: the number of stray technical comments removed, 0 without any', () => {
  const clean = norm('id: k3f9a\ndraft: false\ntitle: Ráno\nsize: [1, 2]\ntext:\n');
  assert.equal(clean.stray, 0);
  assert.equal(norm(clean.text).stray, 0);
  const two = norm('# Název.\n\nid: k3f9a\n# Rozměr [a, b],\n# např. [30, 40].\ndraft: false\ntitle: Ráno\nsize: [1, 2]\ntext:\n', { header: ['Nový soubor.'] });
  assert.equal(two.stray, 2, 'one in the file comment on top, one above draft');
  assert.equal(norm(two.text).stray, 0, 'the next run finds none');
  assert.equal(norm('id: [\n').stray, 0, 'a problem removes nothing');
});

test('commentedOutKeys: commented-out lines of attributes that are not optional, never lines of technical comments', () => {
  const text = [
    '# Kód, neměnit.', 'id: k3f9a', '# id: TODO', '', '#draft: true', '# Název.', 'title: Ráno',
    '# vlastní: poznámka', '# size: [1, 2]', `# ${TODO} Rozměr [a, b],`, '# např. [30, 40].', 'size:', 'text:', '',
  ].join('\n');
  assert.deepEqual(commentedOutKeys(text, schema), [
    { key: 'id', line: '# id: TODO', set: true },
    { key: 'draft', line: '#draft: true', set: false },
    { key: 'size', line: '# size: [1, 2]', set: true },
  ]);
  // a commented-out optional attribute ("# crop: …") is how it is switched off
  assert.deepEqual(commentedOutKeys('# NEPOVINNÉ. Ořez.\n# crop: "3:2"\ntitle: A\n', withOff), []);
  // the real work schema: a fresh skeleton has none, its examples in comments are no such lines
  assert.deepEqual(commentedOutKeys(skeleton(WORK_SCHEMA, { id: 'k3f9a', title: 'Ráno', date: '2026-05-01' }), WORK_SCHEMA), []);
});

const parseError = (text) => { try { YAML.parse(text); } catch (e) { return e; } return null; };

test('yamlProblem: a text not indented under its attribute says what to write instead (with or without "|")', () => {
  const long = 'Pohodové sluneční odpoledne babího léta u jezu na řece Otavě.';
  for (const head of ['description: ', 'description:', 'description: |', 'description: >-']) {
    const text = `title: Ráno\n\n# Pár vět.\n${head}\n${long}\n`;
    assert.equal(yamlProblem(parseError(text), text),
      'description: text pod „description:“ musí být odsazený (řádek 5); správně je na konci řádku „description: |“ a každý řádek '
      + 'textu pod ním začíná dvěma mezerami, např. „  Pohodové sluneční odpoledne babího léta…“ [spatny-yaml]', head);
  }
  // a short line is quoted whole; the normalization reports the same
  const short = 'title: Ráno\ndescription:\nKrátce.\nDruhý.\n';
  assert.match(yamlProblem(parseError(short), short), /řádek 3\).*např\. „  Krátce\.“ \[spatny-yaml\]$/);
  assert.match(normalizeMetadata(short, WORK_SCHEMA).problem, /^description: text pod „description:“ musí být odsazený/);
  // other mistakes, or without the text of the file: the general message
  const other = 'title: [Ráno\n';
  assert.match(yamlProblem(parseError(other), other), /^chybný zápis YAML na řádku \d+ \(zkontroluj odsazení, dvojtečky a uvozovky\) \[spatny-yaml\]$/);
  assert.match(yamlProblem(parseError(short)), /^chybný zápis YAML na řádku 3 /);
});

test('unindentedText: only a line at the edge right under an attribute without a value (comments and empty lines skipped)', () => {
  const text = 'title: Ráno\ndescription:\n\nText.\n# komentář\nsize: [1, 2]\n  odsazené\n';
  assert.deepEqual(unindentedText(text, 4), { key: 'description', line: 'Text.' });
  assert.equal(unindentedText(text, 1), null, 'nothing above');
  assert.equal(unindentedText(text, 5), null, 'a comment');
  assert.equal(unindentedText(text, 7), null, 'indented');
  assert.equal(unindentedText('title: Ráno\nText.\n', 2), null, 'the attribute above has a value');
  assert.equal(unindentedText('', 1), null);
});

test('skeletons: description ready as a block, a work with DOPLNIT, a collection with a sample sentence', () => {
  const work = skeleton(WORK_SCHEMA, { id: 'k3f9a', title: 'Ráno', date: '2026-05-01' });
  assert.ok(work.includes(`# mezerami; dlouhý řádek automatika zalomí.\ndescription: |\n  ${TODO} popisek\n`));
  assert.equal(YAML.parse(work).description, `${TODO} popisek\n`);
  const collection = skeleton(COLLECTION_SCHEMA, { title: 'Plenér' });
  assert.ok(collection.includes(`\ndescription: |\n  ${COLLECTION_SKELETON_TEXT}`));
  assert.ok(!COLLECTION_SKELETON_TEXT.startsWith(TODO), 'a collection is public at once: DOPLNIT would stop the run');
  // an existing file without a description gets none (missing), whatever the skeleton has
  for (const schema of [WORK_SCHEMA, COLLECTION_SCHEMA]) {
    const r = normalizeMetadata('title: Ráno\n', schema);
    assert.equal(YAML.parse(r.text).description, null, schema === WORK_SCHEMA ? 'work' : 'collection');
  }
  // the former wording of the comment is replaced in existing files
  const old = '# Pár vět o obraze, zobrazí se na jeho stránce. Stačí v uvozovkách na jeden řádek, dlouhý text automatika zalomí.\ndescription: ""\n';
  assert.ok(normalizeMetadata(old, WORK_SCHEMA).text.includes('Text piš pod „description: |“'));
  assert.ok(!normalizeMetadata(old, WORK_SCHEMA).text.includes('Stačí v uvozovkách'));
});
