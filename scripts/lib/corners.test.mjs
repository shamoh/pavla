import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { cornersYaml, cutImageOf, cutOut, cutPreview, describeCorners, cutInfo, edgeOverlay, GUIDES, guideDistances, guideLabelsSvg, guidesOf, guidesProblems, hatchedOriginalOf, infoPanelSvg, removedSides, trimTransparent, detectFile, masterSize, prepareCorners, previewOf, withCorners } from './corners.mjs';

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

test('cutImageOf: the cut work trimmed like the site gets it, PNG with alpha, at most 1600 px wide, lines 1, 3, 5 and 10 % in', async () => {
  // big enough that the info panel in the middle leaves the lines near the borders free
  const file = path.join(tmp, 'c.jpg');
  await floorPhoto(file, 1200, 900, SHEET.map(([x, y]) => [x * 3, y * 3]));
  const value = await detectFile(file);
  const png = await cutImageOf(file, value);
  const meta = await sharp(png).metadata();
  assert.deepEqual([meta.format, meta.hasAlpha], ['png', true]);
  // the sheet spans x 54–1128, y 48–852 of the photo: trimmed to it (never enlarged)
  assert.ok(meta.width >= 1050 && meta.width <= 1086 && meta.height >= 780 && meta.height <= 816, `${meta.width}×${meta.height}`);
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
  // a line of each guide in from the left and the right, between the corner labels and the info panel in the middle
  const colour = { '#00ff66': [0, 255, 102], '#00e5ff': [0, 229, 255], '#ffe600': [255, 230, 0], '#ff00cc': [255, 0, 204] };
  const like = (p, hex) => p[3] > 150 && colour[hex].every((c, i) => Math.abs(p[i] - c) < 70);
  const y = Math.round(info.height * 0.12);
  for (const [share, hex] of [[0.01, '#00ff66'], [0.03, '#00e5ff'], [0.05, '#ffe600'], [0.1, '#ff00cc']]) {
    assert.ok(like(at(Math.round(info.width * share), y), hex), `${share * 100} % in from the left`);
    assert.ok(like(at(Math.min(info.width - 1, Math.round(info.width * (1 - share))), y), hex), `${share * 100} % in from the right`);
    assert.ok(like(at(Math.round(info.width * 0.45), Math.round(info.height * share)), hex), `${share * 100} % in from the top`);
  }
  assert.ok(!like(at(Math.round(info.width * 0.15), y), '#ff00cc'), 'no grid any more');
  assert.equal((await sharp(await cutImageOf(file, value, undefined, { width: 200 })).metadata()).width, 200);
  // other guides from images.edges.guides: two lines only
  const two = await cutImageOf(file, value, { guides: [0.02, 0.2] });
  const raw = await sharp(two).raw().toBuffer({ resolveWithObject: true });
  const at2 = (x, yy) => [...raw.data.subarray((yy * raw.info.width + x) * 4, (yy * raw.info.width + x) * 4 + 4)];
  const y2 = Math.round(raw.info.height * 0.12);
  assert.ok(like(at2(Math.round(raw.info.width * 0.02), y2), '#00ff66'), 'the first guide at 2 %');
  assert.ok(like(at2(Math.round(raw.info.width * 0.2), Math.round(raw.info.height * 0.05)), '#00e5ff'), 'the second at 20 %');
  assert.ok(!like(at2(Math.round(raw.info.width * 0.05), y2), '#ffe600'), 'no third');
});

test('guidesProblems and guidesOf: 1 to 4 shares between 0 and 0.5, each with its colour and corner', () => {
  assert.deepEqual(guidesProblems([0.01, 0.03, 0.05, 0.1]), []);
  for (const wrong of [[], [0.01, 0.02, 0.03, 0.04, 0.05], [0], [0.5], ['1 %'], 0.01]) {
    assert.match(guidesProblems(wrong).join(''), /images\.edges\.guides must be a list of 1 to 4 shares/, JSON.stringify(wrong));
  }
  assert.deepEqual(guidesOf([0.02, 0.2]), [{ share: 0.02, colour: '#00ff66', corner: 'tl' }, { share: 0.2, colour: '#00e5ff', corner: 'tr' }]);
  assert.deepEqual(GUIDES.map((g) => g.share), [0.01, 0.03, 0.05, 0.1]);
});

