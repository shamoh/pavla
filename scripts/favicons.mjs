// Makes public/favicon.ico and public/apple-touch-icon.png from public/favicon.svg (npm run favicons).
// Run it after every change of favicon.svg and commit all three.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFavicons } from './lib/favicons.mjs';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const { ico, apple } = await makeFavicons(await fs.readFile(path.join(publicDir, 'favicon.svg')));
await fs.writeFile(path.join(publicDir, 'favicon.ico'), ico);
await fs.writeFile(path.join(publicDir, 'apple-touch-icon.png'), apple);
console.log('Done: public/favicon.ico, public/apple-touch-icon.png');
