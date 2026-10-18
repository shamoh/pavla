import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROTOTYPES, PROTOTYPE_FUNCTIONS, fillTemplate, prototypeConfig, prototypeScenes, prototypeWorks, publicPath, writePrototypes } from './prototypes.mjs';
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
    id: 'a1b2c', date: '2026-05-01', title: 'Mlha', sub: 'akvarel · 30 × 21 cm', sizeCm: [30, 21], featured: true, forSale: false,
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
  const files = writePrototypes({ dataRoot, outDir, templatesDir, config: {}, scenes: [scene(dataRoot)] });
  assert.deepEqual(files.map((f) => path.basename(f)), Object.keys(PROTOTYPES));
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /\/\*DATA\*\/|\/\*FUNCTIONS\*\//, `${file}: every placeholder filled`);
    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    assert.doesNotThrow(() => new Function(script), file);
    assert.match(html, /"public":"\.\.\/public"/);
    assert.match(html, /"folder":"tvorba\/2026\/les-d3e4f"/);
    assert.match(html, /"scenes":\[\{"name":"stul"/);
  }
  // every scene of the camera page: the guides on / off and back to the recommended setup
  const camera = fs.readFileSync(path.join(outDir, 'kamera-scen.html'), 'utf8');
  for (const text of ['Pomocné čáry: zapnuto', 'Pomocné čáry: vypnuto', 'Obnovit doporučené', 'jen díla, která se nevejdou', 'id="misfits-only"', "class: 'pointer'", 'mimo fotku', "class: 'zoom'", "'paint-order': 'stroke'", 'zkopírováno', 'Cmd + kolečko', 'press.shift', 'pointLabel(p, [0, -1]', 'pointLabel(scene.center', 'data-layer="obstacles"', 'před obrazem (front)']) assert.ok(camera.includes(text), text);
});

/** A lying scene of an image 1000 × 1250 with its pictures in `dir`/mockups. */
const scene = (dir) => ({
  name: 'stul', label: 'Stůl', mode: 'lie', sheetCm: [40, 30], imageSize: [1000, 1250],
  corners: { tl: [300, 500], tr: [700, 500], br: [760, 800], bl: [240, 800] }, center: [500, 650],
  path: path.join(dir, 'mockups', 'stul.jpg'), sheetPath: path.join(dir, 'mockups', 'stul-list.jpg'),
});

test('prototypeScenes: pictures relative to the page, the pipeline camera and the fitted one as setups', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prototypes-'));
  const [fitted] = prototypeScenes([scene(dir)], path.join(dir, '.prototypes'));
  assert.equal(fitted.image, '../mockups/stul.jpg');
  assert.equal(fitted.sheetImage, '../mockups/stul-list.jpg');
  assert.equal(fitted.source, 'corners');
  assert.deepEqual(fitted.camera, fitted.fitted);
  assert.deepEqual(Object.keys(fitted.camera), ['focalMm', 'zenithDeg', 'azimuthDeg', 'rollDeg', 'distanceCm', 'sheetCenter', 'sheetDeg']);
  assert.deepEqual(fitted.circles, []);
  assert.deepEqual(fitted.lines, { x: [], y: [] });
  assert.equal(fitted.fromLines, null);
  assert.equal(fitted.prompt, null);
  assert.deepEqual([fitted.front, fitted.props, fitted.bounds], [[], [], null]);
  const obstacles = { front: [[[1, 2], [3, 4], [5, 6]]], props: [[[7, 8], [9, 10], [11, 12]]], bounds: [0, 0, 100, 100] };
  const [blocked] = prototypeScenes([{ ...scene(dir), ...obstacles }], dir);
  assert.deepEqual([blocked.front, blocked.props, blocked.bounds], [obstacles.front, obstacles.props, obstacles.bounds]);
  // the settings of the placement and the 4:5 window go along as they are, missing ones stay missing (the defaults of the pipeline)
  const [placed] = prototypeScenes([{ ...scene(dir), maxShiftCm: 1.5, minTiltDeg: 0, maxTiltDeg: 0, propMarginPx: 14, cropTop: 0.4 }], dir);
  assert.deepEqual([placed.maxShiftCm, placed.minTiltDeg, placed.maxTiltDeg, placed.propMarginPx, placed.cropTop], [1.5, 0, 0, 14, 0.4]);
  assert.ok(!('maxZoom' in placed) && !('tiltSign' in fitted));
  assert.equal(prototypeScenes([{ ...scene(dir), prompt: 'kamera 45 cm nad stolem' }], dir)[0].prompt, 'kamera 45 cm nad stolem');
  const setup = { focalMm: 30, zenithDeg: 35, azimuthDeg: 5, rollDeg: 1, distanceCm: 90, sheetCenter: [500, 650] };
  const [manual] = prototypeScenes([{ ...scene(dir), camera: setup }], dir);
  assert.equal(manual.source, 'camera');
  assert.deepEqual(manual.camera, { ...setup, sheetDeg: 0 });
  assert.notDeepEqual(manual.fitted, manual.camera);
  const lines = { x: [[[300, 500], [700, 500]], [[240, 800], [760, 800]]] };
  const [edges] = prototypeScenes([{ ...scene(dir), lines }], dir);
  assert.equal(edges.source, 'lines');
  assert.deepEqual(edges.lines, { ...lines, y: [] });
  assert.deepEqual(edges.fromLines, edges.camera);
});

