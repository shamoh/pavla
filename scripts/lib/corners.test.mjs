import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { cornersYaml, CUT_COLOURS, cutLabelLines, cutLinesSvg, cutOut, cutPreview, describeCorners, cutInfo, edgeOverlay, FRAME_COLOURS, frameLines, framesOf, framesSvg, guidesProblems, cutOriginalOf, infoPanelSvg, removedSides, trimTransparent, detectFile, masterSize, prepareCorners, previewOf, withCorners } from './corners.mjs';

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

test('cutLabelLines: from which border each corner cuts, as a share of the photo and in its pixels, suspicious per line', () => {
  const value = { photo: [1000, 500], tl: [25, 10], tr: [0, 30], br: [60, 5], bl: [10, 0] };
  assert.deepEqual(cutLabelLines(value, 'tl'), [{ text: 'zleva 2,5 % = 25 px', suspicious: false }, { text: 'shora 2,0 % = 10 px', suspicious: false }]);
  // 30 px of 500 = 6 % from the top: suspicious above 5 %, not the other line
  assert.deepEqual(cutLabelLines(value, 'tr'), [{ text: 'zprava 0,0 % = 0 px', suspicious: false }, { text: 'shora 6,0 % = 30 px', suspicious: true }]);
  assert.deepEqual(cutLabelLines(value, 'br').map((l) => [l.text, l.suspicious]), [['zprava 6,0 % = 60 px', true], ['zdola 1,0 % = 5 px', false]]);
  assert.deepEqual(cutLabelLines(value, 'bl').map((l) => l.text), ['zleva 1,0 % = 10 px', 'zdola 0,0 % = 0 px']);
  // with a higher limit (images.edges.suspicious) nothing
  assert.ok(cutLabelLines(value, 'br', 0.1).every((l) => !l.suspicious));
});

test('cutPreview: how much each corner cuts is written at it, a suspicious line in red', async () => {
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
  // two lines in the corner (baselines at y 32 and 50): "zleva 10,0 % = 40 px" red, "shora 1,0 % = 3 px" below it not
  assert.ok(red(10, 18, 160, 18) > 20, 'the suspicious line of the top left label is red');
  assert.equal(red(10, 40, 160, 14), 0, 'its other line is not');
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

test('guidesProblems: a non-empty list of shares between 0 and 0.5', () => {
  assert.deepEqual(guidesProblems([0.003, 0.006, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05]), []);
  assert.deepEqual(guidesProblems([0.1]), []);
  for (const wrong of [[], [0], [0.5], ['1 %'], 0.01, undefined]) {
    assert.match(guidesProblems(wrong).join(''), /images\.edges\.guides must be a list of shares between 0 and 0\.5/, JSON.stringify(wrong));
  }
});

test('frameLines: each share of the width in from left and right, of the height in from top and bottom, in pixels', () => {
  assert.deepEqual(frameLines(3673, 2785, [0.002, 0.01, 0.05]), [
    { share: 0.002, colour: '#00ff66', x: 7, y: 6 },
    { share: 0.01, colour: '#ffe600', x: 37, y: 28 },
    { share: 0.05, colour: '#00e5ff', x: 184, y: 139 },
  ]);
  // colours in turn, so neighbours differ however many lines there are
  const many = frameLines(1000, 500);
  assert.equal(many.length, 9);
  assert.deepEqual(many.slice(3, 6).map((l) => l.colour), [FRAME_COLOURS[3], FRAME_COLOURS[0], FRAME_COLOURS[1]]);
  assert.deepEqual([many[0].x, many[0].y, many.at(-1).x, many.at(-1).y], [3, 2, 50, 25]);
});

test('framesSvg: four lines per frame, every line labelled with its distance, labels in steps never on one place', () => {
  const lines = frameLines(1000, 500, [0.01, 0.05]);
  const svg = framesSvg(1000, 500, lines);
  assert.equal((svg.match(/<line /g) ?? []).length, 8);
  // stroke 1 px: lines through the middle of pixel 10 from the left, 989 from the right (10 px after it), 5 and 494
  for (const at of ['x1="10.5"', 'x1="989.5"', 'y1="5.5"', 'y1="494.5"']) assert.ok(svg.includes(at), at);
  const labels = [...svg.matchAll(/<text [^>]*x="([\d.]+)" y="([\d.]+)"[^>]*fill="([^"]+)">([^<]+)</g)].map((m) => [Number(m[1]), Number(m[2]), m[3], m[4]]);
  assert.deepEqual(labels.map((l) => l[3]), ['10 px', '10 px', '5 px', '5 px', '50 px', '50 px', '25 px', '25 px']);
  assert.deepEqual(labels.map((l) => l[2]), [...Array(4).fill('#00ff66'), ...Array(4).fill('#ffe600')]);
  assert.ok(svg.lastIndexOf('<line ') < svg.indexOf('<text '), 'the labels over all the lines');
  assert.equal(new Set(labels.map(([x, y]) => `${x},${y}`)).size, labels.length, 'no two labels on one place');
  // the second line's labels one step further: the left ones lower, the top ones more to the right
  assert.ok(labels[4][1] > labels[0][1] && labels[6][0] > labels[2][0]);
});

test('framesOf: the whole photo in its full size, never cut, with the frame lines', async () => {
  const file = path.join(tmp, 'f.jpg');
  await floorPhoto(file, 1200, 900, SHEET.map(([x, y]) => [x * 3, y * 3]));
  const jpeg = await framesOf(file, [0.05]);
  const meta = await sharp(jpeg).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1200, 900]);
  const { data } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * 1200 + x) * 3, (y * 1200 + x) * 3 + 3)];
  // the green of the first line (#00ff66), 1 px on this photo, dimmed by the JPEG
  const green = (p) => p[1] - p[0] > 40 && p[1] - p[2] > 40;
  // 5 % = 60 px in from the left and the right, 45 px from the top and the bottom, away from the labels
  assert.ok(green(at(60, 200)) && green(at(1139, 200)), 'the vertical lines');
  assert.ok(green(at(300, 45)) && green(at(300, 854)), 'the horizontal lines');
  assert.ok(!green(at(600, 200)), 'nothing in the middle');
});

