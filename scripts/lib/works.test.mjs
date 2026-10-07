import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coverCandidates, expectedExports, exportPattern, FEATURED_PICK, formatSizeCm, generateId, ID_LENGTH, idFromPath, isOnSale, isValidId, parseWorkKey, planExportPrune, planPrune, PUBLIC_WORK_FIELDS, publicFields, slugify, splitExt, titleFromName, todoTexts, validateWorks, validSize, wantsMockups, workKey } from './works.mjs';

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
  dir: '', slug: 'rano', id: 'k3f9a', yamlPath: 'tvorba/rano.yaml',
  ...over,
  data: { title: 'Ráno', date: '2026-06-14', ...over.data },
});

test('validateWorks accepts valid works', () => {
  assert.deepEqual(validateWorks([work(), work({ slug: 'vecer', id: 'm7q2x' })]), []);
});

test('validateWorks accepts dates parsed by YAML as Date objects', () => {
  assert.deepEqual(validateWorks([work({ data: { date: new Date('2026-06-14') } })]), []);
});

test('validateWorks: the year comes from the date, so any day is fine, anything else is reported', () => {
  assert.deepEqual(validateWorks([work({ data: { date: '2025-12-31' } })]), []);
  for (const date of ['14. 6. 2026', '2026', 'nevím', 26]) {
    const [p] = validateWorks([work({ data: { date } })]);
    assert.match(p, /date musí být den ve tvaru 2026-06-14/, String(date));
  }
});

test('validateWorks reports duplicate ids with both locations', () => {
  const problems = validateWorks([work(), work({ slug: 'vecer', yamlPath: 'tvorba/plener/vecer.yaml' })]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /tvorba\/plener\/vecer\.yaml.*má i tvorba\/rano\.yaml/);
});

test('validateWorks reports bad slug, id and missing fields', () => {
  const problems = validateWorks([work({ slug: 'Ráno', id: 'X', data: { title: '', date: '' } })]);
  assert.equal(problems.length, 4);
});

test('validateWorks checks size only for published works', () => {
  assert.equal(validateWorks([work({ data: { size_cm: [0, 0] } })]).length, 1);
  assert.deepEqual(validateWorks([work({ data: { size_cm: [0, 0], meta_draft: true } })]), []);
});

test('planPrune returns generated entries that are no longer wanted', () => {
  const existing = ['2026/rano-k3f9a', '2026/stary-nazev-m7q2x', '2025/smazane-p4r8t'];
  const wanted = ['2026/rano-k3f9a', '2026/novy-nazev-m7q2x'];
  assert.deepEqual(planPrune(existing, wanted), ['2025/smazane-p4r8t', '2026/stary-nazev-m7q2x']);
  assert.deepEqual(planPrune(wanted, wanted), []);
});

test('validateWorks: "collection:" is not used any more (the folder decides), an empty one is fine', () => {
  assert.deepEqual(validateWorks([work({ data: { collection: '' } }), work({ slug: 'b', id: 'm7q2x', data: { collection: null } })]), []);
  const [p] = validateWorks([work({ data: { collection: 'plener-sumava-2026' } })]);
  assert.match(p, /tvorba\/rano\.yaml: „collection:“ se už nepoužívá, obraz patří do kolekce tím, že leží v její složce/);
});

test('isOnSale is true for available and reserved works only', () => {
  assert.deepEqual(['available', 'reserved', 'sold', 'gifted', 'not-for-sale', undefined].map(isOnSale), [true, true, false, false, false, false]);
});

test('publicFields keeps public work fields and drops the private note and unknown keys', () => {
  const data = { id: 'k3f9a', title: 'Ráno', private_note: 'jen pro mě', poznamka: 'taky soukromé', collection: 'plener', price: 0 };
  // the collection is the folder of the public copy, never an attribute
  assert.deepEqual(publicFields(data, PUBLIC_WORK_FIELDS), { id: 'k3f9a', title: 'Ráno', price: 0 });
  assert.ok(!PUBLIC_WORK_FIELDS.includes('private_note'));
  assert.deepEqual(publicFields(null, PUBLIC_WORK_FIELDS), {});
});

