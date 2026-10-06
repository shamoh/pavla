// Edges of the paper sheet in a master photo that also shows the floor around it (a photo taken at a slight angle,
// or a master of `npm run straighten` with its margin). The pipeline finds the four corners of the sheet once and
// writes them into the work's description (`meta_corners`, see scripts/lib/schema.mjs), where they can be adjusted
// by hand; everything outside the quadrilateral is then made transparent, with a soft edge (scripts/process-images.mjs).
//
// meta_corners: { photo: [width, height], tl: [x, y], tr: [x, y], br: [x, y], bl: [x, y] }
//   photo   size of the master the corners belong to (a replaced photo needs new corners)
//   tl      pixels right and down from the top left corner of the photo, tr: left and down from the top right,
//   br      left and up from the bottom right, bl: right and up from the bottom left; always >= 0 (towards the middle)
// meta_corners: false = no cut, the whole photo as it is. All zeros = the sheet fills the photo, nothing is cut either.

import { isPaperPixel } from './straighten.mjs';

export const CORNER_KEYS = ['tl', 'tr', 'br', 'bl'];

/** A corner may lie at most this share of the photo's width / height away from its corner of the photo. */
export const MAX_CORNER_SHARE = 0.25;

/** Defaults of `images.edges` in site.config.yaml. */
// suspicious: a corner cut further than this share of the photo's width / height is marked in previews
// guides: lines of the cut preview this share in from every border of the image (at most four)
export const EDGE_DEFAULTS = { feather: 0.01, inset: 0.002, search: 0.1, suspicious: 0.05, guides: [0.01, 0.03, 0.05, 0.1] };

/** How far (RGB distance) a pixel must be from the floor walked so far to count as the sheet (paper or paint). */
export const FLOOR_DISTANCE = 50;

/**
 * Distance from the border to where the floor ends along one line of pixels (`pixel(d)` = [r, g, b] at depth d):
 * 0 when the line starts on paper (no floor here), otherwise the first of 3 pixels in a row that differ from the
 * mean colour of the floor walked so far (paper or paint, both are the sheet); null when none within `limit`.
 */
export function floorDepth(pixel, limit) {
  const first = pixel(0);
  if (isPaperPixel(...first)) return 0;
  const sum = [...first];
  let n = 1;
  const off = (d) => {
    const p = pixel(d);
    return Math.hypot(p[0] - sum[0] / n, p[1] - sum[1] / n, p[2] - sum[2] / n) > FLOOR_DISTANCE;
  };
  for (let d = 1; d <= limit; d++) {
    if (off(d) && off(d + 1) && off(d + 2)) return d;
    // only the floor itself makes its colour (a light speck in it would shift it towards the paper)
    if (off(d)) continue;
    const p = pixel(d);
    sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; n++;
  }
  return null;
}

/**
 * True when the colours at the border of a side are a floor: most of them (FLOOR_SHARE) are not paper and they look
 * alike (within FLOOR_DISTANCE of their median). Paint reaching the edge of a sheet without any floor is patchy and
 * different from place to place, so it never cuts into the work.
 */
export function looksLikeFloor(colours) {
  const floor = colours.filter((c) => !isPaperPixel(...c));
  if (floor.length < colours.length * FLOOR_SHARE) return false;
  const median = [0, 1, 2].map((k) => floor.map((c) => c[k]).sort((a, b) => a - b)[floor.length >> 1]);
  const near = floor.filter((c) => Math.hypot(c[0] - median[0], c[1] - median[1], c[2] - median[2]) <= FLOOR_DISTANCE);
  return near.length >= floor.length * FLOOR_SHARE;
}

/** Share of the samples of a side that must show a floor at the border (and of those, alike in colour). */
export const FLOOR_SHARE = 0.6;

/** How far (pixels of the small image) a sample may lie off a side's line and still be on it. */
export const LINE_TOLERANCE = 3;

