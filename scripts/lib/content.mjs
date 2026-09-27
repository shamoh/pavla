// Reads the content repository (pavla-content) and prepares it for the pipeline:
// creates skeleton YAML files for new images and assigns missing work IDs.
//
// Layout:  <contentDir>/tvorba/<year>/<slug>.yaml   metadata
//          <contentDir>/tvorba/<year>/<name>.jpg    master photo; paired with the YAML by slugify(name)
//          <contentDir>/tvorba/<year>/<slug>/*.jpg  optional detail photos of the work (close-ups)

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { IMAGE_EXTENSIONS, generateId, isValidId, slugify, splitExt, titleFromName } from './works.mjs';

export const WORKS_SUBDIR = 'tvorba';

const templatePath = new URL('../templates/work.yaml', import.meta.url);

const isIgnored = (name) => name.startsWith('.') || name.startsWith('_');

/** Lists year folders with their YAML and image files. Does not modify anything. */
export async function readTree(worksRoot) {
  const years = [];
  const problems = [];
  for (const entry of await fs.readdir(worksRoot, { withFileTypes: true })) {
    if (isIgnored(entry.name)) continue;
    if (!entry.isDirectory()) {
      problems.push(`${entry.name}: files belong into a year folder, e.g. ${WORKS_SUBDIR}/2026/`);
      continue;
    }
    const yamls = new Map();
    const images = new Map();
    const details = new Map();
    const yearDir = path.join(worksRoot, entry.name);
    const files = (await fs.readdir(yearDir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of files) {
      const file = item.name;
      if (isIgnored(file)) continue;
      const { base, ext } = splitExt(file);
      const where = `${entry.name}/${file}`;
      if (item.isDirectory()) {
        const found = await readDetails(path.join(yearDir, file), where);
        problems.push(...found.problems);
        details.set(slugify(file), { dir: file, files: found.files });
      } else if (ext === 'yaml' || ext === 'yml') {
        if (yamls.has(base)) problems.push(`${where}: duplicate metadata for "${base}"`);
        else yamls.set(base, file);
      } else if (IMAGE_EXTENSIONS.includes(ext)) {
        const slug = slugify(base);
        if (images.has(slug)) problems.push(`${where}: another image already maps to "${slug}" (${images.get(slug).file})`);
        else images.set(slug, { file, name: base });
      } else {
        problems.push(`${where}: unknown file type, ignored`);
      }
    }
    for (const [slug, d] of details) {
      if (!yamls.has(slug) && !images.has(slug)) {
        problems.push(`${entry.name}/${d.dir}/: detail photos belong to a work, but there is no ${entry.name}/${slug}.yaml`);
      }
    }
    years.push({ year: entry.name, yamls, images, details });
  }
  return { years: years.sort((a, b) => b.year.localeCompare(a.year)), problems };
}

/** Lists the detail photos in a work's folder: [{ name, file }] sorted by file name. */
async function readDetails(dir, where) {
  const files = [];
  const problems = [];
  const names = new Set();
  for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (isIgnored(item.name)) continue;
    const { base, ext } = splitExt(item.name);
    if (!item.isFile() || !IMAGE_EXTENSIONS.includes(ext)) {
      problems.push(`${where}/${item.name}: only photos belong into a detail folder, ignored`);
      continue;
    }
    const name = slugify(base);
    if (!name || names.has(name)) {
      problems.push(`${where}/${item.name}: rename the photo, another detail photo already maps to "${name}"`);
      continue;
    }
    names.add(name);
    files.push({ name, file: item.name });
  }
  return { files, problems };
}

/** Creates the YAML text for a new work from the template. */
export async function skeletonYaml({ id, title, date }) {
  const template = await fs.readFile(templatePath, 'utf8');
  return template
    .replace('{{id}}', id)
    .replace('{{title}}', JSON.stringify(title))
    .replace('{{date}}', date);
}

/**
 * Inserts `id: <id>` above the first key. Plain text insertion, so the rest of the file
 * (comments, alignment, quoting) stays exactly as the author wrote it.
 */
export function withId(yamlText, id) {
  if (!YAML.isMap(YAML.parseDocument(yamlText).contents)) throw new Error('work metadata must be a YAML mapping');
  const lines = yamlText.split('\n');
  // First line that starts a top-level key; comments and blank lines above it stay on top.
  const at = lines.findIndex((l) => /^[^\s#-]/.test(l));
  lines.splice(at, 0, `id: ${id}`);
  return lines.join('\n');
}

const isoDay = (d) => d.toISOString().slice(0, 10);

/**
 * Scans the content repository, writes skeletons and IDs where needed and returns all works.
 * Options: today (Date), random (for deterministic IDs in tests).
 */
export async function prepareContent(contentDir, { today = new Date(), random } = {}) {
  const worksRoot = path.join(contentDir, WORKS_SUBDIR);
  const { years, problems } = await readTree(worksRoot);
  const created = [];
  const assigned = [];

  // Pass 1: parse every YAML and collect IDs that already exist.
  const entries = [];
  const taken = new Set();
  for (const { year, yamls, images, details } of years) {
    for (const [slug, file] of yamls) {
      const yamlPath = path.join(worksRoot, year, file);
      const text = await fs.readFile(yamlPath, 'utf8');
      let data;
      try {
        data = YAML.parse(text) ?? {};
      } catch (e) {
        problems.push(`${year}/${file}: invalid YAML (${e.message.split('\n')[0]})`);
        continue;
      }
      if (isValidId(data.id)) taken.add(data.id);
      entries.push({ year, slug, yamlPath, text, data, image: images.get(slug), details: details.get(slug) });
    }
    // Pass 1b: images without metadata get a skeleton.
    for (const [slug, image] of images) {
      if (yamls.has(slug)) continue;
      const id = generateId(taken, random);
      taken.add(id);
      const date = String(today.getFullYear()) === year ? isoDay(today) : `${year}-01-01`;
      const text = await skeletonYaml({ id, title: titleFromName(image.name), date });
      const yamlPath = path.join(worksRoot, year, `${slug}.yaml`);
      await fs.writeFile(yamlPath, text);
      created.push(`${year}/${slug}.yaml`);
      entries.push({ year, slug, yamlPath, text, data: YAML.parse(text), image, details: details.get(slug) });
    }
  }

  // Pass 2: YAML files written by hand get an ID on first run.
  for (const e of entries) {
    if (e.data.id !== undefined && e.data.id !== null && e.data.id !== '') continue;
    const id = generateId(taken, random);
    taken.add(id);
    e.text = withId(e.text, id);
    e.data = YAML.parse(e.text);
    await fs.writeFile(e.yamlPath, e.text);
    assigned.push(`${e.year}/${e.slug}: ${id}`);
  }

  const works = entries.map((e) => ({
    year: e.year,
    slug: e.slug,
    id: e.data.id,
    data: e.data,
    text: e.text,
    yamlPath: path.relative(contentDir, e.yamlPath),
    masterPath: e.image ? path.join(worksRoot, e.year, e.image.file) : null,
    details: (e.details?.files ?? []).map((d) => ({ name: d.name, path: path.join(worksRoot, e.year, e.details.dir, d.file) })),
  }));
  return { works, created, assigned, problems };
}
