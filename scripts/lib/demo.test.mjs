import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoProblems, isDemo } from './demo.mjs';

test('isDemo: marked by the "demo-" name or by demo: true', () => {
  assert.ok(isDemo('demo-kytice', {}));
  assert.ok(isDemo('portret', { demo: true }));
  assert.ok(!isDemo('kytice', {}));
  assert.ok(!isDemo('kytice', { demo: 'yes' }));
  assert.ok(!isDemo('pivonky-demo', null));
});

const set = {
  works: [{ slug: 'demo-rano', data: { demo: true }, yamlPath: 'tvorba/demo-rano.yaml' }],
  collections: [{ slug: 'demo-plener', data: { demo: true } }],
  photos: [{ name: 'portret', data: { demo: true } }],
};

test('demoProblems: a fully marked test set is fine as demo and refused as real content', () => {
  assert.deepEqual(demoProblems(set, 'demo'), []);
  const real = demoProblems(set, 'real');
  assert.equal(real.length, 3);
  assert.match(real[0], /^tvorba\/demo-rano\.yaml: test data do not belong in the real content/);
  assert.match(real[1], /^tvorba\/demo-plener\/_kolekce\.yaml/);
  assert.match(real[2], /^fotky\/portret\.yaml/);
});

test('demoProblems: real content without test data is fine; half-marked test items are reported', () => {
  const real = { works: [{ slug: 'rano', data: {} }], collections: [{ slug: 'plener', data: {} }], photos: [{ name: 'portret', data: {} }] };
  assert.deepEqual(demoProblems(real, 'real'), []);
  const half = { works: [{ slug: 'demo-rano', data: {}, yamlPath: 'w' }, { slug: 'rano', data: { demo: true }, yamlPath: 'v' }], photos: [{ name: 'portret', data: {} }] };
  assert.deepEqual(demoProblems(half, 'demo'), [
    'w: every item of the test data needs "demo: true"',
    'v: names of test works and collections start with "demo-"',
    'fotky/portret.yaml: every item of the test data needs "demo: true"',
  ]);
});
