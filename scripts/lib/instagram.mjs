// Instagram exports of a work (only with `meta_instagram: true`), all 4:5:
//   <key>-caption-<palette>.jpg  the whole work on the paper of a palette of the site, a caption at the bottom
//                                (title; technique · size · year; the address of the site)
//   <key>-scene-<scene>.jpg      a styled studio photo: the work lying on a table or standing on an easel
//                                (scenes in mockups/instagram/scenes.yaml, see the comments there)
//   <key>-pano-<n>.jpg           the seamless panorama: a wide work over the full height of 2-3 slides of a carousel
//   <key>-story.jpg              a story (9:16): the work with the caption and room for a link sticker
// The caption export also makes the Pinterest pin (2:3, on the site, see scripts/lib/pinterest.mjs).
// Detail photos (<key>-detail-<name>.jpg) are made by the pipeline itself.
//
// A scene is a generated photo twice, with the same framing: with a blank sheet of known size (its corners give the
// plane of the table or easel, and its brightness the light of the scene) and without it (the background). The work
// is placed into that plane at its real size, lit like the sheet, with a slightly rough edge and a soft shadow.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import YAML from 'yaml';
import { ownText } from './rich-text.mjs';
import { captionFacts } from './works.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const INSTAGRAM_SCENES_DIR = path.join(siteRoot, 'mockups/instagram');
export const FONTS_DIR = path.join(siteRoot, 'fonts');

/** Export suffixes after "<slug>-<id>" for the given palettes and scenes (details are added by the caller). */
export const instagramSuffixes = (paletteIds, sceneNames) => [
  ...paletteIds.map((p) => `-caption-${p}`),
  ...sceneNames.map((s) => `-scene-${s}`),
];

export { captionFacts };

/** "https://pavla.kramolis.cz/" -> "pavla.kramolis.cz" (the address in the caption). */
export const siteHost = (url) => {
  try { return new URL(url).host; } catch { return String(url ?? '').replace(/^https?:\/\//, '').replace(/\/+$/, ''); }
};

// ---------------------------------------------------------------- geometry

function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** The 3 × 3 matrix (rows) of the projective mapping that takes the 4 points `src` to the 4 points `dst`. */
function homographyMatrix(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

/** The projective mapping that takes the 4 points `src` to the 4 points `dst`: (x, y) -> [x', y']. */
export function homography(src, dst) {
  const [[a, b, c], [d, e, g], [k, l]] = homographyMatrix(src, dst);
  return (x, y) => {
    const z = k * x + l * y + 1;
    return [(a * x + b * y + c) / z, (d * x + e * y + g) / z];
  };
}

/** y of the line through the two points of `ledge` at x. */
export function lineY([[ax, ay], [bx, by]], x) { return ay + (by - ay) * (x - ax) / (bx - ax); }

// ---------------------------------------------------------------- the camera of a scene

/** A 35 mm equivalent focal length (mm) in px of an image W × H (the diagonal of 35 mm film is 43.27 mm). */
export const focalPx = (mm, W, H) => mm / 43.27 * Math.hypot(W, H);
export const FOCAL_RANGE_MM = [24, 70]; // phones and usual lenses: a guess outside is pulled back to the nearest end

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };

/** Rotation matrix (rows) of a rotation vector (axis × angle in radians). */
function rotation(w) {
  const th = Math.hypot(...w);
  if (th < 1e-12) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [x, y, z] = w.map((v) => v / th), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
}

function rotationVector(R) {
  const th = Math.acos(Math.max(-1, Math.min(1, (R[0][0] + R[1][1] + R[2][2] - 1) / 2)));
  if (th < 1e-9) return [0, 0, 0];
  return [R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]].map((v) => v / (2 * Math.sin(th)) * th);
}

/**
 * A pinhole camera { f, pp, R, t } (px, principal point in the middle of the image) seeing the plane of the sheet:
 * a point X, Y (cm, origin at the top left corner of the sheet, x to the right, y down the sheet) at height h (cm,
 * towards the camera, e.g. a lifted paper) is at R · [X, Y, -h] + t in the camera (cm, z = depth).
 */
export function project(cam, X, Y, h = 0) {
  const { R, t, f, pp } = cam;
  const P = [0, 1, 2].map((i) => R[i][0] * X + R[i][1] * Y - R[i][2] * h + t[i]);
  return [pp[0] + f * P[0] / P[2], pp[1] + f * P[1] / P[2]];
}

/** The point X, Y (cm) of the plane at height h seen in the image point x, y: where the ray of the pixel meets it. */
export function unproject(cam, x, y, h = 0) {
  const { R, t, f, pp } = cam;
  const d = [(x - pp[0]) / f, (y - pp[1]) / f, 1];
  const n = [R[0][2], R[1][2], R[2][2]];
  const s = (n[0] * t[0] + n[1] * t[1] + n[2] * t[2] - h) / (n[0] * d[0] + n[1] * d[1] + n[2] * d[2]);
  const P = [s * d[0] - t[0], s * d[1] - t[1], s * d[2] - t[2]];
  return [R[0][0] * P[0] + R[1][0] * P[1] + R[2][0] * P[2], R[0][1] * P[0] + R[1][1] * P[1] + R[2][1] * P[2]];
}

/** The rigid camera of focal length f (px) that sees a sheet SW × SH cm closest to its corners `quad` (image px). */
function cameraFor(quad, [SW, SH], f, pp) {
  const plane = [[0, 0], [SW, 0], [SW, SH], [0, SH]];
  // the first guess from the homography of the corners: its columns are f·r1, f·r2, f·t (up to scale)
  const h = homographyMatrix(plane, quad.map(([x, y]) => [x - pp[0], y - pp[1]]));
  const col = (j) => [h[0][j] / f, h[1][j] / f, h[2][j]];
  let r1 = col(0), r2 = col(1), t = col(2);
  const scale = Math.sqrt(Math.hypot(...r1) * Math.hypot(...r2));
  r1 = normalize(r1);
  r2 = normalize(r2.map((v, i) => v / scale - dot(r2, r1) / scale * r1[i]));
  t = t.map((v) => v / scale);
  if (t[2] < 0) { r1 = r1.map((v) => -v); r2 = r2.map((v) => -v); t = t.map((v) => -v); }
  const r3 = cross(r1, r2);
  let p = [...rotationVector([0, 1, 2].map((i) => [r1[i], r2[i], r3[i]])), ...t];
  // Gauss-Newton on the distances of the 4 corners (8 numbers, 6 unknowns: the rotation and the position)
  const camOf = (q) => ({ f, pp, R: rotation(q.slice(0, 3)), t: q.slice(3) });
  const residuals = (q) => { const cam = camOf(q); return plane.flatMap(([X, Y], i) => { const [x, y] = project(cam, X, Y); return [x - quad[i][0], y - quad[i][1]]; }); };
  for (let it = 0; it < 30; it++) {
    const r = residuals(p);
    const J = r.map(() => []);
    for (let k = 0; k < 6; k++) {
      const e = k < 3 ? 1e-6 : 1e-4, q = [...p];
      q[k] += e;
      residuals(q).forEach((v, i) => { J[i][k] = (v - r[i]) / e; });
    }
    const A = [0, 1, 2, 3, 4, 5].map((a) => [0, 1, 2, 3, 4, 5].map((b) => J.reduce((sum, row) => sum + row[a] * row[b], 0) + (a === b ? 1e-9 : 0)));
    const g = [0, 1, 2, 3, 4, 5].map((a) => -J.reduce((sum, row, i) => sum + row[a] * r[i], 0));
    const d = solve(A, g);
    p = p.map((v, i) => v + d[i]);
    if (Math.hypot(...d) < 1e-9) break;
  }
  const r = residuals(p);
  return { ...camOf(p), rms: Math.sqrt(r.reduce((sum, v) => sum + v * v, 0) / 4) };
}

/** How much taller than wide (bounding box) a circle of the plane around the image point x, y looks. */
export function circleRatio(cam, x, y) {
  const [X, Y] = unproject(cam, x, y), xs = [], ys = [];
  for (let a = 0; a < 2 * Math.PI; a += Math.PI / 36) {
    const [px, py] = project(cam, X + 3 * Math.cos(a), Y + 3 * Math.sin(a));
    xs.push(px); ys.push(py);
  }
  return (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs));
}

/**
 * The camera of a scene from the corners of its blank sheet (known size `sheetCm`) in an image W × H: the rigid camera
 * that sees a true rectangle of that size closest to the drawn corners. Its focal length (35 mm equivalent, within
 * FOCAL_RANGE_MM) is `focalMm`, or the one under which round things lying in the plane (`circles`: their bounding boxes
 * [x0, y0, x1, y1] in the image, e.g. rings of a cup on the table) look as flat as they are drawn, or the one that fits
 * the corners best. Generators draw a sheet a little "wrong" (often too frontal, which a long focal length explains),
 * the rest of the table tells the true perspective better. Returns the camera and what it means: { rms (px, how far
 * from the drawn corners), circleError (mean difference of the ratios), and its setup as cameraFromAngles takes it
 * for the `mode` of the scene: focalMm, zenithDeg, azimuthDeg, rollDeg, distanceCm, sheetCenter }.
 */
