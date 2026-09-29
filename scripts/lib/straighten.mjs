// Straightening of photos of artworks: finds the paper sheet lying on a darker, coloured background
// (a wooden floor), maps it from the perspective of the photo to a rectangle and crops the background away.
// Pure functions over raw RGB buffers, so they are easy to test; the CLI is scripts/straighten.mjs.

/** True for a pixel that looks like paper: light and nearly grey (wood is orange, paint is inside the sheet). */
export const isPaperPixel = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max > 150 && (max ? (max - min) / max : 0) < 0.22;
};

/**
 * Corners [tl, tr, br, bl] of the sheet in a small RGB image (width × height), in pixels of that image.
 * Background = non-paper pixels connected to the image border; the sheet is everything else, so paint
 * inside the sheet does not matter. Corners are the extreme points of the sheet along the diagonals,
 * which works for a sheet photographed roughly from above. Returns null when no sheet is found.
 */
export function findSheetCorners(rgb, width, height) {
  const n = width * height;
  const paper = new Uint8Array(n);
  for (let i = 0; i < n; i++) paper[i] = isPaperPixel(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) ? 1 : 0;
  const bg = new Uint8Array(n);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (!bg[i] && !paper[i]) { bg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % width, y = (i / width) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  let tl, tr, br, bl, found = 0;
  let sTl = Infinity, sTr = -Infinity, sBr = -Infinity, sBl = Infinity;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (bg[y * width + x]) continue;
    found++;
    const p = [x + 0.5, y + 0.5];
    if (x + y < sTl) { sTl = x + y; tl = p; }
    if (x - y > sTr) { sTr = x - y; tr = p; }
    if (x + y > sBr) { sBr = x + y; br = p; }
    if (x - y < sBl) { sBl = x - y; bl = p; }
  }
  return found < n * 0.05 ? null : [tl, tr, br, bl];
}

/** Size of the straightened sheet: average lengths of the opposite edges of the quad [tl, tr, br, bl]. */
export function sheetSize([tl, tr, br, bl]) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return { width: Math.round((d(tl, tr) + d(bl, br)) / 2), height: Math.round((d(tl, bl) + d(tr, br)) / 2) };
}

/**
 * Homography h (8 numbers) mapping the points `from` onto `to` (4 pairs each):
 * u = (h0 x + h1 y + h2) / (h6 x + h7 y + 1), v = (h3 x + h4 y + h5) / (h6 x + h7 y + 1).
 */
export function homography(from, to) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) { // Gauss–Jordan elimination with partial pivoting
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('corners do not form a quadrilateral');
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

export const applyHomography = (h, x, y) => {
  const d = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
};

/**
 * Maps the quad `corners` [tl, tr, br, bl] of the source image (raw pixels, `channels` per pixel) onto
 * a rectangle of outWidth × outHeight with bilinear sampling, plus `margin` pixels of the surroundings
 * on every side (the same perspective continues outwards). Where the margin reaches beyond the photo,
 * the pixel gets `fill`. Returns raw RGB of (outWidth + 2·margin) × (outHeight + 2·margin).
 */
export function warpQuad(src, width, height, channels, corners, outWidth, outHeight, margin = 0, fill = [0, 0, 0]) {
  const h = homography([[0, 0], [outWidth, 0], [outWidth, outHeight], [0, outHeight]], corners);
  const W = outWidth + 2 * margin, H = outHeight + 2 * margin;
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let [sx, sy] = applyHomography(h, x - margin + 0.5, y - margin + 0.5);
    sx -= 0.5; sy -= 0.5;
    if (sx < -0.5 || sy < -0.5 || sx > width - 0.5 || sy > height - 0.5) {
      out.set(fill, (y * W + x) * 3);
      continue;
    }
    sx = Math.min(width - 1.001, Math.max(0, sx));
    sy = Math.min(height - 1.001, Math.max(0, sy));
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
    const i00 = (y0 * width + x0) * channels, i10 = i00 + channels, i01 = i00 + width * channels, i11 = i01 + channels;
    const o = (y * W + x) * 3;
    for (let k = 0; k < 3; k++) {
      out[o + k] = Math.round((src[i00 + k] * (1 - fx) + src[i10 + k] * fx) * (1 - fy) + (src[i01 + k] * (1 - fx) + src[i11 + k] * fx) * fy);
    }
  }
  return out;
}

/** Average colour of the outermost ring (2 %) of an RGB image: the surroundings (floor) of the photo. */
export function borderColor(rgb, width, height) {
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.02));
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x >= ring && y >= ring && x < width - ring && y < height - ring) continue;
    const i = (y * width + x) * 3;
    sum[0] += rgb[i]; sum[1] += rgb[i + 1]; sum[2] += rgb[i + 2]; n++;
  }
  return sum.map((v) => Math.round(v / n));
}

/** Parses "x,y,x,y,x,y,x,y" (fractions 0–1 of width and height, order tl, tr, br, bl) into 4 points. */
export function parseCorners(text) {
  const v = String(text).split(',').map(Number);
  if (v.length !== 8 || v.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) {
    throw new Error('--corners needs 8 numbers between 0 and 1: tl x,y, tr x,y, br x,y, bl x,y');
  }
  return [0, 2, 4, 6].map((i) => [v[i], v[i + 1]]);
}

/**
 * Colour of the bare paper in a straightened RGB image: the median of the lightest nearly grey pixels
 * (the brightest 30 % of the pixels with saturation < 0.18). Null when there is too little of it or when
 * even the lightest grey is too dark to be paper (e.g. a metal printing plate).
 */
export function paperColor(rgb) {
  const px = [];
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 60 && (max - min) / max < 0.18) px.push([r, g, b, r + g + b]);
  }
  if (px.length < rgb.length / 3 / 50) return null;
  px.sort((a, b) => b[3] - a[3]);
  const top = px.slice(0, Math.max(1, Math.round(px.length * 0.3)));
  const median = (k) => top.map((p) => p[k]).sort((a, b) => a - b)[top.length >> 1];
  const color = [median(0), median(1), median(2)];
  return Math.max(...color) >= 150 ? color : null;
}

/**
 * Per-channel gains that turn `paper` into a neutral white of `target`: removes a warm or grey cast of
 * the photo. Gains are kept within 0.7–1.6, so an odd measurement cannot wreck the colours.
 */
export const whiteBalanceGains = (paper, target = 240) =>
  paper.map((c) => Math.min(1.6, Math.max(0.7, target / Math.max(1, c))));
