import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_SCHEMA, HOME_SCHEMA, PHOTO_SCHEMA, UNCOLLECTED_SCHEMA, WORK_SCHEMA, YEAR_SCHEMA, attributeGroup, compareKeys, docLines, fieldKeys,
  optionProblems, publicKeys,
} from './schema.mjs';

const SCHEMAS = [WORK_SCHEMA, COLLECTION_SCHEMA, PHOTO_SCHEMA, YEAR_SCHEMA, HOME_SCHEMA, UNCOLLECTED_SCHEMA];

test('attributeGroup: the prefix decides the group', () => {
  assert.equal(attributeGroup('meta_draft'), 'meta');
  assert.equal(attributeGroup('private_note'), 'private');
  assert.equal(attributeGroup('derived_collection'), 'derived');
  assert.equal(attributeGroup('title'), 'shared');
  assert.equal(attributeGroup('metadata'), 'shared', 'only the whole prefix with the underscore counts');
});

test('compareKeys: meta_, then id and the shared ones alphabetically, then private_ and derived_', () => {
  const keys = ['title', 'private_note', 'id', 'meta_instagram', 'date', 'derived_x', 'meta_draft', 'private_kupec', 'aspect'];
  assert.deepEqual([...keys].sort(compareKeys), [
    'meta_draft', 'meta_instagram', 'id', 'aspect', 'date', 'title', 'derived_x', 'private_kupec', 'private_note',
  ]);
});

test('every schema is in file order and has only meta_, shared and private_ attributes', () => {
  for (const s of SCHEMAS) {
    const keys = fieldKeys(s);
    assert.deepEqual(keys, [...keys].sort(compareKeys), s.name);
    assert.ok(keys.every((k) => attributeGroup(k) !== 'derived'), `${s.name}: derived_ belong to the site repository only`);
  }
  assert.deepEqual(fieldKeys(WORK_SCHEMA), [
    'meta_corners', 'meta_draft', 'meta_instagram', 'meta_pinterest', 'id', 'date', 'description', 'details', 'featured', 'fler', 'instagram', 'mockups', 'price',
    'size_cm', 'status', 'support', 'tags', 'technique', 'title', 'private_note',
  ]);
});

test('publicKeys: the shared attributes, never meta_ or private_ ones', () => {
  assert.deepEqual(publicKeys(WORK_SCHEMA), [
    'id', 'date', 'description', 'details', 'featured', 'fler', 'instagram', 'mockups', 'price', 'size_cm', 'status', 'support',
    'tags', 'technique', 'title',
  ]);
  assert.deepEqual(publicKeys(COLLECTION_SCHEMA), ['aspect', 'cover', 'description', 'focus', 'title']);
  assert.deepEqual(publicKeys(YEAR_SCHEMA), ['aspect', 'cover', 'description', 'focus']);
  assert.deepEqual(publicKeys(PHOTO_SCHEMA), ['alt', 'caption', 'focus']);
});

test('renamed attributes of a work point to existing ones', () => {
  for (const now of Object.values(WORK_SCHEMA.renamed)) assert.ok(fieldKeys(WORK_SCHEMA).includes(now), now);
});

test('an attribute with options lists exactly them in its technical comment, one per line', () => {
  const withOptions = SCHEMAS.flatMap((s) => s.fields).filter((f) => f.options);
  assert.deepEqual(withOptions.map((f) => f.key), ['meta_draft', 'meta_instagram', 'meta_pinterest', 'featured', 'mockups', 'status'].filter((k) => withOptions.some((f) => f.key === k)));
  for (const f of withOptions) {
    const lines = docLines(f);
    assert.match(lines[0], /, možnosti:$/, f.key);
    const listed = lines.filter((l) => l.startsWith('- ')).map((l) => l.slice(2).split(' - ')[0]);
    assert.deepEqual(listed, f.options.map(String), f.key);
    assert.ok(f.options.includes(f.value), `${f.key}: the skeleton value is one of the options`);
  }
});

test('optionProblems: only values outside the options, in Czech with the options listed; missing values are fine', () => {
  const schema = { fields: [{ key: 'a', options: ['x', 'y'] }, { key: 'b', options: [true, false] }, { key: 'c' }] };
  assert.deepEqual(optionProblems('f.yaml', { a: 'z', b: 'ano', c: 'cokoli' }, schema), [
    'f.yaml: a „z“ není mezi možnostmi: x, y',
    'f.yaml: b „ano“ není mezi možnostmi: true, false',
  ]);
  assert.deepEqual(optionProblems('f.yaml', { a: 'x', b: false }, schema), []);
  assert.deepEqual(optionProblems('f.yaml', { a: null }, schema), []);
  assert.deepEqual(optionProblems('f.yaml', { b: [1] }, schema), ['f.yaml: b „[1]“ není mezi možnostmi: true, false']);
});

test('technical comments and file headers use a plain hyphen, never an en dash (–)', () => {
  for (const schema of SCHEMAS) {
    for (const line of [...(schema.header ?? []), ...schema.fields.flatMap(docLines)]) assert.ok(!line.includes('–'), line);
  }
});
