import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  OUTPUT_PATHS, changedBinaries, changedFiles, changedItems, pullRequestBody, pullRequestPaths, runFromEnv, stepOutput,
} from './pull-request.mjs';

const git = (cwd, ...args) => promisify(execFile)('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd });

/** A repo like this one after an earlier content update: the public copies committed (the images are in their branch). */
async function siteRepo() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-pr-'));
  await git(dir, 'init', '-q');
  const write = async (rel, text = 'x') => {
    await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await fs.writeFile(path.join(dir, rel), text);
  };
  await write('content/tvorba/rano.yaml');
  await write('content/tvorba/plener/_index.yaml');
  await write('src/pages/index.astro');
  await git(dir, 'add', '-A');
  await git(dir, 'commit', '-q', '-m', 'init');
  return { dir, write };
}

test('pullRequestPaths: content/ and binary.lock, never the images (they are in their own branch)', async () => {
  const { dir, write } = await siteRepo();
  assert.deepEqual(OUTPUT_PATHS, ['content', 'binary.lock']);
  // before the first update with a lock: only content/
  assert.deepEqual(await pullRequestPaths(dir), ['content']);
  await write('binary.lock', `${'a'.repeat(40)}\n`);
  await write('content/roky/2026.yaml', 'description: Rok');
  const paths = await pullRequestPaths(dir);
  assert.deepEqual(paths, ['content', 'binary.lock']);
  // what peter-evans/create-pull-request does with add-paths
  await git(dir, 'add', '--', ...paths);
  const { stdout } = await git(dir, 'status', '--porcelain');
  assert.match(stdout, /^A {2}binary\.lock$/m);
  assert.match(stdout, /^A {2}content\/roky\/2026\.yaml$/m);
});

test('changedBinaries: the images that differ from main\'s, every image without main\'s yet', async () => {
  const { dir } = await siteRepo();
  const tree = async (files) => {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(dir, '.git', 'tmp-index') };
    const run = (...args) => promisify(execFile)('git', args, { cwd: dir, env });
    await run('read-tree', '--empty');
    for (const [rel, text] of Object.entries(files)) {
      const { stdout: blob } = await promisify(execFile)('sh', ['-c', `printf %s '${text}' | git hash-object -w --stdin`], { cwd: dir });
      await run('update-index', '--add', '--cacheinfo', `100644,${blob.trim()},${rel}`);
    }
    return (await run('write-tree')).stdout.trim();
  };
  const main = await tree({ 'public/tvorba/2026/rano-k3f9a/480.jpg': 'a', 'public/fotky/portret/480.jpg': 'p' });
  const next = await tree({ 'public/tvorba/2026/rano-k3f9a/480.jpg': 'b', 'public/fotky/portret/480.jpg': 'p', 'public/_og/og-0123abcd.jpg': 'o' });
  assert.deepEqual((await changedBinaries(dir, main, next)).sort(), ['public/_og/og-0123abcd.jpg', 'public/tvorba/2026/rano-k3f9a/480.jpg']);
  assert.deepEqual(changedItems(await changedBinaries(dir, main, next)), ['dílo rano', 'úvodní stránka']);
  assert.equal((await changedBinaries(dir, null, next)).length, 3);
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
  await write('binary.lock', `${'b'.repeat(40)}\n`);
  await fs.rm(path.join(dir, 'content/tvorba/plener/_index.yaml'));
  await write('src/pages/index.astro', 'not content');
  const files = await changedFiles(dir, await pullRequestPaths(dir));
  assert.deepEqual(files.sort(), ['binary.lock', 'content/tvorba/plener/_index.yaml', 'content/tvorba/rano.yaml']);
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
    'public/tvorba/kolekce/2026-plener-sumava/_og/og-0123abcd.jpg',
    'public/_og/og-0123abcd.jpg',
    'public/tvorba/2026/_og/og-0123abcd.jpg',
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
