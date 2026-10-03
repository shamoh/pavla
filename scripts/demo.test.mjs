import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { prepareDemo } from './demo.mjs';
import { pullRequestPaths } from './lib/pull-request.mjs';
import { run } from './process-images.mjs';

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
  demoDir = path.join(tmp, 'demo-content');
  outDir = path.join(tmp, '.demo');
  siteDir = path.join(tmp, 'pavla');
  await write(path.join(siteDir, 'public/favicon.svg'), '<svg/>');
  await write(path.join(siteDir, 'public/CNAME'), 'pavla.kramolis.cz');
  await write(path.join(siteDir, 'public/tvorba/2026/x/info.json'), '{}'); // real generated data, must not be copied
  await write(path.join(demoDir, 'images.yaml'), YAML.stringify({
    palettes: { voda: ['#6f94b3'] },
    images: { 'tvorba/demo-rano.jpg': { size: [80, 60], palette: 'voda', seed: 3 } },
  }));
  await write(path.join(demoDir, 'demo-content.yaml'), '# test data\n');
  await write(path.join(demoDir, 'tvorba/demo-rano.yaml'), 'title: Ráno\ndate: 2026-06-14\n');
});
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));

test('prepareDemo builds the test data into .demo/ only and writes the assigned id back to demo-content/', async () => {
  const r = await prepareDemo(opts());
  assert.equal(r.ok, true, r.problems.join('\n'));
  const id = YAML.parse(await fs.readFile(path.join(demoDir, 'tvorba/demo-rano.yaml'), 'utf8')).id;
  assert.ok(id, 'id written back to demo-content/');
  assert.ok(await exists(path.join(outDir, 'content/demo-content.yaml')), 'the marker comes with the content');
  assert.ok(await exists(path.join(outDir, 'site/content/tvorba/demo-rano.yaml')));
  assert.ok(await exists(path.join(outDir, 'site/public/tvorba/2026', `demo-rano-${id}`, 'og.jpg')));
  // static site files, but not the domain and not the real generated data
  assert.ok(await exists(path.join(outDir, 'site/public/favicon.svg')));
  assert.ok(!(await exists(path.join(outDir, 'site/public/CNAME'))));
  assert.ok(!(await exists(path.join(outDir, 'site/public/tvorba/2026/x'))));
  // this repo's own generated data are untouched
  assert.ok(!(await exists(path.join(siteDir, 'content'))));
  // second run: nothing to regenerate, the id stays
  const again = await prepareDemo(opts());
  assert.equal(again.processed, 0);
  assert.equal(YAML.parse(await fs.readFile(path.join(demoDir, 'tvorba/demo-rano.yaml'), 'utf8')).id, id);
});

test('dry run: content only, then the pipeline on the test data into a site repo, then the pull request paths', async () => {
  const r = await prepareDemo({ ...opts(), contentOnly: true });
  assert.equal(r.ok, true);
  assert.ok(await exists(path.join(outDir, 'content/tvorba/demo-rano.jpg')));
  assert.ok(!(await exists(path.join(outDir, 'site'))), 'no pipeline run');

  // like .github/workflows/dry-run.yml: `npm run images -- --demo` writes into the checkout of this repo
  const git = (...args) => promisify(execFile)('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: siteDir });
  await git('init', '-q');
  await git('add', '-A');
  await git('commit', '-q', '-m', 'site with real data');
  assert.equal((await run({ contentDir: r.contentDir, siteDir, config, log: () => {}, dataset: 'demo' })).ok, true);
  assert.equal((await run({ contentDir: r.contentDir, siteDir, config, log: () => {} })).ok, false, 'the real data set refuses test data');

  const paths = await pullRequestPaths(siteDir);
  assert.ok(!paths.includes('public/_cover'), 'no own cover photo of the home page in this test data');
  await git('add', '--', ...paths);
  const { stdout } = await git('status', '--porcelain');
  assert.match(stdout, /^A {2}content\/tvorba\/demo-rano\.yaml$/m);
  assert.match(stdout, /^D {2}public\/tvorba\/2026\/x\/info\.json$/m, 'the real work is pruned');
});

test('prepareDemo refuses works without "demo-" names, test data without the marker and a broken recipe', async () => {
  await write(path.join(demoDir, 'tvorba/vecer.yaml'), 'title: Večer\ndate: 2026-06-14\n');
  let r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /vecer\.yaml: names of test works and collections start with "demo-"/);
  await fs.rm(path.join(demoDir, 'tvorba/vecer.yaml'));

  // the marker is copied with the content; without it the pipeline refuses to run on the test data
  await fs.rm(path.join(demoDir, 'demo-content.yaml'));
  r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /demo-content\.yaml missing/);
  assert.equal(await exists(path.join(outDir, 'content/demo-content.yaml')), false, 'a stale marker is not left behind');
  await write(path.join(demoDir, 'demo-content.yaml'), '# test data\n');

  await write(path.join(demoDir, 'images.yaml'), YAML.stringify({ palettes: {}, images: { 'tvorba/demo-rano.jpg': { size: [80, 60], palette: 'x', seed: 3 } } }));
  r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /unknown palette "x"/);
});
