// Mockups: a work framed and placed into a photo of an interior at its real size.
// Scenes and their calibration live in mockups/scenes.yaml. A work on paper hangs behind a mat in a frame; a canvas on
// a stretcher (meta_edge: canvas) never has a mat: it hangs bare or in the frame the scene gives it (`canvas`).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import YAML from 'yaml';
import { validSize } from './works.mjs';

export const SCENES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mockups');

/** Works whose longer side is at most this many cm are "small": shelf instead of a second wall. */
export const SMALL_CM = 35;
/** Used when a work has no size yet (drafts); a common watercolour format. */
export const DEFAULT_SIZE_CM = [30, 40];

export async function loadScenes(dir = SCENES_DIR) {
  const text = await fs.readFile(path.join(dir, 'scenes.yaml'), 'utf8');
  return { scenes: YAML.parse(text).map((s) => ({ ...s, path: path.join(dir, s.file) })), text };
}

/**
 * How a canvas hangs in a scene without its own `canvas`: a thin floater frame lit from above (a lighter top, a darker
 * bottom), with a dark gap between it and the canvas. frameCm = width of the moulding (0 = no frame, the bare canvas),
 * gapCm = the gap, depthCm = how far the canvas stands off the wall (its shadow falls further and softer).
 */
export const CANVAS_DEFAULTS = { frameCm: 1, gapCm: 1.4, depthCm: 3.5, profile: true };

/** The canvas frame of a scene: its `canvas` over CANVAS_DEFAULTS. */
export const canvasFrame = (scene) => ({ ...CANVAS_DEFAULTS, ...scene.canvas });

/**
 * Frame and mat in cm. A mat grows with the work, standing frames (shelf, desk) get a slimmer one.
 * A canvas (edge 'canvas') has no mat: the frame of the scene for canvases and the gap around it (canvasFrame).
 */
export function frameGeometry([w, h], scene, edge) {
  if (edge === 'canvas') {
    const { frameCm: frame, gapCm: gap } = canvasFrame(scene);
    return { mat: 0, gap, frame, outerW: w + 2 * (gap + frame), outerH: h + 2 * (gap + frame) };
  }
  const long = Math.max(w, h);
  const [minMat, maxMat] = scene.standing ? [3, 6] : [4, 10];
  const mat = Math.min(maxMat, Math.max(minMat, Math.round(long * 0.15 * 2) / 2));
  const frame = scene.frameCm;
  return { mat, frame, outerW: w + 2 * (mat + frame), outerH: h + 2 * (mat + frame) };
}

export const fits = (size, scene, edge) => {
  const g = frameGeometry(size, scene, edge);
  return g.outerW <= scene.maxCm[0] && g.outerH <= scene.maxCm[1];
};

/** Stable small number from a work ID, so each work keeps its scenes between runs. */
export function hashIndex(id, n) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return n ? h % n : 0;
}

/** Scene groups per mockup slot: one slot per mockup, in the order they are shown. */
export const SLOTS = {
  small: [['wall'], ['shelf'], ['desk']],
  large: [['living'], ['wall'], ['hallway']],
};

/**
 * Picks up to `count` different scenes for a work:
 *   small works (longer side ≤ SMALL_CM): a wall, a shelf and a desk,
 *   larger works: a living room, another wall (bedroom, sideboard) and a hallway.
 * Only scenes where the framed work fits are used (a canvas in its own frame, `edge`); missing slots are filled from any
 * fitting scene.
 */
export function pickScenes(sizeCm, id, scenes, { count = 3, edge } = {}) {
  const size = validSize(sizeCm) ? sizeCm : DEFAULT_SIZE_CM;
  const small = Math.max(...size) <= SMALL_CM;
  const groups = small ? SLOTS.small : SLOTS.large;
  const fitting = scenes.filter((s) => fits(size, s, edge));
  const picked = [];
  for (const g of groups) {
    const options = fitting.filter((s) => g.includes(s.group) && !picked.includes(s));
    if (options.length) picked.push(options[hashIndex(id, options.length)]);
  }
  for (const s of fitting) if (picked.length < count && !picked.includes(s)) picked.push(s);
  return picked.slice(0, count);
}

/**
 * Crop around the framed work so that small works do not get lost in a big room.
 * Returns a rectangle inside the scene with the given aspect ratio (width / height; default: the scene's).
 */
