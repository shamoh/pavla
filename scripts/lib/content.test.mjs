import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { prepareContent, readTree, withId } from './content.mjs';
import { isValidId } from './works.mjs';

let dir;
const worksDir = () => path.join(dir, 'tvorba');
const write = async (rel, text = '') => {
  const p = path.join(worksDir(), rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text);
};
const read = (rel) => fs.readFile(path.join(worksDir(), rel), 'utf8');

beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-content-')); await fs.mkdir(worksDir()); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

test('withId puts the id first and keeps the rest of the file byte for byte', () => {
  const text = '# Header comment\ntitle: Ráno   # inline\ndate: 2026-06-14\n';
  const out = withId(text, 'k3f9a');
  assert.equal(out.split('\n')[0], '# Header comment');
  assert.equal(out.split('\n')[1], 'id: k3f9a');
  assert.equal(out.replace('id: k3f9a\n', ''), text);
  assert.deepEqual(YAML.parse(out), { id: 'k3f9a', title: 'Ráno', date: '2026-06-14' });
});

test('withId rejects metadata that is not a mapping', () => {
  assert.throws(() => withId('- a\n- b\n', 'k3f9a'), /mapping/);
});

test('readTree pairs images with metadata by slug and reports stray files', async () => {
  await write('2026/rano-u-rybnika.yaml', 'title: x');
  await write('2026/Ráno u rybníka.JPG');
  await write('2026/notes.txt');
  await write('2026/.DS_Store');
  await write('volny-soubor.jpg');
  const { years, problems } = await readTree(worksDir());
  assert.equal(years.length, 1);
  assert.deepEqual([...years[0].yamls.keys()], ['rano-u-rybnika']);
  assert.equal(years[0].images.get('rano-u-rybnika').file, 'Ráno u rybníka.JPG');
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => p.includes('notes.txt')));
  assert.ok(problems.some((p) => p.includes('volny-soubor.jpg')));
});

test('readTree reports two images mapping to the same slug', async () => {
  await write('2026/rano.jpg');
  await write('2026/Ráno.png');
  const { problems } = await readTree(worksDir());
  assert.equal(problems.length, 1);
  assert.match(problems[0], /already maps to "rano"/);
});

test('prepareContent creates a draft skeleton for a new image', async () => {
  await write('2026/Ráno u rybníka.jpg');
  const r = await prepareContent(dir, { today: new Date('2026-07-01T12:00:00Z') });
  assert.deepEqual(r.created, ['2026/rano-u-rybnika.yaml']);
  const data = YAML.parse(await read('2026/rano-u-rybnika.yaml'));
  assert.ok(isValidId(data.id));
  assert.equal(data.draft, true);
  assert.equal(data.title, 'Ráno u rybníka');
  assert.equal(String(data.date), '2026-07-01');
  assert.equal(r.works[0].masterPath, path.join(worksDir(), '2026', 'Ráno u rybníka.jpg'));
});

test('prepareContent dates a skeleton in an older year folder to 1 January', async () => {
  await write('2024/stary.jpg');
  await prepareContent(dir, { today: new Date('2026-07-01') });
  assert.equal(String(YAML.parse(await read('2024/stary.yaml')).date), '2024-01-01');
});

test('prepareContent assigns missing ids and is idempotent', async () => {
  await write('2026/rano.yaml', '# Popis\ntitle: Ráno\ndate: 2026-06-14\n');
  await write('2026/vecer.yaml', 'id: m7q2x\ntitle: Večer\ndate: 2026-06-15\n');
  const first = await prepareContent(dir);
  assert.equal(first.assigned.length, 1);
  const id = YAML.parse(await read('2026/rano.yaml')).id;
  assert.ok(isValidId(id));
  assert.notEqual(id, 'm7q2x');
  assert.match(await read('2026/rano.yaml'), /^# Popis\nid: /);

  const second = await prepareContent(dir);
  assert.deepEqual(second.assigned, []);
  assert.deepEqual(second.created, []);
  assert.equal(YAML.parse(await read('2026/rano.yaml')).id, id);
});

test('prepareContent never hands out an id that already exists', async () => {
  await write('2026/a.yaml', 'id: a2222\ntitle: A\ndate: 2026-01-01\n');
  await write('2026/b.yaml', 'title: B\ndate: 2026-01-01\n');
  // The injected random first yields "a2222", which is taken, then "zzzzz".
  const seq = [0, 0, 0, 0, 0, 0.999, 0.999, 0.999, 0.999, 0.999];
  let i = 0;
  await prepareContent(dir, { random: () => seq[i++] });
  assert.equal(YAML.parse(await read('2026/b.yaml')).id, 'zzzzz');
});

test('prepareContent reports invalid YAML and continues with the rest', async () => {
  await write('2026/zlomeny.yaml', 'title: [neuzavřeno\n');
  await write('2026/dobry.yaml', 'title: Dobrý\ndate: 2026-01-01\n');
  const r = await prepareContent(dir);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /zlomeny\.yaml: invalid YAML/);
  assert.deepEqual(r.works.map((w) => w.slug), ['dobry']);
});
