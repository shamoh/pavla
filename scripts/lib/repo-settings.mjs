// The settings of a GitHub repository as a checklist (Markdown): everything the API tells about it (general and pull
// request settings, rulesets, branch protection, Pages, environments, Actions, names of secrets and variables,
// collaborators, webhooks, deploy keys, security), plus what the API cannot tell and has to be checked by hand. Made
// to set up a new repository like an old one (scripts/repo-settings.mjs); values of secrets are never readable.

/** Repository fields worth keeping, in the order of Settings → General on GitHub. */
export const GENERAL_FIELDS = [
  'visibility', 'default_branch', 'description', 'homepage', 'topics', 'has_issues', 'has_wiki', 'has_projects',
  'has_discussions', 'is_template', 'allow_merge_commit', 'allow_squash_merge', 'allow_rebase_merge', 'allow_auto_merge',
  'delete_branch_on_merge', 'allow_update_branch', 'web_commit_signoff_required', 'archived',
];

/** What the API does not tell (or only with other tokens): checked by hand on every new repository. */
export const BY_HAND = [
  'Fine-grained tokeny, které na repo míří (u každého *Repository access*: token je vázaný na ID repa, ne na jméno).',
  'Hodnoty secrets (API vydá jen jména): vložit znovu ze zdroje (správce hesel, nový token).',
  'Vlastní doména GitHub Pages: DNS záznamy u registrátora (zůstávají, jen ověřit), *Enforce HTTPS* po vydání certifikátu.',
  'E-maily o selhání: *Settings → Notifications* účtu (Actions, Participating) a sledování repa (*Watch*).',
  'Odkazy na repo jinde (README, workflow jiných rep, záložky, ověření ve vyhledávačích).',
];

/**
 * Everything the API tells about `repo` ("owner/name"). `api(path)` returns the parsed JSON of a GET, or null for 404
 * (not set up / not available); other failures are thrown. Each part that fails is recorded under `errors`.
 */
export async function collectSettings(repo, api) {
  const errors = {};
  const part = async (name, fn) => {
    try {
      return await fn();
    } catch (e) {
      errors[name] = e.message;
      return null;
    }
  };
  const info = await api(`/repos/${repo}`);
  if (!info) throw new Error(`${repo}: repository not found`);
  const general = Object.fromEntries(GENERAL_FIELDS.filter((k) => k in info).map((k) => [k, info[k]]));
  const rulesets = await part('rulesets', async () => {
    const list = (await api(`/repos/${repo}/rulesets?includes_parents=false`)) ?? [];
    return Promise.all(list.map((r) => api(`/repos/${repo}/rulesets/${r.id}`)));
  });
  const protection = await part('protection', () => api(`/repos/${repo}/branches/${encodeURIComponent(info.default_branch)}/protection`));
  const pages = await part('pages', () => api(`/repos/${repo}/pages`));
  const environments = await part('environments', async () => {
    const list = (await api(`/repos/${repo}/environments`))?.environments ?? [];
    return Promise.all(list.map(async (e) => ({
      name: e.name,
      protection_rules: (e.protection_rules ?? []).map(({ type, wait_timer, reviewers }) => ({ type, wait_timer, reviewers: reviewers?.length })),
      deployment_branch_policy: e.deployment_branch_policy ?? null,
      branch_policies: e.deployment_branch_policy?.custom_branch_policies
        ? ((await api(`/repos/${repo}/environments/${encodeURIComponent(e.name)}/deployment-branch-policies`))?.branch_policies ?? []).map((p) => `${p.type ?? 'branch'}:${p.name}`)
        : [],
      secrets: ((await api(`/repos/${repo}/environments/${encodeURIComponent(e.name)}/secrets`).catch(() => null))?.secrets ?? []).map((s) => s.name),
    })));
  });
  const actions = await part('actions', async () => ({
    permissions: await api(`/repos/${repo}/actions/permissions`),
    workflow: await api(`/repos/${repo}/actions/permissions/workflow`),
  }));
  const secrets = await part('secrets', async () => ((await api(`/repos/${repo}/actions/secrets`))?.secrets ?? []).map((s) => s.name));
  const variables = await part('variables', async () => ((await api(`/repos/${repo}/actions/variables`))?.variables ?? []).map((v) => `${v.name}=${v.value}`));
  const collaborators = await part('collaborators', async () => ((await api(`/repos/${repo}/collaborators`)) ?? []).map((c) => `${c.login} (${c.role_name ?? ''})`));
  const hooks = await part('hooks', async () => ((await api(`/repos/${repo}/hooks`)) ?? []).map((h) => `${h.config?.url ?? h.name} [${(h.events ?? []).join(', ')}]`));
  const keys = await part('keys', async () => ((await api(`/repos/${repo}/keys`)) ?? []).map((k) => `${k.title}${k.read_only ? ' (read-only)' : ''}`));
  const security = await part('security', async () => ({
    vulnerability_alerts: (await api(`/repos/${repo}/vulnerability-alerts`)) !== null,
    automated_security_fixes: (await api(`/repos/${repo}/automated-security-fixes`))?.enabled ?? false,
    secret_scanning: info.security_and_analysis?.secret_scanning?.status ?? null,
  }));
  return { repo, general, rulesets, protection, pages, environments, actions, secrets, variables, collaborators, hooks, keys, security, errors };
}

