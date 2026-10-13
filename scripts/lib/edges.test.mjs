import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKGROUND_SIZE, CORNER_KEYS, EDGE_DEFAULTS, backgroundDepth, backgroundRadius, cornerShares, edgeLook, cornersProblems, cutsSheet, percent, detectCorners,
  edgeLine, fitLine, floorDepth, innerRegion, insetQuad, looksLikeBackground, looksLikeFloor, maskSvg, quad, straightEdge,
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
  assert.match(problem({ ...ok, photo: [800, 600] }), /^x\.yaml: meta_corners patří k fotce 800 × 600, ale fotka má 400 × 300: smaž meta_corners/);
  assert.match(problem({ ...ok, tl: [-1, 5] }), /tl nesmí být záporné/);
  assert.match(problem({ ...ok, br: undefined }), /br musí být \[x, y\] v celých pixelech/);
  assert.match(problem({ ...ok, tr: [1.5, 2] }), /tr musí být \[x, y\] v celých pixelech/);
  assert.match(problem({ ...ok, bl: [101, 0] }), /bl je moc daleko od rohu fotky/);
  assert.match(problem({ ...ok, middle: [1, 1] }), /neznámé klíče: middle/);
  assert.match(problem(true), /musí mít photo, tl, tr, br a bl \(nebo false = neořezávat\)/);
  assert.match(problem({ tl: [1, 1] }), /photo musí být \[šířka, výška\]/);
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

// A light background: a white wall (or backdrop paper) whose light falls off towards one side, with the grain of the
// plaster (a fixed pseudo-random speckle), around a canvas painted up to its edge or a sheet of paper.
const grain = (x, y) => ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 41 - 20;
const wall = (width) => (x, y) => {
  const light = 225 - Math.round((25 * x) / width) + grain(x, y);
  return [light, light - 2, light + 4];
};
/** A canvas painted up to its edge: bands of green, orange and blue across it. */
const canvas = (x, y) => [[50, 120, 80], [200, 90, 40], [60, 90, 150]][Math.floor((x + y) / 37) % 3];

test('detectCorners: a canvas on a light wall (falling light, grain of the plaster), at the size of the detection and smaller', () => {
  for (const [w, h] of [[1200, 900], [400, 300]]) {
    const s = w / 400;
    const corners = [[24, 18], [376, 22], [372, 280], [20, 276]].map(([x, y]) => [x * s, y * s]);
    const rgb = scene(w, h, corners, { background: wall(w), paint: canvas });
    near(detectCorners(rgb, w, h, w, h), expected(corners, w, h), 3 * s, `${w} × ${h}`);
  }
});

test('detectCorners: a sheet on a light backdrop with a soft shadow along it is cut at the paper, not where the paint starts', () => {
  const corners = [[30, 24], [370, 24], [370, 276], [30, 276]];
  const shadow = 200;
  const rgb = scene(400, 300, corners, {
    // the backdrop is a little darker than the sheet and darkest right along it (its shadow)
    background: (x, y) => {
      const d = Math.min(Math.abs(x - 30), Math.abs(x - 370), Math.abs(y - 24), Math.abs(y - 276));
      const v = d < 4 ? shadow : 222;
      return [v, v - 3, v - 6];
    },
    // paint starts 20 px inside the sheet, raggedly: a white margin of paper around it
    paint: (x, y) => (x > 50 + (y % 7) && x < 350 - (y % 5) && y > 44 + (x % 6) && y < 256 - (x % 4) ? [60, 90, 150] : null),
  });
  near(detectCorners(rgb, 400, 300, 400, 300), expected(corners, 400, 300), 4, 'at the paper');
});

test('detectCorners: a sheet filling the photo with a white margin and paint starting raggedly is never cut', () => {
  const rgb = scene(400, 300, [[-1, -1], [401, -1], [401, 301], [-1, 301]], {
    // a watercolour: blobs of paint starting 25–45 px from the border, never along a straight line
    paint: (x, y) => {
      const edge = 25 + ((Math.imul(Math.floor(x / 9) + 7 * Math.floor(y / 9), 2654435761) >>> 0) % 21);
      return x > edge && y > edge && x < 400 - edge && y < 300 - edge ? [70, 110, 160] : null;
    },
  });
  const value = detectCorners(rgb, 400, 300, 400, 300);
  assert.equal(cutsSheet(value), false, JSON.stringify(value));
});

