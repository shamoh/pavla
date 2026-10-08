#!/usr/bin/env node
// Image pipeline. Reads works from the content repository and produces:
// (<year> is the year of the work's date; the content repository has no year folders, see scripts/lib/content.mjs)
//   content/…                                          public copies of the descriptions, a mirror of the content
//                                                      repository (see scripts/lib/site-content.mjs) (commit)
//   public/tvorba/<year>/<slug>-<id>/<width>.{avif,webp,jpg}, info.json  web images of a work, in the folder of its page (commit);
//                                                                        with meta_corners the floor around the sheet is
//                                                                        transparent in AVIF/WebP, the paper of the site in JPEG
//   public/tvorba/<year>/<slug>-<id>/mockup-<scene>-<width>.*             the work in an interior, only with `mockups: true` (commit);
//                                                                        from the bare sheet when the master shows surroundings
//   public/tvorba/<year>/<slug>-<id>/detail-<name>-<width>.*              detail photos of the work (commit)
//   public/tvorba/<year>/<slug>-<id>/og.jpg                               share image (og:image): the whole work on paper, 3:2 (commit)
//   public/fotky/<name>/<width>.{avif,webp,jpg}, info.json                 other photos of the site (commit)
//   public/<page>/_cover/, public/<page>/og.jpg                            own cover photo and share image of the chosen cover of a
//                                                                        collection (tvorba/kolekce/<slug>), year (tvorba/<year>) or
//                                                                        the home page (the root); see scripts/lib/site-images.mjs (commit)
//   <contentDir>/export/instagram/<year>/<key>-clean.jpg          Instagram, the original on paper, 4:5
//   <contentDir>/export/instagram/<year>/<key>-detail-<name>.jpg  Instagram, a detail photo cropped to 4:5 (never mockups)
//   (Instagram exports only for works with `meta_instagram: true`; otherwise they are removed)
//
// Copies for the public site repository contain only public fields: private_note never leaves the content repository.
//   <contentDir>/export/fler/<year>/<key>.jpg                     Fler, the original with the author's name as watermark
//   <contentDir>/export/fler/<year>/<key>-mockup-<scene>.jpg      Fler, the mockups with the same watermark
//   (Fler exports only for works on sale: available or reserved; otherwise they are removed)
//   <contentDir>/tvorba/…/<slug>.yaml  meta_corners (corners of the sheet) written when missing (scripts/lib/corners.mjs)
//   .previews/<slug>-<id>-*.jpg        cut previews of drafts: -backgrounds, -cut, -frames (outside git; on GitHub the
//                                      artifact "nahledy-orezu" of the content workflow's run)
//
// Usage:  npm run images             (only works whose outputs are missing or older than the master)
//         npm run images -- --force  (regenerate everything)
//         npm run images -- --prepare-only  (only skeletons, ids, corners of the sheets, checks of the content and
//                                            cut previews of drafts; no images, site or exports; used by the
//                                            automation on branches of the content repository)
//         npm run images -- <slug>   (a single work; skips pruning)
// Content location: CONTENT_DIR (locally from .env, see package.json), or images.contentDir in site.config.yaml.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { PUBLIC_COLLECTION_FIELDS, coverSource, prepareCollections, validateCollectionCovers } from './lib/collections.mjs';
import { PUBLIC_YEAR_FIELDS, prepareYears } from './lib/years.mjs';
import { PUBLIC_HOME_FIELDS, prepareHome } from './lib/home.mjs';
import {
  HOME_PAGE_DIR, OUTPUT_ROOTS, collectionPageDir, coverDir, ogFile, photoDir, staleOutputs, workImageDir, yearPageDir,
} from './lib/site-images.mjs';
import { HOME_COPY, MODIFIED, collectionCopyPath, photoCopyPath, staleCopies, workCopyPath, yearCopyPath } from './lib/site-content.mjs';
import { coverProblems, coverShareSource } from './lib/covers.mjs';
import { placeholderProblems, prepareContent } from './lib/content.mjs';
import { DEMO_MARKER, demoProblems } from './lib/demo.mjs';
import { loadScenes, pickScenes, renderMockup } from './lib/mockups.mjs';
import { PUBLIC_PHOTO_FIELDS, focusCrop, preparePhotos } from './lib/photos.mjs';
import { boxRegion, parseSheetXmp } from './lib/sheet-box.mjs';
import { cutOut, prepareCorners, trimTransparent, writePreviews } from './lib/corners.mjs';
import { EDGE_DEFAULTS, cutsSheet, edgeLook, innerRegion } from './lib/edges.mjs';
import { PALETTES } from './lib/palettes.mjs';
import { formatSummary } from './lib/summary.mjs';
import { pageAdvice, tagAdvice, tagStats, workAdvice } from './lib/advice.mjs';
import {
  PUBLIC_WORK_FIELDS, expectedExports, exportPattern, isOnSale, wantsInstagram, wantsMockups, planExportPrune, publicFields, validateWorks, workKey,
} from './lib/works.mjs';

