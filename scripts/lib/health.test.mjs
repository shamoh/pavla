import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRY_RUNS, MINUTE_LIMITS, SIZE_LIMITS, evaluateDeploy, evaluateMinutes, evaluatePullRequest, evaluateRuns, evaluateSettings, evaluateSizes, evaluateToken, evaluateUnknownAttributes, evaluateUnknownTechniques, evaluateUntranslatedTags, formatReport, parseExpiration,
} from './health.mjs';

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

test('runs: the dry run on the test data has its own name and says what its failure means', () => {
  const failed = evaluateRuns([run('failure', '2026-09-27T05:00:00Z')], { now, workflow: DRY_RUNS });
  assert.equal(failed.ok, false);
  assert.match(failed.message, /^Poslední běh „Zkušební běh zpracování“ \(2026-09-27\) selhal: /);
  assert.match(failed.message, /na testovacích datech/);
  assert.match(evaluateRuns([run('success', '2026-09-27T05:00:00Z')], { now, workflow: DRY_RUNS }).message, /„Zkušební běh zpracování“ .* prošel/);
  assert.match(evaluateRuns([], { now, workflow: DRY_RUNS }).message, /zatím neproběhl/);
  assert.match(evaluateRuns([run('failure', '2026-09-27T05:00:00Z')], { now }).message, /„Zpracování obsahu“/);
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

test('pull request: none open, waiting shortly, stuck (auto-merge did not happen)', () => {
  assert.equal(evaluatePullRequest([], { now }).ok, true);
  const fresh = evaluatePullRequest([{ created_at: '2026-09-26T10:00:00Z', html_url: 'https://example.test/pr/1' }], { now });
  assert.equal(fresh.ok, true);
  assert.match(fresh.message, /1 dní/);
  const old = evaluatePullRequest([{ created_at: '2026-09-15T10:00:00Z', html_url: 'https://example.test/pr/1' }], { now });
  assert.equal(old.ok, false);
  assert.match(old.message, /nesloučila sama ani za 12 dní: https:\/\/example\.test\/pr\/1/);
  assert.match(old.message, /Kontrola kódu/);
});

test('pull request: exactly the limit is still fine, the limit is configurable (default one day)', () => {
  const pulls = [{ created_at: '2026-09-26T10:00:00Z', html_url: 'x' }];
  assert.equal(evaluatePullRequest(pulls, { now }).ok, true);
  assert.equal(evaluatePullRequest([{ created_at: '2026-09-25T10:00:00Z', html_url: 'x' }], { now }).ok, false);
  assert.equal(evaluatePullRequest([{ created_at: '2026-09-20T10:00:00Z', html_url: 'x' }], { now, days: 7 }).ok, true);
});

test('formatReport lists any number of checks', () => {
  const r = formatReport({ ok: true, message: 'a' }, { ok: true, message: 'b' }, { ok: false, message: 'c' }, { ok: true, message: 'd' });
  assert.equal(r.ok, false);
  assert.equal(r.text.match(/^- /gm).length, 4);
});

test('unknown attributes: listed with the file, fine when there are none or the content was not checked', () => {
  const bad = evaluateUnknownAttributes(['tvorba/rano.yaml: mockup', 'fotky/portret.yaml: popis']);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /NEZNÁMÝ[\s\S]*\n- tvorba\/rano\.yaml: mockup\n- fotky\/portret\.yaml: popis\nOprav/);
  assert.equal(evaluateUnknownAttributes([]).ok, true);
  const skipped = evaluateUnknownAttributes(null);
  assert.equal(skipped.ok, true);
  assert.match(skipped.message, /nebyly zkontrolovány/);
});

test('evaluateUnknownTechniques: a technique without an art form needs a rule, nothing found is fine', () => {
  const bad = evaluateUnknownTechniques(['koláž: tvorba/a.yaml, tvorba/b.yaml']);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /\n- koláž: tvorba\/a\.yaml, tvorba\/b\.yaml\nDoplň pravidlo do ARTFORMS/);
  assert.equal(evaluateUnknownTechniques([]).ok, true);
  const skipped = evaluateUnknownTechniques(null);
  assert.equal(skipped.ok, true);
  assert.match(skipped.message, /nebyly zkontrolovány/);
});

