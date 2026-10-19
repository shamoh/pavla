import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { HOME_FIELDS, prepareHome } from './home.mjs';
import { HOME_BUTTON, HOME_EMPTY_TEXT, HOME_HEADING, HOME_SCHEMA, HOME_TEXT, homeEmptyClosing } from './schema.mjs';
import { textProblems } from './content.mjs';
import { schemaKeysIn } from './metadata-yaml.mjs';

let dir;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'home-')); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('prepareHome writes a skeleton with the text the home page had, every attribute, DOPLNIT', async () => {
  const r = await prepareHome(dir, { instagram: 'pavla.test' });
  assert.deepEqual(r.created, ['_index.yaml']);
  const text = await fs.readFile(path.join(dir, '_index.yaml'), 'utf8');
  assert.deepEqual(schemaKeysIn(text, HOME_SCHEMA), HOME_FIELDS);
  assert.match(text, /\n# aspect: "3:2"\n/, 'optional attributes commented out');
  assert.equal(r.home.data.text, HOME_TEXT);
  assert.deepEqual([r.home.data.button, r.home.data.empty_text], [HOME_BUTTON, HOME_EMPTY_TEXT]);
  assert.equal(r.home.data.empty_closing, homeEmptyClosing('pavla.test'));
  assert.match(r.home.data.empty_closing, /\[na Instagramu\]\(https:\/\/www\.instagram\.com\/pavla\.test\/\)/);
  assert.equal(r.home.coverPath, null);
  assert.match(text, /# DOPLNIT Text na úvodní stránce/);
  assert.match(text, /\n# description: /, 'the description for search engines commented out');
  const again = await prepareHome(dir, { instagram: 'pavla.test' });
  assert.deepEqual([again.created, again.updated, again.problems], [[], [], []]);
});

test('prepareHome finds _cover.jpg and keeps a hand-written file', async () => {
  await fs.writeFile(path.join(dir, '_index.yaml'), 'text: Ahoj.\n');
  await fs.writeFile(path.join(dir, '_cover.jpg'), 'x');
  const r = await prepareHome(dir);
  assert.equal(r.home.data.text, 'Ahoj.\n', 'as a block');
  assert.equal(r.home.data.description, undefined);
  assert.equal(r.home.coverPath, path.join(dir, '_cover.jpg'));
  assert.ok(r.updated.some((u) => u.startsWith('_index.yaml')), 'brought in line with the schema');
  assert.equal(r.home.data.empty_closing, '', 'no Instagram given: no sentence');
});

test('prepareHome reports two home photos; a text that is not text is a problem of textProblems', async () => {
  await fs.writeFile(path.join(dir, '_index.yaml'), 'text: [a]\n');
  await fs.writeFile(path.join(dir, '_cover.jpg'), 'x');
  await fs.writeFile(path.join(dir, '_cover.png'), 'x');
  const { home, problems } = await prepareHome(dir);
  assert.match(problems.join('\n'), /víc úvodních fotek úvodní stránky/);
  assert.deepEqual(textProblems(home.yamlPath, home.data, HOME_SCHEMA), ['_index.yaml: text musí být text [popisek-neni-text]']);
});

test('prepareHome refuses the former names uvod.yaml and uvod.jpg and writes no skeleton next to them', async () => {
  await fs.writeFile(path.join(dir, 'uvod.yaml'), 'text: Můj text.\n');
  await fs.writeFile(path.join(dir, 'uvod.jpg'), 'x');
  const r = await prepareHome(dir);
  assert.deepEqual(r.problems, ['uvod.jpg: tento soubor se teď jmenuje _cover.jpg, přejmenuj ho [stare-jmeno-souboru]', 'uvod.yaml: tento soubor se teď jmenuje _index.yaml, přejmenuj ho [stare-jmeno-souboru]']);
  assert.equal(r.home, null);
  assert.deepEqual(r.created, []);
  assert.equal(await fs.access(path.join(dir, '_index.yaml')).then(() => true, () => false), false, 'no skeleton hides the text');
  assert.equal(await fs.readFile(path.join(dir, 'uvod.yaml'), 'utf8'), 'text: Můj text.\n', 'the old file is left alone');

  // renamed: fine again; a leftover old photo next to the new file is still reported
  await fs.rename(path.join(dir, 'uvod.yaml'), path.join(dir, '_index.yaml'));
  const again = await prepareHome(dir);
  assert.equal(again.home.data.text, 'Můj text.\n');
  assert.deepEqual(again.problems, ['uvod.jpg: tento soubor se teď jmenuje _cover.jpg, přejmenuj ho [stare-jmeno-souboru]']);
});

test('prepareHome: the heading of the home page, added with its default and required', async () => {
  await fs.writeFile(path.join(dir, '_index.yaml'), 'text: Ahoj.\n');
  const r = await prepareHome(dir);
  assert.equal(r.home.data.heading, HOME_HEADING, 'a file from before the heading gets the heading the page had');
  assert.ok(r.updated.some((u) => /doplněno [a-z_, ]*\bheading\b[a-z_, ]* \(výchozí hodnota\)/.test(u)), r.updated.join('\n'));
  assert.deepEqual(r.problems, []);
  await fs.writeFile(path.join(dir, '_index.yaml'), 'text: Ahoj.\nheading: ""\nbutton: " "\n');
  const empty = await prepareHome(dir);
  assert.deepEqual(empty.problems, [
    '_index.yaml: heading (velký nadpis úvodní stránky) je prázdný nebo není text, napiš ho [prazdny-nadpis]',
    '_index.yaml: button (text tlačítka na tvorbu) je prázdný nebo není text, napiš ho [prazdny-nadpis]',
  ]);
});
