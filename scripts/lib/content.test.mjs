import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { DETAIL_CAPTION_TODO, findUnknownAttributes, placeholderProblems, findUnknownTechniques, prepareContent, readTree, withId } from './content.mjs';
import { todoKeys } from './metadata-yaml.mjs';
import { isValidId, validateWorks } from './works.mjs';

let dir;
const worksDir = () => path.join(dir, 'tvorba');
const write = async (rel, text = '') => {
  const p = path.join(worksDir(), rel);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, text);
};
const read = (rel) => fs.readFile(path.join(worksDir(), rel), 'utf8');

beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'content-')); await fs.mkdir(worksDir()); });
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

const group = (groups, dir) => groups.find((g) => g.dir === dir);

test('readTree pairs images with metadata by slug and reports stray files', async () => {
  await write('rano-u-rybnika.yaml', 'title: x');
  await write('Ráno u rybníka.JPG');
  await write('notes.txt');
  await write('.DS_Store');
  await write('_poznamka.jpg');
  const { groups, problems } = await readTree(worksDir());
  assert.equal(groups.length, 1, 'no collections');
  assert.deepEqual([...groups[0].yamls.keys()], ['rano-u-rybnika']);
  assert.equal(groups[0].images.get('rano-u-rybnika').file, 'Ráno u rybníka.JPG');
  assert.equal(groups[0].images.size, 1, 'files starting with _ or . are no works');
  assert.deepEqual(problems, ['tvorba/notes.txt: sem patří jen fotky a popisy (.yaml), tento soubor smaž nebo přesuň']);
});

test('readTree reports two images mapping to the same slug', async () => {
  await write('rano.jpg');
  await write('Ráno.png');
  const { problems } = await readTree(worksDir());
  assert.equal(problems.length, 1);
  assert.match(problems[0], /stejné jméno „rano“ dává i fotka rano\.jpg/);
});

test('readTree: a folder named like a work holds its details, any other folder is a collection', async () => {
  await write('rano.yaml', 'title: x');
  await write('rano/2-lodka.jpg');
  await write('rano/1 Květ.JPG');
  await write('rano/.DS_Store');
  await write('2026 Plenér Šumava/_index.yaml', 'title: Plenér');
  await write('2026 Plenér Šumava/_cover.jpg');
  await write('2026 Plenér Šumava/slat.jpg');
  await write('2026 Plenér Šumava/slat/detail.jpg');
  const { groups, problems } = await readTree(worksDir());
  assert.deepEqual(problems, []);
  assert.deepEqual(group(groups, '').details.get('rano').files, [
    { name: '1-kvet', file: '1 Květ.JPG' },
    { name: '2-lodka', file: '2-lodka.jpg' },
  ]);
  const plener = group(groups, '2026 Plenér Šumava');
  assert.equal(plener.meta, '_index.yaml');
  assert.equal(plener.cover, '_cover.jpg');
  assert.deepEqual([...plener.images.keys()], ['slat'], 'the cover photo is no work');
  assert.deepEqual(plener.details.get('slat').files, [{ name: 'detail', file: 'detail.jpg' }]);
});

test('readTree reports non-photos in detail folders and folders nested in a collection', async () => {
  await write('rano.yaml', 'title: x');
  await write('rano/poznamky.txt');
  await write('plener/slat.jpg');
  await write('plener/podkolekce/x.jpg');
  const { problems } = await readTree(worksDir());
  assert.equal(problems.length, 2);
  assert.ok(problems.some((p) => p.includes('tvorba/rano/poznamky.txt')));
  assert.ok(problems.some((p) => p.startsWith('tvorba/plener/podkolekce/:') && p.includes('kolekce v kolekci nejde')));
});

test('prepareContent creates a draft skeleton for a new image, dated today without EXIF', async () => {
  await write('Ráno u rybníka.jpg');
  const r = await prepareContent(dir, { today: new Date('2026-07-01T12:00:00Z') });
  assert.deepEqual(r.created, ['tvorba/rano-u-rybnika.yaml']);
  const data = YAML.parse(await read('rano-u-rybnika.yaml'));
  assert.ok(isValidId(data.id));
  assert.equal(data.meta_draft, true);
  assert.equal(data.title, 'Ráno u rybníka');
  assert.equal(String(data.date), '2026-07-01');
  const [w] = r.works;
  assert.equal(w.masterPath, path.join(worksDir(), 'Ráno u rybníka.jpg'));
  assert.equal(w.year, '2026');
  assert.equal(w.collection, null);
  assert.equal(w.dir, '');
});

