import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { HOME_FIELDS, prepareHome } from './home.mjs';
import { HOME_TEXT } from './schema.mjs';

let dir;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'home-')); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('prepareHome writes a skeleton with the text the home page had, every attribute, DOPLNIT', async () => {
  const r = await prepareHome(dir);
  assert.deepEqual(r.created, ['uvod.yaml']);
  const text = await fs.readFile(path.join(dir, 'uvod.yaml'), 'utf8');
  assert.deepEqual(Object.keys(YAML.parse(text)), HOME_FIELDS);
  assert.equal(r.home.data.description, HOME_TEXT);
  assert.equal(r.home.coverPath, null);
  assert.match(text, /# DOPLNIT Text na úvodní stránce/);
  const again = await prepareHome(dir);
  assert.deepEqual([again.created, again.updated, again.problems], [[], [], []]);
});

test('prepareHome finds uvod.jpg, keeps a hand-written file and marks test data skeletons', async () => {
  await fs.writeFile(path.join(dir, 'uvod.yaml'), 'description: Ahoj.\n');
  await fs.writeFile(path.join(dir, 'uvod.jpg'), 'x');
  const r = await prepareHome(dir);
  assert.equal(r.home.data.description, 'Ahoj.');
  assert.equal(r.home.coverPath, path.join(dir, 'uvod.jpg'));
  assert.ok(r.updated.some((u) => u.startsWith('uvod.yaml')), 'brought in line with the schema');
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'home-'));
  assert.equal((await prepareHome(other, { demo: true })).home.data.demo, true);
  await fs.rm(other, { recursive: true, force: true });
});

test('prepareHome reports two home photos and a description that is not text', async () => {
  await fs.writeFile(path.join(dir, 'uvod.yaml'), 'description: [a]\n');
  await fs.writeFile(path.join(dir, 'uvod.jpg'), 'x');
  await fs.writeFile(path.join(dir, 'uvod.png'), 'x');
  const { problems } = await prepareHome(dir);
  assert.match(problems.join('\n'), /uvod\.yaml: description must be text/);
  assert.match(problems.join('\n'), /more than one home cover photo/);
});
