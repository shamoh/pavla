// Launch screens of the installed app on iPhone and iPad (apple-touch-startup-image): iOS shows them while the app
// opens and has no other way to (it ignores the colours of the manifest). One picture per screen size, orientation
// and colour scheme, made while the site is built (src/pages/splash/[file].ts) and linked from every page
// (Base.astro), since a visitor may add the site to the home screen from any of them.
// Picture: the paper of the palette, the home screen icon, the name of the site and its tagline in the fonts of the site.
import sharp from 'sharp';
import { PALETTES } from './palettes.mjs';
import { textPath } from './instagram.mjs';

/**
 * Screens of iPhones and iPads in CSS pixels (portrait) and their pixel ratio; `both` = also landscape (iPads; an
 * iPhone opens the site upright). A device missing here only shows a plain screen in the colour of the page.
 */
export const SPLASH_DEVICES = [
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max, 17 Pro Max
  { width: 420, height: 912, ratio: 3 }, // Air
  { width: 402, height: 874, ratio: 3 }, // 16 Pro, 17, 17 Pro
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12 Pro Max, 13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 16e
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12 mini, 13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 414, height: 736, ratio: 3 }, // 6 Plus, 7 Plus, 8 Plus
  { width: 375, height: 667, ratio: 2 }, // 6, 7, 8, SE 2nd and 3rd generation
  { width: 320, height: 568, ratio: 2 }, // SE 1st generation
  { width: 1032, height: 1376, ratio: 2, both: true }, // iPad Pro 13" (M4)
  { width: 1024, height: 1366, ratio: 2, both: true }, // iPad Pro 12.9"
  { width: 834, height: 1210, ratio: 2, both: true }, // iPad Pro 11" (M4)
  { width: 834, height: 1194, ratio: 2, both: true }, // iPad Pro 11"
  { width: 820, height: 1180, ratio: 2, both: true }, // iPad Air 10.9", iPad 10th generation
  { width: 834, height: 1112, ratio: 2, both: true }, // iPad Air 10.5"
  { width: 810, height: 1080, ratio: 2, both: true }, // iPad 10.2"
  { width: 768, height: 1024, ratio: 2, both: true }, // iPad 9.7", iPad mini 5
  { width: 744, height: 1133, ratio: 2, both: true }, // iPad mini 6
];

/** Colour schemes of the launch screens: the first light and the first dark palette (the site's own choice "auto"). */
export const SPLASH_SCHEMES = ['light', 'dark'];

/** The palette of a scheme (its paper, ink and quiet ink). */
export const splashPalette = (scheme) => PALETTES.find((p) => p.scheme === scheme).colors;

/**
 * Every launch screen: file name (`apple-splash-<scheme>-<w>x<h>.png`, pixels), its size and the media query iOS
 * picks it by (device-width and device-height are the portrait ones in either orientation).
 */
export function splashScreens(devices = SPLASH_DEVICES) {
  const screens = [];
  for (const d of devices) {
    for (const orientation of d.both ? ['portrait', 'landscape'] : ['portrait']) {
      const [w, h] = orientation === 'portrait' ? [d.width * d.ratio, d.height * d.ratio] : [d.height * d.ratio, d.width * d.ratio];
      for (const scheme of SPLASH_SCHEMES) {
        screens.push({
          file: `apple-splash-${scheme}-${w}x${h}.png`, width: w, height: h, scheme,
          media: `(device-width: ${d.width}px) and (device-height: ${d.height}px) and (-webkit-device-pixel-ratio: ${d.ratio}) and (orientation: ${orientation}) and (prefers-color-scheme: ${scheme})`,
        });
      }
    }
  }
  const names = screens.map((s) => s.file);
  const twice = names.find((n, i) => names.indexOf(n) !== i);
  if (twice) throw new Error(`two launch screens of one size: ${twice}`);
  return screens;
}

/**
 * Layout of a launch screen `width` × `height`: the icon (a share of the shorter side, rounded like the home screen),
 * under it the name and the tagline, the whole block in the middle. Sizes in pixels.
 */
export function splashLayout(width, height) {
  const m = Math.min(width, height);
  const icon = Math.round(m * 0.26);
  const title = Math.round(m * 0.085);
  const tagline = Math.round(m * 0.03);
  const gap = Math.round(m * 0.07);
  const block = icon + gap + title + Math.round(tagline * 2.2);
  const top = Math.round((height - block) / 2);
  return {
    icon: { size: icon, x: Math.round((width - icon) / 2), y: top, radius: Math.round(icon * 0.225) },
    title: { size: title, baseline: top + icon + gap + Math.round(title * 0.75) },
    tagline: { size: tagline, baseline: top + icon + gap + title + Math.round(tagline * 1.6), tracking: tagline * 0.14 },
  };
}

/** PNG of one launch screen: `homeSvg` = the home screen icon, `fonts` = loadFonts() of instagram.mjs. */
export async function renderSplash({ width, height, scheme }, { homeSvg, fonts, title, tagline }) {
  const c = splashPalette(scheme);
  const l = splashLayout(width, height);
  const icon = await sharp(homeSvg, { density: Math.ceil((72 * l.icon.size) / 64) * 2 }).resize(l.icon.size, l.icon.size).png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${l.icon.size}" height="${l.icon.size}"><rect width="100%" height="100%" rx="${l.icon.radius}" fill="#fff"/></svg>`);
  const rounded = await sharp(icon).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const centred = (font, text, size, baseline, tracking = 0) => {
    const { width: w } = textPath(font, text, 0, 0, size, tracking);
    return textPath(font, text, (width - w) / 2, baseline, size, tracking).d;
  };
  const words = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <path d="${centred(fonts.serif, title, l.title.size, l.title.baseline)}" fill="${c.ink}"/>
    ${tagline ? `<path d="${centred(fonts.sans, tagline.toUpperCase(), l.tagline.size, l.tagline.baseline, l.tagline.tracking)}" fill="${c.inkSoft}"/>` : ''}
  </svg>`;
  return sharp({ create: { width, height, channels: 3, background: c.paper } })
    .composite([{ input: rounded, left: l.icon.x, top: l.icon.y }, { input: Buffer.from(words), left: 0, top: 0 }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}