export function fitCamera(corners, sheetCm, [W, H], { focalMm, circles = [], mode = 'lie' } = {}) {
  const quad = [corners.tl, corners.tr, corners.br, corners.bl], pp = [W / 2, H / 2];
  const circleError = (cam) => circles.length
    ? Math.sqrt(circles.reduce((sum, [x0, y0, x1, y1]) => sum + (circleRatio(cam, (x0 + x1) / 2, (y0 + y1) / 2) - (y1 - y0) / (x1 - x0)) ** 2, 0) / circles.length)
    : 0;
  const score = (c) => (circles.length ? c.circleError * 1000 + c.rms * 1e-3 : c.rms);
  let cam;
  const candidates = focalMm ? [focalMm] : Array.from({ length: FOCAL_RANGE_MM[1] - FOCAL_RANGE_MM[0] + 1 }, (_, i) => FOCAL_RANGE_MM[0] + i);
  for (const mm of candidates) {
    const c = cameraFor(quad, sheetCm, focalPx(mm, W, H), pp);
    c.circleError = circleError(c);
    if (!cam || score(c) < score(cam)) cam = c;
  }
  const angles = cameraAngles(cam, sheetCm, mode);
  return {
    ...cam,
    focalMm: +angles.focalMm.toFixed(1),
    zenithDeg: +angles.zenithDeg.toFixed(1),
    azimuthDeg: +angles.azimuthDeg.toFixed(1),
    rollDeg: +angles.rollDeg.toFixed(1),
    distanceCm: +angles.distanceCm.toFixed(1),
    sheetCenter: angles.sheetCenter.map(Math.round),
  };
}

/** The rotation (rows) that turns the axis of a camera (0, 0, 1) into the unit direction d. Self-contained (prototypes). */
export function aimRotation(d) {
  const c = d[2], k = [-d[1], d[0], 0]; // e_z × d: the axis times the sine
  const K = [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]];
  const s = 1 / (1 + c);
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + K[i][j] + s * (K[i][0] * K[0][j] + K[i][1] * K[1][j] + K[i][2] * K[2][j])));
}

/**
 * The camera { f, pp, R, t } (as `project` takes it) of an image W × H described by how a photographer would set it up
 * over a sheet SW × SH cm: `focalMm` (35 mm equivalent), `distanceCm` from the middle of the sheet, `zenithDeg` (the
 * angle between the ray to the middle of the sheet and the normal of the sheet: 0 = straight at it), `azimuthDeg`
 * (from where: 0 = in front of the bottom edge, 90 = from the right, -90 = from the left), `rollDeg` (the camera
 * turned around its axis: 0 = level, i.e. the horizon of a lying sheet or the top of a standing one horizontal) and
 * `sheetCenter` (where the middle of the sheet is in the image, px; the middle of the image if missing). `mode` is
 * the mode of the scene: lie (the up of the world is the normal of the sheet) or stand (it is the top of the sheet).
 * Self-contained: the prototypes copy it as text.
 */
export function cameraFromAngles({ focalMm, zenithDeg, azimuthDeg, rollDeg = 0, distanceCm, sheetCenter }, [SW, SH], [W, H], mode = 'lie') {
  const rad = Math.PI / 180, unitOf = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = focalMm / 43.27 * Math.hypot(W, H), pp = [W / 2, H / 2];
  const th = zenithDeg * rad, ph = azimuthDeg * rad;
  // from the middle of the sheet towards the camera (the plane: x right, y down the sheet, z away from the camera)
  const w = [Math.sin(th) * Math.sin(ph), Math.sin(th) * Math.cos(ph), -Math.cos(th)];
  const C = [SW / 2 + distanceCm * w[0], SH / 2 + distanceCm * w[1], distanceCm * w[2]];
  const z = w.map((v) => -v);
  // level: the right of the camera is horizontal, i.e. perpendicular to the up of the world
  const levelBy = (up) => { const k = up[0] * z[0] + up[1] * z[1] + up[2] * z[2]; return up.map((v, i) => v - k * z[i]); };
  let u = levelBy(mode === 'stand' ? [0, -1, 0] : [0, 0, -1]);
  if (Math.hypot(...u) < 1e-6) u = levelBy([0, -1, 0]); // straight down on a lying sheet: its top is up
  const y0 = unitOf(u).map((v) => -v), x0 = cross(y0, z);
  const r = rollDeg * rad, c = Math.cos(r), s = Math.sin(r);
  const M = [x0.map((v, i) => c * v + s * y0[i]), y0.map((v, i) => c * v - s * x0[i]), z];
  // aimed so that the middle of the sheet lands on sheetCenter
  const [sx, sy] = sheetCenter ?? pp;
  const Q = aimRotation(unitOf([sx - pp[0], sy - pp[1], f]));
  const R = Q.map((row) => [0, 1, 2].map((j) => row[0] * M[0][j] + row[1] * M[1][j] + row[2] * M[2][j]));
  const t = R.map((row) => -(row[0] * C[0] + row[1] * C[1] + row[2] * C[2]));
  return { f, pp, R, t };
}

/** The setup of a camera (the inverse of cameraFromAngles): { focalMm, zenithDeg, azimuthDeg, rollDeg, distanceCm, sheetCenter }. Self-contained. */
export function cameraAngles({ f, pp, R, t }, [SW, SH], mode = 'lie') {
  const deg = 180 / Math.PI;
  const C = [0, 1, 2].map((j) => -(R[0][j] * t[0] + R[1][j] * t[1] + R[2][j] * t[2]));
  const v = [C[0] - SW / 2, C[1] - SH / 2, C[2]], distanceCm = Math.hypot(...v), w = v.map((x) => x / distanceCm);
  const P = R.map((row, i) => row[0] * SW / 2 + row[1] * SH / 2 + t[i]);
  const sheetCenter = [pp[0] + f * P[0] / P[2], pp[1] + f * P[1] / P[2]];
  const angles = {
    focalMm: f / Math.hypot(2 * pp[0], 2 * pp[1]) * 43.27,
    zenithDeg: Math.acos(Math.max(-1, Math.min(1, -w[2]))) * deg,
    azimuthDeg: Math.atan2(w[0], w[1]) * deg,
    distanceCm,
    sheetCenter,
  };
  // the roll: the right of the camera against the right of the level camera with the same aim
  const R0 = cameraFromAngles({ ...angles, rollDeg: 0 }, [SW, SH], [2 * pp[0], 2 * pp[1]], mode).R;
  const along = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // R = Q·M: the rows of M are the rows of Q^T·R, so compare in the frame before the aim (Q is common to both)
  const Q = aimRotation(P.map((p) => p / Math.hypot(...P)));
  const unaim = (A) => [0, 1].map((i) => [0, 1, 2].map((j) => Q[0][i] * A[0][j] + Q[1][i] * A[1][j] + Q[2][i] * A[2][j]));
  const [mx] = unaim(R), [m0x, m0y] = unaim(R0);
  return { ...angles, rollDeg: Math.atan2(along(mx, m0y), along(mx, m0x)) * deg };
}

/**
 * How far (px) a line of the image ([[x, y], [x, y]]) is from going where the camera says lines of its direction go:
 * the edges of the support (table, easel board) along x (the width of the sheet) or y (its height) all meet in the
 * vanishing point of that direction. The distance of the ends of the line from the line through its middle and the
 * vanishing point (0 = it points exactly there). Self-contained (prototypes).
 */
export function lineMisfit({ f, pp, R }, axis, [[ax, ay], [bx, by]]) {
  const j = axis === 'y' ? 1 : 0;
  const v = [f * R[0][j] + pp[0] * R[2][j], f * R[1][j] + pp[1] * R[2][j], R[2][j]]; // homogeneous: may be at infinity
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const dx = v[0] - mx * v[2], dy = v[1] - my * v[2], l = Math.hypot(dx, dy);
  if (l < 1e-12) return 0;
  return Math.abs((dx * (by - my) - dy * (bx - mx)) / l);
}

/**
 * The camera of a scene from the edges of its support: `lines` { x: [...], y: [...] } are straight edges of the table
 * or the easel board in the image ([[x, y], [x, y]] each), x along the width of the sheet, y along its height; parallel
 * edges meet in one vanishing point, which fixes how the camera is turned and (with both directions) its focal length.
 * The drawn sheet (`corners`, a rectangle `sheetCm` that may lie turned by `sheetDeg` on the support) gives where and
 * how far, with a small weight (generators draw it inexactly), round things (`circles`) help the focal length; a fixed
 * `focalMm` is kept, else it stays within `focalRange` (mm). `weights` of the hints: px of a line, px of a drawn
 * corner, a difference of circle ratios. Starts from the setup `start` (cameraFromAngles) and returns the best setup with sheetDeg and how
 * well it fits: { setup, sheetDeg, lineRms (px), lines: misfit of each line (px) by group, rms (px of the corners) }.
 * Self-contained (prototypes): needs cameraFromAngles, aimRotation, project, unproject, circleRatio and lineMisfit.
 */
