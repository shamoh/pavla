#!/usr/bin/env node
// Checks a built site (after `npm run build`) the same way the weekly health check checks the deployed one: every
// image its pages refer to exists (scripts/lib/site-check.mjs), from the home page, the sitemap and their links.
// Also every built page search engines may index is in the sitemap (unlistedPages: a page forgotten in STATIC_PAGES),
// and has its own title and description and valid structured data (pageProblems, scripts/lib/page-check.mjs).
// Usage:  npm run check:images                     dist/ of this repo
//         SITE_DATA_DIR=.demo/site npm run check:images   the site built from the test data (npm run demo:build)
//         npm run check:images -- <folder>          any other built site
// Exit code 1 when an image or a page is missing, a page is missing in the sitemap or has a problem in its texts.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { checkSiteImages, distFetch, evaluateSiteImages } from './lib/site-check.mjs';
import { isNoindex, sitemapUrls, unlistedPages } from './lib/sitemap.mjs';
import { pageProblems, problemText } from './lib/page-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.resolve(process.argv[2] ?? (process.env.SITE_DATA_DIR ? path.join(process.env.SITE_DATA_DIR, 'dist') : path.join(root, 'dist')));
try {
  await fs.access(path.join(distDir, 'index.html'));
} catch {
  console.error(`✗ No built site in ${path.relative(process.cwd(), distDir) || '.'}: run "npm run build" first`);
  process.exit(1);
}
const config = YAML.parse(await fs.readFile(path.join(root, 'site.config.yaml'), 'utf8'));
const result = evaluateSiteImages(await checkSiteImages(config.site.url, distFetch(distDir)));
console.log(`${result.ok ? '✓' : '✗'} ${result.message}`);
if (!result.ok) process.exitCode = 1;

/** Every built page as { path: "/tvorba/2026/", html }. */
async function builtPages(dir, prefix = '/') {
  const pages = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pages.push(...await builtPages(full, `${prefix}${entry.name}/`));
    else if (entry.name === 'index.html') pages.push({ path: prefix, html: await fs.readFile(full, 'utf8') });
  }
  return pages;
}
const pages = await builtPages(distDir);
const sitemap = await fs.readFile(path.join(distDir, 'sitemap.xml'), 'utf8').catch(() => '');
const unlisted = unlistedPages(pages, sitemapUrls(sitemap));
if (unlisted.length) {
  console.log(`✗ Pages missing in the sitemap (add them to STATIC_PAGES in scripts/lib/sitemap.mjs, or mark them noindex): ${unlisted.join(', ')}`);
  process.exitCode = 1;
} else console.log('✓ Every indexable page is in the sitemap.');

const indexable = pages.filter((p) => !isNoindex(p.html));
const textProblems = pageProblems(indexable);
if (textProblems.length) {
  console.log(`✗ Titles, descriptions or structured data (${textProblems.length}):`);
  textProblems.forEach((p) => console.log(`  ${p.path}: ${problemText(p)}`));
  process.exitCode = 1;
} else console.log(`✓ ${indexable.length} indexable pages: own titles and descriptions, valid structured data.`);