export function cropWindow(sceneW, sceneH, rect, { minShare = 0.55, around = 3.2, aspect = sceneW / sceneH } = {}) {
  // The largest window of this aspect that fits into the scene.
  const maxW = Math.min(sceneW, sceneH * aspect);
  const width = Math.round(Math.min(maxW, Math.max(maxW * minShare, rect.width * around, rect.height * around * aspect)));
  const height = Math.min(sceneH, Math.round(width / aspect));
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const left = Math.round(Math.min(sceneW - width, Math.max(0, cx - width / 2)));
  const top = Math.round(Math.min(sceneH - height, Math.max(0, cy - height / 2)));
  return { left, top, width, height };
}

/** Pixel rectangle of the framed work (without shadow) in scene coordinates. */
export function placement(sizeCm, scene, edge) {
  const g = frameGeometry(sizeCm, scene, edge);
  const px = scene.pxPerCm;
  const width = Math.round(g.outerW * px);
  const height = Math.round(g.outerH * px);
  return { ...g, width, height, left: Math.round(scene.anchor.x - width / 2), top: Math.round(scene.anchor.bottom - height) };
}

/**
 * Renders one mockup cropped around the work. `aspect` (width / height) defaults to the scene's;
 * Instagram uses 4 / 5. `edge` = meta_edge of the work ('canvas' hangs without a mat). Returns an encoded image buffer.
 */
export async function renderMockup(masterBuf, sizeCm, scene, { aspect, edge } = {}) {
  const { buf, rect, sceneW, sceneH } = await composeMockup(masterBuf, sizeCm, scene, { edge });
  return sharp(buf).extract(cropWindow(sceneW, sceneH, rect, aspect ? { aspect } : {})).toBuffer();
}

/** The whole scene with the framed work in it, plus where the frame is. `edge` = meta_edge of the work. */
export async function composeMockup(masterBuf, sizeCm, scene, { edge } = {}) {
  const size = validSize(sizeCm) ? sizeCm : DEFAULT_SIZE_CM;
  const px = scene.pxPerCm;
  const canvas = edge === 'canvas';
  const p = placement(size, scene, edge);

  const bg = sharp(scene.path);
  const { width: sceneW, height: sceneH } = await bg.metadata();

  // The framed work as it would look under neutral light.
  const framed = canvas ? await framedCanvas(masterBuf, p, scene) : await framedPaper(masterBuf, p, scene);

  // Light of the room: the wall behind the frame, heavily blurred, multiplied over the frame.
  // Mixed with white by `scene.light` and brightened a bit, because a white mat reflects more than paint.
  const area = clampRect({ left: p.left, top: p.top, width: p.width, height: p.height }, sceneW, sceneH);
  const wall = await sharp(scene.path).extract(area).resize(p.width, p.height, { fit: 'fill' }).blur(Math.max(8, p.width / 6)).toBuffer();
  const a = scene.light;
  const illum = await sharp(wall).linear(a * 1.12, 255 * (1 - a)).toBuffer();
  const lit = await sharp(framed).composite([{ input: illum, blend: 'multiply' }]).png().toBuffer();

  // Soft shadow on the wall. A canvas stands further off the wall than a frame on paper: its shadow falls further,
  // softer and a bit darker (`depthCm` against the 2 cm of a frame).
  const s = scene.shadow;
  const k = canvas ? canvasFrame(scene).depthCm / 2 : 1;
  const blur = Math.max(1, s.blur * px * (canvas ? 0.8 + 0.5 * k : 1));
  const opacity = canvas ? Math.min(0.75, s.opacity * 1.15) : s.opacity;
  const pad = Math.ceil(blur * 3);
  // Two steps on purpose: sharp applies blur before composite within one pipeline.
  const shape = await sharp({ create: { width: p.width + 2 * pad, height: p.height + 2 * pad, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: p.width, height: p.height, channels: 4, background: { r: 20, g: 14, b: 8, alpha: opacity } } }, left: pad, top: pad }])
    .png()
    .toBuffer();
  const shadow = await sharp(shape).blur(blur).png().toBuffer();

  // Things standing in front of the work (a chair back) are copied back from the original photo.
  const occluders = await Promise.all((scene.occluders ?? []).map(async (o) => {
    const r = clampRect(o, sceneW, sceneH);
    return { input: await sharp(scene.path).extract(r).toBuffer(), left: r.left, top: r.top };
  }));
  const buf = await bg
    .composite([
      { input: shadow, left: Math.round(p.left - pad + s.dx * px * k), top: Math.round(p.top - pad + s.dy * px * k) },
      { input: lit, left: p.left, top: p.top },
      ...occluders,
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
  return { buf, rect: p, sceneW, sceneH };
}

/** A work on paper in a frame (`scene.frame`) behind a white mat. */
async function framedPaper(masterBuf, p, scene) {
  const px = scene.pxPerCm;
  const frame = Math.max(2, Math.round(p.frame * px));
  const mat = Math.round(p.mat * px);
  const artW = p.width - 2 * (frame + mat);
  const artH = p.height - 2 * (frame + mat);
  const art = await sharp(masterBuf).resize(artW, artH, { fit: 'fill' }).toBuffer();
  const bevel = Math.max(1, Math.round(mat * 0.06));
  return sharp({ create: { width: p.width, height: p.height, channels: 3, background: scene.frame } })
    .composite([
      { input: { create: { width: p.width - 2 * frame, height: p.height - 2 * frame, channels: 3, background: '#f7f5f0' } }, left: frame, top: frame },
      // Thin shadow line where the mat is cut, so the work sits behind the mat.
      { input: { create: { width: artW + 2 * bevel, height: artH + 2 * bevel, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.18 } } }, left: frame + mat - bevel, top: frame + mat - bevel },
      { input: art, left: frame + mat, top: frame + mat },
    ])
    .png()
    .toBuffer();
}

