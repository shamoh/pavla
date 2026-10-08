import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESCRIPTION_MAX, decodeEntities, evaluatePageTexts, jsonLdProblems, pageMeta, pageProblems, problemText } from './page-check.mjs';

const texts = (problems) => problems.map((p) => (p.path ? `${p.path}: ${problemText(p)}` : problemText(p)));

const ld = (data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const good = (name) => ld({ '@context': 'https://schema.org', '@graph': [{ '@type': 'WebPage', name }] });
const html = ({ title = '', description = null, extra = '' } = {}) =>
  `<html><head><title>${title}</title>${description === null ? '' : `<meta name="description" content="${description}">`}${extra}</head></html>`;
const page = (path, title, description, extra = good(title)) => ({ path, html: html({ title, description, extra }) });

test('decodeEntities: named, decimal and hex entities', () => {
  assert.equal(decodeEntities('Ráno &amp; mlha &quot;u jezu&quot; &#8211; &#x2013;'), 'Ráno & mlha "u jezu" – –');
  assert.equal(decodeEntities('&unknown;'), '&unknown;');
});

test('pageMeta: title, description and JSON-LD texts', () => {
  const meta = pageMeta(html({ title: 'Máky · Pavla', description: 'Vlčí máky &amp; cesta.', extra: good('x') + good('y') }));
  assert.equal(meta.title, 'Máky · Pavla');
  assert.equal(meta.description, 'Vlčí máky & cesta.');
  assert.equal(meta.jsonLd.length, 2);
  assert.deepEqual(pageMeta('<html></html>'), { title: '', description: '', jsonLd: [] });
});

test('jsonLdProblems: valid graph or single node; broken JSON, wrong context, node without type', () => {
  assert.deepEqual(jsonLdProblems(JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Person' }] })), []);
  assert.deepEqual(jsonLdProblems(JSON.stringify({ '@context': 'http://schema.org/', '@type': 'Person' })), []);
  assert.match(texts(jsonLdProblems('{"@context": '))[0], /^JSON-LD is not valid JSON/);
  assert.deepEqual(texts(jsonLdProblems('[1]')), ['JSON-LD is not an object']);
  assert.deepEqual(texts(jsonLdProblems(JSON.stringify({ '@context': 'https://example.org', '@type': 'Person' }))), ['JSON-LD without the schema.org @context']);
  assert.deepEqual(texts(jsonLdProblems(JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'A' }, { name: 'x' }] }))), ['JSON-LD node 2 without @type']);
  assert.deepEqual(texts(jsonLdProblems(JSON.stringify({ '@context': 'https://schema.org', '@graph': [] }))), ['JSON-LD with an empty @graph']);
});

test('pageProblems: nothing for distinct, complete pages', () => {
  assert.deepEqual(pageProblems([page('/', 'Úvod', 'Akvarely.'), page('/tvorba/', 'Tvorba', 'Všechny obrazy.')]), []);
});

test('pageProblems: repeated titles and descriptions name the other pages', () => {
  const problems = texts(pageProblems([page('/a/', 'Máky', 'Stejný popis.'), page('/b/', 'Máky', 'Stejný popis.'), page('/c/', 'Jiné', 'Jiný popis.')]));
  assert.deepEqual(problems, [
    '/a/: the same description as /b/',
    '/a/: the same title as /b/',
    '/b/: the same description as /a/',
    '/b/: the same title as /a/',
  ]);
});

test('pageProblems: missing title, description or JSON-LD, too long a description, invalid JSON-LD', () => {
  const long = 'x'.repeat(DESCRIPTION_MAX + 1);
  const problems = texts(pageProblems([
    { path: '/bez/', html: html({ title: '' }) },
    page('/dlouhy/', 'Dlouhý', long),
    page('/spatny/', 'Špatný', 'Popis.', '<script type="application/ld+json">{oops</script>'),
  ]));
  assert.deepEqual(problems.filter((p) => p.startsWith('/bez/')), ['/bez/: no <title>', '/bez/: no meta description', '/bez/: no structured data (JSON-LD)']);
  assert.deepEqual(problems.filter((p) => p.startsWith('/dlouhy/')), [`/dlouhy/: description longer than ${DESCRIPTION_MAX} characters (${DESCRIPTION_MAX + 1})`]);
  assert.match(problems.find((p) => p.startsWith('/spatny/')), /^\/spatny\/: JSON-LD is not valid JSON/);
});

test('pageProblems: structured, for both languages', () => {
  const [problem] = pageProblems([page('/dlouhy/', 'Dlouhý', 'x'.repeat(DESCRIPTION_MAX + 5))]);
  assert.deepEqual(problem, { path: '/dlouhy/', code: 'longDescription', detail: DESCRIPTION_MAX + 5 });
  assert.equal(problemText(problem, 'cs'), `popis delší než ${DESCRIPTION_MAX} znaků (${DESCRIPTION_MAX + 5})`);
  assert.equal(problemText({ code: 'noTitle' }, 'cs'), 'chybí titulek');
});

test('evaluatePageTexts: fine, problems (in Czech, listed up to the limit), noindex pages left out, not checked', () => {
  const notFound = { path: '/404/', html: '<html><head><meta name="robots" content="noindex"><title>Máky</title></head></html>' };
  assert.deepEqual(evaluatePageTexts([page('/', 'Úvod', 'Akvarely.'), page('/tvorba/', 'Tvorba', 'Obrazy.'), notFound]), {
    ok: true, message: 'Texty stránek pro vyhledávače jsou v pořádku (2 stránky: vlastní titulky a popisy, platná strukturovaná data).',
  });
  const bad = evaluatePageTexts([page('/a/', 'Máky', 'Stejný.'), page('/b/', 'Máky', 'Stejný.')], { limit: 3 });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /^Texty stránek pro vyhledávače mají 4 problémy:\n- \/a\/: stejný popis jako \/b\/\n/);
  assert.match(bad.message, /\n- … a dalších 1\n/);
  assert.match(bad.message, /npm run check:images/);
  assert.deepEqual(evaluatePageTexts(null), { ok: true, message: 'Texty stránek pro vyhledávače nebyly zkontrolovány.' });
});
