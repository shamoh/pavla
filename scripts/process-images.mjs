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
//   <contentDir>/export/<platform>/[<collection>/]<slug>/  exports, a folder per work mirroring tvorba/ (exportFolder)
//   <contentDir>/export/instagram/[<collection>/]<slug>/      Instagram:
//     caption-<palette>.jpg   the work on the paper of a palette of the site with a caption, 4:5 (scripts/lib/instagram.mjs)
//     scene-<scene>.jpg       the work in a studio scene, 4:5 (mockups/instagram/scenes.yaml)
//     detail-<name>.jpg       a detail photo cropped to 4:5
//     README.md               preview on GitHub: the photos and the text of the post (scripts/lib/export-readme.mjs)
//   (Instagram exports only for works with `meta_instagram: true`; otherwise they are removed)
//
// Copies for the public site repository contain only public fields: private_note never leaves the content repository.
//   <contentDir>/export/fler/[<collection>/]<slug>/           Fler:
//     original.jpg            the original with the author's name as watermark
//     mockup-<scene>.jpg      the mockups with the same watermark
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
import { PUBLIC_UNCOLLECTED_FIELDS, prepareUncollected } from './lib/uncollected.mjs';
import { NO_COLLECTION_TITLE } from './lib/gallery-filter.mjs';
import {
  HOME_PAGE_DIR, OUTPUT_ROOTS, UNCOLLECTED_PAGE_DIR, collectionPageDir, coverDir, ogFile, photoDir, staleOutputs, workImageDir, yearPageDir,
} from './lib/site-images.mjs';
import { HOME_COPY, MODIFIED, UNCOLLECTED_COPY, collectionCopyPath, photoCopyPath, staleCopies, workCopyPath, yearCopyPath } from './lib/site-content.mjs';
import { coverProblems, coverShareSource } from './lib/covers.mjs';
import { placeholderProblems, prepareContent } from './lib/content.mjs';
import { DEMO_MARKER, demoProblems } from './lib/demo.mjs';
import { loadScenes, pickScenes, renderMockup } from './lib/mockups.mjs';
import { WATERMARK_LOOK, watermarkSvg } from './lib/watermark.mjs';
import { exportIndex, flerReadme, instagramReadme } from './lib/export-readme.mjs';
import { captionFacts, insetWork, instagramPost, instagramSuffixes, loadFonts, loadInstagramScenes, renderCaption, renderScene, siteHost } from './lib/instagram.mjs';
import { PUBLIC_PHOTO_FIELDS, focusCrop, preparePhotos } from './lib/photos.mjs';
import { boxRegion, parseSheetXmp } from './lib/sheet-box.mjs';
import { cutOut, prepareCorners, trimTransparent, writePreviews } from './lib/corners.mjs';
import { EDGE_DEFAULTS, cutsSheet, edgeLook, innerRegion } from './lib/edges.mjs';
import { PALETTES } from './lib/palettes.mjs';
import { formatSummary } from './lib/summary.mjs';
import { hashtagAdvice, pageAdvice, tagAdvice, tagStats, techniqueAdvice, workAdvice } from './lib/advice.mjs';
import {
  EXPORT_FILES, PUBLIC_WORK_FIELDS, expectedExports, exportFileName, exportFolder, exportPattern, isOnSale, wantsInstagram, wantsMockups,
  planFolderPrune, publicFields, validSize, validateWorks, workKey,
} from './lib/works.mjs';

/** Bump when the output format changes, so every work is regenerated once. */
const PIPELINE_VERSION = 8;

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const exists = (p) => fs.access(p).then(() => true, () => false);
/** Preview of an export folder on GitHub (scripts/lib/export-readme.mjs). */
const README = 'README.md';
const readJson = (p) => fs.readFile(p, 'utf8').then(JSON.parse, () => null);
const sha1 = (...parts) => {
  const h = createHash('sha1');
  for (const p of parts) h.update(typeof p === 'string' ? p : Buffer.from(p));
  return h.digest('hex').slice(0, 16);
};

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

// A detail photo is a close-up, so it fills the whole 4:5 frame (centre crop) instead of sitting on paper.
async function instagramDetail(file, buf, img) {
  const { width: W, height: H } = img.instagram;
  await sharp(buf).rotate().toColorspace('srgb').resize(W, H, { fit: 'cover' }).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
}

