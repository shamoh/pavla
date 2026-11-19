import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRAGILE_TARGET, INLINE_TARGETS, evaluateInlineScripts, htmlElements, inlineProblemText, inlineScriptProblems, viewSetupProblem } from './inline-targets.mjs';
import { viewScript, viewSetup } from './view-layout.mjs';
import { homeRecent, homeScript, homeSetup } from './home-view.mjs';
import { DEFAULT_VIEW, TILE_SIZE_STORAGE_KEY, VIEW_STORAGE_KEY } from './gallery-filter.mjs';
import { randomPickScript } from './random-pick.mjs';

const page = (body) => ({ path: '/', html: `<!doctype html><html><head><title>T</title></head><body>${body}</body></html>` });
const inline = (script) => `<script>${script}</script>`;
const heartsScript = '<script type="module" src="/_astro/WorkGrid.js"></script>';
// the setups of the site: the gallery (WorkGallery.astro) and "Nejnovější" (index.astro)
const gallerySetup = viewSetup({ defaultView: DEFAULT_VIEW, linkKeys: ['view', 'tile', 'page', 'perPage'], keys: { view: VIEW_STORAGE_KEY, tile: TILE_SIZE_STORAGE_KEY } });
const homeGridSetup = homeSetup(homeRecent(), 'cov01');
const attribute = (data) => JSON.stringify(data).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const grid = (id = 'recent', setup = homeGridSetup) => `<div class="grid" id="${id}" data-view="${attribute(setup)}"><a class="card" data-id="a1"><img src="a.jpg" alt=""></a><svg><path d="M0 0"/></svg></div>`;
const coverBox = '<div class="cover" data-pick-box data-pick-exclude="#recent"><a data-pick data-id="a1" hidden></a></div>';

test('htmlElements: elements in order with their parent, attributes and the text of scripts', () => {
  const elements = htmlElements('<div id="x" data-view=\'{"a":1}\'><br><img src="a" alt=""><p>a <b>b</b></p><path/></div><script>if (a < b && c > d) x("</div>");</script><span hidden></span>');
  assert.deepEqual(elements.map((e) => e.tag), ['div', 'br', 'img', 'p', 'b', 'path', 'script', 'span']);
  assert.deepEqual(elements.map((e) => e.parent), [-1, 0, 0, 0, 3, 0, -1, -1]);
  assert.deepEqual([...elements[0].attributes.keys()], ['id', 'data-view']);
  assert.equal(elements[6].content, 'if (a < b && c > d) x("</div>");');
  assert.ok(elements[7].attributes.has('hidden'), 'an attribute without a value');
});

test('htmlElements: comments and the doctype are no elements; a raw element ends at its closing tag', () => {
  const elements = htmlElements('<!doctype html><!-- <div> --><style>a > b { }</style><textarea><p></textarea><i></i>');
  assert.deepEqual(elements.map((e) => e.tag), ['style', 'textarea', 'i']);
  assert.equal(elements[1].content, '<p>');
  assert.equal(elements[2].parent, -1);
});

test('inlineScriptProblems: the scripts of the site find their elements, also past a component script', () => {
  assert.deepEqual(inlineScriptProblems([page(`<section>${grid()}${inline(homeScript)}</section>`)]), []);
  assert.deepEqual(inlineScriptProblems([page(`<section>${grid()}${heartsScript}${inline(homeScript)}</section>`)]), []);
  assert.deepEqual(inlineScriptProblems([page(`${grid('grid')}${heartsScript}${inline(viewScript)}<p id="empty"></p>`)]), []);
  assert.deepEqual(inlineScriptProblems([page(`<section class="hero">${coverBox}${inline(randomPickScript)}<div>text</div></section>`)]), []);
});

test('inlineScriptProblems: a script without its element (none, or not a sibling) = missing', () => {
  assert.deepEqual(inlineScriptProblems([page(`<section>${inline(homeScript)}</section>`)]), [
    { path: '/', code: 'skript-bez-prvku', detail: { finder: 'viewGridBefore', attribute: 'data-view' } },
  ]);
  assert.deepEqual(inlineScriptProblems([page(`<div>${grid()}</div>${inline(viewScript)}`)]), [
    { path: '/', code: 'skript-bez-prvku', detail: { finder: 'viewGridBefore', attribute: 'data-view' } },
  ], 'the grid inside another element is no sibling');
  assert.deepEqual(inlineScriptProblems([page(`${inline(randomPickScript)}${coverBox}`)]), [
    { path: '/', code: 'skript-bez-prvku', detail: { finder: 'pickBoxBefore', attribute: 'data-pick-box' } },
  ], 'the box after the script is too late');
  assert.deepEqual(inlineScriptProblems([page(`${grid()}${inline(randomPickScript)}`)]).map((p) => p.detail.attribute), ['data-pick-box'], 'another marker does not do');
});

