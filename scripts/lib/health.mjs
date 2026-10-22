// Weekly health check of the automation around the content repository:
//   - PAVLA_TOKEN (used by the "Zpracování obsahu" workflow) works and does not expire soon,
//   - the latest run of "Zpracování obsahu" did not fail,
//   - the latest weekly dry run of that workflow on the test data ("Zkušební běh zpracování", pavla) did not fail,
//   - the latest commit on pavla/main was deployed,
//   - the content pull request (obsah/aktualizace) does not wait for a merge too long,
//   - no description of the content has an attribute the pipeline does not know (NEZNÁMÝ),
//   - every image the pages of the deployed site refer to exists (scripts/lib/site-check.mjs).
// Pure functions; the GitHub API calls live in scripts/check-health.mjs.
// Messages are Czech: they end up on the run page and in an issue e-mailed to the owner. A failed check ends the first
// line of its message with its code (scripts/lib/codes.mjs, level health), like the messages of a pipeline run.

import { codesOf } from './codes.mjs';

const DAY = 24 * 60 * 60 * 1000;

/** Parses "2026-12-31 23:59:59 UTC" (or any Date-parsable value); null when missing or invalid. */
export function parseExpiration(header) {
  if (!header) return null;
  const date = new Date(String(header).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/, '$1T$2Z'));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `status`: HTTP status of an API call made with the token; `expiration`: its expiry header. */
export function evaluateToken({ status, expiration, now = new Date(), warnDays = 14 }) {
  if (status === 0) return { ok: false, message: 'Secret PAVLA_TOKEN není nastavený. [token-chybi]' };
  if (status === 401) {
    return { ok: false, message: 'Token PAVLA_TOKEN je neplatný nebo už vypršel. Automatické zpracování obsahu nefunguje. [token-neplatny]' };
  }
  if (status !== 200) {
    return { ok: false, message: `Kontrola tokenu PAVLA_TOKEN selhala (HTTP ${status}). Token možná nemá přístup k repu shamoh/pavla. [token-nedostupny]` };
  }
  const date = parseExpiration(expiration);
  if (!date) return { ok: true, message: 'Token PAVLA_TOKEN funguje a nemá nastavenou dobu platnosti.' };
  const daysLeft = Math.floor((date.getTime() - now.getTime()) / DAY);
  const when = date.toISOString().slice(0, 10);
  if (daysLeft < warnDays) {
    return { ok: false, daysLeft, message: `Token PAVLA_TOKEN vyprší ${when} (za ${Math.max(0, daysLeft)} dní). Je potřeba ho obnovit. [token-vyprsi]` };
  }
  return { ok: true, daysLeft, message: `Token PAVLA_TOKEN funguje, vyprší ${when} (za ${daysLeft} dní).` };
}

const FAILED = new Set(['failure', 'timed_out', 'startup_failure']);

export const CONTENT_RUNS = {
  name: 'Zpracování obsahu',
  code: 'beh-selhal',
  never: 'Zpracování obsahu zatím neproběhlo.',
  consequence: 'Na stránce běhu je nahoře napsané proč. Dokud se to neopraví, nové obrazy se na web nedostanou.',
};
export const DRY_RUNS = {
  name: 'Zkušební běh zpracování',
  code: 'zkusebni-beh-selhal',
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
      message: `Poslední běh „${workflow.name}“ (${day(latest.created_at)}) selhal: ${latest.html_url} [${workflow.code}]\n${workflow.consequence}`,
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
    return { ok: false, message: `Nasazení webu z commitu ${short} selhalo: ${latest.html_url} [nasazeni-selhalo]
Web ukazuje starší verzi.` };
  }
  if (now.getTime() - new Date(commit.date).getTime() < graceHours * 60 * 60 * 1000) {
    return { ok: true, message: `Commit ${short} je čerstvý, nasazení se teprve spustí.` };
  }
  return { ok: false, message: `Poslední commit ${short} (${day(commit.date)}) se na web nenasadil, žádný úspěšný běh deploye pro něj není. [nasazeni-chybi]` };
}

