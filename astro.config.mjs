import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const config = YAML.parse(fs.readFileSync(new URL('./site.config.yaml', import.meta.url), 'utf8'));

// SITE_DATA_DIR (set by `npm run demo`) builds the site from the test data in .demo/site instead of this repo.
const dataDir = process.env.SITE_DATA_DIR;

export default defineConfig({
  site: config.site.url,
  publicDir: dataDir ? path.join(dataDir, 'public') : './public',
  outDir: dataDir ? path.join(dataDir, 'dist') : './dist',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
