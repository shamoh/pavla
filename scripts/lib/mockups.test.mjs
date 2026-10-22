import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { CANVAS_DEFAULTS, canvasFrame, composeMockup, cropWindow, fits, frameGeometry, hashIndex, loadScenes, pickScenes, placement, renderMockup } from './mockups.mjs';

const scene = (name, group, maxCm = [100, 80], extra = {}) => ({
  name, group, maxCm, frameCm: 2, pxPerCm: 10, anchor: { x: 1200, bottom: 800 }, standing: ['shelf', 'desk'].includes(group), ...extra,
});
const scenes = [
  scene('living-a', 'living', [150, 85]),
  scene('living-b', 'living', [120, 58]),
  scene('bedroom', 'wall', [85, 80]),
  scene('sideboard', 'wall', [110, 55]),
  scene('shelf', 'shelf', [50, 60]),
  scene('hallway', 'hallway', [120, 75]),
  scene('desk', 'desk', [62, 70]),
];

test('frameGeometry grows the mat with the work and keeps it within limits', () => {
  assert.deepEqual(frameGeometry([40, 30], scene('x', 'wall')), { mat: 6, frame: 2, outerW: 56, outerH: 46 });
  assert.equal(frameGeometry([10, 10], scene('x', 'wall')).mat, 4);
  assert.equal(frameGeometry([120, 80], scene('x', 'wall')).mat, 10);
  assert.equal(frameGeometry([10, 10], scene('x', 'shelf')).mat, 3);
  assert.equal(frameGeometry([60, 40], scene('x', 'shelf')).mat, 6);
});

test('frameGeometry of a canvas: no mat, the frame and the gap of the scene for canvases', () => {
  assert.deepEqual(frameGeometry([70, 50], scene('x', 'wall'), 'canvas'), { mat: 0, gap: 1.4, frame: 1, outerW: 74.8, outerH: 54.8 });
  assert.deepEqual(frameGeometry([70, 50], scene('x', 'wall', [100, 80], { canvas: { frameCm: 0, gapCm: 0 } }), 'canvas'), { mat: 0, gap: 0, frame: 0, outerW: 70, outerH: 50 });
  assert.equal(frameGeometry([70, 50], scene('x', 'wall', [100, 80], { canvas: { frameCm: 2.2, gapCm: 0 } }), 'canvas').outerW, 74.4);
  // paper (any other edge, or none) keeps its mat
  for (const edge of [undefined, 'deckle', 'cut']) assert.equal(frameGeometry([70, 50], scene('x', 'wall'), edge).mat, 10);
});

test('canvasFrame takes the canvas of the scene over the defaults', () => {
  assert.deepEqual(canvasFrame(scene('x', 'wall')), CANVAS_DEFAULTS);
  assert.deepEqual(canvasFrame(scene('x', 'wall', [100, 80], { canvas: { frameCm: 0, depthCm: 4 } })), { ...CANVAS_DEFAULTS, frameCm: 0, depthCm: 4 });
});

test('fits compares the framed size with the scene limits', () => {
  assert.ok(fits([40, 30], scene('x', 'wall', [56, 46])));
  assert.ok(!fits([40, 30], scene('x', 'wall', [55, 46])));
  assert.ok(!fits([40, 30], scene('x', 'wall', [56, 45])));
});

test('hashIndex is stable and within range', () => {
  assert.equal(hashIndex('k3f9a', 3), hashIndex('k3f9a', 3));
  for (const id of ['k3f9a', 'm7q2x', 'zzzzz', 'a2222']) {
    const i = hashIndex(id, 2);
    assert.ok(i === 0 || i === 1);
  }
  assert.equal(hashIndex('k3f9a', 0), 0);
});

test('pickScenes: a small work gets a wall, the shelf and the desk', () => {
  const picked = pickScenes([24, 32], 'k3f9a', scenes).map((s) => s.group);
  assert.deepEqual(picked, ['wall', 'shelf', 'desk']);
});

test('pickScenes: a larger work gets a living room, another wall and a hallway, never a scene twice', () => {
  for (const id of ['k3f9a', 'm7q2x', 'p4r8t', 'zzzzz']) {
    const picked = pickScenes([56, 38], id, scenes);
    assert.deepEqual(picked.map((s) => s.group), ['living', 'wall', 'hallway']);
    assert.equal(new Set(picked).size, 3);
  }
});

