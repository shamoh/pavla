#!/usr/bin/env node
// Prepares the pull request of a content update into this repo, after the pipeline ran (scripts/lib/pull-request.mjs):
//   - step output `paths`: the output paths for add-paths of peter-evans/create-pull-request (content/ and
//     binary.lock; empty when there is none: the workflow then skips the pull request); the images went to their
//     branch before (scripts/binary.mjs pack obsah/aktualizace_binary --push), the description names them too,
//   - <body-file>: its Czech description.
// Run from this repo's root. Used by the content workflow and by .github/workflows/dry-run.yml.
//
// Usage: node scripts/pull-request.mjs <body-file>

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import { SITE_BINARY, readLock } from './lib/binary.mjs';
import { changedBinaries, changedFiles, changedItems, pullRequestBody, pullRequestPaths, runFromEnv, stepOutput } from './lib/pull-request.mjs';

const bodyFile = process.argv[2];
if (!bodyFile) {
  console.error('Usage: node scripts/pull-request.mjs <body-file>');
  process.exit(1);
}

const siteDir = process.cwd();
const paths = await pullRequestPaths(siteDir);
// the images changed against main's (refs/remotes/origin/main_binary, fetched by `binary.mjs unpack`/`promote`;
// none = every image is new), from the tree binary.lock names (written by `binary.mjs pack`)
const tree = await readLock(siteDir, SITE_BINARY.lock);
const base = await promisify(execFile)('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${SITE_BINARY.main}`], { cwd: siteDir })
  .then(({ stdout }) => stdout.trim(), () => null);
const images = tree ? await changedBinaries(siteDir, base, tree) : [];
const body = pullRequestBody(changedItems([...await changedFiles(siteDir, paths), ...images]), runFromEnv());
await fs.writeFile(bodyFile, body);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, stepOutput('paths', paths));

console.log(`Output folders for the pull request: ${paths.join(', ') || '(none)'}`);
console.log(body);