test('prepareContent dates a new skeleton by the day the photo was taken (EXIF), not today', async () => {
  const photo = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } })
    .jpeg().withExif({ IFD2: { DateTimeOriginal: '2025:10:19 15:46:33' } }).toBuffer();
  await fs.mkdir(path.join(worksDir(), 'plener'), { recursive: true });
  await fs.writeFile(path.join(worksDir(), 'plener', 'steg.jpg'), photo);
  const r = await prepareContent(dir, { today: new Date('2026-10-07T12:00:00Z') });
  assert.deepEqual(r.created, ['tvorba/plener/steg.yaml']);
  assert.equal(String(YAML.parse(await read('plener/steg.yaml')).date), '2025-10-19');
  assert.equal(r.works[0].year, '2025');
});

test('prepareContent fills in details of a new skeleton from the detail folder, captions to fill in', async () => {
  await write('rano.jpg');
  await write('rano/1 Mlha.jpg');
  await write('rano/2-lodka.jpg');
  await write('vecer.jpg');
  const r = await prepareContent(dir, { today: new Date('2026-10-07T12:00:00Z') });
  const text = await read('rano.yaml');
  assert.deepEqual(YAML.parse(text).details, { '1-mlha': DETAIL_CAPTION_TODO, '2-lodka': DETAIL_CAPTION_TODO });
  assert.ok(DETAIL_CAPTION_TODO.startsWith('DOPLNIT '));
  assert.ok(todoKeys(text).includes('details'), 'the technical comment is marked DOPLNIT');
  assert.deepEqual(validateWorks(r.works).filter((p) => p.includes('details')), [], 'every caption names a photo in the folder');
  assert.equal(YAML.parse(await read('vecer.yaml')).details, undefined, 'without a detail folder it stays commented out');
  const again = await prepareContent(dir, { today: new Date('2026-10-08T12:00:00Z') });
  assert.deepEqual(again.created, []);
  assert.deepEqual(again.updated, []);
  assert.equal(await read('rano.yaml'), text, 'the next run leaves it as it is');
});

test('prepareContent leaves details of an existing description alone when a detail folder appears', async () => {
  await write('rano.jpg');
  await prepareContent(dir, { today: new Date('2026-10-07T12:00:00Z') });
  const before = await read('rano.yaml');
  await write('rano/1-mlha.jpg');
  await prepareContent(dir, { today: new Date('2026-10-07T12:00:00Z') });
  assert.equal(await read('rano.yaml'), before);
});

test('prepareContent: works of a collection folder, their collection and years come from folder and date', async () => {
  await write('2025-2026 Zima/prosinec.yaml', 'id: k3f9a\ntitle: P\ndate: 2025-12-30\n');
  await write('2025-2026 Zima/leden.jpg');
  await write('2025-2026 Zima/_cover.jpg');
  await write('sam.yaml', 'id: m4g8b\ntitle: S\ndate: nevím\n');
  const r = await prepareContent(dir, { today: new Date('2026-01-02T12:00:00Z') });
  assert.deepEqual(r.created, ['tvorba/2025-2026 Zima/leden.yaml']);
  const bySlug = Object.fromEntries(r.works.map((w) => [w.slug, w]));
  assert.deepEqual([bySlug.prosinec.collection, bySlug.prosinec.dir, bySlug.prosinec.year], ['2025-2026-zima', '2025-2026 Zima', '2025']);
  assert.deepEqual([bySlug.leden.collection, bySlug.leden.year], ['2025-2026-zima', '2026']);
  assert.equal(bySlug.sam.year, null, 'no valid date, no year');
  assert.deepEqual(r.collectionFolders, [{
    slug: '2025-2026-zima', dir: '2025-2026 Zima', metaPath: null, coverPath: path.join(worksDir(), '2025-2026 Zima', '_cover.jpg'), retired: false,
  }]);
});