test('hatchedOriginalOf: the original in full size, the cut hatched, the border of the trimmed image, the info panel', async () => {
  const file = path.join(tmp, 'h.jpg');
  await floorPhoto(file, 400, 300, SHEET);
  const value = await detectFile(file);
  const { data: orig } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const read = async (buf) => (await sharp(buf).raw().toBuffer({ resolveWithObject: true })).data;
  const changed = (data, x, y) => { const i = (y * 400 + x) * 3; return Math.abs(data[i] - orig[i]) + Math.abs(data[i + 2] - orig[i + 2]) > 50; };
  // the colour of the corner line (#ff00cc), a little dimmed by the JPEG
  const pink = (data, x, y) => { const i = (y * 400 + x) * 3; return data[i] > 170 && data[i + 1] < 90 && data[i + 2] > 120; };

  const plain = await hatchedOriginalOf(file, value, undefined, { info: false });
  const meta = await sharp(plain).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 400, 300]);
  const data = await read(plain);
  let hatched = 0;
  for (let x = 0; x < 15; x++) for (let y = 0; y < 300; y++) if (changed(data, x, y)) hatched++;
  assert.ok(hatched > 300, `the floor on the left is hatched (${hatched})`);
  let middle = 0;
  for (let x = 150; x < 250; x++) for (let y = 100; y < 200; y++) if (changed(data, x, y)) middle++;
  assert.equal(middle, 0, 'the work itself is not');
  // the trimmed image (the sheet spans x 18–376) has a solid border: a pink column near x 18–24 down the middle
  let border = 0;
  for (let x = 14; x < 30; x++) if (pink(data, x, 150) && pink(data, x, 120) && pink(data, x, 180)) border++;
  assert.ok(border > 0, 'the left border of the trimmed image');

  // the inner border of the hatching, light green: inside the sheet near its left edge, never in the middle
  // light green (#7cff7c), 1 px on this small photo, mixed with the white paper by the JPEG
  const green = (x, y) => { const i = (y * 400 + x) * 3; return data[i + 1] > 225 && data[i + 1] - data[i] > 30 && data[i + 1] - data[i + 2] > 30; };
  let edge = 0;
  for (let x = 20; x < 50; x++) if (green(x, 150)) edge++;
  assert.ok(edge > 0, 'the green line along the left edge of the sheet');
  let greenMiddle = 0;
  for (let x = 150; x < 250; x++) for (let y = 100; y < 200; y++) if (green(x, y)) greenMiddle++;
  assert.equal(greenMiddle, 0);

  // with the info panel (default): the middle is covered by the dark panel
  const withInfo = await read(await hatchedOriginalOf(file, value));
  let dark = 0;
  for (let x = 150; x < 250; x++) for (let y = 100; y < 200; y++) { const i = (y * 400 + x) * 3; if (withInfo[i] < orig[i] - 40) dark++; }
  assert.ok(dark > 1000, `the info panel in the middle (${dark})`);

  const zero = { photo: [400, 300], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  assert.equal((await sharp(await hatchedOriginalOf(file, zero)).metadata()).width, 400, 'nothing to hatch: the original (with the panel)');
});

test('trimTransparent: the smallest rectangle holding everything not fully transparent; nothing to trim = as it is', async () => {
  const sheet = await sharp({ create: { width: 60, height: 40, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } } }).png().toBuffer();
  const buf = await sharp({ create: { width: 100, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: sheet, left: 10, top: 25 }]).png().toBuffer();
  const t = await trimTransparent(buf);
  assert.deepEqual([t.left, t.top, t.width, t.height], [10, 25, 60, 40]);
  assert.deepEqual(Object.values(await sharp(t.buf).metadata()).length > 0 && [(await sharp(t.buf).metadata()).width, (await sharp(t.buf).metadata()).height], [60, 40]);
  const same = await trimTransparent(sheet);
  assert.equal(same.buf, sheet);
  assert.deepEqual([same.left, same.top, same.width, same.height], [0, 0, 60, 40]);
});

test('guideDistances: where the 1, 3, 5 and 10 % lines cross, in pixels of the photo from its corner, like meta_corners', () => {
  // a 1000 × 500 photo, the trimmed image lies at x 20–820, y 10–410
  const d = guideDistances({ left: 20, top: 10, width: 800, height: 400 }, [1000, 500]);
  assert.deepEqual(d.map(({ share, corner, at }) => [share, corner, at]), [
    [0.01, 'tl', [28, 14]], // 20 + 8, 10 + 4
    [0.03, 'tr', [204, 22]], // 1000 − (20 + 776), 10 + 12
    [0.05, 'bl', [60, 110]], // 20 + 40, 500 − (10 + 380)
    [0.1, 'br', [260, 130]], // 1000 − (20 + 720), 500 − (10 + 360)
  ]);
  // nothing trimmed: just the share of the photo
  assert.deepEqual(guideDistances({ left: 0, top: 0, width: 1000, height: 500 }, [1000, 500])[0].at, [10, 5]);
});

test('removedSides: what the trimmed image lacks, by the corners (the smaller of each side) and by inset and feather', () => {
  const value = { photo: [1000, 500], tl: [30, 15], tr: [200, 20], br: [190, 100], bl: [25, 95] };
  assert.deepEqual(removedSides({ left: 32, top: 22, width: 774, height: 380 }, [1000, 500], value), {
    total: [32, 22, 194, 98],
    corners: [25, 15, 190, 95],
    edges: [7, 7, 4, 3],
  });
  assert.deepEqual(removedSides({ left: 0, top: 0, width: 1000, height: 500 }, [1000, 500], false).corners, [0, 0, 0, 0]);
});

