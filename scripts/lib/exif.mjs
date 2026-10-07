// Reads the day a photo was taken from its EXIF data (no dependency: a minimal TIFF reader of the few tags needed).

import sharp from 'sharp';

const IFD0_DATE_TIME = 0x0132;
const EXIF_IFD_POINTER = 0x8769;
const DATE_TIME_ORIGINAL = 0x9003;
const DATE_TIME_DIGITIZED = 0x9004;
const ASCII = 2;
const LONG = 4;

/** The entries of one IFD as Map(tag → { type, count, valueAt }), empty when the offset is outside the data. */
function readIfd(tiff, offset, u16, u32) {
  const tags = new Map();
  if (offset < 8 || offset + 2 > tiff.length) return tags;
  const n = u16(offset);
  for (let i = 0; i < n; i++) {
    const at = offset + 2 + i * 12;
    if (at + 12 > tiff.length) break;
    const type = u16(at + 2);
    const count = u32(at + 4);
    // Values of up to 4 bytes sit in the entry itself, longer ones at the offset it holds.
    const valueAt = type === ASCII && count > 4 ? u32(at + 8) : at + 8;
    tags.set(u16(at), { type, count, valueAt });
  }
  return tags;
}

/** "YYYY-MM-DD" from an EXIF date "YYYY:MM:DD HH:MM:SS", null when it is missing or not a real day. */
function exifDay(tiff, entry) {
  if (!entry || entry.type !== ASCII || entry.valueAt + entry.count > tiff.length) return null;
  const text = tiff.toString('latin1', entry.valueAt, entry.valueAt + entry.count);
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(text);
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day ? null : day;
}

/**
 * The day a photo was taken ("YYYY-MM-DD") from a raw EXIF block (as sharp's metadata().exif, with or without
 * the "Exif\0\0" header): DateTimeOriginal, then DateTimeDigitized, then DateTime. null when there is none.
 */
export function exifDateOf(exif) {
  if (!exif || exif.length < 8) return null;
  const tiff = exif.toString('latin1', 0, 6) === 'Exif\0\0' ? exif.subarray(6) : exif;
  const order = tiff.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const little = order === 'II';
  const u16 = (at) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  const ifd0 = readIfd(tiff, u32(4), u16, u32);
  const pointer = ifd0.get(EXIF_IFD_POINTER);
  const exifIfd = pointer?.type === LONG ? readIfd(tiff, u32(pointer.valueAt), u16, u32) : new Map();
  return (
    exifDay(tiff, exifIfd.get(DATE_TIME_ORIGINAL)) ??
    exifDay(tiff, exifIfd.get(DATE_TIME_DIGITIZED)) ??
    exifDay(tiff, ifd0.get(IFD0_DATE_TIME))
  );
}

/** The day the photo in `file` was taken, from its EXIF; null without EXIF, without a date or when unreadable. */
export async function photoDate(file) {
  try {
    return exifDateOf((await sharp(file).metadata()).exif);
  } catch {
    return null;
  }
}
