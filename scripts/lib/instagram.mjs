// Instagram exports of a work (only with `meta_instagram: true`), all 4:5:
//   <key>-caption-<palette>.jpg  the whole work on the paper of a palette of the site, a caption at the bottom
//                                (title; technique · size · year; the address of the site)
//   <key>-scene-<scene>.jpg      a styled studio photo: the work lying on a table or standing on an easel
//                                (scenes in mockups/instagram/scenes.yaml, see the comments there)
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
import { formatSizeCm } from './works.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const INSTAGRAM_SCENES_DIR = path.join(siteRoot, 'mockups/instagram');
export const FONTS_DIR = path.join(siteRoot, 'fonts');

/** Export suffixes after "<slug>-<id>" for the given palettes and scenes (details are added by the caller). */
export const instagramSuffixes = (paletteIds, sceneNames) => [
  ...paletteIds.map((p) => `-caption-${p}`),
  ...sceneNames.map((s) => `-scene-${s}`),
];

/** "akvarel · 30 × 30 cm · 2026": the facts under the title of the caption (missing ones are left out). */
export const captionFacts = (work, year) => [work.technique, formatSizeCm(work.size_cm), year].filter(Boolean).join(' · ');

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

/** The projective mapping that takes the 4 points `src` to the 4 points `dst`: (x, y) -> [x', y']. */
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return (x, y) => {
    const z = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / z, (h[3] * x + h[4] * y + h[5]) / z];
  };
}

const EDGES = { top: [0, 1], right: [1, 2], bottom: [2, 3], left: [3, 0] };

/**
 * Stronger perspective than the generated sheet shows (generators draw the sheet too "frontal"): the far edge of
 * the quad (corners tl, tr, br, bl) gets shorter by `amount` (0.09 = 9 %) towards its middle; the near edge stays.
 * `keepBottom`: a work standing on a ledge keeps the bottom corner of a side edge on the ledge, only the top moves.
 */
export function converge(quad, farEdge, amount, keepBottom = false) {
  if (!amount) return quad.map((p) => [...p]);
  const [i, j] = EDGES[farEdge];
  const side = keepBottom && (farEdge === 'left' || farEdge === 'right');
  const fixed = side ? (farEdge === 'left' ? i : j) : null; // bl of the left edge, br of the right one
  const anchor = fixed === null ? [(quad[i][0] + quad[j][0]) / 2, (quad[i][1] + quad[j][1]) / 2] : quad[fixed];
  const k = fixed === null ? amount : 2 * amount; // the whole shortening on one end
  return quad.map((p, n) => (n === i || n === j) && n !== fixed
    ? [anchor[0] + (p[0] - anchor[0]) * (1 - k), anchor[1] + (p[1] - anchor[1]) * (1 - k)]
    : [...p]);
}

/** y of the line through the two points of `ledge` at x. */
export const lineY = ([[ax, ay], [bx, by]], x) => ay + (by - ay) * (x - ax) / (bx - ax);

/**
 * A sheet standing on a ledge: its lower edge is hidden behind the front rail, so the detected corners are too high.
 * The side edges are extended down to the top edge of the rail and `sinkPx` further (into the groove).
 * Returns the new quad and how much longer the side edges got (the plane reaches further down by that factor).
 */