test('every failed check ends the first line of its message with its code, a fine check has none', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const first = (r) => r.message.split('\n')[0];
  const cases = [
    [evaluateToken({ status: 0 }), 'token-chybi'],
    [evaluateToken({ status: 401 }), 'token-neplatny'],
    [evaluateToken({ status: 500 }), 'token-nedostupny'],
    [evaluateToken({ status: 200, expiration: '2026-10-20 00:00:00 UTC', now }), 'token-vyprsi'],
    [evaluateRuns([{ status: 'completed', conclusion: 'failure', created_at: '2026-10-14', html_url: 'u' }], { now }), 'beh-selhal'],
    [evaluateRuns([{ status: 'completed', conclusion: 'failure', created_at: '2026-10-14', html_url: 'u' }], { now, workflow: DRY_RUNS }), 'zkusebni-beh-selhal'],
    [evaluateDeploy({ sha: 'abcdef1234', date: '2026-10-10' }, [{ head_sha: 'abcdef1234', status: 'completed', conclusion: 'failure', html_url: 'u' }], { now }), 'nasazeni-selhalo'],
    [evaluateDeploy({ sha: 'abcdef1234', date: '2026-10-10' }, [], { now }), 'nasazeni-chybi'],
    [evaluatePullRequest([{ created_at: '2026-10-01', html_url: 'u' }], { now }), 'aktualizace-ceka'],
    [evaluateUnknownAttributes(['tvorba/a.yaml: mockup']), 'neznamy-atribut'],
    [evaluateUnknownTechniques(['olej: tvorba/a.yaml']), 'nova-technika'],
  ];
  for (const [result, code] of cases) {
    assert.equal(result.ok, false, code);
    assert.ok(first(result).endsWith(`[${code}]`), `${code}: ${first(result)}`);
  }
  assert.doesNotMatch(evaluateToken({ status: 200, now }).message, /\[[a-z-]+\]/);
  assert.doesNotMatch(evaluateUnknownAttributes([]).message, /\[[a-z-]+\]/);
});

test('formatReport: the codes of the failed checks and of their listed problems, each once, none when all is fine', () => {
  const fine = { ok: true, message: 'v pořádku' };
  assert.deepEqual(formatReport(fine, fine).codes, []);
  const report = formatReport(
    evaluateToken({ status: 401 }),
    fine,
    { ok: false, message: 'Texty stránek mají 2 problémy:\n- /a/: chybí titulek [titulek-chybi]\n- /b/: chybí titulek [titulek-chybi]' },
    evaluateUnknownAttributes(['tvorba/a.yaml: mockup']),
    { ok: true, message: 'nic [beh-selhal]' },
  );
  assert.equal(report.ok, false);
  assert.deepEqual(report.codes, ['token-neplatny', 'titulek-chybi', 'neznamy-atribut']);
});

test('evaluateUntranslatedTags: a word without an English one is listed with where to add it', () => {
  const bad = evaluateUntranslatedTags(['„motýl“ (Instagram, Pinterest): tvorba/a.yaml']);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /\[preklad-chybi\]\n- „motýl“ \(Instagram, Pinterest\): tvorba\/a\.yaml\nDoplň překlad do site\.config\.yaml/);
  assert.equal(evaluateUntranslatedTags([]).ok, true);
  const skipped = evaluateUntranslatedTags(null);
  assert.equal(skipped.ok, true);
  assert.match(skipped.message, /nebyly zkontrolovány/);
});

test('evaluateSizes: fine below 70 % of the limits, the sizes and shares always listed', () => {
  const r = evaluateSizes({ site: 332_300_000, content: 501_000_000, pages: 155_000_000 });
  assert.equal(r.ok, true);
  assert.equal(r.message, 'Velikost: repo webu (shamoh/pavla) 332 MB (33 % z 1000 MB) · obsahové repo 501 MB (50 % z 1000 MB)'
    + ' · nasazený web (GitHub Pages) 155 MB (16 % z 1000 MB).');
});

test('evaluateSizes: from 70 % of a limit it fails with the code and names what grows', () => {
  const r = evaluateSizes({ site: 100 * 1e6, content: 0.7 * SIZE_LIMITS.repoBytes, pages: 950 * 1e6 });
  assert.equal(r.ok, false);
  assert.match(r.message, /^Blíží se limit velikosti GitHubu \(obsahové repo, nasazený web \(GitHub Pages\)\): \[blizi-se-limit\]\n/);
  assert.match(r.message, /obsahové repo 700 MB \(70 % z 1000 MB\)/);
  assert.match(r.message, /docs\/github-provoz\.md/);
});

