import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOUR_VERSION, DEFAULT_COLOUR_FAMILIES, analyseColours, colourBins, colourHistogram, needsColours, workColourIds, colourSettings, familyShares, nearestFamily, oklabToOklch, paletteDistance, paletteMood, paperFromEdge, rgbToOklab, workPalette,
} from './colors.mjs';

const lab = (r, g, b) => rgbToOklab(r, g, b);
/** Raw RGBA pixels of a picture `w` × `h` from a colour function (x, y) -> [r, g, b, a]. */
function pixels(w, h, colour) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(colour(x, y), (y * w + x) * 4);
  return { data, width: w, height: h, channels: 4 };
}

test('rgbToOklab and oklabToOklch: white, black, a red', () => {
  assert.deepEqual(lab(255, 255, 255).map((v) => Math.round(v * 100) / 100 + 0), [1, 0, 0]);
  assert.deepEqual(lab(0, 0, 0).map((v) => Math.round(v * 100) + 0), [0, 0, 0]);
  const red = oklabToOklch(lab(255, 0, 0));
  assert.ok(Math.abs(red.l - 0.628) < 0.01 && Math.abs(red.c - 0.258) < 0.01 && Math.abs(red.h - 29.2) < 1);
});

test('colourSettings: the defaults, the minimum share in %, a list of any colours, bad values stop the build', () => {
  const d = colourSettings({});
  assert.equal(d.minShare, 0.12);
  assert.deepEqual(d.families.map((f) => f.id), DEFAULT_COLOUR_FAMILIES.map((f) => f.id));
  assert.ok(d.families.every((f) => f.lab.length === 3));
  const own = colourSettings({ gallery: { colors: { minShare: 25, families: [{ id: 'modra', label: 'modrá', color: '#4472B0' }] } } });
  assert.deepEqual([own.minShare, own.families[0].color], [0.25, '#4472b0']);
  const bad = (colors) => assert.throws(() => colourSettings({ gallery: { colors } }), /site\.config\.yaml gallery\.colors/);
  bad({ minShare: 0 });
  bad({ families: [] });
  bad({ families: [{ id: 'Modrá', label: 'm', color: '#000000' }] });
  bad({ families: [{ id: 'a', label: 'a', color: '#000' }] });
  bad({ families: [{ id: 'a', label: 'a', color: '#000000' }, { id: 'a', label: 'b', color: '#ffffff' }] });
  bad({ other: 1 });
});

test('nearestFamily: the nearest colour of the list by hue and lightness, none for grey', () => {
  const { families } = colourSettings({});
  const cases = [
    [[200, 40, 40], 'cervena'], [[230, 130, 40], 'oranzova'], [[230, 200, 60], 'zluta'], [[110, 70, 40], 'hneda'], [[70, 150, 70], 'zelena'],
    [[50, 160, 160], 'tyrkysova'], [[60, 100, 190], 'modra'], [[130, 90, 180], 'fialova'], [[220, 120, 170], 'ruzova'],
  ];
  for (const [rgb, id] of cases) assert.equal(nearestFamily(lab(...rgb), families), id, `${rgb} -> ${id}`);
  assert.equal(nearestFamily(lab(130, 128, 126), families), null, 'grey: no colour');
  const withoutBrown = families.filter((f) => f.id !== 'hneda');
  assert.equal(nearestFamily(lab(110, 70, 40), withoutBrown), 'oranzova', 'any list: brown goes to the nearest one left');
});

test('paperFromEdge and colourHistogram: the bare sheet at the edge, every pixel balanced by it', () => {
  // a warm grey sheet (the tint of the photo) with a blue square in the middle
  const p = pixels(50, 50, (x, y) => (x > 15 && x < 35 && y > 15 && y < 35 ? [60, 100, 190, 255] : [225, 215, 200, 255]));
  const paper = paperFromEdge(p);
  assert.ok(paper && paper[0] > 0.85 && paper[2] > 0.01, 'light, a little warm');
  const bins = colourHistogram(p, paper);
  assert.ok(Math.abs(bins.reduce((s, b) => s + b.weight, 0) - 1) < 0.02);
  const sheet = bins[0];
  assert.ok(sheet.lab[0] > 0.9 && Math.hypot(sheet.lab[1], sheet.lab[2]) < 0.01, 'the sheet balanced to white');
  assert.equal(paperFromEdge(pixels(20, 20, () => [40, 80, 200, 255])), null, 'painted to the edge: no paper');
});

