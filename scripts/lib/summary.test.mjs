import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary } from './summary.mjs';

const base = { ok: true, problems: [], missing: [], created: [], assigned: [], pruned: [], processed: 0, skipped: 0 };

test('formatSummary reports a clean run with counts', () => {
  const s = formatSummary({ ...base, processed: 2, skipped: 5 });
  assert.match(s, /^## ✓ Zpracováno/);
  assert.match(s, /Zpracováno: 2, beze změny: 5\./);
  assert.doesNotMatch(s, /\*\*/);
});

test('formatSummary lists problems and says nothing was published', () => {
  const s = formatSummary({ ...base, ok: false, problems: ['tvorba/2026/a.yaml: missing title'] });
  assert.match(s, /^## ✗ Je potřeba něco opravit/);
  assert.match(s, /Nic nebylo zveřejněno/);
  assert.match(s, /- tvorba\/2026\/a\.yaml: missing title/);
});

test('formatSummary lists new skeletons, ids, missing photos and removals', () => {
  const s = formatSummary({
    ...base, ok: false,
    created: ['2026/rano.yaml'], assigned: ['2026/rano: k3f9a'], missing: ['2026/vecer-m7q2x'], pruned: ['public/works/2025/x-p4r8t/'],
  });
  for (const text of ['2026/rano.yaml', 'k3f9a', 'Chybí fotka', '2026/vecer-m7q2x', 'Odstraněno z webu', 'x-p4r8t']) assert.ok(s.includes(text), text);
});

test('formatSummary reports a crash', () => {
  assert.match(formatSummary(null, new Error('Content not found')), /Zpracování selhalo[\s\S]*Content not found/);
});
