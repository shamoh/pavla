import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary, groupProblems } from './summary.mjs';

const base = { ok: true, problems: [], missing: [], created: [], assigned: [], pruned: [], processed: 0, skipped: 0 };

test('formatSummary reports a clean run with counts', () => {
  const s = formatSummary({ ...base, processed: 2, skipped: 5 });
  assert.match(s, /^## ✓ Zpracováno/);
  assert.match(s, /Zpracováno: 2, beze změny: 5\./);
  assert.doesNotMatch(s, /\*\*|Chyby|Ke kontrole/);
});

test('groupProblems: messages grouped by file in order of appearance, others as general', () => {
  assert.deepEqual(groupProblems(['a.yaml: x', 'b/c d.yaml: y', 'a.yaml: z: w', 'bez souboru']), [
    { file: 'a.yaml', messages: ['x', 'z: w'] },
    { file: 'b/c d.yaml', messages: ['y'] },
    { file: '', messages: ['bez souboru'] },
  ]);
});

test('formatSummary: errors first, grouped by file, then warnings, then what the run did', () => {
  const s = formatSummary({
    ...base, ok: false,
    problems: ['tvorba/a.yaml: chybí název (title)', 'roky/2026.yaml: description musí být text', 'tvorba/a.yaml: chybí datum (date)'],
    pending: ['tvorba/b.yaml: support'], created: ['tvorba/rano.yaml'],
  });
  assert.match(s, /^## ✗ Je potřeba něco opravit\n\nNic nebylo zveřejněno/);
  assert.match(s, /### ✗ Chyby \(3\)\n\n\*\*tvorba\/a\.yaml\*\*\n\n- chybí název \(title\)\n- chybí datum \(date\)\n\n\*\*roky\/2026\.yaml\*\*\n\n- description musí být text\n/);
  const order = ['### ✗ Chyby', '### ⚠ Ke kontrole', 'tvorba/b.yaml', '### Co automatika udělala', 'tvorba/rano.yaml'].map((t) => s.indexOf(t));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), order.join(', '));
});

test('formatSummary lists new skeletons, ids, missing photos and removals', () => {
  const s = formatSummary({
    ...base, ok: false,
    created: ['2026/rano.yaml'], assigned: ['2026/rano: k3f9a'], missing: ['2026/vecer-m7q2x'], pruned: ['public/works/2025/x-p4r8t/'],
  });
  for (const text of ['2026/rano.yaml', 'k3f9a', 'Chybí fotka', '2026/vecer-m7q2x', 'Odstraněno (web a exporty', 'x-p4r8t']) assert.ok(s.includes(text), text);
  assert.match(s, /Ostatní obrazy se zpracovaly/, 'a missing photo alone does not stop the others');
  assert.match(s, /### ✗ Chyby \(1\)\n\n\*\*Chybí fotka obrazu\*\*[^\n]*\n\n- 2026\/vecer-m7q2x/);
  assert.ok(s.indexOf('Chybí fotka') < s.indexOf('Co automatika udělala'));
});

test('formatSummary reports a crash in Czech, with the technical text below', () => {
  const s = formatSummary(null, new Error('ENOSPC: no space left'));
  assert.match(s, /^## ✗ Zpracování selhalo\n\nAutomatika se zastavila[^\n]*Dej prosím vědět správci webu/);
  assert.match(s, /Technický popis chyby:\n\n`ENOSPC: no space left`/);
});

test('formatSummary of a branch run (prepare only) asks to fill in the new descriptions', () => {
  const s = formatSummary({ ...base, prepared: true, created: ['2026/rano.yaml'], assigned: ['2026/rano: k3f9a'] });
  assert.match(s, /^## ✓ Připraveno k doplnění/);
  assert.match(s, /doplň skutečné hodnoty/);
  assert.match(s, /až po sloučení větve do main/);
  assert.ok(s.includes('2026/rano.yaml'));
  assert.doesNotMatch(s, /Zpracováno:/);
  // problems on a branch look the same as on main
  assert.match(formatSummary({ ...base, prepared: true, ok: false, problems: ['x'] }), /^## ✗ Je potřeba něco opravit[\s\S]*\*\*Obecně\*\*\n\n- x/);
});

test('formatSummary lists files brought in line with the schema', () => {
  const s = formatSummary({ ...base, updated: ['tvorba/rano.yaml: doplněno fler (DOPLNIT)'] });
  assert.match(s, /\*\*Srovnané popisy[^*]*\*\*\n\n- tvorba\/rano\.yaml: doplněno fler \(DOPLNIT\)/);
  assert.doesNotMatch(formatSummary(base), /Srovnané popisy/);
});

test('formatSummary warns about published works that still have DOPLNIT', () => {
  const s = formatSummary({ ...base, pending: ['tvorba/rano.yaml: support, details'] });
  assert.match(s, /### ⚠ Ke kontrole\n\n\*\*Zveřejněné obrazy, kterým zůstal DOPLNIT[^*]*\*\*\n\n- tvorba\/rano\.yaml: support, details/);
  assert.doesNotMatch(formatSummary(base), /zůstal DOPLNIT/);
});

test('formatSummary lists the corners found and the cut previews of drafts; a suspicious cut is also a warning', () => {
  const s = formatSummary({
    ...base, prepared: true,
    detected: ['tvorba/rano.yaml: tl 40×25, tr 30×20, br 35×28, bl 41×22', 'tvorba/vecer.yaml: tl 400×25 ⚠ PODEZŘELÝ ořez'],
    previews: ['rano-k3f9a-backgrounds.jpg'],
  });
  assert.match(s, /\*\*Nalezené rohy listu \(meta_corners[^\n]*\*\*\n\n- tvorba\/rano\.yaml: tl 40×25/);
  assert.match(s, /\*\*Náhledy ořezu rozpracovaných obrazů \(ke stažení jako „nahledy-orezu“[^\n]*\*\*\n\n- rano-k3f9a-backgrounds\.jpg/);
  assert.match(s, /### ⚠ Ke kontrole\n\n\*\*Podezřelý ořez rohů listu[^\n]*\*\*\n\n- tvorba\/vecer\.yaml: tl 400×25 ⚠/);
  assert.ok(s.indexOf('Podezřelý ořez') < s.indexOf('Nalezené rohy'), 'the warning comes first');
  assert.doesNotMatch(formatSummary(base), /rohy listu|Náhledy ořezu/, 'nothing when there is nothing');
});

test('formatSummary lists recommendations by file after the warnings and before what the run did', () => {
  const s = formatSummary({
    ...base,
    pending: ['tvorba/b.yaml: support'], created: ['tvorba/rano.yaml'],
    advice: ['tvorba/a.yaml: nemá štítky (tags)', 'tvorba/c.yaml: title by neměl končit tečkou', 'tvorba/a.yaml: description by měl končit tečkou'],
  });
  assert.match(s, /^## ✓ Zpracováno/, 'recommendations never fail a run');
  assert.match(s, /### 💡 Doporučení \(3\)\n\nNic nebrání zveřejnění[^\n]*\n\n\*\*tvorba\/a\.yaml\*\*\n\n- nemá štítky \(tags\)\n- description by měl končit tečkou\n\n\*\*tvorba\/c\.yaml\*\*\n\n- title by neměl končit tečkou\n/);
  const order = ['### ⚠ Ke kontrole', '### 💡 Doporučení', '### Co automatika udělala'].map((t) => s.indexOf(t));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), order.join(', '));
  assert.doesNotMatch(formatSummary(base), /Doporučení/, 'nothing when there is nothing');
});
