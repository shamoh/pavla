import { test } from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import { normalizeMetadata, skeleton, todoKeys } from './metadata-yaml.mjs';
import { COLLECTION_SCHEMA, PHOTO_SCHEMA, TODO, UNKNOWN_DOC, WORK_SCHEMA, fieldKeys } from './schema.mjs';

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

test('the real schemas: skeletons contain every attribute and nothing is unknown or DOPLNIT-less but the id', () => {
  for (const s of [WORK_SCHEMA, COLLECTION_SCHEMA, PHOTO_SCHEMA]) {
    const text = skeleton(s, { id: 'k3f9a', title: 'X', date: '2026-06-14', alt: 'X' });
    assert.deepEqual(Object.keys(YAML.parse(text)), fieldKeys(s), s.name);
    const marked = text.split('\n').filter((l) => l.startsWith(`# ${TODO} `)).length;
    assert.equal(marked, fieldKeys(s).filter((k) => k !== 'id').length, s.name);
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