test('pickScenes honours a smaller count', () => {
  assert.equal(pickScenes([56, 38], 'k3f9a', scenes, { count: 2 }).length, 2);
});

test('pickScenes skips scenes where the framed work does not fit', () => {
  // 70 × 50 cm framed is about 88 × 68 cm: only living-a and the hallway fit.
  assert.deepEqual(pickScenes([70, 50], 'k3f9a', scenes).map((s) => s.name), ['living-a', 'hallway']);
  assert.deepEqual(pickScenes([300, 200], 'k3f9a', scenes), []);
});

test('pickScenes: a canvas without a mat fits where the same work on paper does not', () => {
  // 70 × 50 cm on paper is about 94 × 74 cm framed, as a canvas 74.8 × 54.8 cm
  assert.deepEqual(pickScenes([70, 50], 'k3f9a', scenes).map((s) => s.name), ['living-a', 'hallway']);
  const canvas = pickScenes([70, 50], 'k3f9a', scenes, { edge: 'canvas' });
  assert.deepEqual(canvas.map((s) => s.group), ['living', 'wall', 'hallway']);
});

test('pickScenes falls back to any fitting scene when a group has none', () => {
  const noShelf = scenes.filter((s) => s.group !== 'shelf');
  const picked = pickScenes([20, 20], 'k3f9a', noShelf);
  assert.equal(picked.length, 3);
  assert.equal(picked[0].group, 'wall');
  assert.equal(picked[1].group, 'desk');
});

test('pickScenes uses a default size for works without size_cm', () => {
  assert.equal(pickScenes(undefined, 'k3f9a', scenes).length, 3);
  assert.equal(pickScenes([0, 0], 'k3f9a', scenes).length, 3);
});

test('placement puts the frame bottom on the anchor at real scale', () => {
  const p = placement([40, 30], scene('x', 'wall'));
  assert.equal(p.width, 560);
  assert.equal(p.height, 460);
  assert.equal(p.left, 1200 - 280);
  assert.equal(p.top + p.height, 800);
});

test('cropWindow keeps the scene aspect ratio, contains the work and stays inside', () => {
  const rect = { left: 2000, top: 100, width: 300, height: 200 };
  const c = cropWindow(2400, 1600, rect);
  assert.ok(Math.abs(c.width / c.height - 1.5) < 0.01);
  assert.ok(c.left >= 0 && c.top >= 0 && c.left + c.width <= 2400 && c.top + c.height <= 1600);
  assert.ok(c.left <= rect.left && c.left + c.width >= rect.left + rect.width);
  assert.ok(c.top <= rect.top && c.top + c.height >= rect.top + rect.height);
});

test('cropWindow with a portrait aspect (Instagram 4:5) stays inside a landscape scene', () => {
  const rect = { left: 1000, top: 300, width: 400, height: 300 };
  const c = cropWindow(2400, 1600, rect, { aspect: 4 / 5 });
  assert.ok(Math.abs(c.width / c.height - 0.8) < 0.01);
  assert.ok(c.height <= 1600 && c.left >= 0 && c.left + c.width <= 2400);
  assert.ok(c.left <= rect.left && c.left + c.width >= rect.left + rect.width);
});

test('cropWindow never crops tighter than the minimum share, never wider than the scene', () => {
  assert.equal(cropWindow(2400, 1600, { left: 1100, top: 700, width: 10, height: 10 }).width, 1320);
  assert.equal(cropWindow(2400, 1600, { left: 0, top: 0, width: 2000, height: 1000 }).width, 2400);
});

test('every scene in mockups/scenes.yaml is complete and its file loads', async () => {
  const { scenes: real } = await loadScenes();
  assert.ok(real.length >= 4);
  const groups = new Set(real.map((s) => s.group));
  for (const g of ['living', 'wall', 'hallway', 'shelf', 'desk']) assert.ok(groups.has(g), `no scene in group ${g}`);
  for (const s of real) {
    for (const key of ['name', 'label', 'group', 'pxPerCm', 'anchor', 'maxCm', 'frame', 'frameCm', 'light', 'shadow', 'source']) {
      assert.ok(s[key] !== undefined, `${s.name}: ${key}`);
    }
    const { width, height } = await sharp(s.path).metadata();
    assert.ok(s.anchor.x > 0 && s.anchor.x < width && s.anchor.bottom > 0 && s.anchor.bottom < height, s.name);
  }
});

