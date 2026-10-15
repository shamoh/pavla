import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROTOTYPES, PROTOTYPE_FUNCTIONS, fillTemplate, prototypeConfig, prototypeWorks, publicPath, writePrototypes } from './prototypes.mjs';
import { COLUMN_DEFAULTS } from './view-layout.mjs';
import { HOME_RECENT } from './home-view.mjs';
import { TILE_MARK_DEFAULTS } from './tile-marks.mjs';

const templatesDir = new URL('../prototypes/', import.meta.url).pathname;

/** Site data with three works: a collection one with pictures, one on sale, one without pictures. */
function siteData() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prototypes-'));
  const work = (dir, slug, yaml, info) => {
    fs.mkdirSync(path.join(root, 'content', 'tvorba', dir), { recursive: true });
    fs.writeFileSync(path.join(root, 'content', 'tvorba', dir, `${slug}.yaml`), yaml);
    if (info) {
      const folder = path.join(root, 'public', 'tvorba', String(yaml.match(/date: (\d{4})/)[1]), `${slug}-${yaml.match(/id: (\w+)/)[1]}`);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'info.json'), JSON.stringify(info));
    }
  };
  work('plener', 'mlha', 'id: a1b2c\ndate: 2026-05-01\ntitle: Mlha\ntechnique: akvarel\nsize_cm: [30, 21]\nfeatured: true\n', { width: 300, height: 210, widths: [480, 960], transparent: true });
  work('', 'les', 'id: d3e4f\ndate: 2026-07-02\ntitle: Les\nstatus: reserved\n', { width: 200, height: 300, widths: [480] });
  work('', 'bez-obrazku', 'id: g5h6i\ndate: 2026-08-01\ntitle: Bez obrázku\n', null);
  fs.writeFileSync(path.join(root, 'content', 'tvorba', 'plener', '_index.yaml'), 'title: Plenér\n');
  return root;
}

test('prototypeWorks: works with pictures, newest first, with what a prototype needs', () => {
  const works = prototypeWorks(siteData());
  assert.deepEqual(works.map((w) => w.title), ['Les', 'Mlha'], 'no pictures = left out, like on the site; _index.yaml is no work');
  assert.deepEqual(works[1], {
    date: '2026-05-01', title: 'Mlha', sub: 'akvarel · 30 × 21 cm', featured: true, forSale: false,
    ratio: 0.7, transparent: true, widths: [480, 960], folder: 'tvorba/2026/mlha-a1b2c',
  });
  assert.equal(works[0].forSale, true, 'reserved is on sale');
  assert.equal(works[0].sub, '');
  assert.deepEqual(prototypeWorks(path.join(os.tmpdir(), 'no-such-site')), []);
});

test('prototypeConfig: the settings of site.config.yaml with the icons of the site', () => {
  const config = prototypeConfig({ home: { tileMarks: { opacity: 60 }, columns: { maxTop: 30 } } });
  assert.deepEqual(config.recent, HOME_RECENT);
  assert.deepEqual(config.columns, { home: { ...COLUMN_DEFAULTS, maxTop: 30 }, gallery: COLUMN_DEFAULTS });
  assert.deepEqual(config.marks.gallery, TILE_MARK_DEFAULTS);
  assert.equal(config.marks.home.opacity, 60);
  assert.deepEqual(Object.keys(config.icons), ['star', 'cart', 'tag', 'bag']);
  assert.match(config.icons.star, /^<svg viewBox="0 0 24 24">.*<\/svg>$/);
  assert.throws(() => prototypeConfig({ columns: {} }), /moved/, 'bad settings stop it like the build');
});

test('publicPath: from the folder of the pages to public/ of the data', () => {
  assert.equal(publicPath('/a/site/.prototypes', '/a/site'), '../public');
  assert.equal(publicPath('/a/out', '/a/site'), '../site/public');
});

test('fillTemplate: the data as JSON safe in a script, the functions of the site; a missing placeholder is an error', () => {
  const page = fillTemplate('<script>const DATA = /*DATA*/{};\n/*FUNCTIONS*/\n</script>', { works: [{ title: '</script><b>' }] });
  assert.match(page, /const DATA = \{"works":\[\{"title":"\\u003c\/script>\\u003cb>"\}\]\};/);
  for (const fn of PROTOTYPE_FUNCTIONS) assert.ok(page.includes(`function ${fn.name}(`), fn.name);
  assert.throws(() => fillTemplate('<script>/*FUNCTIONS*/</script>', {}), /without \/\*DATA\*\/\{\}/);
  assert.throws(() => fillTemplate('<script>/*DATA*/{}</script>', {}), /without \/\*FUNCTIONS\*\//);
});

test('writePrototypes: both pages from the templates, valid scripts over the data', () => {
  const dataRoot = siteData();
  const outDir = path.join(dataRoot, '.prototypes');
  const files = writePrototypes({ dataRoot, outDir, templatesDir, config: {} });
  assert.deepEqual(files.map((f) => path.basename(f)), Object.keys(PROTOTYPES));
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /\/\*DATA\*\/|\/\*FUNCTIONS\*\//, `${file}: every placeholder filled`);
    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    assert.doesNotThrow(() => new Function(script), file);
    assert.match(html, /"public":"\.\.\/public"/);
    assert.match(html, /"folder":"tvorba\/2026\/les-d3e4f"/);
  }
});
