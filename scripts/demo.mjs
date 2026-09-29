#!/usr/bin/env node
// Test data (demo): prepares pavla/demo into .demo/ and runs the same pipeline as for the real content,
// completely apart from it:
//   demo/                       source: YAML of works, collections, photos + images.yaml (recipe of the images)
//   .demo/content/              a content repository built from demo/ (YAML copies + rendered images)
//   .demo/site/                 generated site data (content/, public/) and the built site (dist/)
// The real content (pavla-content) and this repo's content/ and public/ are never touched.
//
// Usage:  npm run demo:prepare   prepare .demo/ only
//         node scripts/demo.mjs --content-only   only .demo/content (no pipeline run), for the dry run of the
//                                                content workflow (.github/workflows/dry-run.yml)
//         npm run demo           prepare and start the dev server on the test data
//         npm run demo:build     prepare and build the site from the test data (.demo/site/dist)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { recipeProblems, renderDemoImages } from './lib/demo-images.mjs';
import { run } from './process-images.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_SUBDIRS = ['tvorba', 'fotky'];
/** Generated folders of public/ that belong to the data, not to the site itself. */
const GENERATED_PUBLIC = new Set(['works', 'photos', 'collections', 'og']);

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

/**
 * Prepares the test data and runs the pipeline on them. Returns the pipeline result
 * ({ ok: false, problems } when the recipe is broken). Options: demoDir, outDir, siteDir (this repo), config, log,
 * contentOnly (only build .demo/content, do not run the pipeline; returns { ok: true, contentDir }).
 */
export async function prepareDemo({
  demoDir = path.join(siteRoot, 'demo'),
  outDir = path.join(siteRoot, '.demo'),
  siteDir = siteRoot,
  config,
  log = console.log,
  contentOnly = false,
} = {}) {
  config ??= YAML.parse(await fs.readFile(path.join(siteDir, 'site.config.yaml'), 'utf8'));
  const recipe = YAML.parse(await fs.readFile(path.join(demoDir, 'images.yaml'), 'utf8')) ?? {};
  const broken = recipeProblems(recipe);
  if (broken.length) return { ok: false, problems: broken, created: [], assigned: [], processed: 0, skipped: 0, missing: [], pruned: [] };

  const contentDir = path.join(outDir, 'content');
  const dataDir = path.join(outDir, 'site');

  // 1. content: fresh copies of the YAML files and the rendered images (exports stay, the pipeline prunes them)
  // (kolekce/ is the former home of collections, left over from older runs)
  for (const sub of [...CONTENT_SUBDIRS, 'kolekce']) await fs.rm(path.join(contentDir, sub), { recursive: true, force: true });
  await fs.mkdir(path.join(contentDir, 'tvorba'), { recursive: true });
  const yamls = (await listYaml(demoDir)).filter((f) => CONTENT_SUBDIRS.includes(f.split(path.sep)[0]));
  for (const f of yamls) {
    await fs.mkdir(path.dirname(path.join(contentDir, f)), { recursive: true });
    await fs.copyFile(path.join(demoDir, f), path.join(contentDir, f));
  }
  await renderDemoImages(recipe, contentDir);
  if (contentOnly) return { ok: true, problems: [], contentDir };

  // 2. static files of the site (favicon …) next to the generated test data; not the domain (CNAME)
  const publicDir = path.join(dataDir, 'public');
  await fs.mkdir(publicDir, { recursive: true });
  for (const e of await fs.readdir(path.join(siteDir, 'public'), { withFileTypes: true })) {
    if (e.isFile() && e.name !== 'CNAME' && !GENERATED_PUBLIC.has(e.name)) await fs.copyFile(path.join(siteDir, 'public', e.name), path.join(publicDir, e.name));
  }

  // 3. the same pipeline as for the real content, but it must only see test data
  const result = await run({ contentDir, siteDir: dataDir, config, log, dataset: 'demo' });

  // 4. ids and skeletons written by the pipeline go back to demo/, so they stay stable
  for (const f of await listYaml(contentDir)) {
    if (!CONTENT_SUBDIRS.includes(f.split(path.sep)[0])) continue;
    const text = await fs.readFile(path.join(contentDir, f), 'utf8');
    const source = await fs.readFile(path.join(demoDir, f), 'utf8').catch(() => null);
    if (source !== text) {
      await fs.mkdir(path.dirname(path.join(demoDir, f)), { recursive: true });
      await fs.writeFile(path.join(demoDir, f), text);
      log(`+ demo/${f} updated by the pipeline`);
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const contentOnly = process.argv.includes('--content-only');
    const r = await prepareDemo({ contentOnly });
    r.problems.forEach((p) => console.error(`✗ ${p}`));
    if (r.ok && contentOnly) console.log(`Test content ready in ${path.relative(process.cwd(), r.contentDir)}/.`);
    else if (r.ok) console.log(`Test data ready in .demo/ (${r.processed} processed, ${r.skipped} unchanged).`);
    else process.exitCode = 1;
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exitCode = 1;
  }
}
