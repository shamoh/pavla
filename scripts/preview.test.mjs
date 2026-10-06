import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { cornersFor, listMasters, sharesLine, suspiciousSummary, writeDetected } from './preview.mjs';

let tmp;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-preview-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

const photo = async (rel, svg) => {
  const file = path.join(tmp, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body = svg ?? '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#96694a"/>'
    + '<polygon points="24,16 376,24 372,284 18,278" fill="#f0eee6"/></svg>';
  await sharp(Buffer.from(body)).jpeg({ quality: 95 }).toFile(file);
  return file;
};

test('listMasters: a photo, or the master photos of a folder and its collections, without details and covers', async () => {
  await photo('tvorba/rano.jpg');
  await photo('tvorba/rano/1-detail.jpg');
  await photo('tvorba/plener/vecer.jpg');
  await photo('tvorba/plener/_cover.jpg');
  await fs.writeFile(path.join(tmp, 'tvorba/plener/noc.yaml'), 'title: Noc\n');
  await photo('tvorba/plener/noc/detail.jpg');
  await fs.writeFile(path.join(tmp, 'tvorba/rano.yaml'), 'title: Ráno\n');
  const rel = (list) => list.map((f) => path.relative(tmp, f));
  assert.deepEqual(rel(await listMasters(path.join(tmp, 'tvorba'))), ['tvorba/plener/vecer.jpg', 'tvorba/rano.jpg']);
  assert.deepEqual(rel(await listMasters(path.join(tmp, 'tvorba/plener'))), ['tvorba/plener/vecer.jpg']);
  assert.deepEqual(rel(await listMasters(path.join(tmp, 'tvorba/rano/1-detail.jpg'))), ['tvorba/rano/1-detail.jpg'], 'a photo given by name is always taken');
});

test('cornersFor: from the description when they fit, detected otherwise; never writes', async () => {
  const file = await photo('tvorba/rano.jpg');
  const yaml = path.join(tmp, 'tvorba/rano.yaml');

  const none = await cornersFor(file);
  assert.equal(none.source, 'detected');
  assert.equal(none.note, 'no description, detected');
  assert.deepEqual(none.value.photo, [400, 300]);
  assert.ok(none.value.tl[0] >= 20 && none.value.tl[0] <= 30, JSON.stringify(none.value));

  await fs.writeFile(yaml, 'title: Ráno\n');
  assert.equal((await cornersFor(file)).note, 'no meta_corners in rano.yaml, detected');

  const own = 'meta_corners:\n  photo: [400, 300]\n  tl: [1, 2]\n  tr: [3, 4]\n  br: [5, 6]\n  bl: [7, 8]\ntitle: Ráno\n';
  await fs.writeFile(yaml, own);
  const fromYaml = await cornersFor(file);
  assert.equal(fromYaml.source, 'yaml');
  assert.deepEqual(fromYaml.value.tl, [1, 2]);

  await fs.writeFile(yaml, own.replace('[400, 300]', '[800, 600]'));
  const other = await cornersFor(file);
  assert.equal(other.source, 'detected');
  assert.match(other.note, /belong to a photo of 800 × 600.*; detected instead$/);

  await fs.writeFile(yaml, 'meta_corners: false\n');
  const off = await cornersFor(file);
  assert.deepEqual([off.value, off.source, off.note, off.writable], [false, 'off', 'meta_corners: false, nothing is cut', false]);
  assert.equal(await fs.readFile(yaml, 'utf8'), 'meta_corners: false\n', 'the description stays as it was');
});

test('sharesLine: how much each corner cuts in %, "!" after a suspicious one', () => {
  assert.equal(sharesLine({ photo: [1000, 500], tl: [10, 5], tr: [0, 30], br: [20, 10], bl: [25, 5] }),
    'tl 1.0 % · 1.0 %, tr 0.0 % · 6.0 % !, br 2.0 % · 2.0 %, bl 2.5 % · 1.0 %');
});

test('writeDetected (--write): adds detected corners to a description without them, never replaces any', async () => {
  const file = await photo('tvorba/rano.jpg');
  const yaml = path.join(tmp, 'tvorba/rano.yaml');

  assert.equal(await writeDetected(await cornersFor(file)), 'not written: no description yet (the pipeline creates it, with the corners)');
  assert.ok(!(await fs.stat(yaml).catch(() => null)));

  await fs.writeFile(yaml, 'meta_draft: true\nid: k3f9a\ntitle: Ráno\n');
  const found = await cornersFor(file);
  assert.equal(await writeDetected(found), 'written into rano.yaml');
  const data = YAML.parse(await fs.readFile(yaml, 'utf8'));
  assert.deepEqual(data.meta_corners, found.value);
  assert.equal(data.title, 'Ráno');

  // now they are there: read from the description, nothing to write
  const again = await cornersFor(file);
  assert.equal(again.source, 'yaml');
  assert.equal(await writeDetected(again), null);

  // corners of another photo are reported, never replaced
  const other = (await fs.readFile(yaml, 'utf8')).replace('[400, 300]', '[800, 600]');
  await fs.writeFile(yaml, other);
  assert.match(await writeDetected(await cornersFor(file)), /^not written: rano\.yaml already has meta_corners/);
  assert.equal(await fs.readFile(yaml, 'utf8'), other);

  // meta_corners: false stays off
  await fs.writeFile(yaml, 'meta_corners: false\n');
  assert.equal(await writeDetected(await cornersFor(file)), null);
});

test('sharesLine and suspiciousSummary: the limit is the one given (images.edges.suspicious)', () => {
  const value = { photo: [1000, 500], tl: [10, 5], tr: [0, 30], br: [20, 10], bl: [25, 5] };
  assert.equal(sharesLine(value, 0.1), 'tl 1.0 % · 1.0 %, tr 0.0 % · 6.0 %, br 2.0 % · 2.0 %, bl 2.5 % · 1.0 %');
  assert.equal(suspiciousSummary([], 0.05), 'No corner cuts more than 5.0 %.\n');
  const s = suspiciousSummary([{ rel: 'tvorba/ovce.jpg', name: 'ovce.jpg', value }], 0.05, (n) => `.previews/${n}`);
  assert.equal(s, 'Check first: 1 photo(s) with a corner cutting more than 5.0 %:\n'
    + '  tvorba/ovce.jpg  (.previews/ovce.jpg)\n'
    + '    tl 1.0 % · 1.0 %, tr 0.0 % · 6.0 % !, br 2.0 % · 2.0 %, bl 2.5 % · 1.0 %\n');
});

const cli = (...args) => spawnSync(process.execPath, [fileURLToPath(new URL('./preview.mjs', import.meta.url)), ...args], { encoding: 'utf8', cwd: tmp, env: { ...process.env, INIT_CWD: tmp } });

test('npm run preview --only-suspicious: previews and output only of the photos with a suspicious corner', async () => {
  // a narrow floor, 2 % (fine), and a sheet askew whose top right corner lies 13 % down the photo (suspicious above
  // images.edges.suspicious of site.config.yaml, 10 %)
  const sheet = (right) => '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#96694a"/>'
    + `<polygon points="8,6 392,${right} 392,294 8,294" fill="#f0eee6"/></svg>`;
  await photo('tvorba/rano.jpg', sheet(6));
  await photo('tvorba/vecer.jpg', sheet(40));
  const out = path.join(tmp, 'out');
  const r = cli('tvorba', '--out', out, '--only-suspicious');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual((await fs.readdir(out)).sort(), ['vecer-original.jpg', 'vecer.jpg', 'vecer.png']);
  assert.doesNotMatch(r.stdout, /rano/);
  assert.match(r.stdout, /→ tvorba\/vecer\.jpg/);
  assert.match(r.stdout, /Check first: 1 photo\(s\)/);
  assert.match(r.stdout, /Done: 2 photo\(s\), previews only of the 1 suspicious one\(s\)/);
  // without the switch both
  const all = cli('tvorba', '--out', path.join(tmp, 'all'));
  assert.equal(all.status, 0, all.stderr);
  assert.deepEqual((await fs.readdir(path.join(tmp, 'all'))).sort(), ['rano-original.jpg', 'rano.jpg', 'rano.png', 'vecer-original.jpg', 'vecer.jpg', 'vecer.png']);
});

test('npm run preview: --only-suspicious and --write together are refused, nothing is written', async () => {
  await photo('tvorba/rano.jpg');
  await fs.writeFile(path.join(tmp, 'tvorba/rano.yaml'), 'title: Ráno\n');
  const r = cli('tvorba', '--out', path.join(tmp, 'out'), '--only-suspicious', '--write');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--only-suspicious cannot be combined with --write/);
  assert.equal(await fs.readFile(path.join(tmp, 'tvorba/rano.yaml'), 'utf8'), 'title: Ráno\n');
});

