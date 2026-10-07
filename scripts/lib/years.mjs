// Descriptions of years: roky/<year>.yaml in the content repository (YEAR_SCHEMA in scripts/lib/schema.mjs), an optional
// text of the author about the year, shown on top of the year page /tvorba/<year>/. Every year with works gets a
// skeleton; every file is brought in line with the schema like the other descriptions.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { keepInLine } from './content.mjs';
import { skeleton } from './metadata-yaml.mjs';
import { YEAR_SCHEMA, fieldKeys, publicKeys } from './schema.mjs';
import { IMAGE_EXTENSIONS, splitExt } from './works.mjs';

export const YEARS_SUBDIR = 'roky';
/** Fields copied to the public site repository; the private note never is. */
export const PUBLIC_YEAR_FIELDS = publicKeys(YEAR_SCHEMA);
/** Every attribute of a year's YAML (YEAR_SCHEMA). */
export const YEAR_FIELDS = fieldKeys(YEAR_SCHEMA);

/**
 * Reads roky/*.yaml, writes skeletons for the given years (those with works) that have none, brings every file in
 * line with YEAR_SCHEMA and returns { years: [{ year, data, yamlPath, coverPath }], created, updated, problems }.
 * `coverPath`: the year's own cover photo roky/<year>.jpg (or .jpeg, .png…), null without one.
 */
export async function prepareYears(contentDir, withWorks = []) {
  const root = path.join(contentDir, YEARS_SUBDIR);
  const years = [];
  const created = [];
  const updated = [];
  const problems = [];
  const files = (await fs.readdir(root, { withFileTypes: true }).catch(() => [])).filter((e) => !e.name.startsWith('.'));
  const byYear = new Map();
  const photos = new Map();
  for (const e of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const { base, ext } = splitExt(e.name);
    if (e.isFile() && /^\d{4}$/.test(base) && IMAGE_EXTENSIONS.includes(ext)) {
      if (photos.has(base)) problems.push(`${YEARS_SUBDIR}/${e.name}: druhá úvodní fotka roku ${base}, nech jen jednu`);
      else photos.set(base, path.join(root, e.name));
      continue;
    }
    const m = e.isFile() && e.name.match(/^(\d{4})\.ya?ml$/);
    if (!m) {
      problems.push(`${YEARS_SUBDIR}/${e.name}: sem patří jen popisy roků (2026.yaml) a jejich úvodní fotky (2026.jpg)`);
      continue;
    }
    if (byYear.has(m[1])) problems.push(`${YEARS_SUBDIR}/${e.name}: druhý popis roku ${m[1]}, nech jen jeden`);
    else byYear.set(m[1], e.name);
  }
  for (const year of photos.keys()) {
    if (!byYear.has(year) && !withWorks.map(String).includes(year)) problems.push(`${YEARS_SUBDIR}/${year}: úvodní fotka roku, ve kterém není žádný obraz`);
  }
  for (const year of [...new Set(withWorks.map(String))].sort()) {
    if (byYear.has(year)) continue;
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, `${year}.yaml`), skeleton(YEAR_SCHEMA));
    created.push(`${YEARS_SUBDIR}/${year}.yaml`);
    byYear.set(year, `${year}.yaml`);
  }
  for (const [year, name] of [...byYear].sort()) {
    const file = path.join(root, name);
    const yamlPath = `${YEARS_SUBDIR}/${name}`;
    const text = await keepInLine(await fs.readFile(file, 'utf8'), YEAR_SCHEMA, yamlPath, file, updated, problems);
    let data;
    try {
      data = YAML.parse(text) ?? {};
    } catch (e) {
      continue; // reported by keepInLine
    }
    if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
      problems.push(`${yamlPath}: description musí být text`);
      continue;
    }
    years.push({ year, data, yamlPath, coverPath: photos.get(year) ?? null });
  }
  return { years, created, updated, problems };
}
