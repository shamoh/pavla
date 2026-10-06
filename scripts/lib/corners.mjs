// Corners of the sheet in the descriptions of works (`meta_corners`, see scripts/lib/edges.mjs): part of the
// preparation of the content, like the ids. A work with a master photo and no `meta_corners` gets them detected and
// written into its YAML, a draft as well as a published work, on a branch as well as on main; an existing value is
// only checked, never overwritten (it may have been adjusted by hand).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { CORNER_KEYS, EDGE_DEFAULTS, cornerShares, cornersProblems, cutsSheet, detectCorners, maskSvg, percent, quad } from './edges.mjs';
import { PALETTES } from './palettes.mjs';
import { normalizeMetadata } from './metadata-yaml.mjs';
import { WORK_SCHEMA } from './schema.mjs';

/** Width of the small copy of a master the corners are detected in. */
export const DETECT_WIDTH = 1200;

/** Size of a master as the pipeline sees it (after its EXIF rotation). */
export async function masterSize(file) {
  const meta = await sharp(file).metadata();
  return meta.autoOrient ?? { width: meta.width, height: meta.height };
}

/** Detects the `meta_corners` value of a master photo. */
export async function detectFile(file, search = EDGE_DEFAULTS.search) {
  const { width, height } = await masterSize(file);
  const sw = Math.min(DETECT_WIDTH, width), sh = Math.max(1, Math.round((height / width) * sw));
  const small = await sharp(file).rotate().toColorspace('srgb').removeAlpha().resize(sw, sh, { fit: 'fill' }).raw().toBuffer();
  return detectCorners(small, sw, sh, width, height, search);
}

/**
 * Detected corners for the run summary (Czech, Pavla reads it): the pixels of each corner; a corner cutting more than
 * `limit` (images.edges.suspicious) is marked with how much it cuts, to be checked in the cut preview first.
 */
export function describeCorners(v, limit = EDGE_DEFAULTS.suspicious) {
  if (!cutsSheet(v)) return 'list vyplňuje celou fotku';
  const text = CORNER_KEYS.map((k) => `${k} ${v[k].join('×')}`).join(', ');
  const { shares, suspicious } = cornerShares(v, limit);
  if (!suspicious.length) return text;
  const which = suspicious.map((k) => `${k} ořízne ${percent(shares[k][0], true)} · ${percent(shares[k][1], true)}`).join(', ');
  return `${text} ⚠ PODEZŘELÝ ořez (víc než ${percent(limit, true)}): ${which}; zkontroluj rohy v náhledu`;
}

/**
 * The text of a work's description with `meta_corners` set to `value` (in schema order, with its technical
 * comment, nothing else changed): { text, problem } — with a problem (a file the schema check refuses) the text
 * is the original.
 */
export function withCorners(text, value) {
  const r = normalizeMetadata(text, WORK_SCHEMA, { values: { meta_corners: value } });
  return { text: r.text, problem: r.problem };
}

/**
 * Detects and writes the missing corners of `works` (from prepareContent; their `data` and `text` are updated) and
 * checks the existing ones. Returns { detected: ["<file>: …" (describeCorners)], problems }.
 */
export async function prepareCorners(contentDir, works, { search = EDGE_DEFAULTS.search, suspicious = EDGE_DEFAULTS.suspicious } = {}) {
  const detected = [];
  const problems = [];
  for (const w of works) {
    if (!w.masterPath) continue;
    if (w.data.meta_corners !== undefined) {
      const { width, height } = await masterSize(w.masterPath);
      problems.push(...cornersProblems(w.data.meta_corners, width, height, w.yamlPath));
      continue;
    }
    const value = await detectFile(w.masterPath, search);
    const r = withCorners(w.text, value);
    // a file the schema check refused is already reported by it, and left alone
    if (r.problem) continue;
    await fs.writeFile(path.join(contentDir, w.yamlPath), r.text);
    w.text = r.text;
    w.data = YAML.parse(r.text) ?? {};
    detected.push(`${w.yamlPath}: ${describeCorners(value, suspicious)}`);
  }
  return { detected, problems };
}

