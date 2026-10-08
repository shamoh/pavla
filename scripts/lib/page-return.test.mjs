import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETURN_MAX_PATHS, focusToken, insideScope, parseReturns, rememberReturn, returnHref } from './page-return.mjs';

const site = 'https://pavla.example';

test('rememberReturn keeps one query per path, an empty query forgets it', () => {
  let stored = rememberReturn(null, '/tvorba/', new URLSearchParams('tag=krajina&page=2'));
  stored = rememberReturn(stored, '/tvorba/kolekce/', '?year=2025');
  assert.deepEqual(parseReturns(stored), { '/tvorba/': 'tag=krajina&page=2', '/tvorba/kolekce/': 'year=2025' });
  stored = rememberReturn(stored, '/tvorba/', '');
  assert.deepEqual(parseReturns(stored), { '/tvorba/kolekce/': 'year=2025' });
});

test('rememberReturn drops the oldest paths over the limit', () => {
  let stored = null;
  for (let i = 0; i <= RETURN_MAX_PATHS; i++) stored = rememberReturn(stored, `/p${i}/`, 'a=1');
  const map = parseReturns(stored);
  assert.equal(Object.keys(map).length, RETURN_MAX_PATHS);
  assert.ok(!('/p0/' in map));
  assert.ok(`/p${RETURN_MAX_PATHS}/` in map);
});

test('parseReturns survives garbage', () => {
  assert.deepEqual(parseReturns('nonsense'), {});
  assert.deepEqual(parseReturns('[1]'), {});
  assert.deepEqual(parseReturns('null'), {});
  assert.deepEqual(parseReturns('{"/a/": 3, "/b/": "x=1"}'), { '/b/': 'x=1' });
});

test('returnHref adds the remembered query of the link path', () => {
  const stored = rememberReturn(null, '/tvorba/', 'tag=krajina');
  assert.equal(returnHref(`${site}/tvorba/`, stored), `${site}/tvorba/?tag=krajina`);
  assert.equal(returnHref(`${site}/tvorba/2026/`, stored), `${site}/tvorba/2026/`);
  assert.equal(returnHref(`${site}/tvorba/?year=2025`, stored), `${site}/tvorba/?year=2025`);
});

test('returnHref uses the referrer only without storage', () => {
  const ref = `${site}/tvorba/kolekce/?year=2025`;
  assert.equal(returnHref(`${site}/tvorba/kolekce/`, null, ref), `${site}/tvorba/kolekce/?year=2025`);
  assert.equal(returnHref(`${site}/tvorba/kolekce/`, '{}', ref), `${site}/tvorba/kolekce/`);
  assert.equal(returnHref(`${site}/tvorba/kolekce/`, null, `${site}/tvorba/?tag=x`), `${site}/tvorba/kolekce/`);
  assert.equal(returnHref(`${site}/tvorba/kolekce/`, null, `https://jinde.example/tvorba/kolekce/?year=2025`), `${site}/tvorba/kolekce/`);
  assert.equal(returnHref(`${site}/tvorba/kolekce/`, null, ''), `${site}/tvorba/kolekce/`);
});

test('insideScope: the Tvorba section of the site, with or without a base path', () => {
  assert.equal(insideScope('/tvorba/'), true);
  assert.equal(insideScope('/tvorba/2026/jez-k3f9a/'), true);
  assert.equal(insideScope('/tvorba/kolekce/'), true);
  assert.equal(insideScope('/'), false);
  assert.equal(insideScope('/o-mne/'), false);
  assert.equal(insideScope('/tvorbaxyz/'), false);
  assert.equal(insideScope('/pavla/tvorba/', '/pavla/'), true);
  assert.equal(insideScope('/pavla/kontakt/', '/pavla'), false);
});

test('focusToken accepts only a work id or a collection slug', () => {
  assert.equal(focusToken('k3f9a'), 'k3f9a');
  assert.equal(focusToken('2026-plener-sumava'), '2026-plener-sumava');
  assert.equal(focusToken(null), '');
  assert.equal(focusToken(''), '');
  assert.equal(focusToken('<img>'), '');
  assert.equal(focusToken('a"b'), '');
});