export function fitCameraToLines({ lines = {}, corners, sheetCm, imageSize, mode = 'lie', circles = [], focalMm }, start, { weights = { line: 1, corner: 0.25, circle: 200 }, focalRange = [24, 70] } = {}) {
  const [SW, SH] = sheetCm, quad = [corners.tl, corners.tr, corners.br, corners.bl];
  const keys = ['focalMm', 'zenithDeg', 'azimuthDeg', 'rollDeg', 'distanceCm'];
  const toSetup = (q) => ({ focalMm: focalMm ?? q[0], zenithDeg: q[1], azimuthDeg: q[2], rollDeg: q[3], distanceCm: q[4], sheetCenter: [q[5], q[6]] });
  const all = ['x', 'y'].flatMap((axis) => (lines[axis] ?? []).map((line) => [axis, line]));
  const residuals = (q) => {
    const cam = cameraFromAngles(toSetup(q), sheetCm, imageSize, mode);
    const a = q[7] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const r = all.map(([axis, line]) => weights.line * lineMisfit(cam, axis, line));
    [[-SW / 2, -SH / 2], [SW / 2, -SH / 2], [SW / 2, SH / 2], [-SW / 2, SH / 2]].forEach(([x, y], i) => {
      const [px, py] = project(cam, SW / 2 + x * c - y * s, SH / 2 + x * s + y * c);
      r.push(weights.corner * (px - quad[i][0]), weights.corner * (py - quad[i][1]));
    });
    for (const [x0, y0, x1, y1] of circles) r.push(weights.circle * (circleRatio(cam, (x0 + x1) / 2, (y0 + y1) / 2) - (y1 - y0) / (x1 - x0)));
    return r;
  };
  const sumSq = (r) => r.reduce((sum, v) => sum + v * v, 0);
  const solveLinear = (A, b) => {
    const n = b.length, M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[piv][col])) piv = row;
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let row = 0; row < n; row++) if (row !== col && M[col][col] !== 0) {
        const k = M[row][col] / M[col][col];
        for (let j = col; j <= n; j++) M[row][j] -= k * M[col][j];
      }
    }
    return M.map((row, i) => (row[i] === 0 ? 0 : row[n] / row[i]));
  };
  let q = [...keys.map((k) => start[k] ?? 0), ...(start.sheetCenter ?? [imageSize[0] / 2, imageSize[1] / 2]), start.sheetDeg ?? 0];
  if (focalMm) q[0] = focalMm;
  const free = q.map((_, i) => !(i === 0 && focalMm));
  const steps = [0.05, 0.01, 0.01, 0.01, 0.05, 0.1, 0.1, 0.01];
  let r = residuals(q), cost = sumSq(r), lambda = 1e-3;
  for (let it = 0; it < 200; it++) {
    const J = r.map(() => []);
    q.forEach((_, k) => {
      const e = [...q];
      e[k] += steps[k];
      const rk = free[k] ? residuals(e) : r;
      rk.forEach((v, i) => { J[i][k] = (v - r[i]) / steps[k]; });
    });
    const n = q.length;
    const A = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => J.reduce((sum, row) => sum + row[a] * row[b], 0)));
    const g = Array.from({ length: n }, (_, a) => -J.reduce((sum, row, i) => sum + row[a] * r[i], 0));
    let improved = false;
    while (lambda < 1e9) {
      const d = solveLinear(A.map((row, a) => row.map((v, b) => v + (a === b ? lambda * (v + 1e-9) : 0))), g);
      const next = q.map((v, i) => (free[i] ? v + d[i] : v));
      next[0] = Math.min(focalRange[1], Math.max(focalRange[0], next[0]));
      next[1] = Math.min(89, Math.max(0, next[1]));
      next[4] = Math.max(5, next[4]);
      const rn = residuals(next), cn = sumSq(rn);
      if (cn < cost) { improved = cost - cn > 1e-10 * cost; q = next; r = rn; cost = cn; lambda = Math.max(1e-9, lambda / 3); break; }
      lambda *= 4;
    }
    if (!improved) break;
  }
  const setup = toSetup(q);
  const cam = cameraFromAngles(setup, sheetCm, imageSize, mode);
  const misfits = Object.fromEntries(['x', 'y'].map((axis) => [axis, (lines[axis] ?? []).map((line) => lineMisfit(cam, axis, line))]));
  const flat = [...misfits.x, ...misfits.y];
  const a = q[7] * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const d2 = [[-SW / 2, -SH / 2], [SW / 2, -SH / 2], [SW / 2, SH / 2], [-SW / 2, SH / 2]].reduce((sum, [x, y], i) => {
    const [px, py] = project(cam, SW / 2 + x * c - y * s, SH / 2 + x * s + y * c);
    return sum + (px - quad[i][0]) ** 2 + (py - quad[i][1]) ** 2;
  }, 0);
  return {
    setup, sheetDeg: q[7], lines: misfits, rms: Math.sqrt(d2 / 4),
    lineRms: flat.length ? Math.sqrt(flat.reduce((sum, v) => sum + v * v, 0) / flat.length) : 0,
  };
}

const cameras = new WeakMap();
/**
 * The camera of a scene, computed once: its `camera` setup when given (cameraFromAngles; found by hand in the prototype
 * kamera-scen.html), else from the edges of its support when it has `lines` (fitCameraToLines from the camera of
 * the corners), else fitCamera with its corners, size, `focalMm` and `circles`. Besides the camera: its setup
 * (focalMm … sheetCenter), `source` (camera | lines | corners), rms = how far the drawn corners are from it (px),
 * lineRms = how far the edges are from their vanishing points (px).
 */
export function sceneCamera(scene) {
  if (!cameras.has(scene)) {
    const [SW, SH] = scene.sheetCm, { tl, tr, br, bl } = scene.corners;
    const withSetup = (setup, extra) => {
      const c = cameraFromAngles(setup, scene.sheetCm, scene.imageSize, scene.mode);
      const d2 = [[0, 0, tl], [SW, 0, tr], [SW, SH, br], [0, SH, bl]].reduce((sum, [X, Y, p]) => { const [x, y] = project(c, X, Y); return sum + (x - p[0]) ** 2 + (y - p[1]) ** 2; }, 0);
      const lineRms = Math.sqrt(['x', 'y'].flatMap((axis) => (scene.lines?.[axis] ?? []).map((line) => lineMisfit(c, axis, line) ** 2)).reduce((sum, v, _, all) => sum + v / all.length, 0));
      return { ...c, rollDeg: 0, sheetCenter: c.pp, ...setup, rms: Math.sqrt(d2 / 4), lineRms, circleError: 0, ...extra };
    };
    const fitted = () => fitCamera(scene.corners, scene.sheetCm, scene.imageSize, { focalMm: scene.focalMm, circles: scene.circles, mode: scene.mode });
    let cam;
    if (scene.camera) cam = withSetup(scene.camera, { source: 'camera' });
    else if (scene.lines) {
      const fit = fitCameraToLines(scene, fitted());
      cam = withSetup(fit.setup, { source: 'lines', sheetDeg: fit.sheetDeg, rms: fit.rms });
    } else cam = { ...fitted(), source: 'corners' };
    cameras.set(scene, cam);
  }
  return cameras.get(scene);
}

/**
 * A sheet standing on a ledge: its lower edge is hidden behind the front rail, so the plane goes further down than
 * the visible sheet. How far (cm of the plane): the side edges of the sheet reach the top edge of the rail and go
 * `sinkPx` further (into the groove); the mean of both sides.
 */
export function ledgeDepth(cam, [SW, SH], ledge, sinkPx = 0) {
  const reach = (X) => {
    let lo = SH * 0.5, hi = SH * 3;
    for (let n = 0; n < 60; n++) {
      const m = (lo + hi) / 2, [x, y] = project(cam, X, m);
      if (y > lineY(ledge, x)) hi = m; else lo = m;
    }
    const [ax, ay] = project(cam, X, hi), [bx, by] = project(cam, X, hi + 1);
    return hi + sinkPx / Math.hypot(bx - ax, by - ay);
  };
  return (reach(0) + reach(SW)) / 2;
}

