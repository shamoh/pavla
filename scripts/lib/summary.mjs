// Markdown summary of a pipeline run, shown on the GitHub Actions run page ($GITHUB_STEP_SUMMARY).
// Everything is Czech because Pavla reads it. Errors come first (grouped by file), then warnings, then
// recommendations (grouped by file, scripts/lib/advice.mjs), then what the run did, so whatever needs fixing is
// visible without scrolling.

/** Problems ("<file>: <message>") grouped by file in order of appearance: [{ file, messages }]; file '' = general. */
export function groupProblems(problems) {
  const groups = new Map();
  for (const p of problems) {
    const at = p.indexOf(': ');
    const [file, message] = at > 0 ? [p.slice(0, at), p.slice(at + 2)] : ['', p];
    if (!groups.has(file)) groups.set(file, []);
    groups.get(file).push(message);
  }
  return [...groups].map(([file, messages]) => ({ file, messages }));
}

const SUSPICIOUS = '⚠';

export function formatSummary(result, error) {
  const lines = [];
  const list = (items) => {
    items.forEach((i) => lines.push(`- ${i}`));
    lines.push('');
  };
  if (error) {
    lines.push(
      '## ✗ Zpracování selhalo', '',
      'Automatika se zastavila na chybě, kterou nejde opravit v popisech. Nic nebylo zveřejněno. Dej prosím vědět správci webu.', '',
      'Technický popis chyby:', '', `\`${error.message}\``,
    );
    return lines.join('\n') + '\n';
  }
  const ok = result.ok;
  // prepared: a run on a branch (--prepare-only), which only adds descriptions and checks them.
  lines.push(ok ? (result.prepared ? '## ✓ Připraveno k doplnění' : '## ✓ Zpracováno') : '## ✗ Je potřeba něco opravit', '');
  if (result.problems.length) lines.push('Nic nebylo zveřejněno. Oprav prosím chyby níže a nahraj soubory znovu.', '');
  else if (!ok) lines.push('Ostatní obrazy se zpracovaly, ale některým chybí fotka (viz níže).', '');
  else if (result.prepared) {
    lines.push('Ve větvi jsou doplněné popisy (yaml) a kódy obrazů. Stáhni si je, doplň skutečné hodnoty a nahraj zpět do větve.', 'Fotky pro web, Instagram a Fler vzniknou až po sloučení větve do main.', '');
  }

  // 1. errors: they fail the run
  const errors = result.problems.length + result.missing.length;
  if (errors) {
    lines.push(`### ✗ Chyby (${errors})`, '');
    for (const { file, messages } of groupProblems(result.problems)) {
      lines.push(file ? `**${file}**` : '**Obecně**', '');
      list(messages);
    }
    if (result.missing.length) {
      lines.push('**Chybí fotka obrazu** (popis je, ale fotka ani hotové obrázky webu ne; nahraj fotku vedle popisu)', '');
      list(result.missing);
    }
  }

  // 2. warnings: nothing stops, but someone should look
  const suspicious = (result.detected ?? []).filter((d) => d.includes(SUSPICIOUS));
  const warnings = [
    ['Zveřejněné obrazy, kterým zůstal DOPLNIT (hodnotu zkontroluj, pak slovo DOPLNIT smaž)', result.pending ?? []],
    ['Podezřelý ořez rohů listu (zkontroluj v náhledu ořezu)', suspicious],
  ].filter(([, items]) => items.length);
  if (warnings.length) {
    lines.push('### ⚠ Ke kontrole', '');
    for (const [title, items] of warnings) {
      lines.push(`**${title}**`, '');
      list(items);
    }
  }

  // 3. recommendations: nothing is wrong, the site would only be better
  const advice = result.advice ?? [];
  if (advice.length) {
    lines.push(`### 💡 Doporučení (${advice.length})`, '', 'Nic nebrání zveřejnění, jen by to web vylepšilo.', '');
    for (const { file, messages } of groupProblems(advice)) {
      lines.push(file ? `**${file}**` : '**Obecně**', '');
      list(messages);
    }
  }

  // 4. what the run did
  const done = [
    ['Nové popisy k doplnění (doplň hodnoty s DOPLNIT, u obrazu pak meta_draft: false)', result.created],
    ['Přidělené kódy obrazů', result.assigned],
    ['Nalezené rohy listu (meta_corners; podlaha vně nich bude průhledná, hodnoty smíš upravit; ⚠ = podezřelý ořez)', result.detected ?? []],
    ['Náhledy ořezu rozpracovaných obrazů (ke stažení jako „nahledy-orezu“ dole na stránce tohoto běhu)', result.previews ?? []],
    ['Srovnané popisy (nové údaje mají u komentáře DOPLNIT, neznámé NEZNÁMÝ)', result.updated ?? []],
    ['Odstraněno (web a exporty smazaných či přejmenovaných obrazů)', result.pruned],
  ].filter(([, items]) => items.length);
  if (done.length || !result.prepared) lines.push('### Co automatika udělala', '');
  for (const [title, items] of done) {
    lines.push(`**${title}**`, '');
    list(items);
  }
  if (!result.prepared) lines.push(`Zpracováno: ${result.processed}, beze změny: ${result.skipped}.`);
  return lines.join('\n').replace(/\n+$/, '') + '\n';
}
