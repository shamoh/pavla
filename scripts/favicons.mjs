// Makes public/favicon.ico from public/favicon.svg, the home screen icons (public/apple-touch-icon.png,
// public/icon-<size>.png of site.webmanifest) from scripts/home-screen-icon.svg and the icons of the shortcuts
// (public/shortcut-<id>.png) from scripts/shortcut-icons/<id>.svg (npm run favicons).
// Run it after every change of any of these SVGs and commit the results.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST_SHORTCUTS, makeFavicons } from './lib/favicons.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(scriptsDir, '..', 'public');
const shortcutSvgs = Object.fromEntries(await Promise.all(MANIFEST_SHORTCUTS.map(async ({ id }) =>
  [id, await fs.readFile(path.join(scriptsDir, 'shortcut-icons', `${id}.svg`))])));
const { ico, apple, manifest } = await makeFavicons(
  await fs.readFile(path.join(publicDir, 'favicon.svg')),
  await fs.readFile(path.join(scriptsDir, 'home-screen-icon.svg')),
  shortcutSvgs,
);
const files = { 'favicon.ico': ico, 'apple-touch-icon.png': apple, ...manifest };
for (const [name, png] of Object.entries(files)) await fs.writeFile(path.join(publicDir, name), png);
console.log(`Done: ${Object.keys(files).map((name) => `public/${name}`).join(', ')}`);