/** Bump when the output format changes, so every work is regenerated once. */
const PIPELINE_VERSION = 8;

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const exists = (p) => fs.access(p).then(() => true, () => false);
const readJson = (p) => fs.readFile(p, 'utf8').then(JSON.parse, () => null);
const sha1 = (...parts) => {
  const h = createHash('sha1');
  for (const p of parts) h.update(typeof p === 'string' ? p : Buffer.from(p));
  return h.digest('hex').slice(0, 16);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SYNC_HEADER = '# Generated by `npm run images` from the content repository. Do not edit here, changes will be overwritten.\n';

/** Text of a public metadata copy: only the given fields, no comments (they could hold private notes). */
const publicCopy = (data, fields) => SYNC_HEADER + YAML.stringify(publicFields(data, fields));

/** Writes `text` only when it differs, to keep git diffs clean. */
async function writeIfChanged(file, text) {
  if ((await fs.readFile(file, 'utf8').catch(() => null)) === text) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
}

// Load the master once: convert to sRGB and apply EXIF rotation. Metadata (EXIF, GPS) is not copied to outputs.
// `sheet`: where the bare paper lies when the master also shows its surroundings (XMP written by
// `npm run straighten`, see scripts/lib/sheet-box.mjs); null for a master that is the sheet itself.
// `corners` (meta_corners of a work, scripts/lib/edges.mjs): everything outside them becomes transparent, fading in
// over `edges.feather`, and the image is trimmed to the smallest rectangle holding the whole cut work
// (trimTransparent: no transparent surroundings along a straight side); then `buf` is a PNG with alpha,
// `transparent` is true, `width`/`height` are those of the trimmed image, `full` the size of the photo and `offset`
// where the trimmed image lies in it (corners and the XMP sheet are in the photo's coordinates).
async function loadMaster(input, { corners, edges } = {}) {
  let buf = await sharp(input).rotate().toColorspace('srgb').toBuffer();
  const meta = await sharp(buf).metadata();
  const sheet = parseSheetXmp((await sharp(input).metadata()).xmp);
  const transparent = cutsSheet(corners);
  const full = { width: meta.width, height: meta.height };
  let offset = { left: 0, top: 0 }, size = full;
  if (transparent) {
    const trimmed = await trimTransparent(await cutOut(buf, corners, edges));
    buf = trimmed.buf;
    offset = { left: trimmed.left, top: trimmed.top };
    size = { width: trimmed.width, height: trimmed.height };
  }
  // the bare sheet of the mockups stays as far from the edge as the cut (at least 2 px: a JPEG bleeds at an edge)
  const inset = Math.max(2, Math.round((edges?.inset ?? EDGE_DEFAULTS.inset) * Math.min(meta.width, meta.height)));
  return { buf, ...size, full, offset, sheet, corners: transparent ? corners : null, transparent, inset };
}

/**
 * The master for the mockups: the bare sheet, a framed work never shows the floor around it (the mat covers the
 * edges of the paper): inside its corners and inside the sheet of the XMP, whichever it has (both: the overlap),
 * else the whole master.
 */
function mockupSource(m) {
  // both regions are in the photo's coordinates; the buffer may be trimmed (m.offset)
  const regions = [
    m.corners && innerRegion(m.corners, m.full.width, m.full.height, m.inset),
    m.sheet && boxRegion(m.sheet, m.full.width, m.full.height),
  ].filter(Boolean);
  if (!regions.length) return m.buf;
  const left = Math.max(0, Math.max(...regions.map((r) => r.left)) - m.offset.left);
  const top = Math.max(0, Math.max(...regions.map((r) => r.top)) - m.offset.top);
  const right = Math.min(m.width, Math.min(...regions.map((r) => r.left + r.width)) - m.offset.left);
  const bottom = Math.min(m.height, Math.min(...regions.map((r) => r.top + r.height)) - m.offset.top);
  return sharp(m.buf).extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }).removeAlpha().toBuffer();
}

/** Colour a transparent image is put on where it cannot stay transparent (JPEG fallback on the site): the first palette's paper. */
const FALLBACK_PAPER = PALETTES[0].colors.paper;

