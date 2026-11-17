// The share image (og:image) of the page of the game Detail dne: three close-ups of works of the site side by side on paper, one
// clear, one in mist, one in a mosaic, as the three levels of the game cover them. Made while the site is built
// (src/pages/detail-dne/[file].ts) from the pictures of the works; the name carries a fingerprint of what it is made of, so a
// link preview takes a new one after a change (as the share images of the pipeline, fingerprintedName).
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

/** Change = every share image of the game drawn anew (a new name). */
export const GAME_SHARE_VERSION = 1;
/** What covers each close-up, from the easiest; the close-up as a share of the shorter side, its centre (shares). */
export const GAME_SHARE_LOOK = { effects: ['clear', 'mist', 'mosaic'], size: 0.32, centre: [0.5, 0.45], blur: 7, blocks: 14 };

/**
 * The works of the image: the three newest of the author's selection (`featured`), the newest others after them when there are not
 * three; `works` newest first, each `{ id, featured, folder, widths, modified }`. Each with the width of its picture to cut from
 * (the one nearest 1600 px) and the effect of its place.
 */
export function gameShareParts(works) {
  const chosen = [...works.filter((w) => w.featured === true), ...works.filter((w) => w.featured !== true)].slice(0, 3);
  return chosen.map((w, i) => ({
    id: w.id,
    folder: w.folder,
    width: [...w.widths].sort((a, b) => Math.abs(a - 1600) - Math.abs(b - 1600))[0],
    modified: w.modified ?? '',
    effect: GAME_SHARE_LOOK.effects[i],
  }));
}

/** The file name of the image of `parts` at `size` ({ width, height, background }): og-<fingerprint>.jpg. */
export function gameShareName(parts, size) {
  const hash = crypto.createHash('sha1').update(JSON.stringify({ version: GAME_SHARE_VERSION, look: GAME_SHARE_LOOK, parts, size })).digest('hex').slice(0, 8);
  return `og-${hash}.jpg`;
}

/** Where the tiles go on the image: squares of the same size in a row, centred. */
export function gameShareLayout(count, { width, height }) {
  const gap = Math.round(width * 0.025);
  const side = Math.min(Math.round(height * 0.5), Math.floor((width - gap * (count + 1)) / count));
  const left = Math.round((width - count * side - (count - 1) * gap) / 2);
  const top = Math.round((height - side) / 2);
  return Array.from({ length: count }, (_, i) => ({ left: left + i * (side + gap), top, side }));
}

/** The JPEG of the image: `publicDir` = the folder of the pictures of the site, `size` = { width, height, background, quality }. */
export async function renderGameShare(parts, publicDir, size) {
  const places = gameShareLayout(parts.length, size);
  const tiles = await Promise.all(parts.map(async (part, i) => {
    const { side } = places[i];
    const source = sharp(path.join(publicDir, part.folder, `${part.width}.jpg`));
    const { width, height } = await source.metadata();
    const cut = Math.round(Math.min(width, height) * GAME_SHARE_LOOK.size);
    const x = Math.max(0, Math.min(width - cut, Math.round(width * GAME_SHARE_LOOK.centre[0] - cut / 2)));
    const y = Math.max(0, Math.min(height - cut, Math.round(height * GAME_SHARE_LOOK.centre[1] - cut / 2)));
    let tile = source.extract({ left: x, top: y, width: cut, height: cut }).resize(side, side);
    if (part.effect === 'mist') tile = sharp(await tile.toBuffer()).blur(GAME_SHARE_LOOK.blur);
    if (part.effect === 'mosaic') {
      const small = await tile.resize(GAME_SHARE_LOOK.blocks, GAME_SHARE_LOOK.blocks).toBuffer();
      tile = sharp(small).resize(side, side, { kernel: 'nearest' });
    }
    return { input: await tile.jpeg().toBuffer(), left: places[i].left, top: places[i].top };
  }));
  return sharp({ create: { width: size.width, height: size.height, channels: 3, background: size.background } })
    .composite(tiles)
    .jpeg({ quality: size.quality ?? 85 })
    .toBuffer();
}
