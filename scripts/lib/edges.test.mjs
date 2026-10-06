import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORNER_KEYS, EDGE_DEFAULTS, cornerShares, edgeLook, cornersProblems, cutsSheet, percent, detectCorners, edgeLine, fitLine, floorDepth, innerRegion, insetQuad,
  looksLikeFloor, maskSvg, quad,
} from './edges.mjs';

const WOOD = [150, 105, 70], PAPER = [240, 238, 230];

/** width × height RGB image: `background(x, y)` outside the quad, paper inside it, `paint(x, y)` over the paper where it returns a colour. */
function scene(width, height, corners, { background = () => WOOD, paint = () => null } = {}) {
  const rgb = Buffer.alloc(width * height * 3);
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const [xi, yi] = corners[i], [xj, yj] = corners[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const col = inside(x + 0.5, y + 0.5) ? paint(x, y) ?? PAPER : background(x, y);
    rgb.set(col, (y * width + x) * 3);
  }
  return rgb;
}

/** The meta_corners value of the quad [tl, tr, br, bl] in a width × height photo. */
const expected = ([tl, tr, br, bl], w, h) => ({ tl, tr: [w - tr[0], tr[1]], br: [w - br[0], h - br[1]], bl: [bl[0], h - bl[1]] });

const near = (actual, want, tolerance, label) => {
  for (const k of CORNER_KEYS) {
    actual[k].forEach((v, i) => assert.ok(Math.abs(v - want[k][i]) <= tolerance, `${label} ${k}[${i}]: ${v} vs ${want[k][i]}`));
  }
};

test('detectCorners: a sheet askew on a wooden floor, in pixels of the photo towards the middle', () => {
  const corners = [[20, 14], [372, 22], [366, 284], [14, 276]];
  const rgb = scene(400, 300, corners);
  const value = detectCorners(rgb, 400, 300, 400, 300);
  assert.deepEqual(value.photo, [400, 300]);
  near(value, expected(corners, 400, 300), 3, 'same size');
  // the small image is scaled up to the size of the photo
  const big = detectCorners(rgb, 400, 300, 1600, 1200);
  assert.deepEqual(big.photo, [1600, 1200]);
  near(big, Object.fromEntries(CORNER_KEYS.map((k) => [k, expected(corners, 400, 300)[k].map((v) => v * 4)])), 12, 'scaled');
});

test('detectCorners: paint reaching the edge of a sheet and a grain in the floor do not move the corners', () => {
  const corners = [[24, 18], [376, 18], [376, 282], [24, 282]];
  const rgb = scene(400, 300, corners, {
    background: (x, y) => (y % 9 === 0 ? [120, 85, 55] : WOOD),
    paint: (x, y) => (x > 150 && x < 250 ? [40, 70, 140] : null), // a blue band across the whole sheet
  });
  near(detectCorners(rgb, 400, 300, 400, 300), expected(corners, 400, 300), 3, 'painted');
});

