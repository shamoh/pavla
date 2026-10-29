#!/usr/bin/env node
// Health check of the content automation, run weekly by a workflow of the content repository.
// Env: TOKEN (the PAVLA_TOKEN secret), RUNS_TOKEN + REPO (token with actions:read on the content repository and its
// name, e.g. github.token and github.repository), CONTENT_DIR (a checkout of the content repository, optional),
// CHECK_TOKEN (optional: a read-only fine-grained token of the owner for both repositories, account permission
// Plan and repository permissions Administration, Environments, Pages, Secrets, Variables, Webhooks: the minutes of
// Actions and the monthly comparison of the settings; BILLING_TOKEN, its former name, is read too),
// SETTINGS_DIR (the stored exports of the settings, <repo name>.json), `--settings` compares them on any day.
// The images and the page texts of the deployed site are checked at site.url of site.config.yaml (`--site-url <url>` overrides it,
// e.g. a locally served build).
// Exit code 1 when something needs attention; the report goes to stdout, the run page and the step output.

import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { collectSettings, compareSnapshots, settingsSnapshot } from './lib/repo-settings.mjs';
import { findUnknownAttributes, findUnknownTechniques, findUntranslatedTags } from './lib/content.mjs';
import { checkSiteImages, evaluateSiteImages } from './lib/site-check.mjs';
import { evaluatePageTexts } from './lib/page-check.mjs';
import {
  DRY_RUNS, evaluateDeploy, evaluateMinutes, evaluatePullRequest, evaluateRuns, evaluateSettings, evaluateSizes, evaluateToken, evaluateUnknownAttributes, evaluateUnknownTechniques, evaluateUntranslatedTags, formatReport,
} from './lib/health.mjs';

const SITE_REPO = 'shamoh/pavla';
const PR_BRANCH = 'obsah/aktualizace';

// shamoh/pavla is public: its data is read without a token, so these checks do not depend on PAVLA_TOKEN.
const api = (path, token) => fetch(`https://api.github.com${path}`, {
  headers: { ...(token && { Authorization: `Bearer ${token}` }), Accept: 'application/vnd.github+json', 'User-Agent': 'pavla-health-check' },
});
const json = async (path, token) => {
  const res = await api(path, token);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};
/** Runs a check; an API failure becomes a failed check with the given Czech label. */
const guarded = async (label, fn) => {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, message: `Nepodařilo se načíst ${label} (${e.message}). [nacteni-selhalo]` };
  }
};

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const textArg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

let token;
if (!process.env.TOKEN) token = evaluateToken({ status: 0 });
else {
  const res = await api('/repos/shamoh/pavla', process.env.TOKEN);
  token = evaluateToken({ status: res.status, expiration: res.headers.get('github-authentication-token-expiration'), warnDays: arg('--days', 14) });
}

const runs = await guarded('běhy „Zpracování obsahu“', async () => {
  const data = await json(`/repos/${process.env.REPO}/actions/workflows/publish.yml/runs?branch=main&per_page=30`, process.env.RUNS_TOKEN);
  return evaluateRuns(data.workflow_runs, { days: arg('--run-days', 7) });
});

// The weekly dry run of the workflow on the test data runs in the public pavla repo (.github/workflows/dry-run.yml).
const dryRun = await guarded('zkušební běhy zpracování', async () => {
  const data = await json(`/repos/${SITE_REPO}/actions/workflows/dry-run.yml/runs?branch=main&per_page=30`);
  return evaluateRuns(data.workflow_runs, { days: arg('--run-days', 7), workflow: DRY_RUNS });
});

const deploy = await guarded('stav nasazení webu', async () => {
  const head = await json(`/repos/${SITE_REPO}/commits/main`);
  const data = await json(`/repos/${SITE_REPO}/actions/workflows/deploy.yml/runs?branch=main&per_page=30`);
  return evaluateDeploy({ sha: head.sha, date: head.commit.committer.date }, data.workflow_runs);
});

const pr = await guarded('pull requesty webu', async () => {
  const owner = SITE_REPO.split('/')[0];
  const pulls = await json(`/repos/${SITE_REPO}/pulls?state=open&head=${owner}:${encodeURIComponent(PR_BRANCH)}`);
  return evaluatePullRequest(pulls, { days: arg('--pr-days', 1) });
});

const unknown = process.env.CONTENT_DIR
  ? await guarded('popisy obrazů', async () => evaluateUnknownAttributes(await findUnknownAttributes(process.env.CONTENT_DIR)))
  : evaluateUnknownAttributes(null);
const techniques = process.env.CONTENT_DIR
  ? await guarded('techniky obrazů', async () => evaluateUnknownTechniques(await findUnknownTechniques(process.env.CONTENT_DIR)))
  : evaluateUnknownTechniques(null);
