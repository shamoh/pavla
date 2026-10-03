import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  HOME_PAGE_DIR, collectionPageDir, coverDir, isContainer, ogFile, photoDir, staleOutputs, workImageDir, yearPageDir,
} from './site-images.mjs';

let siteDir;
const write = async (rel, text = 'x') => {
  await fs.mkdir(path.dirname(path.join(siteDir, 'public', rel)), { recursive: true });
  await fs.writeFile(path.join(siteDir, 'public', rel), text);
};
beforeEach(async () => { siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'site-images-')); });
afterEach(() => fs.rm(siteDir, { recursive: true, force: true }));

test('images lie in the folder of their page (the URL)', () => {
  assert.equal(workImageDir('2026', 'rano-k3f9a'), 'tvorba/2026/rano-k3f9a');
  assert.equal(coverDir(yearPageDir('2026')), 'tvorba/2026/_cover');
  assert.equal(ogFile(yearPageDir('2026')), 'tvorba/2026/og.jpg');
  assert.equal(coverDir(collectionPageDir('plener')), 'tvorba/kolekce/plener/_cover');
  assert.equal(ogFile(collectionPageDir('plener')), 'tvorba/kolekce/plener/og.jpg');
  assert.equal(coverDir(HOME_PAGE_DIR), '_cover');
  assert.equal(ogFile(HOME_PAGE_DIR), 'og.jpg');
  assert.equal(photoDir('portret'), 'fotky/portret');
});

test('isContainer: folders that only hold other outputs', () => {
  for (const rel of ['tvorba', 'tvorba/2026', 'tvorba/kolekce', 'tvorba/kolekce/plener', 'fotky']) assert.ok(isContainer(rel), rel);
  for (const rel of ['tvorba/2026/rano-k3f9a', 'tvorba/2026/_cover', 'tvorba/kolekce/plener/_cover', 'fotky/portret', '_cover', 'works']) {
    assert.ok(!isContainer(rel), rel);
  }
});

test('staleOutputs: each item nobody wanted; static files and other folders of the site never', async () => {
  await write('favicon.svg');
  await write('CNAME');
  await write('tvorba/2026/rano-k3f9a/480.jpg');
  await write('tvorba/2026/vecer-m7q2x/480.jpg');
  await write('tvorba/2026/_cover/480.jpg');
  await write('tvorba/2026/og.jpg');
  await write('tvorba/2025/stary-a1b2c/480.jpg');
  await write('tvorba/kolekce/plener/og.jpg');
  await write('fotky/portret/480.jpg');
  await write('_cover/480.jpg');
  await write('og.jpg');
  await write('works/2026/rano-k3f9a/480.jpg'); // not an output folder (any more): left alone
  await write('og/home.jpg');
  const wanted = new Set(['tvorba/2026/rano-k3f9a', 'tvorba/2026/og.jpg', 'fotky/portret', 'og.jpg']);
  assert.deepEqual(staleOutputs(siteDir, wanted), [
    { rel: '_cover', dir: true },
    { rel: 'tvorba/2025/stary-a1b2c', dir: true },
    { rel: 'tvorba/2026/_cover', dir: true },
    { rel: 'tvorba/2026/vecer-m7q2x', dir: true },
    { rel: 'tvorba/kolekce/plener/og.jpg', dir: false },
  ]);
});

test('staleOutputs: nothing generated yet, or everything wanted, gives nothing', async () => {
  assert.deepEqual(staleOutputs(siteDir, new Set()), []);
  await write('tvorba/2026/rano-k3f9a/480.jpg');
  assert.deepEqual(staleOutputs(siteDir, new Set(['tvorba/2026/rano-k3f9a'])), []);
});
