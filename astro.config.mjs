import { defineConfig } from 'astro/config';
import path from 'node:path';
import { readSiteConfig, siteDirectory, sitePaths } from './scripts/lib/site-dir.mjs';

// The folder of the site (SITE_DIR, scripts/lib/site-dir.mjs): its settings, static files and the built site.
const siteDir = siteDirectory();
const config = readSiteConfig(siteDir);

// SITE_DATA_DIR (set by `npm run demo`) builds the site from the test data in .demo/site instead of this repo.
const dataDir = process.env.SITE_DATA_DIR;
const paths = sitePaths(siteDir);

export default defineConfig({
  site: config.site.url,
  publicDir: dataDir ? path.join(dataDir, 'public') : paths.public,
  outDir: dataDir ? path.join(dataDir, 'dist') : paths.dist,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
