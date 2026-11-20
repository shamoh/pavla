import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {
  APPLE_SIZE, ICO_SIZES, MANIFEST_SHORTCUTS, screenshotSize, MANIFEST_SIZES, SHORTCUT_ICON_SIZE, makeFavicons, manifestIconFile, packIco, renderIcon,
  shortcutIconFile, webManifest,
} from './favicons.mjs';
import { CODE_ROOT } from './site-dir.mjs';
import { checkedSiteDirs } from './test-support/demo-site.mjs';

const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#6f9bb8"/></svg>');

test('packIco: header, one directory entry per image and the PNGs at their offsets', () => {
  const a = Buffer.from('first');
  const b = Buffer.from('second png');
  const ico = packIco([{ size: 16, png: a }, { size: 256, png: b }]);
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)], [0, 1, 2]);
  assert.equal(ico.readUInt8(6), 16);
  assert.equal(ico.readUInt8(6 + 16), 0, '256 is written as 0');
  const offA = ico.readUInt32LE(6 + 12);
  const offB = ico.readUInt32LE(6 + 16 + 12);
  assert.equal(offA, 6 + 32);
  assert.equal(ico.subarray(offA, offA + ico.readUInt32LE(6 + 8)).toString(), 'first');
  assert.equal(ico.subarray(offB, offB + ico.readUInt32LE(6 + 16 + 8)).toString(), 'second png');
  assert.equal(ico.length, 6 + 32 + a.length + b.length);
});

test('packIco: no image or a size out of range is an error', () => {
  assert.throws(() => packIco([]), /at least one/);
  assert.throws(() => packIco([{ size: 300, png: Buffer.from('x') }]), /out of 1–256/);
});

test('renderIcon: square PNG, transparent by default, with a background when asked', async () => {
  const meta = await sharp(await renderIcon(svg, 32)).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height, meta.hasAlpha], ['png', 32, 32, true]);
  const corner = await sharp(await renderIcon(svg, 40, { background: '#f7f4ee', padding: 0.1 })).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...corner.subarray(0, 3)], [0xf7, 0xf4, 0xee]);
});

test('makeFavicons: ICO with every size from the favicon, the home screen icons opaque from their own SVG', async () => {
  const home = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#3f80c8"/></svg>');
  const { ico, apple, manifest } = await makeFavicons(svg, home);
  assert.equal(ico.readUInt16LE(4), ICO_SIZES.length);
  assert.deepEqual(ICO_SIZES.map((_, i) => ico.readUInt8(6 + 16 * i)), ICO_SIZES);
  const meta = await sharp(apple).metadata();
  assert.deepEqual([meta.width, meta.height], [APPLE_SIZE, APPLE_SIZE]);
  const corner = await sharp(apple).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...corner.subarray(0, 3)], [0x3f, 0x80, 0xc8], 'the painting reaches the corner, no paper margin');
  assert.deepEqual(Object.keys(manifest), ['icon-192.png', 'icon-512.png']);
  for (const size of MANIFEST_SIZES) {
    const m = await sharp(manifest[manifestIconFile(size)]).metadata();
    assert.deepEqual([m.width, m.height], [size, size]);
  }
});

test('makeFavicons: a 96 px icon of every shortcut, an unknown shortcut is an error', async () => {
  const { manifest } = await makeFavicons(svg, svg, { tvorba: svg });
  const m = await sharp(manifest[shortcutIconFile('tvorba')]).metadata();
  assert.deepEqual([m.width, m.height], [SHORTCUT_ICON_SIZE, SHORTCUT_ICON_SIZE]);
  await assert.rejects(makeFavicons(svg, svg, { obchod: svg }), /icon of an unknown shortcut: obchod/);
});

