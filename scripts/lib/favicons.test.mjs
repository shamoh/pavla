import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { APPLE_SIZE, ICO_SIZES, makeFavicons, packIco, renderIcon } from './favicons.mjs';

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

test('makeFavicons: ICO with every size, apple touch icon in its size', async () => {
  const { ico, apple } = await makeFavicons(svg);
  assert.equal(ico.readUInt16LE(4), ICO_SIZES.length);
  assert.deepEqual(ICO_SIZES.map((_, i) => ico.readUInt8(6 + 16 * i)), ICO_SIZES);
  const meta = await sharp(apple).metadata();
  assert.deepEqual([meta.width, meta.height], [APPLE_SIZE, APPLE_SIZE]);
});
