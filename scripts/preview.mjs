#!/usr/bin/env node
// Cut previews of master photos, to check locally what the pipeline does with the floor around a sheet
// (scripts/lib/edges.mjs) before it writes anything. Reads only, unless --write: then the detected corners go into
// the descriptions of exactly these photos that have none yet (nothing else is ever changed).
//
// Usage:  npm run preview -- <photo or folder>
//   photo    one master photo (e.g. tvorba/rano-u-rybnika.jpg of the content repository)
//   folder   every master photo in it and in its collection folders (tvorba/, or one collection);
//            detail photos (a folder named like a work next to it) and own cover photos (_cover.*) are left out
//   --out <dir>  where the previews go (default .previews/ of this repository, outside git)
//   --write      write the detected corners into the descriptions of these photos that have no meta_corners yet
//                (as the pipeline would); corners already there (set by hand, or of another photo) are left alone
//   --only-suspicious  previews and output only for the photos with a corner cutting more than
//                images.edges.suspicious (not with --write: writing just the doubtful corners would be the wrong way round)
//
// For every photo: the corners from meta_corners of its description (<slug>.yaml next to it); without them (or
// with corners of another photo) the corners are detected and printed as YAML, ready to be copied into the
// description. Then the same preview as the pipeline makes for drafts: <out>/<slug>.jpg, the result on light
// and dark paper side by side, with a thin line along the corners and how much each corner cuts (% of the photo,
// red above images.edges.suspicious); the same shares are printed, "!" marks a suspicious corner, and at the end
// the photos with a suspicious corner are listed once more. Settings: images.edges in site.config.yaml.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { cornersYaml, detectFile, masterSize, previewOf, withCorners } from './lib/corners.mjs';
import { CORNER_KEYS, EDGE_DEFAULTS, cornerShares, cornersProblems, cutsSheet, percent } from './lib/edges.mjs';
import { IMAGE_EXTENSIONS, slugify, splitExt } from './lib/works.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const isPhoto = (name) => !name.startsWith('.') && !name.startsWith('_') && IMAGE_EXTENSIONS.includes(splitExt(name).ext);

/**
 * Master photos of `target`: the file itself, or the photos in the folder and in its subfolders, except detail
 * folders (named like a work next to them), hidden ones and own cover photos; sorted.
 */