/**
 * The master `buf` (oriented, sRGB) with everything outside the corners transparent, fading in over `feather`
 * (EDGE_DEFAULTS, `images.edges` in site.config.yaml); a lossless PNG buffer.
 */
export async function cutOut(buf, value, { inset = EDGE_DEFAULTS.inset, feather = EDGE_DEFAULTS.feather } = {}) {
  const { width, height } = await sharp(buf).metadata();
  const { svg, sigma } = maskSvg(value, width, height, { inset, feather });
  let mask = sharp(Buffer.from(svg)).resize(width, height, { fit: 'fill' }).greyscale();
  if (sigma >= 0.3) mask = mask.blur(sigma);
  const alpha = await mask.extractChannel(0).raw().toBuffer();
  // two steps on purpose: within one pipeline sharp removes the alpha only at its end, after the join
  const rgb = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return sharp(rgb.data, { raw: rgb.info }).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png({ compressionLevel: 2 }).toBuffer();
}

/**
 * Preview of the cut for checking it (a draft): the result on light paper and on dark paper side by side, each with
 * a thin line along the corners, so both floor left over and paper cut away show, and at every corner how much it
 * cuts (horizontally · vertically, % of the photo; red above `suspicious`, images.edges.suspicious). `cut`: the cut
 * master (cutOut), `value`: its corners, `backgrounds`: [light, dark] CSS colours. Returns a JPEG buffer.
 */
