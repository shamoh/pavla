#!/usr/bin/env node
// Straightens photos of artworks lying on a floor: finds the paper sheet, fixes the perspective,
// crops the floor away. Originals are never changed; results go to a new folder.
//
// Usage:  npm run straighten -- <photo or folder> [options]
//   folder         every photo (jpg, jpeg, png, webp, tif) directly in it
//   --out <dir>    where to write (default: <folder of the photos>/upravene/)
//   --preview      also write <name>.nahled.jpg with the detected sheet drawn in, into <out>/nahledy/
//   --margin <f>   keep this much of the surroundings around the sheet, as a share of its longer side
//                  (default 0.02), so the whole paper with its edges is visible; negative crops into the sheet
//   --width <px>   shrink the result to at most this width (after rotation, never enlarges), e.g. 3000 for a master
//   --white-balance  make the bare paper neutral white (removes a warm or grey cast of the phone photo)
//   single photo only (saved to <photo>.orez.yaml next to it, used by every later run of the folder):
//   --corners x,y,x,y,x,y,x,y   the sheet corners by hand (tl, tr, br, bl as fractions 0–1 of the photo,
//                               e.g. read from the preview) when the detection is wrong
//   --rotate <deg>              rotate the result (90, -90, 180), e.g. for a sheet photographed sideways
//   --extra <name>              with --corners: an additional crop of the same photo (e.g. a detail),
//                               written as <photo>-<name>.jpg
//
// <photo>.orez.yaml (written by the tool, may be edited by hand):
//   corners: [x, y, x, y, x, y, x, y]   main crop, optional (without it the sheet is detected)
//   rotate: -90                          optional
//   margin: 0.05                         optional, as --margin for this photo
//   whiteBalance: true                   optional, as --white-balance for this photo
//   width: 3000                          optional, as --width for this photo
//   extra:                               optional additional crops
//     - { name: deska, corners: [...], rotate: 0, whiteBalance: false }   (a crop without paper)
// White balance is skipped when the lightest grey of a crop is too dark to be paper.
//
// With a margin, the result carries the position of the bare sheet in its XMP metadata (scripts/lib/sheet-box.mjs):
// the image pipeline crops the master to it for the mockups, where the surroundings must not appear.

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import YAML from 'yaml';
import { IMAGE_EXTENSIONS, isValidSlug, splitExt } from './lib/works.mjs';
import { rotateBox, sheetXmp } from './lib/sheet-box.mjs';
import { borderColor, findSheetCorners, paperColor, parseCorners, sheetSize, warpQuad, whiteBalanceGains } from './lib/straighten.mjs';

/** Default margin of the surroundings around the sheet (share of its longer side). */
export const DEFAULT_MARGIN = 0.02;

const DETECT_WIDTH = 600;

/** Straightens one photo; returns { file, width, height, corners (fractions), auto, gains }. */
export async function straightenPhoto(input, output, { corners: manual, rotate = 0, margin, whiteBalance = false, width: maxWidth, preview } = {}) {
  margin ??= DEFAULT_MARGIN;
  const { data, info } = await sharp(input).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels } = info;
  const sw = DETECT_WIDTH, sh = Math.max(1, Math.round((H / W) * sw));
  const small = await sharp(data, { raw: info }).resize(sw, sh).raw().toBuffer();
  let corners;
  if (manual) corners = manual.map(([x, y]) => [x * W, y * H]);
  else {
    const found = findSheetCorners(small, sw, sh);
    if (!found) throw new Error(`${path.basename(input)}: no paper sheet found, give --corners`);
    corners = found.map(([x, y]) => [x * (W / sw), y * (H / sh)]);
  }
  const { width, height } = sheetSize(corners);
  // margin > 0: the surroundings around the sheet (beyond the photo filled with the colour of its border);
  // margin < 0: cropped into the sheet
  const m = Math.round(margin * Math.max(width, height));
  const out = Math.max(0, m);
  const warped = warpQuad(data, W, H, channels, corners, width, height, out, borderColor(small, sw, sh));
  let img = sharp(warped, { raw: { width: width + 2 * out, height: height + 2 * out, channels: 3 } });
  if (m < 0) img = img.extract({ left: -m, top: -m, width: width + 2 * m, height: height + 2 * m });
  // With surroundings, the JPEG remembers where the bare sheet is (XMP), for mockups without the floor.
  const W2 = width + 2 * out, H2 = height + 2 * out;
  const sheet = out > 0 ? rotateBox([out / W2, out / H2, (out + width) / W2, (out + height) / H2], rotate) : null;
  let gains = null;
  if (whiteBalance) {
    const paper = paperColor(await img.clone().resize(400, 400, { fit: 'inside' }).raw().toBuffer());
    if (paper) {
      gains = whiteBalanceGains(paper);
      img = sharp(await img.png().toBuffer()).linear(gains, [0, 0, 0]);
    }
  }
  if (rotate) img = sharp(await img.png().toBuffer()).rotate(rotate);
  if (maxWidth) img = sharp(await img.png().toBuffer()).resize({ width: maxWidth, withoutEnlargement: true });
  await fs.mkdir(path.dirname(output), { recursive: true });
  if (sheet) img = img.withXmp(sheetXmp(sheet));
  await img.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(output);

  if (preview) {
    const pw = 900, ph = Math.round((H / W) * pw), s = pw / W;
    const pts = corners.map(([x, y]) => `${(x * s).toFixed(1)},${(y * s).toFixed(1)}`).join(' ');
    const svg = `<svg width="${pw}" height="${ph}" xmlns="http://www.w3.org/2000/svg"><polygon points="${pts}" fill="none" stroke="#ff00ff" stroke-width="3"/></svg>`;
    await fs.mkdir(path.dirname(preview), { recursive: true });
    await sharp(data, { raw: info }).resize(pw, ph).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 75 }).toFile(preview);
  }
  const meta = await sharp(output).metadata();
  return {
    file: path.basename(output), width: meta.width, height: meta.height, auto: !manual,
    gains: gains && gains.map((g) => +g.toFixed(3)),
    sheet: sheet && sheet.map((n) => +n.toFixed(4)),
    corners: corners.map(([x, y]) => [+(x / W).toFixed(4), +(y / H).toFixed(4)]),
  };
}