export async function listMasters(target) {
  if ((await fs.stat(target)).isFile()) return [target];
  const entries = (await fs.readdir(target, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const works = new Set(entries.filter((e) => e.isFile() && (isPhoto(e.name) || /\.ya?ml$/.test(e.name))).map((e) => slugify(splitExt(e.name).base)));
  const out = [];
  for (const e of entries) {
    if (e.isFile() && isPhoto(e.name)) out.push(path.join(target, e.name));
    else if (e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_') && e.name !== 'export' && !works.has(slugify(e.name))) {
      out.push(...(await listMasters(path.join(target, e.name))));
    }
  }
  return out;
}

/**
 * Corners of one master: from its description when they fit the photo, otherwise detected.
 * Returns { value, source: 'yaml' | 'off' | 'detected', note, yamlPath, text (of the description, null without one),
 * writable (detected for a description without meta_corners: --write may add them) }.
 */
export async function cornersFor(photo, search = EDGE_DEFAULTS.search) {
  const yamlPath = path.join(path.dirname(photo), `${slugify(splitExt(path.basename(photo)).base)}.yaml`);
  const text = await fs.readFile(yamlPath, 'utf8').catch(() => null);
  const data = text === null ? null : YAML.parse(text) ?? {};
  const own = data?.meta_corners;
  const base = { yamlPath, text, writable: false };
  if (own === false) return { ...base, value: false, source: 'off', note: 'meta_corners: false, nothing is cut' };
  if (own !== undefined) {
    const { width, height } = await masterSize(photo);
    const problems = cornersProblems(own, width, height, path.basename(yamlPath));
    if (!problems.length) return { ...base, value: own, source: 'yaml', note: `corners from ${path.basename(yamlPath)}` };
    return { ...base, value: await detectFile(photo, search), source: 'detected', note: `${problems[0]}; detected instead` };
  }
  const value = await detectFile(photo, search);
  if (!data) return { ...base, value, source: 'detected', note: 'no description, detected' };
  return { ...base, value, source: 'detected', note: `no meta_corners in ${path.basename(yamlPath)}, detected`, writable: true };
}

/** How much each corner cuts, one line: "tl 2.5 % · 1.7 %, …", "!" after a corner cutting more than `limit`. */
export function sharesLine(value, limit = EDGE_DEFAULTS.suspicious) {
  const { shares, suspicious } = cornerShares(value, limit);
  return CORNER_KEYS.map((k) => `${k} ${percent(shares[k][0])} · ${percent(shares[k][1])}${suspicious.includes(k) ? ' !' : ''}`).join(', ');
}

/**
 * The end of the output: the photos with a corner cutting more than `limit` ({ rel, name, value } each), with how
 * much their corners cut and where their preview is (`previewPath(name)`); one line when there is none.
 */
export function suspiciousSummary(flagged, limit, previewPath = (n) => n) {
  if (!flagged.length) return `No corner cuts more than ${percent(limit)}.\n`;
  const lines = [`Check first: ${flagged.length} photo(s) with a corner cutting more than ${percent(limit)}:`];
  for (const f of flagged) lines.push(`  ${f.rel}  (${previewPath(f.name)})`, `    ${sharesLine(f.value, limit)}`);
  return `${lines.join('\n')}\n`;
}

/**
 * --write for one photo (the result of cornersFor): adds the detected corners to its description when it has none.
 * Returns what happened, for the output.
 */
export async function writeDetected(found) {
  const name = path.basename(found.yamlPath);
  if (found.writable) {
    const r = withCorners(found.text, found.value);
    if (r.problem) return `not written: ${name}: ${r.problem}`;
    await fs.writeFile(found.yamlPath, r.text);
    return `written into ${name}`;
  }
  if (found.source !== 'detected') return null;
  return found.text === null
    ? 'not written: no description yet (the pipeline creates it, with the corners)'
    : `not written: ${name} already has meta_corners (delete them first to replace them)`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  const cwd = process.env.INIT_CWD ?? process.cwd();
  try {
    if (!target) throw new Error('usage: npm run preview -- <photo or folder> [--out dir] [--write | --only-suspicious]');
    const onlySuspicious = args.includes('--only-suspicious');
    if (onlySuspicious && args.includes('--write')) {
      throw new Error('--only-suspicious cannot be combined with --write: it would write just the doubtful corners');
    }
    if (args.includes('--out') && !opt('--out')) throw new Error('--out needs a folder');
    const config = YAML.parse(await fs.readFile(path.join(siteRoot, 'site.config.yaml'), 'utf8'));
    const edges = { ...EDGE_DEFAULTS, ...config.images?.edges };
    const outDir = path.resolve(cwd, opt('--out') ?? path.join(siteRoot, '.previews'));
    const photos = await listMasters(path.resolve(cwd, target));
    if (!photos.length) throw new Error(`no photos in ${target}`);
    await fs.mkdir(outDir, { recursive: true });
    const write = args.includes('--write');
    let written = 0;
    const flagged = [];
    for (const photo of photos) {
      const found = await cornersFor(photo, edges.search);
      const { value, source, note } = found;
      const rel = path.relative(cwd, photo);
      if (source === 'off') {
        if (!onlySuspicious) console.log(`· ${rel}: ${note}\n`);
        continue;
      }
      const name = `${slugify(splitExt(path.basename(photo)).base)}.jpg`;
      const doubtful = cutsSheet(value) && cornerShares(value, edges.suspicious).suspicious.length > 0;
      if (onlySuspicious && !doubtful) continue;
      await fs.writeFile(path.join(outDir, name), await previewOf(photo, value, edges));
      console.log(`→ ${rel}: ${note}${cutsSheet(value) ? '' : ' (the sheet fills the photo, nothing is cut)'}`);
      console.log(`  preview: ${path.relative(cwd, path.join(outDir, name))}`);
      if (cutsSheet(value)) {
        console.log(`  cut (% of the photo, ! = more than ${percent(edges.suspicious)}): ${sharesLine(value, edges.suspicious)}`);
        if (doubtful) flagged.push({ rel, name, value });
      }
      if (source === 'detected') console.log(cornersYaml(value).replace(/^/gm, '  '));
      if (write) {
        const done = await writeDetected(found);
        if (done) console.log(`  ${done}`);
        if (done?.startsWith('written')) written++;
      }
      console.log('');
    }
    console.log(suspiciousSummary(flagged, edges.suspicious, (n) => path.relative(cwd, path.join(outDir, n))));
    console.log(`Done: ${photos.length} photo(s)${onlySuspicious ? `, previews only of the ${flagged.length} suspicious one(s)` : ''}, previews in ${outDir}. `
      + (write ? `Corners written into ${written} description(s), nothing else changed.` : 'Nothing was written to the content.'));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  }
}