/**
 * Share of the samples near a corner that end up outside the sheet's edge there: the line of the edge is moved
 * inwards until only the rest (a wavy or torn edge sticking out) still shows any floor.
 */
export const FLOOR_COVER = 0.85;

/** Samples further than this (pixels of the small image) inside the line are odd ones (paint, a shadow), not the edge. */
export const ODD_DEPTH = 10;

/**
 * Line v = a·u + b through [u, v] points, robust to many odd points (paint, a dent in the paper): the line through
 * the pair of points that most of the others lie on (within LINE_TOLERANCE), then least squares over those.
 */
export function fitLine(points) {
  const fit = (pts) => {
    const n = pts.length;
    const su = pts.reduce((s, p) => s + p[0], 0), sv = pts.reduce((s, p) => s + p[1], 0);
    const suu = pts.reduce((s, p) => s + p[0] * p[0], 0), suv = pts.reduce((s, p) => s + p[0] * p[1], 0);
    const den = n * suu - su * su;
    const a = den ? (n * suv - su * sv) / den : 0;
    return { a, b: (sv - a * su) / n };
  };
  const near = (line) => points.filter(([u, v]) => Math.abs(v - (line.a * u + line.b)) <= LINE_TOLERANCE);
  let best = points;
  let bestCount = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const [u1, v1] = points[i], [u2, v2] = points[j];
      if (u1 === u2) continue;
      const a = (v2 - v1) / (u2 - u1);
      const inliers = near({ a, b: v1 - a * u1 });
      if (inliers.length > bestCount) { best = inliers; bestCount = inliers.length; }
    }
  }
  return fit(best.length >= 2 ? best : points);
}

/**
 * The edge near one corner from the samples of that half of a side ([u, depth] points): the robust line (fitLine),
 * moved inwards so that FLOOR_COVER of the samples lie at or outside it, ignoring odd samples deep inside (ODD_DEPTH).
 * A real edge is seldom straight (wavy, torn paper): this rather cuts a little paper than leaves floor.
 */
export function edgeLine(points) {
  const line = fitLine(points);
  const res = points.map(([u, v]) => v - (line.a * u + line.b)).filter((r) => r <= ODD_DEPTH).sort((x, y) => x - y);
  const shift = res.length ? res[Math.min(res.length - 1, Math.floor(res.length * FLOOR_COVER))] : 0;
  return { a: line.a, b: line.b + Math.max(0, shift) };
}

/**
 * Where the sheet starts along each side of a small RGB image (width × height): for samples across the middle of
 * a side, where the floor ends (floorDepth) within `search` (share of the size) from the border; a sample without
 * an end (floor coloured like the paint) is left out. Each half of a side gives the edge near its corner
 * (edgeLine), so a bent side does not move the far corner. A side whose border does not look like a floor
 * (looksLikeFloor) is the border itself (0).
 * Returns { top, bottom, left, right }, each { start, end } (start = the half at the smaller coordinate):
 * top/bottom as y = a·x + b, left/right as x = a·y + b, in pixels of the image.
 */
