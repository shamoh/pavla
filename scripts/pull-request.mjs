#!/usr/bin/env node
// Prepares the pull request of a content update into this repo, after the pipeline ran (scripts/lib/pull-request.mjs):
//   - step output `paths`: the output folders for add-paths of peter-evans/create-pull-request
//     (empty when there is none: the workflow then skips the pull request),
//   - <body-file>: its Czech description.
// Run from this repo's root. Used by the content workflow and by .github/workflows/dry-run.yml.
//
// Usage: node scripts/pull-request.mjs <body-file>

import fs from 'node:fs/promises';
import { changedFiles, changedItems, pullRequestBody, pullRequestPaths, runFromEnv, stepOutput } from './lib/pull-request.mjs';

const bodyFile = process.argv[2];
if (!bodyFile) {
  console.error('Usage: node scripts/pull-request.mjs <body-file>');
  process.exit(1);
}

const siteDir = process.cwd();
const paths = await pullRequestPaths(siteDir);
const body = pullRequestBody(changedItems(await changedFiles(siteDir, paths)), runFromEnv());
await fs.writeFile(bodyFile, body);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, stepOutput('paths', paths));

console.log(`Output folders for the pull request: ${paths.join(', ') || '(none)'}`);
console.log(body);
