// export/detail-dne/ alone, to look at it before a change of meta_game / meta_game_skip goes to the pipeline (npm run game-export):
// reads the content repository without changing it (no skeletons, no ids, no corners), the plan of the days of this
// repository (game/detail-dne/) and the web pictures in public/ (npm run binary:pull first), and writes only export/detail-dne/
// of the content repository (out of git there) or of --out <dir>. The plan is not changed: the excluded places are drawn
// over the current details, the pipeline leaves them out of the days it plans next.
//   npm run game-export [-- --out <dir>] [-- --force]   (--force draws every picture again)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { readTree } from './lib/content.mjs';
import { EDGE_DEFAULTS } from './lib/edges.mjs';
import { contentExclusions, exclusionProblems, SKIP_KEY } from './lib/game-exclusions.mjs';
import { GAME_EXPORT_DIR, photoRegion, writeGameExport } from './lib/game-export.mjs';
import { readPlan } from './lib/game-plan.mjs';
import { masterSize } from './lib/corners.mjs';

const siteDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = YAML.parse(await fs.readFile(path.join(siteDir, 'site.config.yaml'), 'utf8'));
const contentDir = process.env.CONTENT_DIR || config.images?.contentDir;
if (!contentDir) throw new Error('Není nastavené, kde je obsahové repo: dej CONTENT_DIR=<cesta k němu> do .env');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const exportRoot = path.resolve(outAt >= 0 ? args[outAt + 1] : path.join(contentDir, 'export'));
const edges = { ...EDGE_DEFAULTS, ...(config.images?.edges ?? {}) };

// the works as the pipeline sees them, read only
const worksRoot = path.join(contentDir, 'tvorba');
const { groups } = await readTree(worksRoot);
const works = [];
const collectionTitles = new Map();
const problems = [];
for (const g of groups) {
  if (g.dir && g.meta) {
    const meta = YAML.parse(await fs.readFile(path.join(worksRoot, g.dir, g.meta), 'utf8')) ?? {};
    collectionTitles.set(g.dir, typeof meta.title === 'string' ? meta.title : '');
  }
  for (const [slug, file] of g.yamls) {
    const data = YAML.parse(await fs.readFile(path.join(worksRoot, g.dir, file), 'utf8')) ?? {};
    const image = g.images.get(slug);
    const masterPath = image ? path.join(worksRoot, g.dir, image.file) : null;
    const yamlPath = path.join('tvorba', g.dir, file);
    if (masterPath && data[SKIP_KEY] !== undefined) {
      const { width, height } = await masterSize(masterPath);
      problems.push(...exclusionProblems(data[SKIP_KEY], width, height, yamlPath));
    }
    const year = /^\d{4}/.exec(String(data.date ?? ''))?.[0] ?? null;
    works.push({ id: data.id, data, year, slug, yamlPath, collection: g.dir, masterPath });
  }
}
if (problems.length) {
  problems.forEach((p) => console.error(`✗ ${p}`));
  process.exit(1);
}

if (args.includes('--force')) await fs.rm(path.join(exportRoot, GAME_EXPORT_DIR), { recursive: true, force: true });
const exclusions = await contentExclusions(works, (w) => photoRegion(w.masterPath, w.data.meta_corners, edges));
const plan = await readPlan(siteDir);
const removed = await writeGameExport({
  works, exclusions, plan, collectionTitles, siteDir, exportRoot, edges,
  siteUrl: String(config.site?.url ?? '').replace(/\/+$/, ''), log: console.log,
});
removed.forEach((r) => console.log(`- ${r}`));
console.log(`✓ ${path.join(exportRoot, GAME_EXPORT_DIR, 'README.md')}`);