export function sheetSides(rgb, width, height, search = EDGE_DEFAULTS.search) {
  const px = (x, y) => {
    const i = (Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 3;
    return [rgb[i], rgb[i + 1], rgb[i + 2]];
  };
  const none = { start: { a: 0, b: 0 }, end: { a: 0, b: 0 } };
  const side = (length, depth, at) => {
    const limit = Math.round(depth * search);
    const samples = 60;
    const lines = Array.from({ length: samples }, (_, k) => Math.round(length * (0.1 + (0.8 * k) / (samples - 1))));
    if (!looksLikeFloor(lines.map((t) => at(t, 0)))) return none;
    const half = (ts) => {
      const points = [];
      for (const t of ts) {
        const d = floorDepth((dd) => at(t, dd), limit);
        if (d !== null) points.push([t + 0.5, d]);
      }
      return points.length >= ts.length * 0.3 ? edgeLine(points) : { a: 0, b: 0 };
    };
    return { start: half(lines.slice(0, samples / 2)), end: half(lines.slice(samples / 2)) };
  };
  // bottom and right are measured from their border: turned into coordinates of the image
  const flip = (l, size) => ({ a: -l.a, b: size - l.b });
  const mirror = ({ start, end }, size) => ({ start: flip(start, size), end: flip(end, size) });
  return {
    top: side(width, height, (x, d) => px(x, d)),
    bottom: mirror(side(width, height, (x, d) => px(x, height - 1 - d)), height),
    left: side(height, width, (y, d) => px(d, y)),
    right: mirror(side(height, width, (y, d) => px(width - 1 - d, y)), width),
  };
}

/** Intersection of a horizontal-ish line y = h.a·x + h.b with a vertical-ish line x = v.a·y + v.b. */
const cross = (h, v) => {
  const y = (h.a * v.b + h.b) / (1 - h.a * v.a);
  return [v.a * y + v.b, y];
};

/**
 * Corners of the sheet in a small RGB image (width × height), scaled to a photo of photoWidth × photoHeight:
 * the `meta_corners` value. The sides are found within `search` of the border, their corners may lie further
 * (a sheet askew); a corner outside the photo is 0 (the sheet goes on beyond it), one further than
 * MAX_CORNER_SHARE is not trusted (0 as well).
 */
export function detectCorners(rgb, width, height, photoWidth, photoHeight, search = EDGE_DEFAULTS.search) {
  const { top, bottom, left, right } = sheetSides(rgb, width, height, search);
  const sx = photoWidth / width, sy = photoHeight / height;
  const points = {
    tl: cross(top.start, left.start), tr: cross(top.end, right.start),
    br: cross(bottom.end, right.end), bl: cross(bottom.start, left.end),
  };
  const inward = {
    tl: ([x, y]) => [x, y],
    tr: ([x, y]) => [width - x, y],
    br: ([x, y]) => [width - x, height - y],
    bl: ([x, y]) => [x, height - y],
  };
  const clamp = (v, size) => {
    const px = Math.round(v);
    return px < 0 || px > size * MAX_CORNER_SHARE ? 0 : px;
  };
  const value = { photo: [photoWidth, photoHeight] };
  for (const k of CORNER_KEYS) {
    const [dx, dy] = inward[k](points[k]);
    value[k] = [clamp(dx * sx, photoWidth), clamp(dy * sy, photoHeight)];
  }
  return value;
}

/** Problems of a `meta_corners` value (`where`: the file) for a master of width × height; [] when it is fine. */
export function cornersProblems(value, width, height, where) {
  if (value === undefined || value === false) return [];
  const p = (msg) => [`${where}: meta_corners ${msg}`];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return p('must be photo, tl, tr, br, bl (or false = no cut)');
  const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n));
  if (!pair(value.photo)) return p('photo must be [width, height] of the photo in pixels');
  if (value.photo[0] !== width || value.photo[1] !== height) {
    return p(`belong to a photo of ${value.photo[0]} × ${value.photo[1]}, but the photo is ${width} × ${height}: delete meta_corners, the pipeline finds them again`);
  }
  const unknown = Object.keys(value).filter((k) => k !== 'photo' && !CORNER_KEYS.includes(k));
  if (unknown.length) return p(`has unknown keys: ${unknown.join(', ')}`);
  for (const k of CORNER_KEYS) {
    if (!pair(value[k])) return p(`${k} must be [x, y] in whole pixels`);
    const [x, y] = value[k];
    if (x < 0 || y < 0) return p(`${k} must not be negative (pixels towards the middle of the photo)`);
    if (x > width * MAX_CORNER_SHARE || y > height * MAX_CORNER_SHARE) return p(`${k} is too far from the corner of the photo (at most a quarter of it)`);
  }
  return [];
}

