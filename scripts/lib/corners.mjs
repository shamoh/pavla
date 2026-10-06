// Corners of the sheet in the descriptions of works (`meta_corners`, see scripts/lib/edges.mjs): part of the
// preparation of the content, like the ids. A work with a master photo and no `meta_corners` gets them detected and
// written into its YAML, a draft as well as a published work, on a branch as well as on main; an existing value is
// only checked, never overwritten (it may have been adjusted by hand).

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import { CORNER_KEYS, EDGE_DEFAULTS, cornerShares, cornersProblems, cutsSheet, detectCorners, insetQuad, maskSvg, percent, quad } from './edges.mjs';
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

/** From which border of the photo each corner cuts: [horizontally, vertically] (Czech, for people). */
const CUT_FROM = { tl: ['zleva', 'shora'], tr: ['zprava', 'shora'], br: ['zprava', 'zdola'], bl: ['zleva', 'zdola'] };

/**
 * Lines of the label of corner `k` of a cut preview: how far in it cuts from each border, as a share of the photo's
 * width / height and in its pixels (the value of meta_corners), e.g. "zleva 2,5 % = 93 px"; `suspicious` per line
 * (more than `limit`, images.edges.suspicious).
 */
export function cutLabelLines(value, k, limit = EDGE_DEFAULTS.suspicious) {
  const { shares } = cornerShares(value, limit);
  return [0, 1].map((axis) => ({
    text: `${CUT_FROM[k][axis]} ${percent(shares[k][axis], true)} = ${value[k][axis]} px`,
    suspicious: shares[k][axis] > limit,
  }));
}

/**
 * SVG texts of how much each corner cuts (cutLabelLines), two lines inside each corner of a width × height preview
 * (none without a cut): white on a dark halo, a suspicious line red on a white one.
 */