test('validateWorks requires a positive price for works on sale, except drafts', () => {
  for (const status of ['available', 'reserved']) {
    const [p] = validateWorks([work({ data: { status } })]);
    assert.match(p, new RegExp(`stav „${status}“ potřebuje cenu`));
    assert.equal(validateWorks([work({ data: { status, price: 0 } })]).length, 1);
    assert.equal(validateWorks([work({ data: { status, price: '3200' } })]).length, 1);
    assert.deepEqual(validateWorks([work({ data: { status, price: 3200 } })]), []);
    assert.deepEqual(validateWorks([work({ data: { status, meta_draft: true } })]), []);
  }
  for (const status of ['sold', 'not-for-sale', undefined]) assert.deepEqual(validateWorks([work({ data: { status } })]), []);
});

test('validateWorks checks detail captions against the detail photos of the work', () => {
  const details = [{ name: '1-kvet' }, { name: 'lodka' }];
  assert.deepEqual(validateWorks([work({ details, data: { details: { '1 Květ': 'Květ', lodka: 'Loďka' } } })]), []);
  assert.deepEqual(validateWorks([work({ details, data: { details: null } })]), []);
  assert.match(validateWorks([work({ details, data: { details: { vesta: 'x' } } })])[0], /ve složce tvorba\/rano\/ není detailní fotka „vesta“/);
  assert.match(validateWorks([work({ dir: 'plener', details, data: { details: { vesta: 'x' } } })])[0], /ve složce tvorba\/plener\/rano\/ není/);
  assert.match(validateWorks([work({ details, data: { details: { lodka: 5 } } })])[0], /popisek „lodka“ musí být text/);
  assert.match(validateWorks([work({ details, data: { details: ['Květ'] } })])[0], /details musí být řádky/);
});

test('validateWorks stops a published work with a text still starting with DOPLNIT, not a draft', () => {
  const details = [{ name: 'lodka' }];
  const [p] = validateWorks([work({ details, data: { details: { lodka: 'DOPLNIT popisek detailu' } } })]);
  assert.match(p, /details\.lodka pořád začíná „DOPLNIT“, přepiš ho/);
  assert.match(validateWorks([work({ data: { title: 'DOPLNIT název' } })])[0], /: title pořád začíná „DOPLNIT“/);
  assert.match(validateWorks([work({ data: { description: '  DOPLNIT\n' } })])[0], /: description pořád začíná/);
  assert.match(validateWorks([work({ data: { tags: ['voda', 'DOPLNIT'] } })])[0], /: tags\[1\] pořád začíná/);
  assert.deepEqual(validateWorks([work({ details, data: { meta_draft: true, title: 'DOPLNIT', details: { lodka: 'DOPLNIT popisek detailu' } } })]), []);
  assert.deepEqual(validateWorks([work({ details, data: { details: { lodka: 'Loďka, DOPLNIT jindy' } } })]), [], 'only a text starting with it');
  assert.deepEqual(validateWorks([work({ data: { private_note: 'DOPLNIT cenu', meta_instagram: false } })]), [], 'private_ and meta_ attributes never reach the site');
});

test('todoTexts: where texts start with DOPLNIT, nested too', () => {
  assert.deepEqual(todoTexts({ a: 'DOPLNIT', b: 'ok', c: ['x', ' DOPLNIT y'], d: { e: 'DOPLNIT' }, f: 5, g: null, h: new Date() }), ['a', 'c[1]', 'd.e']);
  assert.deepEqual(todoTexts('DOPLNIT'), ['']);
  assert.deepEqual(todoTexts({}), []);
});