test('prepareContent assigns missing ids and is idempotent', async () => {
  await write('rano.yaml', '# Popis\ntitle: Ráno\ndate: 2026-06-14\n');
  await write('plener/vecer.yaml', 'id: m7q2x\ntitle: Večer\ndate: 2026-06-15\n');
  const first = await prepareContent(dir);
  assert.equal(first.assigned.length, 1);
  assert.match(first.assigned[0], /^tvorba\/rano: /);
  const id = YAML.parse(await read('rano.yaml')).id;
  assert.ok(isValidId(id));
  assert.notEqual(id, 'm7q2x');
  // the comment on top stays the file's comment (meta_ attributes come first), the id gets its technical comment
  const text = await read('rano.yaml');
  assert.match(text, /^# Popis\n\n# Rozpracovaný obraz, možnosti:\n(# - [^\n]*\n){2}meta_draft: false\n/);
  assert.match(text, /\n\n# Trvalý kód obrazu[^\n]*\n# [^\n]*\nid: /);

  const second = await prepareContent(dir);
  assert.deepEqual(second.assigned, []);
  assert.deepEqual(second.created, []);
  assert.equal(YAML.parse(await read('rano.yaml')).id, id);
});

test('prepareContent never hands out an id that already exists, also across collections', async () => {
  await write('plener/a.yaml', 'id: a2222\ntitle: A\ndate: 2026-01-01\n');
  await write('b.yaml', 'title: B\ndate: 2026-01-01\n');
  // The injected random first yields "a2222", which is taken, then "zzzzz".
  const seq = [0, 0, 0, 0, 0, 0.999, 0.999, 0.999, 0.999, 0.999];
  let i = 0;
  await prepareContent(dir, { random: () => seq[i++] });
  assert.equal(YAML.parse(await read('b.yaml')).id, 'zzzzz');
});

test('prepareContent reports invalid YAML and continues with the rest', async () => {
  await write('zlomeny.yaml', 'title: [neuzavřeno\n');
  await write('dobry.yaml', 'title: Dobrý\ndate: 2026-01-01\n');
  const r = await prepareContent(dir);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^tvorba\/zlomeny\.yaml: chybný zápis YAML/);
  assert.deepEqual(r.works.map((w) => w.slug), ['dobry']);
});

test('prepareContent returns detail photo paths of a work (none when there is no folder)', async () => {
  await write('plener/rano.yaml', 'id: k3f9a\ntitle: x\ndate: 2026-01-01\n');
  await write('plener/rano/kvet.jpg');
  await write('vecer.yaml', 'id: m4g8b\ntitle: y\ndate: 2026-01-01\n');
  const { works } = await prepareContent(dir);
  const bySlug = Object.fromEntries(works.map((w) => [w.slug, w]));
  assert.deepEqual(bySlug.rano.details, [{ name: 'kvet', path: path.join(worksDir(), 'plener/rano/kvet.jpg') }]);
  assert.deepEqual(bySlug.vecer.details, []);
});

test('findUnknownAttributes lists typos in works, collections and photos, changes nothing', async () => {
  // an own private_ attribute is not unknown
  await write('rano.yaml', 'id: k3f9a\ntitle: Ráno\nmockup: true\nprivate_kupec: teta\n');
  await write('plener/_index.yaml', 'title: Plenér\nkryt: k3f9a\n');
  await write('plener/vecer.yaml', 'id: m7q2x\ntitle: Večer\n');
  await fs.mkdir(path.join(dir, 'fotky'));
  await fs.writeFile(path.join(dir, 'fotky/portret.yaml'), 'alt: Pavla\npopis: x\n');
  const before = await read('rano.yaml');
  assert.deepEqual(await findUnknownAttributes(dir), ['tvorba/rano.yaml: mockup', 'tvorba/plener/_index.yaml: kryt', 'fotky/portret.yaml: popis']);
  assert.equal(await read('rano.yaml'), before);
});

test('findUnknownTechniques lists techniques without an art form with their works, changes nothing', async () => {
  await write('rano.yaml', 'id: k3f9a\ntitle: Ráno\ntechnique: akvarel a tuš\n');
  await write('plener/vecer.yaml', 'id: m7q2x\ntitle: Večer\ntechnique: koláž\n');
  await write('plener/noc.yaml', 'id: n4r8w\ntitle: Noc\ntechnique: koláž\n');
  await write('plener/_index.yaml', 'title: Plenér\n');
  await write('skica.yaml', 'id: p2s5t\ntitle: Skica\ntechnique: enkaustika\n');
  await write('bez.yaml', 'id: q6u3v\ntitle: Bez techniky\ntechnique: ""\n');
  const before = await read('rano.yaml');
  assert.deepEqual(await findUnknownTechniques(dir), ['enkaustika: tvorba/skica.yaml', 'koláž: tvorba/plener/noc.yaml, tvorba/plener/vecer.yaml']);
  assert.equal(await read('rano.yaml'), before);
});

test('placeholderProblems: texts starting with DOPLNIT in collections, years, the home page and photos of pages', () => {
  const problems = placeholderProblems({
    collections: [{ yamlPath: 'tvorba/plener/_index.yaml', data: { title: 'DOPLNIT název', private_note: 'DOPLNIT' } }],
    years: [{ yamlPath: 'roky/2026.yaml', data: { description: 'DOPLNIT pár vět' } }, { yamlPath: 'roky/2025.yaml', data: { description: 'Rok.' } }],
    home: { yamlPath: '_index.yaml', data: { description: ' DOPLNIT' } },
    photos: [{ name: 'portret', data: { alt: 'Portrét', caption: 'DOPLNIT popisek' } }],
  });
  assert.deepEqual(problems, [
    'tvorba/plener/_index.yaml: title pořád začíná „DOPLNIT“, přepiš ho',
    'roky/2026.yaml: description pořád začíná „DOPLNIT“, přepiš ho',
    '_index.yaml: description pořád začíná „DOPLNIT“, přepiš ho',
    'fotky/portret.yaml: caption pořád začíná „DOPLNIT“, přepiš ho',
  ]);
  assert.deepEqual(placeholderProblems({}), []);
});