test('cutLinesSvg: corners, inset and feather lines, every line labelled on every side with the numbers of the panel', () => {
  const value = { photo: [1000, 500], tl: [30, 15], tr: [200, 20], br: [190, 100], bl: [25, 95] };
  const region = { left: 32, top: 22, width: 774, height: 380 };
  const svg = cutLinesSvg(1000, 500, region, value, { inset: 0.002, feather: 0.01 });
  // the corners solid, inset and the end of the feather dashed
  assert.match(svg, new RegExp(`<polygon points="30\\.0,15\\.0 800\\.0,20\\.0 810\\.0,400\\.0 25\\.0,405\\.0" fill="none" stroke="${CUT_COLOURS.corners}"`));
  assert.equal((svg.match(/<polygon [^>]*stroke-dasharray/g) ?? []).length, 2);
  const texts = [...svg.matchAll(/fill="([^"]+)">([^<]+)<\/text>/g)].map((m) => [m[1], m[2]]);
  // per side (left, top, right, bottom) five labels, then the four corners
  assert.equal(texts.length, 4 * 5 + 4);
  assert.deepEqual(texts.slice(0, 5), [
    [CUT_COLOURS.corners, 'rohy 30 · 25 px'],
    [CUT_COLOURS.image, 'obrázek 32 px = rohy 25 + okraj 7'],
    [CUT_COLOURS.inset, 'inset 1,0 px'],
    [CUT_COLOURS.feather, 'prolnutí 5,0 px'],
    [CUT_COLOURS.opaque, 'plná barva'],
  ]);
  assert.deepEqual(texts.filter(([c, t]) => c === CUT_COLOURS.image).map(([, t]) => t), [
    'obrázek 32 px = rohy 25 + okraj 7', 'obrázek 22 px = rohy 15 + okraj 7', 'obrázek 194 px = rohy 190 + okraj 4', 'obrázek 98 px = rohy 95 + okraj 3',
  ]);
  assert.deepEqual(texts.slice(-4).map(([, t]) => t), ['tl [30, 15]', 'tr [200, 20]', 'br [190, 100]', 'bl [25, 95]']);
  // the labels over all the lines, each on a dark plate
  assert.ok(svg.lastIndexOf('<polygon ') < svg.indexOf('<text '));
  assert.equal((svg.match(/<rect [^>]*fill="#000"/g) ?? []).length, texts.length);
});

