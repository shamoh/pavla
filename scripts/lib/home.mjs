// The home page: _index.yaml in the root of the content repository (HOME_SCHEMA in scripts/lib/schema.mjs): the text
// next to the big picture and its cover (scripts/lib/covers.mjs); its own cover photo is _cover.jpg next to it. A skeleton is written
// when the file is missing (with the text the home page had before), and it is kept in line like every description.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { COVER_NAME, INDEX_FILE, RETIRED_NAMES, keepInLine, retiredNameProblem } from './content.mjs';
import { skeleton } from './metadata-yaml.mjs';
import { HOME_SCHEMA, fieldKeys, publicKeys } from './schema.mjs';
import { IMAGE_EXTENSIONS, splitExt } from './works.mjs';

export const HOME_FILE = INDEX_FILE;
export const HOME_PHOTO = COVER_NAME;
/** Fields copied to the public site repository; the private note never is. */
export const PUBLIC_HOME_FIELDS = publicKeys(HOME_SCHEMA);
/** Every attribute of the home page's _index.yaml (HOME_SCHEMA). */
export const HOME_FIELDS = fieldKeys(HOME_SCHEMA);

/**
 * Reads (or creates) _index.yaml, brings it in line with HOME_SCHEMA and finds _cover.jpg.
 * Returns { home: { data, yamlPath, coverPath } | null, created, updated, problems }.
 * A file under its former name (uvod.yaml, uvod.jpg) is a problem; then no skeleton is written, so nothing is lost.
 */
export async function prepareHome(contentDir) {
  const created = [];
  const updated = [];
  const problems = [];
  const file = path.join(contentDir, HOME_FILE);
  const retired = (await fs.readdir(contentDir)).sort().map((f) => retiredNameProblem('', f, RETIRED_NAMES)).filter(Boolean);
  problems.push(...retired);
  let text = await fs.readFile(file, 'utf8').catch(() => null);
  if (text === null && retired.length) return { home: null, created, updated, problems };
  if (text === null) {
    text = skeleton(HOME_SCHEMA);
    await fs.writeFile(file, text);
    created.push(HOME_FILE);
  } else {
    text = await keepInLine(text, HOME_SCHEMA, HOME_FILE, file, updated, problems);
  }
  let data;
  try {
    data = YAML.parse(text) ?? {};
  } catch {
    return { home: null, created, updated, problems }; // reported by keepInLine
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    problems.push(`${HOME_FILE}: description must be text`);
  }
  const photos = (await fs.readdir(contentDir)).filter((f) => {
    const { base, ext } = splitExt(f);
    return base === HOME_PHOTO && IMAGE_EXTENSIONS.includes(ext);
  });
  if (photos.length > 1) problems.push(`${photos.join(', ')}: more than one home cover photo, keep one`);
  const coverPath = photos.length ? path.join(contentDir, photos[0]) : null;
  return { home: { data, yamlPath: HOME_FILE, coverPath }, created, updated, problems };
}