export async function cutPreview(cut, value, backgrounds, { width = 800, pad = 24, suspicious = EDGE_DEFAULTS.suspicious } = {}) {
  const { width: W, height: H } = await sharp(cut).metadata();
  const s = width / W, h = Math.round(H * s);
  const small = await sharp(cut).resize(width, h, { fit: 'fill' }).png().toBuffer();
  const points = quad(value, W, H).map(([x, y]) => `${(x * s).toFixed(1)},${(y * s).toFixed(1)}`).join(' ');
  const line = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"><polygon points="${points}" fill="none" stroke="#ff00cc" stroke-width="1" stroke-opacity="0.8"/>${cutLabels(value, width, h, suspicious)}</svg>`);
  const panelW = width + 2 * pad, panelH = h + 2 * pad;
  const panels = await Promise.all(backgrounds.map((background) => sharp({ create: { width: panelW, height: panelH, channels: 3, background } })
    .composite([{ input: small, left: pad, top: pad }, { input: line, left: pad, top: pad }])
    .png()
    .toBuffer()));
  return sharp({ create: { width: panelW * panels.length, height: panelH, channels: 3, background: '#000' } })
    .composite(panels.map((input, i) => ({ input, left: i * panelW, top: 0 })))
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** SVG texts of how much each corner cuts, inside the corners of a width × height preview (none without a cut). */
function cutLabels(value, width, height, limit) {
  if (!cutsSheet(value)) return '';
  const { shares, suspicious } = cornerShares(value, limit);
  const m = 8, size = 14;
  const at = { tl: [m, m + size, 'start'], tr: [width - m, m + size, 'end'], br: [width - m, height - m, 'end'], bl: [m, height - m, 'start'] };
  return CORNER_KEYS.map((k) => {
    const [x, y, anchor] = at[k];
    // white on a dark halo; a suspicious corner red on a white one
    const [fill, halo] = suspicious.includes(k) ? ['#d00000', '#ffffff'] : ['#ffffff', '#000000'];
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="bold" fill="${fill}" stroke="${halo}" stroke-width="3" paint-order="stroke">${percent(shares[k][0], true)} · ${percent(shares[k][1], true)}</text>`;
  }).join('');
}

/** Backgrounds of a cut preview: the paper of the first palette and of the dark one. */
export const PREVIEW_BACKGROUNDS = [PALETTES[0].colors.paper, PALETTES.find((p) => p.scheme === 'dark')?.colors.paper ?? '#1c1a18'];

/**
 * Cut preview (cutPreview) of the master photo `file` with the corners `value`, cut the way the pipeline cuts it
 * (`edges`: images.edges); corners that cut nothing show the photo as it is. Returns a JPEG buffer.
 */
export async function previewOf(file, value, edges) {
  return cutPreview(await cutMaster(file, value, edges), value, PREVIEW_BACKGROUNDS, { suspicious: edges?.suspicious ?? EDGE_DEFAULTS.suspicious });
}

/** The master photo `file` (oriented, sRGB) cut the way the pipeline cuts it; as it is when the corners cut nothing. */
async function cutMaster(file, value, edges) {
  const buf = await sharp(file).rotate().toColorspace('srgb').toBuffer();
  return cutsSheet(value) ? cutOut(buf, value, edges) : buf;
}

/**
 * `buf` (with alpha) cropped to the smallest rectangle holding everything not fully transparent: the cut work keeps
 * all of itself, its transparent surroundings shrink to what a sheet askew needs (none along a straight side).
 * Returns { buf (PNG), left, top, width, height } (the kept region in `buf`); unchanged when nothing is transparent.
 */
export async function trimTransparent(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * channels;
    for (let x = 0; x < width; x++) {
      if (!data[row + x * channels + channels - 1]) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) return { buf, left: 0, top: 0, width, height };
  const region = { left, top, width: right - left + 1, height: bottom - top + 1 };
  if (region.width === width && region.height === height) return { buf, ...region };
  return { buf: await sharp(buf).extract(region).png({ compressionLevel: 2 }).toBuffer(), ...region };
}

/** Colour and label corner of the guides of the cut preview, in the order of images.edges.guides (at most four). */
export const GUIDE_STYLES = [
  { colour: '#00ff66', corner: 'tl' },
  { colour: '#00e5ff', corner: 'tr' },
  { colour: '#ffe600', corner: 'bl' },
  { colour: '#ff00cc', corner: 'br' },
];

/** Problems of images.edges.guides: a list of 1–4 shares, each above 0 and below 0.5. */
export function guidesProblems(shares) {
  const ok = Array.isArray(shares) && shares.length >= 1 && shares.length <= GUIDE_STYLES.length
    && shares.every((s) => typeof s === 'number' && s > 0 && s < 0.5);
  return ok ? [] : [`images.edges.guides must be a list of 1 to ${GUIDE_STYLES.length} shares between 0 and 0.5, e.g. [0.01, 0.03, 0.05, 0.1]`];
}

/**
 * Guide lines of the cut preview (images.edges.guides): lines `share` in from every border of the image, each in its
 * own bright colour, and the corner where its label (guideDistances) goes, one corner each; to read how much
 * surroundings are left.
 */
export const guidesOf = (shares = EDGE_DEFAULTS.guides) => shares.map((share, i) => ({ share, ...GUIDE_STYLES[i] }));

export const GUIDES = guidesOf();

/**
 * Where the lines of each guide cross near its corner, as meta_corners of that corner would hold it: pixels of the
 * photo, from its corner towards the middle, always >= 0 (the trimmed-away surroundings included). `region`: the
 * trimmed image in the photo ({ left, top, width, height }, trimTransparent), `photo`: [width, height]. Each guide
 * is labelled in its own corner, so the labels never overlap.
 */
export function guideDistances(region, [photoWidth, photoHeight], guides = GUIDES) {
  const { left, top, width, height } = region;
  const x = { l: (s) => left + s * width, r: (s) => photoWidth - (left + (1 - s) * width) };
  const y = { t: (s) => top + s * height, b: (s) => photoHeight - (top + (1 - s) * height) };
  return guides.map(({ share, colour, corner }) => ({
    share, colour, corner, at: [Math.round(x[corner[1]](share)), Math.round(y[corner[0]](share))],
  }));
}

/**
 * How much of every side was removed [left, top, right, bottom], in pixels of the photo: `total` (what the trimmed
 * image lacks, region as in guideDistances), `corners` (by the corners alone: the smaller of the two corners of that
 * side, as the edge of the sheet runs between them) and `edges` (the rest: inset and the fully transparent outer part
 * of the feather).
 */
export function removedSides(region, [photoWidth, photoHeight], value) {
  const { left, top, width, height } = region;
  const total = [left, top, photoWidth - left - width, photoHeight - top - height];
  const corners = cutsSheet(value)
    ? [Math.min(value.tl[0], value.bl[0]), Math.min(value.tl[1], value.tr[1]), Math.min(value.tr[0], value.br[0]), Math.min(value.bl[1], value.br[1])]
    : [0, 0, 0, 0];
  return { total, corners, edges: total.map((t, i) => Math.max(0, t - corners[i])) };
}

const sides = ([l, t, r, b]) => `vlevo ${l} · nahoře ${t} · vpravo ${r} · dole ${b} px`;
const px1 = (n) => n.toFixed(1).replace('.', ',');

/**
 * Lines of the info panel of a cut preview (Czech, for people): the size of the photo, of the trimmed image, how much
 * was removed on every side and why (removedSides), the settings of the edge (images.edges: inset, feather) and the
 * meta_corners it was made with. `region` as in guideDistances.
 */
export function cutInfo(region, [photoWidth, photoHeight], value, edges = EDGE_DEFAULTS) {
  const { inset = EDGE_DEFAULTS.inset, feather = EDGE_DEFAULTS.feather } = edges ?? {};
  const short = Math.min(photoWidth, photoHeight);
  const removed = removedSides(region, [photoWidth, photoHeight], value);
  return [
    `Fotka: ${photoWidth} × ${photoHeight} px`,
    `Obrázek po ořezu: ${region.width} × ${region.height} px`,
    `Odstraněno celkem: ${sides(removed.total)}`,
    `z toho rohy (meta_corners): ${sides(removed.corners)}`,
    `z toho inset a prolnutí: ${sides(removed.edges)}`,
    `inset ${percent(inset, true)} = ${px1(inset * short)} px · prolnutí (feather) ${percent(feather, true)} = ${px1(feather * short)} px, z kratší strany ${short} px`,
    'Prolnutí: list přechází do průhlednosti v pásu šířky prolnutí uvnitř rohů,',
    'jeho vnější část je úplně průhledná a odstřihne se také.',
    cutsSheet(value)
      ? `meta_corners: ${CORNER_KEYS.map((k) => `${k} [${value[k].join(', ')}]`).join(' · ')}`
      : 'meta_corners: nic neořezávají',
  ];
}

/**
 * SVG of the info panel in the middle of a width × height preview: a scheme of the photo (removed parts hatched in
 * red, the trimmed image, the quadrilateral of the corners dotted) and the lines of cutInfo below it (`edges`:
 * images.edges).
 */
export function infoPanelSvg(width, height, region, [photoWidth, photoHeight], value, edges) {
  const lines = cutInfo(region, [photoWidth, photoHeight], value, edges);
  const size = Math.max(11, Math.round(width / 75)), lineHeight = Math.round(size * 1.45), pad = Math.round(size * 0.9);
  const textWidth = Math.max(...lines.map((l) => l.length)) * size * 0.58;
  const panelWidth = Math.min(width * 0.94, Math.max(width * 0.4, textWidth + 2 * pad));
  const schemeWidth = Math.min(panelWidth - 2 * pad, width * 0.3);
  const s = schemeWidth / photoWidth, schemeHeight = photoHeight * s;
  const panelHeight = pad + schemeHeight + pad + lines.length * lineHeight + pad * 0.5;
  const px = (width - panelWidth) / 2, py = (height - panelHeight) / 2;
  const sx = px + (panelWidth - schemeWidth) / 2, sy = py + pad;
  const r = (n) => n.toFixed(1);
  const quadPoints = cutsSheet(value)
    ? quad(value, photoWidth, photoHeight).map(([x, y]) => `${r(sx + x * s)},${r(sy + y * s)}`).join(' ')
    : null;
  const texts = lines.map((l, i) => `<text x="${r(px + panelWidth / 2)}" y="${r(sy + schemeHeight + pad + (i + 0.8) * lineHeight)}" text-anchor="middle">${l}</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + '<defs><pattern id="removed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    + '<rect width="6" height="6" fill="#ff4040" fill-opacity="0.25"/><line x1="0" y1="0" x2="0" y2="6" stroke="#ff4040" stroke-width="3"/></pattern></defs>'
    + `<rect x="${r(px)}" y="${r(py)}" width="${r(panelWidth)}" height="${r(panelHeight)}" rx="${pad / 2}" fill="#000" fill-opacity="0.72"/>`
    + `<rect x="${r(sx)}" y="${r(sy)}" width="${r(schemeWidth)}" height="${r(schemeHeight)}" fill="url(#removed)" stroke="#ffffff" stroke-width="1"/>`
    + `<rect x="${r(sx + region.left * s)}" y="${r(sy + region.top * s)}" width="${r(region.width * s)}" height="${r(region.height * s)}" fill="#3a3a3a" stroke="#ffffff" stroke-width="1"/>`
    + (quadPoints ? `<polygon points="${quadPoints}" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 2"/>` : '')
    + `<g font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" fill="#ffffff">${texts.join('')}</g></svg>`;
}

/** SVG texts of guideDistances in their corners of a width × height image, in the colour of their lines. */
export function guideLabelsSvg(width, height, distances) {
  const size = Math.max(12, Math.round(width / 70)), m = Math.round(size * 0.8);
  const place = { tl: [m, m + size, 'start'], tr: [width - m, m + size, 'end'], bl: [m, height - m, 'start'], br: [width - m, height - m, 'end'] };
  const texts = distances.map(({ share, corner, colour, at }) => {
    const [x, y, anchor] = place[corner];
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="bold" fill="${colour}" stroke="#000" stroke-width="${Math.max(3, size / 5)}" paint-order="stroke">${percent(share, true)}: ${corner} [${at.join(', ')}] px</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${texts.join('')}</svg>`;
}

/** SVG of the GUIDES lines over a width × height image: each guide `share` in from all four borders. */
export function gridSvg(width, height, guides = GUIDES) {
  // on whole pixels, so a line is sharp (one pixel, not two half ones)
  const at = (share, size) => Math.min(size - 1, Math.round(share * size)) + 0.5;
  const groups = guides.map(({ share, colour }) => {
    const lines = [share, 1 - share].flatMap((s) => {
      const x = at(s, width), y = at(s, height);
      return [`<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`, `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`];
    });
    return `<g stroke="${colour}" stroke-width="1" stroke-opacity="0.8">${lines.join('')}</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${groups.join('')}</svg>`;
}

/**
 * The cut work alone as the site gets it (trimmed to its smallest transparent surroundings, trimTransparent), at
 * most `width` wide (the largest web size), with lines 1 %, 3 %, 5 % and 10 % in from every border, each in its colour
 * (GUIDES) and in every corner where one of them lies as meta_corners would hold it (guideDistances):
 * a PNG buffer, to look at the cut on any background.
 */
export async function cutImageOf(file, value, edges, { width = 1600 } = {}) {
  const cut = await cutMaster(file, value, edges);
  const full = await sharp(cut).metadata();
  const trimmed = cutsSheet(value) ? await trimTransparent(cut) : { buf: cut, left: 0, top: 0, width: full.width, height: full.height };
  const small = await sharp(trimmed.buf).resize({ width, withoutEnlargement: true }).png().toBuffer();
  const { width: w, height: h } = await sharp(small).metadata();
  const photo = [full.width, full.height];
  const guides = guidesOf(edges?.guides ?? EDGE_DEFAULTS.guides);
  const labels = guideLabelsSvg(w, h, guideDistances(trimmed, photo, guides));
  return sharp(small).composite([{ input: Buffer.from(gridSvg(w, h, guides)) }, { input: Buffer.from(labels) }]).png().toBuffer();
}

/**
 * RGBA overlay (width × height) of the edge of the fully opaque area of `alpha` (one byte per pixel): opaque pixels
 * next to one that is not, widened to `stroke` pixels inwards and outwards, in `colour` [r, g, b].
 */
export function edgeOverlay(alpha, width, height, stroke, [r, g, b]) {
  const n = width * height;
  let mark = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alpha[i] !== 255) continue;
      if ((x > 0 && alpha[i - 1] !== 255) || (x < width - 1 && alpha[i + 1] !== 255)
        || (y > 0 && alpha[i - width] !== 255) || (y < height - 1 && alpha[i + width] !== 255)) mark[i] = 1;
    }
  }
  // widen: a separable square dilation by `reach` pixels
  const reach = Math.max(0, Math.floor((stroke - 1) / 2));
  for (const horizontal of [true, false]) {
    if (!reach) break;
    const next = new Uint8Array(n);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mark[y * width + x]) continue;
        for (let d = -reach; d <= reach; d++) {
          const xx = horizontal ? x + d : x, yy = horizontal ? y : y + d;
          if (xx >= 0 && yy >= 0 && xx < width && yy < height) next[yy * width + xx] = 1;
        }
      }
    }
    mark = next;
  }
  const out = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    if (!mark[i]) continue;
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * The original photo in its full size with everything the cut removes or makes (partly) transparent lightly hatched
 * in the colour of the corner line (the stronger, the more transparent it becomes), the inner border of the hatching
 * (where the work becomes fully opaque) light green, the border of the trimmed image (trimTransparent) as a solid
 * line and, with `info`, the info panel in the middle (infoPanelSvg: a scheme, sizes,
 * what was removed and why, the edge settings, the meta_corners used). A JPEG buffer.
 */
export async function hatchedOriginalOf(file, value, edges, { info = true } = {}) {
  const original = await sharp(file).rotate().toColorspace('srgb').removeAlpha().toBuffer();
  const { width, height } = await sharp(original).metadata();
  const panel = (region) => (info ? [{ input: Buffer.from(infoPanelSvg(width, height, region, [width, height], value, edges)) }] : []);
  if (!cutsSheet(value)) {
    return sharp(original).composite(panel({ left: 0, top: 0, width, height })).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }
  // how transparent the cut makes every pixel: 255 = removed or fully transparent
  const cut = await cutOut(original, value, edges);
  const region = await trimTransparent(cut);
  const alpha = await sharp(cut).extractChannel(3).raw().toBuffer();
  const gap = Math.max(8, Math.round(Math.min(width, height) / 90)), stroke = Math.max(2, Math.round(gap / 4));
  const hatch = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>`
    + `<pattern id="h" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<line x1="0" y1="0" x2="0" y2="${gap}" stroke="#ff00cc" stroke-width="${stroke}"/></pattern></defs>`
    + '<rect width="100%" height="100%" fill="url(#h)"/></svg>';
  const lines = await sharp(Buffer.from(hatch)).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  // lightly: the lines at most 70 % opaque, weighted by how transparent the cut makes the pixel
  for (let i = 0; i < width * height; i++) lines[i * 4 + 3] = Math.round((lines[i * 4 + 3] * (255 - alpha[i]) * 0.7) / 255);
  // the inner border of the hatching, where the work becomes fully opaque: traced on the mask itself
  const opaqueEdge = edgeOverlay(alpha, width, height, stroke, [0x7c, 0xff, 0x7c]);
  // the border of the trimmed image: where the site's image ends
  const half = stroke / 2;
  const border = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<rect x="${region.left + half}" y="${region.top + half}" width="${Math.max(1, region.width - stroke)}" height="${Math.max(1, region.height - stroke)}" fill="none" stroke="#ff00cc" stroke-width="${stroke}"/></svg>`;
  return sharp(original)
    .composite([
      { input: lines, raw: { width, height, channels: 4 } },
      { input: opaqueEdge, raw: { width, height, channels: 4 } },
      { input: Buffer.from(border) },
      ...panel(region),
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** A `meta_corners` value as YAML lines, the way the pipeline writes it into a description (to copy into one). */
export const cornersYaml = (value) => ['meta_corners:', `  photo: [${value.photo.join(', ')}]`, ...CORNER_KEYS.map((k) => `  ${k}: [${value[k].join(', ')}]`)].join('\n');
