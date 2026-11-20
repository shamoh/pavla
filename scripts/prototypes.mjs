// Writes the prototype pages (scripts/lib/prototypes.mjs) over the site data: npm run prototypes [-- <folder>].
//   npm run prototypes                                   the real data of this repo (content/, public/) into .prototypes/
//   SITE_DIR=.demo/site npm run prototypes               the test data (npm run demo:prepare first)
// Open the written files straight from the disk (open .prototypes/zarovnani-sloupcu.html); they load the pictures from
// public/ of the data, so they work only next to it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareGame, prototypeColors, prototypeWorks, writePrototypes } from './lib/prototypes.mjs';
import { loadInstagramScenes } from './lib/instagram.mjs';
import { planWorks, readPlan } from './lib/game-plan.mjs';
import { readSiteConfig, siteDirectory, sitePaths } from './lib/site-dir.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// the site and its data: SITE_DIR (scripts/lib/site-dir.mjs), e.g. .demo/site for the test data
const siteDir = siteDirectory();
const dataRoot = siteDir;
const outDir = path.resolve(process.argv[2] ?? path.join(root, '.prototypes'));
const config = readSiteConfig(siteDir);
const { scenes } = await loadInstagramScenes(sitePaths(siteDir).instagramScenes);
// the game as the site prepares it (the works with their colour profile) and the whole plan of its days (every year at once)
const game = { ...await prepareGame(await planWorks(dataRoot, config), dataRoot), plan: { ...await readPlan(dataRoot), archive: [] } };
const colors = await prototypeColors(prototypeWorks(dataRoot), dataRoot);
const files = writePrototypes({ dataRoot, outDir, templatesDir: path.join(root, 'scripts', 'prototypes'), config, scenes, game, colors });
for (const file of files) console.log(`Written: ${path.relative(process.cwd(), file)}`);