test('detectCorners: no floor (the sheet fills the photo, even painted up to its edge) = all zeros, nothing is cut', () => {
  const zero = { tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  const filled = detectCorners(scene(200, 150, [[-1, -1], [201, -1], [201, 151], [-1, 151]]), 200, 150, 200, 150);
  assert.deepEqual({ ...filled, photo: undefined }, { ...zero, photo: undefined });
  // patches of different paint along every border are not a floor
  const palette = [[40, 70, 140], [180, 60, 50], [70, 130, 60], [230, 200, 80]];
  const painted = scene(200, 150, [[-1, -1], [201, -1], [201, 151], [-1, 151]], { paint: (x, y) => ((x < 8 || y < 8 || x > 191 || y > 141) ? palette[Math.floor((x + y) / 23) % 4] : null) });
  const value = detectCorners(painted, 200, 150, 200, 150);
  assert.equal(cutsSheet(value), false, JSON.stringify(value));
});

test('detectCorners: a sheet going on beyond the photo on one side has 0 there', () => {
  const corners = [[-30, 20], [380, 20], [380, 280], [-30, 280]];
  const value = detectCorners(scene(400, 300, corners), 400, 300, 400, 300);
  assert.deepEqual([value.tl[0], value.bl[0]], [0, 0]);
  assert.ok(Math.abs(value.tl[1] - 20) <= 3 && Math.abs(value.tr[0] - 20) <= 3, JSON.stringify(value));
});

test('floorDepth: 0 on paper, where the floor ends, null without an end', () => {
  const line = (cols) => (d) => cols[Math.min(cols.length - 1, d)];
  assert.equal(floorDepth(line([PAPER, PAPER, PAPER]), 10), 0);
  assert.equal(floorDepth(line([WOOD, WOOD, WOOD, WOOD, PAPER, PAPER, PAPER, PAPER]), 10), 4);
  assert.equal(floorDepth(line([WOOD, WOOD, WOOD, [40, 70, 140], [40, 70, 140], [40, 70, 140]]), 10), 3, 'paint is the sheet too');
  assert.equal(floorDepth(line([WOOD, WOOD, WOOD, WOOD]), 10), null);
  assert.equal(floorDepth(line([WOOD, WOOD, PAPER, PAPER, WOOD, WOOD]), 10), null, 'one or two pixels are not the sheet yet');
});

test('looksLikeFloor: mostly alike non-paper colours yes, paper or patchy paint no', () => {
  assert.equal(looksLikeFloor(Array(10).fill(WOOD)), true);
  assert.equal(looksLikeFloor([...Array(8).fill(WOOD), PAPER, PAPER]), true);
  assert.equal(looksLikeFloor([...Array(5).fill(WOOD), ...Array(5).fill(PAPER)]), false);
  assert.equal(looksLikeFloor([[40, 70, 140], [180, 60, 50], [70, 130, 60], [20, 20, 20], [40, 70, 140]]), false);
});

test('fitLine: the line most points lie on, whatever the odd ones', () => {
  const points = Array.from({ length: 20 }, (_, i) => [i * 10, 5 + i * 0.5]);
  const odd = [...points.slice(0, 13), [130, 40], [140, 42], [150, 45], [160, 1], [170, 50], [180, 60], [190, 70]];
  const line = fitLine(odd);
  assert.ok(Math.abs(line.a - 0.05) < 0.01 && Math.abs(line.b - 5) < 0.5, JSON.stringify(line));
});

test('edgeLine: moved inwards over a wavy edge, so little floor stays, but not to odd points deep inside', () => {
  const wavy = Array.from({ length: 20 }, (_, i) => [i * 10, 10 + (i % 4 === 0 ? 3 : 0)]);
  const line = edgeLine(wavy);
  assert.ok(line.b >= 12.9 && line.b <= 13.5, JSON.stringify(line));
  const withPaint = [...Array.from({ length: 18 }, (_, i) => [i * 10, 10]), [180, 60], [190, 70]];
  assert.ok(edgeLine(withPaint).b < 11, 'paint deep inside is ignored');
});

test('cornersProblems: missing or false is fine; a photo of another size, negative, missing or far corners are not', () => {
  const ok = { photo: [400, 300], tl: [10, 5], tr: [0, 0], br: [3, 4], bl: [20, 30] };
  assert.deepEqual(cornersProblems(undefined, 400, 300, 'x.yaml'), []);
  assert.deepEqual(cornersProblems(false, 400, 300, 'x.yaml'), []);
  assert.deepEqual(cornersProblems(ok, 400, 300, 'x.yaml'), []);
  const problem = (value) => cornersProblems(value, 400, 300, 'x.yaml').join('\n');
  assert.match(problem({ ...ok, photo: [800, 600] }), /^x\.yaml: meta_corners belong to a photo of 800 × 600, but the photo is 400 × 300: delete meta_corners/);
  assert.match(problem({ ...ok, tl: [-1, 5] }), /tl must not be negative/);
  assert.match(problem({ ...ok, br: undefined }), /br must be \[x, y\] in whole pixels/);
  assert.match(problem({ ...ok, tr: [1.5, 2] }), /tr must be \[x, y\] in whole pixels/);
  assert.match(problem({ ...ok, bl: [101, 0] }), /bl is too far from the corner of the photo/);
  assert.match(problem({ ...ok, middle: [1, 1] }), /unknown keys: middle/);
  assert.match(problem(true), /must be photo, tl, tr, br, bl \(or false = no cut\)/);
  assert.match(problem({ tl: [1, 1] }), /photo must be \[width, height\]/);
});

test('cutsSheet: only corners with a value above 0', () => {
  assert.equal(cutsSheet(undefined), false);
  assert.equal(cutsSheet(false), false);
  assert.equal(cutsSheet({ photo: [4, 3], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] }), false);
  assert.equal(cutsSheet({ photo: [4, 3], tl: [0, 0], tr: [0, 1], br: [0, 0], bl: [0, 0] }), true);
});