/** Writes <prefix><width>.{avif,webp,jpg} for every width that does not upscale; returns the widths. */
async function responsive(buf, srcWidth, dir, prefix, widths, quality) {
  // Never upscale: a smaller source additionally gets a variant at its full width.
  const fit = widths.filter((w) => w <= srcWidth);
  const unique = fit.length === widths.length ? fit : [...fit, srcWidth];
  for (const w of unique) {
    const base = sharp(buf).resize({ width: w, withoutEnlargement: true });
    // AVIF and WebP keep a transparent surroundings; JPEG cannot, it gets the paper of the site behind it
    await base.clone().avif({ quality: quality - 22, effort: 5 }).toFile(path.join(dir, `${prefix}${w}.avif`));
    await base.clone().webp({ quality }).toFile(path.join(dir, `${prefix}${w}.webp`));
    await base.clone().flatten({ background: FALLBACK_PAPER }).jpeg({ quality, mozjpeg: true, progressive: true }).toFile(path.join(dir, `${prefix}${w}.jpg`));
  }
  return unique;
}

const dominantColor = async (buf) => {
  const { dominant: d } = await sharp(buf).flatten({ background: FALLBACK_PAPER }).stats();
  return `rgb(${d.r},${d.g},${d.b})`;
};

/** Writes the web images and info.json; returns the rendered mockups ({ scene, buf }) for the exports. */
async function web(dir, m, img, { work, picked, details, fingerprint }) {
  // The folder only holds generated files, so start clean (drops mockups of scenes no longer picked).
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const widths = await responsive(m.buf, m.width, dir, '', img.web.widths, img.web.quality);
  const mockups = [];
  const rendered = [];
  const framed = picked.length ? await mockupSource(m) : null;
  for (const scene of picked) {
    const buf = await renderMockup(framed, work.size_cm, scene);
    rendered.push({ scene: scene.name, buf });
    const { width, height } = await sharp(buf).metadata();
    const mw = await responsive(buf, width, dir, `mockup-${scene.name}-`, img.mockups.widths, img.web.quality);
    mockups.push({ scene: scene.name, label: scene.label, width, height, widths: mw, dominant: await dominantColor(buf) });
  }
  const detailSets = [];
  for (const d of details) {
    const dm = await loadMaster(d.buf);
    const dw = await responsive(dm.buf, dm.width, dir, `detail-${d.name}-`, img.details.widths, img.web.quality);
    detailSets.push({ name: d.name, width: dm.width, height: dm.height, widths: dw, dominant: await dominantColor(dm.buf) });
  }
  const og = await shareImage(path.join(dir, 'og.jpg'), m, img);
  // Dimensions and placeholder colour, read by the site.
  const info = {
    width: m.width, height: m.height, widths, dominant: await dominantColor(m.buf), ...(m.transparent ? { transparent: true } : {}),
    mockups, details: detailSets, og, fingerprint,
  };
  await fs.writeFile(path.join(dir, 'info.json'), JSON.stringify(info, null, 2));
  return rendered;
}

/**
 * Share image of a work (og:image): the whole work on the paper background, never cropped (it is art),
 * in the 3:2 frame social networks show without cropping. Returns { width, height }.
 */
/** The whole image centred on the paper background in the share image size (images.og), as a JPEG buffer. */
async function wholeOnPaper(m, img) {
  const { width: W, height: H, background, padding, quality } = img.og;
  const pad = Math.round(H * padding);
  const inner = await sharp(m.buf).resize({ width: W - 2 * pad, height: H - 2 * pad, fit: 'inside', withoutEnlargement: true }).toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background } })
    .composite([{ input: inner, gravity: 'center' }])
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

async function shareImage(file, m, img) {
  await fs.writeFile(file, await wholeOnPaper(m, img));
  return { width: img.og.width, height: img.og.height };
}

