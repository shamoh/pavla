#!/usr/bin/env node
// Exports the settings of a GitHub repository as a Czech checklist (Markdown), to set up a new repository the same
// way (scripts/lib/repo-settings.mjs). Reads with the GitHub CLI (`gh api`, its login); nothing is changed.
//
// Usage: node scripts/repo-settings.mjs <owner/repo> [--out <file.md>]
//   with --out also <file>.json: the snapshot the monthly health check compares the current settings with

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { promisify } from 'node:util';
import { collectSettings, settingsMarkdown, settingsSnapshot } from './lib/repo-settings.mjs';

const run = promisify(execFile);
const args = process.argv.slice(2);
const repo = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

/** GET with `gh api`: the JSON, null for 404 (and for 204 without a body); other failures throw. */
async function api(path) {
  try {
    const { stdout } = await run('gh', ['api', '-H', 'Accept: application/vnd.github+json', path], { maxBuffer: 16 * 1024 * 1024 });
    return stdout.trim() ? JSON.parse(stdout) : {};
  } catch (e) {
    if (/HTTP 404/.test(`${e.stderr ?? ''}${e.message}`)) return null;
    throw new Error(String(e.stderr || e.message).trim().split('\n')[0]);
  }
}

try {
  if (!repo) throw new Error('usage: node scripts/repo-settings.mjs <owner/repo> [--out <file.md>]');
  const settings = await collectSettings(repo, api);
  const text = settingsMarkdown(settings);
  if (out) {
    await fs.writeFile(out, text);
    const snapshot = out.replace(/\.md$/, '') + '.json';
    await fs.writeFile(snapshot, `${JSON.stringify(settingsSnapshot(settings), null, 2)}\n`);
    console.log(`Written: ${out}, ${snapshot}`);
  } else {
    process.stdout.write(text);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
}