/** Stable number 0 … 1 from a string and a salt. */
export function unit(str, salt = 0) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const v = Math.sin(h * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Casual tilt of a lying work in degrees: its size comes from the id of the work alone (the same in every scene,
 * between minTiltDeg and maxTiltDeg), its direction from the id and the scene (`tiltSign`), so a work turned left
 * on one table lies turned right on the other.
 */
export function tiltDeg(id, scene) {
  const min = scene.minTiltDeg ?? 2, max = scene.maxTiltDeg ?? 7;
  const size = min + unit(id, 1) * (max - min);
  if (!size) return 0; // untilted: parallel to the edges of the table
  const dir = unit(id, 4) < 0.5 ? -1 : 1;
  return dir * (scene.tiltSign ?? 1) * size;
}

export function insidePolygon([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
export function polygonDistance(pt, poly) {
  return Math.min(...poly.map((a, i) => segmentDistance(pt, a, poly[(i + 1) % poly.length])));
}

/** Does the quad of a work (image px) stay inside `bounds` and clear of every prop (with `margin` px)? */
export function quadFits(quad, { bounds, props = [], margin = 0 }) {
  if (bounds) {
    const [x0, y0, x1, y1] = bounds;
    if (quad.some(([x, y]) => x < x0 || x > x1 || y < y0 || y > y1)) return false;
  }
  for (let u = 0; u <= 1.0001; u += 0.05) for (let v = 0; v <= 1.0001; v += 0.05) {
    const top = [quad[0][0] + (quad[1][0] - quad[0][0]) * u, quad[0][1] + (quad[1][1] - quad[0][1]) * u];
    const bottom = [quad[3][0] + (quad[2][0] - quad[3][0]) * u, quad[3][1] + (quad[2][1] - quad[3][1]) * u];
    const pt = [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v];
    if (props.some((poly) => insidePolygon(pt, poly) || (margin && polygonDistance(pt, poly) < margin))) return false;
  }
  return !props.some((poly) => poly.some((pt) => insidePolygon(pt, quad)));
}

/**
 * The geometry of a scene: plane (cm) <-> image (px) through the camera of the scene (`sceneCamera`), at height h
 * (cm towards the camera, 0 = the table or the board). The plane is the sheet (origin at its top left corner);
 * a standing scene reaches down to the ledge (`height` is then more than the sheet).
 */
export function sceneGeometry(scene) {
  const [SW, SH] = scene.sheetCm;
  const camera = sceneCamera(scene);
  const height = scene.mode === 'stand' && scene.ledge ? ledgeDepth(camera, scene.sheetCm, scene.ledge, scene.sinkPx ?? 0) : SH;
  const sheet = [scene.corners.tl, scene.corners.tr, scene.corners.br, scene.corners.bl];
  return {
    width: SW, height, camera,
    toPlane: (x, y, h = 0) => unproject(camera, x, y, h), toImage: (X, Y, h = 0) => project(camera, X, Y, h),
    // where the generated sheet really is (its brightness = the light of the scene)
    sheetPlane: homography(sheet, [[0, 0], [SW, 0], [SW, SH], [0, SH]]),
  };
}

const placements = new WeakMap();
/**
 * Where a work of `sizeCm` (with its `id`) goes in a scene, as renderScene places it, without drawing anything (cached):
 * the pipeline asks before drawing, a work that does not fit (`fits: false`) gets no photo of that scene.
 */
export function scenePlacement(scene, sizeCm, id) {
  if (!placements.has(scene)) placements.set(scene, new Map());
  const known = placements.get(scene), key = JSON.stringify([sizeCm, id]);
  if (!known.has(key)) known.set(key, planPlacement(scene, sceneGeometry(scene), sizeCm, id));
  return known.get(key);
}

/** The four corners (image px) of a work of `sizeCm` with its middle at (cx, cy) cm of the plane, turned by `deg`. */
export function workQuad(geo, [w, h], cx, cy, deg) {
  const a = deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([px, py]) => {
    const x = px - w / 2, y = py - h / 2;
    return geo.toImage(cx + x * cos - y * sin, cy + x * sin + y * cos);
  });
}

/**
 * The turn (degrees in the plane) of a work with its middle at (cx, cy) cm that faces the viewer: its bottom edge
 * level in the photo (along the rows of the image there), whatever the edges of the table do.
 */
export function facingDeg(geo, cx, cy) {
  const [x, y] = geo.toImage(cx, cy), [X, Y] = geo.toPlane(x + 10, y);
  return Math.atan2(Y - cy, X - cx) * 180 / Math.PI;
}

/**
 * Where a work goes in a scene: { cx, cy (cm of the plane), deg, shift: [dx, dy] cm, extraDeg, fits }.
 * Standing: on the ledge, centred on the axis of the easel. Lying: around `center` with a casual shift from the id,
 * facing the viewer (facingDeg: its bottom edge level in the photo) and from there turned by the casual tilt of the id
 * (tiltDeg); when it would leave the free part of the table or cover a prop, the nearest spot that fits wins (facing
 * the viewer there too), and only if none does, a bigger or smaller tilt in the same direction (never the other way).
 */
export function planPlacement(scene, geo, sizeCm, id) {
  const [, h] = sizeCm;
  if (scene.mode === 'stand') {
    // on the ledge, centred on the axis, whole within the width of the photo and clear of the props; else it slides
    // along the ledge (the x of the plane) to the nearest such place, at most maxSlideCm; else it stays on the axis and
    // does not fit (`cut`: wider than the photo allows there, the edge of the photo cuts it off)
    const cx = scene.axis ? geo.toPlane(...scene.axis)[0] : geo.width / 2, cy = geo.height - h / 2;
    const photo = [0, -Infinity, scene.imageSize[0], Infinity];
    const at = (dx) => workQuad(geo, sizeCm, cx + dx, cy, 0);
    const placed = (dx, fits) => ({ cx: cx + dx, cy, deg: 0, shift: [dx, 0], extraDeg: 0, fits });
    const limits = { bounds: photo, props: scene.props ?? [], margin: scene.propMarginPx ?? 0 };
    for (let d = 0; d <= (scene.maxSlideCm ?? 0) + 1e-9; d += 0.5) {
      for (const dx of d ? [d, -d] : [0]) if (quadFits(at(dx), limits)) return placed(dx, true);
    }
    return { ...placed(0, false), cut: !quadFits(at(0), { bounds: photo }) };
  }
  const [c0x, c0y] = scene.center ? geo.toPlane(...scene.center) : [geo.width / 2, geo.height / 2];
  const shiftCm = scene.maxShiftCm ?? 0;
  const tilt = tiltDeg(id, scene);
  const px = c0x + (unit(id, 2) * 2 - 1) * shiftCm, py = c0y + (unit(id, 3) * 2 - 1) * shiftCm;
  const pref = { cx: px, cy: py, deg: facingDeg(geo, px, py) + tilt };
  const limits = { bounds: scene.bounds, props: scene.props ?? [], margin: scene.propMarginPx ?? 0 };
  const step = 0.5, reach = 14, tiltPenalty = 0.6;
  let best = null;
  for (let extra = 0; extra <= (scene.maxExtraTiltDeg ?? 8); extra++) {
    for (const sign of extra ? [1, -1] : [1]) {
      const turn = tilt + sign * extra;
      if (tilt === 0 ? turn !== 0 : Math.sign(turn) !== Math.sign(tilt) || Math.abs(turn) < 1) continue; // untilted stays untilted
      for (let dy = -reach; dy <= reach; dy += step) for (let dx = -reach; dx <= reach; dx += step) {
        const score = Math.hypot(dx, dy) + extra * tiltPenalty;
        if (best && score >= best.score) continue;
        const deg = facingDeg(geo, px + dx, py + dy) + turn;
        if (quadFits(workQuad(geo, sizeCm, px + dx, py + dy, deg), limits)) {
          best = { score, cx: px + dx, cy: py + dy, deg, shift: [dx, dy], extraDeg: sign * extra };
        }
      }
    }
    if (best && best.score <= extra * tiltPenalty) break; // nothing with more extra tilt can be closer
  }
  if (!best) return { ...pref, shift: [0, 0], extraDeg: 0, fits: false };
  const { score, ...placement } = best;
  return { ...placement, fits: true };
}

/**
 * The 4:5 window of a scene image (W × H): as large as it fits, `cropTop` of the spare height cut at the top; a small
 * work (narrower than `minFill` of the window) zooms in around itself, at most `maxZoom` times.
 */
export function sceneWindow(W, H, quad, { cropTop = 0.5, minFill = 0, maxZoom = 1, minArea = 0, maxAreaZoom = maxZoom } = {}) {
  let w = W, h = Math.round(W * 5 / 4);
  if (h > H) { h = H; w = Math.round(H * 4 / 5); }
  let left = Math.round((W - w) / 2), top = Math.round((H - h) * cropTop);
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const span = Math.max(...xs) - Math.min(...xs);
  // a small work: closer until it spans minFill of the width (at most maxZoom); a small and narrow one (a strip) also
  // until it covers minArea of the frame (at most maxAreaZoom: the background gets softer, like a shallow depth of field)
  const byWidth = Math.min(maxZoom, (minFill * w) / span);
  // the area of the work itself (shoelace), not of its bounding box: a tilted strip covers far less than its box
  const area = Math.abs(quad.reduce((sum, [x, y], i) => { const [nx, ny] = quad[(i + 1) % quad.length]; return sum + x * ny - nx * y; }, 0)) / 2;
  const byArea = Math.min(maxAreaZoom, Math.sqrt((minArea * w * h) / Math.max(1, area)));
  const zoom = Math.max(1, byWidth, byArea);
  if (zoom > 1) {
    const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
    w = Math.round(w / zoom); h = Math.round(h / zoom);
    left = Math.round(Math.min(Math.max(0, mx - w / 2), W - w));
    top = Math.round(Math.min(Math.max(0, my - h * 0.55), H - h));
  }
  return { left, top, width: w, height: h, zoom };
}

// ---------------------------------------------------------------- loading

/** Scenes from scenes.yaml (+ its text for the fingerprint of a work); images are loaded on first use. */
export async function loadInstagramScenes(dir = INSTAGRAM_SCENES_DIR) {
  const text = await fs.readFile(path.join(dir, 'scenes.yaml'), 'utf8');
  const scenes = await Promise.all(YAML.parse(text).map(async (s) => {
    const sheetPath = path.join(dir, `${s.name}-list.jpg`);
    const { width, height } = await sharp(sheetPath).metadata();
    return { ...s, path: path.join(dir, `${s.name}.jpg`), sheetPath, imageSize: [width, height] };
  }));
  return { scenes, text };
}

const sceneImages = new WeakMap();
async function imagesOf(scene) {
  if (!sceneImages.has(scene)) {
    sceneImages.set(scene, (async () => {
      const ref = await sharp(scene.sheetPath).metadata();
      // the scene without the sheet may come from another generator in another size: the same framing, so resize
      const bg = await sharp(scene.path).removeAlpha().resize(ref.width, ref.height, { fit: 'fill' }).raw().toBuffer();
      const light = await sharp(scene.sheetPath).removeAlpha().blur(2).raw().toBuffer();
      return { W: ref.width, H: ref.height, bg, light };
    })());
  }
  return sceneImages.get(scene);
}

/** The fonts of the site (bundled in fonts/, so the captions look the same everywhere). */
export async function loadFonts(dir = FONTS_DIR) {
  const load = async (file) => {
    const b = await fs.readFile(path.join(dir, file));
    return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  };
  return { serif: await load('CormorantGaramond-Italic.ttf'), sans: await load('WorkSans-Regular.ttf') };
}

const num = (v) => +v.toFixed(2);
const commandData = (c) => {
  if (c.type === 'Z') return 'Z';
  if (c.type === 'M' || c.type === 'L') return `${c.type}${num(c.x)} ${num(c.y)}`;
  if (c.type === 'Q') return `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`;
  return `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`;
};

/**
 * Text as an SVG path (glyph by glyph: opentype.js 2.0 lays out some strings with NaN coordinates).
 * `tracking` = extra px between letters. Returns { d, width }.
 */
export function textPath(font, text, x, y, size, tracking = 0) {
  const glyphs = font.stringToGlyphs(text), scale = size / font.unitsPerEm;
  let d = '', pen = x;
  glyphs.forEach((g, i) => {
    d += g.getPath(pen, y, size).commands.map(commandData).join('');
    const kern = i < glyphs.length - 1 ? font.getKerningValue(g, glyphs[i + 1]) : 0;
    pen += (g.advanceWidth + (Number.isFinite(kern) ? kern : 0)) * scale + (i < glyphs.length - 1 ? tracking : 0);
  });
  return { d, width: pen - x };
}

/** Longest start of `text` (ended with "…") whose width fits `max` px. */
export function fitText(font, text, size, max, tracking = 0) {
  if (textPath(font, text, 0, 0, size, tracking).width <= max) return text;
  let s = text;
  while (s.length > 1 && textPath(font, `${s.trimEnd()}…`, 0, 0, size, tracking).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

// ---------------------------------------------------------------- rendering

/** The image of the work cut by `insetPercent` on every side (imperfect corners leave a strip of the floor). */
export async function insetWork(buf, insetPercent = 0) {
  const meta = await sharp(buf).metadata();
  const l = Math.round(meta.width * insetPercent / 100), t = Math.round(meta.height * insetPercent / 100);
  if (!l && !t) return sharp(buf).ensureAlpha().png().toBuffer();
  return sharp(buf).ensureAlpha().extract({ left: l, top: t, width: meta.width - 2 * l, height: meta.height - 2 * t }).png().toBuffer();
}

/**
 * The caption export: the work on the paper of a palette (margin `padding` of the width around it), under it a thin
 * rule, the title (serif italic) and "technique · size · year" on the left, the address of the site on the right.
 * The caption sits at the bottom edge (Instagram: the same place on every post of the grid); `snug` puts it right
 * under the work and centres both vertically instead, so a wide work leaves no empty band between them (the pin).
 */
export async function renderCaption({ art, work, year, host, colors, fonts, config, xmp, snug = false }) {
  const { width: W, height: H, padding = 0.025, quality = 90 } = config;
  const side = Math.round(W * padding);
  const areaH = H - CAPTION_HEIGHT - 24 - side;
  const inner = await sharp(art).resize({ width: W - 2 * side, height: areaH, fit: 'inside' }).png().toBuffer();
  const im = await sharp(inner).metadata();
  const L = captionLayout({ W, H, side, artHeight: im.height, snug });
  const out = sharp({ create: { width: W, height: H, channels: 3, background: colors.paper } })
    .composite([
      { input: inner, left: Math.round((W - im.width) / 2), top: L.artTop },
      { input: Buffer.from(svgOf(W, H, captionSvg({ W, ruleY: L.ruleY, work, year, host, colors, fonts }))) },
    ]);
  // `xmp`: authorship of a picture published on the site (the Pinterest pin, scripts/lib/image-rights.mjs)
  return (xmp ? out.withXmp(xmp) : out).jpeg({ quality, mozjpeg: true }).toBuffer();
}

/** Room the caption takes under its rule, descenders included (px). */
const CAPTION_BELOW = 116;
/** Gap between the work and the rule of a snug caption (px). */
const SNUG_GAP = 40;

/**
 * Where the work (its top, px) and the rule of the caption lie on a caption export W × H with margin `side` for a
 * work `artHeight` px tall (already fitted). Default: the caption at the bottom edge, the work centred above it.
 * `snug`: the work with the caption right under it, the pair centred vertically (never higher than the margin and
 * never lower than the default).
 */
export function captionLayout({ W, H, side, artHeight, snug = false }) {
  const bottomRule = H - CAPTION_HEIGHT;
  const areaH = bottomRule - 24 - side;
  if (!snug) return { artTop: Math.round(side + (areaH - artHeight) / 2), ruleY: bottomRule };
  const artTop = Math.max(side, Math.round((H - (artHeight + SNUG_GAP + CAPTION_BELOW)) / 2));
  return { artTop, ruleY: Math.min(bottomRule, artTop + artHeight + SNUG_GAP) };
}

/** Height of the caption under the work, from its rule to the bottom edge (px). */
export const CAPTION_HEIGHT = 154;

const svgOf = (W, H, body) => `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>`;

/**
 * The caption as SVG elements, its rule at `ruleY` (it takes CAPTION_HEIGHT - 58 px under the rule, plus descenders):
 * a thin rule, the title (serif italic) and "technique · size · year" on the left, the address of the site on the right.
 */
function captionSvg({ W, ruleY, work, year, host, colors, fonts, scale = 1, left, right, textMax }) {
  // left / right: where the rule and the texts start and end (default 8 % of the width from each side); textMax: the
  // widest the title and the facts may be (the grid keeps them inside its first tile, the address inside the last)
  const x0 = left ?? Math.round(W * 0.08), x1 = right ?? W - x0;
  const titleY = ruleY + 54 * scale, factsY = titleY + 42 * scale;
  const titleSize = 40 * scale, smallSize = 22 * scale, track = 1.5 * scale, trackSmall = 0.5 * scale;
  const hostPath = textPath(fonts.sans, host, 0, 0, smallSize, track);
  const facts = fitText(fonts.sans, captionFacts(work, year), smallSize, textMax ?? x1 - x0 - hostPath.width - 40 * scale, trackSmall);
  const title = fitText(fonts.serif, work.title ?? '', titleSize, textMax ?? x1 - x0);
  return `<line x1="${x0}" x2="${x1}" y1="${ruleY}" y2="${ruleY}" stroke="${colors.line}" stroke-width="${1.5 * scale}"/>
<path d="${textPath(fonts.serif, title, x0, titleY, titleSize).d}" fill="${colors.ink}"/>
<path d="${textPath(fonts.sans, facts, x0, factsY, smallSize, trackSmall).d}" fill="${colors.inkSoft}"/>
<path d="${textPath(fonts.sans, host, x1 - hostPath.width, factsY, smallSize, track).d}" fill="${colors.inkSoft}"/>`;
}

/** Width of the work on the caption export (px) when it has the aspect ratio `ratio` (width / height). */
const captionArtWidth = (ratio, { width: W, height: H, padding = 0.025 }) => {
  const side = Math.round(W * padding);
  return Math.min(W - 2 * side, ratio * (H - CAPTION_HEIGHT - 24 - side));
};

/**
 * Number of slides of the seamless panorama of a work (0 = none): the work over the full height of N slides side by
 * side, so swiping the carousel runs along it. N is the fewest slides (2 … maxSlides) that hold the work at full
 * height; a panorama is made only when it shows the work at least `minGain` × bigger than the caption export
 * (square and portrait works gain too little). `sizeCm` [width, height], so it is known before rendering.
 */
export function panoramaSlides(sizeCm, config) {
  const { panorama = {} } = config;
  const { maxSlides = 3, minGain = 1.4 } = panorama;
  if (!Array.isArray(sizeCm) || !(sizeCm[0] > 0) || !(sizeCm[1] > 0) || maxSlides < 2) return 0;
  const ratio = sizeCm[0] / sizeCm[1];
  const { width: W, height: H } = config;
  const pad = Math.round(W * (config.padding ?? 0.025));
  const fullWidth = ratio * (H - 2 * pad);
  const n = Math.min(maxSlides, Math.max(2, Math.ceil((fullWidth + 2 * pad) / W)));
  const shown = Math.min(fullWidth, n * W - 2 * pad);
  return shown >= minGain * captionArtWidth(ratio, config) ? n : 0;
}

/** Export suffixes of a panorama of `n` slides: "-pano-1" … */
export const panoramaSuffixes = (n) => Array.from({ length: n }, (_, i) => `-pano-${i + 1}`);

/**
 * The slides of the seamless panorama (JPEG buffers, each width × height of the config): the work as big as fits
 * `slides` slides side by side (margin `padding` of the width), centred on the paper, cut at the slide borders.
 */
export async function renderPanorama({ art, colors, slides, config }) {
  const { width: W, height: H, padding = 0.025, quality = 90 } = config;
  const pad = Math.round(W * padding);
  const inner = await sharp(art).resize({ width: slides * W - 2 * pad, height: H - 2 * pad, fit: 'inside' }).png().toBuffer();
  const im = await sharp(inner).metadata();
  const strip = await sharp({ create: { width: slides * W, height: H, channels: 3, background: colors.paper } })
    .composite([{ input: inner, left: Math.round((slides * W - im.width) / 2), top: Math.round((H - im.height) / 2) }])
    .png().toBuffer();
  return Promise.all(Array.from({ length: slides }, (_, i) => sharp(strip)
    .extract({ left: i * W, top: 0, width: W, height: H }).jpeg({ quality, mozjpeg: true }).toBuffer()));
}

/** Layout of a story (9:16): the free zones (Instagram's bars), the work, the caption and the room for a link sticker. */
export const STORY_DEFAULTS = { width: 1080, height: 1920, safeTop: 250, safeBottom: 340, linkSpace: 220 };

/**
 * Where the parts of a story lie for a work of aspect ratio `ratio`: { art: { left, top, width, height }, ruleY,
 * link: { top, height } }. Between the free zone at the top (`safeTop`) and the room for the link sticker above the
 * free zone at the bottom: the work (margin `padding` of the width at the sides) with the caption right under it,
 * centred vertically.
 */
export function storyLayout(ratio, config = {}) {
  const { width: W, height: H, safeTop, safeBottom, linkSpace } = { ...STORY_DEFAULTS, ...config.story };
  const side = Math.round(W * (config.padding ?? 0.025));
  const gap = SNUG_GAP, captionBelow = CAPTION_BELOW;
  const top = safeTop, bottom = H - safeBottom - linkSpace;
  const maxH = bottom - top - gap - captionBelow;
  let width = W - 2 * side, height = Math.round(width / ratio);
  if (height > maxH) { height = maxH; width = Math.round(height * ratio); }
  const artTop = Math.round(top + (maxH - height) / 2);
  return {
    width: W, height: H,
    art: { left: Math.round((W - width) / 2), top: artTop, width, height },
    ruleY: artTop + height + gap,
    link: { top: bottom, height: linkSpace },
  };
}

/**
 * The story export (9:16, JPEG): the work on the paper of a palette with the caption under it and free room for the
 * link sticker under the caption (nothing drawn there: a mark would stay visible beside the sticker).
 */
export async function renderStory({ art, work, year, host, colors, fonts, config }) {
  const { width: aw, height: ah } = await sharp(art).metadata();
  const L = storyLayout(aw / ah, config);
  const inner = await sharp(art).resize({ width: L.art.width, height: L.art.height, fit: 'inside' }).png().toBuffer();
  const im = await sharp(inner).metadata();
  return sharp({ create: { width: L.width, height: L.height, channels: 3, background: colors.paper } })
    .composite([
      { input: inner, left: Math.round((L.width - im.width) / 2), top: L.art.top + Math.round((L.art.height - im.height) / 2) },
      { input: Buffer.from(svgOf(L.width, L.height, captionSvg({ W: L.width, ruleY: L.ruleY, work, year, host, colors, fonts }))) },
    ])
    .jpeg({ quality: config.quality ?? 90, mozjpeg: true })
    .toBuffer();
}

// smooth 1D value noise in 0 … 1 (the rough edge of the paper)
const hash1 = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const noise1 = (t) => { const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f); return hash1(i) * (1 - s) + hash1(i + 1) * s; };
// smooth 2D value noise in 0 … 1 (the gentle waves and the grain of the paper)
const hash2 = (i, j, seed) => { const v = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
export function noise2(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const top = hash2(i, j, seed) * (1 - sx) + hash2(i + 1, j, seed) * sx;
  const bottom = hash2(i, j + 1, seed) * (1 - sx) + hash2(i + 1, j + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/**
 * The sheet of paper of a work in a scene (`paper` of a scene overrides each of them):
 *   thicknessMm  how thick the paper is: its cut edge is drawn as layers of paper under the painted side
 *   liftMm       how high it lies over the table on average (it never lies perfectly flat)
 *   curlMm, curlCm  how much its edges bend up (mm, most at the corners) and how far from the edge that starts (cm)
 *   waveMm, waveCm  how much it bends up (mm) and how long its gentle waves are (cm); waveShade: how much the light shows them
 *   wallLight, wallShade  brightness of the cut edge facing the light / away from it (1 = the painted side)
 *   grain        how much the brightness of the cut edge varies (rough paper)
 *   contact      the soft shadow right under the edge (blur px of the scene, opacity)
 *   underlayCm   0 = the work alone; more = it lies on a blank sheet of paper this much bigger on every side
 */
export const PAPER_DEFAULTS = {
  thicknessMm: 0.6, liftMm: 0.3, curlMm: 1.5, curlCm: 3, waveMm: 1.2, waveCm: 14, waveShade: 1.5,
  wallLight: 0.35, wallShade: 0.65, grain: 0.08, contact: { blurPx: 1.2, opacity: 0.45 }, underlayCm: 0,
};
export const paperOf = (scene) => ({ ...PAPER_DEFAULTS, ...scene.paper, contact: { ...PAPER_DEFAULTS.contact, ...scene.paper?.contact } });

/**
 * How the edge of a work looks in a scene (`meta_edge` of the work, deckle without it): paper with a torn (deckle) or a
 * clean cut edge, thin, gently waved, its corners lifted (`paper` of the scene); or a canvas on a frame: a clean round
 * edge, depthCm thick, flat, its painting going round the frame (the colour of its edge blurred by blurCm).
 */
export const EDGE_KINDS = {
  deckle: { rough: true },
  cut: { rough: false },
  canvas: { rough: false, flat: true, depthCm: 2, blurCm: 0.6, roundCm: 0.3 },
};

/** Bump when the drawing of a scene changes (part of the fingerprint of a work: its scene exports are made again). */
export const SCENE_VERSION = 4;

/**
 * A scene export: the work (`art`, PNG with alpha) placed into the scene at its real size through the camera of the
 * scene, as a sheet of paper with a thickness: lifted a little over the table and gently waved, its cut edge drawn as
 * layers of paper (in true perspective, so only the sides facing the camera show), lit like the blank sheet, with a
 * rough edge, a soft shadow and a contact shadow; things in front of it (rail, palette) kept in front; cropped to 4:5.
 * The window of the scene is drawn straight at the size of the export (sharp even when it zooms in on a small work).
 * Returns { buf, placement, zoom }.
 */
export async function renderScene({ art, work, scene, config }) {
  const { width: OW, height: OH, quality = 90 } = config;
  const { W, H, bg, light } = await imagesOf(scene);
  const geo = sceneGeometry(scene);
  const [wcm, hcm] = work.size_cm;
  const placement = planPlacement(scene, geo, [wcm, hcm], work.id);
  const { cx, cy } = placement;
  const a = placement.deg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const pts = workQuad(geo, [wcm, hcm], cx, cy, placement.deg);
  const win = sceneWindow(W, H, pts, scene);
  const k = OW / win.width; // px of the export per px of the scene
  const cut = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: win.left, top: win.top, width: win.width, height: win.height }).resize(OW, OH, { fit: 'fill' }).raw().toBuffer();
  const [bgOut, lightOut] = await Promise.all([cut(bg), cut(light)]);
  const sceneX = (ox) => win.left + ox / k, sceneY = (oy) => win.top + oy / k;

  const paper = paperOf(scene);
  // a canvas stands its depth over the table (its face up there, its sides down to the table), flat, without a blank sheet
  const kind = EDGE_KINDS[work.meta_edge] ?? EDGE_KINDS.deckle;
  const T = kind.depthCm ?? paper.thicknessMm / 10, lift = kind.depthCm ?? paper.liftMm / 10;
  const wave = kind.flat ? 0 : paper.waveMm / 10, curl = kind.flat ? 0 : paper.curlMm / 10, m = kind.depthCm ? 0 : paper.underlayCm ?? 0;
  // the work at about 1.5 × its size in the export, white balanced: its brightest paper becomes neutral white
  const pxPerCm = k * Math.max(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.hypot(pts[2][0] - pts[3][0], pts[2][1] - pts[3][1])) / wcm;
  const src = await sharp(art).ensureAlpha().resize({ width: Math.max(8, Math.min(8000, Math.round(wcm * pxPerCm * 1.5))) })
    .raw().toBuffer({ resolveWithObject: true });
  const AW = src.info.width, AH = src.info.height, A = src.data;
  const wb = [0, 1, 2].map((c) => {
    const v = [];
    for (let p = 0; p < AW * AH; p += 7) if (A[p * 4 + 3] > 250) v.push(A[p * 4 + c]);
    v.sort((x, y) => x - y);
    return v.length ? 250 / Math.max(1, v[Math.floor(v.length * 0.98)]) : 1;
  });

  // the light of the scene: the brightness of the blank sheet where it was, its mean elsewhere
  const [SW, SH] = scene.sheetCm;
  const inSheet = (X, Y) => X >= 0.5 && Y >= 0.5 && X <= SW - 0.5 && Y <= SH - 0.5;
  const mean = [0, 0, 0];
  let mn = 0;
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
    const [X, Y] = geo.sheetPlane(x, y);
    if (!inSheet(X, Y)) continue;
    for (let c = 0; c < 3; c++) mean[c] += light[(y * W + x) * 3 + c];
    mn++;
  }
  for (let c = 0; c < 3; c++) mean[c] = mn ? mean[c] / mn : scene.paperWhite;
  const lightAt = (ox, oy, c) => {
    const [SX, SY] = geo.sheetPlane(sceneX(ox + 0.5), sceneY(oy + 0.5));
    return Math.min(1.1, (inSheet(SX, SY) ? lightOut[(oy * OW + ox) * 3 + c] : mean[c]) / scene.paperWhite);
  };
  const [lx0, ly0] = scene.lightDir ?? [-1, -1], ln = Math.hypot(lx0, ly0), lx = lx0 / ln, ly = ly0 / ln;

  // the paper: cm of the work (lu, lv from its top left corner) <-> plane, its height over the table and its edge
  const toLocal = (X, Y) => { const dx = X - cx, dy = Y - cy; return [dx * cos + dy * sin + wcm / 2, -dx * sin + dy * cos + hcm / 2]; };
  const seed = unit(work.id, 5) * 100;
  const outer = m > 0 ? [-m, -m, wcm + m, hcm + m] : [0, 0, wcm, hcm];
  const bend = (d) => (d < paper.curlCm ? (1 - Math.max(0, d) / paper.curlCm) ** 2 : 0);
  // the edges bend up, the corners most
  const heightAt = (lu, lv) => lift + wave * noise2(lu / paper.waveCm, lv / paper.waveCm, seed)
    + curl * Math.min(1, 0.6 * (bend(Math.min(lu - outer[0], outer[2] - lu)) + bend(Math.min(lv - outer[1], outer[3] - lv))));
  // where the ray of a scene pixel meets the paper raised by dz (the wavy surface: a few steps of the fixed point)
  const hit = (x, y, dz) => {
    let [X, Y] = geo.toPlane(x, y, lift + dz);
    for (let n = 0; n < 3; n++) { const [lu, lv] = toLocal(X, Y); [X, Y] = geo.toPlane(x, y, heightAt(lu, lv) + dz); }
    return toLocal(X, Y);
  };
  const edge = scene.edge ?? {};
  const rough = kind.rough && edge.roughCm ? { amp: edge.roughCm, freq: edge.roughFreq ?? 3, soft: edge.softCm ?? 0.05 } : null;
  // the edge of the paper eaten away by a noise along it: every side its own pattern, every layer of the cut edge a bit
  // different (an imperfect, hand-torn look)
  const roughEdge = (lu, lv, [u0, v0, u1, v1], salt = 0) => {
    const eu = Math.min(lu - u0, u1 - lu), ev = Math.min(lv - v0, v1 - lv), d = Math.min(eu, ev);
    if (d < 0) return 0;
    if (!rough || d >= rough.amp * 2) return 1;
    const t = (eu < ev ? lv + (lu < (u0 + u1) / 2 ? 0 : 500) : lu + (lv < (v0 + v1) / 2 ? 1000 : 1500)) + salt;
    const n = noise1(t * rough.freq) * 0.65 + noise1(t * rough.freq * 3.7 + 77) * 0.35;
    return Math.max(0, Math.min(1, (d - rough.amp * n) / rough.soft));
  };
  const artAt = (lu, lv) => {
    const u = lu / wcm * AW, v = lv / hcm * AH;
    if (u < 0 || v < 0 || u >= AW - 1 || v >= AH - 1) return null;
    const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
    return [0, 1, 2, 3].map((c) => {
      const p = (r, q) => A[((iv + r) * AW + iu + q) * 4 + c];
      return (p(0, 0) * (1 - fu) + p(0, 1) * fu) * (1 - fv) + (p(1, 0) * (1 - fu) + p(1, 1) * fu) * fv;
    });
  };
  // the sheets from the bottom: the blank underlay (if any), then the work lying on it
  const sheets = [
    ...(m > 0 ? [{ box: [-m, -m, wcm + m, hcm + m], dz: 0, art: false }] : []),
    { box: [0, 0, wcm, hcm], dz: m > 0 ? T : 0, art: true },
  ];
  const coverage = (sheet, lu, lv, salt) => {
    const r = roughEdge(lu, lv, sheet.box, salt);
    if (!r || !sheet.art) return [r, null];
    const px = artAt(lu, lv);
    return px ? [r * px[3] / 255, px] : [0, null];
  };
  // the waves catch the light: the slope of the paper towards the light makes it brighter
  const waveLight = (lu, lv) => {
    const e = 0.5;
    const du = (heightAt(lu + e, lv) - heightAt(lu - e, lv)) / (2 * e), dv = (heightAt(lu, lv + e) - heightAt(lu, lv - e)) / (2 * e);
    // the slope in the plane: local axes turned back by the tilt of the work
    const gx = du * cos - dv * sin, gy = du * sin + dv * cos;
    return 1 - paper.waveShade * (gx * lx + gy * ly);
  };
  // the colour the cut edge repeats: the work right inside its edge (its paper), for a canvas its painting blurred (the
  // paint goes round the frame); a blank sheet (or a transparent edge) is paper white
  const edgeColour = (sheet, lu, lv) => {
    if (!sheet.art) return [250, 250, 250];
    const [u0, v0, u1, v1] = sheet.box, r = kind.blurCm ?? 0, inset = Math.max(0.1, r);
    const cu = Math.min(u1 - inset, Math.max(u0 + inset, lu)), cv = Math.min(v1 - inset, Math.max(v0 + inset, lv));
    const sum = [0, 0, 0];
    let n = 0;
    for (const du of r ? [-r, 0, r] : [0]) for (const dv of r ? [-r, 0, r] : [0]) {
      const px = artAt(cu + du, cv + dv);
      if (!px || px[3] < 128) continue;
      for (let c = 0; c < 3; c++) sum[c] += px[c] * wb[c];
      n++;
    }
    return n ? sum.map((v) => Math.min(255, v / n)) : [250, 250, 250];
  };
  // the outward normal of the nearest side of a sheet (plane), to light its cut edge
  const sideLight = (lu, lv, [u0, v0, u1, v1]) => {
    const eu = Math.min(lu - u0, u1 - lu), ev = Math.min(lv - v0, v1 - lv);
    const [nu, nv] = eu < ev ? [lu < (u0 + u1) / 2 ? -1 : 1, 0] : [0, lv < (v0 + v1) / 2 ? -1 : 1];
    const facing = (nu * cos - nv * sin) * lx + (nu * sin + nv * cos) * ly;
    return paper.wallShade + paper.wallLight * Math.max(0, facing);
  };

  // the part of the export the paper can reach (all four corners of the biggest sheet at the lowest and highest point)
  const reach = sheets[0].box, top = lift + wave + curl + T * 2;
  const corners = [];
  for (const [u, v] of [[reach[0], reach[1]], [reach[2], reach[1]], [reach[2], reach[3]], [reach[0], reach[3]]]) {
    const X = cx + (u - wcm / 2) * cos - (v - hcm / 2) * sin, Y = cy + (u - wcm / 2) * sin + (v - hcm / 2) * cos;
    for (const h of [0, top]) { const [x, y] = geo.toImage(X, Y, h); corners.push([(x - win.left) * k, (y - win.top) * k]); }
  }
  const ox0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))) - 3), ox1 = Math.min(OW - 1, Math.ceil(Math.max(...corners.map((p) => p[0]))) + 3);
  const oy0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))) - 3), oy1 = Math.min(OH - 1, Math.ceil(Math.max(...corners.map((p) => p[1]))) + 3);
  const layers = Math.min(240, Math.max(2, Math.ceil(T * pxPerCm * 2))); // the cut edge: a layer every half pixel of its height

  const layer = new Float32Array(OW * OH * 4); // premultiplied rgb + alpha of the paper
  const subs = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
  for (let oy = oy0; oy <= oy1; oy++) for (let ox = ox0; ox <= ox1; ox++) {
    const lit = [0, 1, 2].map((c) => lightAt(ox, oy, c));
    const o = (oy * OW + ox) * 4;
    let rgb = [0, 0, 0], al = 0;
    const over = (col, alpha) => { for (let c = 0; c < 3; c++) rgb[c] = col[c] * alpha + rgb[c] * (1 - alpha); al = alpha + al * (1 - alpha); };
    for (const sheet of sheets) {
      // the painted (or blank) side: 4 samples per pixel
      const face = [0, 0, 0], sx = sceneX(ox), sy = sceneY(oy);
      let fa = 0;
      for (const [dx, dy] of subs) {
        const [lu, lv] = hit(sx + dx / k, sy + dy / k, sheet.dz);
        const [cov, px] = coverage(sheet, lu, lv, 0);
        if (!cov) continue;
        const shade = waveLight(lu, lv);
        for (let c = 0; c < 3; c++) face[c] += cov * (px ? px[c] * wb[c] : 250) * lit[c] * shade;
        fa += cov;
      }
      // the cut edge: layers of paper under the face, each a little lower (only where the face does not cover all)
      if (fa < 4) {
        let wa = 0, wall = null;
        for (let j = 1; j <= layers; j++) {
          const [lu, lv] = hit(sx + 0.5 / k, sy + 0.5 / k, sheet.dz - T * j / layers);
          const r = roughEdge(lu, lv, sheet.box, j * 0.07);
          const cov = sheet.art ? r * ((artAt(lu, lv)?.[3] ?? 0) / 255) : r;
          if (cov <= wa) continue;
          wa = cov;
          const g = 1 - paper.grain * noise2(lu * 9, lv * 9 + j, seed);
          wall = { lu, lv, j, shade: sideLight(lu, lv, sheet.box) * g };
        }
        if (wa > 0) {
          // the edge of the work repeated down its side, lit as the side faces the light; a round edge (canvas) turns
          // from the light of the face into it over roundCm
          const round = kind.roundCm ? Math.min(1, T * wall.j / layers / kind.roundCm) : 1;
          const shade = 1 + (wall.shade - 1) * round, col = edgeColour(sheet, wall.lu, wall.lv);
          over(lit.map((l, c) => col[c] * l * shade), wa);
        }
      }
      if (fa > 0) over(face.map((v) => v / fa), fa / 4);
    }
    if (!al) continue;
    for (let c = 0; c < 3; c++) layer[o + c] = rgb[c];
    layer[o + 3] = al;
  }

  const alphaMap = Buffer.alloc(OW * OH);
  for (let p = 0; p < OW * OH; p++) alphaMap[p] = Math.round(layer[p * 4 + 3] * 255);
  const blurred = (sigma) => sharp(alphaMap, { raw: { width: OW, height: OH, channels: 1 } }).blur(Math.max(0.3, sigma)).raw().toBuffer();
  const [shadow, contact] = await Promise.all([blurred(scene.shadow.blur * k), blurred(paper.contact.blurPx * k)]);
  const sdx = Math.round(scene.shadow.dx * k), sdy = Math.round(scene.shadow.dy * k);
  // things in front of the work: the rail of the ledge (everything below its top edge) and the `front` outlines
  let frontMask = null;
  if (scene.front?.length) {
    const svg = `<svg width="${OW}" height="${OH}" xmlns="http://www.w3.org/2000/svg">${scene.front
      .map((poly) => `<polygon points="${poly.map(([x, y]) => `${(x - win.left) * k},${(y - win.top) * k}`).join(' ')}" fill="#fff"/>`).join('')}</svg>`;
    frontMask = await sharp(Buffer.from(svg)).greyscale().blur(Math.max(0.3, 0.8 * k)).raw().toBuffer();
  }
  const out = Buffer.alloc(OW * OH * 3);
  for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
    const p = oy * OW + ox, i = p * 3, o = p * 4;
    let front = scene.ledge ? Math.min(1, Math.max(0, (sceneY(oy + 0.5) - lineY(scene.ledge, sceneX(ox + 0.5))) * k)) : 0;
    if (frontMask) front = Math.max(front, frontMask[p] / 255);
    const sx = ox - sdx, sy = oy - sdy;
    const drop = sx >= 0 && sy >= 0 && sx < OW && sy < OH ? shadow[sy * OW + sx] / 255 * scene.shadow.opacity : 0;
    const s = (1 - (1 - drop) * (1 - contact[p] / 255 * paper.contact.opacity)) * (1 - front);
    const al = layer[o + 3] * (1 - front);
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, Math.round(bgOut[i + c] * (1 - s) * (1 - al) + layer[o + c] * (1 - front))));
  }
  const buf = await sharp(out, { raw: { width: OW, height: OH, channels: 3 } }).jpeg({ quality, mozjpeg: true }).toBuffer();
  return { buf, placement, zoom: win.zoom };
}