function cutLabels(value, width, height, limit) {
  if (!cutsSheet(value)) return '';
  const m = 8, size = 14, row = Math.round(size * 1.3);
  const at = { tl: [m, m + size, 'start'], tr: [width - m, m + size, 'end'], br: [width - m, height - m - row, 'end'], bl: [m, height - m - row, 'start'] };
  return CORNER_KEYS.map((k) => {
    const [x, y, anchor] = at[k];
    return cutLabelLines(value, k, limit).map(({ text, suspicious }, i) => {
      const [fill, halo] = suspicious ? ['#d00000', '#ffffff'] : ['#ffffff', '#000000'];
      return `<text x="${x}" y="${y + i * row}" text-anchor="${anchor}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="bold" fill="${fill}" stroke="${halo}" stroke-width="3" paint-order="stroke">${text}</text>`;
    }).join('');
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

/** Colours of the frame lines (images.edges.guides), in turn, so neighbouring lines always differ. */
export const FRAME_COLOURS = ['#00ff66', '#ffe600', '#00e5ff', '#ff00cc'];

/** Problems of images.edges.guides: a non-empty list of shares, each above 0 and below 0.5. */
export function guidesProblems(shares) {
  const ok = Array.isArray(shares) && shares.length >= 1 && shares.every((s) => typeof s === 'number' && s > 0 && s < 0.5);
  return ok ? [] : ['images.edges.guides must be a list of shares between 0 and 0.5, e.g. [0.002, 0.01, 0.05]'];
}

/**
 * Frame lines of a width × height photo (images.edges.guides): for each share a frame of four lines, the vertical
 * ones `share` of the width in from the left and the right border, the horizontal ones `share` of the height in from
 * the top and the bottom; `x` and `y` are those distances in pixels, as meta_corners counts them. Colours in turn.
 */
export const frameLines = (width, height, shares = EDGE_DEFAULTS.guides) => shares.map((share, i) => ({
  share, colour: FRAME_COLOURS[i % FRAME_COLOURS.length], x: Math.round(share * width), y: Math.round(share * height),
}));

/**
 * SVG of the frame lines (frameLines) over a width × height photo, each labelled with its distance from the nearest
 * border in pixels, in its colour. Labels go in steps (one row or column further for every next line), so they never
 * overlap however close the lines are: those of the vertical lines next to them around the middle of the height,
 * those of the horizontal ones next to them around the middle of the width.
 */
export function framesSvg(width, height, lines) {
  const short = Math.min(width, height);
  const stroke = Math.max(1, Math.round(short / 1500)), size = Math.max(10, Math.round(short / 110)), gap = Math.round(size / 3);
  const row = Math.round(size * 1.25), column = Math.round(size * 0.62 * (`${Math.max(0, ...lines.flatMap((l) => [l.x, l.y]))} px`.length + 1));
  // the middle of a stroke on whole pixels, the stroke covering pixel `d` (counted from 0 at the border)
  const mid = (d) => d + (stroke % 2 ? 0.5 : 0);
  const top = height / 2 - (lines.length * row) / 2 + size, left = width / 2 - (lines.length * column) / 2;
  const text = (x, y, anchor, colour, d) => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${colour}">${d} px</text>`;
  const at = ({ x, y }) => [mid(x), mid(width - 1 - x), mid(y), mid(height - 1 - y)];
  const strokes = lines.map((line) => {
    const [l, r, t, b] = at(line);
    return `<g stroke="${line.colour}" stroke-width="${stroke}"><line x1="${l}" y1="0" x2="${l}" y2="${height}"/><line x1="${r}" y1="0" x2="${r}" y2="${height}"/>`
      + `<line x1="0" y1="${t}" x2="${width}" y2="${t}"/><line x1="0" y1="${b}" x2="${width}" y2="${b}"/></g>`;
  });
  // all the labels over all the lines, so no line crosses a label
  const labels = lines.map((line, i) => {
    const { colour, x, y } = line;
    const [l, r, t, b] = at(line);
    return text(l + stroke + gap, top + i * row, 'start', colour, x) + text(r - stroke - gap, top + i * row, 'end', colour, x)
      + text(left + i * column, t + stroke + gap + size, 'start', colour, y) + text(left + i * column, b - stroke - gap, 'start', colour, y);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${strokes.join('')}`
    + `<g font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="bold" stroke-linejoin="round">`
    + `${labels.join('').replace(/<text /g, `<text stroke="#000" stroke-width="${Math.max(2, Math.round(size / 6))}" paint-order="stroke" `)}</g></svg>`;
}

/**
 * The whole master photo `file` (oriented, never cut, in its full size) with the frame lines of `shares`
 * (images.edges.guides, framesSvg): to read how far in from each border the sheet lies, in the pixels of meta_corners.
 * A JPEG buffer.
 */
export async function framesOf(file, shares = EDGE_DEFAULTS.guides) {
  const photo = await sharp(file).rotate().toColorspace('srgb').removeAlpha().toBuffer();
  const { width, height } = await sharp(photo).metadata();
  return sharp(photo).composite([{ input: Buffer.from(framesSvg(width, height, frameLines(width, height, shares))) }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/**
 * How much of every side was removed [left, top, right, bottom], in pixels of the photo: `total` (what the trimmed
 * image lacks, `region`: the trimmed image in the photo, { left, top, width, height }, trimTransparent), `corners` (by the corners alone: the smaller of the two corners of that
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
 * meta_corners it was made with. `region` as in removedSides.
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
  // the removed parts hatched "/" 6 px apart: plain lines clipped to the scheme (an SVG pattern takes seconds to render)
  const step = 6 * Math.SQRT2, hatch = [];
  for (let k = 0; k < schemeWidth + schemeHeight; k += step) {
    hatch.push(`<line x1="${r(sx + k)}" y1="${r(sy)}" x2="${r(sx + k - schemeHeight)}" y2="${r(sy + schemeHeight)}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<defs><clipPath id="scheme"><rect x="${r(sx)}" y="${r(sy)}" width="${r(schemeWidth)}" height="${r(schemeHeight)}"/></clipPath></defs>`
    + `<rect x="${r(px)}" y="${r(py)}" width="${r(panelWidth)}" height="${r(panelHeight)}" rx="${pad / 2}" fill="#000" fill-opacity="0.72"/>`
    + `<g id="removed" clip-path="url(#scheme)"><rect x="${r(sx)}" y="${r(sy)}" width="${r(schemeWidth)}" height="${r(schemeHeight)}" fill="#ff4040" fill-opacity="0.25"/>`
    + `<g stroke="#ff4040" stroke-width="3">${hatch.join('')}</g></g>`
    + `<rect x="${r(sx)}" y="${r(sy)}" width="${r(schemeWidth)}" height="${r(schemeHeight)}" fill="none" stroke="#ffffff" stroke-width="1"/>`
    + `<rect x="${r(sx + region.left * s)}" y="${r(sy + region.top * s)}" width="${r(region.width * s)}" height="${r(region.height * s)}" fill="#3a3a3a" stroke="#ffffff" stroke-width="1"/>`
    + (quadPoints ? `<polygon points="${quadPoints}" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="2 2"/>` : '')
    + `<g font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" fill="#ffffff">${texts.join('')}</g></svg>`;
}

/** Colours of the lines of the cut preview (cutOriginalOf, cutLinesSvg). */
export const CUT_COLOURS = { corners: '#ffffff', image: '#7cff7c', inset: '#ffe600', feather: '#00e5ff', opaque: '#ff00cc' };

/** The four sides of a quad [tl, tr, br, bl] as [from, to] in reading direction, in the order of removedSides: left, top, right, bottom. */
const quadSides = ([tl, tr, br, bl]) => [[bl, tl], [tl, tr], [tr, br], [bl, br]];

/** Shares along a side where the labels of its lines go, one each, in the order of the lines in cutLinesSvg. */
const LABEL_AT = [0.15, 0.32, 0.5, 0.68, 0.85];

/**
 * SVG of the lines of the cut over the width × height photo, each with labels in its colour on every side (the numbers
 * of the info panel where they belong): the corners (meta_corners, both corners of the side in px), the border of the
 * trimmed image (`region`, removedSides: in total = by the corners + by inset and feather), the inset line (where the
 * sheet starts to show, inset px) and the end of the feather (inset + feather in, from there the sheet in full,
 * feather px); the edge of the fully opaque area is traced by cutOriginalOf, here only labelled. Labels sit on their
 * lines on a dark plate, staggered along the side so they never overlap, over all the lines; corner values at the corners.
 */
export function cutLinesSvg(width, height, region, value, edges = EDGE_DEFAULTS) {
  const { inset = EDGE_DEFAULTS.inset, feather = EDGE_DEFAULTS.feather } = edges ?? {};
  const short = Math.min(width, height);
  const stroke = Math.max(1, Math.round(short / 1000)), size = Math.max(11, Math.round(short / 110));
  const corners = quad(value, width, height);
  const insetPx = inset * short, featherPx = feather * short;
  const insetLine = insetQuad(corners, insetPx), featherLine = insetQuad(corners, insetPx + featherPx);
  const { left, top, width: w, height: h } = region;
  const image = [[left, top], [left + w, top], [left + w, top + h], [left, top + h]];
  const removed = removedSides(region, [width, height], value);
  const own = [[value.tl[0], value.bl[0]], [value.tl[1], value.tr[1]], [value.tr[0], value.br[0]], [value.bl[1], value.br[1]]];
  const r = (n) => n.toFixed(1);
  const polygon = (points, colour, dash) => `<polygon points="${points.map(([x, y]) => `${r(x)},${r(y)}`).join(' ')}" fill="none" stroke="${colour}" stroke-width="${stroke}"`
    + `${dash ? ` stroke-dasharray="${stroke * 6} ${stroke * 4}"` : ''}/>`;
  // a label on a dark plate (wide enough by an estimate of the text), so no line shows through it
  const label = (x, y, angle, colour, text) => {
    const w = text.length * size * 0.6 + size;
    return `<g transform="translate(${r(x)} ${r(y)}) rotate(${r(angle)})"><rect x="${r(-w / 2)}" y="${r(-size * 0.7)}" width="${r(w)}" height="${r(size * 1.4)}" rx="${r(size / 4)}" fill="#000" fill-opacity="0.7"/>`
      + `<text text-anchor="middle" dominant-baseline="central" fill="${colour}">${text}</text></g>`;
  };
  // labels of every side, in the order of LABEL_AT; the edge of the fully opaque area (traced on the mask) lies about
  // a fifth of the feather inside the feather line: the blur reaches full opacity only there
  const labels = [0, 1, 2, 3].map((i) => [
    [quadSides(corners)[i], CUT_COLOURS.corners, `rohy ${own[i].join(' · ')} px`],
    [quadSides(image)[i], CUT_COLOURS.image, `obrázek ${removed.total[i]} px = rohy ${removed.corners[i]} + okraj ${removed.edges[i]}`],
    [quadSides(insetLine)[i], CUT_COLOURS.inset, `inset ${px1(insetPx)} px`],
    [quadSides(featherLine)[i], CUT_COLOURS.feather, `prolnutí ${px1(featherPx)} px`],
    [quadSides(insetQuad(corners, insetPx + featherPx * 1.2))[i], CUT_COLOURS.opaque, 'plná barva'],
  ].map(([[a, b], colour, text], j) => {
    const t = LABEL_AT[j], x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    return label(x, y, angle, colour, text);
  }).join(''));
  // the corner values inside each corner, along its diagonal
  const middle = [corners.reduce((n, p) => n + p[0], 0) / 4, corners.reduce((n, p) => n + p[1], 0) / 4];
  const cornerLabels = CORNER_KEYS.map((k, i) => {
    const [x, y] = corners[i], d = Math.hypot(middle[0] - x, middle[1] - y) || 1, reach = size * 5;
    const at = [x + ((middle[0] - x) / d) * reach, y + ((middle[1] - y) / d) * reach];
    return label(at[0], at[1], 0, CUT_COLOURS.corners, `${k} [${value[k].join(', ')}]`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + polygon(corners, CUT_COLOURS.corners) + polygon(insetLine, CUT_COLOURS.inset, true) + polygon(featherLine, CUT_COLOURS.feather, true)
    + `<g font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="bold">`
    + `${labels.join('')}${cornerLabels.join('')}</g></svg>`;
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
 * The original photo in its full size with the edge of the fully opaque work (from there the sheet in full, traced
 * on the mask), the border of the trimmed image (trimTransparent) as a solid light green line, with `lines` the lines of the corners, inset and feather with their labels (cutLinesSvg) and,
 * with `info`, the info panel in the middle (infoPanelSvg: a scheme, sizes,
 * what was removed and why, the edge settings, the meta_corners used). A JPEG buffer.
 */
export async function cutOriginalOf(file, value, edges, { info = true, lines: labelled = true } = {}) {
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
  // the edge of the fully opaque work: traced on the mask itself; thin lines, so the lines of the corners, inset and feather a few pixels apart stay apart
  const thin = Math.max(1, Math.round(Math.min(width, height) / 1000));
  const opaqueEdge = edgeOverlay(alpha, width, height, thin, [0xff, 0x00, 0xcc]);
  // the border of the trimmed image: where the site's image ends
  const half = thin / 2;
  const border = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
    + `<rect x="${region.left + half}" y="${region.top + half}" width="${Math.max(1, region.width - thin)}" height="${Math.max(1, region.height - thin)}" fill="none" stroke="${CUT_COLOURS.image}" stroke-width="${thin}"/></svg>`;
  return sharp(original)
    .composite([
      { input: opaqueEdge, raw: { width, height, channels: 4 } },
      { input: Buffer.from(border) },
      ...(labelled ? [{ input: Buffer.from(cutLinesSvg(width, height, region, value, edges)) }] : []),
      ...panel(region),
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** A `meta_corners` value as YAML lines, the way the pipeline writes it into a description (to copy into one). */
export const cornersYaml = (value) => ['meta_corners:', `  photo: [${value.photo.join(', ')}]`, ...CORNER_KEYS.map((k) => `  ${k}: [${value[k].join(', ')}]`)].join('\n');
