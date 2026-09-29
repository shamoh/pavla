import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVersion, localParts, timePreposition } from './build-version.mjs';

test('buildVersion: CalVer label, ISO time and tooltip in Prague time (summer time)', () => {
  // 12:23 UTC = 14:23 in Prague in September (CEST, +02:00)
  const v = buildVersion(new Date('2026-09-28T12:23:00Z'), '6031b4d0c1e2');
  assert.equal(v.label, 'v26.0928.1423');
  assert.equal(v.iso, '2026-09-28T14:23+02:00');
  assert.equal(v.title, 'Web vygenerován 28. 9. 2026 ve 14:23 · commit 6031b4d');
});

test('buildVersion: winter time, leading zeros in the label, none in the tooltip, no commit', () => {
  // 08:05 UTC = 09:05 in Prague in January (CET, +01:00)
  const v = buildVersion(new Date('2027-01-03T08:05:00Z'));
  assert.equal(v.label, 'v27.0103.0905');
  assert.equal(v.iso, '2027-01-03T09:05+01:00');
  assert.equal(v.title, 'Web vygenerován 3. 1. 2027 v 9:05');
});

test('buildVersion: a build shortly before midnight UTC already belongs to the next day in Prague', () => {
  const v = buildVersion(new Date('2026-12-31T23:30:00Z'));
  assert.equal(v.label, 'v27.0101.0030');
  assert.equal(v.title, 'Web vygenerován 1. 1. 2027 v 0:30');
});

test('localParts: other time zones and UTC', () => {
  assert.equal(localParts(new Date('2026-09-28T12:23:00Z'), 'UTC').offset, '+00:00');
  assert.equal(localParts(new Date('2026-09-28T12:23:00Z'), 'America/New_York').hour, '08');
});

test('timePreposition: "ve" before dvě, tři, čtyři, dvanáct, třináct, čtrnáct, dvacet…, otherwise "v"', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9, 11, 12, 13, 14, 15, 19, 20, 23].map(timePreposition),
    ['v', 'v', 've', 've', 've', 'v', 'v', 'v', 've', 've', 've', 'v', 'v', 've', 've']);
});
