// Writes the prototype pages (scripts/lib/prototypes.mjs) over the site data: npm run prototypes [-- <folder>].
//   npm run prototypes                                   the real data of this repo (content/, public/) into .prototypes/
//   SITE_DATA_DIR=.demo/site npm run prototypes          the test data (npm run demo:prepare first)
// Open the written files straight from the disk (open .prototypes/zarovnani-sloupcu.html); they load the pictures from
// public/ of the data, so they work only next to it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { writePrototypes } from './lib/prototypes.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = process.env.SITE_DATA_DIR ? path.resolve(root, process.env.SITE_DATA_DIR) : root;
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.prototypes'));
const config = YAML.parse(fs.readFileSync(path.join(root, 'site.config.yaml'), 'utf8'));
const files = writePrototypes({ dataRoot, outDir, templatesDir: path.join(root, 'scripts', 'prototypes'), config });
for (const file of files) console.log(`Written: ${path.relative(process.cwd(), file)}`);
