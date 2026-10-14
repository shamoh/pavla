import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CODES, LEVELS, LEVEL_LABELS, coded, codesOf, withoutCodes } from './codes.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const sources = [
  ...fs.readdirSync(here).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && f !== 'codes.mjs').map((f) => path.join(here, f)),
  path.join(here, '..', 'process-images.mjs'),
  path.join(here, '..', 'check-health.mjs'),
].map((f) => fs.readFileSync(f, 'utf8')).join('\n');

test('codes: kebab-case without diacritics, a known level and a Czech text each', () => {
  for (const [code, { level, text }] of Object.entries(CODES)) {
    assert.match(code, /^[a-z0-9]+(-[a-z0-9]+)*$/, code);
    assert.ok(LEVELS.includes(level), code);
    assert.ok(LEVEL_LABELS[level], level);
    assert.ok(text && codesOf(text).length === 0, code);
  }
});

test('codes: every code is used by the source, every code in a message of the source is known', () => {
  for (const code of Object.keys(CODES)) {
    assert.ok(sources.includes(`[${code}]`) || sources.includes(`'${code}'`), `unused code ${code}`);
  }
  // a bracketed kebab-case word at the end of a message text in the source must be a code
  for (const [, code] of sources.matchAll(/ \[([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\][`']/g)) assert.ok(Object.hasOwn(CODES, code), `unknown code ${code}`);
});

test('coded appends the code, refuses an unknown one; codesOf and withoutCodes read it back', () => {
  assert.equal(coded('chybi-nazev', 'tvorba/a.yaml: chybí název (title)'), 'tvorba/a.yaml: chybí název (title) [chybi-nazev]');
  assert.throws(() => coded('neznamy-kod', 'x'), /Unknown message code/);
  assert.deepEqual(codesOf('a: x [prejmenovany-atribut]; y [derived-atribut]'), ['prejmenovany-atribut', 'derived-atribut']);
  assert.deepEqual(codesOf('size_cm musí být [šířka, výška] v cm [spatny-rozmer]'), ['spatny-rozmer']);
  assert.deepEqual(codesOf('bez kódu [neni-kod] a [x, y]'), []);
  assert.deepEqual(codesOf(undefined), []);
  assert.equal(withoutCodes('x [prejmenovany-atribut]; y [derived-atribut]'), 'x; y');
  assert.equal(withoutCodes('focus [x, y] [spatny-focus]'), 'focus [x, y]');
});
