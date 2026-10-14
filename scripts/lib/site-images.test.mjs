import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  HOME_PAGE_DIR, OUTPUT_ROOTS, collectionPageDir, coverDir, fingerprintedName, isContainer, isFingerprinted, ogDir, pageShareFile, photoDir, staleOutputs,
  workImageDir, yearPageDir,
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
  assert.equal(ogDir(yearPageDir('2026')), 'tvorba/2026/_og');
  assert.equal(coverDir(collectionPageDir('plener')), 'tvorba/kolekce/plener/_cover');
  assert.equal(ogDir(collectionPageDir('plener')), 'tvorba/kolekce/plener/_og');
  assert.equal(coverDir(HOME_PAGE_DIR), '_cover');
  assert.equal(ogDir(HOME_PAGE_DIR), '_og');
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
  await write('tvorba/2026/_og/og-0123abcd.jpg');
  await write('tvorba/2025/stary-a1b2c/480.jpg');
  await write('tvorba/kolekce/plener/_og/og-0123abcd.jpg');
  await write('tvorba/kolekce/plener/og.jpg'); // the former name: pruned
  await write('fotky/portret/480.jpg');
  await write('_cover/480.jpg');
  await write('_og/og-0123abcd.jpg');
  await write('og.jpg'); // the former share image of the home page: pruned
  await write('works/2026/rano-k3f9a/480.jpg'); // not an output folder (any more): left alone
  await write('og/home.jpg');
  const wanted = new Set(['tvorba/2026/rano-k3f9a', 'tvorba/2026/_og', 'fotky/portret', '_og']);
  assert.deepEqual(staleOutputs(siteDir, wanted), [
    { rel: '_cover', dir: true },
    { rel: 'og.jpg', dir: false },
    { rel: 'tvorba/2025/stary-a1b2c', dir: true },
    { rel: 'tvorba/2026/_cover', dir: true },
    { rel: 'tvorba/2026/vecer-m7q2x', dir: true },
    { rel: 'tvorba/kolekce/plener/_og', dir: true },
    { rel: 'tvorba/kolekce/plener/og.jpg', dir: false },
  ]);
});

test('staleOutputs: nothing generated yet, or everything wanted, gives nothing', async () => {
  assert.deepEqual(staleOutputs(siteDir, new Set()), []);
  await write('tvorba/2026/rano-k3f9a/480.jpg');
  assert.deepEqual(staleOutputs(siteDir, new Set(['tvorba/2026/rano-k3f9a'])), []);
});

test('fingerprintedName: the same bytes the same name, other bytes another; isFingerprinted recognises it', () => {
  const a = fingerprintedName('og', Buffer.from('a'));
  assert.match(a, /^og-[0-9a-f]{8}\.jpg$/);
  assert.equal(fingerprintedName('og', Buffer.from('a')), a);
  assert.notEqual(fingerprintedName('og', Buffer.from('b')), a);
  assert.match(fingerprintedName('pin', Buffer.from('a')), /^pin-[0-9a-f]{8}\.jpg$/);
  assert.ok(isFingerprinted('og', a));
  for (const name of ['og.jpg', 'og-0123abc.jpg', 'og-0123ABCD.jpg', 'pin-0123abcd.jpg', 'og-0123abcd.jpg.bak']) assert.ok(!isFingerprinted('og', name), name);
  assert.ok(OUTPUT_ROOTS.includes('_og') && OUTPUT_ROOTS.includes('og.jpg'), 'the former og.jpg of the home page is pruned');
});

test('pageShareFile: the og-<hash>.jpg of the _og folder of a page, null without one', async () => {
  const publicDir = path.join(siteDir, 'public');
  assert.equal(pageShareFile(publicDir, yearPageDir('2026')), null);
  await write('tvorba/2026/_og/notes.txt');
  assert.equal(pageShareFile(publicDir, yearPageDir('2026')), null);
  await write('tvorba/2026/_og/og-0123abcd.jpg');
  assert.equal(pageShareFile(publicDir, yearPageDir('2026')), 'tvorba/2026/_og/og-0123abcd.jpg');
  await write('_og/og-89abcdef.jpg');
  assert.equal(pageShareFile(publicDir, HOME_PAGE_DIR), '_og/og-89abcdef.jpg');
});