test('inlineScriptProblems: a script that takes the element right before it = fragile (the bug of "Nejnovější")', () => {
  const before = `(function () { startHome(${FRAGILE_TARGET}); })();`;
  assert.deepEqual(inlineScriptProblems([page(`${grid()}${heartsScript}${inline(before)}`)]), [{ path: '/', code: 'skript-bere-predchozi-prvek' }]);
  assert.deepEqual(inlineScriptProblems([page(`${grid()}${inline(before)}`)]), [{ path: '/', code: 'skript-bere-predchozi-prvek' }], 'even while it still works');
});

test('inlineScriptProblems: module scripts and other inline scripts are left alone', () => {
  assert.deepEqual(inlineScriptProblems([page(`${heartsScript}${inline('document.documentElement.dataset.palette = "noc";')}`)]), []);
  assert.deepEqual(INLINE_TARGETS.map((t) => t.finder), ['viewGridBefore', 'pickBoxBefore']);
});

test('htmlElements: attribute values with entities decoded, null without a value', () => {
  const [div] = htmlElements('<div data-view="{&quot;a&quot;:1}" hidden data-x=\'b\' data-y=c></div>');
  assert.equal(div.attributes.get('data-view'), '{"a":1}');
  assert.equal(div.attributes.get('hidden'), null);
  assert.equal(div.attributes.get('data-x'), 'b');
  assert.equal(div.attributes.get('data-y'), 'c');
});

test('viewSetupProblem: the setups of the site are fine', () => {
  assert.equal(viewSetupProblem(JSON.stringify(gallerySetup)), null);
  assert.equal(viewSetupProblem(JSON.stringify(homeGridSetup)), null);
});

test('viewSetupProblem: keys, views and tiles with their defaults, every reason', () => {
  const broken = (change) => viewSetupProblem(JSON.stringify({ ...gallerySetup, ...change }));
  assert.equal(broken({ keys: undefined }), 'keys without view and tile');
  assert.equal(broken({ keys: { view: 'pavla.gallery.view' } }), 'keys without view and tile');
  assert.equal(broken({ keys: { view: '', tile: 'x' } }), 'keys without view and tile');
  assert.equal(broken({ views: [] }), 'views is not a list of names');
  assert.equal(broken({ views: 'grid' }), 'views is not a list of names');
  assert.equal(broken({ tiles: ['s', 2] }), 'tiles is not a list of names');
  assert.equal(broken({ defaultView: 'mosaic' }), 'defaultView "mosaic" is not among views');
  assert.equal(broken({ defaultTile: undefined }), 'defaultTile null is not among tiles');
  assert.equal(viewSetupProblem('{"a":1}'), 'keys without view and tile; views is not a list of names; tiles is not a list of names');
});

test('viewSetupProblem and inlineScriptProblems: no JSON object = a problem of the grid a script finds', () => {
  assert.equal(viewSetupProblem('[1]'), 'not an object');
  assert.equal(viewSetupProblem('null'), 'not an object');
  assert.match(viewSetupProblem('{a:1'), /JSON/);
  assert.match(viewSetupProblem(null), /JSON/, 'an attribute without a value');
  assert.deepEqual(inlineScriptProblems([page('<button data-view="tiles"></button>')]), [], 'a button of the switch is no grid');
  const problems = inlineScriptProblems([page(`<div id="recent" data-view="{broken"></div>${inline(homeScript)}`)]);
  assert.deepEqual(problems.map((p) => p.code), ['data-view-neplatny']);
  assert.match(inlineProblemText(problems[0]), /^data-view is not a valid grid setup \(/);
  assert.match(inlineProblemText(problems[0], 'cs'), /^nastavení mřížky \(data-view\) není v pořádku \(/);
  const noTiles = { ...homeGridSetup, tiles: [] };
  assert.deepEqual(inlineScriptProblems([page(`${grid('recent', noTiles)}${heartsScript}${inline(homeScript)}`)]), [
    { path: '/', code: 'data-view-neplatny', detail: 'tiles is not a list of names' },
  ]);
});

test('evaluateInlineScripts: fine, problems in Czech with codes (up to the limit), not checked', () => {
  assert.deepEqual(evaluateInlineScripts([page(`${grid('grid', gallerySetup)}${inline(viewScript)}`), page('<p></p>')]), {
    ok: true, message: 'Vložené skripty stránek najdou své prvky (2 stránky).',
  });
  const bad = evaluateInlineScripts([
    { path: '/', html: `<div>${inline(homeScript)}</div>` },
    { path: '/a/', html: `${grid()}${inline(`x(${FRAGILE_TARGET})`)}` },
    { path: '/b/', html: `<div data-view="[]"></div>${inline(viewScript)}` },
  ], { limit: 2 });
  assert.equal(bad.ok, false);
  assert.match(bad.message, /^Vložené skripty stránek mají 3 problémy/);
  assert.match(bad.message, /\n- \/: vložený skript viewGridBefore nenajde před sebou prvek s data-view \[skript-bez-prvku\]\n/);
  assert.match(bad.message, /\[skript-bere-predchozi-prvek\]\n- … a dalších 1\n/);
  assert.deepEqual(evaluateInlineScripts(null), { ok: true, message: 'Vložené skripty stránek nebyly zkontrolovány.' });
});
