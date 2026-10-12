// When files came into a git repository (the content repository): the day of the commit that added each of them,
// following renames (a work moved into a collection keeps its date). Used by recommendations that need an age:
// drafts waiting too long, Instagram photos without the link of their post (scripts/lib/advice.mjs).
// Without git, outside a repository or in a shallow clone (no history, the dates would be wrong) nothing is known.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const git = async (dir, args) => (await run('git', ['-C', dir, ...args], { maxBuffer: 16 * 1024 * 1024 })).stdout.trim();

/** True when `dir` is in a git repository with its whole history (not shallow); false otherwise, never throws. */
export async function hasHistory(dir) {
  try {
    return (await git(dir, ['rev-parse', '--is-shallow-repository'])) === 'false';
  } catch {
    return false;
  }
}

/**
 * The day (YYYY-MM-DD) each of `files` (relative to `dir`) was added to git, following renames: Map(file -> day).
 * A file not committed yet, or every file without the history (hasHistory), is left out.
 */
export async function addedDates(dir, files) {
  const dates = new Map();
  if (!files.length || !(await hasHistory(dir))) return dates;
  for (const file of files) {
    try {
      const days = await git(dir, ['log', '--follow', '--diff-filter=A', '--format=%cs', '--', file]);
      const oldest = days.split('\n').filter(Boolean).at(-1);
      if (oldest) dates.set(file, oldest);
    } catch {
      // unknown: no recommendation for this file
    }
  }
  return dates;
}
