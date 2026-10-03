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
  assert.match(real[0], new RegExp(`^${DEMO_MARKER.replace('.', '\\.')}: this content is the test data`));
  assert.match(real[1], /^tvorba\/demo-rano\.yaml: test data do not belong in the real content/);
  assert.match(real[2], /^tvorba\/demo-plener\/_index\.yaml/);
});

test('demoProblems: real content without test data is fine; test data without the marker or "demo-" names are reported', () => {
  const real = { works: [{ slug: 'rano', yamlPath: 'r' }], collections: [{ slug: 'plener' }] };
  assert.deepEqual(demoProblems(real, 'real'), []);
  assert.deepEqual(demoProblems({}, 'real'), []);
  assert.deepEqual(demoProblems({ ...real, marked: true }, 'demo'), [
    'r: names of test works and collections start with "demo-"',
    'tvorba/plener/_index.yaml: names of test works and collections start with "demo-"',
  ]);
  assert.deepEqual(demoProblems({ ...set, marked: false }, 'demo'), [
    `${DEMO_MARKER} missing: the test data are marked by this file in the root of the content`,
  ]);
});

test('demoProblems: a single test work copied into the real content is refused even without the marker', () => {
  const copied = { works: [{ slug: 'rano', yamlPath: 'a' }, { slug: 'demo-maky', yamlPath: 'b' }] };
  assert.deepEqual(demoProblems(copied, 'real'), ['b: test data do not belong in the real content; test data live in pavla/demo-content (npm run demo)']);
});