test('cutInfo: the photo, the trimmed image, what was removed on every side and why, the edge settings, the corners used', () => {
  const value = { photo: [1000, 500], tl: [30, 15], tr: [200, 20], br: [190, 100], bl: [25, 95] };
  assert.deepEqual(cutInfo({ left: 32, top: 22, width: 774, height: 380 }, [1000, 500], value, { inset: 0.002, feather: 0.01 }), [
    'Fotka: 1000 × 500 px',
    'Obrázek po ořezu: 774 × 380 px',
    'Odstraněno celkem: vlevo 32 · nahoře 22 · vpravo 194 · dole 98 px',
    'z toho rohy (meta_corners): vlevo 25 · nahoře 15 · vpravo 190 · dole 95 px',
    'z toho inset a prolnutí: vlevo 7 · nahoře 7 · vpravo 4 · dole 3 px',
    'inset 0,2 % = 1,0 px · prolnutí (feather) 1,0 % = 5,0 px, z kratší strany 500 px',
    'Prolnutí: list přechází do průhlednosti v pásu šířky prolnutí uvnitř rohů,',
    'jeho vnější část je úplně průhledná a odstřihne se také.',
    'meta_corners: tl [30, 15] · tr [200, 20] · br [190, 100] · bl [25, 95]',
  ]);
  const zero = { photo: [1000, 500], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  assert.equal(cutInfo({ left: 0, top: 0, width: 1000, height: 500 }, [1000, 500], zero).at(-1), 'meta_corners: nic neořezávají');
});

test('infoPanelSvg: a scheme of the photo (removed parts, trimmed image, corners) and the lines of cutInfo', () => {
  const value = { photo: [1000, 500], tl: [30, 15], tr: [200, 20], br: [190, 100], bl: [25, 95] };
  const svg = infoPanelSvg(800, 400, { left: 20, top: 10, width: 800, height: 400 }, [1000, 500], value);
  assert.match(svg, /fill="url\(#removed\)"/, 'the photo with the removed parts hatched');
  assert.match(svg, /<polygon points="[^"]+" fill="none"[^>]*stroke-dasharray/, 'the corners dotted');
  for (const line of cutInfo({ left: 20, top: 10, width: 800, height: 400 }, [1000, 500], value)) assert.ok(svg.includes(`>${line}</text>`), line);
  assert.doesNotMatch(infoPanelSvg(800, 400, { left: 0, top: 0, width: 1000, height: 500 }, [1000, 500], false), /<polygon/, 'no corners, no quadrilateral');
});

test('guideLabelsSvg: one label per corner, in the colour of its line', () => {
  const svg = guideLabelsSvg(800, 600, guideDistances({ left: 20, top: 10, width: 800, height: 400 }, [1000, 500]));
  assert.match(svg, /text-anchor="start"[^>]*fill="#00ff66"[^>]*>1,0 %: tl \[28, 14\] px</);
  assert.match(svg, /text-anchor="end"[^>]*fill="#00e5ff"[^>]*>3,0 %: tr \[204, 22\] px</);
  assert.match(svg, /text-anchor="start"[^>]*fill="#ffe600"[^>]*>5,0 %: bl \[60, 110\] px</);
  assert.match(svg, /text-anchor="end"[^>]*fill="#ff00cc"[^>]*>10,0 %: br \[260, 130\] px</);
  assert.equal((svg.match(/<text /g) ?? []).length, 4);
});

test('edgeOverlay: the edge of the fully opaque area, widened to the stroke', () => {
  // 10 × 6, opaque in x 3–7, y 1–4
  const alpha = Buffer.alloc(60);
  for (let y = 1; y <= 4; y++) for (let x = 3; x <= 7; x++) alpha[y * 10 + x] = 255;
  alpha[2 * 10 + 5] = 255; // inside
  const on = (o, x, y) => o[(y * 10 + x) * 4 + 3] === 255;
  const thin = edgeOverlay(alpha, 10, 6, 1, [1, 2, 3]);
  assert.ok(on(thin, 3, 1) && on(thin, 7, 4) && on(thin, 5, 1), 'the opaque pixels at the edge');
  assert.ok(!on(thin, 5, 2) && !on(thin, 1, 1), 'not inside, not outside');
  assert.deepEqual([...thin.subarray((1 * 10 + 3) * 4, (1 * 10 + 3) * 4 + 4)], [1, 2, 3, 255]);
  const wide = edgeOverlay(alpha, 10, 6, 3, [1, 2, 3]);
  assert.ok(on(wide, 2, 1) && on(wide, 5, 2), 'widened by one pixel to both sides');
});
