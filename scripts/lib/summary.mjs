// Markdown summary of a pipeline run, shown on the GitHub Actions run page ($GITHUB_STEP_SUMMARY).
// Headings are Czech because Pavla reads them; the individual messages come from the pipeline.

export function formatSummary(result, error) {
  const lines = [];
  if (error) {
    lines.push('## ✗ Zpracování selhalo', '', `\`${error.message}\``);
    return lines.join('\n') + '\n';
  }
  const ok = result.ok;
  lines.push(ok ? '## ✓ Zpracováno' : '## ✗ Je potřeba něco opravit', '');
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
  section('Nové popisy k doplnění (smaž v nich řádek draft: true, až budou hotové)', result.created);
  section('Přidělené kódy obrazů', result.assigned);
  section('Odstraněno (web a exporty smazaných či přejmenovaných děl)', result.pruned);
  lines.push(`Zpracováno: ${result.processed}, beze změny: ${result.skipped}.`);
  return lines.join('\n') + '\n';
}
