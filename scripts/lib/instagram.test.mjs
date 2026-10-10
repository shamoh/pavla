import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  captionFacts, captionLayout, converge, extendToLedge, fitText, hashtag, homography, insetWork, instagramPost, instagramSuffixes, untranslatedWords, lineY, loadFonts, loadInstagramScenes,
  panoramaSlides, panoramaSuffixes, planPlacement, quadFits, renderCaption, renderPanorama, renderScene, renderStory, sceneGeometry, sceneWindow, siteHost,
  storyLayout, textPath, tiltDeg, workQuad,
} from './instagram.mjs';
import { PALETTES } from './palettes.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const square = [[100, 100], [500, 100], [500, 400], [100, 400]];

test('instagramSuffixes: a caption for every palette, then every scene', () => {
  assert.deepEqual(instagramSuffixes(['papir', 'noc'], ['stul', 'stojan']), ['-caption-papir', '-caption-noc', '-scene-stul', '-scene-stojan']);
  assert.deepEqual(instagramSuffixes([], []), []);
});

test('captionFacts: technique · size · year, missing ones left out', () => {
  assert.equal(captionFacts({ technique: 'akvarel', size_cm: [30, 21.5] }, '2026'), 'akvarel · 30 × 21,5 cm · 2026');
  assert.equal(captionFacts({ technique: 'akvarel' }, '2026'), 'akvarel · 2026');
  assert.equal(captionFacts({}, ''), '');
});

test('siteHost: the address without scheme and slash', () => {
  assert.equal(siteHost('https://pavla.kramolis.cz'), 'pavla.kramolis.cz');
  assert.equal(siteHost('https://pavla.kramolis.cz/'), 'pavla.kramolis.cz');
  assert.equal(siteHost('pavla.kramolis.cz/'), 'pavla.kramolis.cz');
});

test('homography maps the corners exactly and its inverse undoes it', () => {
  const plane = [[0, 0], [40, 0], [40, 30], [0, 30]];
  const quad = [[133, 662], [730, 598], [896, 919], [157, 1018]];
  const toImage = homography(plane, quad), toPlane = homography(quad, plane);
  plane.forEach((p, i) => { const [x, y] = toImage(...p); close(x, quad[i][0], 1e-6); close(y, quad[i][1], 1e-6); });
  const [x, y] = toPlane(...toImage(12.5, 7));
  close(x, 12.5); close(y, 7);
});

test('converge: shortens the far edge towards its middle, the near edge stays', () => {
  assert.deepEqual(converge(square, 'top', 0), square);
  const q = converge(square, 'top', 0.1);
  assert.deepEqual(q.slice(2), square.slice(2), 'near (bottom) edge unchanged');
  close(q[1][0] - q[0][0], 360);
  close((q[0][0] + q[1][0]) / 2, 300, 1e-9);
  assert.equal(q[0][1], 100);
});

test('converge: standing on a ledge keeps the bottom corner of the far side edge', () => {
  const q = converge(square, 'left', 0.05, true);
  assert.deepEqual(q[3], square[3], 'bottom left stays on the ledge');
  assert.deepEqual(q.slice(1, 3), square.slice(1, 3));
  close(q[0][1], 100 + 0.1 * 300); // the whole shortening (2 × 5 %) at the top
});

test('extendToLedge: the side edges reach the top edge of the rail and sink into it', () => {
  const ledge = [[0, 450], [600, 510]];
  const { quad, factor } = extendToLedge(square, ledge, 0);
  close(quad[3][1], lineY(ledge, quad[3][0]), 1e-6);
  close(quad[2][1], lineY(ledge, quad[2][0]), 1e-6);
  assert.ok(factor > 1);
  const sunk = extendToLedge(square, ledge, 6).quad;
  close(sunk[3][1] - quad[3][1], 6, 1e-6);
});

