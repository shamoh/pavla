import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { exifDateOf, photoDate } from './exif.mjs';

const jpeg = (exif) => {
  const image = sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).jpeg();
  return (exif ? image.withExif(exif) : image).toBuffer();
};
const exifOf = async (buffer) => (await sharp(buffer).metadata()).exif;

/** A big-endian TIFF block with one ASCII DateTime entry in IFD0 (sharp writes little-endian only). */
function bigEndianDateTime(text) {
  const value = Buffer.from(`${text}\0`, 'latin1');
  const tiff = Buffer.alloc(8 + 2 + 12 + 4 + value.length);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0132, 10);
  tiff.writeUInt16BE(2, 12);
  tiff.writeUInt32BE(value.length, 14);
  tiff.writeUInt32BE(26, 18);
  value.copy(tiff, 26);
  return tiff;
}

test('exifDateOf prefers DateTimeOriginal over DateTime', async () => {
  const exif = await exifOf(await jpeg({ IFD0: { DateTime: '2024:01:02 10:00:00' }, IFD2: { DateTimeOriginal: '2025:10:20 11:23:17' } }));
  assert.equal(exifDateOf(exif), '2025-10-20');
});

test('exifDateOf falls back to DateTimeDigitized, then to DateTime', async () => {
  const digitized = await exifOf(await jpeg({ IFD0: { DateTime: '2024:01:02 10:00:00' }, IFD2: { DateTimeDigitized: '2023:05:06 07:08:09' } }));
  assert.equal(exifDateOf(digitized), '2023-05-06');
  assert.equal(exifDateOf(await exifOf(await jpeg({ IFD0: { DateTime: '2024:01:02 10:00:00' } }))), '2024-01-02');
});

test('exifDateOf reads big-endian data, with or without the Exif header', () => {
  const tiff = bigEndianDateTime('2022:12:31 23:59:59');
  assert.equal(exifDateOf(tiff), '2022-12-31');
  assert.equal(exifDateOf(Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff])), '2022-12-31');
});

test('exifDateOf: null without a usable date', async () => {
  assert.equal(exifDateOf(undefined), null);
  assert.equal(exifDateOf(Buffer.from('nonsense')), null);
  assert.equal(exifDateOf(bigEndianDateTime('0000:00:00 00:00:00')), null, 'cameras write zeros when the clock is unset');
  assert.equal(exifDateOf(bigEndianDateTime('2025:02:30 10:00:00')), null, 'not a real day');
  assert.equal(exifDateOf(await exifOf(await jpeg({ IFD0: { Make: 'Camera' } }))), null);
});

test('photoDate reads the file, null without EXIF or for an unreadable file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'exif-'));
  try {
    await fs.writeFile(path.join(dir, 'a.jpg'), await jpeg({ IFD2: { DateTimeOriginal: '2025:10:18 16:31:02' } }));
    await fs.writeFile(path.join(dir, 'b.jpg'), await jpeg());
    await fs.writeFile(path.join(dir, 'c.jpg'), 'not a photo');
    assert.equal(await photoDate(path.join(dir, 'a.jpg')), '2025-10-18');
    assert.equal(await photoDate(path.join(dir, 'b.jpg')), null);
    assert.equal(await photoDate(path.join(dir, 'c.jpg')), null);
    assert.equal(await photoDate(path.join(dir, 'missing.jpg')), null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