test('PROTOTYPE_FUNCTIONS: self-contained, they work copied as text', () => {
  const run = new Function(`${PROTOTYPE_FUNCTIONS.map(String).join('\n')}
    const cam = cameraFromAngles({ focalMm: 35, zenithDeg: 30, azimuthDeg: 20, rollDeg: 2, distanceCm: 100 }, [40, 30], [1000, 1250], 'stand');
    const [x, y] = project(cam, 10, 5);
    const fit = fitCameraToLines({ lines: { x: [[project(cam, 0, 0), project(cam, 40, 0)]] }, corners: { tl: project(cam, 0, 0), tr: project(cam, 40, 0), br: project(cam, 40, 30), bl: project(cam, 0, 30) },
      sheetCm: [40, 30], imageSize: [1000, 1250], mode: 'stand' }, cameraAngles(cam, [40, 30], 'stand'));
    // where the pipeline puts a work, lying and standing, with everything planPlacement calls (a missing one throws here)
    const geo = { width: 40, height: 30, toPlane: (x, y, z = 0) => unproject(cam, x, y, z), toImage: (X, Y, z = 0) => project(cam, X, Y, z) };
    const lying = planPlacement({ mode: 'lie', imageSize: [1000, 1250], minTiltDeg: 2, maxTiltDeg: 4, bounds: [0, 0, 1000, 1250],
      props: [[[0, 0], [50, 0], [50, 50]]] }, geo, [20, 15], 'abcde');
    const standing = planPlacement({ mode: 'stand', imageSize: [1000, 1250], props: [], maxSlideCm: 5 }, geo, [20, 15], 'abcde');
    const window = sceneWindow(1000, 1250, workQuad(geo, [20, 15], lying.cx, lying.cy, lying.deg), {});
    return { back: unproject(cam, x, y), angles: cameraAngles(cam, [40, 30], 'stand'), ratio: circleRatio(cam, x, y), fit: fit.lineRms + fit.rms,
      depth: ledgeDepth(cam, [40, 30], [[0, 1100], [1000, 1100]]), line: lineY([[0, 0], [10, 10]], 5), lying, standing, window };`);
  const r = run();
  assert.ok(Math.abs(r.back[0] - 10) < 1e-9 && Math.abs(r.back[1] - 5) < 1e-9);
  assert.ok(Math.abs(r.angles.rollDeg - 2) < 1e-6);
  assert.ok(r.ratio > 0 && r.depth > 30);
  assert.equal(r.line, 5);
  assert.ok(r.fit < 0.1);
  assert.ok(r.lying.fits && r.standing.fits && r.window.width > 0, 'planPlacement and sceneWindow work copied as text');
});
