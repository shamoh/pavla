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
  let buf = await sharp(file).rotate().toColorspace('srgb').toBuffer();
  if (cutsSheet(value)) buf = await cutOut(buf, value, edges);
  return cutPreview(buf, value, PREVIEW_BACKGROUNDS, { suspicious: edges?.suspicious ?? EDGE_DEFAULTS.suspicious });
}

/** A `meta_corners` value as YAML lines, the way the pipeline writes it into a description (to copy into one). */
export const cornersYaml = (value) => ['meta_corners:', `  photo: [${value.photo.join(', ')}]`, ...CORNER_KEYS.map((k) => `  ${k}: [${value[k].join(', ')}]`)].join('\n');