/** Sidecar file with the manual settings of a photo: <photo>.orez.yaml next to it. */
export const sidecarPath = (photo) => path.join(path.dirname(photo), `${splitExt(path.basename(photo)).base}.orez.yaml`);

const cornersFromList = (list, where) => {
  if (list === undefined || list === null) return undefined;
  if (!Array.isArray(list)) throw new Error(`${where}: corners must be a list of 8 numbers`);
  return parseCorners(list.join(','));
};

/** Reads <photo>.orez.yaml (null when there is none) and checks it. */
export async function readSidecar(photo) {
  const file = sidecarPath(photo);
  let text;
  try { text = await fs.readFile(file, 'utf8'); } catch { return null; }
  const data = YAML.parse(text) ?? {};
  const where = path.basename(file);
  cornersFromList(data.corners, where);
  if (data.margin !== undefined && !(typeof data.margin === 'number' && data.margin > -0.2 && data.margin < 0.5)) throw new Error(`${where}: margin must be a number between -0.2 and 0.5`);
  for (const e of data.extra ?? []) {
    if (e?.margin !== undefined && !(typeof e.margin === 'number' && e.margin > -0.2 && e.margin < 0.5)) throw new Error(`${where}: margin of "${e?.name}" must be a number between -0.2 and 0.5`);
  }
  if (data.width !== undefined && !(Number.isInteger(data.width) && data.width > 0)) throw new Error(`${where}: width must be a whole number of pixels`);
  for (const e of data.extra ?? []) {
    if (!isValidSlug(e?.name)) throw new Error(`${where}: every extra crop needs a name (a-z, 0-9, dashes)`);
    if (!cornersFromList(e.corners, `${where} (${e.name})`)) throw new Error(`${where}: extra crop "${e.name}" needs corners`);
  }
  return data;
}

const round = (list) => list.flat().map((n) => +Number(n).toFixed(4));

/**
 * Saves manual settings of a photo into its sidecar, keeping everything else in it:
 * the main crop (`name` empty) or the extra crop `name`.
 */
export async function saveSidecar(photo, { name, corners, rotate }) {
  const data = (await readSidecar(photo)) ?? {};
  if (!name) {
    if (corners) data.corners = round(corners);
    if (rotate) data.rotate = rotate; else delete data.rotate;
  } else {
    const extra = (data.extra ?? []).filter((e) => e.name !== name);
    extra.push({ name, corners: round(corners), ...(rotate ? { rotate } : {}) });
    data.extra = extra;
  }
  const header = '# Ořez fotky pro `npm run straighten` (repo pavla). Zapisuje ho nástroj, dá se upravit ručně.\n'
    + '# corners: rohy listu [levý horní x, y, pravý horní, pravý dolní, levý dolní] jako podíl šířky a výšky fotky (0–1).\n';
  // lists of numbers (corners) on one line, the list of extra crops as blocks
  const doc = new YAML.Document(data);
  YAML.visit(doc, { Seq(_, node) { if (node.items.every((it) => YAML.isScalar(it))) node.flow = true; } });
  await fs.writeFile(sidecarPath(photo), header + doc.toString());
  return sidecarPath(photo);
}