// ---------------------------------------------------------------- the text of a post

/** "Plenér, Šumava" -> "plenersumava": a hashtag without "#", diacritics, spaces and punctuation, lower case. */
export const hashtag = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Unique hashtags (with "#") of the given words, in order, empty ones left out. */
const tagLine = (words) => [...new Set(words.map(hashtag).filter(Boolean))].map((t) => `#${t}`).join(' ');

/**
 * The text of an Instagram post of a work (in README.md of its export folder), ready to paste: title, description
 * (not a DOPLNIT placeholder), "technique · size · year", the collection, "na prodej" for a work on sale, the address
 * with the work's id ("pavla.kramolis.cz · jujn2": the gallery search finds the work by it),
 * then the hashtags in Czech (technique, tags, the collection as one word, e.g. #plenersumava2026, `always.cs` of the
 * settings) and in English (their translations from
 * `en`, `always.en`); a word without a translation has only the Czech one. `settings` = instagramPost of
 * site.config.yaml: { always: { cs: [], en: [] }, en: { <Czech word>: <English hashtag> } }.
 */
export function instagramPost({ work, year, host, onSale = false, collection = '', settings = {} }) {
  const description = ownText(work.text);
  const words = [work.technique, ...(Array.isArray(work.tags) ? work.tags : [])].filter((w) => typeof w === 'string' && w.trim());
  const en = settings.en ?? {};
  const translated = words.map((w) => en[w] ?? en[w.toLowerCase()]).filter(Boolean);
  const lines = [
    work.title ?? '',
    ...(description ? ['', description] : []),
    '',
    captionFacts(work, year),
    ...(collection ? [`Kolekce: ${collection}`] : []),
    ...(onSale ? ['Obraz je na prodej.'] : []),
    [host, work.id].filter(Boolean).join(' · '),
    '',
    tagLine([...words, ...(collection ? [collection] : []), ...(settings.always?.cs ?? [])]),
    tagLine([...translated, ...(settings.always?.en ?? [])]),
  ];
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

/**
 * Czech words of a work (technique, tags) without an English hashtag in `settings.en` (instagramPost of
 * site.config.yaml), in order, unique.
 */
export function untranslatedWords(work, settings = {}) {
  const en = settings.en ?? {};
  const words = [work?.technique, ...(Array.isArray(work?.tags) ? work.tags : [])].filter((w) => typeof w === 'string' && w.trim());
  return [...new Set(words.filter((w) => !en[w] && !en[w.toLowerCase()]))];
}

// ---------------------------------------------------------------- profile grid (meta_instagram_grid)

/**
 * How a detail photo of aspect ratio `ratio` goes into a frame of `frame` (width / height): 'crop' fills it (centre
 * crop) when that keeps at least `keep` of the photo, otherwise 'whole' (the photo whole on paper).
 */
export const detailLayout = (ratio, frame, keep = 0.75) => (Math.min(ratio, frame) / Math.max(ratio, frame) >= keep ? 'crop' : 'whole');

/**
 * Export suffixes of a detail photo `name` of aspect ratio `ratio` (unknown = its single photo): a detail far from 4:5
 * (detailLayout 'whole') that is wide enough for a panorama (panoramaSlides) becomes the slides "-detail-<name>-pano-1" …
 * of a seamless panorama like the work's own; any other one photo "-detail-<name>".
 */
export function detailSuffixes(name, ratio, config) {
  const one = [`-detail-${name}`];
  if (!(ratio > 0) || detailLayout(ratio, config.width / config.height, config.detailCropKeep) === 'crop') return one;
  const n = panoramaSlides([ratio, 1], config);
  return n ? Array.from({ length: n }, (_, i) => `-detail-${name}-pano-${i + 1}`) : one;
}

/** Bump when the look of the grid changes: works with a grid are made again (part of their fingerprint). */
export const GRID_VERSION = 2;

/** The profile grid: tiles 3:4 (as the grid of a profile shows them), the gap between them (px at the tile width), quality. */
export const GRID_DEFAULTS = { gapPx: 8, minFill: 0.55, previewWidth: 1080, previewGap: '#000000' };

/**
 * The geometry of a profile grid `grid` ({ cols, rows }, parseGrid) for a work of aspect ratio `ratio` (width / height): the whole
 * picture is laid out on one canvas as the profile shows it, tiles side by side with the gap of the grid between them
 * (`gapPx`): a strip under a gap is never on any tile, so the tiles join up on the profile as one photo under a lattice.
 * Returns { cols, rows, tileW, tileH, gap, W, H, tiles: [{ left, top }] (reading order), art: { left, top, width,
 * height }, ruleY, scale (of the caption against a single 1080 photo), fill (the part of the canvas the work covers) }.
 * The caption lies under the work, its title and facts inside the first tile of the bottom row, the address inside its
 * last tile (never across a gap).
 */
export function gridLayout(grid, ratio, config = {}) {
  const { cols, rows } = grid;
  const tileW = config.width ?? 1080, tileH = Math.round(tileW * 4 / 3);
  const gap = Math.round(config.grid?.gapPx ?? GRID_DEFAULTS.gapPx);
  const W = cols * tileW + (cols - 1) * gap, H = rows * tileH + (rows - 1) * gap;
  // the caption grows with the shorter side of the grid: a single row (2 × 1, 3 × 1) would give it too much of its height
  const scale = Math.min(W, H) / 1080 / 1.25;
  const pad = Math.round(W * (config.padding ?? 0.025));
  const captionH = Math.round(CAPTION_HEIGHT * scale);
  const areaW = W - 2 * pad, areaH = H - captionH - Math.round(24 * scale) - pad;
  let width = areaW, height = Math.round(width / ratio);
  if (height > areaH) { height = areaH; width = Math.round(height * ratio); }
  const art = { left: Math.round((W - width) / 2), top: Math.round(pad + (areaH - height) / 2), width, height };
  const list = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) list.push({ left: c * (tileW + gap), top: r * (tileH + gap) });
  return { cols, rows, tileW, tileH, gap, W, H, tiles: list, art, ruleY: H - captionH, scale, fill: (width * height) / (W * H) };
}

