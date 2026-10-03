// Other photos of the site (portrait, studio, …) from <contentDir>/fotky/.
// Each photo: <name>.jpg plus <name>.yaml with alt text, an optional caption and an optional focus point
// (`focus: [x, y]` in % from the left and top edge) that a cropped photo keeps in view.
// Pages refer to a photo by its name, e.g. <Photo name="portret" />.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { keepInLine } from './content.mjs';
import { skeleton } from './metadata-yaml.mjs';
import { PHOTO_SCHEMA, fieldKeys, publicKeys } from './schema.mjs';
import { IMAGE_EXTENSIONS, isValidSlug, slugify, splitExt, titleFromName } from './works.mjs';

export const PHOTOS_SUBDIR = 'fotky';
/** Every attribute of a photo's YAML (PHOTO_SCHEMA in scripts/lib/schema.mjs). */
export const PHOTO_FIELDS = fieldKeys(PHOTO_SCHEMA);
/** Fields of a photo copied to the public site repository (content/fotky/<name>.yaml). */
export const PUBLIC_PHOTO_FIELDS = publicKeys(PHOTO_SCHEMA);


/**
 * Scans the photos folder, writes skeleton YAML for new photos, brings every photo's YAML in line with
 * PHOTO_SCHEMA and returns { photos, created, updated, problems }.
 */
export async function preparePhotos(contentDir) {
  const root = path.join(contentDir, PHOTOS_SUBDIR);
  const photos = [];
  const created = [];
  const updated = [];
  const problems = [];
  let files;
  try {
    files = (await fs.readdir(root, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name).sort();
  } catch {
    return { photos, created, updated, problems }; // the folder is optional
  }

  const yamls = new Map();
  const images = new Map();
  for (const file of files) {
    if (file.startsWith('.')) continue;
    const { base, ext } = splitExt(file);
    if (ext === 'yaml' || ext === 'yml') yamls.set(base, file);
    else if (IMAGE_EXTENSIONS.includes(ext)) {
      const name = slugify(base);
      if (images.has(name)) problems.push(`${PHOTOS_SUBDIR}/${file}: another photo already maps to "${name}"`);
      else images.set(name, { file, base });
    } else problems.push(`${PHOTOS_SUBDIR}/${file}: unknown file type, ignored`);
  }

  for (const [name, file] of yamls) {
    if (!images.has(name)) problems.push(`${PHOTOS_SUBDIR}/${file}: no photo named "${name}"`);
  }
  for (const [name, image] of images) {
    if (!isValidSlug(name)) {
      problems.push(`${PHOTOS_SUBDIR}/${image.file}: rename the photo to letters, digits and dashes`);
      continue;
    }
    const yamlPath = path.join(root, `${name}.yaml`);
    let text;
    if (yamls.has(name)) {
      const file = path.join(root, yamls.get(name));
      text = await fs.readFile(file, 'utf8');
      text = await keepInLine(text, PHOTO_SCHEMA, `${PHOTOS_SUBDIR}/${yamls.get(name)}`, file, updated, problems);
    } else {
      text = skeleton(PHOTO_SCHEMA, { alt: titleFromName(image.base) });
      await fs.writeFile(yamlPath, text);
      created.push(`${PHOTOS_SUBDIR}/${name}.yaml`);
    }
    let data;
    try {
      data = YAML.parse(text) ?? {};
    } catch (e) {
      problems.push(`${PHOTOS_SUBDIR}/${name}.yaml: invalid YAML (${e.message.split('\n')[0]})`);
      continue;
    }
    if (data.focus !== undefined && data.focus !== null && !isValidFocus(data.focus)) {
      problems.push(`${PHOTOS_SUBDIR}/${name}.yaml: focus must be [x, y] in % (0–100), e.g. focus: [70, 60]`);
      continue;
    }
    photos.push({ name, data, masterPath: path.join(root, image.file) });
  }
  return { photos, created, updated, problems };
}

/** Focus point of a photo: [x, y], both numbers between 0 and 100 (percent from the left and top edge). */
export const isValidFocus = (f) => Array.isArray(f) && f.length === 2 && f.every((n) => typeof n === 'number' && n >= 0 && n <= 100);

/** Focus of a photo for the site, [50, 50] (centre) when not set. */
export const photoFocus = (data) => (isValidFocus(data?.focus) ? data.focus : [50, 50]);

/**
 * Crop box of an image (width × height) to `aspect` (width / height), placed like CSS
 * `object-fit: cover; object-position: fx% fy%`, so a generated crop matches what the page shows.
 */
export function focusCrop(width, height, aspect, [fx, fy] = [50, 50]) {
  let w = width;
  let h = Math.round(width / aspect);
  if (h > height) {
    h = height;
    w = Math.round(height * aspect);
  }
  return { left: Math.round(((width - w) * fx) / 100), top: Math.round(((height - h) * fy) / 100), width: w, height: h };
}
