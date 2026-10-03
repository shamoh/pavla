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
  await write('content/tvorba/rano.yaml');
  await write('public/tvorba/2026/rano-k3f9a/480.jpg');
  await write('public/fotky/portret/480.jpg');
  await write('content/tvorba/plener/_index.yaml');
  await write('src/pages/index.astro');
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'init');
  return { dir, write };
}

test('pullRequestPaths: only output folders that exist or that git knows; git add then succeeds', async () => {
  const { dir, write } = await siteRepo();
  // public/_cover and public/og.jpg never existed: the pull request step failed on paths like them
  assert.deepEqual(await pullRequestPaths(dir), ['content', 'public/tvorba', 'public/fotky']);

  // a new cover photo of a collection and a share image create the folders
  await write('public/tvorba/kolekce/plener/_cover/480.jpg', 'cover');
  await write('public/tvorba/kolekce/plener/og.jpg', 'share');
  await write('content/roky/2026.yaml', 'description: Rok');
  await write('public/tvorba/2026/_cover/480.jpg', 'year');
  await write('content/_index.yaml', 'description: Úvod');
  await write('public/_cover/480.jpg', 'home');
  await write('public/og.jpg', 'home share');
  // the last photo removed: the folder is gone, but its deletion must reach the pull request
  await fs.rm(path.join(dir, 'public/fotky'), { recursive: true });
  const paths = await pullRequestPaths(dir);
  assert.deepEqual(paths, ['content', 'public/tvorba', 'public/fotky', 'public/_cover', 'public/og.jpg']);
  // the former image folders are output paths too, so their deletion reaches the pull request
  for (const p of ['public/works', 'public/photos', 'public/collections', 'public/og']) assert.ok(OUTPUT_PATHS.includes(p), p);

  // what peter-evans/create-pull-request does with add-paths
  await git(dir, 'add', '--', ...paths);
  const { stdout } = await git(dir, 'status', '--porcelain');
  assert.match(stdout, /^D {2}public\/fotky\/portret\/480\.jpg$/m);
  assert.match(stdout, /^A {2}public\/tvorba\/kolekce\/plener\/_cover\/480\.jpg$/m);
});

test('pullRequestPaths: nothing at all gives no paths (the workflow then skips the pull request)', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-pr-'));
  await git(dir, 'init', '-q');
  assert.deepEqual(await pullRequestPaths(dir), []);
  assert.deepEqual(await changedFiles(dir, []), []);
});

test('changedFiles lists changed, new and deleted output files, nothing else', async () => {
  const { dir, write } = await siteRepo();
  await write('content/tvorba/rano.yaml', 'changed');
  await write('public/tvorba/2026/vecer-m7q2x/480.jpg');
  await fs.rm(path.join(dir, 'content/tvorba/plener/_index.yaml'));
  await write('src/pages/index.astro', 'not content');
  const files = await changedFiles(dir, await pullRequestPaths(dir));
  assert.deepEqual(files.sort(), ['content/tvorba/plener/_index.yaml', 'content/tvorba/rano.yaml', 'public/tvorba/2026/vecer-m7q2x/480.jpg']);
});

test('changedItems names each work, collection and photo once', () => {
  const items = changedItems([
    'content/tvorba/rano.yaml',
    'public/tvorba/2026/rano-k3f9a/480.jpg',
    'public/tvorba/2025/vecer-m7q2x/mockup-police-960.webp',
    'content/tvorba/2026-plener-sumava/smrk.yaml',
    'content/fotky/portret.yaml',
    'public/fotky/portret/480.jpg',
    'public/fotky/portret/info.json',
    'content/tvorba/2026-plener-sumava/_index.yaml',
    'public/tvorba/kolekce/2026-plener-sumava/_cover/480.jpg',
    'public/tvorba/kolekce/2026-plener-sumava/og.jpg',
    'content/roky/2026.yaml',
    'content/_index.yaml',
    'public/og/somethingelse.txt',
  ]);
  assert.deepEqual(items, ['dílo rano', 'dílo smrk', 'dílo vecer', 'fotka portret', 'kolekce 2026-plener-sumava', 'rok 2026', 'úvodní stránka']);
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
  assert.equal(stepOutput('paths', ['content', 'public/og']), 'paths<<PAVLA_OUTPUT_END\ncontent\npublic/og\nPAVLA_OUTPUT_END\n');
  assert.equal(stepOutput('paths', []), 'paths<<PAVLA_OUTPUT_END\nPAVLA_OUTPUT_END\n');
});