const value = (v) => (v === null || v === undefined ? '–' : Array.isArray(v) ? (v.length ? v.join(', ') : '–') : typeof v === 'object' ? JSON.stringify(v) : String(v));
const table = (rows) => ['| Nastavení | Hodnota |', '|---|---|', ...rows.map(([k, v]) => `| \`${k}\` | ${value(v).replace(/\|/g, '\\|')} |`)];
const list = (items) => (items?.length ? items.map((i) => `- [ ] ${i}`) : ['- žádné']);
const json = (data) => ['```json', JSON.stringify(data, null, 2), '```'];

/** The rules of a ruleset in one line each: type and its parameters (e.g. required status checks by name). */
export function ruleLines(ruleset) {
  return (ruleset.rules ?? []).map((r) => {
    const checks = r.parameters?.required_status_checks?.map((c) => c.context);
    return checks ? `${r.type}: ${checks.join(', ')}` : r.parameters && Object.keys(r.parameters).length ? `${r.type}: ${JSON.stringify(r.parameters)}` : r.type;
  });
}

/** The checklist for setting up a repository like `s` (collectSettings), in Czech, with the raw data at the end. */
export function settingsMarkdown(s, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const lines = [
    `# Nastavení repa ${s.repo}`, '',
    `Export ${date} (\`node scripts/repo-settings.mjs ${s.repo}\` v repu \`pavla\`). Kontrolní seznam pro nové repo se stejným`,
    'nastavením: projdi každý řádek v *Settings* nového repa. Hodnoty secrets API nevydá, jen jména.', '',
    '## Obecné a pull requesty (*Settings → General*)', '', ...table(Object.entries(s.general)), '',
    '## Pravidla větví (*Settings → Rules → Rulesets*)', '',
  ];
  if (s.rulesets === null) lines.push('- nepodařilo se přečíst (viz níže; soukromé repo na GitHub Free rulesety nemá)');
  else if (!s.rulesets.length) lines.push('- žádný ruleset');
  for (const r of s.rulesets ?? []) {
    lines.push(`### ${r.name} (${r.enforcement}, cíl ${r.target})`, '',
      `- [ ] větve: ${value(r.conditions?.ref_name?.include)}${r.conditions?.ref_name?.exclude?.length ? ` kromě ${value(r.conditions.ref_name.exclude)}` : ''}`,
      `- [ ] výjimky (bypass): ${value((r.bypass_actors ?? []).map((b) => `${b.actor_type}${b.actor_id ? ` ${b.actor_id}` : ''} (${b.bypass_mode})`))}`,
      ...ruleLines(r).map((l) => `- [ ] pravidlo ${l}`), '');
  }
  lines.push('## Ochrana větve (klasická, *Settings → Branches*)', '', s.errors?.protection ? '- nepodařilo se přečíst (viz níže)' : s.protection ? '- [ ] nastavená, viz data na konci' : '- žádná', '',
    '## GitHub Pages (*Settings → Pages*)', '');
  lines.push(...(s.pages
    ? table([['build_type', s.pages.build_type], ['cname', s.pages.cname], ['https_enforced', s.pages.https_enforced], ['source', s.pages.source], ['html_url', s.pages.html_url]])
    : ['- vypnuté']), '', '## Prostředí (*Settings → Environments*)', '');
  if (!s.environments?.length) lines.push('- žádné');
  for (const e of s.environments ?? []) {
    lines.push(`- [ ] **${e.name}**: větve ${e.deployment_branch_policy ? value(e.branch_policies.length ? e.branch_policies : e.deployment_branch_policy) : 'všechny'}`
      + `${e.protection_rules.length ? `, ochrana ${value(e.protection_rules.map((p) => p.type))}` : ''}${e.secrets.length ? `, secrets ${value(e.secrets)}` : ''}`);
  }
  lines.push('', '## Actions (*Settings → Actions → General*)', '', ...table([
    ['enabled', s.actions?.permissions?.enabled], ['allowed_actions', s.actions?.permissions?.allowed_actions],
    ['default_workflow_permissions', s.actions?.workflow?.default_workflow_permissions],
    ['can_approve_pull_request_reviews', s.actions?.workflow?.can_approve_pull_request_reviews],
  ]), '', '## Secrets a proměnné (*Settings → Secrets and variables → Actions*)', '',
  ...list((s.secrets ?? []).map((n) => `secret \`${n}\` (hodnotu vložit znovu)`)), ...((s.variables ?? []).length ? list(s.variables.map((v) => `proměnná \`${v}\``)) : []), '',
  '## Přístupy, webhooky, klíče', '', ...list((s.collaborators ?? []).map((c) => `spolupracovník ${c}`)),
  ...((s.hooks ?? []).length ? list(s.hooks.map((h) => `webhook ${h}`)) : ['- žádné webhooky']),
  ...((s.keys ?? []).length ? list(s.keys.map((k) => `deploy key ${k}`)) : ['- žádné deploy keys']), '',
  '## Bezpečnost (*Settings → Code security*)', '', ...table(Object.entries(s.security ?? {})), '',
  '## Ručně (API to neřekne)', '', ...list(BY_HAND), '');
  if (Object.keys(s.errors ?? {}).length) {
    lines.push('## Nepodařilo se přečíst', '', ...Object.entries(s.errors).map(([k, m]) => `- ${k}: ${m}`), '');
  }
  lines.push('## Data z API', '', '<details><summary>rulesets, ochrana větve, Pages, prostředí</summary>', '',
    ...json({ rulesets: s.rulesets, protection: s.protection, pages: s.pages, environments: s.environments }), '', '</details>', '');
  return lines.join('\n');
}

