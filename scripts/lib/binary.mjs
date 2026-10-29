// Generated binary files (images) kept out of the history of a branch: they live in a branch of their own,
// `<branch>_binary`, which always has a single commit (no parent) with their current state and is replaced by every
// run (force push, never a pull request). Old versions are then held by nothing and GitHub drops them in time, so the
// history of the branch itself stays small. Used for both repositories:
//   - this repo: the images of the site (public/tvorba, public/fotky, …: OUTPUT_ROOTS) in `main_binary` (what main
//     shows) and `obsah/aktualizace_binary` (those of a content pull request); main names the one it belongs to in
//     binary.lock (the hash of its tree: the same images = the same hash), so a build never mixes them up,
//   - the content repository: its exports (export/) in `<branch>_binary` of every branch.
// Plain git only (no dependencies); every command works in `dir`, a clone with the remote `origin`.

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { OUTPUT_ROOTS } from './site-images.mjs';

const run = promisify(execFile);

/** The suffix of the branch with the binary files of a branch. */
export const BINARY_SUFFIX = '_binary';
/** The branch with the binary files of `branch`. */
export const binaryBranch = (branch) => `${branch}${BINARY_SUFFIX}`;

/**
 * This repo: the generated images of the site (not in the history of main), the file of main naming their tree, the
 * branch of main's images and the branch of the images of a content pull request (branch obsah/aktualizace).
 */
export const SITE_BINARY = {
  paths: OUTPUT_ROOTS.map((p) => `public/${p}`),
  lock: 'binary.lock',
  main: binaryBranch('main'),
  pending: binaryBranch('obsah/aktualizace'),
};

/** The identity of the commits of binary branches (only when git has none configured, e.g. on a fresh runner). */
const IDENTITY = { name: 'github-actions[bot]', email: '41898282+github-actions[bot]@users.noreply.github.com' };

async function git(dir, args, env = {}) {
  return (await run('git', ['-C', dir, ...args], { env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 })).stdout.trim();
}

const exists = (p) => fs.access(p).then(() => true, () => false);

