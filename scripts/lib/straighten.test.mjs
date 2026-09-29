import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyHomography, borderColor, findSheetCorners, homography, isPaperPixel, paperColor, parseCorners, sheetSize, warpQuad, whiteBalanceGains,
} from './straighten.mjs';

const WOOD = [180, 120, 70], PAPER = [240, 238, 230], INK = [60, 60, 70];

/** width × height RGB image: wood with a paper quad (point-in-polygon) and dark paint inside it. */
function scene(width, height, quad) {
  const rgb = Buffer.alloc(width * height * 3);
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const [xi, yi] = quad[i], [xj, yj] = quad[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const paint = Math.abs(x - cx) < 10 && Math.abs(y - cy) < 10; // paint in the middle must not break the sheet
    const col = inside(x + 0.5, y + 0.5) ? (paint ? INK : PAPER) : WOOD;
    rgb.set(col, (y * width + x) * 3);
  }
  return rgb;
}

test('isPaperPixel: light greyish paper yes, orange wood and dark paint no', () => {
  assert.ok(isPaperPixel(...PAPER));
  assert.ok(!isPaperPixel(...WOOD));
  assert.ok(!isPaperPixel(...INK));
});

test('findSheetCorners finds a skewed sheet on wood, paint inside does not matter', () => {
  const quad = [[20, 15], [170, 25], [160, 130], [15, 120]];
  const found = findSheetCorners(scene(200, 150, quad), 200, 150);
  found.forEach(([x, y], i) => {
    assert.ok(Math.abs(x - quad[i][0]) < 3 && Math.abs(y - quad[i][1]) < 3, `corner ${i}: ${x},${y} vs ${quad[i]}`);
  });
});

test('findSheetCorners returns null when there is no sheet', () => {
  const wood = Buffer.alloc(50 * 40 * 3);
  for (let i = 0; i < 50 * 40; i++) wood.set(WOOD, i * 3);
  assert.equal(findSheetCorners(wood, 50, 40), null);
});

test('homography maps the four points exactly and is a projective map in between', () => {
  const from = [[0, 0], [100, 0], [100, 50], [0, 50]];
  const to = [[10, 5], [90, 12], [95, 70], [3, 60]];
  const h = homography(from, to);
  from.forEach(([x, y], i) => applyHomography(h, x, y).forEach((v, k) => assert.ok(Math.abs(v - to[i][k]) < 1e-6)));
  assert.throws(() => homography(from, [[0, 0], [0, 0], [0, 0], [0, 0]]), /quadrilateral/);
});

test('warpQuad straightens the sheet: the result is paper edge to edge, the paint stays in the middle', () => {
  const quad = [[20, 15], [170, 25], [160, 130], [15, 120]];
  const { width, height } = sheetSize(quad);
  const out = warpQuad(scene(200, 150, quad), 200, 150, 3, quad, width, height);
  const px = (x, y) => [...out.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)];
  for (const [x, y] of [[3, 3], [width - 4, 3], [width - 4, height - 4], [3, height - 4]]) assert.ok(isPaperPixel(...px(x, y)), `paper at ${x},${y}: ${px(x, y)}`);
  const mid = px(Math.round(width / 2), Math.round(height / 2));
  assert.ok(mid[0] < 120, `paint in the middle: ${mid}`);
});

test('sheetSize averages opposite edges; parseCorners reads fractions and rejects anything else', () => {
  assert.deepEqual(sheetSize([[0, 0], [100, 0], [110, 50], [-10, 50]]), { width: 110, height: 51 });
  assert.deepEqual(parseCorners('0.1,0.2,0.9,0.2,0.9,0.8,0.1,0.8'), [[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.1, 0.8]]);
  for (const bad of ['0.1,0.2', '0,0,1,0,1,1,0,1.5', 'a,b,c,d,e,f,g,h']) assert.throws(() => parseCorners(bad), /8 numbers between 0 and 1/);
});

/** RGB buffer: `share` of the pixels are `paper`, the rest is colourful paint. */
const painting = (paper, share = 0.6, n = 1000) => {
  const rgb = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i++) rgb.set(i < n * share ? paper : [40 + (i % 90), 120, 200 - (i % 70)], i * 3);
  return rgb;
};

test('paperColor measures the bare paper, not the paint', () => {
  assert.deepEqual(paperColor(painting([232, 222, 205])), [232, 222, 205]);
  // a little darker paper in the shade does not win over the lightest paper
  const rgb = Buffer.concat([painting([232, 222, 205], 0.3, 700), painting([180, 172, 160], 1, 300)]);
  assert.deepEqual(paperColor(rgb), [232, 222, 205]);
  // no paper at all: only strongly coloured paint
  const red = Buffer.alloc(300 * 3);
  for (let i = 0; i < 300; i++) red.set([200, 40, 40], i * 3);
  assert.equal(paperColor(red), null);
  // grey, but too dark to be paper (a metal printing plate): no white balance
  assert.equal(paperColor(painting([120, 122, 125], 1)), null);
});

test('whiteBalanceGains turn the paper into neutral white and stay within limits', () => {
  const gains = whiteBalanceGains([232, 222, 205]);
  [232, 222, 205].forEach((c, i) => assert.ok(Math.abs(c * gains[i] - 240) < 0.001));
  assert.ok(gains[2] > gains[0], 'a warm cast: blue is lifted more than red');
  assert.deepEqual(whiteBalanceGains([60, 250, 400]), [1.6, 0.96, 0.7]);
});

test('warpQuad with a margin continues the perspective outwards and fills what is beyond the photo', () => {
  const quad = [[20, 15], [170, 25], [160, 130], [15, 120]];
  const { width, height } = sheetSize(quad);
  const m = 10;
  const out = warpQuad(scene(200, 150, quad), 200, 150, 3, quad, width, height, m, [1, 2, 3]);
  const W = width + 2 * m;
  assert.equal(out.length, W * (height + 2 * m) * 3);
  const px = (x, y) => [...out.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
  assert.deepEqual(px(2, 2), WOOD, 'the surroundings (floor) are in the margin');
  assert.ok(isPaperPixel(...px(m + 3, m + 3)), 'the paper starts after the margin');
  // a margin reaching beyond the photo: the quad is the whole photo, so the whole margin is fill
  const all = warpQuad(scene(40, 30, [[0, 0], [40, 0], [40, 30], [0, 30]]), 40, 30, 3, [[0, 0], [40, 0], [40, 30], [0, 30]], 40, 30, 5, [1, 2, 3]);
  assert.deepEqual([...all.subarray(0, 3)], [1, 2, 3]);
});

test('borderColor averages the outer ring of the photo (the floor), not the sheet in the middle', () => {
  assert.deepEqual(borderColor(scene(200, 150, [[20, 15], [180, 15], [180, 135], [20, 135]]), 200, 150), WOOD);
});
