import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SITE_BINARY, binaryBranch, dropPromoted, orphanBinaries, pack, promote, pruneBinaries, remoteBranch, treeOf, unpack } from './binary.mjs';

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();

/** A bare "origin" with a main branch, and `n` clones of it. */
async function setup(n = 2) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-binary-test-'));
  const origin = path.join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  const clones = [];
  for (let i = 0; i < n; i++) {
    const dir = path.join(root, `clone${i}`);
    git(root, 'clone', '-q', origin, dir);
    git(dir, 'config', 'user.email', 'test@example.test');
    git(dir, 'config', 'user.name', 'Test');
    clones.push(dir);
  }
  // main with code and the images ignored, like this repo
  await fs.writeFile(path.join(clones[0], '.gitignore'), '/public/tvorba/\n');
  await fs.writeFile(path.join(clones[0], 'kod.mjs'), 'export {};\n');
  git(clones[0], 'add', '.');
  git(clones[0], 'commit', '-q', '-m', 'code');
  git(clones[0], 'push', '-q', 'origin', 'main');
  for (const dir of clones.slice(1)) git(dir, 'pull', '-q', 'origin', 'main');
  return { root, clones };
}

const write = async (dir, rel, text) => {
  await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
  await fs.writeFile(path.join(dir, rel), text);
};
const read = (dir, rel) => fs.readFile(path.join(dir, rel), 'utf8');
const exists = (p) => fs.access(p).then(() => true, () => false);
const paths = ['public/tvorba'];

test('binaryBranch and the defaults of this repo', () => {
  assert.equal(binaryBranch('main'), 'main_binary');
  assert.equal(binaryBranch('obrazy-posledni-rok'), 'obrazy-posledni-rok_binary');
  assert.equal(SITE_BINARY.main, 'main_binary');
  assert.equal(SITE_BINARY.pending, 'obsah/aktualizace_binary');
  assert.ok(SITE_BINARY.paths.includes('public/tvorba') && SITE_BINARY.paths.includes('public/fotky'));
});

