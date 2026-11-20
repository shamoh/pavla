import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { assembleSite, prepareDemo } from './demo.mjs';
import { pullRequestPaths } from './lib/pull-request.mjs';
import { run } from './process-images.mjs';
import { CODE_ROOT, readSiteConfig, sitePaths } from './lib/site-dir.mjs';

// the folder of the test site (its source in demo-content/site/) and the real site in the root of the code
const DEMO_SITE = path.join(CODE_ROOT, 'demo-content', 'site');
const siteConfig = readSiteConfig(DEMO_SITE);
const config = {
  ...siteConfig,
  images: { ...siteConfig.images, web: { widths: [40], quality: 70 }, mockups: { widths: [60] }, details: { widths: [30] }, photos: { widths: [40] }, fler: { ...siteConfig.images.fler, longEdge: 120 }, instagram: { ...siteConfig.images.instagram, width: 40, height: 50 }, og: { ...siteConfig.images.og, width: 60, height: 40 } },
};

let tmp, demoDir, outDir, siteDir, siteSource;
const write = async (file, text) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
};
const exists = (p) => fs.access(p).then(() => true, () => false);
const opts = () => ({ demoDir, outDir, siteSource, config, log: () => {} });

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-demo-'));
  demoDir = path.join(tmp, 'demo-content');
  outDir = path.join(tmp, '.demo');
  // a checkout of the real site (dry run): its scenes and fonts, a domain and generated data
  siteDir = path.join(tmp, 'pavla');
  for (const place of ['mockups', 'fonts']) {
    await fs.mkdir(siteDir, { recursive: true });
    await fs.symlink(sitePaths(CODE_ROOT)[place], sitePaths(siteDir)[place]);
  }
  await write(path.join(siteDir, 'public/CNAME'), 'pavla.kramolis.cz');
  await write(path.join(siteDir, 'public/tvorba/2026/x/info.json'), '{}');
  // the source of the folder of the test site: settings, icon, the scenes and fonts of the test site
  siteSource = path.join(demoDir, 'site');
  await write(sitePaths(siteSource).config, YAML.stringify(config));
  await write(sitePaths(siteSource).homeScreenIcon, '<svg/>');
  for (const place of ['mockups', 'fonts']) await fs.symlink(sitePaths(DEMO_SITE)[place], sitePaths(siteSource)[place]);
  await write(path.join(siteSource, 'public/favicon.svg'), '<svg/>');
  await write(path.join(siteSource, 'public/CNAME'), 'example.org'); // never copied: the test site has no domain
  await write(path.join(siteSource, 'public/tvorba/2026/x/info.json'), '{}'); // a generated folder, never copied
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
  const workDir = path.join(outDir, 'site/public/tvorba/2026', `demo-rano-${id}`);
  const og = JSON.parse(await fs.readFile(path.join(workDir, 'info.json'), 'utf8')).og.file;
  assert.match(og, /^og-[0-9a-f]{8}\.jpg$/);
  assert.ok(await exists(path.join(workDir, og)));
  // the folder of the test site: its settings, icon, scenes and fonts and static files, but not a domain nor
  // generated folders of the source
  for (const file of ['site.config.yaml', 'home-screen-icon.svg', 'mockups/scenes.yaml', 'mockups/instagram/scenes.yaml', 'public/favicon.svg']) {
    assert.ok(await exists(path.join(outDir, 'site', file)), file);
  }
  assert.ok(!(await exists(path.join(outDir, 'site/public/CNAME'))));
  assert.ok(!(await exists(path.join(outDir, 'site/public/tvorba/2026/x'))));
  // texts of the pages: skeletons written back to demo-content/stranky/, a test text kept as it is
  assert.ok(await exists(path.join(demoDir, 'stranky/o-mne.yaml')), 'the skeleton of a page goes back to demo-content/');
  await write(path.join(demoDir, 'stranky/kontakt.yaml'), 'description: Testovací popis.\ntext: Testovací text.\n');
  const pages = await prepareDemo(opts());
  assert.equal(pages.ok, true, pages.problems.join('\n'));
  assert.equal(YAML.parse(await fs.readFile(path.join(outDir, 'site/content/stranky/kontakt.yaml'), 'utf8')).text, 'Testovací text.\n');
  // the real site is untouched
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

  // the images are not in the pull request (their branch, scripts/binary.mjs): content/ only, no binary.lock packed here
  const paths = await pullRequestPaths(siteDir);
  assert.deepEqual(paths, ['content']);
  await git('add', '--', ...paths);
  const { stdout } = await git('status', '--porcelain');
  assert.match(stdout, /^A {2}content\/tvorba\/demo-rano\.yaml$/m);
  assert.ok(!(await exists(path.join(siteDir, 'public/tvorba/2026/x/info.json'))), 'the real work is pruned');
});