const box = (width, height, background) => ({ create: { width, height, channels: 4, background } });
const shade = (alpha) => ({ r: 0, g: 0, b: 0, alpha });
const glow = (alpha) => ({ r: 255, g: 255, b: 255, alpha });

/**
 * A canvas on a stretcher: no mat, its edges a touch darker (they turn round the stretcher, away from the light); in
 * the frame of the scene for canvases (canvasFrame: the moulding in `scene.frame`, lit from above with `profile`, and
 * the dark inside of the frame in the gap), or bare with `frameCm: 0`.
 */
async function framedCanvas(masterBuf, p, scene) {
  const px = scene.pxPerCm;
  const { profile } = canvasFrame(scene);
  const frame = p.frame > 0 ? Math.max(2, Math.round(p.frame * px)) : 0;
  const gap = Math.round(p.gap * px);
  const artW = p.width - 2 * (frame + gap);
  const artH = p.height - 2 * (frame + gap);
  const edge = Math.max(2, Math.round(0.35 * px));
  const art = await sharp(masterBuf).resize(artW, artH, { fit: 'fill' })
    .composite([
      { input: box(artW, edge, shade(0.16)), left: 0, top: 0 },
      { input: box(edge, artH, shade(0.12)), left: 0, top: 0 },
      { input: box(edge, artH, shade(0.2)), left: artW - edge, top: 0 },
      { input: box(artW, edge, shade(0.24)), left: 0, top: artH - edge },
    ])
    .png()
    .toBuffer();
  const layers = [];
  if (frame && profile) {
    // light from above: the top and the inner bottom lip catch it, the bottom and the right side turn away
    const line = Math.max(1, Math.round(frame * 0.28));
    const inner = p.width - 2 * frame + 2 * line;
    layers.push(
      { input: box(p.width, line, glow(0.22)), left: 0, top: 0 },
      { input: box(line, p.height, glow(0.1)), left: 0, top: 0 },
      { input: box(line, p.height, shade(0.18)), left: p.width - line, top: 0 },
      { input: box(p.width, line, shade(0.28)), left: 0, top: p.height - line },
      { input: box(inner, line, shade(0.22)), left: frame - line, top: frame - line },
      { input: box(inner, line, glow(0.2)), left: frame - line, top: p.height - frame },
    );
  }
  // the gap of a floater frame: its dark inside, seen between the moulding and the canvas
  if (gap) layers.push({ input: box(p.width - 2 * frame, p.height - 2 * frame, { r: 24, g: 20, b: 17, alpha: 1 }), left: frame, top: frame });
  layers.push({ input: art, left: frame + gap, top: frame + gap });
  return sharp({ create: { width: p.width, height: p.height, channels: 3, background: scene.frame } }).composite(layers).png().toBuffer();
}

const clampRect = (r, w, h) => {
  const left = Math.max(0, Math.min(w - 1, r.left));
  const top = Math.max(0, Math.min(h - 1, r.top));
  return { left, top, width: Math.max(1, Math.min(w - left, r.width)), height: Math.max(1, Math.min(h - top, r.height)) };
};
