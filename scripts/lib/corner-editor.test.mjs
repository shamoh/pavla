import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';
import {
  EDITOR_FUNCTIONS, clickTarget, guideStyle, rectangleDeviation, snapPoint, cornersToPoints, editorPage, editorWorks, crossedCorners, editorYaml, keyAction, nearestCorner, nextZoom, pointsToCorners, zoomView, replaceCorners, route, trustedRequest,
} from './corner-editor.mjs';
import { cornersYaml } from './corners.mjs';
import { skeleton } from './metadata-yaml.mjs';
import { WORK_SCHEMA } from './schema.mjs';

let tmp;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pavla-corner-editor-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

const photo = async (rel) => {
  const file = path.join(tmp, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#96694a"/>'
    + '<polygon points="24,16 376,24 372,284 18,278" fill="#f0eee6"/></svg>';
  await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toFile(file);
  return file;
};

const value = { photo: [400, 300], tl: [24, 16], tr: [24, 24], br: [28, 16], bl: [18, 22] };

test('pointsToCorners / cornersToPoints: px in from each corner and back', () => {
  const points = [[24, 16], [376, 24], [372, 284], [18, 278]];
  assert.deepEqual(pointsToCorners(points, [400, 300]), value);
  assert.deepEqual(cornersToPoints(value), points);
});

test('pointsToCorners: rounds and keeps the corners inside the photo', () => {
  const v = pointsToCorners([[-5, 3.6], [410, -2], [399.4, 300], [0.4, 320]], [400, 300]);
  assert.deepEqual(v, { photo: [400, 300], tl: [0, 4], tr: [0, 0], br: [1, 0], bl: [0, 0] });
});

test('editorYaml: the same text as cornersYaml of the pipeline', () => {
  assert.equal(editorYaml(value), cornersYaml(value));
});

test('EDITOR_FUNCTIONS: self-contained, they work copied as source text', () => {
  const copied = new Function(`${EDITOR_FUNCTIONS.map(String).join('\n')}; return { pointsToCorners, cornersToPoints, editorYaml, nextZoom, crossedCorners, zoomView, keyAction, nearestCorner, clickTarget, rectangleDeviation, guideStyle, snapPoint };`)();
  assert.deepEqual(copied.pointsToCorners(cornersToPoints(value), [400, 300]), value);
  assert.equal(copied.editorYaml(value), editorYaml(value));
  assert.equal(copied.nextZoom(['2', '4', '8'], '4'), '8');
  assert.deepEqual(copied.zoomView({ scale: 1, x: 0, y: 0 }, [0, 0], 2), { scale: 2, x: 0, y: 0 });
  assert.deepEqual(copied.rectangleDeviation([[0, 0], [10, 0], [10, 10], [0, 10]]), { left: 0, right: 0, top: 0, bottom: 0 });
  assert.equal(copied.guideStyle(0, 1000).hue, 120);
  assert.deepEqual(copied.snapPoint([[0, 0], [10, 0], [10, 10], [0, 10]], 0, [2, 1], 3), [0, 0]);
  assert.equal(copied.clickTarget([[0, 0], [10, 0], [10, 10], [0, 10]], [9, 9], 0, true), 0);
  assert.equal(copied.nearestCorner([[0, 0], [10, 0], [10, 10], [0, 10]], [9, 9]), 2);
  assert.deepEqual(copied.keyAction({ key: '0', code: 'Digit0' }), { actual: true });
  assert.deepEqual(copied.crossedCorners([[0, 0], [10, 0], [10, 10], [0, 10]]), []);
});

test('crossedCorners: a left corner right of a right one, a top one below a bottom one', () => {
  const square = [[0, 0], [100, 0], [100, 80], [0, 80]];
  assert.deepEqual(crossedCorners(square), [], 'a sheet');
  assert.deepEqual(crossedCorners(cornersToPoints(value)), [], 'a slanted sheet');
  const tlRight = crossedCorners([[120, 0], [100, 0], [100, 80], [0, 80]]);
  assert.deepEqual(tlRight.map((c) => c.corners), [[0, 1], [0, 2]]);
  assert.deepEqual(tlRight.map((c) => c.text), ['tl není vlevo od tr', 'tl není vlevo od br']);
  const brHigh = crossedCorners([[0, 0], [100, 0], [100, -5], [0, 80]]);
  assert.deepEqual(brHigh.map((c) => c.corners), [[0, 2], [1, 2]]);
  assert.equal(brHigh[0].text, 'tl není nad br');
  assert.deepEqual(crossedCorners([[50, 0], [50, 0], [100, 80], [0, 80]]).map((c) => c.corners), [[0, 1]], 'the same x counts as crossed');
  assert.equal(crossedCorners([[100, 80], [0, 80], [0, 0], [100, 0]]).length, 8, 'turned round');
});

test('zoomView: the photo point under the zoom centre stays there, the scale within its limits', () => {
  const view = { scale: 0.5, x: 20, y: 10 };
  const at = (v, [sx, sy]) => [(sx - v.x) / v.scale, (sy - v.y) / v.scale];
  for (const factor of [1.25, 1 / 1.25]) {
    const zoomed = zoomView(view, [300, 200], factor);
    assert.equal(zoomed.scale, view.scale * factor);
    assert.deepEqual(at(zoomed, [300, 200]), at(view, [300, 200]));
  }
  assert.equal(zoomView({ scale: 15, x: 0, y: 0 }, [0, 0], 2).scale, 16);
  assert.equal(zoomView({ scale: 0.03, x: 0, y: 0 }, [0, 0], 0.1).scale, 0.02);
  assert.deepEqual(zoomView(view, [300, 200], 1), view, 'no zoom, no move');
});

test('nearestCorner: the corner closest to the click, wherever it is', () => {
  const sheet = [[20, 15], [380, 25], [370, 280], [15, 275]];
  assert.deepEqual([[0, 0], [400, 0], [400, 300], [0, 300]].map((p) => nearestCorner(sheet, p)), [0, 1, 2, 3]);
  assert.equal(nearestCorner(sheet, [150, 140]), 0, 'inside, nearer to tl');
  assert.equal(nearestCorner(sheet, [390, 290]), 2, 'outside the sheet');
  assert.equal(nearestCorner([[0, 0], [10, 0], [10, 10], [0, 10]], [5, 5]), 0, 'a tie: the first one');
  const crossed = [[390, 20], [380, 25], [370, 280], [15, 275]];
  assert.equal(nearestCorner(crossed, [392, 18]), 0, 'crossed corners too');
});

test('rectangleDeviation: how far each side is from upright, in photo px', () => {
  assert.deepEqual(rectangleDeviation([[20, 15], [380, 25], [370, 280], [15, 275]]), { left: 5, right: 10, top: 10, bottom: 5 });
  assert.deepEqual(rectangleDeviation([[20, 15], [380, 15], [380, 280], [20, 280]]), { left: 0, right: 0, top: 0, bottom: 0 });
  assert.equal(rectangleDeviation([[30, 0], [0, 0], [0, 0], [10, 0]]).left, 20, 'either way round');
});

test('guideStyle: green and bold on the same place, through yellow to red at 1 % of the photo, then red and bold', () => {
  assert.deepEqual(guideStyle(0, 4000), { hue: 120, width: 2, alpha: 0.9 });
  assert.deepEqual(guideStyle(40, 4000), { hue: 0, width: 2, alpha: 0.9 }, '1 % of 4000 px');
  assert.deepEqual(guideStyle(400, 4000), { hue: 0, width: 2, alpha: 0.9 });
  assert.deepEqual(guideStyle(20, 4000), { hue: 60, width: 1, alpha: 0.6 }, 'half way: yellow');
  const hues = [1, 10, 20, 30, 39].map((d) => guideStyle(d, 4000).hue);
  assert.deepEqual(hues, [...hues].sort((a, b) => b - a), 'redder the farther');
  assert.ok(hues.every((h) => h > 0 && h < 120));
  assert.deepEqual(guideStyle(2, 4000, 0.0005), { hue: 0, width: 2, alpha: 0.9 }, 'its own share');
  assert.equal(guideStyle(1, 10).hue, 0, 'a tiny photo: red from 1 px');
});

test('snapPoint: to the nearest guide of another corner within the tolerance, each direction alone', () => {
  const sheet = [[20, 15], [380, 25], [370, 280], [15, 275]];
  assert.deepEqual(snapPoint(sheet, 0, [19, 40], 6), [15, 40], 'to the vertical of bl');
  assert.deepEqual(snapPoint(sheet, 0, [23, 40], 6), [23, 40], 'its own old place is no guide');
  assert.deepEqual(snapPoint(sheet, 0, [100, 23], 6), [100, 25], 'to the horizontal of tr');
  assert.deepEqual(snapPoint(sheet, 0, [17, 27], 6), [15, 25], 'both at once, the nearest one (bl 15, not its own 20)');
  assert.deepEqual(snapPoint(sheet, 0, [40, 60], 6), [40, 60], 'far from all: unchanged');
  assert.deepEqual(snapPoint(sheet, 2, [377, 280], 6), [380, 275], 'br to the vertical of tr and the horizontal of bl');
  assert.deepEqual(snapPoint(sheet, 2, [377, 280], 2), [377, 280], 'outside a smaller tolerance');
});

test('clickTarget: the nearest corner, with Shift the chosen one', () => {
  const sheet = [[20, 15], [380, 25], [370, 280], [15, 275]];
  assert.equal(clickTarget(sheet, [390, 290], 0, false), 2);
  assert.equal(clickTarget(sheet, [390, 290], 0, true), 0, 'Shift: the chosen tl, far from the click');
  assert.equal(clickTarget(sheet, [10, 10], 3, true), 3);
  assert.equal(clickTarget(sheet, [10, 10], 3, false), 0);
});

test('keyAction: corners, the view and the loupes, on an English and a Czech keyboard', () => {
  assert.deepEqual(keyAction({ key: 'ArrowLeft' }), { move: [-1, 0] });
  assert.deepEqual(keyAction({ key: 'ArrowDown', shiftKey: true }), { move: [0, 10] });
  assert.deepEqual(keyAction({ key: 'ArrowRight', altKey: true }), { pan: [50, 0] });
  assert.deepEqual(keyAction({ key: 'ArrowUp', altKey: true, shiftKey: true }), { pan: [0, -250] });
  // English: the digits, = as + and -
  assert.deepEqual(['1', '2', '3', '4'].map((key) => keyAction({ key, code: `Digit${key}` })), [0, 1, 2, 3].map((corner) => ({ corner })));
  assert.deepEqual(keyAction({ key: '0', code: 'Digit0' }), { actual: true });
  assert.deepEqual(keyAction({ key: '=', code: 'Equal' }), { zoom: 1.25 });
  assert.deepEqual(keyAction({ key: '-', code: 'Minus' }), { zoom: 0.8 });
  // Czech: é ě š č by the place of the key, its key of 1 is +, Shift gives the digits
  assert.deepEqual(keyAction({ key: 'é', code: 'Digit0' }), { actual: true });
  assert.deepEqual(['ě', 'š', 'č'].map((key, i) => keyAction({ key, code: `Digit${i + 2}` })), [1, 2, 3].map((corner) => ({ corner })));
  assert.deepEqual(keyAction({ key: '+', code: 'Digit1' }), { zoom: 1.25 });
  assert.deepEqual(keyAction({ key: '1', code: 'Digit1', shiftKey: true }), { corner: 0 });
  assert.deepEqual(keyAction({ key: '-', code: 'Slash' }), { zoom: 0.8 });
  assert.deepEqual(keyAction({ key: '?', code: 'Comma', shiftKey: true }), { help: true });
  // letters either case, Shift+Z back
  assert.deepEqual([keyAction({ key: 'f' }), keyAction({ key: 'D' }), keyAction({ key: 'g' }), keyAction({ key: 'G' })], [{ fit: true }, { darken: true }, { guides: true }, { guides: true }]);
  assert.deepEqual([keyAction({ key: 'z' }), keyAction({ key: 'Z', shiftKey: true })], [{ loupeZoom: 1 }, { loupeZoom: -1 }]);
  // Ctrl / Cmd belong to the browser (copy, its own zoom) and to the loupe at the cursor; other keys do nothing
  assert.equal(keyAction({ key: 'c', metaKey: true }), null);
  assert.equal(keyAction({ key: '0', code: 'Digit0', ctrlKey: true }), null);
  assert.equal(keyAction({ key: 'ArrowLeft', metaKey: true }), null);
  assert.equal(keyAction({ key: '5', code: 'Digit5' }), null);
  assert.equal(keyAction({ key: 'x' }), null);
  assert.equal(keyAction({ key: 'Control' }), null);
});

test('nextZoom: the next level round and round, back with Shift, an unknown one starts at the first', () => {
  const levels = ['2', '4', '8'];
  assert.deepEqual(['2', '4', '8'].map((z) => nextZoom(levels, z)), ['4', '8', '2']);
  assert.deepEqual(['2', '4', '8'].map((z) => nextZoom(levels, z, true)), ['8', '2', '4']);
  assert.equal(nextZoom(levels, '3'), '2');
});

test('editorPage: fills the settings and functions, a missing placeholder is an error', () => {
  const page = editorPage('<script>/*FUNCTIONS*/\nconst CONFIG = /*DATA*/{};</script>', { suspicious: 0.07 });
  assert.match(page, /const CONFIG = \{"suspicious":0\.07\}/);
  assert.match(page, /function pointsToCorners/);
  assert.throws(() => editorPage('<script></script>'), /missing/);
});

test('replaceCorners: adds missing corners, replaces existing ones, changes nothing else', () => {
  const text = skeleton(WORK_SCHEMA, { id: 'k3f9a', title: 'Ráno', date: '2026-10-01' });
  const added = replaceCorners(text, value);
  assert.ok(!added.problem);
  assert.deepEqual(YAML.parse(added.text).meta_corners, value);
  const other = { ...value, tl: [1, 2] };
  const replaced = replaceCorners(added.text, other);
  const data = YAML.parse(replaced.text);
  assert.deepEqual(data.meta_corners, other);
  assert.equal((replaced.text.match(/meta_corners:/g) ?? []).length, 1);
  assert.deepEqual({ ...data, meta_corners: null }, { ...YAML.parse(added.text), meta_corners: null });
  assert.equal(replaceCorners(replaced.text, other).text, replaced.text, 'idempotent');
  const off = replaceCorners(text.replace(/^title:/m, 'meta_corners: false\ntitle:'), value);
  assert.deepEqual(YAML.parse(off.text).meta_corners, value, 'false is replaced too');
});

test('replaceCorners: the comments of the file stay, only the lines of the corners change', () => {
  const header = '# Header of the file.\n# Second line.\n\n';
  const added = replaceCorners(header + skeleton(WORK_SCHEMA, { id: 'k3f9a', title: 'Ráno', date: '2026-10-01' }), value).text;
  assert.ok(added.startsWith(header));
  const replaced = replaceCorners(added, { ...value, tl: [1, 2], br: [3, 4] }).text;
  const changed = (a, b) => a.split('\n').filter((line, i) => line !== b.split('\n')[i]);
  assert.equal(replaced.split('\n').length, added.split('\n').length);
  assert.deepEqual(changed(replaced, added).sort(), ['  br: [3, 4]', '  tl: [1, 2]']);
  assert.ok(replaceCorners(added, false).text.startsWith(header), 'false too');
});

test('replaceCorners: a description the schema check refuses stays as it is', () => {
  const text = 'draft: true\ntitle: Ráno\n';
  const r = replaceCorners(text, value);
  assert.ok(r.problem);
  assert.equal(r.text, text);
});

test('editorWorks: master photos with their description, drafts marked, details left out', async () => {
  await photo('tvorba/rano.jpg');
  await fs.writeFile(path.join(tmp, 'tvorba/rano.yaml'), 'meta_draft: false\nid: k3f9a\ntitle: Ráno\n');
  await photo('tvorba/rano/detail.jpg');
  await photo('tvorba/plener/vecer.jpg');
  const works = await editorWorks(tmp);
  assert.deepEqual(works, [
    { key: 'tvorba/plener/vecer.jpg', yaml: null, title: 'vecer', id: null, draft: true, corners: null },
    { key: 'tvorba/rano.jpg', yaml: 'tvorba/rano.yaml', title: 'Ráno', id: 'k3f9a', draft: false, corners: null },
  ]);
});

test('route: page, works, photo, detection', async () => {
  await photo('tvorba/rano.jpg');
  assert.equal((await route(tmp, '<p>page</p>', 'GET', '/')).body, '<p>page</p>');
  assert.equal(JSON.parse((await route(tmp, '', 'GET', '/api/works')).body).length, 1);
  const img = await route(tmp, '', 'GET', '/api/photo?key=tvorba%2Frano.jpg');
  assert.equal(img.type, 'image/jpeg');
  assert.deepEqual([(await sharp(img.body).metadata()).width, (await sharp(img.body).metadata()).height], [400, 300]);
  const found = JSON.parse((await route(tmp, '', 'GET', '/api/detect?key=tvorba/rano.jpg')).body).value;
  assert.deepEqual(found.photo, [400, 300]);
  assert.ok(found.tl[0] >= 20 && found.tl[0] <= 30, JSON.stringify(found));
});

test('route: only listed photos, never another path', async () => {
  await photo('tvorba/rano.jpg');
  await photo('fotky/portret.jpg');
  for (const key of ['fotky/portret.jpg', '../x.jpg', 'tvorba/../fotky/portret.jpg']) {
    assert.equal((await route(tmp, '', 'GET', `/api/photo?key=${encodeURIComponent(key)}`)).status, 404, key);
  }
  assert.equal((await route(tmp, '', 'GET', '/other')).status, 404);
});

test('route: POST /api/corners writes the description, checks the value and the photo size', async () => {
  await photo('tvorba/rano.jpg');
  const yamlFile = path.join(tmp, 'tvorba/rano.yaml');
  await fs.writeFile(yamlFile, skeleton(WORK_SCHEMA, { id: 'k3f9a', title: 'Ráno', date: '2026-10-01' }));
  const post = (v) => route(tmp, '', 'POST', '/api/corners', JSON.stringify({ key: 'tvorba/rano.jpg', value: v }));

  const ok = await post(value);
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(ok.body), { written: 'tvorba/rano.yaml', yaml: editorYaml(value) });
  assert.deepEqual(YAML.parse(await fs.readFile(yamlFile, 'utf8')).meta_corners, value);

  const before = await fs.readFile(yamlFile, 'utf8');
  const wrongSize = await post({ ...value, photo: [800, 600] });
  assert.equal(wrongSize.status, 400);
  assert.match(JSON.parse(wrongSize.body).error, /spatne-rohy/);
  assert.equal((await post({ ...value, tl: [200, 0] })).status, 400, 'too far from its corner');
  assert.equal(await fs.readFile(yamlFile, 'utf8'), before, 'nothing written on a refused value');
});

