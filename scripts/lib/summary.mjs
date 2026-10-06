// Markdown summary of a pipeline run, shown on the GitHub Actions run page ($GITHUB_STEP_SUMMARY).
// Headings are Czech because Pavla reads them; the individual messages come from the pipeline.

export function formatSummary(result, error) {
  const lines = [];
  if (error) {
    lines.push('## ✗ Zpracování selhalo', '', `\`${error.message}\``);
    return lines.join('\n') + '\n';
  }
  const ok = result.ok;
  // prepared: a run on a branch (--prepare-only), which only adds descriptions and checks them.
  lines.push(ok ? (result.prepared ? '## ✓ Připraveno k doplnění' : '## ✓ Zpracováno') : '## ✗ Je potřeba něco opravit', '');
  if (result.prepared && ok) {
    lines.push('Ve větvi jsou doplněné popisy (yaml) a kódy obrazů. Stáhni si je, doplň skutečné hodnoty a nahraj zpět do větve.', 'Fotky pro web, Instagram a Fler vzniknou až po sloučení větve do main.', '');
  }
  if (result.problems.length) {
    lines.push('Nic nebylo zveřejněno. Oprav prosím tyto soubory a nahraj je znovu:', '');
    result.problems.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }
  if (result.missing.length) {
    lines.push('Chybí fotka k popisu:', '');
    result.missing.forEach((m) => lines.push(`- ${m}`));
    lines.push('');
  }
  const section = (title, items) => {
    if (!items.length) return;
    lines.push(`**${title}**`, '');
    items.forEach((i) => lines.push(`- ${i}`));
    lines.push('');
  };
  section('Nové popisy k doplnění (doplň hodnoty s DOPLNIT, u obrazu pak meta_draft: false)', result.created);
  section('Přidělené kódy obrazů', result.assigned);
  section('Nalezené rohy listu (meta_corners; podlaha vně nich bude průhledná, hodnoty smíš upravit; ⚠ = podezřelý ořez, zkontroluj nejdřív)', result.detected ?? []);
  section('Náhledy ořezu rozpracovaných obrazů (ke stažení jako „nahledy-orezu“ dole na stránce tohoto běhu)', result.previews ?? []);
  section('Srovnané popisy (nové atributy mají u komentáře DOPLNIT, neznámé NEZNÁMÝ)', result.updated ?? []);
  section('Zveřejněné obrazy, kterým zůstal DOPLNIT (hodnotu zkontroluj, pak slovo DOPLNIT smaž)', result.pending ?? []);
  section('Odstraněno (web a exporty smazaných či přejmenovaných děl)', result.pruned);
  if (!result.prepared) lines.push(`Zpracováno: ${result.processed}, beze změny: ${result.skipped}.`);
  return lines.join('\n') + '\n';
}
