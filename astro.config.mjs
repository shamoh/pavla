import { defineConfig } from 'astro/config';
import fs from 'node:fs';
import YAML from 'yaml';

const config = YAML.parse(fs.readFileSync(new URL('./site.config.yaml', import.meta.url), 'utf8'));

export default defineConfig({
  site: config.site.url,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
