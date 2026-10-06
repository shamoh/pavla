import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_SCHEMA, HOME_SCHEMA, PHOTO_SCHEMA, WORK_SCHEMA, YEAR_SCHEMA, attributeGroup, compareKeys, fieldKeys, publicKeys,
} from './schema.mjs';

const SCHEMAS = [WORK_SCHEMA, COLLECTION_SCHEMA, PHOTO_SCHEMA, YEAR_SCHEMA, HOME_SCHEMA];

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
    'meta_corners', 'meta_draft', 'meta_instagram', 'id', 'date', 'description', 'details', 'featured', 'fler', 'mockups', 'price',
    'size_cm', 'status', 'support', 'tags', 'technique', 'title', 'private_note',
  ]);
});

test('publicKeys: the shared attributes, never meta_ or private_ ones', () => {
  assert.deepEqual(publicKeys(WORK_SCHEMA), [
    'id', 'date', 'description', 'details', 'featured', 'fler', 'mockups', 'price', 'size_cm', 'status', 'support', 'tags',
    'technique', 'title',
  ]);
  assert.deepEqual(publicKeys(COLLECTION_SCHEMA), ['aspect', 'cover', 'description', 'focus', 'title']);
  assert.deepEqual(publicKeys(YEAR_SCHEMA), ['aspect', 'cover', 'description', 'focus']);
  assert.deepEqual(publicKeys(PHOTO_SCHEMA), ['alt', 'caption', 'focus']);
});

test('renamed attributes of a work point to existing ones', () => {
  for (const now of Object.values(WORK_SCHEMA.renamed)) assert.ok(fieldKeys(WORK_SCHEMA).includes(now), now);
});