test('renderMockup produces an image in the scene aspect ratio', async () => {
  const { scenes: real } = await loadScenes();
  const master = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#4f7a8a' } }).jpeg().toBuffer();
  const out = await renderMockup(master, [40, 30], real[0]);
  const { width, height } = await sharp(out).metadata();
  const scene = await sharp(real[0].path).metadata();
  assert.ok(Math.abs(width / height - scene.width / scene.height) < 0.01);
});

test('renderMockup with an aspect returns that aspect', async () => {
  const { scenes: real } = await loadScenes();
  const master = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#c98' } }).jpeg().toBuffer();
  const { width, height } = await sharp(await renderMockup(master, [24, 32], real[0], { aspect: 4 / 5 })).metadata();
  assert.ok(Math.abs(width / height - 0.8) < 0.01);
});

test('every canvas of a scene in mockups/scenes.yaml has only known keys and sane values', async () => {
  const { scenes: real } = await loadScenes();
  for (const s of real) {
    for (const key of Object.keys(s.canvas ?? {})) assert.ok(key in CANVAS_DEFAULTS, `${s.name}: canvas.${key}`);
    const c = canvasFrame(s);
    assert.ok(c.frameCm >= 0 && c.gapCm >= 0 && c.depthCm > 0, s.name);
  }
});

test('a canvas hangs without a mat: its middle is the work, a bare canvas has no frame around it', async () => {
  const { scenes: real } = await loadScenes();
  const sideboard = real.find((s) => s.name === 'komoda');
  assert.equal(canvasFrame(sideboard).frameCm, 0, 'komoda: a bare canvas');
  const master = await sharp({ create: { width: 700, height: 500, channels: 3, background: '#ff00ff' } }).jpeg().toBuffer();
  const pixel = async (buf, x, y) => [...(await sharp(buf).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer())];
  // the light of the room darkens it, the hue stays
  const magenta = ([r, g, b]) => r > 100 && b > 60 && g < 30;
  for (const s of real.filter((x) => x.canvas)) {
    const { buf, rect } = await composeMockup(master, [70, 50], s, { edge: 'canvas' });
    assert.equal(rect.mat, 0, s.name);
    const px = s.pxPerCm;
    // just inside the outer edge: the frame (or, bare, already the canvas), never a white mat
    const inset = Math.round((rect.frame + rect.gap) * px) + Math.round(px);
    assert.ok(magenta(await pixel(buf, rect.left + Math.round(rect.width / 2), rect.top + inset)), `${s.name}: the canvas right inside the frame`);
    const rim = await pixel(buf, rect.left + Math.round(rect.width / 2), rect.top + 1);
    assert.equal(magenta(rim), rect.frame === 0 && rect.gap === 0, `${s.name}: the outer edge is ${rect.frame ? 'the frame' : 'the canvas'}`);
  }
});

test('renderMockup of a canvas keeps the aspect of the scene', async () => {
  const { scenes: real } = await loadScenes();
  const master = await sharp({ create: { width: 700, height: 500, channels: 3, background: '#4f7a8a' } }).jpeg().toBuffer();
  const out = await renderMockup(master, [70, 50], real[0], { edge: 'canvas' });
  const { width, height } = await sharp(out).metadata();
  const scene = await sharp(real[0].path).metadata();
  assert.ok(Math.abs(width / height - scene.width / scene.height) < 0.01);
});

test('occluders keep the original photo in front of the work', async () => {
  const { scenes: real } = await loadScenes();
  const desk = real.find((s) => s.occluders?.length);
  assert.ok(desk, 'a scene with occluders');
  const master = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#ff00ff' } }).jpeg().toBuffer();
  const { buf } = await composeMockup(master, [24, 32], desk);
  const o = desk.occluders[0];
  const region = { left: o.left + 10, top: o.top + 5, width: o.width - 20, height: 20 };
  const [a, b] = await Promise.all([
    sharp(buf).extract(region).raw().toBuffer(),
    sharp(desk.path).extract(region).raw().toBuffer(),
  ]);
  // Same pixels as the photo (up to JPEG noise), i.e. no magenta from the work.
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  assert.ok(diff / a.length < 6, `mean difference ${diff / a.length}`);
});
