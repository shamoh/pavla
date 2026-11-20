#!/usr/bin/env node
// Checks a built site (after `npm run build`) the same way the weekly health check checks the deployed one: every
// image its pages refer to exists (scripts/lib/site-check.mjs), from the home page, the sitemap and their links.
// Also every built page search engines may index is in the sitemap (unlistedPages: a page forgotten in STATIC_PAGES),
// and has its own title and description and valid structured data (pageProblems, scripts/lib/page-check.mjs),
// and every link to a page ends with a slash (slashlessLinks, scripts/lib/page-links.mjs), and every inline script that
// runs on an element before it finds it and every data-view is a valid grid setup (inlineScriptProblems, scripts/lib/inline-targets.mjs).
// Usage:  npm run check:images                     dist/ of the site folder (SITE_DIR, this repo by default)
//         SITE_DIR=.demo/site npm run check:images   the site built from the test data (npm run demo:build)
//         npm run check:images -- <folder>          any other built site
// Exit code 1 when an image or a page is missing, a page is missing in the sitemap or has a problem in its texts,
// a link to a page lacks its trailing slash, or an inline script misses its element.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { checkSiteImages, distFetch, evaluateSiteImages } from './lib/site-check.mjs';
import { isNoindex, sitemapUrls, unlistedPages } from './lib/sitemap.mjs';
import { pageProblems, problemText } from './lib/page-check.mjs';
import { slashlessLinks } from './lib/page-links.mjs';
import { inlineProblemText, inlineScriptProblems } from './lib/inline-targets.mjs';
import { siteDirectory, sitePaths } from './lib/site-dir.mjs';

const sitePlaces = sitePaths(siteDirectory());
const distDir = path.resolve(process.argv[2] ?? sitePlaces.dist);
try {
  await fs.access(path.join(distDir, 'index.html'));
} catch {
  console.error(`✗ No built site in ${path.relative(process.cwd(), distDir) || '.'}: run "npm run build" first`);
  process.exit(1);
}
const config = YAML.parse(await fs.readFile(sitePlaces.config, 'utf8'));
const result = evaluateSiteImages(await checkSiteImages(config.site.url, distFetch(distDir), { screenshots: false }));
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
  textProblems.forEach((p) => console.log(`  ${p.path}: ${problemText(p)} [${p.code}]`));
  process.exitCode = 1;
} else console.log(`✓ ${indexable.length} indexable pages: own titles and descriptions, valid structured data.`);

// Links to pages always with the trailing slash (scripts/lib/page-links.mjs): without it GitHub Pages redirects.
const slashless = slashlessLinks(pages);
if (slashless.length) {
  console.log(`✗ Links to pages without the trailing slash (${slashless.length}; write them with withTrailingSlash or as "/…/"):`);
  slashless.forEach((l) => console.log(`  ${l.path}: ${l.href}`));
  process.exitCode = 1;
} else console.log('✓ Every link to a page ends with a slash.');

// Inline scripts on an element before them (the view of a grid, the random cover): each finds its element by its
// attribute, none takes just the element right before it, every data-view is a valid grid setup (scripts/lib/inline-targets.mjs).
const inlineProblems = inlineScriptProblems(pages);
if (inlineProblems.length) {
  console.log(`✗ Inline scripts and their elements (${inlineProblems.length}):`);
  inlineProblems.forEach((p) => console.log(`  ${p.path}: ${inlineProblemText(p)} [${p.code}]`));
  process.exitCode = 1;
} else console.log('✓ Every inline script finds its element, every data-view is a valid grid setup.');