test('tiltDeg: the same size in every scene, opposite directions on tables with opposite tiltSign', () => {
  const dark = { tiltSign: -1, minTiltDeg: 2, maxTiltDeg: 7 }, light = { tiltSign: 1, minTiltDeg: 2, maxTiltDeg: 7 };
  for (const id of ['jujn2', 'gh8r2', 'azge9', 'k4ts5', 'sn4cv']) {
    const a = tiltDeg(id, dark), b = tiltDeg(id, light);
    close(a, -b);
    assert.ok(Math.abs(a) >= 2 && Math.abs(a) <= 7, `${id}: ${a}`);
    assert.equal(tiltDeg(id, dark), a, 'stable');
  }
  const signs = new Set(['a1b2c', 'jujn2', 'gh8r2', 'azge9', 'k4ts5', 'sn4cv', 'rekgm', 'mpugj'].map((id) => Math.sign(tiltDeg(id, light))));
  assert.equal(signs.size, 2, 'works take turns in direction');
});

test('quadFits: inside the free part, clear of props and of their margin', () => {
  const quad = [[200, 200], [300, 200], [300, 300], [200, 300]];
  assert.ok(quadFits(quad, { bounds: [0, 0, 1000, 1000] }));
  assert.ok(!quadFits(quad, { bounds: [250, 0, 1000, 1000] }), 'leaves the table');
  const prop = [[310, 200], [400, 200], [400, 300], [310, 300]];
  assert.ok(quadFits(quad, { props: [prop] }));
  assert.ok(!quadFits(quad, { props: [prop], margin: 15 }), 'too close');
  assert.ok(!quadFits(quad, { props: [[[250, 250], [260, 250], [260, 260], [250, 260]]] }), 'a small prop under the work');
});

const table = (extra = {}) => ({
  name: 'stul', sheetCm: [40, 30], corners: { tl: [200, 300], tr: [800, 300], br: [800, 750], bl: [200, 750] },
  mode: 'lie', convergence: 0, center: [500, 525], maxShiftCm: 0, minTiltDeg: 3, maxTiltDeg: 3, tiltSign: 1,
  maxExtraTiltDeg: 6, bounds: [0, 0, 1000, 1000], ...extra,
});

test('planPlacement: a lying work stays on its spot when nothing is in the way', () => {
  const scene = table();
  const p = planPlacement(scene, sceneGeometry(scene), [20, 15], 'abcde');
  assert.ok(p.fits);
  assert.deepEqual(p.shift, [0, 0]);
  close(p.cx, 20); close(p.cy, 15);
  close(Math.abs(p.deg), 3);
});

test('planPlacement: moves the work off a prop, never turns it the other way', () => {
  const scene = table({ props: [[[640, 300], [1000, 300], [1000, 750], [640, 750]]], propMarginPx: 10 });
  const geo = sceneGeometry(scene);
  const p = planPlacement(scene, geo, [20, 15], 'abcde');
  assert.ok(p.fits);
  assert.ok(p.shift[0] < 0, 'moved left, away from the prop');
  assert.equal(Math.sign(p.deg), Math.sign(tiltDeg('abcde', scene)));
  assert.ok(quadFits(workQuad(geo, [20, 15], p.cx, p.cy, p.deg), { props: scene.props, margin: 10 }));
});

test('planPlacement: reports a work that fits nowhere', () => {
  const scene = table({ bounds: [400, 400, 600, 600] });
  assert.equal(planPlacement(scene, sceneGeometry(scene), [40, 30], 'abcde').fits, false);
});

test('planPlacement: a standing work rests on the ledge, centred on the axis', () => {
  const scene = {
    name: 'stojan', sheetCm: [40, 30], corners: { tl: [200, 200], tr: [800, 200], br: [800, 650], bl: [200, 650] },
    mode: 'stand', convergence: 0, ledge: [[0, 700], [1000, 700]], sinkPx: 0, axis: [560, 400],
  };
  const geo = sceneGeometry(scene);
  const p = planPlacement(scene, geo, [20, 10], 'abcde');
  assert.equal(p.deg, 0);
  const quad = workQuad(geo, [20, 10], p.cx, p.cy, 0);
  close(quad[2][1], 700, 1e-6); close(quad[3][1], 700, 1e-6);
  close((quad[0][0] + quad[1][0]) / 2, 560, 1e-6);
});

