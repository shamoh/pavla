import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BY_HAND, MERGE_FIELDS, collectSettings, compareSnapshots, ruleLines, settingsMarkdown, settingsSnapshot } from './repo-settings.mjs';

/** A fake API: the answers by path (missing = 404 = null); a value Error = that call fails. */
const fakeApi = (answers) => async (path) => {
  const a = answers[path];
  if (a instanceof Error) throw a;
  return a ?? null;
};

const repo = 'shamoh/web';
const answers = {
  [`/repos/${repo}`]: {
    visibility: 'public', default_branch: 'main', allow_auto_merge: true, delete_branch_on_merge: true, allow_squash_merge: false,
    allow_merge_commit: true, allow_rebase_merge: true, allow_update_branch: false,
    topics: ['akvarel'], id: 1, security_and_analysis: { secret_scanning: { status: 'enabled' } },
  },
  [`/repos/${repo}/rulesets?includes_parents=false`]: [{ id: 7 }],
  [`/repos/${repo}/rulesets/7`]: {
    name: 'main', enforcement: 'active', target: 'branch', conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }],
    rules: [{ type: 'deletion' }, { type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'check' }] } }],
  },
  [`/repos/${repo}/pages`]: { build_type: 'workflow', cname: 'pavla.example', https_enforced: true },
  [`/repos/${repo}/environments`]: { environments: [{ name: 'github-pages', protection_rules: [{ type: 'branch_policy' }], deployment_branch_policy: { custom_branch_policies: true } }] },
  [`/repos/${repo}/environments/github-pages/deployment-branch-policies`]: { branch_policies: [{ name: 'main', type: 'branch' }] },
  [`/repos/${repo}/actions/permissions`]: { enabled: true, allowed_actions: 'all' },
  [`/repos/${repo}/actions/permissions/workflow`]: { default_workflow_permissions: 'read', can_approve_pull_request_reviews: false },
  [`/repos/${repo}/actions/secrets`]: { secrets: [{ name: 'PAVLA_TOKEN' }] },
  [`/repos/${repo}/actions/variables`]: { variables: [] },
  [`/repos/${repo}/collaborators`]: [{ login: 'pavla', role_name: 'write' }],
  [`/repos/${repo}/hooks`]: [],
  [`/repos/${repo}/keys`]: new Error('HTTP 403'),
  [`/repos/${repo}/vulnerability-alerts`]: {},
};

test('collectSettings: general settings, rulesets in full, Pages, environments, Actions, names of secrets; a failing part is recorded', async () => {
  const s = await collectSettings(repo, fakeApi(answers));
  assert.deepEqual(s.general, {
    visibility: 'public', default_branch: 'main', topics: ['akvarel'], allow_merge_commit: true, allow_squash_merge: false,
    allow_rebase_merge: true, allow_auto_merge: true, delete_branch_on_merge: true, allow_update_branch: false,
  });
  assert.equal(s.rulesets[0].name, 'main');
  assert.equal(s.protection, null, 'no classic protection (404)');
  assert.equal(s.pages.cname, 'pavla.example');
  assert.deepEqual(s.environments, [{
    name: 'github-pages', protection_rules: [{ type: 'branch_policy', wait_timer: undefined, reviewers: undefined }],
    deployment_branch_policy: { custom_branch_policies: true }, branch_policies: ['branch:main'], secrets: [],
  }]);
  assert.deepEqual(s.secrets, ['PAVLA_TOKEN']);
  assert.deepEqual(s.collaborators, ['pavla (write)']);
  assert.equal(s.keys, null);
  assert.deepEqual(s.errors, { keys: 'HTTP 403' });
  assert.deepEqual(s.security, { vulnerability_alerts: true, automated_security_fixes: false, secret_scanning: 'enabled' });
  await assert.rejects(collectSettings('shamoh/nic', fakeApi({})), /shamoh\/nic: repository not found/);
});

test('ruleLines: the type of each rule, required status checks by name', () => {
  assert.deepEqual(ruleLines(answers[`/repos/${repo}/rulesets/7`]), ['deletion', 'required_status_checks: check']);
  assert.deepEqual(ruleLines({}), []);
});

