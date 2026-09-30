// Weekly health check of the automation around the content repository:
//   - PAVLA_TOKEN (used by the "Zpracování obsahu" workflow) works and does not expire soon,
//   - the latest run of "Zpracování obsahu" did not fail,
//   - the latest weekly dry run of that workflow on the test data ("Zkušební běh zpracování", pavla) did not fail,
//   - the latest commit on pavla/main was deployed,
//   - the content pull request (obsah/aktualizace) does not wait for a merge too long,
//   - no description of the content has an attribute the pipeline does not know (NEZNÁMÝ).
// Pure functions; the GitHub API calls live in scripts/check-health.mjs.
// Messages are Czech: they end up on the run page and in an issue e-mailed to the owner.

const DAY = 24 * 60 * 60 * 1000;

/** Parses "2026-12-31 23:59:59 UTC" (or any Date-parsable value); null when missing or invalid. */
export function parseExpiration(header) {
  if (!header) return null;
  const date = new Date(String(header).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/, '$1T$2Z'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `status`: HTTP status of an API call made with the token; `expiration`: its expiry header. */
export function evaluateToken({ status, expiration, now = new Date(), warnDays = 14 }) {
  if (status === 0) return { ok: false, message: 'Secret PAVLA_TOKEN není nastavený.' };
  if (status === 401) {
    return { ok: false, message: 'Token PAVLA_TOKEN je neplatný nebo už vypršel. Automatické zpracování obsahu nefunguje.' };
  }
  if (status !== 200) {
    return { ok: false, message: `Kontrola tokenu PAVLA_TOKEN selhala (HTTP ${status}). Token možná nemá přístup k repu shamoh/pavla.` };
  }
  const date = parseExpiration(expiration);
  if (!date) return { ok: true, message: 'Token PAVLA_TOKEN funguje a nemá nastavenou dobu platnosti.' };
  const daysLeft = Math.floor((date.getTime() - now.getTime()) / DAY);
  const when = date.toISOString().slice(0, 10);
  if (daysLeft < warnDays) {
    return { ok: false, daysLeft, message: `Token PAVLA_TOKEN vyprší ${when} (za ${Math.max(0, daysLeft)} dní). Je potřeba ho obnovit.` };
  }
  return { ok: true, daysLeft, message: `Token PAVLA_TOKEN funguje, vyprší ${when} (za ${daysLeft} dní).` };
}

const FAILED = new Set(['failure', 'timed_out', 'startup_failure']);

export const CONTENT_RUNS = {
  name: 'Zpracování obsahu',
  never: 'Zpracování obsahu zatím neproběhlo.',
  consequence: 'Na stránce běhu je nahoře napsané proč. Dokud se to neopraví, nové obrazy se na web nedostanou.',
};
export const DRY_RUNS = {
  name: 'Zkušební běh zpracování',
  never: 'Zkušební běh zpracování na testovacích datech zatím neproběhl.',
  consequence: 'Zpracování selhalo na testovacích datech, skutečný obsah by nejspíš selhal stejně. Opravit dřív, než Pavla nahraje nové obrazy.',
};

/**
 * `runs`: workflow runs from the GitHub API (newest first), fields status, conclusion, created_at, html_url.
 * Not ok when the latest finished run failed. Failures within `days` that a later run fixed are only mentioned.
 * `workflow`: texts for the workflow (CONTENT_RUNS by default, DRY_RUNS for the dry run).
 */
export function evaluateRuns(runs, { now = new Date(), days = 7, workflow = CONTENT_RUNS } = {}) {
  const finished = runs.filter((r) => r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
  if (!finished.length) return { ok: true, message: workflow.never };
  const latest = finished[0];
  if (FAILED.has(latest.conclusion)) {
    return {
      ok: false,
      message: `Poslední běh „${workflow.name}“ (${day(latest.created_at)}) selhal: ${latest.html_url}\n${workflow.consequence}`,
    };
  }
  const since = now.getTime() - days * DAY;
  const recentFailures = finished.filter((r) => FAILED.has(r.conclusion) && new Date(r.created_at).getTime() >= since);
  const tail = recentFailures.length ? ` Za posledních ${days} dní selhalo ${recentFailures.length}×, ale pozdější běh už prošel.` : '';
  return { ok: true, message: `Poslední běh „${workflow.name}“ (${day(latest.created_at)}) prošel.${tail}` };
}

const day = (iso) => String(iso).slice(0, 10);

/**
 * `commit`: latest commit on pavla/main ({ sha, date }); `runs`: runs of deploy.yml on main (newest first).
 * Fine when that commit has a successful or still running deploy, or is younger than `graceHours`.
 */
export function evaluateDeploy(commit, runs, { now = new Date(), graceHours = 1 } = {}) {
  const short = commit.sha.slice(0, 7);
  const forCommit = runs.filter((r) => r.head_sha === commit.sha);
  const latest = forCommit[0];
  if (latest?.status === 'completed' && latest.conclusion === 'success') {
    return { ok: true, message: `Web je nasazený z posledního commitu ${short} (${day(latest.created_at)}).` };
  }
  if (latest && latest.status !== 'completed') return { ok: true, message: `Nasazení commitu ${short} právě probíhá.` };
  if (latest && FAILED.has(latest.conclusion)) {
    return { ok: false, message: `Nasazení webu z commitu ${short} selhalo: ${latest.html_url}
Web ukazuje starší verzi.` };
  }
  if (now.getTime() - new Date(commit.date).getTime() < graceHours * 60 * 60 * 1000) {
    return { ok: true, message: `Commit ${short} je čerstvý, nasazení se teprve spustí.` };
  }
  return { ok: false, message: `Poslední commit ${short} (${day(commit.date)}) se na web nenasadil, žádný úspěšný běh deploye pro něj není.` };
}

/** `pulls`: open pull requests from the obsah/aktualizace branch. Not ok when one is open longer than `days`. */
export function evaluatePullRequest(pulls, { now = new Date(), days = 7 } = {}) {
  const pr = pulls[0];
  if (!pr) return { ok: true, message: 'Žádná aktualizace obsahu nečeká na sloučení.' };
  const age = Math.floor((now.getTime() - new Date(pr.created_at).getTime()) / DAY);
  if (age > days) {
    return { ok: false, message: `Aktualizace obsahu čeká na sloučení už ${age} dní: ${pr.html_url}
Nové obrazy nejsou na webu, dokud ji nesloučíš.` };
  }
  return { ok: true, message: `Aktualizace obsahu čeká na sloučení ${age} dní: ${pr.html_url}` };
}

/**
 * `found`: ["<file>: <keys>"] from findUnknownAttributes, or null when the content was not available to check.
 * Not ok when a description has an attribute the pipeline does not know (a typo is silently ignored otherwise).
 */
export function evaluateUnknownAttributes(found) {
  if (found === null) return { ok: true, message: 'Popisy obrazů nebyly zkontrolovány (obsah není k dispozici).' };
  if (!found.length) return { ok: true, message: 'Žádný popis nemá neznámý atribut.' };
  return {
    ok: false,
    message: `Popisy s neznámým atributem (označené NEZNÁMÝ, nejspíš překlep; web ho nepoužije):\n`
      + found.map((f) => `- ${f}`).join('\n')
      + '\nOprav jeho název, nebo řádek smaž.',
  };
}

export const RENEW_TOKEN = [
  'Jak token obnovit:',
  '',
  '1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens,',
  '   u tokenu pro shamoh/pavla zvol Regenerate token (nebo vytvoř nový se stejnými oprávněními:',
  '   Contents a Pull requests, Read and write).',
  '2. Obsahové repo (to, ve kterém je tato kontrola) → Settings → Secrets and variables → Actions → PAVLA_TOKEN → Update, vlož nový token.',
  '3. Actions → Kontrola automatiky → Run workflow, ať se ověří, že je vše v pořádku.',
].join('\n');

/** Markdown report for the run page and the issue. `token` is the first check; renew steps follow when it fails. */
export function formatReport(token, ...checks) {
  const all = [token, ...checks];
  const ok = all.every((c) => c.ok);
  const lines = [
    `## ${ok ? '✓ Automatika je v pořádku' : '✗ Automatika potřebuje pozornost'}`,
    '',
    ...all.map((c) => `- ${c.ok ? '✓' : '✗'} ${c.message.replace(/\n/g, '\n  ')}`),
  ];
  if (!token.ok) lines.push('', RENEW_TOKEN);
  return { ok, text: lines.join('\n') + '\n' };
}
