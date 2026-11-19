// Icons for browsers and devices that do not use public/favicon.svg (npm run favicons): favicon.ico from it (old
// browsers, feed readers and link previews ask for /favicon.ico), and the home screen icons from
// scripts/home-screen-icon.svg (the same little painting over the whole square, without the sheet of paper, so it does
// not shrink inside the rounded square of the phone): apple-touch-icon.png (iPhone and iPad; iOS ignores SVG icons and
// fills transparency with black, hence the paper background under it) and icon-<size>.png of site.webmanifest (Android).
import sharp from 'sharp';
import { favoritesShowPath, featuredShowPath } from './cinema.mjs';

/** Sizes inside favicon.ico. */
export const ICO_SIZES = [16, 32, 48];
/** Apple touch icon: one size, iOS scales it down itself. */
export const APPLE_SIZE = 180;
/** Paper tone of the site (--paper in Base.astro) behind the home screen icons, in case they had a transparent pixel. */
export const APPLE_BACKGROUND = '#f7f4ee';
/** Home screen icons of site.webmanifest (Android): file name by size, in public/. */
export const MANIFEST_SIZES = [192, 512];
export const manifestIconFile = (size) => `icon-${size}.png`;

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

/**
 * All icons: favicon.ico from the favicon `svg`, the home screen icons from `homeSvg` over the whole square, the icons
 * of the shortcuts from `shortcutSvgs` ({ <id>: svg }, every MANIFEST_SHORTCUTS id).
 * { ico, apple, manifest: { <file name>: png } } as buffers; `manifest` holds the shortcut icons too.
 */
export async function makeFavicons(svg, homeSvg, shortcutSvgs = {}) {
  const ico = packIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, png: await renderIcon(svg, size) }))));
  const home = (size) => renderIcon(homeSvg, size, { background: APPLE_BACKGROUND });
  const apple = await home(APPLE_SIZE);
  const manifest = Object.fromEntries(await Promise.all([
    ...MANIFEST_SIZES.map(async (size) => [manifestIconFile(size), await home(size)]),
    ...Object.entries(shortcutSvgs).map(async ([id, s]) => {
      if (!MANIFEST_SHORTCUTS.some((x) => x.id === id)) throw new Error(`icon of an unknown shortcut: ${id}`);
      return [shortcutIconFile(id), await renderIcon(s, SHORTCUT_ICON_SIZE, { background: APPLE_BACKGROUND })];
    }),
  ]));
  return { ico, apple, manifest };
}

/**
 * Shortcuts of the home screen icon (a long press on Android): name, description, address relative to the manifest (so
 * they follow a base path like start_url; with a trailing slash like every link of the site) and an icon of its own,
 * public/shortcut-<id>.png made from scripts/shortcut-icons/<id>.svg. `featured`: offered only while the author has
 * chosen some works (the show of her selection, from=shortcut for cinema_open). "Oblíbené" = the show of the visitor's
 * own favourites (from=shortcut_favorites), always offered: the manifest cannot know them; without any the gallery says
 * how to add some (NO_FAVORITES_TEXT).
 */
export const SHORTCUT_ICON_SIZE = 96;
export const shortcutIconFile = (id) => `shortcut-${id}.png`;
export const MANIFEST_SHORTCUTS = [
  { id: 'detail-dne', name: 'Detail dne', description: 'Dnešní hra: poznej obraz podle výřezu', url: 'detail-dne/' },
  { id: 'tvorba', name: 'Tvorba', description: 'Všechny obrazy', url: 'tvorba/' },
  { id: 'promitat', name: 'Promítat', description: 'Moje nejmilejší obrazy jeden po druhém', url: featuredShowPath('shortcut').slice(1), featured: true },
  { id: 'oblibene', name: 'Oblíbené', description: 'Obrazy, které jste si označili srdcem, jeden po druhém', url: favoritesShowPath('shortcut_favorites').slice(1) },
];

/**
 * Screenshots of the site in the manifest (Android and Chrome show them in a richer install dialog): <file> next to the
 * manifest, not in git: the deploy takes them from the built site once a week (`npm run app-screenshots`,
 * scripts/app-screenshots.mjs, Chrome without a window; kept in the cache of GitHub Actions) and copies them into dist/.
 * `narrow` = a phone (360 × 800 CSS px, ratio 3), `wide` = a computer (1280 × 800, ratio 1.5); `path` = the page shown.
 */
export const SCREENSHOT_FORMS = {
  narrow: { width: 360, height: 800, ratio: 3 },
  wide: { width: 1280, height: 800, ratio: 1.5 },
};
export const APP_SCREENSHOTS = [
  { file: 'app-screenshot-home.webp', path: '/', form: 'narrow', label: 'Úvodní stránka s nejnovějšími obrazy' },
  { file: 'app-screenshot-gallery.webp', path: '/tvorba/', form: 'narrow', label: 'Galerie všech obrazů s filtry' },
  { file: 'app-screenshot-game.webp', path: '/detail-dne/', form: 'narrow', label: 'Detail dne: poznej obraz podle výřezu' },
  { file: 'app-screenshot-wide.webp', path: '/', form: 'wide', label: 'Úvodní stránka na počítači' },
];
/** Pixel size of a screenshot of the `form`, as the manifest gives it ("1080x2400"). */
export function screenshotSize(form) {
  const f = SCREENSHOT_FORMS[form];
  return `${Math.round(f.width * f.ratio)}x${Math.round(f.height * f.ratio)}`;
}

/**
 * site.webmanifest (installing the site as an app: Android, Chrome, Edge; iOS reads it too): the name of the site, the
 * first word of it under the icon, the paper of the first palette while the app opens, `standalone` (an app window
 * without the bar of the browser; the header then has its own "←", scripts/lib/app-install.mjs), `id` = the start page.
 * Addresses relative to the manifest, so the site may live under a base path. The full-bleed icons keep the little
 * painting inside the safe circle of a maskable icon, so the largest one is offered as `maskable` too. Shortcuts:
 * MANIFEST_SHORTCUTS (`hasFeatured` = the site has works of the author's selection), screenshots APP_SCREENSHOTS.
 */
export function webManifest({ title, tagline }, paper, { hasFeatured = false } = {}) {
  const icons = MANIFEST_SIZES.map((size) => ({ src: manifestIconFile(size), sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' }));
  const largest = MANIFEST_SIZES.at(-1);
  icons.push({ src: manifestIconFile(largest), sizes: `${largest}x${largest}`, type: 'image/png', purpose: 'maskable' });
  return {
    name: title,
    short_name: title.split(/\s+/)[0],
    ...(tagline ? { description: tagline } : {}),
    lang: 'cs',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    prefer_related_applications: false,
    background_color: paper,
    theme_color: paper,
    icons,
    screenshots: APP_SCREENSHOTS.map((s) => ({ src: s.file, sizes: screenshotSize(s.form), type: 'image/webp', form_factor: s.form, label: s.label })),
    shortcuts: MANIFEST_SHORTCUTS.filter((s) => !s.featured || hasFeatured).map(({ id, name, description, url }) => ({
      name, short_name: name, description, url,
      icons: [{ src: shortcutIconFile(id), sizes: `${SHORTCUT_ICON_SIZE}x${SHORTCUT_ICON_SIZE}`, type: 'image/png' }],
    })),
  };
}
