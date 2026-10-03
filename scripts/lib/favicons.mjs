// Icons for browsers and devices that do not use public/favicon.svg, all made from it (npm run favicons):
// favicon.ico (old browsers, feed readers and link previews ask for /favicon.ico) and apple-touch-icon.png
// (iPhone and iPad home screen; iOS ignores SVG icons and fills transparency with black, hence the paper background).
import sharp from 'sharp';

/** Sizes inside favicon.ico. */
export const ICO_SIZES = [16, 32, 48];
/** Apple touch icon: one size, iOS scales it down itself. */
export const APPLE_SIZE = 180;
/** Paper tone of the site (--paper in Base.astro) behind the apple touch icon. */
export const APPLE_BACKGROUND = '#f7f4ee';

/**
 * favicon.ico from PNG images: the ICO header and directory followed by the PNGs as they are (allowed since Windows
 * Vista, read by every current browser). `images`: [{ size, png }], size in pixels (square), at most 256.
 */
export function packIco(images) {
  if (images.length === 0) throw new Error('favicon.ico needs at least one image');
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    if (!Number.isInteger(size) || size < 1 || size > 256) throw new Error(`favicon.ico: size ${size} is out of 1–256`);
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0); // width, 0 = 256
    e.writeUInt8(size === 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // no palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/** PNG of the SVG icon, `size` × `size`, transparent or on `background`, with `padding` (share of the side) around it. */
export async function renderIcon(svg, size, { background, padding = 0 } = {}) {
  const inner = Math.round(size * (1 - 2 * padding));
  const icon = await sharp(svg, { density: Math.ceil((72 * inner) / 64) * 2 }).resize(inner, inner).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** Both icons from the SVG: { ico, apple } as buffers. */
export async function makeFavicons(svg) {
  const ico = packIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await renderIcon(svg, size) }))));
  const apple = await renderIcon(svg, APPLE_SIZE, { background: APPLE_BACKGROUND, padding: 0.1 });
  return { ico, apple };
}