export function extendToLedge(quad, ledge, sinkPx = 0) {
  const down = (top, bottom) => {
    const dx = bottom[0] - top[0], dy = bottom[1] - top[1];
    let lo = 0.5, hi = 3;
    for (let n = 0; n < 50; n++) {
      const m = (lo + hi) / 2;
      if (top[1] + m * dy > lineY(ledge, top[0] + m * dx)) hi = m; else lo = m;
    }
    const t = hi + sinkPx / Math.hypot(dx, dy);
    return { p: [top[0] + t * dx, top[1] + t * dy], t };
  };
  const l = down(quad[0], quad[3]), r = down(quad[1], quad[2]);
  return { quad: [[...quad[0]], [...quad[1]], r.p, l.p], factor: (l.t + r.t) / 2 };
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

const segmentDistance = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
export const polygonDistance = (pt, poly) => Math.min(...poly.map((a, i) => segmentDistance(pt, a, poly[(i + 1) % poly.length])));

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
 * The geometry of a scene: plane (cm) <-> image (px). The plane is the sheet (origin at its top left corner);
 * a standing scene reaches down to the ledge (`height` is then more than the sheet).
 */
export function sceneGeometry(scene) {
  const [SW, SH] = scene.sheetCm;
  let quad = [scene.corners.tl, scene.corners.tr, scene.corners.br, scene.corners.bl];
  let height = SH;
  if (scene.mode === 'stand' && scene.ledge) {
    const ext = extendToLedge(quad, scene.ledge, scene.sinkPx ?? 0);
    quad = ext.quad;
    height = SH * ext.factor;
  }
  const placed = converge(quad, scene.farEdge ?? 'top', scene.convergence ?? 0, scene.mode === 'stand');
  const plane = [[0, 0], [SW, 0], [SW, height], [0, height]];
  const sheet = [scene.corners.tl, scene.corners.tr, scene.corners.br, scene.corners.bl];
  return {
    width: SW, height,
    toPlane: homography(placed, plane), toImage: homography(plane, placed),
    // where the generated sheet really is (its brightness = the light of the scene)
    sheetPlane: homography(sheet, [[0, 0], [SW, 0], [SW, SH], [0, SH]]),
  };
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
 * Where a work goes in a scene: { cx, cy (cm of the plane), deg, shift: [dx, dy] cm, extraDeg, fits }.
 * Standing: on the ledge, centred on the axis of the easel. Lying: around `center` with a casual shift and tilt from
 * the id; when it would leave the free part of the table or cover a prop, the nearest spot that fits wins, and only
 * if none does, a bigger or smaller tilt in the same direction (never the other way).
 */
export function planPlacement(scene, geo, sizeCm, id) {
  const [, h] = sizeCm;
  if (scene.mode === 'stand') {
    const cx = scene.axis ? geo.toPlane(...scene.axis)[0] : geo.width / 2;
    return { cx, cy: geo.height - h / 2, deg: 0, shift: [0, 0], extraDeg: 0, fits: true };
  }
  const [c0x, c0y] = scene.center ? geo.toPlane(...scene.center) : [geo.width / 2, geo.height / 2];
  const shiftCm = scene.maxShiftCm ?? 0;
  const pref = { cx: c0x + (unit(id, 2) * 2 - 1) * shiftCm, cy: c0y + (unit(id, 3) * 2 - 1) * shiftCm, deg: tiltDeg(id, scene) };
  const limits = { bounds: scene.bounds, props: scene.props ?? [], margin: scene.propMarginPx ?? 0 };
  const step = 0.5, reach = 14, tiltPenalty = 0.6;
  let best = null;
  for (let extra = 0; extra <= (scene.maxExtraTiltDeg ?? 8); extra++) {
    for (const sign of extra ? [1, -1] : [1]) {
      const deg = pref.deg + sign * extra;
      if (Math.sign(deg) !== Math.sign(pref.deg) || Math.abs(deg) < 1) continue;
      for (let dy = -reach; dy <= reach; dy += step) for (let dx = -reach; dx <= reach; dx += step) {
        const score = Math.hypot(dx, dy) + extra * tiltPenalty;
        if (best && score >= best.score) continue;
        if (quadFits(workQuad(geo, sizeCm, pref.cx + dx, pref.cy + dy, deg), limits)) {
          best = { score, cx: pref.cx + dx, cy: pref.cy + dy, deg, shift: [dx, dy], extraDeg: sign * extra };
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
export function sceneWindow(W, H, quad, { cropTop = 0.5, minFill = 0, maxZoom = 1 } = {}) {
  let w = W, h = Math.round(W * 5 / 4);
  if (h > H) { h = H; w = Math.round(H * 4 / 5); }
  let left = Math.round((W - w) / 2), top = Math.round((H - h) * cropTop);
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const span = Math.max(...xs) - Math.min(...xs);
  const zoom = Math.min(maxZoom, Math.max(1, (minFill * w) / span));
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
  const scenes = YAML.parse(text).map((s) => ({ ...s, path: path.join(dir, `${s.name}.jpg`), sheetPath: path.join(dir, `${s.name}-list.jpg`) }));
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
 */
export async function renderCaption({ art, work, year, host, colors, fonts, config }) {
  const { width: W, height: H, padding = 0.025, quality = 90 } = config;
  const textSide = Math.round(W * 0.08);
  const factsY = H - 58, titleY = factsY - 42, ruleY = titleY - 54;
  const titleSize = 40, smallSize = 22;
  const hostPath = textPath(fonts.sans, host, 0, 0, smallSize, 1.5);
  const facts = fitText(fonts.sans, captionFacts(work, year), smallSize, W - 2 * textSide - hostPath.width - 40, 0.5);
  const title = fitText(fonts.serif, work.title ?? '', titleSize, W - 2 * textSide);
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
<line x1="${textSide}" x2="${W - textSide}" y1="${ruleY}" y2="${ruleY}" stroke="${colors.line}" stroke-width="1.5"/>
<path d="${textPath(fonts.serif, title, textSide, titleY, titleSize).d}" fill="${colors.ink}"/>
<path d="${textPath(fonts.sans, facts, textSide, factsY, smallSize, 0.5).d}" fill="${colors.inkSoft}"/>
<path d="${textPath(fonts.sans, host, W - textSide - hostPath.width, factsY, smallSize, 1.5).d}" fill="${colors.inkSoft}"/>
</svg>`;
  const side = Math.round(W * padding);
  const areaH = ruleY - 24 - side;
  const inner = await sharp(art).resize({ width: W - 2 * side, height: areaH, fit: 'inside' }).png().toBuffer();
  const im = await sharp(inner).metadata();
  return sharp({ create: { width: W, height: H, channels: 3, background: colors.paper } })
    .composite([
      { input: inner, left: Math.round((W - im.width) / 2), top: Math.round(side + (areaH - im.height) / 2) },
      { input: Buffer.from(svg) },
    ])
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

// smooth 1D value noise in 0 … 1 (the rough edge of the paper)
const hash1 = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const noise1 = (t) => { const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f); return hash1(i) * (1 - s) + hash1(i + 1) * s; };

/**
 * A scene export: the work (`art`, PNG with alpha) placed into the scene at its real size, lit like the blank sheet,
 * with a rough, lit edge and a soft shadow, things in front of it (rail, palette) kept in front, cropped to 4:5.
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

  // the work at about 40 px per cm, white balanced: its brightest paper becomes neutral white, the scene colours it
  const src = await sharp(art).ensureAlpha().resize({ width: Math.max(8, Math.round(wcm * 40)) }).raw().toBuffer({ resolveWithObject: true });
  const AW = src.info.width, AH = src.info.height, A = src.data;
  const wb = [0, 1, 2].map((c) => {
    const v = [];
    for (let p = 0; p < AW * AH; p += 7) if (A[p * 4 + 3] > 250) v.push(A[p * 4 + c]);
    v.sort((x, y) => x - y);
    return v.length ? 250 / Math.max(1, v[Math.floor(v.length * 0.98)]) : 1;
  });

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

  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))) - 2), x1 = Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))) + 2);
  const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))) - 2), y1 = Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))) + 2);
  const edge = scene.edge ?? {};
  const rough = edge.roughCm ? { amp: edge.roughCm, freq: edge.roughFreq ?? 3, soft: edge.softCm ?? 0.05 } : null;
  const layer = new Float32Array(W * H * 4); // rgb + alpha of the placed work
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const acc = [0, 0, 0, 0];
    for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const [X, Y] = geo.toPlane(x + sx, y + sy);
      const dx = X - cx, dy = Y - cy;
      const u = (dx * cos + dy * sin + wcm / 2) / wcm * AW, v = (-dx * sin + dy * cos + hcm / 2) / hcm * AH;
      if (u < 0 || v < 0 || u >= AW - 1 || v >= AH - 1) continue;
      const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
      for (let c = 0; c < 4; c++) {
        const p = (r, q) => A[((iv + r) * AW + iu + q) * 4 + c];
        acc[c] += (p(0, 0) * (1 - fu) + p(0, 1) * fu) * (1 - fv) + (p(1, 0) * (1 - fu) + p(1, 1) * fu) * fv;
      }
    }
    let alpha = acc[3] / 4 / 255;
    if (alpha <= 0) continue;
    const [X, Y] = geo.toPlane(x + 0.5, y + 0.5);
    if (rough) {
      // the edge of the paper eaten away by a noise along it: every side its own pattern
      const dx = X - cx, dy = Y - cy;
      const lu = dx * cos + dy * sin + wcm / 2, lv = -dx * sin + dy * cos + hcm / 2;
      const eu = Math.min(lu, wcm - lu), ev = Math.min(lv, hcm - lv), d = Math.min(eu, ev);
      if (d < rough.amp * 2) {
        const t = eu < ev ? lv + (lu < wcm / 2 ? 0 : 500) : lu + (lv < hcm / 2 ? 1000 : 1500);
        const n = noise1(t * rough.freq) * 0.65 + noise1(t * rough.freq * 3.7 + 77) * 0.35;
        alpha *= Math.max(0, Math.min(1, (d - rough.amp * n) / rough.soft));
      }
    }
    const [SX, SY] = geo.sheetPlane(x + 0.5, y + 0.5);
    const i = (y * W + x) * 3, o = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) {
      const l = inSheet(SX, SY) ? light[i + c] : mean[c];
      layer[o + c] = (acc[c] / acc[3] * 255) * wb[c] * Math.min(1.1, l / scene.paperWhite);
    }
    layer[o + 3] = alpha;
  }

  const alphaMap = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) alphaMap[p] = Math.round(layer[p * 4 + 3] * 255);
  // the edge facing the light a little brighter, the other one a little darker
  if (edge.light || edge.shade) {
    const soft = await sharp(alphaMap, { raw: { width: W, height: H, channels: 1 } }).blur(edge.widthPx ?? 1.2).raw().toBuffer();
    const [lx0, ly0] = scene.lightDir ?? [-1, -1], ln = Math.hypot(lx0, ly0), lx = lx0 / ln, ly = ly0 / ln;
    for (let y = Math.max(1, y0 - 4); y < Math.min(H - 1, y1 + 4); y++) for (let x = Math.max(1, x0 - 4); x < Math.min(W - 1, x1 + 4); x++) {
      const p = y * W + x, o = p * 4;
      if (!layer[o + 3]) continue;
      const gx = (soft[p + 1] - soft[p - 1]) / 510, gy = (soft[p + W] - soft[p - W]) / 510, g = Math.hypot(gx, gy);
      if (g < 0.01) continue;
      const dot = (-gx * lx - gy * ly) / g; // outward normal · direction to the light
      const k = 1 + Math.min(1, g * 3) * (dot > 0 ? edge.light ?? 0 : edge.shade ?? 0) * dot;
      for (let c = 0; c < 3; c++) layer[o + c] *= k;
    }
  }
  const shadow = await sharp(alphaMap, { raw: { width: W, height: H, channels: 1 } }).blur(scene.shadow.blur).raw().toBuffer();
  // things in front of the work: the rail of the ledge (everything below its top edge) and the `front` outlines
  let frontMask = null;
  if (scene.front?.length) {
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${scene.front
      .map((poly) => `<polygon points="${poly.map((q) => q.join(',')).join(' ')}" fill="#fff"/>`).join('')}</svg>`;
    frontMask = await sharp(Buffer.from(svg)).greyscale().blur(0.8).raw().toBuffer();
  }
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 3, o = p * 4;
    let front = scene.ledge ? Math.min(1, Math.max(0, y + 0.5 - lineY(scene.ledge, x + 0.5))) : 0;
    if (frontMask) front = Math.max(front, frontMask[p] / 255);
    const sx = x - scene.shadow.dx, sy = y - scene.shadow.dy;
    const s = (sx >= 0 && sy >= 0 && sx < W && sy < H ? shadow[sy * W + sx] / 255 * scene.shadow.opacity : 0) * (1 - front);
    const al = layer[o + 3] * (1 - front);
    for (let c = 0; c < 3; c++) out[i + c] = Math.max(0, Math.min(255, Math.round(bg[i + c] * (1 - s) * (1 - al) + layer[o + c] * al)));
  }
  const win = sceneWindow(W, H, pts, scene);
  const buf = await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: win.left, top: win.top, width: win.width, height: win.height })
    .resize(OW, OH)
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  return { buf, placement, zoom: win.zoom };
}

// ---------------------------------------------------------------- the text of a post

/** "Plenér, Šumava" -> "plenersumava": a hashtag without "#", diacritics, spaces and punctuation, lower case. */
export const hashtag = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Unique hashtags (with "#") of the given words, in order, empty ones left out. */
const tagLine = (words) => [...new Set(words.map(hashtag).filter(Boolean))].map((t) => `#${t}`).join(' ');

/**
 * The text of an Instagram post of a work (in README.md of its export folder), ready to paste: title, description
 * (not a DOPLNIT placeholder), "technique · size · year", the collection, "na prodej" for a work on sale, the address,
 * then the hashtags in Czech (technique, tags, the collection as one word, e.g. #plenersumava2026, `always.cs` of the
 * settings) and in English (their translations from
 * `en`, `always.en`); a word without a translation has only the Czech one. `settings` = instagramPost of
 * site.config.yaml: { always: { cs: [], en: [] }, en: { <Czech word>: <English hashtag> } }.
 */
export function instagramPost({ work, year, host, onSale = false, collection = '', settings = {} }) {
  const description = typeof work.description === 'string' && !/^\s*DOPLNIT/.test(work.description) ? work.description.trim() : '';
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
    host,
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