test('npm run preview: <slug>-<id>.jpg (light and dark) and <slug>-<id>.png (the cut work, transparent around it)', async () => {
  await photo('tvorba/rano.jpg');
  await fs.writeFile(path.join(tmp, 'tvorba/rano.yaml'), 'id: k3f9a\ntitle: Ráno\n');
  const out = path.join(tmp, 'out');
  const r = cli('tvorba/rano.jpg', '--out', out);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual((await fs.readdir(out)).sort(), ['rano-k3f9a-original.jpg', 'rano-k3f9a.jpg', 'rano-k3f9a.png']);
  assert.match(r.stdout, /preview: out\/rano-k3f9a\.jpg \(light and dark\), out\/rano-k3f9a\.png \(transparent\), out\/rano-k3f9a-original\.jpg \(original, cut hatched\)/);
  assert.equal((await sharp(path.join(out, 'rano-k3f9a-original.jpg')).metadata()).width, 400, 'the original in its full size');
  const png = await sharp(path.join(out, 'rano-k3f9a.png')).metadata();
  assert.deepEqual([png.format, png.hasAlpha], ['png', true]);
  assert.ok(png.width < 400, 'trimmed to the sheet, like the site gets it');
  const { data, info } = await sharp(path.join(out, 'rano-k3f9a.png')).raw().toBuffer({ resolveWithObject: true });
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear++;
  assert.ok(clear > 0, 'the wedges of a sheet askew stay transparent');
  assert.equal(data[(Math.round(info.height * 0.45) * info.width + Math.round(info.width * 0.45)) * 4 + 3], 255, 'the sheet is not');
});
