import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { UNCOLLECTED_FIELDS, prepareUncollected } from './uncollected.mjs';
import { UNCOLLECTED_SCHEMA, UNCOLLECTED_SKELETON_TEXT } from './schema.mjs';
import { schemaKeysIn, todoKeys } from './metadata-yaml.mjs';

let dir;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'uncollected-'));
  await fs.mkdir(path.join(dir, 'tvorba'));
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('prepareUncollected writes a skeleton only once a work lies right in tvorba/: the text set in a block, the rest commented out', async () => {
  const none = await prepareUncollected(dir, false);
  assert.deepEqual([none.uncollected, none.created], [null, []]);
  const r = await prepareUncollected(dir, true);
  assert.deepEqual(r.created, ['tvorba/_index.yaml']);
  const text = await fs.readFile(path.join(dir, 'tvorba', '_index.yaml'), 'utf8');
  assert.deepEqual(schemaKeysIn(text, UNCOLLECTED_SCHEMA), UNCOLLECTED_FIELDS);
  assert.match(text, /\n# cover: k3f9a\n/);
  // a sample text, ready in a block ("|", indented), checked like any added value (DOPLNIT at its comment only)
  assert.ok(text.includes(`\ndescription: |\n  ${UNCOLLECTED_SKELETON_TEXT}`), text);
  assert.deepEqual(todoKeys(text), ['description']);
  assert.deepEqual(r.uncollected, { data: { description: UNCOLLECTED_SKELETON_TEXT }, yamlPath: 'tvorba/_index.yaml', coverPath: null });
  const again = await prepareUncollected(dir, true);
  assert.deepEqual([again.created, again.updated, again.problems], [[], [], []]);
});

test('prepareUncollected reads a hand-written file and the own cover photo, also without works', async () => {
  await fs.writeFile(path.join(dir, 'tvorba', '_index.yaml'), 'cover: k3f9a\naspect: "3:2"\ndescription: Samostatné listy.\n');
  await fs.writeFile(path.join(dir, 'tvorba', '_cover.jpg'), 'x');
  const r = await prepareUncollected(dir, false);
  assert.equal(r.uncollected.data.cover, 'k3f9a');
  assert.equal(r.uncollected.data.description, 'Samostatné listy.');
  assert.equal(r.uncollected.coverPath, path.join(dir, 'tvorba', '_cover.jpg'));
  assert.ok(r.updated.some((u) => u.startsWith('tvorba/_index.yaml')), 'brought in line with the schema');
});

test('prepareUncollected reports two cover photos', async () => {
  await fs.writeFile(path.join(dir, 'tvorba', '_cover.jpg'), 'x');
  await fs.writeFile(path.join(dir, 'tvorba', '_cover.png'), 'x');
  const { problems } = await prepareUncollected(dir, true);
  assert.deepEqual(problems, ['tvorba/_cover.jpg, tvorba/_cover.png: víc úvodních fotek obrazů mimo kolekce, nech jen jednu']);
});