test('sceneWindow: 4:5 window, spare height cut by cropTop, small works zoom in (capped)', () => {
  const big = [[100, 600], [900, 600], [900, 1100], [100, 1100]];
  assert.deepEqual(sceneWindow(1024, 1536, big, { cropTop: 0.4 }), { left: 0, top: 102, width: 1024, height: 1280, zoom: 1 });
  assert.deepEqual(sceneWindow(1122, 1402, big, {}).width, 1122);
  const small = [[480, 700], [580, 700], [580, 780], [480, 780]];
  const w = sceneWindow(1024, 1536, small, { cropTop: 0.4, minFill: 0.45, maxZoom: 1.8 });
  close(w.zoom, 1.8);
  assert.equal(w.width, Math.round(1024 / 1.8));
  assert.ok(w.left <= 480 && w.left + w.width >= 580 && w.top <= 700 && w.top + w.height >= 780, 'the work stays in view');
});

test('textPath and fitText: the site fonts, Czech letters, no NaN, ellipsis when too long', async () => {
  const fonts = await loadFonts();
  const t = textPath(fonts.serif, 'Bobří hráz – Malý a Velký Roklan', 20, 45, 40);
  assert.ok(t.d.length > 100 && !t.d.includes('NaN'));
  assert.ok(textPath(fonts.sans, 'akvarel · 30 × 30 cm · 2026', 0, 0, 22, 1).width > textPath(fonts.sans, 'akvarel · 30 × 30 cm · 2026', 0, 0, 22).width);
  assert.equal(fitText(fonts.serif, 'Krátký', 40, 900), 'Krátký');
  const long = fitText(fonts.serif, 'Velmi dlouhý název obrazu, který se do popisku nikdy nevejde celý', 40, 300);
  assert.ok(long.endsWith('…') && textPath(fonts.serif, long, 0, 0, 40).width <= 300);
});

const config = { width: 1080, height: 1350, padding: 0.025, quality: 85 };
// a red painting on white paper (the white balance of a scene makes the paper neutral, the paint stays)
const artwork = async () => sharp({ create: { width: 400, height: 300, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } })
  .composite([{ input: await sharp({ create: { width: 320, height: 220, channels: 4, background: { r: 200, g: 60, b: 60, alpha: 1 } } }).png().toBuffer(), left: 40, top: 40 }])
  .png().toBuffer();

test('insetWork cuts the given percentage off every side', async () => {
  const cut = await insetWork(await artwork(), 5);
  assert.deepEqual([(await sharp(cut).metadata()).width, (await sharp(cut).metadata()).height], [360, 270]);
  assert.equal((await sharp(await insetWork(await artwork(), 0)).metadata()).width, 400);
});

test('renderCaption: 4:5 on the paper of the palette, the work above the caption', async () => {
  const fonts = await loadFonts();
  for (const p of PALETTES) {
    const buf = await renderCaption({
      art: await artwork(), work: { title: 'Bobří hráz', technique: 'akvarel', size_cm: [30, 30] }, year: '2026', host: 'pavla.kramolis.cz',
      colors: p.colors, fonts, config,
    });
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [1080, 1350]);
    const px = (x, y) => [0, 1, 2].map((c) => data[(y * 1080 + x) * 3 + c]);
    const paper = [1, 3, 5].map((i) => parseInt(p.colors.paper.slice(i, i + 2), 16));
    px(5, 5).forEach((v, c) => assert.ok(Math.abs(v - paper[c]) < 6, `${p.id}: corner is paper`));
    const mid = px(540, 500);
    assert.ok(mid[0] > 150 && mid[1] < 110, `${p.id}: the work in the middle`);
  }
});