/** A temporary index, so neither the index of the clone nor its working tree state is touched. */
async function withIndex(fn) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-binary-'));
  try {
    return await fn({ GIT_INDEX_FILE: path.join(tmp, 'index') });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/** The tree of the files under `paths` of the working tree of `dir` (ignored ones too), without touching its index. */
export async function treeOf(dir, paths) {
  return withIndex(async (env) => {
    await git(dir, ['read-tree', '--empty'], env);
    const present = [];
    for (const p of paths) if (await exists(path.join(dir, p))) present.push(p);
    if (present.length) await git(dir, ['add', '--force', '--', ...present], env);
    return git(dir, ['write-tree'], env);
  });
}

/** The commit and tree of `branch` on origin (fetched into refs/remotes/origin/), or null when it has none. */
export async function remoteBranch(dir, branch) {
  if (!(await git(dir, ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]))) return null;
  // a binary commit has no parent: a plain fetch brings only it (never --depth: it would make the clone shallow)
  await git(dir, ['fetch', '--no-tags', '--quiet', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  const commit = await git(dir, ['rev-parse', `refs/remotes/origin/${branch}`]);
  return { commit, tree: await git(dir, ['rev-parse', `${commit}^{tree}`]) };
}

/**
 * Packs the files under `paths` of `dir` into a commit without a parent and, with `push`, makes it the only commit of
 * `branch` on origin (force push; skipped when origin already has the same files). `lock`: a file of `dir` to write the
 * hash of the tree into. Returns { tree, commit, pushed }.
 */
export async function pack({ dir, paths, branch, push = false, lock = null, message = 'Binary files' }) {
  const tree = await treeOf(dir, paths);
  if (lock) await fs.writeFile(path.join(dir, lock), `${tree}\n`);
  const remote = push ? await remoteBranch(dir, branch) : null;
  if (remote?.tree === tree) return { tree, commit: remote.commit, pushed: false };
  const named = (await git(dir, ['config', 'user.email']).catch(() => '')) !== '';
  const identity = named ? {} : {
    GIT_AUTHOR_NAME: IDENTITY.name, GIT_AUTHOR_EMAIL: IDENTITY.email, GIT_COMMITTER_NAME: IDENTITY.name, GIT_COMMITTER_EMAIL: IDENTITY.email,
  };
  const commit = await git(dir, ['commit-tree', tree, '-m', message], identity);
  if (push) await git(dir, ['push', '--force', '--quiet', 'origin', `${commit}:refs/heads/${branch}`]);
  return { tree, commit, pushed: push };
}

/** The tree named by `lock` in `dir`, or null without the file. */
export async function readLock(dir, lock) {
  if (!lock) return null;
  const text = await fs.readFile(path.join(dir, lock), 'utf8').catch(() => null);
  return text === null ? null : text.trim() || null;
}

/**
 * Restores the files under `paths` of `dir` from the first of `branches` on origin that has them (with `lock`: the one
 * whose tree it names; none of them = an error, the files would not belong to this state). The files under `paths`
 * are replaced. Returns { branch, tree }, or null when no branch exists yet (and no lock asks for one).
 */
export async function unpack({ dir, paths, branches, lock = null }) {
  const wanted = await readLock(dir, lock);
  const seen = [];
  for (const branch of branches) {
    const remote = await remoteBranch(dir, branch);
    if (!remote) continue;
    seen.push(`${branch} ${remote.tree.slice(0, 7)}`);
    if (wanted && remote.tree !== wanted) continue;
    for (const p of paths) await fs.rm(path.join(dir, p), { recursive: true, force: true });
    await withIndex(async (env) => {
      await git(dir, ['read-tree', remote.commit], env);
      await git(dir, ['checkout-index', '--all', '--force'], env);
    });
    return { branch, tree: remote.tree };
  }
  if (wanted) {
    throw new Error(`no branch has the binary files ${wanted.slice(0, 7)} named in ${lock} (${seen.join(', ') || `none of ${branches.join(', ')} exists`})`);
  }
  return null;
}

/**
 * Makes `to` the branch of the files named by `lock` (after a pull request was merged, its images become main's):
 * nothing when `to` already has them, otherwise `from` must have them and its commit becomes `to` (force push, no new
 * files are sent). Returns 'current' or 'promoted'; throws when neither has them.
 */
export async function promote({ dir, from, to, lock }) {
  const wanted = await readLock(dir, lock);
  if (!wanted) throw new Error(`${lock} is missing: nothing names the binary files`);
  const target = await remoteBranch(dir, to);
  if (target?.tree === wanted) return 'current';
  const source = await remoteBranch(dir, from);
  if (source?.tree !== wanted) {
    throw new Error(`neither ${to} nor ${from} has the binary files ${wanted.slice(0, 7)} named in ${lock}`);
  }
  await git(dir, ['push', '--force', '--quiet', 'origin', `${source.commit}:refs/heads/${to}`]);
  return 'promoted';
}

/**
 * Deletes `from` on origin once `to` has its very commit (the images of a merged update were promoted), so the branch
 * does not linger. A newer `from` (a new update already sent its images) differs and stays; the delete is leased on
 * the commit, so one pushed in between stays too. Returns true when deleted.
 */
export async function dropPromoted({ dir, from, to }) {
  const source = await remoteBranch(dir, from);
  if (!source) return false;
  const target = await remoteBranch(dir, to);
  if (target?.commit !== source.commit) return false;
  await git(dir, ['push', '--quiet', `--force-with-lease=refs/heads/${from}:${source.commit}`, 'origin', `:refs/heads/${from}`]);
  return true;
}

/** Binary branches on origin whose own branch is gone (merged and deleted): their names, of `heads` (branch names). */
export function orphanBinaries(heads) {
  const names = new Set(heads);
  return heads.filter((h) => h.endsWith(BINARY_SUFFIX) && !names.has(h.slice(0, -BINARY_SUFFIX.length))).sort();
}

/** Deletes the binary branches of origin whose own branch is gone; returns their names. */
export async function pruneBinaries({ dir }) {
  const heads = (await git(dir, ['ls-remote', '--heads', 'origin']))
    .split('\n').filter(Boolean).map((l) => l.split('\t')[1].replace(/^refs\/heads\//, ''));
  const orphans = orphanBinaries(heads);
  for (const b of orphans) await git(dir, ['push', '--quiet', 'origin', '--delete', b]);
  return orphans;
}
