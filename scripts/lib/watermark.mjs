// The signature on the Fler exports: the author's name bottom right, in the italic of the site (fonts/, drawn as
// paths), light letters with a soft dark shadow, so it reads on light paper and on dark or busy backgrounds alike
// (no colour chosen by the corner). Only the name, never an address or handle (rules of Fler).

import { textPath } from './instagram.mjs';

/** Look of the signature; part of the fingerprint of works on sale (change = their Fler exports are made again). */
export const WATERMARK_LOOK = {
  size: 0.035,       // height of the letters as a share of the shorter side of the image
  scale: 1.15,       // the italic of the site is small for its size: letters drawn this much bigger
  margin: 1.2,       // gap from the right and bottom edge, in letter sizes
  bold: 0.035,       // stroke of the letters' own colour (heavier letters), in letter sizes
  shadowWidth: 0.16, // the shadow: stroke under the letters, in letter sizes
  shadowBlur: 0.22,  // and its blur, in letter sizes
};

/**
 * SVG (width × height) with the signature `text` in `font` (opentype.js); `opacity` of the light letters and of
 * their shadow (watermarkOpacity, watermarkShadow of images.fler).
 */
export function watermarkSvg({ width, height, text, font, opacity = 0.9, shadow = 0.6, look = WATERMARK_LOOK }) {
  const size = Math.round(Math.min(width, height) * look.size);
  const margin = Math.round(size * look.margin);
  const fontSize = size * look.scale;
  const w = textPath(font, text, 0, 0, fontSize).width;
  const d = textPath(font, text, width - margin - w, height - margin, fontSize).d;
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<defs><filter id="shadow" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="${+(size * look.shadowBlur).toFixed(2)}"/></filter></defs>
<path d="${d}" fill="#000000" fill-opacity="${shadow}" stroke="#000000" stroke-opacity="${shadow}" stroke-width="${+(size * look.shadowWidth).toFixed(2)}" stroke-linejoin="round" filter="url(#shadow)"/>
<path d="${d}" fill="#ffffff" fill-opacity="${opacity}" stroke="#ffffff" stroke-opacity="${opacity}" stroke-width="${+(size * look.bold).toFixed(2)}" stroke-linejoin="round" paint-order="stroke"/>
</svg>`;
}