/**
 * How much each corner cuts, as shares of the photo: { tl: [x / width, y / height], … }, from the `photo` size of the
 * value; with `suspicious` the corners cutting more than `limit` (images.edges.suspicious) in either direction.
 */
export function cornerShares(value, limit = EDGE_DEFAULTS.suspicious) {
  const [w, h] = value.photo;
  const shares = Object.fromEntries(CORNER_KEYS.map((k) => [k, [value[k][0] / w, value[k][1] / h]]));
  return { shares, suspicious: CORNER_KEYS.filter((k) => shares[k].some((s) => s > limit)) };
}

/** The part of images.edges that changes the images (the others only steer detection and previews): fingerprints. */
export const edgeLook = ({ feather = EDGE_DEFAULTS.feather, inset = EDGE_DEFAULTS.inset } = {}) => ({ feather, inset });

/** A share as percent with one decimal: 0.0251 → "2.5 %" (`comma`: "2,5 %", for Czech texts). */
export const percent = (share, comma = false) => {
  const text = `${(share * 100).toFixed(1)} %`;
  return comma ? text.replace('.', ',') : text;
};

/** True when the value cuts something away: corners set, not `false` and not all zeros. */
export const cutsSheet = (value) => !!value && typeof value === 'object' && CORNER_KEYS.some((k) => value[k]?.some((n) => n > 0));

/** The quadrilateral [tl, tr, br, bl] of a `meta_corners` value in pixel coordinates of a width × height photo. */
export function quad(value, width, height) {
  const { tl, tr, br, bl } = value;
  return [[tl[0], tl[1]], [width - tr[0], tr[1]], [width - br[0], height - br[1]], [bl[0], height - bl[1]]];
}

/** The quad moved inwards by `d` pixels on every side (each edge shifted along its inner normal). */
export function insetQuad(points, d) {
  if (!d) return points;
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % 4];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    // clockwise in image coordinates (y down): the inner normal of the edge p→q is (-dy, dx)
    const n = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len];
    return { p: [p[0] + n[0] * d, p[1] + n[1] * d], dir: [q[0] - p[0], q[1] - p[1]] };
  });
  return points.map((_, i) => {
    const a = lines[(i + 3) % 4], b = lines[i];
    const den = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0];
    if (Math.abs(den) < 1e-9) return b.p;
    const t = ((b.p[0] - a.p[0]) * b.dir[1] - (b.p[1] - a.p[1]) * b.dir[0]) / den;
    return [a.p[0] + a.dir[0] * t, a.p[1] + a.dir[1] * t];
  });
}

/**
 * The largest axis-parallel rectangle inside the quad (approximately: the inner edges of the corners), `margin`
 * pixels further in, as a pixel region for sharp's extract(): the bare sheet, e.g. for a work behind a mat in a frame.
 */
export function innerRegion(value, width, height, margin = 0) {
  const [tl, tr, br, bl] = quad(value, width, height);
  const left = Math.ceil(Math.max(tl[0], bl[0]) + margin), right = Math.floor(Math.min(tr[0], br[0]) - margin);
  const top = Math.ceil(Math.max(tl[1], tr[1]) + margin), bottom = Math.floor(Math.min(bl[1], br[1]) - margin);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

/**
 * SVG of the alpha mask of a width × height photo: the quad, moved inwards by `inset` plus half the feather, white
 * on black; blurred by `sigma` (returned) it fades from transparent at the inset edge to opaque `feather` inside.
 * `inset` and `feather` are shares of the shorter side of the photo.
 */
export function maskSvg(value, width, height, { inset = EDGE_DEFAULTS.inset, feather = EDGE_DEFAULTS.feather } = {}) {
  const short = Math.min(width, height);
  const f = feather * short;
  const points = insetQuad(quad(value, width, height), inset * short + f / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000"/>`
    + `<polygon points="${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}" fill="#fff"/></svg>`;
  return { svg, sigma: f / 4 };
}
