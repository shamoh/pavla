import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { cornersYaml, cutOut, cutPreview, describeCorners, detectFile, masterSize, prepareCorners, previewOf, withCorners } from './corners.mjs';

let tmp;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-corners-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

/** A photo of a sheet on a wooden floor: width × height, the sheet as the quad `points`. */
export async function floorPhoto(file, width, height, points) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#96694a"/>`
    + `<polygon points="${points.map((p) => p.join(',')).join(' ')}" fill="#f0eee6"/>`
    + `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 5}" ry="${height / 5}" fill="#4a6fa0"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(file);
}

const SHEET = [[24, 16], [376, 24], [372, 284], [18, 278]];

test('detectFile: the corners of the sheet in a photo, with its size', async () => {
  const file = path.join(tmp, 'a.jpg');
  await floorPhoto(file, 400, 300, SHEET);
  const value = await detectFile(file);
  assert.deepEqual(value.photo, [400, 300]);
  const want = { tl: [24, 16], tr: [24, 24], br: [28, 16], bl: [18, 22] };
  for (const k of Object.keys(want)) value[k].forEach((v, i) => assert.ok(Math.abs(v - want[k][i]) <= 4, `${k}: ${value[k]} vs ${want[k]}`));
});

test('masterSize: the size after the EXIF rotation', async () => {
  const file = path.join(tmp, 'r.jpg');
  await sharp({ create: { width: 40, height: 30, channels: 3, background: '#fff' } }).withMetadata({ orientation: 6 }).jpeg().toFile(file);
  assert.deepEqual(await masterSize(file), { width: 30, height: 40 });
});

/** A work as prepareContent gives it. */
async function work(slug, yaml, { photo = true } = {}) {
  const yamlPath = `tvorba/${slug}.yaml`;
  await fs.mkdir(path.join(tmp, 'tvorba'), { recursive: true });
  await fs.writeFile(path.join(tmp, yamlPath), yaml);
  const masterPath = photo ? path.join(tmp, 'tvorba', `${slug}.jpg`) : null;
  if (photo) await floorPhoto(masterPath, 400, 300, SHEET);
  return { slug, yamlPath, masterPath, text: yaml, data: YAML.parse(yaml) ?? {} };
}

test('prepareCorners: missing corners are detected and written, drafts and published works alike, once', async () => {
  const works = [
    await work('draft', 'meta_draft: true\nid: k3f9a\ntitle: Draft\n'),
    await work('published', 'meta_draft: false\nid: m7q2x\ntitle: Published\n'),
    await work('nophoto', 'meta_draft: false\nid: p4r8t\ntitle: Without photo\n', { photo: false }),
  ];
  const r = await prepareCorners(tmp, works);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.detected.map((d) => d.split(':')[0]), ['tvorba/draft.yaml', 'tvorba/published.yaml']);
  assert.match(r.detected[0], /: tl \d+×\d+, tr \d+×\d+, br \d+×\d+, bl \d+×\d+( ⚠ PODEZŘELÝ|$)/);
  const text = await fs.readFile(path.join(tmp, 'tvorba/published.yaml'), 'utf8');
  assert.match(text, /\nmeta_corners:\n {2}photo: \[400, 300\]\n {2}tl: \[\d+, \d+\]\n/, 'one line per corner');
  assert.equal(works[1].data.meta_corners.photo[0], 400, 'the work is updated');
  assert.equal(works[1].text, text);
  assert.equal(YAML.parse(text).title, 'Published', 'nothing else changes');
  assert.equal(await fs.readFile(path.join(tmp, 'tvorba/nophoto.yaml'), 'utf8'), 'meta_draft: false\nid: p4r8t\ntitle: Without photo\n');
  // a second run has nothing to do
  const again = await prepareCorners(tmp, works);
  assert.deepEqual(again.detected, []);
  assert.equal(await fs.readFile(path.join(tmp, 'tvorba/published.yaml'), 'utf8'), text);
});

test('prepareCorners: corners set by hand or false are kept; ones of another photo are a problem', async () => {
  const manual = 'meta_corners:\n  photo: [400, 300]\n  tl: [1, 2]\n  tr: [3, 4]\n  br: [5, 6]\n  bl: [7, 8]\nid: k3f9a\n';
  const works = [
    await work('manual', manual),
    await work('off', 'meta_corners: false\nid: m7q2x\n'),
    await work('other', manual.replace('[400, 300]', '[800, 600]').replace('k3f9a', 'p4r8t')),
  ];
  const r = await prepareCorners(tmp, works);
  assert.deepEqual(r.detected, []);
  assert.equal(await fs.readFile(path.join(tmp, 'tvorba/manual.yaml'), 'utf8'), manual);
  assert.deepEqual(r.problems, ['tvorba/other.yaml: meta_corners belong to a photo of 800 × 600, but the photo is 400 × 300: delete meta_corners, the pipeline finds them again']);
});

test('prepareCorners: a file the schema check refuses is left alone (reported by that check)', async () => {
  const works = [await work('old', 'draft: true\nid: k3f9a\n')];
  const r = await prepareCorners(tmp, works);
  assert.deepEqual(r, { detected: [], problems: [] });
  assert.equal(await fs.readFile(path.join(tmp, 'tvorba/old.yaml'), 'utf8'), 'draft: true\nid: k3f9a\n');
});

const alphaAt = async (buf, x, y) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * info.channels + 3];
};

test('cutOut: transparent outside the corners, opaque inside, fading in over the feather', async () => {
  const buf = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#96694a' } }).jpeg().toBuffer();
  const value = { photo: [400, 300], tl: [20, 20], tr: [20, 20], br: [20, 20], bl: [20, 20] };
  const cut = await cutOut(buf, value, { inset: 0, feather: 0.1 });
  const meta = await sharp(cut).metadata();
  assert.deepEqual([meta.format, meta.channels, meta.width, meta.height], ['png', 4, 400, 300]);
  assert.equal(await alphaAt(cut, 2, 2), 0, 'the floor is gone');
  assert.equal(await alphaAt(cut, 18, 150), 0, 'just outside the edge');
  assert.equal(await alphaAt(cut, 200, 150), 255, 'the middle stays');
  const edge = await alphaAt(cut, 35, 150); // half way through the 30 px feather
  assert.ok(edge > 60 && edge < 200, `fades in: ${edge}`);
  assert.ok(await alphaAt(cut, 52, 150) > 245, 'opaque after the feather');
});

test('cutPreview: the cut on light and dark paper side by side, as a JPEG', async () => {
  const buf = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#96694a' } }).jpeg().toBuffer();
  const value = { photo: [400, 300], tl: [20, 20], tr: [20, 20], br: [20, 20], bl: [20, 20] };
  const preview = await cutPreview(await cutOut(buf, value), value, ['#f7f4ee', '#1c1a18'], { width: 200, pad: 10 });
  const meta = await sharp(preview).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 440, 170]);
  const { data, info } = await sharp(preview).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
  assert.ok(at(13, 13)[0] > 230, 'light paper around the cut');
  assert.ok(at(233, 13)[0] < 50, 'dark paper around the cut');
});

test('previewOf: the photo cut like the pipeline cuts it, or as it is when nothing is cut', async () => {
  const file = path.join(tmp, 'p.jpg');
  await floorPhoto(file, 400, 300, SHEET);
  const value = await detectFile(file);
  const meta = await sharp(await previewOf(file, value)).metadata();
  assert.deepEqual([meta.format, meta.width], ['jpeg', 2 * (800 + 48)]);
  const zero = { photo: [400, 300], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  assert.equal((await sharp(await previewOf(file, zero)).metadata()).format, 'jpeg');
});

test('cornersYaml: the value the way a description holds it', () => {
  assert.equal(cornersYaml({ photo: [400, 300], tl: [1, 2], tr: [3, 4], br: [5, 6], bl: [7, 8] }),
    'meta_corners:\n  photo: [400, 300]\n  tl: [1, 2]\n  tr: [3, 4]\n  br: [5, 6]\n  bl: [7, 8]');
});

test('withCorners: the description with meta_corners set, nothing else changed; a refused file stays', () => {
  const value = { photo: [400, 300], tl: [1, 2], tr: [3, 4], br: [5, 6], bl: [7, 8] };
  const r = withCorners('meta_draft: true\nid: k3f9a\ntitle: Ráno\n', value);
  assert.equal(r.problem, null);
  assert.deepEqual(YAML.parse(r.text).meta_corners, value);
  assert.equal(YAML.parse(r.text).title, 'Ráno');
  assert.match(r.text, /^# Rohy listu/, 'with its technical comment, first in the file');
  const old = withCorners('draft: true\n', value);
  assert.match(old.problem, /renamed to meta_draft/);
  assert.equal(old.text, 'draft: true\n');
});

test('cutPreview: how much each corner cuts is written at it, a suspicious corner in red', async () => {
  const buf = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#96694a' } }).jpeg().toBuffer();
  // tl cuts 10 % of the width (suspicious), the others 1 %
  const value = { photo: [400, 300], tl: [40, 3], tr: [4, 3], br: [4, 3], bl: [4, 3] };
  const preview = await cutPreview(await cutOut(buf, value), value, ['#f7f4ee', '#1c1a18'], { width: 400, pad: 10 });
  const lenient = await cutPreview(await cutOut(buf, value), value, ['#f7f4ee', '#1c1a18'], { width: 400, pad: 10, suspicious: 0.2 });
  const { data, info } = await sharp(preview).raw().toBuffer({ resolveWithObject: true });
  const red = (x0, y0, w, h) => {
    let n = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const i = (y * info.width + x) * 3;
      if (data[i] > 170 && data[i + 1] < 80 && data[i + 2] < 80) n++;
    }
    return n;
  };
  assert.ok(red(10, 10, 140, 30) > 20, 'the suspicious top left label is red');
  assert.equal(red(270, 10, 140, 30), 0, 'the top right one is not');
  const raw = await sharp(lenient).raw().toBuffer();
  let lenientRed = 0;
  for (let y = 10; y < 40; y++) for (let x = 10; x < 150; x++) {
    const i = (y * info.width + x) * 3;
    if (raw[i] > 170 && raw[i + 1] < 80 && raw[i + 2] < 80) lenientRed++;
  }
  assert.equal(lenientRed, 0, 'with a higher limit (images.edges.suspicious) nothing is red');
});

test('describeCorners: pixels of the corners for the run summary, a suspicious cut marked with its share', () => {
  const zero = { photo: [1000, 500], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  assert.equal(describeCorners(zero), 'list vyplňuje celou fotku');
  const fine = { photo: [1000, 500], tl: [10, 5], tr: [20, 10], br: [20, 10], bl: [25, 5] };
  assert.equal(describeCorners(fine), 'tl 10×5, tr 20×10, br 20×10, bl 25×5');
  const odd = { ...fine, tr: [0, 30] };
  assert.equal(describeCorners(odd), 'tl 10×5, tr 0×30, br 20×10, bl 25×5 ⚠ PODEZŘELÝ ořez (víc než 5,0 %): tr ořízne 0,0 % · 6,0 %; zkontroluj rohy v náhledu');
  assert.equal(describeCorners(odd, 0.1), 'tl 10×5, tr 0×30, br 20×10, bl 25×5', 'the limit of images.edges.suspicious');
});

test('prepareCorners: a suspicious detected cut is marked in the summary, with the given limit', async () => {
  const works = [await work('rano', 'meta_draft: true\nid: k3f9a\n')];
  // the sheet of floorPhoto lies 4–8 % from the borders: suspicious above 1 %, fine at 10 %
  assert.match((await prepareCorners(tmp, works, { suspicious: 0.01 })).detected[0], /⚠ PODEZŘELÝ ořez \(víc než 1,0 %\)/);
  const again = [await work('vecer', 'meta_draft: true\nid: m7q2x\n')];
  assert.doesNotMatch((await prepareCorners(tmp, again, { suspicious: 0.1 })).detected[0], /PODEZŘELÝ/);
});
