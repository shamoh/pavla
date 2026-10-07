import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_MARKER, demoProblems, isDemo } from './demo.mjs';

test('isDemo: marked by the "demo-" name only', () => {
  assert.ok(isDemo('demo-kytice'));
  assert.ok(!isDemo('kytice'));
  assert.ok(!isDemo('pivonky-demo'));
});

const set = {
  works: [{ slug: 'demo-rano', yamlPath: 'tvorba/demo-rano.yaml' }],
  collections: [{ slug: 'demo-plener' }],
  marked: true,
};

test('demoProblems: a marked test set is fine as demo and refused as real content', () => {
  assert.deepEqual(demoProblems(set, 'demo'), []);
  const real = demoProblems(set, 'real');
  assert.equal(real.length, 3);
  assert.match(real[0], new RegExp(`^${DEMO_MARKER.replace('.', '\\.')}: tohle jsou testovací data`));
  assert.match(real[1], /^tvorba\/demo-rano\.yaml: testovací data do skutečného obsahu nepatří/);
  assert.match(real[2], /^tvorba\/demo-plener\/_index\.yaml/);
});

test('demoProblems: real content without test data is fine; test data without the marker or "demo-" names are reported', () => {
  const real = { works: [{ slug: 'rano', yamlPath: 'r' }], collections: [{ slug: 'plener' }] };
  assert.deepEqual(demoProblems(real, 'real'), []);
  assert.deepEqual(demoProblems({}, 'real'), []);
  assert.deepEqual(demoProblems({ ...real, marked: true }, 'demo'), [
    'r: jména testovacích děl a kolekcí začínají „demo-“',
    'tvorba/plener/_index.yaml: jména testovacích děl a kolekcí začínají „demo-“',
  ]);
  assert.deepEqual(demoProblems({ ...set, marked: false }, 'demo'), [
    `${DEMO_MARKER}: chybí, testovací data označuje tento soubor v kořeni obsahu`,
  ]);
});

test('demoProblems: a single test work copied into the real content is refused even without the marker', () => {
  const copied = { works: [{ slug: 'rano', yamlPath: 'a' }, { slug: 'demo-maky', yamlPath: 'b' }] };
  assert.deepEqual(demoProblems(copied, 'real'), ['b: testovací data do skutečného obsahu nepatří, patří do pavla/demo-content (npm run demo)']);
});