const config = YAML.parse(await fs.readFile(new URL('../site.config.yaml', import.meta.url), 'utf8'));
// every work, also those not on Instagram or Pinterest yet: the translation is there before it goes there
const translations = process.env.CONTENT_DIR
  ? await guarded('překlady štítků', async () => evaluateUntranslatedTags(await findUntranslatedTags(process.env.CONTENT_DIR, {
    Instagram: config.instagramPost?.en, Pinterest: config.pinterestKeywords?.en,
  })))
  : evaluateUntranslatedTags(null);

// Every image the pages of the deployed site refer to exists (a deploy without images, a pipeline that removed some).
let site = null;
const siteImages = await guarded('obrázky webu', async () => {
  // a failed image is asked again twice, 3 s apart: one hiccup of GitHub Pages is no missing image
  site = await checkSiteImages(textArg('--site-url') ?? config.site.url, fetch, { retries: 2, retryDelayMs: 3000 });
  return evaluateSiteImages(site);
});
// The same pages have their own titles and descriptions and valid structured data (as npm run check:images checks
// a build); not checked when the site could not be read.
const pageTexts = evaluatePageTexts(site?.html ?? null);

// Sizes against the limits of GitHub: `size` of a repository is in KiB (its whole history), the deployed site is its
// last Pages artifact (packed, the images inside barely shrink). A size that cannot be read is only listed as such.
const sizes = await guarded('velikosti rep a webu', async () => {
  const repoBytes = async (repo, auth) => (await json(`/repos/${repo}`, auth).catch(() => null))?.size * 1024 || null;
  const pagesBytes = async () => (await json(`/repos/${SITE_REPO}/actions/artifacts?name=github-pages&per_page=1`)
    .catch(() => null))?.artifacts?.[0]?.size_in_bytes ?? null;
  return evaluateSizes({
    site: await repoBytes(SITE_REPO), content: process.env.REPO ? await repoBytes(process.env.REPO, process.env.RUNS_TOKEN) : null, pages: await pagesBytes(),
  });
});

// Minutes of GitHub Actions of this month (the billing usage report of the owner's account): only private repositories
// use the free minutes; a repository its public page does not show is private.
const checkToken = process.env.CHECK_TOKEN || process.env.BILLING_TOKEN;
const minutes = checkToken
  ? await guarded('minuty GitHub Actions', async () => {
    const owner = SITE_REPO.split('/')[0];
    const now = new Date();
    const data = await json(`/users/${owner}/settings/billing/usage?year=${now.getUTCFullYear()}&month=${now.getUTCMonth() + 1}`, checkToken);
    const items = data.usageItems ?? [];
    const names = [...new Set(items.map((i) => i.repositoryName).filter(Boolean))];
    const hidden = new Set();
    for (const name of names) if ((await api(`/repos/${owner}/${name}`)).status === 404) hidden.add(name);
    return evaluateMinutes(items, (name) => hidden.has(name), { now });
  })
  : evaluateMinutes(null, () => false);

// Monthly (the first Monday: the 1st to the 7th day; `--settings` any day): the settings of both repositories against
// their stored exports (scripts/repo-settings.mjs --out …, SETTINGS_DIR/<repo name>.json).
const monthly = args.includes('--settings') || new Date().getUTCDate() <= 7;
const settings = !monthly ? evaluateSettings(null, { reason: 'jen první pondělí v měsíci' })
  : !checkToken || !process.env.SETTINGS_DIR ? evaluateSettings(null, { reason: 'chybí secret CHECK_TOKEN nebo uložené exporty' })
    : await guarded('nastavení rep', async () => {
      // GET: the JSON, null for 404, {} for 204 (a feature switched on without a body)
      const get = async (p) => {
        const res = await api(p, checkToken);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.status === 204 ? {} : res.json();
      };
      const results = [];
      for (const repo of [SITE_REPO, process.env.REPO].filter(Boolean)) {
        const file = path.join(process.env.SETTINGS_DIR, `${repo.split('/')[1]}.json`);
        const saved = await fs.readFile(file, 'utf8').then(JSON.parse, () => null);
        const now = settingsSnapshot(await collectSettings(repo, get));
        results.push(saved ? { repo, diffs: compareSnapshots(saved, now) } : { repo, noSnapshot: true });
      }
      return evaluateSettings(results);
    });

const report = formatReport(token, runs, dryRun, deploy, pr, unknown, techniques, translations, siteImages, pageTexts, sizes, minutes, settings);
console.log(report.text);
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, report.text);
// codes: "[token-vyprsi] [obrazky-chybi]" for the title of the issue (e-mails filtered by code)
if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(process.env.GITHUB_OUTPUT, `report<<EOF\n${report.text}EOF\ncodes=${report.codes.map((c) => `[${c}]`).join(' ')}\n`);
}
if (!report.ok) process.exitCode = 1;