test('validateWorks: a value outside the options of status, meta_draft and the switches is a problem, drafts too', () => {
  const [p] = validateWorks([work({ data: { status: 'availble', price: 100 } })]);
  assert.equal(p, 'tvorba/rano.yaml: status „availble“ není mezi možnostmi: available, reserved, sold, gifted, not-for-sale');
  assert.match(validateWorks([work({ data: { meta_draft: 'ne' } })])[0], /meta_draft „ne“ není mezi možnostmi: true, false/);
  assert.match(validateWorks([work({ data: { meta_draft: true, featured: 1 } })])[0], /featured „1“ není mezi možnostmi: true, false/);
  assert.match(validateWorks([work({ data: { status: '' } })])[0], /status „“ není mezi možnostmi/, 'an empty text is no status');
  for (const status of ['available', 'reserved', 'sold', 'gifted', 'not-for-sale']) assert.deepEqual(validateWorks([work({ data: { status, price: 100 } })]), []);
  assert.deepEqual(validateWorks([work({ data: { status: null, featured: false, meta_instagram: true } })]), [], 'missing = default');
});

test('exportPattern matches every export of one work and nothing of another', () => {
  const re = exportPattern('rano-k3f9a');
  for (const f of ['rano-k3f9a.jpg', 'rano-k3f9a-clean.jpg', 'rano-k3f9a-wall.jpg', 'rano-k3f9a-mockup-obyvak-vecer.jpg', 'rano-k3f9a-detail-1-mlha.jpg']) {
    assert.ok(re.test(f), f);
  }
  for (const f of ['rano-k3f9a.png', 'rano-m7q2x.jpg', 'x-rano-k3f9a.jpg', 'rano-k3f9a-poznamka.jpg']) assert.ok(!re.test(f), f);
});

test('planExportPrune removes exports of deleted and renamed works, keeps current ones', () => {
  const files = [
    '2026/rano-k3f9a-clean.jpg', '2026/rano-k3f9a-detail-kvet.jpg',       // current work
    '2026/stary-nazev-k3f9a.jpg', '2026/stary-nazev-k3f9a-clean.jpg',     // renamed (same id, old slug)
    '2025/smazane-p4r8t-clean.jpg', '2025/smazane-p4r8t-mockup-police.jpg', // deleted
    '2025/rano-k3f9a-clean.jpg',                                           // current key, but wrong year
    '2026/poznamky.jpg', '2026/.DS_Store',                                 // not exports, never touched
  ];
  assert.deepEqual(planExportPrune(files, ['2026/rano-k3f9a']), [
    '2025/rano-k3f9a-clean.jpg', '2025/smazane-p4r8t-clean.jpg', '2025/smazane-p4r8t-mockup-police.jpg',
    '2026/stary-nazev-k3f9a-clean.jpg', '2026/stary-nazev-k3f9a.jpg',
  ]);
  assert.deepEqual(planExportPrune(files.slice(0, 2), ['2026/rano-k3f9a']), []);
});

test('planExportPrune keeps a detail export whose name looks like another key', () => {
  // "rano-k3f9a-detail-ab-mn2pq.jpg" is a detail of rano-k3f9a, not a work "…-mn2pq"
  assert.deepEqual(planExportPrune(['2026/rano-k3f9a-detail-ab-mn2pq.jpg'], ['2026/rano-k3f9a']), []);
});

test('planExportPrune removes exports a current work should not have, keeps the rest', () => {
  const files = [
    '2026/rano-k3f9a-clean.jpg', '2026/rano-k3f9a.jpg', '2026/rano-k3f9a-mockup-police.jpg', '2026/rano-k3f9a-mockup-predsin.jpg',
    '2026/rano-k3f9a-detail-kvet.jpg', '2026/rano-k3f9a-detail-lodka.jpg', '2026/rano-k3f9a-wall.jpg',
  ];
  // Instagram: original and detail "kvet" only
  assert.deepEqual(planExportPrune(files, new Map([['2026/rano-k3f9a', ['-clean', '-detail-kvet']]])), [
    '2026/rano-k3f9a-detail-lodka.jpg', '2026/rano-k3f9a-mockup-police.jpg', '2026/rano-k3f9a-mockup-predsin.jpg',
    '2026/rano-k3f9a-wall.jpg', '2026/rano-k3f9a.jpg',
  ]);
  // Fler of a work not on sale: nothing may stay
  assert.equal(planExportPrune(files, new Map([['2026/rano-k3f9a', []]])).length, files.length);
  // null (or a plain list of keys) = unknown, keep everything of the work
  assert.deepEqual(planExportPrune(files, new Map([['2026/rano-k3f9a', null]])), []);
  assert.deepEqual(planExportPrune(files, ['2026/rano-k3f9a']), []);
});