test('renderScene: places the work into a scene and crops 4:5', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'insta-'));
  // a plain grey table; the "sheet" version has a white sheet where the corners are
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#6a5a4a' } }).jpeg().toFile(path.join(dir, 'stul.jpg'));
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#6a5a4a' } })
    .composite([{ input: await sharp({ create: { width: 400, height: 300, channels: 3, background: '#f0eee8' } }).png().toBuffer(), left: 200, top: 350 }])
    .jpeg().toFile(path.join(dir, 'stul-list.jpg'));
  const scene = {
    name: 'stul', path: path.join(dir, 'stul.jpg'), sheetPath: path.join(dir, 'stul-list.jpg'), sheetCm: [40, 30],
    corners: { tl: [200, 350], tr: [600, 350], br: [600, 650], bl: [200, 650] }, mode: 'lie', convergence: 0.05, farEdge: 'top',
    paperWhite: 240, lightDir: [-1, -1], shadow: { dx: 3, dy: 4, blur: 4, opacity: 0.4 },
    edge: { roughCm: 0.2, roughFreq: 2.5, softCm: 0.09, light: 0.1, shade: 0.15, widthPx: 1.5 },
    cropTop: 0.5, minFill: 0.45, maxZoom: 1.8, center: [400, 500], maxShiftCm: 1, minTiltDeg: 2, maxTiltDeg: 5, tiltSign: 1,
    bounds: [0, 0, 800, 1000],
  };
  const { buf, placement, zoom } = await renderScene({ art: await artwork(), work: { id: 'abcde', size_cm: [20, 15] }, scene, config });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1080, 1350]);
  assert.ok(placement.fits);
  assert.ok(zoom >= 1);
  const c = (Math.round(info.height / 2) * info.width + Math.round(info.width / 2)) * 3;
  assert.ok(data[c] > data[c + 1] + 40, 'the (red) work is in the middle of the photo');
  await fs.rm(dir, { recursive: true, force: true });
});

test('the scenes of the studio: complete settings and both photos with the same framing', async () => {
  const { scenes, text } = await loadInstagramScenes();
  assert.ok(text.length > 0);
  assert.deepEqual(scenes.map((s) => s.name), ['stul-tmavy', 'stul-svetly', 'stojan']);
  for (const s of scenes) {
    const sheet = await sharp(s.sheetPath).metadata(), bg = await sharp(s.path).metadata();
    assert.deepEqual([bg.width, bg.height], [sheet.width, sheet.height], `${s.name}: same size`);
    for (const [x, y] of Object.values(s.corners)) assert.ok(x >= 0 && y >= 0 && x < sheet.width && y < sheet.height, `${s.name}: corner inside`);
    assert.ok(['lie', 'stand'].includes(s.mode), s.name);
    assert.ok(s.convergence >= 0 && s.convergence < 0.3, s.name);
    if (s.mode === 'lie') {
      assert.ok(Array.isArray(s.bounds) && s.bounds.length === 4 && s.center, s.name);
      assert.ok([1, -1].includes(s.tiltSign), s.name);
    } else {
      assert.ok(s.ledge && s.axis, s.name);
    }
  }
  const tables = scenes.filter((s) => s.mode === 'lie');
  assert.equal(new Set(tables.map((s) => s.tiltSign)).size, 2, 'the two tables turn a work opposite ways');
});

test('the scenes take every featured size of the site without covering props', async () => {
  const { scenes } = await loadInstagramScenes();
  for (const s of scenes.filter((x) => x.mode === 'lie')) {
    const geo = sceneGeometry(s);
    for (const [size, id] of [[[30, 30], 'jujn2'], [[38, 29], 'gh8r2'], [[42, 30], 'v39nd'], [[30, 42], 'rk9ct'], [[21, 15], 'uw9vh']]) {
      assert.ok(planPlacement(s, geo, size, id).fits, `${s.name}: ${size.join('×')}`);
    }
  }
});

test('hashtag: no diacritics, spaces or punctuation, lower case', () => {
  assert.equal(hashtag('Plenér'), 'plener');
  assert.equal(hashtag('akvarel a tuš'), 'akvarelatus');
  assert.equal(hashtag('Západ slunce!'), 'zapadslunce');
  assert.equal(hashtag(''), '');
});

const settings = { always: { cs: ['umeni'], en: ['art'] }, en: { akvarel: 'watercolor', krajina: 'landscape', plenér: 'pleinair' } };

test('instagramPost: title, description, facts, address, Czech and English hashtags', () => {
  const text = instagramPost({
    work: { title: 'Bobří hráz', description: 'Ráno u bobří hráze.\n', technique: 'akvarel', size_cm: [30, 30], tags: ['krajina', 'plenér', 'voda'] },
    year: '2026', host: 'pavla.kramolis.cz', settings,
  });
  assert.equal(text, [
    'Bobří hráz', '', 'Ráno u bobří hráze.', '', 'akvarel · 30 × 30 cm · 2026', 'pavla.kramolis.cz', '',
    '#akvarel #krajina #plener #voda #umeni', '#watercolor #landscape #pleinair #art', '',
  ].join('\n'));
});

