import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedHref, linkProblems, richTextHtml, richTextMarkdown, richTextPlain } from './rich-text.mjs';

const base = { url: (p) => `/base${p}` };

test('richTextHtml: bold, italic and links; addresses on the site get the base', () => {
  assert.equal(richTextHtml('Maluji **akvarelem**, *v přírodě*.'), 'Maluji <strong>akvarelem</strong>, <em>v přírodě</em>.');
  assert.equal(richTextHtml('Viz [výběr autorky](/tvorba/?featured=1&page=2).', base), 'Viz <a href="/base/tvorba/?featured=1&amp;page=2">výběr autorky</a>.');
  assert.equal(richTextHtml('[Fler](https://www.fler.cz/x_y*z*)'), '<a href="https://www.fler.cz/x_y*z*" rel="noopener">Fler</a>', 'no emphasis inside an address');
  assert.equal(richTextHtml('[napište **mi**](mailto:pavla@example.cz)'), '<a href="mailto:pavla@example.cz" rel="noopener">napište <strong>mi</strong></a>');
});

test('richTextHtml: plain asterisks, unfinished marks and HTML stay text', () => {
  assert.equal(richTextHtml('5 * 3 = 15 a 2*x'), '5 * 3 = 15 a 2*x');
  assert.equal(richTextHtml('**nedokončené'), '**nedokončené');
  assert.equal(richTextHtml('<script>alert("x")</script> & co'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
  assert.equal(richTextHtml('[zlé](javascript:alert)'), '[zlé](javascript:alert)', 'a forbidden address is no link');
  assert.equal(richTextHtml('[zlé](tvorba/)'), '[zlé](tvorba/)');
  assert.equal(richTextHtml(undefined), '');
});

test('richTextPlain: the text without formatting, link labels kept', () => {
  assert.equal(richTextPlain('Maluji **akvarelem**, viz [výběr](/tvorba/) *teď*.'), 'Maluji akvarelem, viz výběr teď.');
});

test('isAllowedHref and linkProblems: https, http, mailto and addresses on the site only', () => {
  for (const ok of ['https://fler.cz', 'http://example.cz/a', 'mailto:a@b.cz', '/', '/tvorba/?featured=1']) assert.ok(isAllowedHref(ok), ok);
  for (const bad of ['www.fler.cz', 'tvorba/', '//evil.cz', 'javascript:alert(1)', 'mailto:nikdo', 'https://']) assert.ok(!isAllowedHref(bad), bad);
  assert.deepEqual(linkProblems('stranky/o-mne.yaml', 'text', 'A [x](/ok/) a [y](www.fler.cz).').length, 1);
  assert.match(linkProblems('f', 'closing', '[y](www.fler.cz)')[0], /^f: odkaz „\[y\]\(www\.fler\.cz\)“ v closing .*\[spatny-odkaz-v-textu\]$/);
  assert.deepEqual(linkProblems('f', 'text', null), []);
});

test('richTextMarkdown: the same formatting for GitHub, full addresses of the site, everything else escaped', () => {
  const url = (p) => `https://pavla.example${p}`;
  assert.equal(richTextMarkdown('Maluji **akvarelem**, *venku*. Viz [výběr **autorky**](/tvorba/?featured=1).', { url }),
    'Maluji **akvarelem**, *venku*. Viz [výběr **autorky**](https://pavla.example/tvorba/?featured=1).');
  assert.equal(richTextMarkdown('[Fler](https://www.fler.cz/a_b)', { url }), '[Fler](https://www.fler.cz/a_b)', 'external addresses as written');
  assert.equal(richTextMarkdown('5 * 3 # <b>x</b> & a_b'), '5 \\* 3 \\# \\<b\\>x\\</b\\> &amp; a_b', 'nothing GitHub would format by itself');
  assert.equal(richTextMarkdown('[zlé](www.fler.cz)'), '\\[zlé\\](www.fler.cz)', 'a forbidden address stays text');
  assert.equal(richTextMarkdown('řádek\n  dva'), 'řádek dva');
});
