#!/usr/bin/env node
// Health check of the content automation, run weekly by a workflow of the content repository.
// Env: TOKEN (the PAVLA_TOKEN secret), RUNS_TOKEN + REPO (token with actions:read on the content repository and its
// name, e.g. github.token and github.repository), CONTENT_DIR (a checkout of the content repository, optional).
// Exit code 1 when something needs attention; the report goes to stdout, the run page and the step output.

import fs from 'node:fs/promises';
import { findUnknownAttributes } from './lib/content.mjs';
import {
  DRY_RUNS, evaluateDeploy, evaluatePullRequest, evaluateRuns, evaluateToken, evaluateUnknownAttributes, formatReport,
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
    return { ok: false, message: `Nepodařilo se načíst ${label} (${e.message}).` };
  }
};

const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);

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
  return evaluatePullRequest(pulls, { days: arg('--pr-days', 7) });
});

const unknown = process.env.CONTENT_DIR
  ? await guarded('popisy obrazů', async () => evaluateUnknownAttributes(await findUnknownAttributes(process.env.CONTENT_DIR)))
  : evaluateUnknownAttributes(null);

const report = formatReport(token, runs, dryRun, deploy, pr, unknown);
console.log(report.text);
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, report.text);
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `report<<EOF\n${report.text}EOF\n`);
if (!report.ok) process.exitCode = 1;