test('instagramPost: no DOPLNIT placeholder, "na prodej" for a work on sale, no duplicate hashtags', () => {
  const text = instagramPost({
    work: { title: 'Máky', description: 'DOPLNIT popis', technique: 'akvarel', tags: ['akvarel'] },
    year: '2026', host: 'pavla.kramolis.cz', onSale: true, settings,
  });
  assert.ok(!text.includes('DOPLNIT'));
  assert.match(text, /^Máky\n\nakvarel · 2026\nObraz je na prodej\.\npavla\.kramolis\.cz\n/);
  assert.match(text, /\n#akvarel #umeni\n#watercolor #art\n$/);
});

test('instagramPost: without settings only the Czech hashtags of the work', () => {
  const text = instagramPost({ work: { title: 'X', technique: 'kvaš', tags: [] }, year: '2025', host: 'h' });
  assert.ok(text.trimEnd().endsWith('#kvas'));
});

test('instagramPost: the collection of the work under its facts', () => {
  const text = instagramPost({ work: { title: 'Bobří hráz', technique: 'akvarel' }, year: '2026', host: 'h', collection: 'Plenér Šumava 2026', settings });
  assert.match(text, /^Bobří hráz\n\nakvarel · 2026\nKolekce: Plenér Šumava 2026\nh\n/);
  assert.match(text, /\n#akvarel #plenersumava2026 #umeni\n#watercolor #art\n$/, 'the collection as a hashtag');
  assert.ok(!instagramPost({ work: { title: 'X' }, year: '2026', host: 'h', settings }).includes('Kolekce'));
});

test('untranslatedWords: technique and tags without an English hashtag, unique', () => {
  // "Plenér" is translated through its lower case form, "mlha" has no translation
  assert.deepEqual(untranslatedWords({ technique: 'akvarel', tags: ['krajina', 'mlha', 'mlha', 'Plenér'] }, settings), ['mlha']);
  assert.deepEqual(untranslatedWords({ technique: 'akvarel', tags: ['krajina'] }, settings), []);
  assert.deepEqual(untranslatedWords({}, settings), []);
});

test('panoramaSlides: the fewest slides holding the work at full height, only when it is clearly bigger than the caption', () => {
  assert.equal(panoramaSlides([40, 30], config), 2, '4:3 over 2 slides: 1.7 × bigger');
  assert.equal(panoramaSlides([60, 30], config), 3);
  assert.equal(panoramaSlides([80, 30], config), 3, 'never more than maxSlides (then it fills the width)');
  assert.equal(panoramaSlides([30, 30], config), 0, 'a square work gains too little');
  assert.equal(panoramaSlides([30, 40], config), 0, 'nor a portrait one');
  assert.equal(panoramaSlides([40, 30], { ...config, panorama: { minGain: 1.8 } }), 0);
  assert.equal(panoramaSlides([80, 30], { ...config, panorama: { maxSlides: 2 } }), 2);
  assert.equal(panoramaSlides([40, 30], { ...config, panorama: { maxSlides: 1 } }), 0);
  for (const s of [undefined, null, [40], [0, 30], 'x']) assert.equal(panoramaSlides(s, config), 0);
  assert.deepEqual(panoramaSuffixes(3), ['-pano-1', '-pano-2', '-pano-3']);
  assert.deepEqual(panoramaSuffixes(0), []);
});

test('renderPanorama: slides of the frame size; the work runs across their border', async () => {
  const art = await sharp({ create: { width: 800, height: 300, channels: 3, background: '#c83c3c' } }).png().toBuffer();
  const slides = await renderPanorama({ art, colors: PALETTES[0].colors, slides: 2, config });
  assert.equal(slides.length, 2);
  for (const [i, buf] of slides.entries()) {
    const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [1080, 1350]);
    const px = (x, y) => [0, 1, 2].map((c) => data[(y * 1080 + x) * 3 + c]);
    const edge = i === 0 ? px(1079, 675) : px(0, 675);
    assert.ok(edge[0] > 150 && edge[1] < 110, `slide ${i + 1}: the work at the border`);
    const paper = i === 0 ? px(5, 5) : px(1074, 5);
    assert.ok(paper[0] > 200 && paper[1] > 200, `slide ${i + 1}: paper in the outer corner`);
  }
});

test('storyLayout: the work and the caption between the free zones, room for the link sticker above the bottom one', () => {
  const wide = storyLayout(4 / 3, config);
  assert.deepEqual([wide.width, wide.height], [1080, 1920]);
  assert.deepEqual(wide.art, { left: 27, top: 342, width: 1026, height: 770 });
  assert.equal(wide.ruleY, 1152);
  assert.deepEqual(wide.link, { top: 1360, height: 220 });
  const tall = storyLayout(0.5, config);
  assert.equal(tall.art.height, 954, 'a tall work is limited by the height');
  assert.equal(tall.art.width, 477);
  assert.ok(tall.art.top >= 250 && tall.ruleY + 116 <= tall.link.top, 'never in the free zone or the room for the sticker');
  const own = storyLayout(1, { ...config, story: { safeTop: 300, linkSpace: 300 } });
  assert.ok(own.art.top >= 300 && own.link.top === 1920 - 340 - 300);
});

test('renderStory: 9:16 on the paper, the work in the middle, the free zones empty', async () => {
  const buf = await renderStory({
    art: await artwork(), work: { title: 'Bobří hráz', technique: 'akvarel', size_cm: [40, 30] }, year: '2026', host: 'pavla.kramolis.cz',
    colors: PALETTES[0].colors, fonts: await loadFonts(), config,
  });
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [1080, 1920]);
  const px = (x, y) => [0, 1, 2].map((c) => data[(y * 1080 + x) * 3 + c]);
  const mid = px(540, 700);
  assert.ok(mid[0] > 150 && mid[1] < 110, 'the work in the middle');
  const paper = [1, 3, 5].map((i) => parseInt(PALETTES[0].colors.paper.slice(i, i + 2), 16));
  for (const [x, y] of [[540, 100], [540, 1450], [540, 1800]]) px(x, y).forEach((v, c) => assert.ok(Math.abs(v - paper[c]) < 6, `paper at ${x},${y}`));
});

