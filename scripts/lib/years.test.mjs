import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { YEAR_FIELDS, prepareYears } from './years.mjs';

let dir;
const file = (name) => path.join(dir, 'roky', name);
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'years-')); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('prepareYears: a skeleton for each year with works, every attribute, text empty (nothing on the site)', async () => {
  const r = await prepareYears(dir, ['2026', '2025', '2026']);
  assert.deepEqual(r.created, ['roky/2025.yaml', 'roky/2026.yaml']);
  assert.deepEqual(r.problems, []);
  const text = await fs.readFile(file('2026.yaml'), 'utf8');
  assert.deepEqual(Object.keys(YAML.parse(text)), YEAR_FIELDS);
  assert.equal(YAML.parse(text).description, '');
  assert.match(text, /# DOPLNIT Pár vět o roce/);
  assert.deepEqual(r.years.map((y) => y.year), ['2025', '2026']);
  // idempotent
  const again = await prepareYears(dir, ['2025', '2026']);
  assert.deepEqual([again.created, again.updated], [[], []]);
});

test('prepareYears keeps a text of a year without works, reads it, marks test data skeletons', async () => {
  await fs.mkdir(path.join(dir, 'roky'));
  await fs.writeFile(file('2024.yaml'), 'description: |\n  Rok plenérů.\n');
  const r = await prepareYears(dir, ['2025'], { demo: true });
  assert.deepEqual(r.years.map((y) => [y.year, y.data.description]), [['2024', 'Rok plenérů.\n'], ['2025', '']]);
  assert.equal(YAML.parse(await fs.readFile(file('2025.yaml'), 'utf8')).demo, true);
  assert.equal(YAML.parse(await fs.readFile(file('2024.yaml'), 'utf8')).demo, undefined, 'only new skeletons');
  assert.ok(r.updated.some((u) => u.startsWith('roky/2024.yaml')), 'brought in line with the schema');
});

test('prepareYears reports stray files, bad names and a description that is not text', async () => {
  await fs.mkdir(path.join(dir, 'roky'));
  await fs.writeFile(file('letos.yaml'), 'description: x\n');
  await fs.writeFile(file('2026.yaml'), 'description: [a, b]\n');
  const { problems } = await prepareYears(dir, []);
  assert.match(problems.join('\n'), /roky\/letos\.yaml: only descriptions of years \(2026\.yaml\) and their cover photos/);
  assert.match(problems.join('\n'), /roky\/2026\.yaml: description must be text/);
});
