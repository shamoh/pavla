import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { prepareDemo } from './demo.mjs';

const siteConfig = YAML.parse(await fs.readFile(new URL('../site.config.yaml', import.meta.url), 'utf8'));
const config = {
  ...siteConfig,
  images: { ...siteConfig.images, web: { widths: [40], quality: 70 }, mockups: { widths: [60] }, details: { widths: [30] }, photos: { widths: [40] }, fler: { ...siteConfig.images.fler, longEdge: 120 }, instagram: { ...siteConfig.images.instagram, width: 40, height: 50 }, og: { ...siteConfig.images.og, width: 60, height: 40 } },
};

let tmp, demoDir, outDir, siteDir;
const write = async (file, text) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
};
const exists = (p) => fs.access(p).then(() => true, () => false);
const opts = () => ({ demoDir, outDir, siteDir, config, log: () => {} });

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-demo-'));
  demoDir = path.join(tmp, 'demo');
  outDir = path.join(tmp, '.demo');
  siteDir = path.join(tmp, 'pavla');
  await write(path.join(siteDir, 'public/favicon.svg'), '<svg/>');
  await write(path.join(siteDir, 'public/CNAME'), 'pavla.kramolis.cz');
  await write(path.join(siteDir, 'public/works/2026/x/info.json'), '{}'); // real generated data, must not be copied
  await write(path.join(demoDir, 'images.yaml'), YAML.stringify({
    palettes: { voda: ['#6f94b3'] },
    images: { 'tvorba/2026/demo-rano.jpg': { size: [80, 60], palette: 'voda', seed: 3 } },
  }));
  await write(path.join(demoDir, 'tvorba/2026/demo-rano.yaml'), 'demo: true\ntitle: Ráno\ndate: 2026-06-14\n');
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

test('prepareDemo builds the test data into .demo/ only and writes the assigned id back to demo/', async () => {
  const r = await prepareDemo(opts());
  assert.equal(r.ok, true, r.problems.join('\n'));
  const id = YAML.parse(await fs.readFile(path.join(demoDir, 'tvorba/2026/demo-rano.yaml'), 'utf8')).id;
  assert.ok(id, 'id written back to demo/');
  assert.ok(await exists(path.join(outDir, 'site/content/works/2026', `demo-rano-${id}.yaml`)));
  assert.ok(await exists(path.join(outDir, 'site/public/works/2026', `demo-rano-${id}`, 'og.jpg')));
  // static site files, but not the domain and not the real generated data
  assert.ok(await exists(path.join(outDir, 'site/public/favicon.svg')));
  assert.ok(!(await exists(path.join(outDir, 'site/public/CNAME'))));
  assert.ok(!(await exists(path.join(outDir, 'site/public/works/2026/x'))));
  // this repo's own generated data are untouched
  assert.ok(!(await exists(path.join(siteDir, 'content'))));
  // second run: nothing to regenerate, the id stays
  const again = await prepareDemo(opts());
  assert.equal(again.processed, 0);
  assert.equal(YAML.parse(await fs.readFile(path.join(demoDir, 'tvorba/2026/demo-rano.yaml'), 'utf8')).id, id);
});

test('prepareDemo refuses unmarked items and a broken recipe', async () => {
  await write(path.join(demoDir, 'tvorba/2026/vecer.yaml'), 'title: Večer\ndate: 2026-06-14\n');
  let r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /vecer\.yaml: every item of the test data needs "demo: true"/);

  await fs.rm(path.join(demoDir, 'tvorba/2026/vecer.yaml'));
  await write(path.join(demoDir, 'images.yaml'), YAML.stringify({ palettes: {}, images: { 'tvorba/2026/demo-rano.jpg': { size: [80, 60], palette: 'x', seed: 3 } } }));
  r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /unknown palette "x"/);
});