test('pack: one commit without a parent with the ignored files, the index and history of main untouched', async () => {
  const { root, clones: [a] } = await setup(1);
  try {
    await write(a, 'public/tvorba/2026/rano/960.avif', 'obraz');
    const head = git(a, 'rev-parse', 'HEAD');
    const r = await pack({ dir: a, paths, branch: 'main_binary', push: true, lock: 'binary.lock' });
    assert.equal(r.pushed, true);
    assert.equal(await read(a, 'binary.lock'), `${r.tree}\n`);
    assert.equal(git(a, 'rev-parse', 'HEAD'), head, 'main stays where it was');
    assert.equal(git(a, 'status', '--porcelain'), '?? binary.lock', 'the images stay ignored, nothing staged');
    assert.equal(git(a, 'ls-remote', '--heads', 'origin', 'main_binary').split('\t')[0], r.commit);
    assert.equal(git(a, 'rev-list', '--count', r.commit), '1', 'no parent');
    assert.equal(git(a, 'show', `${r.commit}:public/tvorba/2026/rano/960.avif`), 'obraz');
    // the same files again: nothing pushed, the same tree (the hash names the files, not the run)
    const again = await pack({ dir: a, paths, branch: 'main_binary', push: true, lock: 'binary.lock' });
    assert.deepEqual([again.pushed, again.tree, again.commit], [false, r.tree, r.commit]);
    // another image: a new single commit replaces the old one
    await write(a, 'public/tvorba/2026/vecer/960.avif', 'jiny');
    const next = await pack({ dir: a, paths, branch: 'main_binary', push: true, lock: 'binary.lock' });
    assert.notEqual(next.tree, r.tree);
    assert.equal(git(a, 'rev-list', '--count', next.commit), '1');
    assert.equal(await treeOf(a, paths), next.tree);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('unpack: the branch the lock names, replacing the files; a wrong lock is an error, no branch yet is nothing', async () => {
  const { root, clones: [a, b] } = await setup(2);
  try {
    assert.equal(await unpack({ dir: b, paths, branches: ['main_binary'], lock: null }), null, 'nothing yet');
    await write(a, 'public/tvorba/2026/rano/960.avif', 'hlavni');
    const main = await pack({ dir: a, paths, branch: 'main_binary', push: true, lock: 'binary.lock' });
    await write(a, 'public/tvorba/2026/rano/960.avif', 'nova');
    const pending = await pack({ dir: a, paths, branch: 'obsah/aktualizace_binary', push: true, lock: 'binary.lock' });
    // b: a stale file goes, the lock picks the branch
    await write(b, 'public/tvorba/2025/stary/960.avif', 'stary');
    await fs.writeFile(path.join(b, 'binary.lock'), `${main.tree}\n`);
    const r = await unpack({ dir: b, paths, branches: ['main_binary', 'obsah/aktualizace_binary'], lock: 'binary.lock' });
    assert.deepEqual(r, { branch: 'main_binary', tree: main.tree });
    assert.equal(await read(b, 'public/tvorba/2026/rano/960.avif'), 'hlavni');
    assert.ok(!(await exists(path.join(b, 'public/tvorba/2025'))), 'replaced, not merged');
    assert.equal(git(b, 'status', '--porcelain'), '?? binary.lock', 'the index of b untouched');
    await fs.writeFile(path.join(b, 'binary.lock'), `${pending.tree}\n`);
    assert.equal((await unpack({ dir: b, paths, branches: ['main_binary', 'obsah/aktualizace_binary'], lock: 'binary.lock' })).branch, 'obsah/aktualizace_binary');
    assert.equal(await read(b, 'public/tvorba/2026/rano/960.avif'), 'nova');
    await fs.writeFile(path.join(b, 'binary.lock'), `${'0'.repeat(40)}\n`);
    await assert.rejects(unpack({ dir: b, paths, branches: ['main_binary'], lock: 'binary.lock' }), /no branch has the binary files 0000000 named in binary\.lock \(main_binary /);
    // without a lock: the first existing branch
    assert.equal((await unpack({ dir: b, paths, branches: ['chybi_binary', 'main_binary'], lock: null })).branch, 'main_binary');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('promote: the images of the merged update become main\'s, once; neither branch with them is an error', async () => {
  const { root, clones: [a] } = await setup(1);
  try {
    await write(a, 'public/tvorba/x.avif', 'stare');
    await pack({ dir: a, paths, branch: 'main_binary', push: true, lock: 'binary.lock' });
    assert.equal(await promote({ dir: a, from: 'obsah/aktualizace_binary', to: 'main_binary', lock: 'binary.lock' }), 'current');
    await write(a, 'public/tvorba/x.avif', 'nove');
    const pending = await pack({ dir: a, paths, branch: 'obsah/aktualizace_binary', push: true, lock: 'binary.lock' });
    assert.equal(await promote({ dir: a, from: 'obsah/aktualizace_binary', to: 'main_binary', lock: 'binary.lock' }), 'promoted');
    assert.equal((await remoteBranch(a, 'main_binary')).commit, pending.commit, 'the same commit, nothing sent again');
    assert.equal(await promote({ dir: a, from: 'obsah/aktualizace_binary', to: 'main_binary', lock: 'binary.lock' }), 'current');
    await fs.writeFile(path.join(a, 'binary.lock'), `${'1'.repeat(40)}\n`);
    await assert.rejects(promote({ dir: a, from: 'obsah/aktualizace_binary', to: 'main_binary', lock: 'binary.lock' }), /neither main_binary nor obsah\/aktualizace_binary/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('dropPromoted: the update branch goes once main_binary has its commit; a newer one stays', async () => {
  const { root, clones: [a] } = await setup(1);
  const from = 'obsah/aktualizace_binary';
  const heads = () => git(a, 'ls-remote', '--heads', 'origin', from);
  try {
    assert.equal(await dropPromoted({ dir: a, from, to: 'main_binary' }), false, 'no update branch: nothing');
    await write(a, 'public/tvorba/x.avif', 'stare');
    await pack({ dir: a, paths, branch: 'main_binary', push: true, lock: 'binary.lock' });
    await write(a, 'public/tvorba/x.avif', 'nove');
    await pack({ dir: a, paths, branch: from, push: true, lock: 'binary.lock' });
    assert.equal(await dropPromoted({ dir: a, from, to: 'main_binary' }), false, 'not promoted yet: stays');
    assert.notEqual(heads(), '');
    await promote({ dir: a, from, to: 'main_binary', lock: 'binary.lock' });
    assert.equal(await dropPromoted({ dir: a, from, to: 'main_binary' }), true);
    assert.equal(heads(), '');
    assert.notEqual(git(a, 'ls-remote', '--heads', 'origin', 'main_binary'), '', 'main_binary stays');
    // a newer update already sent its images: stays
    await write(a, 'public/tvorba/x.avif', 'novejsi');
    await pack({ dir: a, paths, branch: from, push: true });
    assert.equal(await dropPromoted({ dir: a, from, to: 'main_binary' }), false);
    assert.notEqual(heads(), '');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('orphanBinaries / pruneBinaries: a binary branch goes with its own branch, main_binary stays', async () => {
  assert.deepEqual(orphanBinaries(['main', 'main_binary', 'obrazy_binary', 'plener', 'plener_binary']), ['obrazy_binary']);
  assert.deepEqual(orphanBinaries(['main']), []);
  const { root, clones: [a] } = await setup(1);
  try {
    await write(a, 'public/tvorba/x.avif', 'x');
    await pack({ dir: a, paths, branch: 'main_binary', push: true });
    await pack({ dir: a, paths, branch: 'smazana_binary', push: true });
    assert.deepEqual(await pruneBinaries({ dir: a }), ['smazana_binary']);
    assert.equal(git(a, 'ls-remote', '--heads', 'origin', 'smazana_binary'), '');
    assert.notEqual(git(a, 'ls-remote', '--heads', 'origin', 'main_binary'), '');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
