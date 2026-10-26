// The corner editor (npm run corners, scripts/corners.mjs): a local page for clicking the corners of the sheet in the
// master photos of the content repository and writing them into `meta_corners` of their descriptions. Everything
// here is the server's side without the socket (`route` answers one request), so it can be tested; the page is
// scripts/corners.html with the functions of EDITOR_FUNCTIONS copied in as source text, like the prototypes.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { detectFile, masterSize, withCorners } from './corners.mjs';
import { EDGE_DEFAULTS, cornersProblems } from './edges.mjs';
import { slugify, splitExt } from './works.mjs';
import { listMasters } from '../preview.mjs';

/** Pixel points [x, y] of the corners in the photo (tl, tr, br, bl) → a `meta_corners` value (px in from each corner). */
export function pointsToCorners(points, [width, height]) {
  const inward = (v, size) => Math.max(0, Math.min(size, Math.round(v)));
  const [tl, tr, br, bl] = points;
  return {
    photo: [width, height],
    tl: [inward(tl[0], width), inward(tl[1], height)],
    tr: [inward(width - tr[0], width), inward(tr[1], height)],
    br: [inward(width - br[0], width), inward(height - br[1], height)],
    bl: [inward(bl[0], width), inward(height - bl[1], height)],
  };
}

/** A `meta_corners` value → pixel points of its corners in the photo (tl, tr, br, bl); like quad() in edges.mjs. */
export function cornersToPoints(value) {
  const [width, height] = value.photo;
  const { tl, tr, br, bl } = value;
  return [[tl[0], tl[1]], [width - tr[0], tr[1]], [width - br[0], height - br[1]], [bl[0], height - bl[1]]];
}

/** `meta_corners` as YAML lines, as it stands in a description (cornersYaml in corners.mjs, without its imports). */
export function editorYaml(value) {
  return ['meta_corners:', `  photo: [${value.photo.join(', ')}]`, ...['tl', 'tr', 'br', 'bl'].map((k) => `  ${k}: [${value[k].join(', ')}]`)].join('\n');
}

/** The zoom of the loupes after `current` in `levels` (ascending), round and round; `back` = the one before it. */
export function nextZoom(levels, current, back = false) {
  const i = levels.indexOf(current);
  if (i < 0) return levels[0];
  return levels[(i + (back ? levels.length - 1 : 1)) % levels.length];
}

/**
 * The view of the photo ({ scale, x, y }: screen = x + photo × scale) zoomed `factor` times around the screen point
 * [sx, sy], which keeps showing the same place of the photo; the scale stays within 0.02–16.
 */
export function zoomView(view, [sx, sy], factor) {
  const scale = Math.max(0.02, Math.min(16, view.scale * factor));
  const px = (sx - view.x) / view.scale, py = (sy - view.y) / view.scale;
  return { scale, x: sx - px * scale, y: sy - py * scale };
}

/** The index of the corner (points tl, tr, br, bl) nearest to the photo point `p`; the first one on a tie. */
export function nearestCorner(points, [x, y]) {
  let best = 0;
  points.forEach(([u, v], i) => { if (Math.hypot(u - x, v - y) < Math.hypot(points[best][0] - x, points[best][1] - y)) best = i; });
  return best;
}

/**
 * How far the sheet is from an upright rectangle, in photo px, by its sides (points tl, tr, br, bl): `left` = tl and
 * bl apart horizontally, `right` = tr and br horizontally, `top` = tl and tr vertically, `bottom` = bl and br vertically.
 */
export function rectangleDeviation([tl, tr, br, bl]) {
  return {
    left: Math.abs(tl[0] - bl[0]), right: Math.abs(tr[0] - br[0]),
    top: Math.abs(tl[1] - tr[1]), bottom: Math.abs(bl[1] - br[1]),
  };
}

/**
 * How a pair of guides apart by `deviation` photo px looks, on a photo whose longer side is `size` px: { hue, width,
 * alpha }. The same place = green (hue 120) and bold; then through yellow and orange to red at `redShare` of the
 * photo (1 %), from there red and bold.
 */
export function guideStyle(deviation, size, redShare = 0.01) {
  const red = Math.max(1, size * redShare);
  if (deviation === 0) return { hue: 120, width: 2, alpha: 0.9 };
  if (deviation >= red) return { hue: 0, width: 2, alpha: 0.9 };
  return { hue: Math.round(120 * (1 - deviation / red)), width: 1, alpha: 0.6 };
}

/**
 * The photo point `p` of the dragged corner `i` snapped to the guides of the other corners: in each direction to the
 * nearest line of another corner closer than `tolerance` photo px; else unchanged.
 */
