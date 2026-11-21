import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SITE_FILES, SITE_FONTS, siteFileProblems, siteFolderProblems } from './site-folder-check.mjs';
import { DEMO_SITE_DIR } from './test-support/demo-site.mjs';

// A copy of the site folder of the test site to break (the scenes are linked, not copied).
function copyOfTestSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-folder-'));
  for (const file of SITE_FILES.filter((f) => !f.startsWith('mockups/'))) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.copyFileSync(path.join(DEMO_SITE_DIR, file), path.join(dir, file));
  }
  for (const place of ['fonts', 'mockups']) fs.symlinkSync(path.join(DEMO_SITE_DIR, place), path.join(dir, place));
  return dir;
}

test('siteFolderProblems: the site folder of the test site is fine', async () => {
  assert.deepEqual(await siteFolderProblems(DEMO_SITE_DIR), []);
});

test('siteFileProblems: the files every site folder has, the fonts, the dark favicon and the settings', () => {
  const dir = copyOfTestSite();
  assert.deepEqual(siteFileProblems(dir), []);
  fs.rmSync(path.join(dir, 'public/icon-512.png'));
  fs.rmSync(path.join(dir, 'home-screen-icon.svg'));
  fs.writeFileSync(path.join(dir, 'public/favicon.svg'), '<svg><rect class="sheet"/></svg>');
  assert.deepEqual(siteFileProblems(dir), [
    'missing home-screen-icon.svg', 'missing public/icon-512.png',
    'public/favicon.svg: the sheet (rect.sheet) does not turn dark in the dark mode',
  ]);
  fs.writeFileSync(path.join(dir, 'site.config.yaml'), 'site:\n  title: X\n');
  assert.match(siteFileProblems(dir).join(), /site\.config\.yaml: no site\.url/);
  fs.writeFileSync(path.join(dir, 'site.config.yaml'), 'site:\n  url: https://web.test\n  storagePrefix: Pavla.web\n');
  assert.deepEqual(siteFileProblems(dir).filter((p) => p.startsWith('site.config')), ['site.config.yaml: site.storagePrefix must be small letters and digits joined by "-", got "Pavla.web"']);
  fs.writeFileSync(path.join(dir, 'site.config.yaml'), 'site:\n  url: https://web.test\n');
  assert.deepEqual(siteFileProblems(dir).filter((p) => p.startsWith('site.config')), [], 'no prefix = the default');
  fs.writeFileSync(path.join(dir, 'site.config.yaml'), 'site:\n  url: https://web.test\ngame:\n  overviewSkip: [Barbora III]\n');
  assert.match(siteFileProblems(dir).join(), /site\.config\.yaml: game\.overviewSkip must be a list of ids/);
  fs.writeFileSync(path.join(dir, 'site.config.yaml'), 'site: [\n');
  assert.match(siteFileProblems(dir).join(), /site\.config\.yaml: /);
  // an empty folder: everything missing, the fonts too
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'site-folder-'));
  assert.equal(siteFileProblems(empty).length, SITE_FILES.length + SITE_FONTS.length);
});

test('siteFolderProblems: the scenes too, each problem with its file; without scenes.yaml no scene is loaded', async () => {
  const dir = copyOfTestSite();
  fs.rmSync(path.join(dir, 'mockups'));
  fs.mkdirSync(path.join(dir, 'mockups/instagram'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'mockups/scenes.yaml'), '- name: x\n  file: x.jpg\n  group: wall\n');
  fs.writeFileSync(path.join(dir, 'mockups/instagram/scenes.yaml'), '- name: y\n  mode: lie\n');
  const problems = await siteFolderProblems(dir);
  assert.ok(problems.includes('mockups/scenes.yaml: no scene in the group desk'), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('mockups/scenes.yaml: x: missing label')), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('mockups/instagram/scenes.yaml: ')), problems.join('\n'));
  fs.rmSync(path.join(dir, 'mockups/scenes.yaml'));
  assert.deepEqual(await siteFolderProblems(dir), ['missing mockups/scenes.yaml']);
});

test('SITE_FONTS: the fonts the captions load', () => {
  for (const font of SITE_FONTS) assert.ok(fs.existsSync(path.join(DEMO_SITE_DIR, 'fonts', font)), font);
});