test('settingsMarkdown: a checklist by the sections of Settings, what to do by hand, the raw data at the end', async () => {
  const md = settingsMarkdown(await collectSettings(repo, fakeApi(answers)), { date: '2026-10-29' });
  assert.match(md, /^# Nastavení repa shamoh\/web\n\nExport 2026-10-29/);
  assert.match(md, /\| `allow_auto_merge` \| true \|/);
  assert.match(md, /### main \(active, cíl branch\)\n\n- \[ \] větve: ~DEFAULT_BRANCH\n- \[ \] výjimky \(bypass\): RepositoryRole 5 \(always\)\n- \[ \] pravidlo deletion\n- \[ \] pravidlo required_status_checks: check/);
  assert.match(md, /\| `cname` \| pavla\.example \|/);
  assert.match(md, /- \[ \] \*\*github-pages\*\*: větve branch:main, ochrana branch_policy/);
  assert.match(md, /- \[ \] secret `PAVLA_TOKEN` \(hodnotu vložit znovu\)/);
  assert.match(md, /- \[ \] spolupracovník pavla \(write\)/);
  for (const line of BY_HAND) assert.ok(md.includes(line), line);
  assert.match(md, /## Nepodařilo se přečíst\n\n- keys: HTTP 403/);
  const unreadable = settingsMarkdown(await collectSettings(repo, fakeApi({ ...answers, [`/repos/${repo}/rulesets?includes_parents=false`]: new Error('HTTP 403') })));
  assert.match(unreadable, /Rulesets\*\)\n\n- nepodařilo se přečíst/);
  assert.match(md, /<details><summary>rulesets, ochrana větve, Pages, prostředí<\/summary>\n\n```json\n\{/);
});

test('settingsSnapshot: stable (no ids, no addresses, sorted lists), with the parts that could not be read', async () => {
  const snap = settingsSnapshot(await collectSettings(repo, fakeApi(answers)));
  assert.deepEqual(snap.rulesets, [{
    name: 'main', enforcement: 'active', target: 'branch', include: ['~DEFAULT_BRANCH'], exclude: [],
    bypass: ['RepositoryRole 5 (always)'], rules: ['deletion', 'required_status_checks: check'],
  }]);
  assert.deepEqual(snap.pages, { build_type: 'workflow', cname: 'pavla.example', https_enforced: true });
  assert.deepEqual(snap.unreadable, ['keys']);
  assert.ok(!JSON.stringify(snap).includes('"id"'));
  // the same settings read again: the same snapshot (through JSON, as stored)
  const again = settingsSnapshot(await collectSettings(repo, fakeApi(answers)));
  assert.deepEqual(compareSnapshots(JSON.parse(JSON.stringify(snap)), again), []);
});

test('compareSnapshots: every changed, added and removed setting; an unreadable part only by that fact', async () => {
  const saved = JSON.parse(JSON.stringify(settingsSnapshot(await collectSettings(repo, fakeApi(answers)))));
  const changed = {
    ...answers,
    [`/repos/${repo}`]: { ...answers[`/repos/${repo}`], allow_auto_merge: false },
    [`/repos/${repo}/rulesets?includes_parents=false`]: [],
    [`/repos/${repo}/actions/secrets`]: { secrets: [{ name: 'PAVLA_TOKEN' }, { name: 'NOVY' }] },
    [`/repos/${repo}/pages`]: new Error('HTTP 403'),
  };
  const diffs = compareSnapshots(saved, settingsSnapshot(await collectSettings(repo, fakeApi(changed))));
  assert.ok(diffs.includes('general.allow_auto_merge: true → false'), diffs.join('\n'));
  assert.ok(diffs.includes('rulesets[0].name: "main" → –'), diffs.join('\n'));
  assert.ok(diffs.includes('rulesets[0].rules: ubylo "required_status_checks: check"'), diffs.join('\n'));
  assert.deepEqual(diffs.filter((d) => d.startsWith('secrets')), ['secrets: přibylo "NOVY"']);
  assert.ok(diffs.includes('pages: nejde přečíst (dřív šlo)'), diffs.join('\n'));
  assert.ok(!diffs.some((d) => d.startsWith('pages.')), 'values of an unreadable part are unknown, not changed');
});

/** The answers as a read-only token gets them: REST without the merge settings. */
const restWithoutMerge = () => {
  const rest = { ...answers[`/repos/${repo}`] };
  for (const k of Object.keys(MERGE_FIELDS)) delete rest[k];
  return { ...answers, [`/repos/${repo}`]: rest };
};
const mergeAnswer = {
  repository: {
    mergeCommitAllowed: true, squashMergeAllowed: false, rebaseMergeAllowed: true, autoMergeAllowed: true, deleteBranchOnMerge: true, allowUpdateBranch: false,
  },
};

test('collectSettings: merge settings REST leaves out come from GraphQL, the same snapshot in the same order of fields', async () => {
  const queries = [];
  const s = await collectSettings(repo, fakeApi(restWithoutMerge()), async (q) => {
    queries.push(q);
    return mergeAnswer;
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0], /repository\(owner: "shamoh", name: "web"\)/);
  for (const name of Object.values(MERGE_FIELDS)) assert.ok(queries[0].includes(name), name);
  const stored = settingsSnapshot(await collectSettings(repo, fakeApi(answers)));
  assert.deepEqual(Object.keys(s.general), Object.keys(stored.general));
  assert.deepEqual(compareSnapshots(JSON.parse(JSON.stringify(stored)), settingsSnapshot(s), s.errors), []);
});

test('collectSettings: GraphQL is not asked when REST tells the merge settings', async () => {
  const s = await collectSettings(repo, fakeApi(answers), async () => assert.fail('GraphQL asked'));
  assert.equal(s.general.allow_auto_merge, true);
  assert.ok(!Object.keys(s.errors).some((k) => k.startsWith('general.')));
});

test('compareSnapshots: a real change seen through GraphQL is reported as a change', async () => {
  const stored = JSON.parse(JSON.stringify(settingsSnapshot(await collectSettings(repo, fakeApi(answers)))));
  const off = { repository: { ...mergeAnswer.repository, autoMergeAllowed: false } };
  const s = await collectSettings(repo, fakeApi(restWithoutMerge()), async () => off);
  assert.deepEqual(compareSnapshots(stored, settingsSnapshot(s), s.errors), ['general.allow_auto_merge: true → false']);
});

test('compareSnapshots: a merge setting nothing tells is unreadable with the reason, not "true → –"', async () => {
  const stored = JSON.parse(JSON.stringify(settingsSnapshot(await collectSettings(repo, fakeApi(answers)))));
  const failed = await collectSettings(repo, fakeApi(restWithoutMerge()), async () => { throw new Error('HTTP 403: Forbidden'); });
  const diffs = compareSnapshots(stored, settingsSnapshot(failed), failed.errors);
  assert.equal(diffs.length, Object.keys(MERGE_FIELDS).length);
  assert.ok(diffs.includes('general.allow_auto_merge: nejde přečíst (dřív šlo): HTTP 403: Forbidden'), diffs.join('\n'));
  assert.ok(!diffs.some((d) => d.includes('→')), diffs.join('\n'));

  // one field missing in the answer: only that one, the others are compared
  const { autoMergeAllowed, ...partial } = mergeAnswer.repository;
  const one = await collectSettings(repo, fakeApi(restWithoutMerge()), async () => ({ repository: partial }));
  assert.equal(one.general.allow_merge_commit, true);
  assert.deepEqual(compareSnapshots(stored, settingsSnapshot(one), one.errors), ['general.allow_auto_merge: nejde přečíst (dřív šlo): API tuto hodnotu nevrátilo']);

  // already unreadable in the stored export: not a new difference
  assert.deepEqual(compareSnapshots(settingsSnapshot(one), settingsSnapshot(one), one.errors), []);
});

test('compareSnapshots: a list that was empty gains members in one line each, without a false "[] → –"', () => {
  const base = { general: { topics: [] }, secrets: [], rulesets: [], unreadable: [] };
  assert.deepEqual(compareSnapshots(base, { ...base, secrets: ['CHECK_TOKEN'], general: { topics: ['akvarel'] } }), [
    'general.topics: přibylo "akvarel"',
    'secrets: přibylo "CHECK_TOKEN"',
  ]);
  assert.deepEqual(compareSnapshots({ ...base, secrets: ['CHECK_TOKEN'] }, base), ['secrets: ubylo "CHECK_TOKEN"']);
  assert.deepEqual(compareSnapshots(base, { ...base, rulesets: [{ name: 'main' }] }), ['rulesets[0].name: – → "main"']);
  assert.deepEqual(compareSnapshots(base, { ...base }), []);
});

test('compareSnapshots: an unreadable part tells why, if known', () => {
  const base = { environments: [], unreadable: [] };
  assert.deepEqual(compareSnapshots(base, { environments: null, unreadable: ['environments'] }, { environments: 'HTTP 403: Resource not accessible' }), [
    'environments: nejde přečíst (dřív šlo): HTTP 403: Resource not accessible',
  ]);
  assert.deepEqual(compareSnapshots(base, { environments: null, unreadable: ['environments'] }), ['environments: nejde přečíst (dřív šlo)']);
});