test('route: POST without a description is refused, nothing created', async () => {
  await photo('tvorba/rano.jpg');
  const r = await route(tmp, '', 'POST', '/api/corners', JSON.stringify({ key: 'tvorba/rano.jpg', value }));
  assert.equal(r.status, 400);
  await assert.rejects(fs.access(path.join(tmp, 'tvorba/rano.yaml')));
});

test('trustedRequest: only the editor itself, writes only from its own page', () => {
  assert.ok(trustedRequest('GET', { host: '127.0.0.1:4327' }, 4327));
  assert.ok(trustedRequest('GET', { host: 'localhost:4327' }, 4327));
  assert.ok(!trustedRequest('GET', { host: 'evil.example:4327' }, 4327), 'a name pointing here');
  assert.ok(trustedRequest('POST', { host: '127.0.0.1:4327', origin: 'http://127.0.0.1:4327' }, 4327));
  assert.ok(!trustedRequest('POST', { host: '127.0.0.1:4327', origin: 'https://evil.example' }, 4327), 'another site');
  assert.ok(!trustedRequest('POST', { host: '127.0.0.1:4327' }, 4327), 'a write without Origin');
});

test('the page: the loupes of the corners open at 2×, with 4× and 8× to switch to', async () => {
  const html = await fs.readFile(new URL('../corners.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="zoom">(.*?)<\/select>/)[1];
  assert.deepEqual([...select.matchAll(/value="(\d+)"/g)].map((m) => m[1]), ['2', '4', '8']);
  assert.deepEqual([...select.matchAll(/value="(\d+)" selected/g)].map((m) => m[1]), ['2']);
});