/**
 * `pulls`: open pull requests from the obsah/aktualizace branch. They merge themselves (auto-merge) once
 * "Kontrola kódu" passes, so one open longer than `days` is stuck. Not ok then.
 */
export function evaluatePullRequest(pulls, { now = new Date(), days = 1 } = {}) {
  const pr = pulls[0];
  if (!pr) return { ok: true, message: 'Žádná aktualizace obsahu nečeká na sloučení.' };
  const age = Math.floor((now.getTime() - new Date(pr.created_at).getTime()) / DAY);
  if (age > days) {
    return { ok: false, message: `Aktualizace obsahu se nesloučila sama ani za ${age} dní: ${pr.html_url} [aktualizace-ceka]
Nejspíš neprošla „Kontrola kódu“ (červený křížek v pull requestu) nebo auto-merge není zapnutý.
Nové obrazy nejsou na webu, dokud se nesloučí.` };
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
    message: `Popisy s neznámým atributem (označené NEZNÁMÝ, nejspíš překlep; web ho nepoužije): [neznamy-atribut]\n`
      + found.map((f) => `- ${f}`).join('\n')
      + '\nOprav jeho název, nebo řádek smaž.',
  };
}

/**
 * `found`: ["<technique>: <files>"] from findUnknownTechniques, or null when the content was not available to check.
 * Not ok when a work has a technique without an art form for search engines (a new technique needs a rule).
 */
export function evaluateUnknownTechniques(found) {
  if (found === null) return { ok: true, message: 'Techniky obrazů nebyly zkontrolovány (obsah není k dispozici).' };
  if (!found.length) return { ok: true, message: 'Každá technika má druh díla pro vyhledávače.' };
  return {
    ok: false,
    message: `Nová technika bez druhu díla (vyhledávače nepoznají, jestli je to malba, kresba, nebo grafika): [nova-technika]\n`
      + found.map((f) => `- ${f}`).join('\n')
      + '\nDoplň pravidlo do ARTFORMS v scripts/lib/seo.mjs (repo pavla), nebo oprav překlep v technice.',
  };
}

/**
 * `found`: ["„<word>“ (<platforms>): <files>"] from findUntranslatedTags, or null when the content was not available.
 * Not ok when a technique or a tag of any work has no English word for Instagram or Pinterest: added before the work
 * goes there, the post and the pin have it in English from the start.
 */
export function evaluateUntranslatedTags(found) {
  if (found === null) return { ok: true, message: 'Překlady štítků nebyly zkontrolovány (obsah není k dispozici).' };
  if (!found.length) return { ok: true, message: 'Každý štítek a technika má anglický překlad pro Instagram i Pinterest.' };
  return {
    ok: false,
    message: `Štítky nebo techniky bez anglického překladu pro Instagram a Pinterest: [preklad-chybi]\n`
      + found.map((f) => `- ${f}`).join('\n')
      + '\nDoplň překlad do site.config.yaml (repo pavla): instagramPost.en (hashtag bez mezer) a pinterestKeywords.en (slova s mezerami).',
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

/**
 * Markdown report for the run page and the issue. `token` is the first check; renew steps follow when it fails.
 * `codes`: the codes of the failed checks (and of the problems they list), each once in order, for the title of the
 * issue ("Automatika webu potřebuje pozornost [token-vyprsi] [obrazky-chybi]"), so e-mails can be filtered by them.
 */
export function formatReport(token, ...checks) {
  const all = [token, ...checks];
  const ok = all.every((c) => c.ok);
  const codes = [...new Set(all.filter((c) => !c.ok).flatMap((c) => codesOf(c.message)))];
  const lines = [
    `## ${ok ? '✓ Automatika je v pořádku' : '✗ Automatika potřebuje pozornost'}`,
    '',
    ...all.map((c) => `- ${c.ok ? '✓' : '✗'} ${c.message.replace(/\n/g, '\n  ')}`),
  ];
  if (!token.ok) lines.push('', RENEW_TOKEN);
  return { ok, codes, text: lines.join('\n') + '\n' };
}