export function snapPoint(points, i, [x, y], tolerance) {
  const nearest = (value, axis) => {
    let best = value, distance = tolerance;
    points.forEach((q, j) => { if (j !== i && Math.abs(q[axis] - value) <= distance) { best = q[axis]; distance = Math.abs(q[axis] - value); } });
    return best;
  };
  return [nearest(x, 0), nearest(y, 1)];
}

/** The corner a click at the photo point `p` moves: the chosen one (`active`) with Shift, else the nearest one. */
export function clickTarget(points, p, active, shiftKey) {
  return shiftKey ? active : nearestCorner(points, p);
}

/**
 * What a key press does in the editor (null = nothing, left to the browser): { move: [dx, dy] } the chosen corner
 * in photo px (Shift 10), { pan: [dx, dy] } the photo in screen px with Alt / Option (Shift more), { corner: i },
 * { zoom: factor }, { actual } 1:1, { fit }, { darken }, { guides }, { loupeZoom: 1 | -1 }, { help }. Digits also by the place of
 * the key (`code`): a Czech keyboard gives é ě š č without Shift, its key of 1 is + (zoom). Ctrl / Cmd belong to the
 * browser and to the loupe at the cursor.
 */
export function keyAction({ key, code = '', shiftKey = false, altKey = false, ctrlKey = false, metaKey = false }) {
  if (ctrlKey || metaKey) return null;
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[key]) {
    const step = altKey ? (shiftKey ? 250 : 50) : (shiftKey ? 10 : 1);
    const [dx, dy] = arrows[key].map((d) => d * step);
    return altKey ? { pan: [dx, dy] } : { move: [dx, dy] };
  }
  if (key === '?') return { help: true };
  // '=' is + without Shift on an English keyboard
  if (key === '+' || key === '=') return { zoom: 1.25 };
  if (key === '-') return { zoom: 1 / 1.25 };
  const digit = /^[0-4]$/.test(key) ? Number(key) : /^Digit[0234]$/.test(code) ? Number(code.slice(5)) : null;
  if (digit === 0) return { actual: true };
  if (digit !== null) return { corner: digit - 1 };
  const letter = { f: { fit: true }, d: { darken: true }, g: { guides: true }, z: { loupeZoom: shiftKey ? -1 : 1 } }[key.toLowerCase()];
  return letter ?? null;
}

/**
 * Corners on the wrong side of each other in pixel points (tl, tr, br, bl): a left one (tl, bl) not left of a right
 * one (tr, br), a top one (tl, tr) not above a bottom one (bl, br). [{ corners: [i, j], text }], empty = fine.
 * Only the page needs it: a written value cannot cross, cornersProblems keeps each corner within a quarter of the photo.
 */
export function crossedCorners(points) {
  const keys = ['tl', 'tr', 'br', 'bl'];
  const found = [];
  for (const [l, r] of [[0, 1], [0, 2], [3, 1], [3, 2]]) {
    if (points[l][0] >= points[r][0]) found.push({ corners: [l, r], text: `${keys[l]} není vlevo od ${keys[r]}` });
  }
  for (const [t, b] of [[0, 3], [0, 2], [1, 3], [1, 2]]) {
    if (points[t][1] >= points[b][1]) found.push({ corners: [t, b], text: `${keys[t]} není nad ${keys[b]}` });
  }
  return found;
}

/** Functions of this module the page calculates with, copied into it as source text (self-contained ones). */
export const EDITOR_FUNCTIONS = [pointsToCorners, cornersToPoints, editorYaml, nextZoom, crossedCorners, zoomView, keyAction, nearestCorner, clickTarget, rectangleDeviation, guideStyle, snapPoint];

/**
 * The page of the editor from its `template` (scripts/corners.html) with its settings (`edges`, images.edges) and
 * EDITOR_FUNCTIONS filled in (placeholders as in the prototypes); a missing placeholder is an error.
 */
export function editorPage(template, edges = EDGE_DEFAULTS) {
  const fills = [['/*DATA*/{}', JSON.stringify({ suspicious: edges.suspicious })], ['/*FUNCTIONS*/', EDITOR_FUNCTIONS.map(String).join('\n')]];
  for (const [mark] of fills) if (!template.includes(mark)) throw new Error(`scripts/corners.html: missing ${mark}`);
  return fills.reduce((text, [mark, fill]) => text.replace(mark, () => fill), template);
}

/**
 * The text of a description with `meta_corners` set to `value`, an existing value replaced (withCorners only adds a
 * missing one); nothing else in the file changes. Returns { text, problem }; with a problem the text is the original.
 */