/**
 * Outputs of one photo: the main crop <base>.jpg and every extra crop <base>-<name>.jpg,
 * with the settings from its sidecar (and the global options). Returns [{ output, options }].
 */
export async function jobsFor(photo, outDir, { whiteBalance = false, margin, width } = {}) {
  const side = (await readSidecar(photo)) ?? {};
  const base = splitExt(path.basename(photo)).base;
  const common = { whiteBalance: whiteBalance || side.whiteBalance === true, margin: margin ?? side.margin, width: width ?? side.width };
  const jobs = [{ output: path.join(outDir, `${base}.jpg`), options: { ...common, corners: cornersFromList(side.corners, base), rotate: side.rotate ?? 0 } }];
  for (const e of side.extra ?? []) {
    jobs.push({
      output: path.join(outDir, `${base}-${e.name}.jpg`),
      options: { ...common, corners: cornersFromList(e.corners, base), rotate: e.rotate ?? 0, margin: margin ?? e.margin ?? side.margin, whiteBalance: e.whiteBalance ?? common.whiteBalance },
    });
  }
  return jobs;
}

/** Photos to process: the file itself, or the photos directly in the folder (sorted). */
export async function listPhotos(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const names = (await fs.readdir(target, { withFileTypes: true }))
    .filter((e) => e.isFile() && !e.name.startsWith('.') && IMAGE_EXTENSIONS.includes(splitExt(e.name).ext))
    .map((e) => e.name).sort();
  return names.map((n) => path.join(target, n));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const valued = new Set(['--out', '--margin', '--corners', '--rotate', '--extra', '--width']);
  const target = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
  const cwd = process.env.INIT_CWD ?? process.cwd();
  try {
    if (!target) throw new Error('usage: npm run straighten -- <photo or folder> [--out dir] [--preview] [--white-balance] [--width px] [--margin f] [--corners …] [--rotate deg] [--extra name]');
    const abs = path.resolve(cwd, target);
    const single = (await fs.stat(abs)).isFile();
    const photos = await listPhotos(abs);
    if (!single && (opt('--corners') || opt('--rotate') || opt('--extra'))) throw new Error('--corners, --rotate and --extra need a single photo, not a folder');
    if (opt('--extra') && !opt('--corners')) throw new Error('--extra needs --corners');
    if (args.includes('--out') && !opt('--out')) throw new Error('--out needs a folder');
    if (args.includes('--margin') && !(Number(opt('--margin')) > -0.2 && Number(opt('--margin')) < 0.5)) throw new Error('--margin needs a number between -0.2 and 0.5');
    if (args.includes('--width') && !(Number.isInteger(Number(opt('--width'))) && Number(opt('--width')) > 0)) throw new Error('--width needs a whole number of pixels');
    if (opt('--extra') && !isValidSlug(opt('--extra'))) throw new Error('--extra: the name may only contain a-z, 0-9 and dashes');
    // manual settings of a single photo are remembered next to it
    if (single && (opt('--corners') || opt('--rotate'))) {
      const file = await saveSidecar(abs, { name: opt('--extra'), corners: opt('--corners') && parseCorners(opt('--corners')), rotate: Number(opt('--rotate') ?? 0) });
      console.log(`+ saved to ${path.basename(file)}`);
    }
    const outDir = path.resolve(cwd, opt('--out') ?? path.join(single ? path.dirname(abs) : abs, 'upravene'));
    const global = {
      whiteBalance: args.includes('--white-balance'),
      margin: opt('--margin') !== undefined ? Number(opt('--margin')) : undefined,
      width: opt('--width') !== undefined ? Number(opt('--width')) : undefined,
    };
    let count = 0;
    for (const p of photos) {
      for (const job of await jobsFor(p, outDir, global)) {
        const name = splitExt(path.basename(job.output)).base;
        const r = await straightenPhoto(p, job.output, {
          ...job.options,
          preview: args.includes('--preview') ? path.join(outDir, 'nahledy', `${name}.nahled.jpg`) : undefined,
        });
        count++;
        console.log(`→ ${r.file}  ${r.width}×${r.height}  corners ${r.auto ? '(detected)' : '(given)'} ${r.corners.map((c) => c.join(',')).join(',')}${r.gains ? `  white balance ×${r.gains.join('/')}` : ''}`);
      }
    }
    console.log(`Done: ${count} image(s) from ${photos.length} photo(s) in ${outDir}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  }
}
