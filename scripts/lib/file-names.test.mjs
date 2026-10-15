import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileNameProblems, nameProblem } from './file-names.mjs';

test('nameProblem accepts names that are their own web address', () => {
  for (const name of ['jez.jpg', 'jez.yaml', 'stekensky-jez-2.jpg', '2026.yaml', '2026.jpg', '1-mlha.jpg', 'portret.png', 'jez.webp']) {
    assert.equal(nameProblem(`tvorba/${name}`, name, true), null, name);
  }
  for (const name of ['2026-plener-sumava', 'jez']) assert.equal(nameProblem(`tvorba/${name}/`, name, false), null, name);
});

test('nameProblem accepts the system files and leaves hidden files and former system names to others', () => {
  for (const name of ['_index.yaml', '_cover.jpg', '_cover.png', '.DS_Store', '.gitkeep', '_kolekce.yaml', '_uvod.jpg']) {
    assert.equal(nameProblem(`tvorba/${name}`, name, true), null, name);
  }
});

test('nameProblem: the system cover keeps its name, only its extension is checked', () => {
  for (const name of ['_cover.JPG', '_cover.jpeg']) {
    assert.match(nameProblem(`tvorba/${name}`, name, true), /soubor na „_cover\.jpg“.*\[neplatne-jmeno\]$/, name);
  }
});

test('nameProblem refuses underscores, spaces, commas, capitals, diacritics and invisible characters, with a proposal', () => {
  assert.equal(
    nameProblem('fotky/Instagram_surf.jpg', 'Instagram_surf.jpg', true),
    'fotky/Instagram_surf.jpg: přejmenuj soubor na „instagram-surf.jpg“, jméno smí mít jen malá písmena bez diakritiky, číslice a pomlčky (žádné mezery, podtržítka, čárky ani jiné znaky), přípona jen malými písmeny a fotka .jpg (ne .jpeg) [neplatne-jmeno]',
  );
  const cases = {
    'rano u rybnika.jpg': 'rano-u-rybnika.jpg',
    'jez,stekeň.yaml': 'jez-steken.yaml',
    'Ráno.JPG': 'rano.jpg',
    'jez​.jpg': 'jez.jpg',
    'jez 2.jpg': 'jez-2.jpg',
    'jez--2.jpg': 'jez-2.jpg',
    '-jez.jpg': 'jez.jpg',
    'jez-.yaml': 'jez.yaml',
    '_jez.jpg': 'jez.jpg',
    'jez.v.parku.jpg': 'jez-v-parku.jpg',
    'foto.JPG': 'foto.jpg',
    'portret.jpeg': 'portret.jpg',
    'portret.JPEG': 'portret.jpg',
    'jez.Yaml': 'jez.yaml',
    'Instagram_surf.JPEG': 'instagram-surf.jpg',
  };
  for (const [name, proposal] of Object.entries(cases)) {
    assert.match(nameProblem(`tvorba/${name}`, name, true), new RegExp(`soubor na „${proposal.replace('.', '\\.')}“.*\\[neplatne-jmeno\\]$`), name);
  }
  assert.match(nameProblem('tvorba/Plenér Šumava/', 'Plenér Šumava', false), /^tvorba\/Plenér Šumava\/: přejmenuj složku na „plener-sumava“/);
  // nothing usable left: no proposal
  assert.match(nameProblem('fotky/___.jpg', '___.jpg', true), /^fotky\/___\.jpg: přejmenuj soubor, jméno smí/);
});

let tmp;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-names-')); });
afterEach(() => fs.rm(tmp, { recursive: true, force: true }));
const touch = async (rel) => {
  await fs.mkdir(path.dirname(path.join(tmp, rel)), { recursive: true });
  await fs.writeFile(path.join(tmp, rel), '');
};

test('fileNameProblems checks tvorba/, fotky/ and roky/ recursively, folders too, the cover of the root, and nothing else', async () => {
  for (const rel of [
    'tvorba/jez.jpg', 'tvorba/jez.yaml', 'tvorba/jez/detail_1.jpg', 'tvorba/_index.yaml', 'tvorba/.DS_Store',
    'tvorba/Plener 2026/_index.yaml', 'tvorba/Plener 2026/_cover.jpg', 'tvorba/Plener 2026/rano.jpg',
    'fotky/Instagram_surf.jpg', 'fotky/instagram-surf.yaml', 'fotky/portret.jpeg', 'roky/2026.yaml', 'roky/2025 .yaml',
    '_index.yaml', '_cover.JPG', 'README.md', 'CLAUDE.md', 'docs/Poznamky k webu.md', 'export/x y.jpg',
  ]) await touch(rel);
  assert.deepEqual((await fileNameProblems(tmp)).map((p) => p.slice(0, p.indexOf(': '))), [
    '_cover.JPG', 'tvorba/jez/detail_1.jpg', 'tvorba/Plener 2026/', 'fotky/Instagram_surf.jpg', 'fotky/portret.jpeg', 'roky/2025 .yaml',
  ]);
});

test('fileNameProblems: good names and missing folders are fine', async () => {
  assert.deepEqual(await fileNameProblems(tmp), []);
  for (const rel of ['tvorba/2026-plener/_index.yaml', 'tvorba/2026-plener/rano.jpg', 'tvorba/2026-plener/rano.yaml', 'fotky/portret.jpg', '_cover.jpg', '_index.yaml']) await touch(rel);
  assert.deepEqual(await fileNameProblems(tmp), []);
});