export function replaceCorners(text, value) {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length || !doc.has('meta_corners')) return withCorners(text, value);
  // set in place, never delete: the comment above the first key (the header of the file) belongs to its pair
  const node = doc.createNode(value);
  if (YAML.isMap(node)) for (const pair of node.items) if (YAML.isSeq(pair.value)) pair.value.flow = true;
  doc.set('meta_corners', node);
  const r = withCorners(doc.toString(), value);
  return r.problem ? { text, problem: r.problem } : r;
}

/**
 * The works of the content repository `contentDir` with a master photo, for the list of the page: { key (the
 * photo's path relative to contentDir, also its address in the editor), title, id, draft, corners (the value of
 * meta_corners, null without it) }; sorted by path. A photo without a description is listed too (it cannot be written).
 */
export async function editorWorks(contentDir) {
  const root = path.join(contentDir, 'tvorba');
  const photos = await listMasters(root).catch(() => []);
  return Promise.all(photos.map(async (photo) => {
    const yamlPath = path.join(path.dirname(photo), `${slugify(splitExt(path.basename(photo)).base)}.yaml`);
    const text = await fs.readFile(yamlPath, 'utf8').catch(() => null);
    let data = null;
    try { data = text === null ? null : YAML.parse(text) ?? {}; } catch { data = {}; }
    return {
      key: path.relative(contentDir, photo).split(path.sep).join('/'),
      yaml: text === null ? null : path.relative(contentDir, yamlPath).split(path.sep).join('/'),
      title: data?.title || splitExt(path.basename(photo)).base,
      id: data?.id ?? null,
      draft: data?.meta_draft !== false,
      corners: data?.meta_corners ?? null,
    };
  }));
}

/**
 * Whether a request may be answered: addressed to the editor itself (Host 127.0.0.1 / localhost on its `port`, so no
 * other site gets in by a name pointing here), and a write only from its own page (Origin, if sent, the same).
 */
export function trustedRequest(method, headers, port) {
  const own = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!own.includes(headers.host)) return false;
  if (method !== 'GET' && (!headers.origin || !own.map((h) => `http://${h}`).includes(headers.origin))) return false;
  return true;
}

const json = (status, body) => ({ status, type: 'application/json; charset=utf-8', body: JSON.stringify(body) });

/**
 * One request of the page: { status, type, body }. `page` is the HTML of the editor. Photos are found only among
 * the listed works (never a path from the request).
 *   GET  /                      the page
 *   GET  /api/works             editorWorks
 *   GET  /api/photo?key=…       the master turned by its EXIF, in its full size (JPEG)
 *   GET  /api/detect?key=…      corners detected like the pipeline does ({ value })
 *   POST /api/corners {key, value}  writes meta_corners into the description ({ written, yaml } or { error })
 */
export async function route(contentDir, page, method, url, body = '', { search = EDGE_DEFAULTS.search } = {}) {
  const u = new URL(url, 'http://localhost');
  if (method === 'GET' && u.pathname === '/') return { status: 200, type: 'text/html; charset=utf-8', body: page };
  if (!u.pathname.startsWith('/api/')) return json(404, { error: 'not found' });
  const works = await editorWorks(contentDir);
  if (method === 'GET' && u.pathname === '/api/works') return json(200, works);
  const key = method === 'POST' ? safeJson(body)?.key : u.searchParams.get('key');
  const work = works.find((w) => w.key === key);
  if (!work) return json(404, { error: `unknown photo: ${key}` });
  const file = path.join(contentDir, work.key);
  if (method === 'GET' && u.pathname === '/api/photo') {
    return { status: 200, type: 'image/jpeg', body: await sharp(file).rotate().jpeg({ quality: 92 }).toBuffer() };
  }
  if (method === 'GET' && u.pathname === '/api/detect') return json(200, { value: await detectFile(file, search) });
  if (method === 'POST' && u.pathname === '/api/corners') {
    if (!work.yaml) return json(400, { error: 'the photo has no description yet (npm run images creates it)' });
    const { value } = safeJson(body);
    const { width, height } = await masterSize(file);
    const problems = cornersProblems(value, width, height, work.yaml);
    if (problems.length) return json(400, { error: problems[0] });
    const yamlFile = path.join(contentDir, work.yaml);
    const r = replaceCorners(await fs.readFile(yamlFile, 'utf8'), value);
    if (r.problem) return json(400, { error: `${work.yaml}: ${r.problem}` });
    await fs.writeFile(yamlFile, r.text);
    return json(200, { written: work.yaml, yaml: editorYaml(value) });
  }
  return json(404, { error: 'not found' });
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}
