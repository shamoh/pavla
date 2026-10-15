// Names of the files and folders of the content: every name must already be what the site makes of it, so that the
// photo, its description and its web address all share one name (e.g. "Instagram_surf.jpg" would get the description
// "instagram-surf.yaml"). Allowed: lowercase letters without diacritics, digits and single hyphens inside
// (slugify(name) === name). The extension too: lowercase letters and digits only, and one spelling per type
// (EXTENSION_SPELLING: ".jpg", never ".jpeg"). Only the system files (_index.yaml, _cover.<ext>) start with "_";
// hidden files (".DS_Store", ".gitkeep") are not content and stay unchecked, former names of the system files are
// reported by their own check (RETIRED_NAMES). The pipeline checks the names before anything else and stops on a bad
// one: nothing is written until it is renamed.

import fs from 'node:fs/promises';
import path from 'node:path';
import { COVER_NAME, INDEX_FILE, RETIRED_NAMES, WORKS_SUBDIR } from './content.mjs';
import { PHOTOS_SUBDIR } from './photos.mjs';
import { YEARS_SUBDIR } from './years.mjs';
import { IMAGE_EXTENSIONS, slugify, splitExt } from './works.mjs';

/** Folders of the content whose names are checked, recursively (and the system files of the content root). */
export const NAMED_FOLDERS = [WORKS_SUBDIR, PHOTOS_SUBDIR, YEARS_SUBDIR];

/** The one spelling of an extension that has two: the other one is refused, with the proposal to rename. */
export const EXTENSION_SPELLING = { jpeg: 'jpg' };

const RULE = 'jméno smí mít jen malá písmena bez diakritiky, číslice a pomlčky (žádné mezery, podtržítka, čárky ani jiné znaky), přípona jen malými písmeny a fotka .jpg (ne .jpeg)';

/** The extension of a file name as written ('' without one; splitExt lowercases it). */
const rawExtension = (name) => {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1);
};

/** The extension a file should have: lowercase, in its one spelling. */
const goodExtension = (ext) => {
  const lower = ext.toLowerCase();
  return EXTENSION_SPELLING[lower] ?? lower;
};

const isSystemBase = (name) => {
  const { base, ext } = splitExt(name);
  return name === INDEX_FILE || (base === COVER_NAME && IMAGE_EXTENSIONS.includes(ext));
};

const isRetiredName = (name) => {
  const { base } = splitExt(name);
  return RETIRED_NAMES.index.includes(name) || RETIRED_NAMES.cover.includes(base);
};

/**
 * Problem of one name in the content (Czech, for the run summary), or null when the name is fine.
 * `where`: the path shown in the message (folders end with "/"), `isFile`: a file (its extension is kept apart).
 */
export function nameProblem(where, name, isFile) {
  if (name.startsWith('.') || isRetiredName(name)) return null;
  const system = isFile && isSystemBase(name);
  const base = isFile ? splitExt(name).base : name;
  const ext = isFile ? rawExtension(name) : '';
  const fixedBase = system ? base : slugify(base);
  const fixedExt = goodExtension(ext);
  if (fixedBase && fixedBase === base && fixedExt === ext) return null;
  const what = isFile ? 'soubor' : 'složku';
  const proposal = fixedBase ? ` na „${fixedExt ? `${fixedBase}.${fixedExt}` : fixedBase}“` : '';
  return `${where}: přejmenuj ${what}${proposal}, ${RULE} [neplatne-jmeno]`;
}

/**
 * Checks the names of every file and folder in NAMED_FOLDERS of the content repository (missing folders are fine).
 * Returns the problems, sorted by path.
 */
export async function fileNameProblems(contentDir) {
  const problems = [];
  const visit = async (rel) => {
    const entries = await fs.readdir(path.join(contentDir, rel), { withFileTypes: true }).catch(() => []);
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.')) continue;
      const where = `${rel}/${e.name}${e.isDirectory() ? '/' : ''}`;
      const problem = nameProblem(where, e.name, !e.isDirectory());
      if (problem) problems.push(problem);
      if (e.isDirectory()) await visit(`${rel}/${e.name}`);
    }
  };
  // the content root: only its system files are content (README.md, docs/ and export/ are not)
  for (const name of (await fs.readdir(contentDir).catch(() => [])).sort()) {
    if (name.toLowerCase().startsWith(`${COVER_NAME}.`)) {
      const problem = nameProblem(name, name, true);
      if (problem) problems.push(problem);
    }
  }
  for (const folder of NAMED_FOLDERS) await visit(folder);
  return problems;
}