test('evaluateSizes: a size that could not be read is listed as such and never fails the check', () => {
  const r = evaluateSizes({ site: null, content: 10 * 1e6, pages: undefined });
  assert.equal(r.ok, true);
  assert.match(r.message, /repo webu \(shamoh\/pavla\) nezjištěno · obsahové repo 10 MB \(1 % z 1000 MB\) · nasazený web \(GitHub Pages\) nezjištěno/);
  assert.equal(evaluateSizes({ site: 600, content: 600, pages: 600 }, { repoBytes: 1000, siteBytes: 1000, warnShare: 0.5 }).ok, false);
});

const usage = (repo, quantity, extra = {}) => ({ product: 'actions', unitType: 'Minutes', repositoryName: repo, quantity, netAmount: 0, ...extra });
const privateRepo = (repo) => repo === 'obsah';

test('evaluateMinutes: counts only Actions minutes of private repositories, per repository', () => {
  const items = [
    usage('obsah', 300), usage('obsah', 120), usage('pavla', 900),
    usage('obsah', 50, { unitType: 'GigabyteHours' }), { product: 'copilot', unitType: 'Requests', repositoryName: 'obsah', quantity: 99, netAmount: 0 },
  ];
  const r = evaluateMinutes(items, privateRepo, { now: new Date('2026-10-15T08:00:00Z') });
  assert.equal(r.ok, true);
  assert.equal(r.message, `Minuty Actions soukromých rep za tento měsíc: 420 z ${MINUTE_LIMITS.included} (21 %): obsah 420; tímto tempem 868 za celý měsíc.`);
});

test('evaluateMinutes: fails from 70 % of the free minutes, or when the pace would use them all', () => {
  const at = (day) => ({ now: new Date(`2026-10-${day}T08:00:00Z`) });
  const many = evaluateMinutes([usage('obsah', 1400)], privateRepo, at(28));
  assert.equal(many.ok, false);
  assert.match(many.message, /^Docházejí volné minuty GitHub Actions: \[dochazeji-minuty\]\n.*1400 z 2000 \(70 %\)/);
  // 700 minutes by the 10th: 2170 in a month of 31 days
  assert.equal(evaluateMinutes([usage('obsah', 700)], privateRepo, at(10)).ok, false);
  // the same pace before day 7 says little
  assert.equal(evaluateMinutes([usage('obsah', 400)], privateRepo, at('05')).ok, true);
});

test('evaluateMinutes: any amount to pay fails; without the report the check is skipped', () => {
  const paid = evaluateMinutes([usage('obsah', 10), { product: 'git_lfs', netAmount: 1.5 }], privateRepo, { now: new Date('2026-10-20T00:00:00Z') });
  assert.equal(paid.ok, false);
  assert.match(paid.message, /^GitHub účtuje platbu 1\.50 USD za tento měsíc\. \[placene-minuty\]/);
  const none = evaluateMinutes(null, privateRepo);
  assert.equal(none.ok, true);
  assert.match(none.message, /CHECK_TOKEN/);
});

test('evaluateSettings: the same settings are fine; a difference or a missing export fails with the code; not compared = fine', () => {
  assert.deepEqual(evaluateSettings([{ repo: 'shamoh/pavla', diffs: [] }, { repo: 'shamoh/obsah', diffs: [] }]), {
    ok: true, message: 'Nastavení rep odpovídá uloženému exportu (shamoh/pavla, shamoh/obsah).',
  });
  const changed = evaluateSettings([
    { repo: 'shamoh/pavla', diffs: ['general.allow_auto_merge: true → false'] }, { repo: 'shamoh/obsah', noSnapshot: true },
  ]);
  assert.equal(changed.ok, false);
  assert.match(changed.message, /^Nastavení repa se liší od uloženého exportu: \[nastaveni-se-zmenilo\]\n- shamoh\/pavla:\n {2}- general\.allow_auto_merge: true → false\n- shamoh\/obsah: uložený export chybí\n/);
  assert.match(changed.message, /node scripts\/repo-settings\.mjs/);
  const many = evaluateSettings([{ repo: 'r', diffs: Array.from({ length: 25 }, (_, i) => `x${i}: 1 → 2`) }]);
  assert.match(many.message, /- x19: 1 → 2\n {2}- … a dalších 5/);
  assert.deepEqual(evaluateSettings(null, { reason: 'jen první pondělí v měsíci' }), { ok: true, message: 'Nastavení rep nebylo porovnáno (jen první pondělí v měsíci).' });
});
