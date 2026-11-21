import { defineConfig } from 'astro/config';
import { readSiteConfig, siteDirectory, sitePaths } from './scripts/lib/site-dir.mjs';
import { STORAGE_PREFIX_GLOBAL, storagePrefixOf } from './scripts/lib/storage-prefix.mjs';

// The folder of the site (SITE_DIR, scripts/lib/site-dir.mjs): its settings, static files and the built site.
// `npm run demo` builds the test site from its folder .demo/site (SITE_DIR=.demo/site).
const siteDir = siteDirectory();
const config = readSiteConfig(siteDir);
const paths = sitePaths(siteDir);

export default defineConfig({
  site: config.site.url,
  publicDir: paths.public,
  outDir: paths.dist,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // the prefix of what the browser of a visitor remembers (site.storagePrefix, scripts/lib/storage-prefix.mjs)
  vite: { define: { [STORAGE_PREFIX_GLOBAL]: JSON.stringify(storagePrefixOf(config)) } },
});
