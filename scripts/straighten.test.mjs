import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { jobsFor, listPhotos, readSidecar, saveSidecar, sidecarPath, straightenPhoto } from './straighten.mjs';
import { isPaperPixel } from './lib/straighten.mjs';
import { boxRegion, parseSheetXmp } from './lib/sheet-box.mjs';

let dir;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-straighten-')); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

/** A photo of a skewed white sheet (with a dark mark in its top left) on an orange floor. */
async function photo(file, { width = 400, height = 300 } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="rgb(180,120,70)"/>
    <polygon points="40,30 360,45 345,270 30,255" fill="rgb(240,238,230)"/>
    <rect x="70" y="70" width="40" height="30" fill="rgb(40,40,50)"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(file);
}
const pixel = async (file, x, y) => [...(await sharp(await fs.readFile(file)).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer())];

test('straightenPhoto detects the sheet, keeps a margin of the floor around the whole paper, writes a preview; the original stays', async () => {
  const input = path.join(dir, 'obraz.jpg');
  await photo(input);
  const before = await fs.readFile(input);
  const r = await straightenPhoto(input, path.join(dir, 'upravene/obraz.jpg'), { preview: path.join(dir, 'upravene/nahledy/obraz.nahled.jpg') });
  assert.equal(r.auto, true);
  // sheet ≈ 320 × 220 plus the default margin (2 % of the longer side ≈ 6 px) on every side
  assert.ok(Math.abs(r.width - 333) < 12 && Math.abs(r.height - 233) < 12, `${r.width}×${r.height}`);
  const out = path.join(dir, 'upravene/obraz.jpg');
  for (const [x, y] of [[1, 1], [r.width - 2, 1], [r.width - 2, r.height - 2], [1, r.height - 2]]) {
    assert.ok(!isPaperPixel(...(await pixel(out, x, y))), `floor in the corner ${x},${y}: the paper edge is visible`);
  }
  for (const [x, y] of [[14, 14], [r.width - 15, r.height - 15]]) {
    assert.ok(isPaperPixel(...(await pixel(out, x, y))), `paper inside at ${x},${y}`);
  }
  assert.ok((await pixel(out, 60, 55))[0] < 120, 'the mark stays in the top left');
  assert.ok((await fs.stat(path.join(dir, 'upravene/nahledy/obraz.nahled.jpg'))).size > 0);
  assert.ok(before.equals(await fs.readFile(input)));
});

test('straightenPhoto with corners given by hand and a rotation', async () => {
  const input = path.join(dir, 'obraz.jpg');
  await photo(input);
  const r = await straightenPhoto(input, path.join(dir, 'out.jpg'), { corners: [[0.1, 0.1], [0.9, 0.15], [0.86, 0.9], [0.075, 0.85]], rotate: 90 });
  assert.equal(r.auto, false);
  assert.ok(r.height > r.width, 'rotated by 90°');
});

test('straightenPhoto reports a photo without a sheet', async () => {
  const input = path.join(dir, 'podlaha.jpg');
  await sharp({ create: { width: 100, height: 80, channels: 3, background: 'rgb(180,120,70)' } }).jpeg().toFile(input);
  await assert.rejects(straightenPhoto(input, path.join(dir, 'out.jpg')), /no paper sheet found, give --corners/);
});

test('listPhotos: a single file, or the photos directly in a folder (no hidden files, no subfolders)', async () => {
  for (const f of ['b.jpg', 'a.JPEG', 'c.png', 'poznamka.txt', '.DS_Store']) await fs.writeFile(path.join(dir, f), '');
  await fs.mkdir(path.join(dir, 'upravene'));
  await fs.writeFile(path.join(dir, 'upravene/x.jpg'), '');
  assert.deepEqual((await listPhotos(dir)).map((p) => path.basename(p)), ['a.JPEG', 'b.jpg', 'c.png']);
  assert.deepEqual(await listPhotos(path.join(dir, 'b.jpg')), [path.join(dir, 'b.jpg')]);
});

