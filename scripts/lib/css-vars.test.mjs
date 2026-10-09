import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { definedVars, undefinedVars, usedVars } from './css-vars.mjs';
import { paletteCss } from './palettes.mjs';

test('usedVars: var(--name) with or without a fallback, each once; not a name cut in a comment', () => {
  assert.deepEqual(usedVars('a { color: var(--ink); border: 1px solid var( --line, red); background: var(--ink) }'), ['--ink', '--line']);
  assert.deepEqual(usedVars('// a shadow uses filter: var(--drop-…)'), []);
});

test('definedVars: declarations in CSS and style attributes, setProperty in scripts', () => {
  assert.deepEqual(definedVars(':root { --paper-2: #fff; } <i style="--fill: 1"></i>'), ['--paper-2', '--fill']);
  assert.deepEqual(definedVars("el.style.setProperty('--bar-h', '3px')"), ['--bar-h']);
  assert.deepEqual(definedVars('color: var(--ink)'), [], 'a use is not a definition');
});

test('undefinedVars: a misspelt name is reported with its file, a name defined elsewhere is fine', () => {
  const files = [
    { file: 'a.astro', text: '.x { background: var(--paper2); color: var(--ink); margin: var(--gap) }' },
    { file: 'b.astro', text: ':root { --gap: 4px }' },
  ];
  assert.deepEqual(undefinedVars(files, [':root{--paper-2:#efeae0;--ink:#2b2724}']), [{ file: 'a.astro', name: '--paper2' }]);
});

test('the site uses only defined custom properties (palettes or its own)', () => {
  const files = readdirSync('src', { recursive: true })
    .filter((f) => /\.(astro|ts|css|mjs|js)$/.test(f))
    .map((f) => ({ file: join('src', f), text: readFileSync(join('src', f), 'utf8') }));
  assert.ok(files.length > 10, 'reads the sources from the root of the repository');
  assert.deepEqual(undefinedVars(files, [paletteCss()]), []);
});
