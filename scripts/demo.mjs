#!/usr/bin/env node
// Test data (demo): prepares pavla/demo-content into .demo/ and runs the same pipeline as for the real content,
// completely apart from it:
//   demo-content/               source: a made-up content repository (its YAML, the marker demo-content.yaml)
//                               + images.yaml (recipe of the images, no binary files in git)
//   demo-content/site/          source of the folder of the test site (scripts/lib/site-dir.mjs): its own
//                               site.config.yaml (demo: true), fonts, mockup scenes, icons
//   .demo/content/              a content repository built from demo-content/ (YAML copies + rendered images)
//   .demo/site/                 the folder of the test site: demo-content/site/ + generated data (content/, public/,
//                               game/) and the built site (dist/); SITE_DIR=.demo/site builds and checks it
// The real content (the content repository) and the real site (its folder) are never touched.
//
// Usage:  npm run demo:prepare   prepare .demo/ only
//         node scripts/demo.mjs --content-only   only .demo/content (no pipeline run), for the dry run of the
//                                                content workflow (.github/workflows/dry-run.yml)
//         npm run demo           prepare and start the dev server on the test data
//         npm run demo:build     prepare and build the site from the test data (.demo/site/dist)

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { recipeProblems, renderDemoImages } from './lib/demo-images.mjs';
import { INDEX_FILE } from './lib/content.mjs';
import { DEMO_MARKER } from './lib/demo.mjs';
import { PAGES_SUBDIR } from './lib/pages.mjs';
import { OUTPUT_ROOTS } from './lib/site-images.mjs';
import { run } from './process-images.mjs';
import { CODE_ROOT, readSiteConfig, sitePaths } from './lib/site-dir.mjs';

const CONTENT_SUBDIRS = ['tvorba', 'fotky', 'roky', PAGES_SUBDIR];
/** Files in the root of the content: the home page and the marker of the test data. */
const CONTENT_FILES = [INDEX_FILE, DEMO_MARKER];
const isContent = (f) => CONTENT_SUBDIRS.includes(f.split(path.sep)[0]) || CONTENT_FILES.includes(f);
/** Generated folders of public/ that belong to the data, not to the site itself. */
const GENERATED_PUBLIC = new Set(OUTPUT_ROOTS);

async function listYaml(dir, rel = '') {
  const out = [];
  let entries = [];
  try { entries = await fs.readdir(path.join(dir, rel), { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) out.push(...(await listYaml(dir, r)));
    else if (/\.ya?ml$/.test(e.name)) out.push(r);
  }
  return out;
}

/** What the source of a site folder holds (copied as a whole, folders replaced), besides the files of public/. */
export const SITE_SOURCE_ENTRIES = (paths) => [paths.config, paths.homeScreenIcon, paths.fonts, paths.mockups];

/**
 * Makes `target` the folder of a site from its source `source`: settings, icon, fonts and mockup scenes replaced,
 * the static files of public/ copied next to the generated data (never the domain CNAME nor generated folders).
 */
export async function assembleSite(source, target) {
  const from = sitePaths(source);
  const to = sitePaths(target);
  const entries = SITE_SOURCE_ENTRIES(from);
  const targets = SITE_SOURCE_ENTRIES(to);
  await fs.mkdir(to.public, { recursive: true });
  for (const [i, entry] of entries.entries()) {
    await fs.rm(targets[i], { recursive: true, force: true });
    await fs.cp(entry, targets[i], { recursive: true });
  }
  for (const e of await fs.readdir(from.public, { withFileTypes: true }).catch(() => [])) {
    if (e.isFile() && e.name !== 'CNAME' && !GENERATED_PUBLIC.has(e.name)) await fs.copyFile(path.join(from.public, e.name), path.join(to.public, e.name));
  }
}

/**
 * Prepares the test data and runs the pipeline on them. Returns the pipeline result
 * ({ ok: false, problems } when the recipe is broken). Options: demoDir, outDir, siteSource (source of the folder
 * of the test site, demo-content/site/), config (default: its site.config.yaml), log,
 * contentOnly (only build .demo/content and the folder of the test site .demo/site, do not run the pipeline; returns
 * { ok: true, contentDir, siteDir }: the inputs of the dry run, .github/workflows/dry-run.yml).
 */
export async function prepareDemo({
  demoDir = path.join(CODE_ROOT, 'demo-content'),
  outDir = path.join(CODE_ROOT, '.demo'),
  siteSource = path.join(demoDir, 'site'),
  config,
  log = console.log,
  contentOnly = false,
} = {}) {
  const recipe = YAML.parse(await fs.readFile(path.join(demoDir, 'images.yaml'), 'utf8')) ?? {};
  const broken = recipeProblems(recipe);
  if (broken.length) return { ok: false, problems: broken, created: [], assigned: [], processed: 0, skipped: 0, missing: [], pruned: [] };

  const contentDir = path.join(outDir, 'content');
  const dataDir = path.join(outDir, 'site');

  // 1. content: fresh copies of the YAML files and the rendered images (exports stay, the pipeline prunes them)
  for (const sub of [...CONTENT_SUBDIRS, ...CONTENT_FILES]) await fs.rm(path.join(contentDir, sub), { recursive: true, force: true });
  for (const f of await fs.readdir(contentDir).catch(() => [])) if (/^_cover\.(jpe?g|png|webp)$/.test(f)) await fs.rm(path.join(contentDir, f));
  await fs.mkdir(path.join(contentDir, 'tvorba'), { recursive: true });
  const yamls = (await listYaml(demoDir)).filter(isContent);
  for (const f of yamls) {
    await fs.mkdir(path.dirname(path.join(contentDir, f)), { recursive: true });
    await fs.copyFile(path.join(demoDir, f), path.join(contentDir, f));
  }
  await renderDemoImages(recipe, contentDir);

  // 2. the folder of the test site: its settings, icons, fonts and scenes next to the generated test data
  await assembleSite(siteSource, dataDir);
  if (contentOnly) return { ok: true, problems: [], contentDir, siteDir: dataDir };
  config ??= readSiteConfig(dataDir);

  // 3. the same pipeline as for the real content, but it must only see test data and the test site
  const result = await run({ contentDir, siteDir: dataDir, config, log, dataset: 'demo', gamePlan: true });

  // 4. ids and skeletons written by the pipeline go back to demo-content/, so they stay stable
  for (const f of await listYaml(contentDir)) {
    if (!isContent(f)) continue;
    const text = await fs.readFile(path.join(contentDir, f), 'utf8');
    const source = await fs.readFile(path.join(demoDir, f), 'utf8').catch(() => null);
    if (source !== text) {
      await fs.mkdir(path.dirname(path.join(demoDir, f)), { recursive: true });
      await fs.writeFile(path.join(demoDir, f), text);
      log(`+ demo-content/${f} updated by the pipeline`);
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const contentOnly = process.argv.includes('--content-only');
    const r = await prepareDemo({ contentOnly });
    r.problems.forEach((p) => console.error(`✗ ${p}`));
    if (r.ok && contentOnly) console.log(`Test content ready in ${path.relative(process.cwd(), r.contentDir)}/, the test site in ${path.relative(process.cwd(), r.siteDir)}/.`);
    else if (r.ok) console.log(`Test data ready in .demo/ (${r.processed} processed, ${r.skipped} unchanged).`);
    else process.exitCode = 1;
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  }
}