/**
 * Name of a tile of `grid` ({ cols, rows }) as an export suffix: "-grid-<order of publishing>-<row>_<column>", e.g.
 * "-grid-09-1_1" for the top left tile of 3x3, published last; `index` in reading order. The order has two digits, so
 * the files sort in the order of publishing.
 */
export const gridTile = ({ cols, rows }, index) =>
  `-grid-${String(cols * rows - index).padStart(2, '0')}-${Math.floor(index / cols) + 1}_${(index % cols) + 1}`;

/** Export suffixes of the tiles of `grid` in reading order (gridTile) and the preview "-grid-preview"; none without one. */
export const gridSuffixes = (grid) => (grid ? [...Array.from({ length: grid.cols * grid.rows }, (_, i) => gridTile(grid, i)), '-grid-preview'] : []);

/**
 * The profile grid of a work: { tiles: [JPEG] (reading order), preview: JPEG (the grid as the profile shows it, the gaps
 * in `previewGap`), layout }. The work on the paper of a palette with the caption under it, cut into tiles 3:4.
 */
export async function renderGrid({ art, work, year, host, colors, fonts, grid, config }) {
  const g = { ...GRID_DEFAULTS, ...config.grid };
  const { width: aw, height: ah } = await sharp(art).metadata();
  const L = gridLayout(grid, aw / ah, config);
  const inner = await sharp(art).resize({ width: L.art.width, height: L.art.height, fit: 'inside' }).png().toBuffer();
  const im = await sharp(inner).metadata();
  const svg = captionSvg({
    W: L.W, ruleY: L.ruleY, work, year, host, colors, fonts, scale: L.scale,
    left: L.art.left, right: L.art.left + L.art.width,
    // the title and the facts within the first column, the address within the last one
    textMax: L.tileW - L.art.left - Math.round(30 * L.scale),
  });
  const canvas = await sharp({ create: { width: L.W, height: L.H, channels: 3, background: colors.paper } })
    .composite([
      { input: inner, left: L.art.left + Math.round((L.art.width - im.width) / 2), top: L.art.top + Math.round((L.art.height - im.height) / 2) },
      { input: Buffer.from(svgOf(L.W, L.H, svg)) },
    ])
    .png().toBuffer();
  const quality = config.quality ?? 90;
  const out = await Promise.all(L.tiles.map((t) => sharp(canvas)
    .extract({ left: t.left, top: t.top, width: L.tileW, height: L.tileH }).jpeg({ quality, mozjpeg: true }).toBuffer()));
  // the preview: the canvas with the gaps painted as the profile shows them
  const gaps = [];
  for (let c = 1; c < L.cols; c++) gaps.push(`<rect x="${c * L.tileW + (c - 1) * L.gap}" y="0" width="${L.gap}" height="${L.H}"/>`);
  for (let r = 1; r < L.rows; r++) gaps.push(`<rect x="0" y="${r * L.tileH + (r - 1) * L.gap}" width="${L.W}" height="${L.gap}"/>`);
  const latticed = await sharp(canvas)
    .composite([{ input: Buffer.from(svgOf(L.W, L.H, `<g fill="${g.previewGap}">${gaps.join('')}</g>`)) }]).png().toBuffer();
  const preview = await sharp(latticed).resize({ width: g.previewWidth }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return { tiles: out, preview, layout: L };
}

/**
 * The texts of the posts of a grid in the order of publishing: the last tile (bottom right) first, the first tile (top
 * left) last, as the newest post of a profile is its top left one. [{ file (export file name), text }]: every tile its
 * title with "díl k/n" and the hashtags of the post; the last one published (top left) the whole text of the post.
 */
export function gridPosts({ work, grid, post, handle = '' }) {
  const tiles = grid.cols * grid.rows;
  const tags = String(post ?? '').trimEnd().split('\n').filter((l) => l.startsWith('#'));
  const where = handle ? `na profilu @${handle}` : 'na profilu';
  return Array.from({ length: tiles }, (_, i) => {
    const k = i + 1;
    const file = `${gridTile(grid, tiles - k).slice(1)}.jpg`;
    if (k === tiles) return { file, text: `${String(post ?? '').trimEnd()}\n` };
    return { file, text: `${work.title ?? ''} · díl ${k}/${tiles}\n\nCelý obraz se skládá z ${tiles} dílů ${where}.\n\n${tags.join('\n')}\n`.replace(/\n{3,}$/, '\n') };
  });
}
