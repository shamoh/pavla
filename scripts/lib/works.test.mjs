import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ID_LENGTH, generateId, idFromPath, isValidId, parseWorkKey, planPrune,
  slugify, splitExt, titleFromName, validSize, validateWorks, workKey,
} from './works.mjs';

/** Deterministic "random" returning the given values in a loop. */
const sequence = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

test('generateId returns a valid id without look-alike characters', () => {
  for (let i = 0; i < 200; i++) {
    const id = generateId();
    assert.equal(id.length, ID_LENGTH);
    assert.ok(isValidId(id), id);
    assert.doesNotMatch(id, /[01ilo]/);
    assert.match(id, /^[a-df-z]/);
  }
});

test('generateId skips ids that are already taken', () => {
  const taken = new Set(['a2222']);
  // First attempt picks index 0 everywhere ("a2222"), second the last character everywhere ("zzzzz").
  const id = generateId(taken, sequence(0, 0, 0, 0, 0, 0.999, 0.999, 0.999, 0.999, 0.999));
  assert.equal(id, 'zzzzz');
});

test('generateId gives up instead of looping forever', () => {
  assert.throws(() => generateId(new Set(['a2222']), () => 0), /unique/);
});

test('isValidId rejects wrong length, case, ambiguous characters and number-like ids', () => {
  assert.ok(isValidId('k3f9a'));
  for (const bad of ['k3f9', 'k3f9ab', 'K3F9A', 'k3f0a', 'k3fla', '22222', '2e345', 'e3456', undefined, 12345]) {
    assert.ok(!isValidId(bad), String(bad));
  }
});

test('slugify removes diacritics, case and punctuation', () => {
  assert.equal(slugify('Ráno u rybníka'), 'rano-u-rybnika');
  assert.equal(slugify('  Šumava – v mlze!! '), 'sumava-v-mlze');
  assert.equal(slugify('IMG_2031'), 'img-2031');
  assert.equal(slugify('Žluťoučký kůň'), 'zlutoucky-kun');
  assert.equal(slugify('---'), '');
});

test('titleFromName keeps diacritics and capitalises', () => {
  assert.equal(titleFromName('ráno_u rybníka'), 'Ráno u rybníka');
  assert.equal(titleFromName('čáp-na-louce'), 'Čáp na louce');
});

test('splitExt lower-cases the extension and handles names without one', () => {
  assert.deepEqual(splitExt('Photo.JPG'), { base: 'Photo', ext: 'jpg' });
  assert.deepEqual(splitExt('a.b.tiff'), { base: 'a.b', ext: 'tiff' });
  assert.deepEqual(splitExt('README'), { base: 'README', ext: '' });
  assert.deepEqual(splitExt('.hidden'), { base: '.hidden', ext: '' });
});

test('workKey and parseWorkKey round-trip', () => {
  const key = workKey('rano-u-rybnika', 'k3f9a');
  assert.equal(key, 'rano-u-rybnika-k3f9a');
  assert.deepEqual(parseWorkKey(key), { slug: 'rano-u-rybnika', id: 'k3f9a' });
  assert.equal(parseWorkKey('rano-u-rybnika'), null);
  assert.equal(parseWorkKey('k3f9a'), null);
});

test('idFromPath finds the id at the end of an old detail URL', () => {
  assert.equal(idFromPath('/tvorba/2025/stary-nazev-k3f9a/'), 'k3f9a');
  assert.equal(idFromPath('/tvorba/2025/stary-nazev-k3f9a'), 'k3f9a');
  assert.equal(idFromPath('/tvorba/k3f9a/'), null);
  assert.equal(idFromPath('/o-mne/'), null);
});

test('validSize accepts two positive numbers only', () => {
  assert.ok(validSize([40, 30]));
  for (const bad of [[0, 0], [40], [40, -1], ['40', 30], undefined]) assert.ok(!validSize(bad), JSON.stringify(bad));
});

const work = (over = {}) => ({
  year: '2026', slug: 'rano', id: 'k3f9a', yamlPath: 'tvorba/2026/rano.yaml',
  ...over,
  data: { title: 'Ráno', date: '2026-06-14', ...over.data },
});

test('validateWorks accepts valid works', () => {
  assert.deepEqual(validateWorks([work(), work({ slug: 'vecer', id: 'm7q2x' })]), []);
});

test('validateWorks accepts dates parsed by YAML as Date objects', () => {
  assert.deepEqual(validateWorks([work({ data: { date: new Date('2026-06-14') } })]), []);
});

test('validateWorks reports a date outside the year folder', () => {
  const [p] = validateWorks([work({ data: { date: '2025-12-31' } })]);
  assert.match(p, /does not match year folder 2026/);
});

test('validateWorks reports duplicate ids with both locations', () => {
  const problems = validateWorks([work(), work({ slug: 'vecer', yamlPath: 'tvorba/2026/vecer.yaml' })]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /vecer\.yaml.*also used by tvorba\/2026\/rano\.yaml/);
});

test('validateWorks reports bad folder, slug, id and missing fields', () => {
  const problems = validateWorks([work({ year: 'stare', slug: 'Ráno', id: 'X', data: { title: '', date: '' } })]);
  assert.equal(problems.length, 5);
});

test('validateWorks checks size only for published works', () => {
  assert.equal(validateWorks([work({ data: { size_cm: [0, 0] } })]).length, 1);
  assert.deepEqual(validateWorks([work({ data: { size_cm: [0, 0], draft: true } })]), []);
});

test('planPrune returns generated entries that are no longer wanted', () => {
  const existing = ['2026/rano-k3f9a', '2026/stary-nazev-m7q2x', '2025/smazane-p4r8t'];
  const wanted = ['2026/rano-k3f9a', '2026/novy-nazev-m7q2x'];
  assert.deepEqual(planPrune(existing, wanted), ['2025/smazane-p4r8t', '2026/stary-nazev-m7q2x']);
  assert.deepEqual(planPrune(wanted, wanted), []);
});