test('white balance: a warm paper becomes neutral white, the option is off by default', async () => {
  const input = path.join(dir, 'teply.jpg');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="rgb(180,120,70)"/>
    <polygon points="40,30 360,45 345,270 30,255" fill="rgb(236,224,196)"/><rect x="150" y="110" width="80" height="60" fill="rgb(60,90,150)"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(input);
  const plain = await straightenPhoto(input, path.join(dir, 'plain.jpg'));
  assert.equal(plain.gains, null);
  const r = await straightenPhoto(input, path.join(dir, 'wb.jpg'), { whiteBalance: true });
  assert.ok(r.gains[2] > r.gains[0], `blue lifted more than red: ${r.gains}`);
  const [pr, pg, pb] = await pixel(path.join(dir, 'wb.jpg'), 10, 10);
  assert.ok(Math.max(pr, pg, pb) - Math.min(pr, pg, pb) < 8 && pr > 225, `neutral white paper: ${[pr, pg, pb]}`);
  const [br, bg, bb] = await pixel(path.join(dir, 'plain.jpg'), 10, 10);
  assert.ok(br - bb > 25, `without the option the paper stays warm: ${[br, bg, bb]}`);
});

test('sidecar: manual corners and extra crops are saved next to the photo and drive the next run', async () => {
  const input = path.join(dir, 'tisk.jpg');
  await photo(input);
  assert.equal(await readSidecar(input), null);
  await saveSidecar(input, { corners: [[0.1, 0.1], [0.9, 0.15], [0.86, 0.9], [0.075, 0.85]], rotate: -90 });
  await saveSidecar(input, { name: 'deska', corners: [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]] });
  // saving the main crop again keeps the extra crop
  await saveSidecar(input, { corners: [[0.1, 0.1], [0.9, 0.12], [0.86, 0.9], [0.075, 0.85]] });
  const text = await fs.readFile(sidecarPath(input), 'utf8');
  assert.equal(path.basename(sidecarPath(input)), 'tisk.orez.yaml');
  assert.match(text, /^# Ořez fotky/);
  assert.match(text, /corners: \[ 0\.1, 0\.1, 0\.9, 0\.12,/);
  const data = YAML.parse(text);
  assert.equal(data.rotate, undefined, 'rotate 0 is not written');
  assert.deepEqual(data.extra.map((e) => e.name), ['deska']);

  const jobs = await jobsFor(input, path.join(dir, 'upravene'), { whiteBalance: true });
  assert.deepEqual(jobs.map((j) => path.basename(j.output)), ['tisk.jpg', 'tisk-deska.jpg']);
  assert.deepEqual(jobs[1].options.corners, [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]]);
  assert.ok(jobs.every((j) => j.options.whiteBalance));
  // an extra crop can switch white balance off for itself
  const side = YAML.parse(await fs.readFile(sidecarPath(input), 'utf8'));
  side.extra[0].whiteBalance = false;
  await fs.writeFile(sidecarPath(input), YAML.stringify(side));
  assert.deepEqual((await jobsFor(input, dir, { whiteBalance: true })).map((j) => j.options.whiteBalance), [true, false]);
  for (const j of jobs) await straightenPhoto(input, j.output, j.options);
  const deska = await sharp(await fs.readFile(path.join(dir, 'upravene/tisk-deska.jpg'))).metadata();
  assert.ok(Math.abs(deska.width - 120) < 6 && Math.abs(deska.height - 90) < 6, `${deska.width}×${deska.height}`);
});

test('sidecar: a photo without one is detected automatically; a broken one is reported', async () => {
  const input = path.join(dir, 'obraz.jpg');
  await photo(input);
  const [job] = await jobsFor(input, dir);
  assert.equal(job.options.corners, undefined);
  await fs.writeFile(sidecarPath(input), 'extra:\n  - name: Deska\n    corners: [0, 0, 1, 0, 1, 1, 0, 1]\n');
  await assert.rejects(jobsFor(input, dir), /every extra crop needs a name/);
  await fs.writeFile(sidecarPath(input), 'corners: [0, 0, 1]\n');
  await assert.rejects(jobsFor(input, dir), /8 numbers between 0 and 1/);
});