test('cutOriginalOf: the original in full size, the edge of the opaque work, the border of the trimmed image, lines, the info panel', async () => {
  // the size of a real photo of a work, so lines and labels are as thick and big as they come out
  const W = 3673, H = 2785, sx = W / 400, sy = H / 300;
  const file = path.join(tmp, 'h.jpg');
  await floorPhoto(file, W, H, SHEET.map(([x, y]) => [x * sx, y * sy]));
  const value = await detectFile(file);
  const { data: orig } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const read = async (buf) => (await sharp(buf).raw().toBuffer({ resolveWithObject: true })).data;
  const px = (data, x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  // every few pixels of a region of the 400 × 300 grid of SHEET
  const count = (x0, x1, y0, y1, test, step = 4) => {
    let n = 0;
    for (let x = x0 * sx; x < x1 * sx; x += step) for (let y = y0 * sy; y < y1 * sy; y += step) if (test(x, y)) n++;
    return n;
  };
  const changed = (data) => (x, y) => { const [r, , b] = px(data, x, y), [r0, , b0] = px(orig, x, y); return Math.abs(r - r0) + Math.abs(b - b0) > 50; };

  const plain = await cutOriginalOf(file, value, undefined, { info: false, lines: false });
  const meta = await sharp(plain).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', W, H]);
  const data = await read(plain);
  // nothing hatched: the floor and the work as they are
  assert.equal(count(0, 15, 20, 280, changed(data)), 0, 'the floor on the left');
  assert.equal(count(150, 250, 100, 200, changed(data)), 0, 'the work');

  // the trimmed image (the sheet spans x 18–376 of the grid, from x 165 px) has a solid light green border (#7cff7c)
  const green = (x, y) => { const [r, g, b] = px(data, x, y); return g > 200 && g - r > 30 && g - b > 30; };
  let border = 0;
  for (let x = 150; x < 240; x++) if ([120, 150, 180].every((y) => green(x, y * sy))) border++;
  assert.ok(border >= 2, `the left border of the trimmed image (${border} px)`);
  assert.equal(count(150, 250, 100, 200, green), 0);

  // the edge of the fully opaque work (#ff00cc): inside the sheet near its left edge
  // (the edge at 193 px + inset 5.6 + about 1.2 × feather 27.9), never in the middle
  const pink = (x, y) => { const [r, g, b] = px(data, x, y); return r > 170 && g < 110 && b > 120; };
  let edge = 0;
  for (let x = 200; x < 300; x++) if (pink(x, 150 * sy)) edge++;
  assert.ok(edge >= 2, `the pink line along the left edge of the sheet (${edge} px)`);
  assert.equal(count(150, 250, 100, 200, pink), 0);

  // with the lines (default): the dark plates of their labels along the left edge
  const lined = await read(await cutOriginalOf(file, value, undefined, { info: false }));
  const plate = (x, y) => { const [r, g, b] = px(lined, x, y), [r0, g0, b0] = px(data, x, y); return r + g + b < 120 && r0 + g0 + b0 > 240; };
  const plates = count(15, 30, 0, 300, plate);
  assert.ok(plates > 500, `the labels of the left side (${plates})`);
  assert.equal(count(150, 250, 100, 200, plate), 0, 'none in the middle');

  // with the info panel (default): the middle is covered by the dark panel
  const withInfo = await read(await cutOriginalOf(file, value));
  const dark = count(150, 250, 100, 200, (x, y) => px(withInfo, x, y)[0] < px(orig, x, y)[0] - 40);
  assert.ok(dark > 10000, `the info panel in the middle (${dark})`);

  const zero = { photo: [W, H], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  assert.equal((await sharp(await cutOriginalOf(file, zero)).metadata()).width, W, 'nothing cut: the original (with the panel)');
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
  assert.match(svg, /<g id="removed" clip-path="url\(#scheme\)">.*<line /, 'the photo with the removed parts hatched');
  assert.doesNotMatch(svg, /<pattern/, 'no SVG pattern: it takes seconds to render');
  assert.match(svg, /<polygon points="[^"]+" fill="none"[^>]*stroke-dasharray/, 'the corners dotted');
  for (const line of cutInfo({ left: 20, top: 10, width: 800, height: 400 }, [1000, 500], value)) assert.ok(svg.includes(`>${line}</text>`), line);
  assert.doesNotMatch(infoPanelSvg(800, 400, { left: 0, top: 0, width: 1000, height: 500 }, [1000, 500], false), /<polygon/, 'no corners, no quadrilateral');
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
