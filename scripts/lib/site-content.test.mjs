import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HOME_COPY, collectionCopyPath, photoCopyPath, readCopies, staleCopies, workCopyPath, yearCopyPath } from './site-content.mjs';

let root;
const write = async (rel, text) => {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await fs.writeFile(path.join(root, rel), text);
};
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'site-content-')); });
afterEach(() => fs.rm(root, { recursive: true, force: true }));

test('copy paths mirror the content repository', () => {
  assert.equal(workCopyPath(null, 'rano'), 'content/tvorba/rano.yaml');
  assert.equal(workCopyPath('2026-plener-sumava', 'smrk'), 'content/tvorba/2026-plener-sumava/smrk.yaml');
  assert.equal(collectionCopyPath('2026-plener-sumava'), 'content/tvorba/2026-plener-sumava/_index.yaml');
  assert.equal(yearCopyPath('2026'), 'content/roky/2026.yaml');
  assert.equal(HOME_COPY, 'content/_index.yaml');
  assert.equal(photoCopyPath('portret'), 'content/fotky/portret.yaml');
});

test('readCopies: works with their collection from the folder, collections, years, home page and photos', async () => {
  await write('content/tvorba/rano.yaml', 'id: k3f9a\ntitle: Ráno\n');
  await write('content/tvorba/plener/_index.yaml', 'title: Plenér\n');
  await write('content/tvorba/plener/smrk.yaml', 'id: m7q2x\ntitle: Smrk\n');
  await write('content/roky/2026.yaml', 'description: Rok.\n');
  await write('content/roky/poznamka.yaml', 'description: x\n'); // not a year
  await write('content/_index.yaml', 'description: Ahoj.\n');
  await write('content/tvorba/_index.yaml', 'cover: k3f9a\n'); // the works without a collection, not a work
  await write('content/fotky/portret.yaml', 'alt: Já\n');
  const c = readCopies(root);
  assert.deepEqual(c.works, [
    { slug: 'smrk', collection: 'plener', data: { id: 'm7q2x', title: 'Smrk' } },
    { slug: 'rano', collection: null, data: { id: 'k3f9a', title: 'Ráno' } },
  ]);
  assert.deepEqual(c.collections, [{ slug: 'plener', data: { title: 'Plenér' } }]);
  assert.deepEqual([...c.years], [['2026', { description: 'Rok.' }]]);
  assert.deepEqual(c.home, { description: 'Ahoj.' });
  assert.deepEqual(c.uncollected, { cover: 'k3f9a' });
  assert.deepEqual([...c.photos], [['portret', { alt: 'Já' }]]);
});

test('readCopies: nothing generated yet gives empty lists and no home page', () => {
  const c = readCopies(root);
  assert.deepEqual([c.works, c.collections, [...c.years], c.home, c.uncollected, [...c.photos]], [[], [], [], null, null, []]);
});

test('staleCopies: files under content/ nobody wrote, including an older layout; idempotent', async () => {
  await write('content/tvorba/rano.yaml', 'x');
  await write('content/tvorba/plener/_index.yaml', 'x');
  await write('content/works/2026/rano-k3f9a.yaml', 'x');
  await write('content/home.yaml', 'x');
  const wanted = new Set(['content/tvorba/rano.yaml', 'content/tvorba/plener/_index.yaml']);
  assert.deepEqual(staleCopies(root, wanted), ['content/home.yaml', 'content/works/2026/rano-k3f9a.yaml']);
  await fs.rm(path.join(root, 'content/works'), { recursive: true });
  await fs.rm(path.join(root, 'content/home.yaml'));
  assert.deepEqual(staleCopies(root, wanted), []);
});
