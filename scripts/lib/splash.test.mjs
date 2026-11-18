import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { SPLASH_DEVICES, SPLASH_SCHEMES, renderSplash, splashLayout, splashPalette, splashScreens } from './splash.mjs';
import { loadFonts } from './instagram.mjs';

test('splashScreens: every device upright, iPads also on their side, each light and dark, all names different', () => {
  const screens = splashScreens();
  const ipads = SPLASH_DEVICES.filter((d) => d.both).length;
  assert.equal(screens.length, (SPLASH_DEVICES.length + ipads) * SPLASH_SCHEMES.length);
  const pro = screens.filter((s) => s.file.endsWith('-1290x2796.png'));
  assert.deepEqual(pro.map((s) => s.scheme), ['light', 'dark']);
  assert.equal(pro[0].media, '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)');
  const side = screens.find((s) => s.file === 'apple-splash-dark-2732x2048.png');
  assert.match(side.media, /device-width: 1024px\) and \(device-height: 1366px\).*orientation: landscape.*dark/);
  assert.throws(() => splashScreens([{ width: 10, height: 20, ratio: 1 }, { width: 10, height: 20, ratio: 1 }]), /two launch screens of one size/);
});

test('splashLayout: the icon, the name and the tagline in the middle, inside the screen, by the shorter side', () => {
  for (const [w, h] of [[1290, 2796], [2732, 2048]]) {
    const l = splashLayout(w, h);
    assert.ok(Math.abs(l.icon.x * 2 + l.icon.size - w) <= 1, "centred");
    assert.ok(l.icon.y > 0 && l.tagline.baseline < h);
    assert.ok(l.title.baseline > l.icon.y + l.icon.size && l.tagline.baseline > l.title.baseline);
    const middle = (l.icon.y + l.tagline.baseline) / 2;
    assert.ok(Math.abs(middle - h / 2) < h * 0.05, 'about the middle');
  }
  assert.equal(splashLayout(1290, 2796).icon.size, splashLayout(2796, 1290).icon.size, 'the same in both orientations');
});

test('renderSplash: the size of the screen, paper of the palette at the corner, ink in the middle of the name', async () => {
  const homeSvg = await fs.readFile(new URL('../home-screen-icon.svg', import.meta.url));
  const fonts = await loadFonts();
  for (const scheme of SPLASH_SCHEMES) {
    const png = await renderSplash({ width: 375, height: 667, scheme }, { homeSvg, fonts, title: 'Pavla Kramolišová', tagline: 'Akvarely pro radost' });
    const meta = await sharp(png).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['png', 375, 667]);
    const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const hex = (i) => `#${[0, 1, 2].map((k) => data[i * 3 + k].toString(16).padStart(2, '0')).join('')}`;
    assert.equal(hex(0), splashPalette(scheme).paper);
    const l = splashLayout(375, 667);
    const row = Math.round(l.title.baseline - l.title.size * 0.3);
    const inked = Array.from({ length: 375 }, (_, x) => hex(row * 375 + x)).filter((c) => c !== splashPalette(scheme).paper).length;
    assert.ok(inked > 20, `the name is drawn (${scheme})`);
  }
});
