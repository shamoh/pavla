import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileLinks, lineOf } from './summary-links.mjs';

const TEXT = '# Popis.\n\n# Kód.\nid: k3f9a\n\n# Datum.\ndate: 2019-09\n\n# NEPOVINNÉ. Cena.\n# price: 2500\n';

test('lineOf: the line a message names, else the line of the attribute it starts with (also commented out)', () => {
  assert.equal(lineOf(TEXT, 'chybný zápis YAML na řádku 43 (zkontroluj odsazení)'), 43);
  assert.equal(lineOf(TEXT, 'description: text pod „description:“ musí být odsazený (řádek 44); správně …'), 44);
  assert.equal(lineOf(TEXT, 'date musí být den ve tvaru 2026-06-14, ne „2019-09“'), 7);
  assert.equal(lineOf(TEXT, 'price: stav „available“ potřebuje cenu'), 10, 'commented out');
  assert.equal(lineOf(TEXT, 'nemá štítky (tags), podle nich se v galerii filtruje'), null, 'no attribute first');
  assert.equal(lineOf(TEXT, 'title: chybí'), null, 'not in the file');
  assert.equal(lineOf(null, 'date musí být'), null);
});

let dir;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'links-'));
  await fs.mkdir(path.join(dir, 'tvorba/olejomalby'), { recursive: true });
  await fs.writeFile(path.join(dir, 'tvorba/olejomalby/kzk-snici.yaml'), TEXT);
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('fileLinks: the file on the branch, at the line of the message; nothing for a non-file or without an address', () => {
  const link = fileLinks('https://github.com/o/r/blob/oprava-pleneru/', dir);
  assert.equal(link('tvorba/olejomalby/kzk-snici.yaml'), 'https://github.com/o/r/blob/oprava-pleneru/tvorba/olejomalby/kzk-snici.yaml');
  assert.equal(link('tvorba/olejomalby/kzk-snici.yaml', 'date musí být den'), 'https://github.com/o/r/blob/oprava-pleneru/tvorba/olejomalby/kzk-snici.yaml#L7');
  assert.equal(link('tvorba/zmizely.yaml', 'date musí být den'), 'https://github.com/o/r/blob/oprava-pleneru/tvorba/zmizely.yaml', 'a missing file: no line');
  assert.equal(link('roky/2019 x.yaml'), 'https://github.com/o/r/blob/oprava-pleneru/roky/2019%20x.yaml', 'encoded');
  assert.equal(link('Technika „akvarel a tuš“ (3 díla)'), null);
  assert.equal(link(''), null);
  assert.equal(fileLinks('', dir), null);
});
