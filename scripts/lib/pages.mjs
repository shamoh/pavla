// Texts of the pages of the site: stranky/<page>.yaml in the content repository, the file name is the address of the
// page (o-mne.yaml = /o-mne/, 404.yaml = the page not found). Each page has its schema (PAGE_SCHEMAS in
// scripts/lib/schema.mjs): `description` for search engines and link previews, `text` shown on the page (paragraphs
// split by an empty line, simple formatting of scripts/lib/rich-text.mjs), an optional muted `closing` paragraph and
// what the page needs besides (the title of 404 and of a generic page, the label of the place on Kontakt).
// A fixed page (O mně, Kontakt, 404) gets a skeleton with the texts it had in the code when its file is missing; an
// optional page (a generic text page, `optional`) exists only while its file does. Every file is brought in line with
// its schema like the other descriptions. Photos of the pages stay in fotky/.
// A new page with a text = an entry in PAGES (and PAGE_SCHEMAS); a generic one is built by src/pages/[page].astro.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { keepInLine, textProblems } from './content.mjs';
import { skeleton } from './metadata-yaml.mjs';
import { paragraphs } from './rich-text.mjs';

/** Paragraphs of a text (scripts/lib/rich-text.mjs). */
export { paragraphs };
import {
  ABOUT_CLOSING, ABOUT_DESCRIPTION, ABOUT_TEXT, CONTACT_DESCRIPTION, CONTACT_LOCATION_LABEL, CONTACT_TEXT,
  NOT_FOUND_CLOSING, NOT_FOUND_DESCRIPTION, NOT_FOUND_HEADING, NOT_FOUND_TEXT, NOT_FOUND_TITLE, PAGE_SCHEMAS, fieldKeys,
  publicKeys,
} from './schema.mjs';

export const PAGES_SUBDIR = 'stranky';

/**
 * Every page with a text in stranky/: its schema and either the values of its skeleton (`defaults` = what the site
 * shows without a copy) or `optional` (a generic text page, no skeleton: on the site only with its file).
 */
export const PAGES = {
  'o-mne': { schema: PAGE_SCHEMAS['o-mne'], defaults: { description: ABOUT_DESCRIPTION, text: ABOUT_TEXT, closing: ABOUT_CLOSING } },
  kontakt: { schema: PAGE_SCHEMAS.kontakt, defaults: { description: CONTACT_DESCRIPTION, text: CONTACT_TEXT, location_label: CONTACT_LOCATION_LABEL } },
  404: {
    schema: PAGE_SCHEMAS[404],
    defaults: { description: NOT_FOUND_DESCRIPTION, heading: NOT_FOUND_HEADING, text: NOT_FOUND_TEXT, closing: NOT_FOUND_CLOSING, title: NOT_FOUND_TITLE },
  },
  kurzy: { schema: PAGE_SCHEMAS.kurzy, optional: true },
};

/** Names of the generic text pages (optional ones, each built as /<name>/ by src/pages/[page].astro). */
export const GENERIC_PAGES = Object.keys(PAGES).filter((name) => PAGES[name].optional);

/** Fields of a page copied to the public site repository (the private note never is). */
export const publicPageFields = (name) => publicKeys(PAGES[name].schema);

/** Attributes that must not be empty when the schema of the page has them. */
const REQUIRED_KEYS = ['title', 'heading', 'location_label'];

/**
 * Problems of the values of one page besides its texts (textProblems in scripts/lib/content.mjs): its required
 * one-line texts (Czech, for the run summary); `name` picks the attributes its schema has.
 */
export function pageProblems(yamlPath, data, name = 'o-mne') {
  const keys = new Set(fieldKeys(PAGES[name].schema));
  return REQUIRED_KEYS.filter((key) => keys.has(key) && (typeof data[key] !== 'string' || !data[key].trim()))
    .map((key) => `${yamlPath}: ${key} je prázdný nebo není text, stránka ho potřebuje [prazdny-text-stranky]`);
}

/**
 * Reads stranky/*.yaml, writes skeletons for the fixed pages that have none, brings every file in line with its schema
 * and returns { pages: [{ name, data, yamlPath }], created, updated, problems }. Any other file in stranky/ is a problem.
 */
export async function preparePages(contentDir) {
  const root = path.join(contentDir, PAGES_SUBDIR);
  const pages = [];
  const created = [];
  const updated = [];
  const problems = [];
  const files = (await fs.readdir(root, { withFileTypes: true }).catch(() => [])).filter((e) => !e.name.startsWith('.'));
  const present = new Set();
  for (const e of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const name = e.isFile() && e.name.endsWith('.yaml') ? e.name.slice(0, -5) : null;
    if (name && Object.hasOwn(PAGES, name)) present.add(name);
    else problems.push(`${PAGES_SUBDIR}/${e.name}${e.isDirectory() ? '/' : ''}: sem patří jen texty stránek ${Object.keys(PAGES).map((p) => `${p}.yaml`).join(', ')}; novou stránku musí přidat správce webu [cizi-soubor]`);
  }
  for (const [name, { schema, defaults, optional }] of Object.entries(PAGES)) {
    const file = path.join(root, `${name}.yaml`);
    const yamlPath = `${PAGES_SUBDIR}/${name}.yaml`;
    let text;
    if (!present.has(name)) {
      if (optional) continue;
      text = skeleton(schema, defaults);
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(file, text);
      created.push(yamlPath);
    } else {
      text = await keepInLine(await fs.readFile(file, 'utf8'), schema, yamlPath, file, updated, problems);
    }
    let data;
    try {
      data = YAML.parse(text) ?? {};
    } catch {
      continue; // reported by keepInLine
    }
    const own = [...pageProblems(yamlPath, data, name), ...textProblems(yamlPath, data, schema)];
    problems.push(...own);
    if (!own.length) pages.push({ name, data, yamlPath });
  }
  return { pages, created, updated, problems };
}