/** Resizes `buf` (the original or a mockup) for Fler and signs it with the author's name (scripts/lib/watermark.mjs). */
async function fler(file, buf, img, fonts) {
  const f = img.fler;
  // a transparent surroundings of the original goes on the background of Fler (white)
  const resized = await sharp(buf).resize({ width: f.longEdge, height: f.longEdge, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: f.background ?? '#ffffff' }).toBuffer();
  const { width, height } = await sharp(resized).metadata();
  const mark = watermarkSvg({ width, height, text: f.watermark, font: fonts.serif, opacity: f.watermarkOpacity, shadow: f.watermarkShadow });
  await sharp(resized)
    .composite([{ input: Buffer.from(mark) }])
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

/**
 * Removes every export of one work, so a regeneration never leaves stale files behind: its folders on both
 * platforms (`folder`, see exportFolder) and its files of the former flat layout <year>/<key>-….
 */
async function clearExports(exportRoot, year, key, folder) {
  for (const sub of ['instagram', 'fler']) await fs.rm(path.join(exportRoot, sub, folder), { recursive: true, force: true });
  const own = exportPattern(key);
  for (const sub of ['instagram', 'fler']) {
    const dir = path.join(exportRoot, sub, year);
    if (!(await exists(dir))) continue;
    for (const f of await fs.readdir(dir)) if (own.test(f)) await fs.rm(path.join(dir, f));
  }
}

/** Every file under `root` (recursively), as paths relative to it with "/". */
async function listFiles(root) {
  if (!(await exists(root))) return [];
  const out = [];
  const walk = async (dir, rel) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), r);
      else if (e.isFile()) out.push(r);
    }
  };
  await walk(root, '');
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
  instagramScenesDir,
  fontsDir,
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
  // tvorba/_index.yaml: the cover of "Mimo kolekce" (the works without a collection) on the collections overview.
  const uncollected = await prepareUncollected(contentDir, works.some((w) => !w.collection));
  created.push(...uncollected.created);
  updated.push(...uncollected.updated);
  created.forEach((p) => log(`+ new metadata skeleton: ${p}`));
  assigned.forEach((p) => log(`+ id assigned: ${p}`));
  updated.forEach((p) => log(`~ metadata brought in line with the schema: ${p}`));
  pending.forEach((p) => log(`! published, still marked DOPLNIT: ${p}`));
  const tags = tagStats(works);
  const advice = [...workAdvice(works, { siteTitle: config.site?.title ?? '' }), ...techniqueAdvice(works), ...tagAdvice(works), ...hashtagAdvice(works, config.instagramPost), ...pageAdvice({
    collections: collections.collections, years: years.years, home: home.home, uncollected: uncollected.uncollected, photos: photos.photos,
  })];
  advice.forEach((p) => log(`? advice: ${p}`));
  const problems = [
    ...scanProblems, ...corners.problems, ...validateWorks(works), ...photos.problems, ...collections.problems, ...years.problems, ...home.problems, ...uncollected.problems,
    ...years.years.flatMap((y) => coverProblems({
      where: y.yamlPath, data: y.data, photoPath: y.coverPath, works, inScope: (w) => w.year === y.year, scope: y.year,
    })),
    ...(home.home ? coverProblems({ where: home.home.yamlPath, data: home.home.data, photoPath: home.home.coverPath, works }) : []),
    ...(uncollected.uncollected ? coverProblems({
      where: uncollected.uncollected.yamlPath, data: uncollected.uncollected.data, photoPath: uncollected.uncollected.coverPath, works,
      inScope: (w) => !w.collection, scope: 'obrazů mimo kolekce',
    }) : []),
    ...validateCollectionCovers(collections.collections, works),
    ...placeholderProblems({
      collections: collections.collections, years: years.years, home: home.home, uncollected: uncollected.uncollected, photos: photos.photos,
    }),
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
  // Instagram: captions on the papers of the palettes of the site, scenes of the studio (loaded once, when needed)
  const instagramScenes = await loadInstagramScenes(instagramScenesDir);
  const captionPalettes = PALETTES.map((p) => p.id);
  const instagramVariants = instagramSuffixes(captionPalettes, instagramScenes.scenes.map((s) => s.name));
  const instagramSettings = JSON.stringify({ ...img.instagram, host: siteHost(config.site?.url) });
  let fonts = null;

  const publicDir = path.join(siteDir, 'public');
  const exportRoot = path.join(contentDir, 'export');
  // A draft never leaves the content repository: no metadata copy, no web images, no exports.
  // Outputs it had while published are removed by the prune below.
  const published = works.filter((w) => !w.data.meta_draft);

  let processed = 0, skipped = 0;
  const missing = [];
  // works that do not fit the free part of a studio scene (their Instagram photo covers props): "Ke kontrole"
  const misfits = [];
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
    // Instagram exports also show the title, technique, size and date (caption) and depend on the scenes and settings.
    // Exports live in a folder mirroring tvorba/: a work moved to another collection gets them made again there.
    const instagramInputs = instagram
      ? [instagramScenes.text, instagramSettings, JSON.stringify([w.data.title, w.data.technique, w.data.size_cm, w.year])]
      : [];
    const folderInputs = instagram || onSale ? [exportFolder(w.yamlPath, w.slug)] : [];
    // Fler exports carry the signature: its settings and look (a change makes them again)
    const flerInputs = onSale ? [JSON.stringify([img.fler, WATERMARK_LOOK])] : [];
    const fingerprint = sha1(
      String(PIPELINE_VERSION), master, JSON.stringify(w.data.size_cm ?? null), scenesText, String(onSale), String(instagram), String(mockupsOn),
      ...instagramInputs, ...folderInputs, ...flerInputs,
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

    // Exports. Instagram: only when asked for (meta_instagram: true): the work with a caption on the paper of every
    // palette, the work in every studio scene and the detail photos; never the mockups of the site.
    // Fler: only works on sale, the original and the mockups, all with the watermark.
    const folder = exportFolder(w.yamlPath, w.slug);
    await clearExports(exportRoot, w.year, key, folder);
    if (instagram) {
      const insta = path.join(exportRoot, 'instagram', folder);
      await fs.mkdir(insta, { recursive: true });
      fonts ??= await loadFonts(fontsDir);
      const art = await insetWork(m.buf, img.instagram.insetPercent ?? 0);
      const host = siteHost(config.site?.url);
      for (const p of PALETTES) {
        const buf = await renderCaption({ art, work: w.data, year: w.year, host, colors: p.colors, fonts, config: img.instagram });
        await fs.writeFile(path.join(insta, exportFileName(`-caption-${p.id}`)), buf);
      }
      if (validSize(w.data.size_cm)) {
        for (const scene of instagramScenes.scenes) {
          const { buf, placement } = await renderScene({ art, work: { ...w.data, id: w.id }, scene, config: img.instagram });
          if (!placement.fits) {
            log(`  ! ${rel}: does not fit the free part of the scene ${scene.name} (see mockups/instagram/scenes.yaml)`);
            misfits.push(`${w.yamlPath}: obraz se na „${scene.label ?? scene.name}“ nevejde mimo rekvizity, `
              + `na fotce export/instagram/${folder}/${exportFileName(`-scene-${scene.name}`)} je částečně `
              + 'zakrývá (tuhle fotku raději nepoužij)');
          }
          await fs.writeFile(path.join(insta, exportFileName(`-scene-${scene.name}`)), buf);
        }
      }
      for (const d of details) await instagramDetail(path.join(insta, exportFileName(`-detail-${d.name}`)), d.buf, img);
    }
    if (onSale) {
      const flerDir = path.join(exportRoot, 'fler', folder);
      await fs.mkdir(flerDir, { recursive: true });
      fonts ??= await loadFonts(fontsDir);
      await fler(path.join(flerDir, exportFileName('')), m.buf, img, fonts);
      for (const mk of mockups) await fler(path.join(flerDir, exportFileName(`-mockup-${mk.scene}`)), mk.buf, img, fonts);
    }
    processed++;
    return true;
  };

  // titles of the collections by slug, for the text of Instagram posts
  const collectionTitles = new Map(collections.collections.map((c) => [c.slug, typeof c.data?.title === 'string' ? c.data.title : '']));
  for (const w of published) {
    if (only.length && !only.includes(w.slug)) continue;
    const key = workKey(w.slug, w.id);
    outputs.add(workImageDir(w.year, key));
    const imagesChanged = await workImages(w, key, `${w.year}/${key}`);
    await writeWorkCopy(w, imagesChanged);
    // The text of an Instagram post and the README.md previews of the export folders: cheap, so written by every run
    // (they follow the description, tags and price at once).
    const folder = exportFolder(w.yamlPath, w.slug);
    const about = { collection: collectionTitles.get(w.collection) ?? '', pageUrl: `${String(config.site?.url ?? '').replace(/\/+$/, '')}/${workImageDir(w.year, key)}/` };
    if (wantsInstagram(w.data)) {
      const text = instagramPost({
        work: w.data, year: w.year, host: siteHost(config.site?.url), onSale: isOnSale(w.data.status), settings: config.instagramPost,
        collection: collectionTitles.get(w.collection) ?? '',
      });
      const files = {
        captions: captionPalettes.map((p) => exportFileName(`-caption-${p}`)),
        scenes: validSize(w.data.size_cm) ? instagramScenes.scenes.map((sc) => exportFileName(`-scene-${sc.name}`)) : [],
        details: w.details.map((d) => exportFileName(`-detail-${d.name}`)),
      };
      await writeIfChanged(path.join(exportRoot, 'instagram', folder, README), instagramReadme({ work: w.data, year: w.year, files, post: text, ...about }));
    }
    if (isOnSale(w.data.status)) {
      const info = await readJson(path.join(publicDir, workImageDir(w.year, key), 'info.json'));
      const files = { original: [exportFileName('')], mockups: (info?.mockups ?? []).map((mk) => exportFileName(`-mockup-${mk.scene}`)) };
      await writeIfChanged(path.join(exportRoot, 'fler', folder, README), flerReadme({ work: w.data, year: w.year, files, ...about }));
    }
  }

  const pruned = [];
  if (!only.length) {
    // Stale exports, independent of whether the work was regenerated in this run: exports of deleted, renamed
    // or draft works, of detail photos and mockup scenes a work no longer has, Fler exports of works not on sale.
    // folder of a work (exportFolder) -> the file names it should have there (null = any, state unknown), per platform
    const wanted = { instagram: new Map(), fler: new Map() };
    for (const w of published) {
      const info = await readJson(path.join(publicDir, workImageDir(w.year, workKey(w.slug, w.id)), 'info.json'));
      const mockupScenes = info ? (info.mockups ?? []).map((m) => m.scene) : null;
      const variants = validSize(w.data.size_cm) ? instagramVariants : instagramVariants.filter((v) => !v.startsWith('-scene-'));
      const e = expectedExports({ status: w.data.status, details: w.details.map((d) => d.name), mockupScenes, instagram: wantsInstagram(w.data), instagramVariants: variants });
      const folder = exportFolder(w.yamlPath, w.slug);
      for (const sub of ['instagram', 'fler']) {
        if (e[sub] === null) wanted[sub].set(folder, null);
        else if (e[sub].length) wanted[sub].set(folder, new Set(e[sub].map(exportFileName)));
      }
    }
    // every folder has its README.md; the overview of a platform lists its works (only when it has any)
    for (const sub of ['instagram', 'fler']) for (const names of wanted[sub].values()) names?.add(README);
    const overview = { instagram: [], fler: [] };
    for (const w of published) {
      const folder = exportFolder(w.yamlPath, w.slug);
      const collection = collectionTitles.get(w.collection);
      const facts = [captionFacts(w.data, w.year), collection].filter(Boolean).join(' · ');
      if (wantsInstagram(w.data)) overview.instagram.push({ title: w.data.title, folder, thumb: exportFileName('-caption-papir'), note: facts });
      if (isOnSale(w.data.status)) {
        const price = typeof w.data.price === 'number' ? `${w.data.price.toLocaleString('cs-CZ')} Kč` : '';
        overview.fler.push({ title: w.data.title, folder, thumb: exportFileName(''), note: [facts, price].filter(Boolean).join(' · ') });
      }
    }
    for (const sub of ['instagram', 'fler']) {
      if (!overview[sub].length) continue;
      overview[sub].sort((a, b) => a.folder.localeCompare(b.folder));
      wanted[sub].set('', new Set([README]));
      await writeIfChanged(path.join(exportRoot, sub, README), exportIndex(sub, overview[sub]));
    }
    for (const sub of ['instagram', 'fler']) {
      const root = path.join(exportRoot, sub);
      for (const rel of planFolderPrune(await listFiles(root), wanted[sub], EXPORT_FILES[sub])) {
        await fs.rm(path.join(root, rel));
        pruned.push(`export/${sub}/${rel}`);
      }
      await removeEmptyDirs(root);
    }
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

  // Works without a collection: content/tvorba/_index.yaml (cover); public/tvorba/_cover/ (own cover photo). The
  // item "Mimo kolekce" has no page of its own, so no share image.
  // Only while some published work is without a collection (otherwise the site shows no such item).
  if (uncollected.uncollected && !only.length && works.some((w) => !w.collection && !w.data.meta_draft)) {
    const u = uncollected.uncollected;
    await writeCopy(UNCOLLECTED_COPY, u.data, PUBLIC_UNCOLLECTED_FIELDS);
    await pageCover(UNCOLLECTED_PAGE_DIR, { photoPath: u.coverPath, alt: NO_COLLECTION_TITLE, source: null, label: 'mimo-kolekce' });
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

  return { ok: missing.length === 0, problems: [], created, assigned, detected, updated, pending, advice, tags, processed, skipped, missing, pruned, previews, misfits };
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
