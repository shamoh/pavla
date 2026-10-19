import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GENERIC_PAGES, PAGES, PAGES_SUBDIR, pageProblems, paragraphs, preparePages, publicPageFields } from './pages.mjs';
import {
  ABOUT_CLOSING, ABOUT_DESCRIPTION, ABOUT_TEXT, CONTACT_DESCRIPTION, CONTACT_TEXT, NOT_FOUND_CLOSING, NOT_FOUND_TITLE, PAGE_DESCRIPTION_CHARS, TODO, fieldKeys,
} from './schema.mjs';
import { schemaKeysIn } from './metadata-yaml.mjs';
import { placeholderProblems, textProblems } from './content.mjs';
import { normalizeText } from './rich-text.mjs';

/** The meaning of a text (its line breaks may change when the pipeline writes it as a block). */
const t = normalizeText;

let dir;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-')); });
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

const file = (name) => path.join(dir, PAGES_SUBDIR, `${name}.yaml`);

test('preparePages writes skeletons with the texts the pages had, without DOPLNIT, and keeps them on the next run', async () => {
  const r = await preparePages(dir);
  assert.deepEqual(r.created, ['stranky/404.yaml', 'stranky/o-mne.yaml', 'stranky/kontakt.yaml'], 'no skeleton of an optional page');
  assert.deepEqual(r.problems, []);
  const about = r.pages.find((p) => p.name === 'o-mne');
  assert.equal(t(about.data.description), t(ABOUT_DESCRIPTION));
  assert.equal(about.data.text, ABOUT_TEXT, 'the text as it was, line breaks kept');
  assert.equal(about.data.closing, ABOUT_CLOSING);
  const contact = r.pages.find((p) => p.name === 'kontakt');
  assert.deepEqual([t(contact.data.description), t(contact.data.text), contact.data.location_label], [t(CONTACT_DESCRIPTION), t(CONTACT_TEXT), 'Žiji a maluji']);
  const notFound = r.pages.find((p) => p.name === '404');
  assert.deepEqual([notFound.data.title, notFound.data.closing], [NOT_FOUND_TITLE, NOT_FOUND_CLOSING]);
  const text = await fs.readFile(file('o-mne'), 'utf8');
  assert.deepEqual(schemaKeysIn(text, PAGES['o-mne'].schema), fieldKeys(PAGES['o-mne'].schema));
  assert.doesNotMatch(text, new RegExp(TODO), 'approved texts: nothing to fill in');
  assert.match(text, /\ntext: \|\n/, 'the text as a block');
  assert.match(text, /\ndescription: \|\n/, 'the description too, never ">"');
  assert.match(text, /\n# private_note: /, 'the private note commented out');
  const again = await preparePages(dir);
  assert.deepEqual([again.created, again.updated, again.problems], [[], [], []]);
});

test('preparePages keeps a hand-written page and brings it in line', async () => {
  await fs.mkdir(path.join(dir, PAGES_SUBDIR));
  await fs.writeFile(file('kontakt'), 'text: Ahoj.\ndescription: Krátký popis.\n');
  const r = await preparePages(dir);
  assert.deepEqual(r.created, ['stranky/404.yaml', 'stranky/o-mne.yaml'], 'only the missing pages get a skeleton');
  assert.ok(r.updated.some((u) => u.startsWith('stranky/kontakt.yaml: doplněno location_label (výchozí hodnota)')));
  const contact = r.pages.find((p) => p.name === 'kontakt');
  assert.deepEqual([contact.data.description, contact.data.text, contact.data.location_label], ['Krátký popis.\n', 'Ahoj.\n', 'Žiji a maluji']);
  assert.match(await fs.readFile(file('kontakt'), 'utf8'), /\ntext: \|\n {2}Ahoj\.\n/, 'a plain text becomes a block');
});

test('preparePages: a page without text stays without it, the description is optional, a bad text stops the page', async () => {
  await fs.mkdir(path.join(dir, PAGES_SUBDIR));
  await fs.writeFile(file('kontakt'), 'description: Popis.\n');
  await fs.writeFile(file('o-mne'), 'text: Text.\n');
  await fs.writeFile(file('404'), `title: T\nheading: H\ndescription: ${'a'.repeat(PAGE_DESCRIPTION_CHARS + 1)}\n`);
  const r = await preparePages(dir);
  assert.equal(r.pages.find((p) => p.name === 'kontakt').data.text, '', 'added as empty = no text');
  assert.ok(r.pages.find((p) => p.name === 'o-mne'), 'no description: fine, search engines get the beginning of the text');
  assert.match(await fs.readFile(file('o-mne'), 'utf8'), /\n# description: /, 'commented out as an optional attribute');
  assert.deepEqual(r.problems, [`stranky/404.yaml: description má ${PAGE_DESCRIPTION_CHARS + 1} znaků, zkrať ho nejvýš na ${PAGE_DESCRIPTION_CHARS} (delší vyhledávače uříznou) [popis-stranky-dlouhy]`]);
  assert.equal(r.pages.find((p) => p.name === '404'), undefined, 'a page with a problem is not copied');
});

test('preparePages reports a file that is no page text', async () => {
  await fs.mkdir(path.join(dir, PAGES_SUBDIR, 'blog'), { recursive: true });
  await fs.writeFile(file('novinky'), 'text: x\n');
  await fs.writeFile(path.join(dir, PAGES_SUBDIR, 'portret.jpg'), 'x');
  await fs.writeFile(path.join(dir, PAGES_SUBDIR, '.DS_Store'), 'x');
  const { problems } = await preparePages(dir);
  assert.deepEqual(problems.map((p) => p.slice(0, p.indexOf(':'))), ['stranky/blog/', 'stranky/novinky.yaml', 'stranky/portret.jpg']);
  assert.match(problems[0], /404\.yaml, o-mne\.yaml, kontakt\.yaml, kurzy\.yaml/);
  assert.ok(problems.every((p) => p.endsWith('[cizi-soubor]')));
});

test('textProblems of a page: texts must be text, the description at most 160 characters of plain text', () => {
  const schema = PAGES['o-mne'].schema;
  assert.deepEqual(textProblems('stranky/o-mne.yaml', { description: 'Popis.', text: 'a', closing: null }, schema), []);
  assert.deepEqual(textProblems('stranky/o-mne.yaml', { text: ['a'] }, schema), ['stranky/o-mne.yaml: text musí být text [popisek-neni-text]']);
  assert.deepEqual(textProblems('x', { description: 'a'.repeat(PAGE_DESCRIPTION_CHARS) }, schema), []);
  assert.deepEqual(textProblems('x', { description: `${'a'.repeat(PAGE_DESCRIPTION_CHARS - 5)}\nbbbb\n` }, schema), [], 'line breaks are spaces, not counted twice');
  assert.match(textProblems('x', { description: 'a'.repeat(PAGE_DESCRIPTION_CHARS + 1) }, schema)[0], /má 161 znaků.*\[popis-stranky-dlouhy\]$/);
  assert.deepEqual(textProblems('x', { description: 5 }, schema), ['x: description musí být text [popisek-neni-text]']);
});

test('paragraphs: split by empty lines, lines of a paragraph joined', () => {
  assert.deepEqual(paragraphs('První řádek\ndruhý řádek.\n\n  \nDruhý odstavec.\n'), ['První řádek druhý řádek.', 'Druhý odstavec.']);
  assert.deepEqual(paragraphs(ABOUT_TEXT).length, 4);
  assert.deepEqual(paragraphs(''), []);
  assert.deepEqual(paragraphs(undefined), []);
});

test('publicPageFields: the texts, never the private note', () => {
  assert.deepEqual(publicPageFields('o-mne'), ['closing', 'description', 'text']);
  assert.deepEqual(publicPageFields('kontakt'), ['description', 'location_label', 'text']);
  assert.deepEqual(publicPageFields('404'), ['closing', 'description', 'heading', 'text', 'title']);
  assert.deepEqual(publicPageFields('kurzy'), ['closing', 'description', 'text', 'title']);
});

test('placeholderProblems: a page text starting with DOPLNIT is an error', () => {
  const problems = placeholderProblems({ pages: [{ name: 'kontakt', yamlPath: 'stranky/kontakt.yaml', data: { description: 'Popis.', text: `${TODO} text` } }] });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^stranky\/kontakt\.yaml: .*\[doplnit-verejny\]$/);
});

test('an optional page (kurzy) exists only with its file and needs a title', async () => {
  assert.deepEqual(GENERIC_PAGES, ['kurzy']);
  await fs.mkdir(path.join(dir, PAGES_SUBDIR));
  await fs.writeFile(file('kurzy'), 'description: Kurzy akvarelu.\ntext: Učím malovat.\n');
  let r = await preparePages(dir);
  assert.ok(r.updated.some((u) => u.startsWith('stranky/kurzy.yaml')), 'brought in line with its schema');
  assert.deepEqual(r.problems, ['stranky/kurzy.yaml: title je prázdný nebo není text, stránka ho potřebuje [prazdny-text-stranky]']);
  await fs.writeFile(file('kurzy'), 'description: Kurzy akvarelu.\ntext: Učím malovat.\ntitle: Kurzy\n');
  r = await preparePages(dir);
  assert.deepEqual(r.problems, []);
  assert.equal(r.pages.find((p) => p.name === 'kurzy').data.title, 'Kurzy');
  await fs.rm(file('kurzy'));
  r = await preparePages(dir);
  assert.equal(r.pages.find((p) => p.name === 'kurzy'), undefined, 'no file, no page, no skeleton');
});

test('pageProblems and textProblems: required texts of the page, bad links in the text and the closing', () => {
  const data = { description: 'Popis.', text: 'Viz [Fler](www.fler.cz).', closing: '[ok](/tvorba/) a [zle](tvorba)', heading: '', title: 'T' };
  assert.deepEqual(pageProblems('stranky/404.yaml', data, '404'), ['stranky/404.yaml: heading je prázdný nebo není text, stránka ho potřebuje [prazdny-text-stranky]']);
  const links = textProblems('stranky/404.yaml', data, PAGES[404].schema);
  assert.deepEqual(links.map((p) => p.match(/\[([a-z-]+)\]$/)[1]), ['spatny-odkaz-v-textu', 'spatny-odkaz-v-textu']);
  assert.ok(links.some((p) => /v text má adresu „www\.fler\.cz“/.test(p)));
  assert.deepEqual(pageProblems('stranky/kontakt.yaml', { description: 'P.', location_label: ' ' }, 'kontakt').length, 1);
  assert.deepEqual(pageProblems('stranky/o-mne.yaml', { description: 'P.' }, 'o-mne'), [], 'O mně has no title');
});