test('renderCaption: other sizes (the pin, 2:3) and XMP when given', async () => {
  const buf = await renderCaption({
    art: await artwork(), work: { title: 'Ráno' }, year: '2026', host: 'pavla.kramolis.cz', colors: PALETTES[0].colors, fonts: await loadFonts(),
    config: { width: 1000, height: 1500, padding: 0.04, quality: 90 }, xmp: '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>',
  });
  const meta = await sharp(buf).metadata();
  assert.deepEqual([meta.width, meta.height], [1000, 1500]);
  assert.ok(meta.xmp?.length > 0);
});

test('captionLayout: the caption at the bottom edge, or snug right under the work with the pair centred', () => {
  const pin = { W: 1000, H: 1500, side: 40 };
  assert.deepEqual(captionLayout({ ...pin, artHeight: 307 }), { artTop: 528, ruleY: 1346 }, 'default: at the bottom');
  assert.deepEqual(captionLayout({ ...pin, artHeight: 307, snug: true }), { artTop: 519, ruleY: 866 }, 'a wide work: no empty band');
  assert.deepEqual(captionLayout({ ...pin, artHeight: 1282, snug: true }), { artTop: 40, ruleY: 1346 }, 'a tall work: as by default');
});

test('renderCaption snug: a wide work has its caption right under it, paper below', async () => {
  const art = await sharp({ create: { width: 900, height: 300, channels: 3, background: '#c83c3c' } }).png().toBuffer();
  const fonts = await loadFonts();
  const rows = async (snug) => {
    const buf = await renderCaption({
      art, work: { title: 'Oblaka', technique: 'akvarel' }, year: '2019', host: 'pavla.kramolis.cz', colors: PALETTES[0].colors, fonts,
      config: { width: 1000, height: 1500, padding: 0.04 }, snug,
    });
    const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
    // rows with dark ink (the caption) in the left part
    const inked = [];
    for (let y = 0; y < 1500; y++) for (let x = 80; x < 400; x++) if (data[(y * 1000 + x) * 3] < 120) { inked.push(y); break; }
    return inked;
  };
  const bottom = await rows(false), snug = await rows(true);
  assert.ok(Math.min(...bottom) > 1340, 'default: the caption at the bottom');
  assert.ok(Math.max(...snug) < 1000, 'snug: the caption high up, under the work');
});
