#!/usr/bin/env node
// Checks a built site (after `npm run build`) the same way the weekly health check checks the deployed one: every
// image its pages refer to exists (scripts/lib/site-check.mjs), from the home page, the sitemap and their links.
// Usage:  npm run check:images                     dist/ of this repo
//         SITE_DATA_DIR=.demo/site npm run check:images   the site built from the test data (npm run demo:build)
//         npm run check:images -- <folder>          any other built site
// Exit code 1 when an image or a page is missing.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { checkSiteImages, distFetch, evaluateSiteImages } from './lib/site-check.mjs';

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