test('prepareDemo refuses works without "demo-" names, test data without the marker and a broken recipe', async () => {
  await write(path.join(demoDir, 'tvorba/vecer.yaml'), 'title: Večer\ndate: 2026-06-14\n');
  let r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /vecer\.yaml: jména testovacích děl a kolekcí začínají „demo-“/);
  await fs.rm(path.join(demoDir, 'tvorba/vecer.yaml'));

  // the marker is copied with the content; without it the pipeline refuses to run on the test data
  await fs.rm(path.join(demoDir, 'demo-content.yaml'));
  r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /demo-content\.yaml: chybí/);
  assert.equal(await exists(path.join(outDir, 'content/demo-content.yaml')), false, 'a stale marker is not left behind');
  await write(path.join(demoDir, 'demo-content.yaml'), '# test data\n');

  await write(path.join(demoDir, 'images.yaml'), YAML.stringify({ palettes: {}, images: { 'tvorba/demo-rano.jpg': { size: [80, 60], palette: 'x', seed: 3 } } }));
  r = await prepareDemo(opts());
  assert.equal(r.ok, false);
  assert.match(r.problems.join('\n'), /unknown palette "x"/);
});

test('assembleSite: settings, icon, scenes and fonts replaced, static files copied next to the generated data', async () => {
  const source = path.join(tmp, 'source');
  const target = path.join(tmp, 'target');
  await write(path.join(source, 'site.config.yaml'), 'demo: true\n');
  await write(path.join(source, 'home-screen-icon.svg'), '<svg id="new"/>');
  await write(path.join(source, 'fonts/a.ttf'), 'font');
  await write(path.join(source, 'mockups/scenes.yaml'), '[]\n');
  await write(path.join(source, 'public/icon-192.png'), 'png');
  await write(path.join(source, 'public/CNAME'), 'example.org');
  await write(path.join(target, 'site.config.yaml'), 'old: true\n');
  await write(path.join(target, 'mockups/stale.jpg'), 'old scene');
  await write(path.join(target, 'public/tvorba/2026/w/info.json'), '{}');
  await assembleSite(source, target);
  assert.equal(await fs.readFile(path.join(target, 'site.config.yaml'), 'utf8'), 'demo: true\n');
  assert.equal(await fs.readFile(path.join(target, 'home-screen-icon.svg'), 'utf8'), '<svg id="new"/>');
  assert.ok(await exists(path.join(target, 'fonts/a.ttf')));
  assert.ok(await exists(path.join(target, 'mockups/scenes.yaml')));
  assert.ok(!(await exists(path.join(target, 'mockups/stale.jpg'))), 'a scene gone from the source is gone');
  assert.ok(await exists(path.join(target, 'public/icon-192.png')));
  assert.ok(!(await exists(path.join(target, 'public/CNAME'))), 'never a domain');
  assert.ok(await exists(path.join(target, 'public/tvorba/2026/w/info.json')), 'the generated data stay');
});

test('the source of the test site is a complete site folder marked as test data', async () => {
  assert.equal(siteConfig.demo, true);
  for (const file of ['home-screen-icon.svg', 'mockups/scenes.yaml', 'mockups/instagram/scenes.yaml', 'public/favicon.svg']) {
    assert.ok(await exists(path.join(DEMO_SITE, file)), file);
  }
  assert.ok(!(await exists(path.join(DEMO_SITE, 'public/CNAME'))), 'the test site has no domain');
  // every scene has its photos (a mockup scene its file, a studio scene <name>.jpg and the bare sheet <name>-list.jpg)
  const { mockups, instagramScenes } = sitePaths(DEMO_SITE);
  for (const scene of YAML.parse(await fs.readFile(path.join(mockups, 'scenes.yaml'), 'utf8'))) {
    assert.ok(await exists(path.join(mockups, scene.file)), scene.file);
  }
  for (const scene of YAML.parse(await fs.readFile(path.join(instagramScenes, 'scenes.yaml'), 'utf8'))) {
    for (const image of [`${scene.name}.jpg`, `${scene.name}-list.jpg`]) assert.ok(await exists(path.join(instagramScenes, image)), image);
  }
});