test('quad, insetQuad and innerRegion: the corners in pixels, moved inwards, the bare sheet inside', () => {
  const value = { photo: [400, 300], tl: [10, 20], tr: [30, 10], br: [20, 40], bl: [5, 15] };
  assert.deepEqual(quad(value, 400, 300), [[10, 20], [370, 10], [380, 260], [5, 285]]);
  const rect = [[0, 0], [100, 0], [100, 50], [0, 50]];
  insetQuad(rect, 5).forEach((p, i) => p.forEach((v, k) => assert.ok(Math.abs(v - [[5, 5], [95, 5], [95, 45], [5, 45]][i][k]) < 1e-9)));
  assert.deepEqual(insetQuad(rect, 0), rect);
  assert.deepEqual(innerRegion(value, 400, 300), { left: 10, top: 20, width: 360, height: 240 });
  assert.deepEqual(innerRegion(value, 400, 300, 3), { left: 13, top: 23, width: 354, height: 234 });
});

test('maskSvg: the quad moved in by the inset and half the feather, blurred by a quarter of the feather', () => {
  const value = { photo: [400, 200], tl: [0, 0], tr: [0, 0], br: [0, 0], bl: [0, 0] };
  const { svg, sigma } = maskSvg(value, 400, 200, { inset: 0.01, feather: 0.1 });
  assert.equal(sigma, 5);
  // inset 2 px + half of the 20 px feather
  assert.match(svg, /points="12\.00,12\.00 388\.00,12\.00 388\.00,188\.00 12\.00,188\.00"/);
  assert.match(svg, /^<svg[^>]*width="400" height="200"/);
  assert.equal(maskSvg(value, 400, 200).sigma, (EDGE_DEFAULTS.feather * 200) / 4, 'defaults');
});

test('cornerShares and percent: how much each corner cuts, the suspicious ones above images.edges.suspicious', () => {
  const value = { photo: [1000, 500], tl: [10, 5], tr: [0, 30], br: [51, 0], bl: [50, 25] };
  const { shares, suspicious } = cornerShares(value);
  assert.deepEqual(shares.tl, [0.01, 0.01]);
  assert.deepEqual(shares.tr, [0, 0.06]);
  assert.equal(EDGE_DEFAULTS.suspicious, 0.05);
  assert.deepEqual(cornerShares(value, 0.02).suspicious, ['tr', 'br', 'bl'], 'a limit of its own');
  assert.deepEqual(suspicious, ['tr', 'br'], 'exactly 5 % is not suspicious yet');
  assert.equal(percent(0.0251), '2.5 %');
  assert.equal(percent(0.0251, true), '2,5 %');
  assert.equal(percent(0), '0.0 %');
});

test('edgeLook: only what changes the images (feather, inset), with the defaults', () => {
  assert.deepEqual(edgeLook({ feather: 0.02, inset: 0.001, search: 0.3, suspicious: 0.1 }), { feather: 0.02, inset: 0.001 });
  assert.deepEqual(edgeLook({}), { feather: EDGE_DEFAULTS.feather, inset: EDGE_DEFAULTS.inset });
});
