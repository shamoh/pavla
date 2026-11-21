// The check of the data of a site folder (npm run check:site): what the code reads from a site folder exists and
// makes sense (settings, icons, fonts, mockup scenes, studio scenes). The tests of the code (npm test) run only on the
// test site; a site checks its own data with this, in its own check (the workflow "Kontrola kódu").

import fs from 'node:fs';
import path from 'node:path';
import { MANIFEST_SHORTCUTS, MANIFEST_SIZES, manifestIconFile, shortcutIconFile } from './favicons.mjs';
import { CAPTION_FONTS, loadInstagramScenes, studioScenesProblems } from './instagram.mjs';
import { loadScenes, mockupScenesProblems } from './mockups.mjs';
import { readSiteConfig, sitePaths } from './site-dir.mjs';

/** The files every site folder has, relative to it (the icons are made by npm run favicons). */
export const SITE_FILES = [
  'site.config.yaml', 'home-screen-icon.svg', 'mockups/scenes.yaml', 'mockups/instagram/scenes.yaml',
  'public/favicon.svg', 'public/favicon.ico', 'public/apple-touch-icon.png',
  ...MANIFEST_SIZES.map((size) => `public/${manifestIconFile(size)}`),
  ...MANIFEST_SHORTCUTS.map(({ id }) => `public/${shortcutIconFile(id)}`),
];

/** The fonts of the captions (loadFonts in instagram.mjs). */
export const SITE_FONTS = Object.values(CAPTION_FONTS);

/** What is wrong with the files of the site folder `siteDir` (no scene is loaded): missing files, a broken favicon. */
export function siteFileProblems(siteDir) {
  const problems = SITE_FILES.filter((file) => !fs.existsSync(path.join(siteDir, file))).map((file) => `missing ${file}`);
  problems.push(...SITE_FONTS.filter((font) => !fs.existsSync(path.join(sitePaths(siteDir).fonts, font))).map((font) => `missing fonts/${font}`));
  const favicon = path.join(siteDir, 'public/favicon.svg');
  if (fs.existsSync(favicon)) {
    // the sheet of paper turns dark in the dark mode of the browser
    const svg = fs.readFileSync(favicon, 'utf8');
    if (!/<rect class="sheet"/.test(svg) || !/@media \(prefers-color-scheme: dark\)\{\.sheet\{/.test(svg)) problems.push('public/favicon.svg: the sheet (rect.sheet) does not turn dark in the dark mode');
  }
  if (fs.existsSync(sitePaths(siteDir).config)) {
    try {
      if (!readSiteConfig(siteDir)?.site?.url) problems.push('site.config.yaml: no site.url');
    } catch (e) {
      problems.push(`site.config.yaml: ${e.message.split('\n')[0]}`);
    }
  }

  return problems;
}

/** Everything wrong with the site folder `siteDir`: its files, its mockup scenes and its studio scenes. */
export async function siteFolderProblems(siteDir) {
  const problems = siteFileProblems(siteDir);
  if (problems.some((p) => /scenes\.yaml/.test(p))) return problems;
  const paths = sitePaths(siteDir);
  const scenesOf = async (label, load, check) => {
    try {
      problems.push(...(await check((await load()).scenes)).map((p) => `${label}: ${p}`));
    } catch (e) {
      problems.push(`${label}: ${e.message.split('\n')[0]}`);
    }
  };
  await scenesOf('mockups/scenes.yaml', () => loadScenes(paths.mockups), mockupScenesProblems);
  await scenesOf('mockups/instagram/scenes.yaml', () => loadInstagramScenes(paths.instagramScenes), studioScenesProblems);

  return problems;
}
