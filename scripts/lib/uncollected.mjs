// The works without a collection: they lie right in tvorba/ of the content repository, so tvorba/_index.yaml
// (UNCOLLECTED_SCHEMA in scripts/lib/schema.mjs) describes them as a place, like _index.yaml of a collection folder:
// the cover of the item "Mimo kolekce" closing the collections overview (scripts/lib/covers.mjs); its own cover photo
// is tvorba/_cover.jpg next to it. A skeleton is written once some work lies right in tvorba/, and the file is kept
// in line like every description.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { COVER_NAME, INDEX_FILE, WORKS_SUBDIR, keepInLine } from './content.mjs';
import { skeleton } from './metadata-yaml.mjs';
import { UNCOLLECTED_SCHEMA, fieldKeys, publicKeys } from './schema.mjs';
import { IMAGE_EXTENSIONS, splitExt } from './works.mjs';

/** The description of the works without a collection, relative to the content repository. */
export const UNCOLLECTED_FILE = `${WORKS_SUBDIR}/${INDEX_FILE}`;
/** Fields copied to the public site repository; the private note never is. */
export const PUBLIC_UNCOLLECTED_FIELDS = publicKeys(UNCOLLECTED_SCHEMA);
/** Every attribute of tvorba/_index.yaml (UNCOLLECTED_SCHEMA). */
export const UNCOLLECTED_FIELDS = fieldKeys(UNCOLLECTED_SCHEMA);

/**
 * Reads tvorba/_index.yaml (a skeleton when missing and `hasWorks`: some work lies right in tvorba/), brings it in
 * line with UNCOLLECTED_SCHEMA and finds tvorba/_cover.jpg. Returns
 * { uncollected: { data, yamlPath, coverPath } | null, created, updated, problems }; null without the file.
 */
export async function prepareUncollected(contentDir, hasWorks) {
  const created = [];
  const updated = [];
  const problems = [];
  const root = path.join(contentDir, WORKS_SUBDIR);
  const file = path.join(root, INDEX_FILE);
  let text = await fs.readFile(file, 'utf8').catch(() => null);
  if (text === null && !hasWorks) return { uncollected: null, created, updated, problems };
  if (text === null) {
    text = skeleton(UNCOLLECTED_SCHEMA);
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(file, text);
    created.push(UNCOLLECTED_FILE);
  } else {
    text = await keepInLine(text, UNCOLLECTED_SCHEMA, UNCOLLECTED_FILE, file, updated, problems);
  }
  let data;
  try {
    data = YAML.parse(text) ?? {};
  } catch {
    return { uncollected: null, created, updated, problems }; // reported by keepInLine
  }
  const photos = (await fs.readdir(root)).sort().filter((f) => {
    const { base, ext } = splitExt(f);
    return base === COVER_NAME && IMAGE_EXTENSIONS.includes(ext);
  });
  if (photos.length > 1) problems.push(`${photos.map((f) => `${WORKS_SUBDIR}/${f}`).join(', ')}: víc úvodních fotek obrazů mimo kolekce, nech jen jednu`);
  const coverPath = photos.length ? path.join(root, photos[0]) : null;
  return { uncollected: { data, yamlPath: UNCOLLECTED_FILE, coverPath }, created, updated, problems };
}
