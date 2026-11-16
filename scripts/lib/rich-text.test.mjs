import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedHref, isWorkHref, linkProblems, workLinkIds, photoMarker, photoProblems, plainText, richBlocks, richTextHtml, richTextMarkdown, richTextPlain, searchDescription, textPhotos,
} from './rich-text.mjs';

const base = { url: (p) => `/base${p}` };

test('richTextHtml: bold, italic and links; addresses on the site get the base', () => {
  assert.equal(richTextHtml('Maluji **akvarelem**, *v přírodě*.'), 'Maluji <strong>akvarelem</strong>, <em>v\u00a0přírodě</em>.');
  assert.equal(richTextHtml('Viz [výběr autorky](/tvorba/?featured=1&page=2).', base), 'Viz <a href="/base/tvorba/?featured=1&amp;page=2">výběr autorky</a>.');
  assert.equal(richTextHtml('[Fler](https://www.fler.cz/x_y*z*)'), '<a href="https://www.fler.cz/x_y*z*" rel="noopener">Fler</a>', 'no emphasis inside an address');
  assert.equal(richTextHtml('[napište **mi**](mailto:pavla@example.cz)'), '<a href="mailto:pavla@example.cz" rel="noopener">napište <strong>mi</strong></a>');
});

test('richTextHtml: plain asterisks, unfinished marks and HTML stay text', () => {
  assert.equal(richTextHtml('5 * 3 = 15 a 2*x'), '5 * 3 = 15 a\u00a02*x');
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

test('photoMarker: a paragraph "[fotka: name, side]", side optional, spaces and case of the word free', () => {
  assert.deepEqual(photoMarker('[fotka: portret, vlevo]'), { name: 'portret', side: 'vlevo' });
  assert.deepEqual(photoMarker('[ Fotka:portret ,VPRAVO ]'), { name: 'portret', side: 'vpravo' });
  assert.deepEqual(photoMarker('[fotka: portret]'), { name: 'portret', side: '' });
  assert.equal(photoMarker('Text [fotka: portret] a dál'), null, 'only a paragraph of its own');
  assert.equal(photoMarker('[fotka portret]'), null);
  assert.equal(photoMarker('[odkaz](/tvorba/)'), null);
});

const TEXT = 'Nahoře přes celou šířku.\n\n[fotka: portret, vlevo]\n\nVedle fotky.\n\n[fotka: ateliér]\n\n[fotka: kontakt, vpravo]';

test('richBlocks: paragraphs as HTML and photos with their side (left by default)', () => {
  assert.deepEqual(richBlocks(TEXT), [
    { html: 'Nahoře přes celou šířku.' },
    { photo: 'portret', side: 'left' },
    { html: 'Vedle fotky.' },
    { photo: 'ateliér', side: 'left' },
    { photo: 'kontakt', side: 'right' },
  ]);
  assert.deepEqual(richBlocks('[fotka: portret, nahoře]'), [{ html: '[fotka: portret, nahoře]' }], 'an unknown side stays a paragraph');
  assert.deepEqual(richBlocks('[x](/a/)', base), [{ html: '<a href="/base/a/">x</a>' }], 'links get the base like richTextHtml');
  assert.deepEqual(textPhotos(TEXT).map((p) => p.name), ['portret', 'ateliér', 'kontakt']);
  assert.deepEqual(richBlocks(undefined), []);
});

test('plainText and searchDescription skip photo markers', () => {
  assert.equal(plainText(TEXT), 'Nahoře přes celou šířku. Vedle fotky.');
  assert.equal(searchDescription({ text: '[fotka: portret]\n\nMaluji.' }), 'Maluji.');
});

test('photoProblems: only where photos may be, a known photo, a known side, a paragraph of its own', () => {
  const photos = new Set(['portret', 'kontakt']);
  assert.deepEqual(photoProblems('stranky/o-mne.yaml', 'text', '[fotka: portret]\n\n[fotka: kontakt, vpravo]\n\nText.', photos), []);
  const codes = (text, known) => photoProblems('f', 'text', text, known).map((p) => p.match(/\[([a-z-]+)\]$/)[1]);
  assert.deepEqual(codes('[fotka: portret]', null), ['fotka-v-textu-nejde'], 'no photos outside the text of a page');
  assert.deepEqual(codes('[fotka: portrét]', photos), ['neznama-fotka-v-textu']);
  assert.deepEqual(codes('[fotka: portret, nahoru]', photos), ['spatna-strana-fotky']);
  assert.deepEqual(codes('[fotka: x, dole]', photos), ['neznama-fotka-v-textu', 'spatna-strana-fotky']);
  assert.deepEqual(codes('Text a [fotka: portret] v něm.', photos), ['fotka-v-textu-sama']);
  assert.deepEqual(codes('Bez fotky, [odkaz](/a/).', null), []);
  assert.match(photoProblems('f', 'text', '[fotka: x]', photos)[0], /je tam: kontakt, portret/, 'names the photos there are');
  assert.deepEqual(photoProblems('f', 'text', null, photos), []);
});

test('richTextHtml: a one-letter word never ends a line (a non-breaking space after it), never inside a tag', () => {
  const nb = '\u00a0';
  assert.equal(richTextHtml('Začalo to v roce 2019 a k tomu i s Kamilou.'), `Začalo to v${nb}roce 2019 a${nb}k${nb}tomu i${nb}s${nb}Kamilou.`);
  assert.equal(richTextHtml('[v lese](/tvorba/) a **s barvou**'), `<a href="/tvorba/">v${nb}lese</a> a${nb}<strong>s${nb}barvou</strong>`);
  assert.equal(richTextHtml('Obraz 30 × 40 cm, např. akvarel'), `Obraz 30${nb}×${nb}40${nb}cm, např.${nb}akvarel`, 'the rules of typography.mjs');
});

test('richTextHtml: a link to a work by its id, to its page or plain text while it is not on the site', () => {
  const work = (id) => (id === 'chqmf' ? '/base/tvorba/2025/pf2025-chqmf/' : null);
  assert.equal(richTextHtml('Viz [PF 2025](chqmf).', { ...base, work }), 'Viz <a href="/base/tvorba/2025/pf2025-chqmf/">PF 2025</a>.');
  assert.equal(richTextHtml('Viz [**obraz**](xua65).', { ...base, work }), 'Viz <strong>obraz</strong>.', 'not on the site: the label only');
  assert.equal(richTextHtml('[PF](chqmf)', base), '<a href="/base/tvorba/chqmf/">PF</a>', 'by default its short link');
  assert.ok(isWorkHref('chqmf') && !isWorkHref('/tvorba/') && !isWorkHref('PF2025') && !isWorkHref('2abcd'));
  assert.equal(richTextMarkdown('[PF](chqmf)', { url: (p) => `https://pavla.example${p}` }), '[PF](https://pavla.example/tvorba/chqmf/)');
  assert.equal(plainText('Viz [PF 2025](chqmf).'), 'Viz PF 2025.');
  assert.deepEqual(linkProblems('f', 'text', '[PF](chqmf)'), [], 'an id is an allowed address');
  assert.deepEqual(workLinkIds('[a](chqmf) [b](/x/) [c](xua65) [d](chqmf)'), ['chqmf', 'xua65']);
  assert.deepEqual(workLinkIds(null), []);
});

test('links to pages of the site get their trailing slash (as written by hand without it)', () => {
  assert.equal(richTextHtml('Viz [kolekce](/tvorba/kolekce) nebo [prodej](/tvorba?status=unsold).', base),
    'Viz <a href="/base/tvorba/kolekce/">kolekce</a> nebo <a href="/base/tvorba/?status=unsold">prodej</a>.');
  assert.equal(richTextHtml('[mapa](/sitemap.xml)', base), '<a href="/base/sitemap.xml">mapa</a>', 'a file stays as written');
  assert.equal(richTextMarkdown('[O mně](/o-mne)', { url: (p) => `https://pavla.example${p}` }), '[O mně](https://pavla.example/o-mne/)');
});
