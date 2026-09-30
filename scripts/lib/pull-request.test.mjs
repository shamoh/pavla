import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  OUTPUT_PATHS, changedFiles, changedItems, pullRequestBody, pullRequestPaths, runFromEnv, stepOutput,
} from './pull-request.mjs';

const git = (cwd, ...args) => promisify(execFile)('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd });

/** A repo like this one after an earlier content update: works and photos committed, no collection cover yet. */
async function siteRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-pr-'));
  await git(dir, 'init', '-q');
  const write = async (rel, text = 'x') => {
    await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), text);
  };
  await write('content/works/2026/rano-k3f9a.yaml');
  await write('public/works/2026/rano-k3f9a/480.jpg');
  await write('public/photos/portret/480.jpg');
  await write('content/collections/plener.yaml');
  await write('src/pages/index.astro');
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'init');
  return { dir, write };
}

test('pullRequestPaths: only output folders that exist or that git knows; git add then succeeds', async () => {
  const { dir, write } = await siteRepo();
  // public/collections and public/og never existed: the pull request step failed on them
  assert.deepEqual(await pullRequestPaths(dir), ['content/works', 'public/works', 'public/photos', 'content/collections']);

  // a new cover photo of a collection and a share image create the folders
  await write('public/collections/plener/480.jpg', 'cover');
  await write('public/og/collections/plener.jpg', 'share');
  await write('content/years/2026.yaml', 'description: Rok');
  await write('public/years/2026/480.jpg', 'year');
  await write('content/home.yaml', 'description: Úvod');
  await write('public/home/480.jpg', 'home');
  // the last photo removed: the folder is gone, but its deletion must reach the pull request
  await fs.rm(path.join(dir, 'public/photos'), { recursive: true });
  const paths = await pullRequestPaths(dir);
  assert.deepEqual(paths, OUTPUT_PATHS);

  // what peter-evans/create-pull-request does with add-paths
  await git(dir, 'add', '--', ...paths);
  const { stdout } = await git(dir, 'status', '--porcelain');
  assert.match(stdout, /^D {2}public\/photos\/portret\/480\.jpg$/m);
  assert.match(stdout, /^A {2}public\/collections\/plener\/480\.jpg$/m);
});

test('pullRequestPaths: nothing at all gives no paths (the workflow then skips the pull request)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-pr-'));
  await git(dir, 'init', '-q');
  assert.deepEqual(await pullRequestPaths(dir), []);
  assert.deepEqual(await changedFiles(dir, []), []);
});

test('changedFiles lists changed, new and deleted output files, nothing else', async () => {
  const { dir, write } = await siteRepo();
  await write('content/works/2026/rano-k3f9a.yaml', 'changed');
  await write('public/works/2026/vecer-m7q2x/480.jpg');
  await fs.rm(path.join(dir, 'content/collections/plener.yaml'));
  await write('src/pages/index.astro', 'not content');
  const files = await changedFiles(dir, await pullRequestPaths(dir));
  assert.deepEqual(files.sort(), ['content/collections/plener.yaml', 'content/works/2026/rano-k3f9a.yaml', 'public/works/2026/vecer-m7q2x/480.jpg']);
});

test('changedItems names each work, collection and photo once', () => {
  const items = changedItems([
    'content/works/2026/rano-k3f9a.yaml',
    'public/works/2026/rano-k3f9a/480.jpg',
    'public/works/2025/vecer-m7q2x/mockup-police-960.webp',
    'public/photos/portret/480.jpg',
    'public/photos/portret/info.json',
    'content/collections/2026-plener-sumava.yaml',
    'public/collections/2026-plener-sumava/480.jpg',
    'public/og/collections/2026-plener-sumava.jpg',
    'public/og/somethingelse.txt',
  ]);
  assert.deepEqual(items, ['2025/vecer-m7q2x', '2026/rano-k3f9a', 'fotka portret', 'kolekce 2026-plener-sumava']);
});

test('pullRequestBody names the run, never the (private) content repository; lists the items', () => {
  const run = runFromEnv({
    GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'shamoh/obsah', GITHUB_RUN_NUMBER: '7', GITHUB_RUN_ID: '123',
  });
  const body = pullRequestBody(['2026/rano-k3f9a', 'kolekce plener'], run);
  assert.match(body, /^Automatická aktualizace obsahu \(běh 7\)\./);
  assert.doesNotMatch(body, /obsah\]|github\.com|shamoh/);
  assert.match(body, /\n- 2026\/rano-k3f9a\n- kolekce plener\n/);
  assert.match(body, /Po sloučení se web sám nasadí\./);
  assert.equal(runFromEnv({}), null);
  assert.match(pullRequestBody([], null), /^Aktualizace obsahu, ručně mimo GitHub Actions\.[\s\S]*- \(nic\)/);
});

test('stepOutput writes a multi-line step output, empty when there is nothing', () => {
  assert.equal(stepOutput('paths', ['content/works', 'public/og']), 'paths<<PAVLA_OUTPUT_END\ncontent/works\npublic/og\nPAVLA_OUTPUT_END\n');
  assert.equal(stepOutput('paths', []), 'paths<<PAVLA_OUTPUT_END\nPAVLA_OUTPUT_END\n');
});