test('width: shrinks the result to at most that width after rotation, never enlarges; also from the sidecar', async () => {
  const input = path.join(dir, 'obraz.jpg');
  await photo(input);
  const full = await straightenPhoto(input, path.join(dir, 'full.jpg'));
  const small = await straightenPhoto(input, path.join(dir, 'a.jpg'), { width: 160 });
  assert.equal(small.width, 160);
  assert.ok(Math.abs(small.height - (full.height * 160) / full.width) < 2, `aspect kept: ${small.width}×${small.height}`);
  // after a rotation the limit applies to the rotated result
  const rotated = await straightenPhoto(input, path.join(dir, 'b.jpg'), { width: 100, rotate: 90 });
  assert.equal(rotated.width, 100);
  assert.ok(Math.abs(rotated.height - (full.width * 100) / full.height) < 2, `rotated aspect: ${rotated.width}×${rotated.height}`);
  // never enlarges
  assert.ok((await straightenPhoto(input, path.join(dir, 'c.jpg'), { width: 5000 })).width < 400);
  // from the sidecar, the command line wins
  await fs.writeFile(sidecarPath(input), 'width: 200\n');
  assert.equal((await jobsFor(input, dir))[0].options.width, 200);
  assert.equal((await jobsFor(input, dir, { width: 120 }))[0].options.width, 120);
  await fs.writeFile(sidecarPath(input), 'width: velka\n');
  await assert.rejects(jobsFor(input, dir), /width must be a whole number of pixels/);
});

test('margin: negative crops into the sheet (no floor), a larger one keeps more surroundings; checked in the sidecar', async () => {
  const input = path.join(dir, 'obraz.jpg');
  await photo(input);
  const inner = await straightenPhoto(input, path.join(dir, 'in.jpg'), { margin: -0.01 });
  for (const [x, y] of [[1, 1], [inner.width - 2, inner.height - 2]]) {
    assert.ok(isPaperPixel(...(await pixel(path.join(dir, 'in.jpg'), x, y))), `paper up to the corner ${x},${y}`);
  }
  const wide = await straightenPhoto(input, path.join(dir, 'wide.jpg'), { margin: 0.1 });
  assert.ok(wide.width - inner.width > 60, `${wide.width} vs ${inner.width}`);
  await fs.writeFile(sidecarPath(input), 'margin: 0.05\nextra:\n  - name: detail\n    corners: [0.2, 0.2, 0.5, 0.2, 0.5, 0.5, 0.2, 0.5]\n    margin: 0.1\n');
  assert.deepEqual((await jobsFor(input, dir)).map((j) => j.options.margin), [0.05, 0.1]);
  assert.deepEqual((await jobsFor(input, dir, { margin: 0 })).map((j) => j.options.margin), [0, 0]);
  await fs.writeFile(sidecarPath(input), 'margin: 2\n');
  await assert.rejects(jobsFor(input, dir), /margin must be a number between -0.2 and 0.5/);
});

test('the result remembers where the bare sheet is (XMP), also after a rotation; none without a margin', async () => {
  const input = path.join(dir, 'obraz.jpg');
  await photo(input);
  const out = path.join(dir, 'a.jpg');
  const r = await straightenPhoto(input, out);
  const box = parseSheetXmp((await sharp(await fs.readFile(out)).metadata()).xmp);
  assert.deepEqual(box.map((n) => +n.toFixed(4)), r.sheet);
  // cropped to the box, only paper is left: no floor in the corners
  const sheetOnly = await sharp(await fs.readFile(out)).extract(boxRegion(box, r.width, r.height)).toBuffer();
  const meta = await sharp(sheetOnly).metadata();
  for (const [x, y] of [[1, 1], [meta.width - 2, meta.height - 2]]) {
    const px = [...(await sharp(sheetOnly).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer())];
    assert.ok(isPaperPixel(...px), `paper at ${x},${y} of the sheet: ${px}`);
  }
  // rotated by 90°: the box is rotated with the image
  const rot = await straightenPhoto(input, path.join(dir, 'b.jpg'), { rotate: 90 });
  assert.ok(rot.height > rot.width);
  const rbox = parseSheetXmp((await sharp(await fs.readFile(path.join(dir, 'b.jpg'))).metadata()).xmp);
  assert.ok(Math.abs((rbox[2] - rbox[0]) * rot.width - (box[3] - box[1]) * r.height) < 3, 'sheet width after rotation = sheet height before');
  // no margin, no surroundings, no box
  await straightenPhoto(input, path.join(dir, 'c.jpg'), { margin: 0 });
  assert.equal(parseSheetXmp((await sharp(await fs.readFile(path.join(dir, 'c.jpg'))).metadata()).xmp), null);
});
