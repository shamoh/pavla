// Images of the test data (pavla/demo-content/images.yaml): abstract "watercolour" blobs on paper, rendered from
// a fixed seed, so every `npm run demo` produces the same pictures and no binary files live in git.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Deterministic pseudo-random numbers in [0, 1) (Park–Miller). */
export function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** SVG of `count` soft blobs from `palette` on paper, fully determined by the seed. */
export function blobSvg([w, h], palette, seed, count = 14) {
  const rnd = seeded(seed);
  const blobs = [];
  for (let i = 0; i < count; i++) {
    const c = palette[Math.floor(rnd() * palette.length)];
    const cx = rnd() * w, cy = rnd() * h, rx = w * (0.08 + rnd() * 0.25), ry = h * (0.06 + rnd() * 0.2);
    const rot = rnd() * 60 - 30, op = 0.25 + rnd() * 0.35;
    blobs.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${rot.toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${c}" fill-opacity="${op.toFixed(3)}" filter="url(#b)"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><filter id="b"><feGaussianBlur stdDeviation="${(w / 250).toFixed(2)}"/></filter></defs><rect width="100%" height="100%" fill="#f6f2ea"/>${blobs.join('')}</svg>`;
}

/** Colour of the wooden floor the test photos of works "lie" on (r.floor in the recipe). */
export const FLOOR_COLOR = '#8a6446';

/**
 * The painted sheet photographed on a floor, a little askew: rotated by `angle` degrees with `margin` (share of the
 * longer side) of floor around it, like a phone photo before its floor is cut away (meta_corners). Returns PNG.
 */
export async function onFloor(sheet, [w, h], { angle, margin }) {
  const m = Math.round(Math.max(w, h) * margin);
  const rotated = await sharp(sheet).rotate(angle, { background: FLOOR_COLOR }).png().toBuffer();
  // a few darker boards, so the floor is not one flat colour
  const { width, height } = await sharp(rotated).metadata();
  const W = width + 2 * m, H = height + 2 * m;
  const boards = Array.from({ length: Math.ceil(H / 90) }, (_, i) => `<rect y="${i * 90}" width="${W}" height="3" fill="#6e4f37"/>`).join('');
  const floor = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${FLOOR_COLOR}"/>${boards}</svg>`);
  return sharp(floor).composite([{ input: rotated, left: m, top: m }]).png().toBuffer();
}

/**
 * Checks the recipe and returns problems: unknown palettes, crops of images that are not in the recipe
 * (or are crops themselves) and crops outside their source.
 */
export function recipeProblems(recipe) {
  const problems = [];
  const images = recipe.images ?? {};
  for (const [file, r] of Object.entries(images)) {
    if (r.from) {
      const src = images[r.from];
      if (!src || src.from) problems.push(`images.yaml: ${file}: "from" must be a painted image of the recipe`);
      else if (!Array.isArray(r.crop) || r.crop.length !== 4) problems.push(`images.yaml: ${file}: crop must be [left, top, width, height]`);
      else if (r.crop[0] + r.crop[2] > src.size[0] || r.crop[1] + r.crop[3] > src.size[1]) problems.push(`images.yaml: ${file}: crop is outside ${r.from}`);
    } else {
      if (!recipe.palettes?.[r.palette]) problems.push(`images.yaml: ${file}: unknown palette "${r.palette}"`);
      if (!Array.isArray(r.size) || r.size.length !== 2) problems.push(`images.yaml: ${file}: size must be [width, height]`);
      if (!Number.isInteger(r.seed)) problems.push(`images.yaml: ${file}: seed must be a whole number`);
      if (r.floor !== undefined && !(Number.isFinite(r.floor?.angle) && Math.abs(r.floor.angle) <= 10 && r.floor?.margin > 0 && r.floor.margin < 0.2)) {
        problems.push(`images.yaml: ${file}: floor must be { angle: <-10…10 degrees>, margin: <0…0.2> }`);
      }
    }
  }
  return problems;
}

/** Renders every image of the recipe into `outDir` (paths as in the recipe). Returns the written paths. */
export async function renderDemoImages(recipe, outDir) {
  const written = [];
  const images = Object.entries(recipe.images ?? {});
  // painted images first, crops need their source
  for (const [file, r] of [...images.filter(([, r]) => !r.from), ...images.filter(([, r]) => r.from)]) {
    const target = path.join(outDir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    let img;
    if (r.from) {
      const [left, top, width, height] = r.crop;
      img = sharp(await fs.readFile(path.join(outDir, r.from))).extract({ left, top, width, height });
      if (r.width) img = img.resize({ width: r.width });
    } else {
      img = sharp(Buffer.from(blobSvg(r.size, recipe.palettes[r.palette], r.seed)));
      if (r.floor) img = sharp(await onFloor(await img.png().toBuffer(), r.size, r.floor));
    }
    await fs.writeFile(target, await img.jpeg({ quality: 88 }).toBuffer());
    written.push(file);
  }
  return written;
}
