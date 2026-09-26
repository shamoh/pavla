// Other photos of the site (portrait, studio, …) from <contentDir>/fotky/.
// Each photo: <name>.jpg plus <name>.yaml with alt text and an optional caption.
// Pages refer to a photo by its name, e.g. <Photo name="portret" />.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { IMAGE_EXTENSIONS, isValidSlug, slugify, splitExt, titleFromName } from './works.mjs';

export const PHOTOS_SUBDIR = 'fotky';

const templatePath = new URL('../templates/photo.yaml', import.meta.url);

/** Scans the photos folder, writes skeleton YAML for new photos and returns { photos, created, problems }. */
export async function preparePhotos(contentDir) {
  const root = path.join(contentDir, PHOTOS_SUBDIR);
  const photos = [];
  const created = [];
  const problems = [];
  let files;
  try {
    files = (await fs.readdir(root, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name).sort();
  } catch {
    return { photos, created, problems }; // the folder is optional
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
      text = await fs.readFile(path.join(root, yamls.get(name)), 'utf8');
    } else {
      const template = await fs.readFile(templatePath, 'utf8');
      text = template.replace('{{alt}}', JSON.stringify(titleFromName(image.base)));
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
    photos.push({ name, data, masterPath: path.join(root, image.file) });
  }
  return { photos, created, problems };
}