test('detectCorners: a border of paper mixed with a strip of floor is no light background (the side stays at the border)', () => {
  // the sheet goes on beyond the top of the photo on the left half, a strip of floor shows on the right half
  const corners = [[20, -40], [380, 15], [380, 280], [20, 280]];
  const value = detectCorners(scene(400, 300, corners), 400, 300, 400, 300);
  assert.equal(value.tl[1], 0, JSON.stringify(value));
  assert.ok(value.tr[1] <= 15, `never further than the floor: ${JSON.stringify(value)}`);
  assert.ok(Math.abs(value.tl[0] - 20) <= 3 && Math.abs(value.bl[1] - 20) <= 3, 'the other sides by the floor as before');
});

test('looksLikeBackground: light colours changing smoothly yes; a floor, paper mixed with floor or patchy paint no', () => {
  const fading = Array.from({ length: 30 }, (_, i) => [230 - i, 228 - i, 235 - i]);
  assert.equal(looksLikeBackground(fading), true, 'the light falls off along the wall');
  assert.equal(looksLikeBackground(Array(30).fill(PAPER)), true);
  assert.equal(looksLikeBackground(Array(30).fill(WOOD)), false);
  assert.equal(looksLikeBackground([...Array(25).fill(PAPER), ...Array(5).fill(WOOD)]), false, 'less than 90 % light');
  const jumps = Array.from({ length: 30 }, (_, i) => (i % 2 ? [240, 238, 230] : [190, 205, 235]));
  assert.equal(looksLikeBackground(jumps), false, 'light but jumping from one colour to another');
});

test('backgroundDepth: where a light background ends (a narrow shadow too); null without an end', () => {
  const line = (cols) => (d) => cols[Math.min(cols.length - 1, d)];
  const W = [228, 226, 232], C = [50, 120, 80];
  assert.equal(backgroundDepth(line([W, W, W, W, W, C, C, C, C]), 20), 5);
  assert.equal(backgroundDepth(line([W, W, W, W]), 20), null);
  // a speck of two pixels is no edge with a run of 3, a speck of three is not with a run of 4
  assert.equal(backgroundDepth(line([W, W, C, C, W, W, W, C, C, C, C, C]), 20), 7);
  assert.equal(backgroundDepth(line([W, W, C, C, C, W, W, W, C, C, C, C, C]), 20, 4), 8);
  // the light falling off slowly into the depth is no edge, a sharp shadow along the work is
  const slow = Array.from({ length: 25 }, (_, d) => [228 - d, 226 - d, 232 - d]);
  assert.equal(backgroundDepth(line(slow), 20), null, 'falling light');
  assert.equal(backgroundDepth(line([W, W, [180, 178, 184], [175, 173, 179], [172, 170, 176], C, C]), 20), 2, 'a shadow');
});

test('straightEdge: most samples found and on one line; backgroundRadius grows with the image', () => {
  const straight = Array.from({ length: 30 }, (_, i) => [i * 10, 12 + i * 0.1]);
  assert.equal(straightEdge(straight, 30), true);
  assert.equal(straightEdge(straight.slice(0, 15), 30), false, 'too few samples found the end');
  const ragged = straight.map(([u], i) => [u, 12 + ((i * 7) % 13)]);
  assert.equal(straightEdge(ragged, 30), false, 'paint starting raggedly');
  assert.equal(backgroundRadius(BACKGROUND_SIZE), 1);
  assert.equal(backgroundRadius(200), 1, 'never below');
  assert.equal(backgroundRadius(1200), 3);
});

test('detectCorners: a sheet almost as light as the wall, told apart only by its narrow shadow, at the size of the detection', () => {
  const s = 3; // 1200 × 900, as detectFile measures
  const corners = [[30, 24], [370, 24], [370, 276], [30, 276]].map(([x, y]) => [x * s, y * s]);
  const rgb = scene(400 * s, 300 * s, corners, {
    background: (x, y) => {
      const d = Math.min(Math.abs(x - 30 * s), Math.abs(x - 370 * s), Math.abs(y - 24 * s), Math.abs(y - 276 * s));
      // a shadow 3 pixels deep (the narrowest one found: `run` of backgroundDepth), the lit wall around it
      const v = d <= 3 ? 175 : 216 + grain(x, y) / 4;
      return [v, v - 4, v - 8];
    },
    paint: () => [230, 228, 221], // the paper only about 25 lighter than the wall
  });
  near(detectCorners(rgb, 400 * s, 300 * s, 400 * s, 300 * s), expected(corners, 400 * s, 300 * s), 3 * s, 'by the shadow');
});