async function instagramClean(file, m, img) {
  const { width: W, height: H, background, padding } = img.instagram;
  const pad = Math.round(W * padding);
  const inner = await sharp(m.buf).resize({ width: W - 2 * pad, height: H - 2 * pad, fit: 'inside' }).toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background } })
    .composite([{ input: inner, gravity: 'center' }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(file);
}

// A detail photo is a close-up, so it fills the whole 4:5 frame (centre crop) instead of sitting on paper.
async function instagramDetail(file, buf, img) {
  const { width: W, height: H } = img.instagram;
  await sharp(buf).rotate().toColorspace('srgb').resize(W, H, { fit: 'cover' }).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
}

/** Resizes `buf` (the original or a mockup) for Fler and signs it with the author's name. */
async function fler(file, buf, img) {
  const f = img.fler;
  // a transparent surroundings of the original goes on the background of Fler (white)
  const resized = await sharp(buf).resize({ width: f.longEdge, height: f.longEdge, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: f.background ?? '#ffffff' }).toBuffer();
  const { width, height } = await sharp(resized).metadata();
  const size = Math.round(Math.min(width, height) * 0.035);
  const margin = Math.round(size * 1.2);
  // Signature colour depends on the brightness of the corner: dark on light paper, light on dark paint.
  const cw = Math.round(width * 0.4), ch = Math.round(size * 2.5);
  const corner = await sharp(resized).extract({ left: width - cw, top: height - ch, width: cw, height: ch }).stats();
  const [r, g, b] = corner.channels.map((c) => c.mean);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  const [ink, halo] = light ? ['#3a3430', '#ffffff'] : ['#ffffff', '#000000'];
  // Discreet signature in the bottom right corner, with a faint halo so it reads on light and dark areas.
  const mark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>text{font-family:'DejaVu Serif','Georgia',serif;font-style:italic;font-size:${size}px}</style>
    <text x="${width - margin + 1}" y="${height - margin + 1}" text-anchor="end" fill="${halo}" fill-opacity="${f.watermarkOpacity * 0.5}">${esc(f.watermark)}</text>
    <text x="${width - margin}" y="${height - margin}" text-anchor="end" fill="${ink}" fill-opacity="${f.watermarkOpacity}">${esc(f.watermark)}</text>
  </svg>`);
  await sharp(resized)
    .composite([{ input: mark }])
    .jpeg({ quality: f.quality, mozjpeg: true })
    .toFile(file);
}

/**
 * Web sizes of a standalone photo (site photo, collection cover) into `dir`, with info.json.
 * Skipped when the fingerprint is unchanged; returns true when the photo was (re)generated.
 */
async function photoSet(masterPath, dir, img, extra, { force, log, label }) {
  const master = await fs.readFile(masterPath);
  const fingerprint = sha1(String(PIPELINE_VERSION), master, JSON.stringify(extra));
  if ((await readJson(path.join(dir, 'info.json')))?.fingerprint === fingerprint && !force) return false;
  log(`→ ${label}`);
  const m = await loadMaster(master);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const widths = await responsive(m.buf, m.width, dir, '', img.photos.widths, img.web.quality);
  const info = { width: m.width, height: m.height, widths, dominant: await dominantColor(m.buf), ...extra, fingerprint };
  await fs.writeFile(path.join(dir, 'info.json'), JSON.stringify(info, null, 2));
  return true;
}

/** Removes every export of one work (both platforms), so a regeneration never leaves stale files behind. */
async function clearExports(exportRoot, year, key) {
  const own = exportPattern(key);
  for (const sub of ['instagram', 'fler']) {
    const dir = path.join(exportRoot, sub, year);
    if (!(await exists(dir))) continue;
    for (const f of await fs.readdir(dir)) if (own.test(f)) await fs.rm(path.join(dir, f));
  }
}

/** Lists "<year>/<name>" entries one level below `root` (name without `ext` when given). */
async function listGenerated(root, ext) {
  const out = [];
  if (!(await exists(root))) return out;
  for (const year of await fs.readdir(root, { withFileTypes: true })) {
    if (!year.isDirectory()) continue;
    for (const e of await fs.readdir(path.join(root, year.name), { withFileTypes: true })) {
      if (ext ? e.isFile() && e.name.endsWith(ext) : e.isDirectory()) {
        out.push(`${year.name}/${ext ? e.name.slice(0, -ext.length) : e.name}`);
      }
    }
  }
  return out;
}

/** Removes empty folders under `root`, deepest first, and `root` itself when it ends up empty. */
async function removeEmptyDirs(root) {
  if (!(await exists(root))) return;
  for (const e of await fs.readdir(root, { withFileTypes: true })) {
    if (e.isDirectory()) await removeEmptyDirs(path.join(root, e.name));
  }
  if ((await fs.readdir(root)).length === 0) await fs.rmdir(root);
}

async function removeEmptyYearDirs(root) {
  if (!(await exists(root))) return;
  for (const year of await fs.readdir(root, { withFileTypes: true })) {
    const dir = path.join(root, year.name);
    if (year.isDirectory() && (await fs.readdir(dir)).length === 0) await fs.rmdir(dir);
  }
}

/**
 * Runs the whole pipeline. Returns a summary; throws on configuration errors.
 * Options: contentDir, siteDir, config, force, only (slugs), log, today, random, dataset, prepareOnly.
 * `prepareOnly` stops after skeletons, ids, corners of the sheets, checks and the cut previews of drafts: nothing is
 * written to the site or the exports.
 * `previewDir`: where the cut previews of drafts go (default .previews/ of the site directory, outside git; on GitHub
 * the content workflow uploads them as the artifact of its run).
 * `dataset` 'real' (default) forbids test data in the content, 'demo' requires the content to be the test data
 * (see scripts/lib/demo.mjs; test data are processed by `npm run demo` into .demo/, never into this repo).
 */
export async function run({
  contentDir,
  siteDir = siteRoot,
  config,
  force = false,
  only = [],
  scenesDir,
  log = console.log,
  today,
  random,
  dataset = 'real',
  prepareOnly = false,
  previewDir,
} = {}) {
  config ??= YAML.parse(await fs.readFile(path.join(siteDir, 'site.config.yaml'), 'utf8'));
  const img = config.images;
  const edges = { ...EDGE_DEFAULTS, ...img.edges };
  // meta_corners of the works by their master photo, for share images of covers that show a work (set below)
  let cornersOf = new Map();
  /**
   * Share image of a chosen cover ({ source, crop } from coverShareSource): cropped to crop.ratio around crop.focus
   * (filling the share image when the ratio is its own, 3:2, otherwise on paper), or without crop the whole image on
   * paper like the share image of a work; written only when it changed.
   */
  const shareCrop = async ({ source, crop }, file, label) => {
    const m = await loadMaster(await fs.readFile(source), { corners: cornersOf.get(source), edges });
    const ogRatio = img.og.width / img.og.height;
    const area = crop && focusCrop(m.width, m.height, crop.ratio, crop.focus);
    // one lossy encoding only: the crop fills the share image in a single pipeline, or goes on paper as lossless PNG
    const buf = !crop
      ? await wholeOnPaper(m, img)
      : Math.abs(crop.ratio - ogRatio) < 0.01
        ? await sharp(m.buf).extract(area).resize(img.og.width, img.og.height).flatten({ background: img.og.background }).jpeg({ quality: img.og.quality, mozjpeg: true }).toBuffer()
        : await wholeOnPaper({ buf: await sharp(m.buf).extract(area).png().toBuffer(), width: area.width, height: area.height }, img);
    const old = await fs.readFile(file).catch(() => null);
    if (!old || !old.equals(buf)) {
      log(`→ ${label}`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, buf);
    }
  };
  contentDir ??= process.env.CONTENT_DIR || img.contentDir;
  if (!contentDir) throw new Error('Není nastavené, kde je obsahové repo: dej CONTENT_DIR=<cesta k němu> do .env');
  contentDir = path.resolve(siteDir, contentDir);
  if (!(await exists(path.join(contentDir, 'tvorba')))) {
    throw new Error(`Obsah nenalezen: ${path.join(contentDir, 'tvorba')} (zkontroluj CONTENT_DIR v .env)`);
  }

  const { works, collectionFolders, created, assigned, updated, pending, problems: scanProblems } = await prepareContent(contentDir, { today, random });
  const photos = await preparePhotos(contentDir);
  created.push(...photos.created);
  updated.push(...photos.updated);
  const collections = await prepareCollections(contentDir, collectionFolders);
  created.push(...collections.created);
  updated.push(...collections.updated);
  const years = await prepareYears(contentDir, works.map((w) => w.year).filter(Boolean));
  created.push(...years.created);
  updated.push(...years.updated);
  // Corners of the sheets (meta_corners): detected for every work that has none yet, like the ids.
  const corners = await prepareCorners(contentDir, works, { search: edges.search, suspicious: edges.suspicious });
  corners.detected.forEach((p) => log(`+ corners of the sheet: ${p}`));
  cornersOf = new Map(works.filter((w) => w.masterPath).map((w) => [w.masterPath, w.data.meta_corners]));
  const home = await prepareHome(contentDir);
  created.push(...home.created);
  updated.push(...home.updated);
  created.forEach((p) => log(`+ new metadata skeleton: ${p}`));
  assigned.forEach((p) => log(`+ id assigned: ${p}`));
  updated.forEach((p) => log(`~ metadata brought in line with the schema: ${p}`));
  pending.forEach((p) => log(`! published, still marked DOPLNIT: ${p}`));
  const tags = tagStats(works);
  const advice = [...workAdvice(works), ...tagAdvice(works), ...pageAdvice({ collections: collections.collections, years: years.years, home: home.home, photos: photos.photos })];
  advice.forEach((p) => log(`? advice: ${p}`));
  const problems = [
    ...scanProblems, ...corners.problems, ...validateWorks(works), ...photos.problems, ...collections.problems, ...years.problems, ...home.problems,
    ...years.years.flatMap((y) => coverProblems({
      where: y.yamlPath, data: y.data, photoPath: y.coverPath, works, inScope: (w) => w.year === y.year, scope: y.year,
    })),
    ...(home.home ? coverProblems({ where: home.home.yamlPath, data: home.home.data, photoPath: home.home.coverPath, works }) : []),
    ...validateCollectionCovers(collections.collections, works),
    ...placeholderProblems({ collections: collections.collections, years: years.years, home: home.home, photos: photos.photos }),
    ...demoProblems({ works, collections: collections.collections, marked: await exists(path.join(contentDir, DEMO_MARKER)) }, dataset),
  ];
  const detected = corners.detected;
  if (problems.length) {
    return { ok: false, problems, created, assigned, detected, updated, pending, advice, tags, processed: 0, skipped: 0, missing: [], pruned: [], previews: [], prepared: prepareOnly };
  }

  // Cut previews of drafts (all three, writePreviews: like npm run preview), to check the corners before publishing.
  // Written fresh by every full run; a run of `only` adds to them.
  previewDir = path.resolve(previewDir ?? path.join(siteDir, '.previews'));
  if (!only.length) await fs.rm(previewDir, { recursive: true, force: true });
  const previews = [];
  for (const w of works) {
    if (w.data.meta_draft !== true || !w.masterPath || !cutsSheet(w.data.meta_corners)) continue;
    if (only.length && !only.includes(w.slug)) continue;
    const names = await writePreviews(previewDir, `${w.slug}-${w.id}`, w.masterPath, w.data.meta_corners, edges);
    previews.push(...names);
    log(`→ cut previews: ${names.join(', ')}`);
  }
  if (prepareOnly) return { ok: true, problems: [], created, assigned, detected, updated, pending, advice, tags, processed: 0, skipped: 0, missing: [], pruned: [], previews, prepared: true };
  const { scenes, text: scenesText } = await loadScenes(scenesDir);

  const publicDir = path.join(siteDir, 'public');
  const exportRoot = path.join(contentDir, 'export');
  // A draft never leaves the content repository: no metadata copy, no web images, no exports.
  // Outputs it had while published are removed by the prune below.
  const published = works.filter((w) => !w.data.meta_draft);

  let processed = 0, skipped = 0;
  const missing = [];
  // Public copies of the descriptions (content/, a mirror of the content repository): every path written by a full
  // run; anything else under content/ is removed at the end.
  const copies = new Set();
  // Images in public/, where their page is (scripts/lib/site-images.mjs): every folder and file a full run produces,
  // relative to public/; anything else under the output folders is removed at the end.
  const outputs = new Set();
  const writeCopy = async (rel, data, fields) => {
    copies.add(rel);
    await writeIfChanged(path.join(siteDir, rel), publicCopy(data, fields));
  };
  // The day of this run: derived_modified of a work whose public attributes or images change in it.
  const day = (today ?? new Date()).toISOString().slice(0, 10);
  /**
   * Public copy of a work, in the same place as in the content repository (the collection is its folder), with
   * derived_modified: the day its public attributes or its images last changed (lastmod of the sitemap); kept as
   * it was when nothing changed.
   */
  const writeWorkCopy = async (w, imagesChanged) => {
    const rel = workCopyPath(w.collection, w.slug);
    const fields = publicFields(w.data, PUBLIC_WORK_FIELDS);
    const old = await fs.readFile(path.join(siteDir, rel), 'utf8').then((t) => YAML.parse(t) ?? {}, () => null);
    const { [MODIFIED]: before, ...oldFields } = old ?? {};
    const modified = old && before && !imagesChanged && isDeepStrictEqual(oldFields, fields) ? before : day;
    copies.add(rel);
    await writeIfChanged(path.join(siteDir, rel), SYNC_HEADER + YAML.stringify({ ...fields, [MODIFIED]: modified }));
  };

  /** Web images and exports of a work; true when they were (re)generated in this run. */
  const workImages = async (w, key, rel) => {
    const webDir = path.join(publicDir, workImageDir(w.year, key));
    if (!w.masterPath) {
      // No master is fine as long as web images exist (another computer, CI).
      if (!(await exists(path.join(webDir, 'info.json')))) missing.push(rel);
      return false;
    }
    // Outputs depend on the master, the size (mockup scale), the scenes, whether the work is on sale
    // (Fler exports), `mockups`, `meta_instagram`, the corners of the sheet (and how its edge fades, edgeLook: not the
    // settings of detection and previews) and the detail photos; not on price or description.
    const master = await fs.readFile(w.masterPath);
    const onSale = isOnSale(w.data.status);
    const instagram = wantsInstagram(w.data);
    const mockupsOn = wantsMockups(w.data);
    const details = await Promise.all(w.details.map(async (d) => ({ name: d.name, buf: await fs.readFile(d.path) })));
    const fingerprint = sha1(
      String(PIPELINE_VERSION), master, JSON.stringify(w.data.size_cm ?? null), scenesText, String(onSale), String(instagram), String(mockupsOn),
      JSON.stringify(w.data.meta_corners ?? null), JSON.stringify(cutsSheet(w.data.meta_corners) ? edgeLook(edges) : null),
      ...details.flatMap((d) => [d.name, d.buf]),
    );
    const upToDate = (await readJson(path.join(webDir, 'info.json')))?.fingerprint === fingerprint;
    if (upToDate && !force) { skipped++; return false; }

    log(`→ ${rel}`);
    const m = await loadMaster(master, { corners: w.data.meta_corners, edges });
    // Mockups only when the author asks for them (mockups: true), whether or not the work is for sale.
    const picked = mockupsOn ? pickScenes(w.data.size_cm, w.id, scenes) : [];
    if (mockupsOn && !picked.length) log(`  ! no mockup scene is big enough for ${rel} (see mockups/scenes.yaml maxCm)`);
    const mockups = await web(webDir, m, img, { work: w.data, picked, details, fingerprint });

    // Exports. Instagram: only when asked for (meta_instagram: true), the original and the detail photos, never mockups.
    // Fler: only works on sale, the original and the mockups, all with the watermark.
    await clearExports(exportRoot, w.year, key);
    if (instagram) {
      const insta = path.join(exportRoot, 'instagram', w.year);
      await fs.mkdir(insta, { recursive: true });
      await instagramClean(path.join(insta, `${key}-clean.jpg`), m, img);
      for (const d of details) await instagramDetail(path.join(insta, `${key}-detail-${d.name}.jpg`), d.buf, img);
    }
    if (onSale) {
      const flerDir = path.join(exportRoot, 'fler', w.year);
      await fs.mkdir(flerDir, { recursive: true });
      await fler(path.join(flerDir, `${key}.jpg`), m.buf, img);
      for (const mk of mockups) await fler(path.join(flerDir, `${key}-mockup-${mk.scene}.jpg`), mk.buf, img);
    }
    processed++;
    return true;
  };

  for (const w of published) {
    if (only.length && !only.includes(w.slug)) continue;
    const key = workKey(w.slug, w.id);
    outputs.add(workImageDir(w.year, key));
    const imagesChanged = await workImages(w, key, `${w.year}/${key}`);
    await writeWorkCopy(w, imagesChanged);
  }

  const pruned = [];
  if (!only.length) {
    // Stale exports, independent of whether the work was regenerated in this run: exports of deleted, renamed
    // or draft works, of detail photos and mockup scenes a work no longer has, Fler exports of works not on sale.
    const expected = new Map();
    for (const w of published) {
      const rel = `${w.year}/${workKey(w.slug, w.id)}`;
      const info = await readJson(path.join(publicDir, workImageDir(w.year, workKey(w.slug, w.id)), 'info.json'));
      const mockupScenes = info ? (info.mockups ?? []).map((m) => m.scene) : null;
      expected.set(rel, expectedExports({ status: w.data.status, details: w.details.map((d) => d.name), mockupScenes, instagram: wantsInstagram(w.data) }));
    }
    for (const sub of ['instagram', 'fler']) {
      const root = path.join(exportRoot, sub);
      const wantedExports = new Map([...expected].map(([rel, e]) => [rel, e[sub]]));
      for (const rel of planExportPrune((await listGenerated(root, '.jpg')).map((f) => `${f}.jpg`), wantedExports)) {
        await fs.rm(path.join(root, rel));
        pruned.push(`export/${sub}/${rel}`);
      }
    }
    for (const sub of ['instagram', 'fler']) await removeEmptyYearDirs(path.join(exportRoot, sub));
  }

  // Other photos (portrait, studio): public/fotky/<name>/ (images), content/fotky/<name>.yaml (alt, caption, focus)
  for (const photo of photos.photos) {
    if (only.length && !only.includes(photo.name)) continue;
    await writeCopy(photoCopyPath(photo.name), photo.data, PUBLIC_PHOTO_FIELDS);
    outputs.add(photoDir(photo.name));
    if (await photoSet(photo.masterPath, path.join(publicDir, photoDir(photo.name)), img, {}, { force, log, label: `fotky/${photo.name}` })) processed++;
    else skipped++;
  }

  /**
   * Own cover photo (_cover/) and share image of the chosen cover (og.jpg) in the folder of a page.
   * `photoPath`: the own cover photo or null, `source`: coverShareSource/coverSource or null. One no longer used
   * is removed by the final prune of a full run (and so reported), right away in a run of `only`.
   */
  const pageCover = async (pageDir, { photoPath, alt, source, label }) => {
    const dir = path.join(publicDir, coverDir(pageDir));
    if (photoPath) {
      outputs.add(coverDir(pageDir));
      if (await photoSet(photoPath, dir, img, { alt }, { force, log, label })) processed++;
      else skipped++;
    } else if (only.length) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    if (source) {
      outputs.add(ogFile(pageDir));
      await shareCrop(source, path.join(publicDir, ogFile(pageDir)), `og ${label}`);
    } else if (only.length) {
      await fs.rm(path.join(publicDir, ogFile(pageDir)), { force: true });
    }
  };

  // Collections: content/tvorba/<slug>/_index.yaml (public fields); in public/tvorba/kolekce/<slug>/ the own cover
  // photo (_cover/) and the share image of the cover (og.jpg) cropped exactly like the page shows it.
  // Share images are cheap to render, so always rendered; written only when the bytes change.
  for (const c of collections.collections) {
    if (only.length && !only.includes(c.slug)) continue;
    await writeCopy(collectionCopyPath(c.slug), c.data, PUBLIC_COLLECTION_FIELDS);
    await pageCover(collectionPageDir(c.slug), { photoPath: c.coverPath, alt: c.data.title ?? '', source: coverSource(c, works), label: `kolekce/${c.slug}` });
  }

  // Years: content/roky/<year>.yaml (text and cover); in public/tvorba/<year>/ the own cover photo (_cover/) and the
  // share image of a chosen cover (og.jpg, cropped around focus).
  for (const y of years.years) {
    if (only.length && !only.includes(y.year)) continue;
    await writeCopy(yearCopyPath(y.year), y.data, PUBLIC_YEAR_FIELDS);
    const source = coverShareSource({ photoPath: y.coverPath, data: y.data, works: works.filter((w) => w.year === y.year) });
    await pageCover(yearPageDir(y.year), { photoPath: y.coverPath, alt: `Tvorba ${y.year}`, source, label: `roky/${y.year}` });
  }

  // Home page: content/_index.yaml (text and cover); public/_cover/ (own cover photo), public/og.jpg (chosen cover).
  if (home.home && !only.length) {
    const h = home.home;
    await writeCopy(HOME_COPY, h.data, PUBLIC_HOME_FIELDS);
    const source = coverShareSource({ photoPath: h.coverPath, data: h.data, works });
    await pageCover(HOME_PAGE_DIR, { photoPath: h.coverPath, alt: config.site?.title ?? '', source, label: 'uvod' });
  }

  // Images nobody produced in this full run: deleted, renamed or unpublished items, covers no longer used.
  if (!only.length) {
    for (const { rel, dir } of staleOutputs(siteDir, outputs)) {
      await fs.rm(path.join(publicDir, rel), { recursive: true, force: true });
      pruned.push(`public/${rel}${dir ? '/' : ''}`);
    }
    for (const root of OUTPUT_ROOTS) await removeEmptyDirs(path.join(publicDir, root)).catch(() => {});
  }
  // Public copies nobody wrote in this full run: deleted, renamed or unpublished items.
  if (!only.length) {
    for (const rel of staleCopies(siteDir, copies)) {
      await fs.rm(path.join(siteDir, rel));
      pruned.push(rel);
    }
    await removeEmptyDirs(path.join(siteDir, 'content'));
  }
  pruned.forEach((p) => log(`- removed ${p}`));

  return { ok: missing.length === 0, problems: [], created, assigned, detected, updated, pending, advice, tags, processed, skipped, missing, pruned, previews };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  // On GitHub Actions the result is also written to the run page.
  const summary = (r, e) => process.env.GITHUB_STEP_SUMMARY && fs.appendFile(process.env.GITHUB_STEP_SUMMARY, formatSummary(r, e));
  try {
    // --demo: the content is the test data (dry run of the workflow on GitHub, see .github/workflows/dry-run.yml)
    const r = await run({
      force: args.includes('--force'),
      prepareOnly: args.includes('--prepare-only'),
      dataset: args.includes('--demo') ? 'demo' : 'real',
      only: args.filter((a) => !a.startsWith('--')),
    });
    r.problems.forEach((p) => console.error(`✗ ${p}`));
    if (r.problems.length === 0) console.log(r.prepared ? 'Prepared: skeletons, ids and checks only.' : `Done: ${r.processed} processed, ${r.skipped} unchanged.`);
    if (r.missing.length) console.error(`Missing master photo for: ${r.missing.join(', ')}`);
    await summary(r);
    if (!r.ok) process.exitCode = 1;
  } catch (e) {
    console.error(`✗ ${e.message}`);
    await summary(null, e);
    process.exitCode = 1;
  }
}
