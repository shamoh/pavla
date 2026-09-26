import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDeploy, evaluatePullRequest, evaluateRuns, evaluateToken, formatReport, parseExpiration } from './health.mjs';

const now = new Date('2026-09-27T10:00:00Z');
const run = (conclusion, created_at, status = 'completed') => ({ status, conclusion, created_at, html_url: `https://example.test/${created_at}` });

test('parseExpiration reads the GitHub header format', () => {
  assert.equal(parseExpiration('2026-12-31 23:59:59 UTC').toISOString(), '2026-12-31T23:59:59.000Z');
  assert.equal(parseExpiration(null), null);
  assert.equal(parseExpiration('nonsense'), null);
});

test('token: far from expiry is fine', () => {
  const r = evaluateToken({ status: 200, expiration: '2026-12-31 23:59:59 UTC', now });
  assert.equal(r.ok, true);
  assert.match(r.message, /vyprší 2026-12-31 \(za 95 dní\)/);
});

test('token: expiring within the window fails, the boundary is exclusive', () => {
  assert.equal(evaluateToken({ status: 200, expiration: '2026-10-05 00:00:00 UTC', now }).ok, false);
  const exactly14 = '2026-10-11 10:00:00 UTC';
  assert.equal(evaluateToken({ status: 200, expiration: exactly14, now }).ok, true);
  assert.equal(evaluateToken({ status: 200, expiration: exactly14, now, warnDays: 15 }).ok, false);
});

test('token: expired, invalid, missing or without access fails; no expiry is fine', () => {
  assert.match(evaluateToken({ status: 200, expiration: '2026-09-01 00:00:00 UTC', now }).message, /za 0 dní/);
  assert.equal(evaluateToken({ status: 401 }).ok, false);
  assert.match(evaluateToken({ status: 0 }).message, /není nastavený/);
  assert.match(evaluateToken({ status: 404 }).message, /HTTP 404/);
  assert.equal(evaluateToken({ status: 200, expiration: null }).ok, true);
});

test('runs: the latest finished run failed', () => {
  const r = evaluateRuns([run('failure', '2026-09-26T08:00:00Z'), run('success', '2026-09-20T08:00:00Z')], { now });
  assert.equal(r.ok, false);
  assert.match(r.message, /2026-09-26\) selhal: https:\/\/example\.test/);
});

test('runs: an old failure that was never fixed is still reported', () => {
  assert.equal(evaluateRuns([run('failure', '2026-06-01T08:00:00Z')], { now }).ok, false);
});

test('runs: a failure fixed by a later run is only mentioned', () => {
  const r = evaluateRuns([run('success', '2026-09-26T09:00:00Z'), run('failure', '2026-09-26T08:00:00Z'), run('failure', '2026-09-01T08:00:00Z')], { now });
  assert.equal(r.ok, true);
  assert.match(r.message, /selhalo 1×, ale pozdější běh už prošel/);
});

test('runs: in-progress and cancelled runs are ignored; no runs at all is fine', () => {
  const r = evaluateRuns([run(null, '2026-09-27T09:00:00Z', 'in_progress'), run('cancelled', '2026-09-27T08:00:00Z'), run('failure', '2026-09-26T08:00:00Z')], { now });
  assert.equal(r.ok, false);
  assert.equal(evaluateRuns([], { now }).ok, true);
});

test('runs: timed out and startup failures count as failures', () => {
  assert.equal(evaluateRuns([run('timed_out', '2026-09-26T08:00:00Z')], { now }).ok, false);
  assert.equal(evaluateRuns([run('startup_failure', '2026-09-26T08:00:00Z')], { now }).ok, false);
});

test('formatReport combines both checks and adds renew steps only for a token problem', () => {
  const good = { ok: true, message: 'token ok' };
  const bad = { ok: false, message: 'token bad' };
  const runsOk = { ok: true, message: 'runs ok' };
  const runsBad = { ok: false, message: 'runs bad\nsecond line' };
  assert.equal(formatReport(good, runsOk).ok, true);
  assert.match(formatReport(good, runsOk).text, /^## ✓ Automatika je v pořádku/);
  const r1 = formatReport(good, runsBad);
  assert.equal(r1.ok, false);
  assert.match(r1.text, /- ✗ runs bad\n {2}second line/);
  assert.doesNotMatch(r1.text, /Jak token obnovit/);
  assert.match(formatReport(bad, runsOk).text, /Jak token obnovit/);
});

const commit = { sha: 'abc1234def', date: '2026-09-26T08:00:00Z' };
const deployRun = (head_sha, conclusion, status = 'completed') => ({ head_sha, conclusion, status, created_at: '2026-09-26T08:01:00Z', html_url: 'https://example.test/deploy' });

test('deploy: the latest commit deployed successfully', () => {
  const r = evaluateDeploy(commit, [deployRun('abc1234def', 'success'), deployRun('old', 'failure')], { now });
  assert.equal(r.ok, true);
  assert.match(r.message, /abc1234/);
});

test('deploy: a failed deploy of the latest commit is reported, an older failure is not', () => {
  assert.equal(evaluateDeploy(commit, [deployRun('abc1234def', 'failure')], { now }).ok, false);
  assert.equal(evaluateDeploy(commit, [deployRun('abc1234def', 'success'), deployRun('abc1234def', 'failure')], { now }).ok, true);
});

test('deploy: running or fresh is fine, missing deploy of an older commit is not', () => {
  assert.equal(evaluateDeploy(commit, [deployRun('abc1234def', null, 'in_progress')], { now }).ok, true);
  assert.equal(evaluateDeploy({ ...commit, date: '2026-09-27T09:30:00Z' }, [], { now }).ok, true);
  const r = evaluateDeploy(commit, [deployRun('other', 'success')], { now });
  assert.equal(r.ok, false);
  assert.match(r.message, /se na web nenasadil/);
});

test('pull request: none open, waiting shortly, waiting too long', () => {
  assert.equal(evaluatePullRequest([], { now }).ok, true);
  const fresh = evaluatePullRequest([{ created_at: '2026-09-24T10:00:00Z', html_url: 'https://example.test/pr/1' }], { now });
  assert.equal(fresh.ok, true);
  assert.match(fresh.message, /3 dní/);
  const old = evaluatePullRequest([{ created_at: '2026-09-15T10:00:00Z', html_url: 'https://example.test/pr/1' }], { now });
  assert.equal(old.ok, false);
  assert.match(old.message, /už 12 dní: https:\/\/example\.test\/pr\/1/);
});

test('pull request: exactly the limit is still fine, the limit is configurable', () => {
  const pulls = [{ created_at: '2026-09-20T10:00:00Z', html_url: 'x' }];
  assert.equal(evaluatePullRequest(pulls, { now }).ok, true);
  assert.equal(evaluatePullRequest(pulls, { now, days: 6 }).ok, false);
});

test('formatReport lists any number of checks', () => {
  const r = formatReport({ ok: true, message: 'a' }, { ok: true, message: 'b' }, { ok: false, message: 'c' }, { ok: true, message: 'd' });
  assert.equal(r.ok, false);
  assert.equal(r.text.match(/^- /gm).length, 4);
});
