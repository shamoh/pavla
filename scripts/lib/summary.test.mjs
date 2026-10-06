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
  for (const text of ['2026/rano.yaml', 'k3f9a', 'Chybí fotka', '2026/vecer-m7q2x', 'Odstraněno (web a exporty', 'x-p4r8t']) assert.ok(s.includes(text), text);
});

test('formatSummary reports a crash', () => {
  assert.match(formatSummary(null, new Error('Content not found')), /Zpracování selhalo[\s\S]*Content not found/);
});

test('formatSummary of a branch run (prepare only) asks to fill in the new descriptions', () => {
  const s = formatSummary({ ...base, prepared: true, created: ['2026/rano.yaml'], assigned: ['2026/rano: k3f9a'] });
  assert.match(s, /^## ✓ Připraveno k doplnění/);
  assert.match(s, /doplň skutečné hodnoty/);
  assert.match(s, /až po sloučení větve do main/);
  assert.ok(s.includes('2026/rano.yaml'));
  assert.doesNotMatch(s, /Zpracováno:/);
  // problems on a branch look the same as on main
  assert.match(formatSummary({ ...base, prepared: true, ok: false, problems: ['x'] }), /^## ✗ Je potřeba něco opravit/);
});

test('formatSummary lists files brought in line with the schema', () => {
  const s = formatSummary({ ...base, updated: ['tvorba/rano.yaml: doplněno fler (DOPLNIT)'] });
  assert.match(s, /\*\*Srovnané popisy[^*]*\*\*\n\n- tvorba\/rano\.yaml: doplněno fler \(DOPLNIT\)/);
  assert.doesNotMatch(formatSummary(base), /Srovnané popisy/);
});

test('formatSummary lists published works that still have DOPLNIT', () => {
  const s = formatSummary({ ...base, pending: ['tvorba/rano.yaml: support, details'] });
  assert.match(s, /\*\*Zveřejněné obrazy, kterým zůstal DOPLNIT[^*]*\*\*\n\n- tvorba\/rano\.yaml: support, details/);
  assert.doesNotMatch(formatSummary(base), /zůstal DOPLNIT/);
});

test('formatSummary lists the corners found and the cut previews of drafts (the artifact of the run)', () => {
  const s = formatSummary({
    ...base, prepared: true, detected: ['tvorba/rano.yaml: tl 40×25, tr 30×20, br 35×28, bl 41×22'], previews: ['rano-k3f9a.jpg'],
  });
  assert.match(s, /\*\*Nalezené rohy listu \(meta_corners[^\n]*\*\*\n\n- tvorba\/rano\.yaml: tl 40×25/);
  assert.match(s, /\*\*Náhledy ořezu rozpracovaných obrazů \(ke stažení jako „nahledy-orezu“[^\n]*\*\*\n\n- rano-k3f9a\.jpg/);
  assert.doesNotMatch(formatSummary(base), /rohy listu|Náhledy ořezu/, 'nothing when there is nothing');
});