test('workPalette: the biggest colours first with their shares, the margin and transparent pixels left out', () => {
  // left two thirds blue, right third yellow, a red frame of one pixel (in the margin), the bottom row transparent
  const p = pixels(30, 30, (x, y) => (y === 29 ? [0, 0, 0, 0] : x === 0 || y === 0 || x === 29 ? [255, 0, 0, 255] : x < 20 ? [40, 80, 200, 255] : [240, 210, 40, 255]));
  const palette = workPalette(p, { k: 3, margin: 0.04 });
  assert.equal(palette[0].hex, '#2850c8');
  assert.equal(palette[1].hex, '#f0d228');
  assert.ok(palette.every((c) => c.hex !== '#ff0000'), 'the frame is in the margin');
  assert.ok(Math.abs(palette[0].weight - 19 / 28) < 0.02);
  assert.ok(Math.abs(palette.reduce((s, c) => s + c.weight, 0) - 1) < 0.01);
  assert.deepEqual(workPalette(pixels(4, 4, () => [0, 0, 0, 0])), [], 'nothing visible: no palette');
});

test('familyShares and paletteMood: shares of the painted part, the paper left out; warm against cool', () => {
  const { families } = colourSettings({});
  const warm = [{ lab: lab(230, 130, 40), weight: 0.3 }, { lab: lab(130, 128, 126), weight: 0.3 }, { lab: lab(250, 248, 242), weight: 0.4, paper: true }];
  const cool = [{ lab: lab(60, 100, 190), weight: 0.7 }, { lab: lab(40, 60, 90), weight: 0.3 }];
  assert.deepEqual(familyShares(warm, families), { oranzova: 0.5 }, 'half of the painted part, the grey half no colour');
  assert.ok(paletteMood(warm).warm > 0.2 && paletteMood(cool).warm < -0.3);
  assert.ok(paletteMood(warm).light > paletteMood(cool).light);
  assert.deepEqual(paletteMood([{ lab: lab(250, 248, 242), weight: 1 }]), { warm: 0, light: 0, vivid: 0 }, 'paper only: no mood');
});

test('paletteDistance: 0 for the same, symmetric, the paper counts less', () => {
  const blue = [{ lab: lab(60, 100, 190), weight: 1 }];
  const blueOnPaper = [{ lab: lab(60, 100, 190), weight: 0.5 }, { lab: lab(250, 248, 242), weight: 0.5 }];
  const orange = [{ lab: lab(230, 130, 40), weight: 1 }];
  assert.equal(paletteDistance(blue, blue), 0);
  assert.equal(paletteDistance(blue, orange), paletteDistance(orange, blue));
  assert.ok(paletteDistance(blue, blueOnPaper) < paletteDistance(blue, orange));
  assert.ok(paletteDistance(blue, blueOnPaper) < paletteDistance(blue, blueOnPaper, { paperWeight: 1 }));
  assert.equal(paletteDistance([], blue), Infinity);
});

test('colourDistance: families of the painted part and the mood, the paper left out', async () => {
  const { colourDistance } = await import('./colors.mjs');
  const mood = { warm: 0, light: 0, vivid: 0 };
  const blue = { shares: { modra: 0.3, papir: 0.7 }, mood };
  const blueMore = { shares: { modra: 0.8, papir: 0.2 }, mood };
  const orange = { shares: { oranzova: 0.5, papir: 0.5 }, mood: { warm: 1, light: 0, vivid: 0 } };
  assert.equal(colourDistance(blue, blueMore), 0, 'the same painted part, whatever the paper');
  assert.equal(colourDistance(blue, orange, { moodWeight: 0 }), 1);
  assert.ok(colourDistance(blue, orange) > colourDistance(blue, orange, { moodWeight: 0 }));
});

test('analyseColours, colourBins, needsColours: what info.json keeps and how it is read', () => {
  const p = pixels(50, 50, (x, y) => (x > 15 && x < 35 && y > 15 && y < 35 ? [60, 100, 190, 255] : [225, 215, 200, 255]));
  const colors = analyseColours(p);
  assert.equal(colors.version, COLOUR_VERSION);
  assert.ok(colors.paper);
  assert.ok(colors.bins.every((b) => b.length === 4));
  const bins = colourBins(colors);
  assert.ok(bins.some((b) => b.paper) && bins.some((b) => !b.paper));
  const { families } = colourSettings({});
  assert.ok(familyShares(bins, families).modra > 0.9, 'the painted part is the blue square');
  assert.deepEqual(colourBins(undefined), []);
  assert.equal(needsColours({}), true);
  assert.equal(needsColours({ colors: { version: COLOUR_VERSION - 1 } }), true);
  assert.equal(needsColours({ colors }), false);
});

test('workColourIds: the colours with at least minShare of the painted part, the biggest first; none without analysis', () => {
  // a blue square (2/3 of the painted part) and a yellow stripe (1/3) on paper
  const p = pixels(60, 60, (x, y) => (y > 15 && y < 45 && x > 10 && x < 40 ? [60, 100, 190, 255] : y > 15 && y < 45 && x >= 40 && x < 55 ? [230, 200, 60, 255] : [225, 215, 200, 255]));
  const settings = colourSettings({});
  assert.deepEqual(workColourIds(analyseColours(p), settings), ['modra', 'zluta']);
  assert.deepEqual(workColourIds(analyseColours(p), { ...settings, minShare: 0.5 }), ['modra']);
  assert.deepEqual(workColourIds(undefined, settings), []);
});