test('planExportPrune: a detail export is kept when another reading of its name matches a current detail', () => {
  const file = ['2026/rano-k3f9a-detail-ab-mn2pq.jpg'];
  assert.deepEqual(planExportPrune(file, new Map([['2026/rano-k3f9a', ['-detail-ab-mn2pq']]])), []);
  assert.deepEqual(planExportPrune(file, new Map([['2026/rano-k3f9a', ['-detail-ab']]])), file);
});

test('expectedExports: Instagram (when asked for) original and details, Fler only on sale with original and mockups', () => {
  const details = ['kvet'];
  const mockupScenes = ['police', 'pracovna'];
  assert.deepEqual(expectedExports({ status: 'available', details, mockupScenes, instagram: true }), {
    instagram: ['-clean', '-detail-kvet'],
    fler: ['', '-mockup-police', '-mockup-pracovna'],
  });
  assert.deepEqual(expectedExports({ status: 'reserved', details: [], mockupScenes: [], instagram: true }), { instagram: ['-clean'], fler: [''] });
  // Instagram only when asked for
  assert.deepEqual(expectedExports({ status: 'available', details, mockupScenes }).instagram, []);
  for (const status of ['sold', 'not-for-sale', undefined]) {
    assert.deepEqual(expectedExports({ status, details, mockupScenes }).fler, [], String(status));
  }
  // web images not generated yet: Fler exports of a work on sale are left alone
  assert.equal(expectedExports({ status: 'available', details, mockupScenes: null }).fler, null);
});

test('wantsMockups: only an explicit mockups: true, independent of the status; the flag is public', () => {
  assert.equal(wantsMockups({ mockups: true, status: 'not-for-sale' }), true);
  for (const data of [{ mockups: false, status: 'available' }, { status: 'available' }, { mockups: 'true' }, null]) {
    assert.equal(wantsMockups(data), false, JSON.stringify(data));
  }
  assert.ok(PUBLIC_WORK_FIELDS.includes('mockups'));
  assert.match(validateWorks([work({ data: { mockups: 'ano' } })])[0], /mockups „ano“ není mezi možnostmi: true, false/);
});

test('coverCandidates: the newest works of the author\'s selection, at most FEATURED_PICK, else the newest work', () => {
  const works = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => ({ id, featured: i % 2 === 1 }));
  assert.equal(FEATURED_PICK, 10);
  assert.deepEqual(coverCandidates(works).map((w) => w.id), ['b', 'd', 'f', 'h']);
  const many = works.map((w) => ({ ...w, featured: true }));
  assert.deepEqual(coverCandidates(many, undefined, 5).map((w) => w.id), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(coverCandidates([...many, ...many, ...many].map((w, i) => ({ ...w, id: `w${i}` }))).length, FEATURED_PICK);
  assert.deepEqual(coverCandidates(works.map((w) => ({ ...w, featured: false }))).map((w) => w.id), ['a']);
  assert.deepEqual(coverCandidates([]), []);
  // the pipeline passes its own accessor (featured lives in data)
  assert.deepEqual(coverCandidates([{ id: 'x', data: {} }, { id: 'y', data: { featured: true } }], (w) => w.data.featured === true).map((w) => w.id), ['y']);
});

test('formatSizeCm: Czech decimal comma, whole numbers as they are, nothing without a valid size', () => {
  assert.equal(formatSizeCm([29.5, 29.5]), '29,5 × 29,5 cm');
  assert.equal(formatSizeCm([16.5, 4]), '16,5 × 4 cm');
  assert.equal(formatSizeCm([42, 30]), '42 × 30 cm');
  for (const bad of [undefined, null, [0, 0], [30], 'A4']) assert.equal(formatSizeCm(bad), '', String(bad));
});
