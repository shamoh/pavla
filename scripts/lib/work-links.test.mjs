import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillDescriptionsWorkLinks, fillWorkLinkTitles, relatedIds, workLinkProblems } from './work-links.mjs';
import { COLLECTION_SCHEMA, WORK_SCHEMA } from './schema.mjs';

const work = (id, data = {}, slug = id) => ({ id, slug, dir: '', yamlPath: `tvorba/${slug}.yaml`, data: { id, ...data } });
const codes = (list) => list.map((p) => p.match(/\[([a-z-]+)\]$/)[1]);

test('relatedIds: valid ids of related, each once', () => {
  assert.deepEqual(relatedIds({ related: ['chqmf', 'x', 'chqmf', 'xua65'] }), ['chqmf', 'xua65']);
  assert.deepEqual(relatedIds({ related: 'chqmf' }), []);
  assert.deepEqual(relatedIds({}), []);
});

test('workLinkProblems: related to existing works is fine, unknown ids and bad lists are errors', () => {
  const works = [work('xua65', { related: ['chqmf'] }), work('chqmf'), work('k3f9a', { related: ['nnnnn', 'k3f9a'] }), work('mpugj', { related: 'chqmf' })];
  const { problems, advice } = workLinkProblems({ works });
  assert.deepEqual(problems.map((p) => p.slice(0, p.indexOf(':'))), ['tvorba/k3f9a.yaml', 'tvorba/k3f9a.yaml', 'tvorba/mpugj.yaml']);
  assert.deepEqual(codes(problems), ['spatne-souvisejici', 'neznamy-obraz-v-odkazu', 'spatne-souvisejici']);
  assert.match(problems[1], /kód „nnnnn“/);
  assert.deepEqual(advice, []);
  assert.deepEqual(workLinkProblems({ works: [work('xua65', { related: [] })] }).problems, [], 'an empty list is no list');
});

test('workLinkProblems: links in texts of any description, advice for a published one linking a draft', () => {
  const works = [work('xua65', { meta_draft: true, related: ['chqmf'] }), work('chqmf', { text: 'Viz [mobi](xua65).', details: { a: '[pf](nnnnn)' } })];
  const descriptions = [
    ...works.map((w) => ({ yamlPath: w.yamlPath, data: w.data, schema: WORK_SCHEMA, draft: Boolean(w.data.meta_draft) })),
    { yamlPath: 'tvorba/sumava/_index.yaml', data: { text: '[Mobi](xua65) a [PF](chqmf) a [web](/tvorba/)' }, schema: COLLECTION_SCHEMA },
  ];
  const { problems, advice } = workLinkProblems({ works, descriptions });
  assert.deepEqual(codes(problems), ['neznamy-obraz-v-odkazu']);
  assert.match(problems[0], /^tvorba\/chqmf\.yaml: odkaz v details a vede na kód „nnnnn“/);
  assert.deepEqual(advice.map((a) => a.slice(0, a.indexOf(':'))), ['tvorba/chqmf.yaml', 'tvorba/sumava/_index.yaml']);
  assert.ok(advice.every((a) => a.endsWith('[odkaz-na-rozpracovany]')));
  assert.match(advice[0], /odkaz v text vede na rozpracovaný obraz tvorba\/xua65\.yaml \(xua65\)/);
});

test('fillWorkLinkTitles: an empty label gets the title of the work, other links and unknown ids stay', () => {
  const titleOf = (id) => ({ chqmf: 'PF 2025', xua65: 'Mobi [duni]' })[id];
  assert.equal(fillWorkLinkTitles('Viz [](chqmf) a [ ](xua65).', titleOf), 'Viz [PF 2025](chqmf) a [Mobi duni](xua65).');
  assert.equal(fillWorkLinkTitles('[vlastní](chqmf) [](nnnnn) [](/tvorba/)', titleOf), '[vlastní](chqmf) [](nnnnn) [](/tvorba/)');
  assert.equal(fillWorkLinkTitles(null, titleOf), null);
});

test('fillDescriptionsWorkLinks: every formatted attribute in place, also details; an unknown empty link is reported', () => {
  const works = [work('chqmf', { title: 'PF 2025', meta_draft: true }), work('xua65', { title: 'Mobi duni', text: 'Viz [](chqmf).', details: { a: '[](xua65)' } })];
  const descriptions = works.map((w) => ({ yamlPath: w.yamlPath, data: w.data, schema: WORK_SCHEMA, draft: Boolean(w.data.meta_draft) }));
  assert.equal(fillDescriptionsWorkLinks(descriptions, works), 2);
  assert.equal(works[1].data.text, 'Viz [PF 2025](chqmf).', 'a draft gets its title too (plain text on the site)');
  assert.deepEqual(works[1].data.details, { a: '[Mobi duni](xua65)' });
  const unknown = workLinkProblems({ works, descriptions: [{ yamlPath: 'f.yaml', data: { text: '[](nnnnn)' }, schema: COLLECTION_SCHEMA }] });
  assert.deepEqual(codes(unknown.problems), ['neznamy-obraz-v-odkazu']);
});
