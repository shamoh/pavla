import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { loadFonts } from './instagram.mjs';
import { WATERMARK_LOOK, watermarkSvg } from './watermark.mjs';

test('watermarkSvg: the name bottom right, light letters over a soft dark shadow, no NaN', async () => {
  const { serif } = await loadFonts();
  const svg = watermarkSvg({ width: 2000, height: 1500, text: 'Pavla Kramolišová', font: serif, opacity: 0.9, shadow: 0.6 });
  assert.ok(!svg.includes('NaN'));
  assert.match(svg, /<feGaussianBlur stdDeviation="[\d.]+"\/>/);
  assert.match(svg, /fill="#000000" fill-opacity="0.6"[^>]*filter="url\(#shadow\)"/, 'the shadow');
  assert.match(svg, /fill="#ffffff" fill-opacity="0.9"/, 'the letters');
  const size = Math.round(1500 * WATERMARK_LOOK.size);
  const xs = [...svg.matchAll(/[MLQC]([\d.]+) ([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  assert.ok(Math.max(...xs.map(([x]) => x)) <= 2000 - size, 'clear of the right edge');
  assert.ok(Math.min(...xs.map(([x]) => x)) > 1000, 'in the right half');
  assert.ok(Math.max(...xs.map(([, y]) => y)) <= 1500 - size, 'clear of the bottom edge');
});

test('watermarkSvg reads on light and dark backgrounds: light letters with a darker rim', async () => {
  const { serif } = await loadFonts();
  for (const background of ['#ffffff', '#202020']) {
    const svg = watermarkSvg({ width: 800, height: 600, text: 'Pavla Kramolišová', font: serif });
    // encoded first, like the exports
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let light = 0, dark = 0;
    for (let y = 520; y < 600; y++) for (let x = 400; x < 800; x++) {
      const v = data[(y * info.width + x) * info.channels];
      if (v > 200) light++;
      if (v < 200) dark++;
    }
    if (background === '#202020') assert.ok(light > 200, `light letters on dark (${light})`);
    else assert.ok(dark > 200, `a darker shadow around them on white (${dark})`);
  }
});
