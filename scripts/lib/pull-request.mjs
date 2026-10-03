// What a content update puts into the pull request into this repo. Used by the content workflow (the one that
// runs the pipeline on the real content) and by its dry run on the test data (.github/workflows/dry-run.yml),
// so both go through exactly the same steps.

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { LEGACY_ROOTS, OUTPUT_ROOTS } from './site-images.mjs';
import { parseWorkKey } from './works.mjs';

const git = async (cwd, ...args) => (await promisify(execFile)('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 })).stdout;

/**
 * Every folder and file the pipeline writes into this repo: the public copies (content/), the images in public/
 * (scripts/lib/site-images.mjs) and the former image folders, so their deletion reaches the pull request too.
 */
export const OUTPUT_PATHS = ['content', ...[...OUTPUT_ROOTS, ...LEGACY_ROOTS].map((p) => `public/${p}`)];

/**
 * The output folders to put into the pull request: those that exist, or that git knows (a folder deleted as a
 * whole, e.g. public/_cover after the home page's own cover photo was removed). `git add` fails on any other path,
 * e.g. public/_cover before the home page has its own cover photo, and then nothing is committed.
 */
export async function pullRequestPaths(siteDir, paths = OUTPUT_PATHS) {
  const out = [];
  for (const p of paths) {
    const exists = await fs.access(path.join(siteDir, p)).then(() => true, () => false);
    if (exists || (await git(siteDir, 'ls-files', '--', p)).trim()) out.push(p);
  }
  return out;
}

/** Changed output files (`git status`, untracked included) of the given folders, relative to the repo. */
export async function changedFiles(siteDir, paths) {
  if (!paths.length) return [];
  const status = await git(siteDir, 'status', '--porcelain', '-z', '--untracked-files=all', '--', ...paths);
  return status.split('\0').filter(Boolean).map((entry) => entry.slice(3));
}

/**
 * Names the works, collections and photos behind changed output files, sorted, each once. A work is named by its slug
 * ("dílo rano"): its public copy (content/tvorba/…) has neither the year nor the id in its path.
 */
export function changedItems(files) {
  const rules = [
    [/^(content\/_index\.yaml|public\/_cover\/|public\/og\.jpg$|public\/home\/|public\/og\/home\.jpg)/, () => 'úvodní stránka'],
    [/^content\/tvorba\/([^/]+)\/_index\.yaml$/, (m) => `kolekce ${m[1]}`],
    [/^content\/tvorba\/(?:[^/]+\/)?([^/_][^/]*)\.yaml$/, (m) => `dílo ${m[1]}`],
    [/^public\/tvorba\/kolekce\/([^/]+)\//, (m) => `kolekce ${m[1]}`],
    [/^public\/tvorba\/(\d{4})\/(_cover\/|og\.jpg$)/, (m) => `rok ${m[1]}`],
    [/^public\/(?:tvorba|works)\/\d{4}\/([^/]+)\//, (m) => `dílo ${parseWorkKey(m[1])?.slug ?? m[1]}`],
    [/^content\/fotky\/([^/]+)\.yaml$/, (m) => `fotka ${m[1]}`],
    [/^public\/(?:fotky|photos)\/([^/]+)\//, (m) => `fotka ${m[1]}`],
    [/^public\/collections\/([^/]+)\//, (m) => `kolekce ${m[1]}`],
    [/^public\/og\/collections\/([^/]+)\.jpg$/, (m) => `kolekce ${m[1]}`],
    [/^content\/roky\/(\d{4})\.yaml$/, (m) => `rok ${m[1]}`],
    [/^public\/years\/(\d{4})\//, (m) => `rok ${m[1]}`],
    [/^public\/og\/years\/(\d{4})\.jpg$/, (m) => `rok ${m[1]}`],
  ];
  const items = new Set();
  for (const f of files) {
    for (const [re, name] of rules) {
      const m = f.match(re);
      if (m) { items.add(name(m)); break; }
    }
  }
  return [...items].sort();
}

/**
 * Czech description of the pull request. `run`: { number } of the workflow run (from the GitHub Actions
 * environment), or null outside of it. The pull request is public: it never names or links the content
 * repository, which is private.
 */
export function pullRequestBody(items, run) {
  const source = run ? `Automatická aktualizace obsahu (běh ${run.number}).` : 'Aktualizace obsahu, ručně mimo GitHub Actions.';
  return [
    source,
    '',
    'Změněná díla, kolekce a fotky:',
    '',
    ...(items.length ? items.map((i) => `- ${i}`) : ['- (nic)']),
    '',
    'Po sloučení se web sám nasadí.',
    '',
  ].join('\n');
}

/** The workflow run from the GitHub Actions environment (only its number), or null outside of it. */
export function runFromEnv(env = process.env) {
  if (!env.GITHUB_RUN_ID) return null;
  return { number: env.GITHUB_RUN_NUMBER };
}

/** Step output in the GitHub Actions format for a multi-line value. */
export function stepOutput(name, lines) {
  return `${name}<<PAVLA_OUTPUT_END\n${lines.map((l) => `${l}\n`).join('')}PAVLA_OUTPUT_END\n`;
}
