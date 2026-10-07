import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { HOME_FIELDS, prepareHome } from './home.mjs';
import { HOME_SCHEMA, HOME_TEXT } from './schema.mjs';
import { schemaKeysIn } from './metadata-yaml.mjs';

let dir;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'home-')); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('prepareHome writes a skeleton with the text the home page had, every attribute, DOPLNIT', async () => {
  const r = await prepareHome(dir);
  assert.deepEqual(r.created, ['_index.yaml']);
  const text = await fs.readFile(path.join(dir, '_index.yaml'), 'utf8');
  assert.deepEqual(schemaKeysIn(text, HOME_SCHEMA), HOME_FIELDS);
  assert.match(text, /\n# aspect: "3:2"\n/, 'optional attributes commented out');
  assert.equal(r.home.data.description, HOME_TEXT);
  assert.equal(r.home.coverPath, null);
  assert.match(text, /# DOPLNIT Text na úvodní stránce/);
  const again = await prepareHome(dir);
  assert.deepEqual([again.created, again.updated, again.problems], [[], [], []]);
});

test('prepareHome finds _cover.jpg and keeps a hand-written file', async () => {
  await fs.writeFile(path.join(dir, '_index.yaml'), 'description: Ahoj.\n');
  await fs.writeFile(path.join(dir, '_cover.jpg'), 'x');
  const r = await prepareHome(dir);
  assert.equal(r.home.data.description, 'Ahoj.');
  assert.equal(r.home.coverPath, path.join(dir, '_cover.jpg'));
  assert.ok(r.updated.some((u) => u.startsWith('_index.yaml')), 'brought in line with the schema');
});

test('prepareHome reports two home photos and a description that is not text', async () => {
  await fs.writeFile(path.join(dir, '_index.yaml'), 'description: [a]\n');
  await fs.writeFile(path.join(dir, '_cover.jpg'), 'x');
  await fs.writeFile(path.join(dir, '_cover.png'), 'x');
  const { problems } = await prepareHome(dir);
  assert.match(problems.join('\n'), /_index\.yaml: description musí být text/);
  assert.match(problems.join('\n'), /víc úvodních fotek úvodní stránky/);
});

test('prepareHome refuses the former names uvod.yaml and uvod.jpg and writes no skeleton next to them', async () => {
  await fs.writeFile(path.join(dir, 'uvod.yaml'), 'description: Můj text.\n');
  await fs.writeFile(path.join(dir, 'uvod.jpg'), 'x');
  const r = await prepareHome(dir);
  assert.deepEqual(r.problems, ['uvod.jpg: tento soubor se teď jmenuje _cover.jpg, přejmenuj ho', 'uvod.yaml: tento soubor se teď jmenuje _index.yaml, přejmenuj ho']);
  assert.equal(r.home, null);
  assert.deepEqual(r.created, []);
  assert.equal(await fs.access(path.join(dir, '_index.yaml')).then(() => true, () => false), false, 'no skeleton hides the text');
  assert.equal(await fs.readFile(path.join(dir, 'uvod.yaml'), 'utf8'), 'description: Můj text.\n', 'the old file is left alone');

  // renamed: fine again; a leftover old photo next to the new file is still reported
  await fs.rename(path.join(dir, 'uvod.yaml'), path.join(dir, '_index.yaml'));
  const again = await prepareHome(dir);
  assert.equal(again.home.data.description, 'Můj text.');
  assert.deepEqual(again.problems, ['uvod.jpg: tento soubor se teď jmenuje _cover.jpg, přejmenuj ho']);
});
