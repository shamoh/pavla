import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary, groupProblems, workNotes } from './summary.mjs';

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
  assert.match(s, /\*\*Nalezené rohy obrazu \(meta_corners[^\n]*\*\*\n\n- tvorba\/rano\.yaml: tl 40×25/);
  assert.match(s, /\*\*Náhledy ořezu rozpracovaných obrazů \(zmenšené v export\/draft\/\)\*\*\n\n- rano-k3f9a-backgrounds\.jpg/);
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

test('tag statistics last, one line, only when there are tags', () => {
  const s = formatSummary({ ...base, processed: 2, skipped: 5, tags: [{ tag: 'krajina', count: 9 }, { tag: 'voda', count: 3 }] });
  assert.match(s, /Zpracováno: 2, beze změny: 5\.\n\n### Štítky \(2\)\n\n.*\n\nkrajina 9 · voda 3\n$/);
  assert.doesNotMatch(formatSummary(base), /### Štítky/);
  assert.match(formatSummary({ ...base, prepared: true, tags: [{ tag: 'les', count: 1 }] }), /### Štítky \(1\)[\s\S]*les 1\n$/);
});

test('formatSummary lists works that do not fit a studio scene under "Ke kontrole"', () => {
  const s = formatSummary({ ...base, misfits: ['tvorba/velky.yaml: obraz se na „Stůl“ nevejde mimo rekvizity'] });
  assert.match(s, /### ⚠ Ke kontrole\n\n\*\*Obraz se nevejde do scény ateliéru pro Instagram\*\*\n\n- tvorba\/velky\.yaml: obraz se na „Stůl“ nevejde/);
});

test('formatSummary: what is left to fill in (DOPLNIT) as a folded block of its own after the recommendations', () => {
  const s = formatSummary({
    ...base, advice: ['tvorba/rano.yaml: název končí tečkou'],
    todo: ['tvorba/rano.yaml: title, description', 'roky/2026.yaml: description'],
  });
  assert.ok(s.indexOf('### 💡 Doporučení (1)') < s.indexOf('### ✎ Zbývá doplnit (2)'), 'after the recommendations, counted apart');
  assert.ok(s.indexOf('### ✎ Zbývá doplnit') < s.indexOf('### Co automatika udělala'));
  assert.match(s, /<details><summary>[^<]+<\/summary>\n\n- \*\*tvorba\/rano\.yaml\*\*: title, description\n- \*\*roky\/2026\.yaml\*\*: description\n\n<\/details>/);
  assert.ok(!formatSummary(base).includes('Zbývá doplnit'), 'nothing to fill in, no block');
});

test('formatSummary lists commented-out attributes the pipeline ignores under "Ke kontrole"', () => {
  const s = formatSummary({ ...base, commentedOut: ['tvorba/rano.yaml: řádek „# id: TODO“ je zakomentovaný údaj id'] });
  assert.match(s, /### ⚠ Ke kontrole\n\n\*\*Zakomentované údaje, které automatika nečte[^*]*\*\*\n\n- tvorba\/rano\.yaml: řádek „# id: TODO“/);
  assert.doesNotMatch(formatSummary({ ...base, commentedOut: [] }), /Ke kontrole/);
});

test('workNotes: what the summary says about one file, in its groups, without the file name', () => {
  const f = 'tvorba/rano.yaml';
  const notes = workNotes(f, {
    problems: [`${f}: status: neznámá hodnota`, 'tvorba/jine.yaml: chyba', 'obecná chyba'],
    pending: [`${f}: title`],
    detected: [`${f}: tl 10×10 ⚠ PODEZŘELÝ ořez`, 'tvorba/jine.yaml: tl 1×1'],
    commentedOut: [`${f}: řádek „# id: TODO“ …`],
    advice: [`${f}: obraz nemá štítky`],
    todo: [`${f}: date, technique`],
  });
  assert.deepEqual(notes, {
    errors: ['status: neznámá hodnota'],
    review: ['title', 'tl 10×10 ⚠ PODEZŘELÝ ořez', 'řádek „# id: TODO“ …'],
    advice: ['obraz nemá štítky'],
    todo: ['date', 'technique'],
  });
  assert.deepEqual(workNotes(f, {}), { errors: [], review: [], advice: [], todo: [] });
});

test('formatSummary with links: file names link to their file, at the line of the message when it can be told', () => {
  const link = (file, message = '') => {
    if (!file.endsWith('.yaml')) return null;
    const line = /^date\b/.test(message) ? 7 : /řádek (\d+)/.exec(message)?.[1];
    return `https://x/blob/b/${file}${line ? `#L${line}` : ''}`;
  };
  const s = formatSummary({
    ...base, ok: false,
    problems: ['tvorba/a.yaml: date musí být den', 'tvorba/b.yaml: date musí být den', 'tvorba/b.yaml: nemá cenu', 'obecná chyba'],
    pending: ['tvorba/c.yaml: size_cm'],
    advice: ['tvorba/d.yaml: nemá štítky (tags)', 'Technika „x“ (2 díla) má 20 znaků'],
    todo: ['tvorba/e.yaml: date, technique'],
    created: ['roky/2019.yaml'],
    updated: ['tvorba/f.yaml: srovnány komentáře a pořadí'],
  }, null, { link });
  // one message: the file at its line; more: the file, each message with its own line when it has one
  assert.ok(s.includes('**[tvorba/a.yaml](https://x/blob/b/tvorba/a.yaml#L7)**\n\n- date musí být den\n'), s);
  assert.ok(s.includes('**[tvorba/b.yaml](https://x/blob/b/tvorba/b.yaml)**\n\n- date musí být den ([řádek 7](https://x/blob/b/tvorba/b.yaml#L7))\n- nemá cenu\n'));
  assert.ok(s.includes('**Obecně**\n\n- obecná chyba\n'));
  assert.ok(s.includes('- [tvorba/c.yaml](https://x/blob/b/tvorba/c.yaml): size_cm'), 'Ke kontrole');
  assert.ok(s.includes('**[tvorba/d.yaml](https://x/blob/b/tvorba/d.yaml)**') && s.includes('**Obecně**\n\n- Technika „x“'), 'Doporučení');
  assert.ok(s.includes('- **[tvorba/e.yaml](https://x/blob/b/tvorba/e.yaml#L7)**: date, technique'), 'Zbývá doplnit: at the first attribute');
  assert.ok(s.includes('- [roky/2019.yaml](https://x/blob/b/roky/2019.yaml)\n') && s.includes('- [tvorba/f.yaml](https://x/blob/b/tvorba/f.yaml): srovnány'), 'Co automatika udělala');
  // without links the names stay plain text
  assert.ok(!formatSummary({ ...base, ok: false, problems: ['tvorba/a.yaml: date musí být den'] }).includes(']('));
});

