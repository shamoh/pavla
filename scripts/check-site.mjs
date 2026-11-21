#!/usr/bin/env node
// Checks the data of a site folder (scripts/lib/site-folder-check.mjs): its settings, icons, fonts, mockup scenes and
// studio scenes (complete, their photos, cameras within the prompts of the generator, the sizes the tables must take).
// The tests of the code (npm test) run only on the test site; this checks the data of a real site.
// Usage:  npm run check:site                     the site folder (SITE_DIR, this repo by default)
//         SITE_DIR=.demo/site npm run check:site   the folder of the test site (npm run demo)
//         npm run check:site -- <folder>          any other site folder
// Exit code 1 when something is wrong.

import path from 'node:path';
import { siteDirectory } from './lib/site-dir.mjs';
import { siteFolderProblems } from './lib/site-folder-check.mjs';

const siteDir = path.resolve(process.argv[2] ?? siteDirectory());
const where = path.relative(process.cwd(), siteDir) || '.';
const problems = await siteFolderProblems(siteDir);
if (problems.length) {
  console.error(`✗ The site folder ${where} has ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✓ The site folder ${where}: settings, icons, fonts and scenes are fine.`);