/** `data` without the API's own addresses (…url fields): they say nothing about the settings and differ per repository. */
function withoutUrls(data) {
  if (Array.isArray(data)) return data.map(withoutUrls);
  if (!data || typeof data !== 'object') return data;
  return Object.fromEntries(Object.entries(data).filter(([k]) => !/url$/.test(k)).map(([k, v]) => [k, withoutUrls(v)]));
}

const sorted = (items) => (items === null || items === undefined ? null : [...items].sort());

/**
 * The settings of `s` (collectSettings) in a stable form to compare (stored as <repo>.json next to the checklist):
 * no ids of rulesets, no addresses, lists sorted; parts that could not be read are under `unreadable`.
 */
export function settingsSnapshot(s) {
  // through JSON: as it is stored (no undefined values), so a fresh one compares equal to a stored one
  return JSON.parse(JSON.stringify({
    general: s.general,
    rulesets: s.rulesets === null ? null : [...s.rulesets].map((r) => ({
      name: r.name, enforcement: r.enforcement, target: r.target,
      include: sorted(r.conditions?.ref_name?.include ?? []), exclude: sorted(r.conditions?.ref_name?.exclude ?? []),
      bypass: sorted((r.bypass_actors ?? []).map((b) => `${b.actor_type}${b.actor_id ? ` ${b.actor_id}` : ''} (${b.bypass_mode})`)),
      rules: sorted(ruleLines(r)),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    protection: s.protection === null ? null : withoutUrls(s.protection),
    pages: s.pages ? { build_type: s.pages.build_type, cname: s.pages.cname, https_enforced: s.pages.https_enforced, source: s.pages.source } : null,
    environments: s.environments === null ? null : [...s.environments].sort((a, b) => a.name.localeCompare(b.name)),
    actions: s.actions ? {
      enabled: s.actions.permissions?.enabled, allowed_actions: s.actions.permissions?.allowed_actions,
      default_workflow_permissions: s.actions.workflow?.default_workflow_permissions,
      can_approve_pull_request_reviews: s.actions.workflow?.can_approve_pull_request_reviews,
    } : null,
    secrets: sorted(s.secrets), variables: sorted(s.variables), collaborators: sorted(s.collaborators),
    hooks: sorted(s.hooks), keys: sorted(s.keys), security: s.security,
    unreadable: Object.keys(s.errors ?? {}).sort(),
  }));
}

/** Marks an item of a list of plain values in a flattened key: "secrets ∋ \"PAVLA_TOKEN\"". */
const MEMBER = ' ∋ ';

/**
 * `data` as { "a.b[0].c": JSON value } for every leaf (an empty list or object is a leaf too); a list of plain values
 * as its members ({ "secrets ∋ \"X\"": "1" }), so an added name is one difference, not a shifted list.
 */
function flatten(data, prefix = '', out = {}) {
  const leaf = data === null || typeof data !== 'object' || (Array.isArray(data) ? !data.length : !Object.keys(data).length);
  if (leaf) {
    out[prefix] = JSON.stringify(data ?? null);
    return out;
  }
  if (Array.isArray(data) && data.every((v) => v === null || typeof v !== 'object')) {
    for (const v of data) out[`${prefix}${MEMBER}${JSON.stringify(v)}`] = '1';
    return out;
  }
  if (Array.isArray(data)) data.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  else for (const [k, v] of Object.entries(data)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/**
 * What differs between a stored snapshot and the current one: ["<path>: <stored> → <now>"], in path order. A part the
 * current reading could not read (`unreadable`) is compared only by that fact: its values are not known.
 */
export function compareSnapshots(saved, now) {
  const unknown = new Set(now.unreadable ?? []);
  const a = flatten({ ...saved, unreadable: undefined });
  const b = flatten({ ...now, unreadable: undefined });
  const part = (p) => p.split(/[.[ ]/)[0];
  const diffs = [];
  for (const p of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (unknown.has(part(p)) || p === 'unreadable' || a[p] === b[p]) continue;
    if (p.includes(MEMBER)) {
      const [list, member] = p.split(MEMBER);
      diffs.push(`${list}: ${b[p] ? 'přibylo' : 'ubylo'} ${member}`);
    } else {
      diffs.push(`${p}: ${a[p] ?? '–'} → ${b[p] ?? '–'}`);
    }
  }
  const before = new Set(saved.unreadable ?? []);
  for (const u of unknown) if (!before.has(u)) diffs.push(`${u}: nejde přečíst (dřív šlo)`);
  return diffs;
}