test('webManifest: name, short name under the icon, colours, relative addresses, icons any and maskable', () => {
  const m = webManifest({ title: 'Pavla Kramolišová', tagline: 'Akvarely pro radost' }, '#f7f4ee');
  assert.equal(m.name, 'Pavla Kramolišová');
  assert.equal(m.short_name, 'Pavla');
  assert.equal(m.description, 'Akvarely pro radost');
  assert.deepEqual([m.id, m.start_url, m.scope, m.display, m.orientation, m.lang], ['./', './', './', 'standalone', 'any', 'cs']);
  assert.equal(m.prefer_related_applications, false);
  assert.deepEqual([m.background_color, m.theme_color], ['#f7f4ee', '#f7f4ee']);
  assert.deepEqual(m.icons.map((i) => `${i.src} ${i.sizes} ${i.purpose}`), ['icon-192.png 192x192 any', 'icon-512.png 512x512 any', 'icon-512.png 512x512 maskable']);
  assert.deepEqual(m.shortcuts.map((x) => `${x.name} ${x.url}`), [
    'Detail dne detail-dne/', 'Tvorba tvorba/', 'Oblíbené tvorba/?favorites=1&cinema=random&from=shortcut_favorites',
  ], 'no selection, no show of it; the favourites always (the manifest cannot know them)');
  assert.ok(m.shortcuts.every((x) => x.short_name === x.name && x.description && !x.url.startsWith('/')), 'relative');
  assert.deepEqual(m.shortcuts[0].icons, [{ src: 'shortcut-detail-dne.png', sizes: '96x96', type: 'image/png' }]);
  const featured = webManifest({ title: 'Pavla Kramolišová' }, '#f7f4ee', { hasFeatured: true });
  assert.deepEqual(featured.shortcuts.map((x) => `${x.name} ${x.url}`), [
    'Detail dne detail-dne/', 'Tvorba tvorba/', 'Promítat tvorba/?featured=1&cinema=random&from=shortcut',
    'Oblíbené tvorba/?favorites=1&cinema=random&from=shortcut_favorites',
  ]);
  assert.equal(featured.shortcuts[2].icons[0].src, 'shortcut-promitat.png');
  assert.equal(featured.shortcuts[3].icons[0].src, 'shortcut-oblibene.png');
  assert.equal('description' in webManifest({ title: 'X' }, '#fff'), false, 'no tagline, no description');
});

test('the committed icons exist for every file of the manifest and the home screen SVG is the source, in each site', () => {
  for (const { id } of MANIFEST_SHORTCUTS) assert.ok(fs.existsSync(path.join(CODE_ROOT, 'scripts/shortcut-icons', `${id}.svg`)), id);
  for (const siteDir of checkedSiteDirs()) {
    const files = ['home-screen-icon.svg', 'public/apple-touch-icon.png', ...MANIFEST_SIZES.map((s) => `public/${manifestIconFile(s)}`), ...MANIFEST_SHORTCUTS.map(({ id }) => `public/${shortcutIconFile(id)}`)];
    for (const file of files) assert.ok(fs.existsSync(path.join(siteDir, file)), `${siteDir}: ${file}`);
  }
});

test('favicon.svg: the sheet of paper turns dark in the dark mode of the browser', () => {
  for (const siteDir of checkedSiteDirs()) {
    const favicon = fs.readFileSync(path.join(siteDir, 'public/favicon.svg'), 'utf8');
    assert.match(favicon, /@media \(prefers-color-scheme: dark\)\{\.sheet\{/, siteDir);
    assert.match(favicon, /<rect class="sheet"/, siteDir);
  }
});

test('webManifest: screenshots for the install dialog, phones and a computer, sizes within what Chrome accepts', () => {
  const m = webManifest({ title: 'Pavla Kramolišová' }, '#f7f4ee');
  assert.deepEqual(m.screenshots.map((s) => `${s.src} ${s.sizes} ${s.form_factor}`), [
    'app-screenshot-home.webp 1080x2400 narrow', 'app-screenshot-gallery.webp 1080x2400 narrow',
    'app-screenshot-game.webp 1080x2400 narrow', 'app-screenshot-wide.webp 1920x1200 wide',
  ]);
  assert.ok(m.screenshots.every((s) => s.label && s.type === 'image/webp'));
  for (const form of ['narrow', 'wide']) {
    const [w, h] = screenshotSize(form).split('x').map(Number);
    assert.ok(Math.max(w, h) <= 3840 && Math.min(w, h) >= 320 && Math.max(w, h) / Math.min(w, h) <= 2.3, form);
  }
});

