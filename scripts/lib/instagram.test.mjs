import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  PAPER_DEFAULTS, captionFacts, captionLayout, circleRatio, detailLayout, detailSuffixes, fitCamera, focalPx, gridLayout, gridPosts, gridSuffixes, renderGrid, fitText, hashtag, homography, insetWork, instagramPost, instagramSuffixes, untranslatedWords, ledgeDepth, lineY, loadFonts, loadInstagramScenes, noise2, paperOf, project, unproject,
  panoramaSlides, EDGE_KINDS, facingDeg, panoramaSuffixes, planPlacement, quadFits, scenePlacement, renderCaption, renderPanorama, renderScene, renderStory, sceneGeometry, sceneWindow, siteHost,
  sceneCamera, cameraFromAngles, cameraAngles, fitCameraToLines, lineMisfit, storyLayout, textPath, tiltDeg, workQuad,
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

// a real camera: 35 mm on an image 1000 × 1250, the sheet 40 × 30 cm seen 40° from above and 15° from the side
const W0 = 1000, H0 = 1250;
const cameraAt = ({ mm = 35, zenith = 40, azimuth = 15, dist = 110 } = {}) => {
  const z = zenith * Math.PI / 180, a = azimuth * Math.PI / 180;
  // turn the plane by the azimuth (around its normal), then tilt it away from the camera by the zenith
  const Rz = [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
  const Rx = [[1, 0, 0], [0, Math.cos(z), -Math.sin(z)], [0, Math.sin(z), Math.cos(z)]];
  const R = Rx.map((r) => [0, 1, 2].map((j) => r.reduce((sum, v, k) => sum + v * Rz[k][j], 0)));
  const centre = [0, 1, 2].map((i) => R[i][0] * 20 + R[i][1] * 15);
  return { f: focalPx(mm, W0, H0), pp: [W0 / 2, H0 / 2], R, t: [-centre[0], -centre[1], dist - centre[2]] };
};
const cornersOf = (cam) => { const [tl, tr, br, bl] = [[0, 0], [40, 0], [40, 30], [0, 30]].map(([X, Y]) => project(cam, X, Y)); return { tl, tr, br, bl }; };

test('project / unproject: a point of the plane (also lifted towards the camera) and back', () => {
  const cam = cameraAt();
  for (const h of [0, 0.3]) {
    const [x, y] = project(cam, 12.5, 7, h);
    const [X, Y] = unproject(cam, x, y, h);
    close(X, 12.5, 1e-9); close(Y, 7, 1e-9);
  }
  // a lifted point is closer to the camera: it looks further from the middle of the photo
  const flat = project(cam, 40, 30), lifted = project(cam, 40, 30, 1);
  assert.ok(Math.hypot(lifted[0] - W0 / 2, lifted[1] - H0 / 2) > Math.hypot(flat[0] - W0 / 2, flat[1] - H0 / 2));
});

test('fitCamera: finds the focal length, the angles and the distance of a real camera from the 4 corners', () => {
  const cam = fitCamera(cornersOf(cameraAt()), [40, 30], [W0, H0]);
  close(cam.focalMm, 35, 0.6);
  close(cam.zenithDeg, 40, 0.5);
  close(cam.distanceCm, 110, 2);
  assert.ok(cam.rms < 0.5, `rms ${cam.rms}`);
  assert.ok(Math.abs(cam.azimuthDeg) > 5, 'seen from the side');
  close(fitCamera(cornersOf(cameraAt({ azimuth: -15 })), [40, 30], [W0, H0]).azimuthDeg, -cam.azimuthDeg, 0.5);
});

test('fitCamera: a fixed focal length; a sheet drawn too frontally is no longer a true rectangle for it', () => {
  const corners = cornersOf(cameraAt({ mm: 70, dist: 220 }));
  const free = fitCamera(corners, [40, 30], [W0, H0]), fixed = fitCamera(corners, [40, 30], [W0, H0], { focalMm: 28 });
  close(free.focalMm, 70, 1);
  assert.equal(fixed.focalMm, 28);
  assert.ok(fixed.rms > free.rms + 1, 'the drawn corners fit worse, the perspective is stronger');
  // stays within the range of usual lenses
  assert.ok(fitCamera(cornersOf(cameraAt({ mm: 200, dist: 600 })), [40, 30], [W0, H0]).focalMm <= 70);
});

test('fitCamera: round things lying on the table decide the focal length', () => {
  const real = cameraAt({ mm: 30 });
  // a ring of a cup (r = 4 cm) on the table in front of the sheet, as drawn in the photo
  const ring = (X, Y) => {
    const pts = Array.from({ length: 72 }, (_, i) => project(real, X + 4 * Math.cos(i * Math.PI / 36), Y + 4 * Math.sin(i * Math.PI / 36)));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  // the generator drew the sheet like a long lens would; the rings keep the true perspective
  const corners = cornersOf(cameraAt({ mm: 70, dist: 220 }));
  const cam = fitCamera(corners, [40, 30], [W0, H0], { circles: [ring(-10, 45), ring(50, -15)] });
  assert.ok(cam.focalMm < 45, `${cam.focalMm} mm`);
  assert.ok(cam.circleError < 0.05);
});

test('cameraFromAngles / cameraAngles: a setup and back, lying and standing', () => {
  for (const mode of ['lie', 'stand']) {
    for (const setup of [
      { focalMm: 35, zenithDeg: 40, azimuthDeg: 15, rollDeg: 3, distanceCm: 110, sheetCenter: [420, 700] },
      { focalMm: 50, zenithDeg: 5, azimuthDeg: -120, rollDeg: -7, distanceCm: 80, sheetCenter: [500, 625] },
      { focalMm: 28, zenithDeg: 70, azimuthDeg: 170, rollDeg: 0, distanceCm: 200, sheetCenter: [900, 300] },
    ]) {
      const back = cameraAngles(cameraFromAngles(setup, [40, 30], [W0, H0], mode), [40, 30], mode);
      for (const key of ['focalMm', 'zenithDeg', 'azimuthDeg', 'rollDeg', 'distanceCm']) close(back[key], setup[key], 1e-6);
      close(back.sheetCenter[0], setup.sheetCenter[0], 1e-6); close(back.sheetCenter[1], setup.sheetCenter[1], 1e-6);
    }
  }
  // the middle of the sheet where asked, the middle of the image without it
  const cam = cameraFromAngles({ focalMm: 35, zenithDeg: 30, azimuthDeg: 0, distanceCm: 100, sheetCenter: [300, 900] }, [40, 30], [W0, H0]);
  const [x, y] = project(cam, 20, 15);
  close(x, 300, 1e-6); close(y, 900, 1e-6);
  const mid = project(cameraFromAngles({ focalMm: 35, zenithDeg: 30, azimuthDeg: 0, distanceCm: 100 }, [40, 30], [W0, H0]), 20, 15);
  close(mid[0], W0 / 2, 1e-6); close(mid[1], H0 / 2, 1e-6);
});

test('cameraFromAngles: level = the horizon of a table / the top of an easel horizontal; from the front = symmetric', () => {
  // lying, seen from the front: the sheet is a symmetric trapezoid, its far edge shorter
  const lie = cameraFromAngles({ focalMm: 35, zenithDeg: 45, azimuthDeg: 0, distanceCm: 100 }, [40, 30], [W0, H0]);
  const [tl, tr, br, bl] = [[0, 0], [40, 0], [40, 30], [0, 30]].map(([X, Y]) => project(lie, X, Y));
  close(tl[1], tr[1], 1e-6); close(bl[1], br[1], 1e-6);
  assert.ok(tr[0] - tl[0] < br[0] - bl[0], 'the far edge is shorter');
  // standing, seen from the right: the top and bottom edges meet on the left, but a vertical edge stays vertical
  const stand = cameraFromAngles({ focalMm: 35, zenithDeg: 30, azimuthDeg: 90, distanceCm: 100 }, [40, 30], [W0, H0], 'stand');
  const [a, b] = [project(stand, 20, 0), project(stand, 20, 30)];
  close(a[0], b[0], 1e-6);
  // a roll turns the picture
  const rolled = cameraFromAngles({ focalMm: 35, zenithDeg: 30, azimuthDeg: 90, rollDeg: 5, distanceCm: 100 }, [40, 30], [W0, H0], 'stand');
  const [c, d] = [project(rolled, 20, 0), project(rolled, 20, 30)];
  close(Math.atan2(d[0] - c[0], d[1] - c[1]) * 180 / Math.PI, 5, 0.5);
});

test('fitCamera: finds the setup of a camera, which rebuilds the same camera', () => {
  const setup = { focalMm: 35, zenithDeg: 45, azimuthDeg: -12, rollDeg: 2, distanceCm: 100, sheetCenter: [480, 700] };
  const cam = fitCamera(cornersOf(cameraFromAngles(setup, [40, 30], [W0, H0])), [40, 30], [W0, H0], { focalMm: 35 });
  for (const key of ['zenithDeg', 'azimuthDeg', 'rollDeg', 'distanceCm']) close(cam[key], setup[key], 0.2);
  close(cam.sheetCenter[0], 480, 1); close(cam.sheetCenter[1], 700, 1);
  const again = cameraFromAngles(cam, [40, 30], [W0, H0]);
  for (const [X, Y] of [[0, 0], [40, 0], [40, 30], [0, 30]]) {
    const [p, q] = [project(cam, X, Y), project(again, X, Y)];
    close(p[0], q[0], 1); close(p[1], q[1], 1);
  }
});

test('sceneCamera: a camera set by hand wins over the corners; rms tells how far the drawn corners are', () => {
  const setup = { focalMm: 35, zenithDeg: 40, azimuthDeg: 10, rollDeg: 0, distanceCm: 110, sheetCenter: [500, 625] };
  const exact = cornersOf(cameraFromAngles(setup, [40, 30], [W0, H0]));
  const scene = { sheetCm: [40, 30], imageSize: [W0, H0], mode: 'lie', corners: exact, focalMm: 60, camera: setup };
  const cam = sceneCamera(scene);
  assert.equal(cam.focalMm, 35);
  assert.equal(cam.zenithDeg, 40);
  assert.ok(cam.rms < 1e-6);
  const off = sceneCamera({ ...scene, corners: { ...exact, tl: [exact.tl[0] + 20, exact.tl[1]] } });
  close(off.rms, 10, 1e-6);
  // without it: fitted to the corners with the scene's focal length
  const { camera, ...fitted } = scene;
  assert.equal(sceneCamera(fitted).focalMm, 60);
});

// edges of a support seen by a camera: lines of the plane along x (constant Y) and along y (constant X)
const edgesOf = (cam, { xs = [-20, 50], ys = [-10, 60] } = {}) => ({
  x: xs.map((Y) => [project(cam, -15, Y), project(cam, 55, Y)]),
  y: ys.map((X) => [project(cam, X, -15), project(cam, X, 45)]),
});
// the corners of the sheet drawn turned by deg on the support, optionally drawn a little wrong (jitter px)
const turnedCorners = (cam, deg, jitter = 0) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const [tl, tr, br, bl] = [[-20, -15], [20, -15], [20, 15], [-20, 15]].map(([x, y], i) => {
    const [px, py] = project(cam, 20 + x * c - y * s, 15 + x * s + y * c);
    return [px + jitter * [1, -1, 1, -1][i], py + jitter * [1, 1, -1, -1][i]];
  });
  return { tl, tr, br, bl };
};

test('lineMisfit: 0 for an edge going to its vanishing point, the distance of its ends otherwise', () => {
  const cam = cameraFromAngles({ focalMm: 35, zenithDeg: 45, azimuthDeg: 20, distanceCm: 100 }, [40, 30], [W0, H0]);
  const [x, y] = [project(cam, -10, 5), project(cam, 60, 5)];
  close(lineMisfit(cam, 'x', [x, y]), 0, 1e-6);
  assert.ok(lineMisfit(cam, 'y', [x, y]) > 50, 'not a y edge');
  const off = lineMisfit(cam, 'x', [x, [y[0], y[1] + 10]]);
  assert.ok(off > 3 && off < 6, `${off}`);
  // seen straight, the edges are parallel in the image: the vanishing point is at infinity
  const straight = cameraFromAngles({ focalMm: 35, zenithDeg: 0, azimuthDeg: 0, distanceCm: 100 }, [40, 30], [W0, H0]);
  close(lineMisfit(straight, 'x', [project(straight, 0, 0), project(straight, 40, 0)]), 0, 1e-6);
  close(lineMisfit(straight, 'x', [[100, 100], [900, 110]]), 5, 0.01);
});

test('fitCameraToLines: the edges of the support decide the camera, the drawn sheet only where and how far', () => {
  const setup = { focalMm: 32, zenithDeg: 50, azimuthDeg: -25, rollDeg: 4, distanceCm: 95, sheetCenter: [470, 760] };
  const cam = cameraFromAngles(setup, [40, 30], [W0, H0]);
  const scene = { lines: edgesOf(cam), corners: turnedCorners(cam, 12, 6), sheetCm: [40, 30], imageSize: [W0, H0], mode: 'lie' };
  const start = { focalMm: 45, zenithDeg: 35, azimuthDeg: 0, rollDeg: 0, distanceCm: 120, sheetCenter: [500, 700] };
  const fit = fitCameraToLines(scene, start);
  close(fit.setup.focalMm, 32, 0.3);
  for (const key of ['zenithDeg', 'azimuthDeg', 'rollDeg']) close(fit.setup[key], setup[key], 0.3);
  close(fit.setup.distanceCm, 95, 3);
  close(fit.sheetDeg, 12, 0.5);
  assert.ok(fit.lineRms < 0.5, `lineRms ${fit.lineRms}`);
  assert.equal(fit.lines.x.length, 2);
  // a fixed focal length stays, the range holds the rest
  assert.equal(fitCameraToLines({ ...scene, focalMm: 40 }, start).setup.focalMm, 40);
  const narrow = fitCameraToLines(scene, start, { focalRange: [36, 70] });
  assert.equal(narrow.setup.focalMm, 36);
  assert.ok(narrow.lineRms > fit.lineRms);
});

test('fitCameraToLines: a standing board, edges only across; without lines it fits the drawn sheet', () => {
  const setup = { focalMm: 40, zenithDeg: 15, azimuthDeg: 90, rollDeg: -8, distanceCm: 100, sheetCenter: [600, 650] };
  const cam = cameraFromAngles(setup, [40, 30], [W0, H0], 'stand');
  const scene = { lines: { x: edgesOf(cam).x }, corners: turnedCorners(cam, 0), sheetCm: [40, 30], imageSize: [W0, H0], mode: 'stand' };
  const fit = fitCameraToLines(scene, { ...setup, rollDeg: 0, zenithDeg: 10, azimuthDeg: 60 });
  assert.ok(fit.lineRms < 0.5 && fit.rms < 1, `${fit.lineRms} ${fit.rms}`);
  close(fit.setup.rollDeg, -8, 0.5);
  const none = fitCameraToLines({ ...scene, lines: {} }, { ...setup, rollDeg: 0 });
  assert.equal(none.lineRms, 0);
  assert.ok(none.rms < 1);
});

test('sceneCamera: where the camera comes from (camera > lines > corners)', () => {
  const cam = cameraFromAngles({ focalMm: 32, zenithDeg: 50, azimuthDeg: -25, rollDeg: 4, distanceCm: 95, sheetCenter: [470, 760] }, [40, 30], [W0, H0]);
  const base = { sheetCm: [40, 30], imageSize: [W0, H0], mode: 'lie', corners: turnedCorners(cam, 0, 8) };
  assert.equal(sceneCamera({ ...base }).source, 'corners');
  const lines = sceneCamera({ ...base, lines: edgesOf(cam) });
  assert.equal(lines.source, 'lines');
  assert.ok(lines.lineRms < 1.5, `${lines.lineRms}`);
  close(lines.zenithDeg, 50, 1);
  const manual = sceneCamera({ ...base, lines: edgesOf(cam), camera: { focalMm: 30, zenithDeg: 40, azimuthDeg: 0, distanceCm: 90 } });
  assert.equal(manual.source, 'camera');
  assert.ok(manual.lineRms > 1, 'the edges tell the hand-set camera is off');
});

test('circleRatio: a circle looks round straight from above and flat from the side', () => {
  close(circleRatio(cameraAt({ zenith: 0, azimuth: 0 }), W0 / 2, H0 / 2), 1, 1e-3);
  const cam = cameraAt({ zenith: 60, azimuth: 0 });
  close(circleRatio(cam, W0 / 2, H0 / 2), Math.cos(60 * Math.PI / 180), 0.08);
});

test('ledgeDepth: the plane of an easel reaches down to the rail and sinks into it', () => {
  const cam = fitCamera({ tl: [200, 200], tr: [800, 200], br: [800, 650], bl: [200, 650] }, [40, 30], [1000, 1000]);
  const depth = ledgeDepth(cam, [40, 30], [[0, 700], [1000, 700]]);
  close(project(cam, 0, depth)[1], 700, 1e-3);
  close(project(cam, 0, ledgeDepth(cam, [40, 30], [[0, 700], [1000, 700]], 6))[1], 706, 1e-3);
  assert.ok(depth > 30);
});

test('noise2: smooth, stable and within 0 … 1', () => {
  for (let i = 0; i < 200; i++) {
    const v = noise2(i * 0.37, i * 0.11, 5);
    assert.ok(v >= 0 && v <= 1);
    assert.equal(v, noise2(i * 0.37, i * 0.11, 5));
    assert.ok(Math.abs(noise2(i * 0.37 + 0.01, i * 0.11, 5) - v) < 0.05);
  }
});

test('paperOf: the paper of a scene overrides the defaults one by one', () => {
  assert.deepEqual(paperOf({}), PAPER_DEFAULTS);
  const p = paperOf({ paper: { thicknessMm: 1, contact: { opacity: 0.6 } } });
  assert.equal(p.thicknessMm, 1);
  assert.equal(p.liftMm, PAPER_DEFAULTS.liftMm);
  assert.deepEqual(p.contact, { ...PAPER_DEFAULTS.contact, opacity: 0.6 });
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
  imageSize: [1000, 1000], mode: 'lie', center: [500, 525], maxShiftCm: 0, minTiltDeg: 3, maxTiltDeg: 3, tiltSign: 1,
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

test('planPlacement: without tilt (minTiltDeg = maxTiltDeg = 0) the work faces the viewer, even moved off a prop (here the table is straight on)', () => {
  const scene = table({ minTiltDeg: 0, maxTiltDeg: 0 });
  assert.equal(tiltDeg('abcde', scene), 0);
  const p = planPlacement(scene, sceneGeometry(scene), [20, 15], 'abcde');
  assert.ok(p.fits);
  assert.equal(p.deg, 0);
  const blocked = table({ minTiltDeg: 0, maxTiltDeg: 0, props: [[[480, 400], [560, 400], [560, 480], [480, 480]]] });
  const q = planPlacement(blocked, sceneGeometry(blocked), [20, 15], 'abcde');
  assert.ok(q.fits);
  assert.equal(q.deg, 0);
  assert.equal(q.extraDeg, 0);
  assert.notDeepEqual(q.shift, [0, 0]);
});

test('facingDeg / planPlacement: on a table turned in the photo the work faces the viewer, level across', () => {
  // the sheet (and with it the table) turned by about 10° in the photo
  const scene = table({ minTiltDeg: 0, maxTiltDeg: 0, corners: { tl: [260, 240], tr: [800, 335], br: [740, 780], bl: [200, 685] } });
  const geo = sceneGeometry(scene);
  // the line through the middle of the work, across: level (the top and bottom edges meet far away, as in perspective)
  const level = (q) => Math.atan2(q[1][1] + q[2][1] - q[0][1] - q[3][1], q[1][0] + q[2][0] - q[0][0] - q[3][0]) * 180 / Math.PI;
  const p = planPlacement(scene, geo, [20, 15], 'abcde');
  assert.ok(p.fits);
  close(p.deg, facingDeg(geo, p.cx, p.cy), 1e-9);
  assert.ok(Math.abs(p.deg) > 5, `turned against the edges of the table: ${p.deg}`);
  assert.ok(Math.abs(level(workQuad(geo, [20, 15], p.cx, p.cy, p.deg))) < 0.2, 'level in the photo');
  assert.ok(Math.abs(level(workQuad(geo, [20, 15], p.cx, p.cy, 0))) > 5, 'parallel to the table it would not be');
  // moved off a prop: facing the viewer at the new spot too
  const blocked = { ...scene, props: [[[440, 420], [560, 420], [560, 540], [440, 540]]] };
  const q = planPlacement(blocked, geo, [20, 15], 'abcde');
  assert.ok(q.fits && Math.hypot(...q.shift) > 0);
  assert.ok(Math.abs(level(workQuad(geo, [20, 15], q.cx, q.cy, q.deg))) < 0.2);
  // the casual tilt of the id turns it from there
  const tilted = { ...scene, minTiltDeg: 3, maxTiltDeg: 3 };
  const t = planPlacement(tilted, geo, [20, 15], 'abcde');
  close(t.deg - facingDeg(geo, t.cx, t.cy), tiltDeg('abcde', tilted), 1e-9);
});

test('planPlacement: moves the work off a prop, never turns it the other way', () => {
  const scene = table({ props: [[[640, 300], [1000, 300], [1000, 750], [640, 750]]], propMarginPx: 10 });
  const geo = sceneGeometry(scene);
  const p = planPlacement(scene, geo, [20, 15], 'abcde');
  assert.ok(p.fits);
  assert.ok(p.shift[0] < 0, 'moved left, away from the prop');
  assert.equal(Math.sign(p.deg - facingDeg(geo, p.cx, p.cy)), Math.sign(tiltDeg('abcde', scene)));
  assert.ok(quadFits(workQuad(geo, [20, 15], p.cx, p.cy, p.deg), { props: scene.props, margin: 10 }));
});

test('planPlacement: reports a work that fits nowhere', () => {
  const scene = table({ bounds: [400, 400, 600, 600] });
  assert.equal(planPlacement(scene, sceneGeometry(scene), [40, 30], 'abcde').fits, false);
});

test('planPlacement: a standing work rests on the ledge, centred on the axis', () => {
  const scene = {
    name: 'stojan', sheetCm: [40, 30], corners: { tl: [200, 200], tr: [800, 200], br: [800, 650], bl: [200, 650] },
    imageSize: [1000, 1000], mode: 'stand', ledge: [[0, 700], [1000, 700]], sinkPx: 0, axis: [560, 400],
  };
  const geo = sceneGeometry(scene);
  const p = planPlacement(scene, geo, [20, 10], 'abcde');
  assert.equal(p.deg, 0);
  const quad = workQuad(geo, [20, 10], p.cx, p.cy, 0);
  close(quad[2][1], 700, 1e-6); close(quad[3][1], 700, 1e-6);
  close((quad[0][0] + quad[1][0]) / 2, 560, 1e-6);
  assert.equal(p.fits, true, 'no props: always fits');
  // a prop beside the easel: a small work stays clear of it, a wide one covers it and does not fit, in the same place
  const jar = [[0, 500], [150, 500], [150, 700], [0, 700]];
  const beside = { ...scene, props: [jar] };
  const small = planPlacement(beside, geo, [20, 10], 'abcde');
  assert.equal(small.fits, true);
  const wide = planPlacement(beside, geo, [60, 10], 'abcde');
  assert.equal(wide.fits, false);
  assert.deepEqual([wide.cx, wide.cy, wide.deg], [planPlacement(scene, geo, [60, 10], 'abcde').cx, planPlacement(scene, geo, [60, 10], 'abcde').cy, 0], 'it does not move');
  // with maxSlideCm it slides along the ledge to the nearest place clear of the prop (to the right, away from it)
  const wideJar = [[0, 500], [250, 500], [250, 700], [0, 700]];
  const slid = planPlacement({ ...scene, props: [wideJar], maxSlideCm: 20 }, geo, [46, 10], 'abcde');
  const still = planPlacement({ ...scene, props: [wideJar] }, geo, [46, 10], 'abcde');
  assert.equal(still.fits, false, 'without maxSlideCm it stays');
  assert.equal(slid.fits, true);
  assert.ok(slid.shift[0] > 0 && slid.shift[0] <= 20 && slid.shift[1] === 0 && slid.deg === 0, JSON.stringify(slid));
  close(slid.cy, still.cy, 1e-9);
  const slidQuad = workQuad(geo, [46, 10], slid.cx, slid.cy, 0);
  assert.ok(quadFits(slidQuad, { props: [wideJar] }), 'clear of the prop');
  assert.ok(!quadFits(workQuad(geo, [46, 10], slid.cx - 0.5, slid.cy, 0), { props: [wideJar] }), 'and no further than needed');
  close(slidQuad[2][1], 700, 1e-6); close(slidQuad[3][1], 700, 1e-6);
  // not further than maxSlideCm, never out of the photo: then it stays on the axis and does not fit
  assert.equal(planPlacement({ ...scene, props: [wideJar], maxSlideCm: 1 }, geo, [46, 10], 'abcde').fits, false);
  const huge = planPlacement({ ...beside, maxSlideCm: 50 }, geo, [95, 10], 'abcde');
  assert.deepEqual([huge.fits, huge.shift, huge.cut], [false, [0, 0], true], 'wider than the photo: cut by its edge');
  assert.equal(still.cut, false, 'only covering a prop');
  // wider than the photo allows on the axis, even with nothing beside it: it does not fit either (the edge cuts it off)
  const out = planPlacement(scene, geo, [60, 10], 'abcde');
  assert.deepEqual([out.fits, out.cut], [false, true]);
  // a work sticking out on one side only slides back into the photo when it may
  const offAxis = { ...scene, axis: [800, 400] };
  assert.equal(planPlacement(offAxis, geo, [40, 10], 'abcde').fits, false);
  const back = planPlacement({ ...offAxis, maxSlideCm: 20 }, geo, [40, 10], 'abcde');
  assert.ok(back.fits && back.shift[0] < 0, JSON.stringify(back));
  // the margin counts too: just clear of the prop, but not by propMarginPx
  const edge = Math.min(...workQuad(geo, [20, 10], small.cx, small.cy, 0).map(([x]) => x));
  const near = { ...scene, props: [[[0, 500], [edge - 5, 500], [edge - 5, 700], [0, 700]]] };
  assert.equal(planPlacement(near, geo, [20, 10], 'abcde').fits, true);
  assert.equal(planPlacement({ ...near, propMarginPx: 10 }, geo, [20, 10], 'abcde').fits, false);
});

test('scenePlacement: the place of planPlacement under the camera of the scene, once per work and scene', () => {
  const scene = {
    name: 'stojan', sheetCm: [40, 30], corners: { tl: [200, 200], tr: [800, 200], br: [800, 650], bl: [200, 650] },
    imageSize: [1000, 1000], mode: 'stand', ledge: [[0, 700], [1000, 700]], sinkPx: 0, axis: [560, 400],
  };
  const p = scenePlacement(scene, [20, 10], 'abcde');
  assert.deepEqual(p, planPlacement(scene, sceneGeometry(scene), [20, 10], 'abcde'));
  assert.equal(scenePlacement(scene, [20, 10], 'abcde'), p, 'the same object again: cached');
  assert.notEqual(scenePlacement(scene, [20, 11], 'abcde'), p);
  assert.equal(scenePlacement(scene, [95, 10], 'abcde').fits, false, 'wider than the photo: no photo of this scene');
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
    corners: { tl: [200, 350], tr: [600, 350], br: [600, 650], bl: [200, 650] }, imageSize: [800, 1000], mode: 'lie',
    paperWhite: 240, lightDir: [-1, -1], shadow: { dx: 3, dy: 4, blur: 4, opacity: 0.4 },
    edge: { roughCm: 0.2, roughFreq: 2.5, softCm: 0.09 },
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

// a plain table seen from the front and above (the far edge of the sheet shorter): the near cut edge of a paper shows
const slantedScene = async (dir, paper) => {
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#6a5a4a' } }).jpeg().toFile(path.join(dir, 'stul.jpg'));
  // the "sheet" photo all paper: the work gets the full light everywhere
  await sharp({ create: { width: 800, height: 1000, channels: 3, background: '#f0f0f0' } }).jpeg().toFile(path.join(dir, 'stul-list.jpg'));
  return {
    name: 'stul', path: path.join(dir, 'stul.jpg'), sheetPath: path.join(dir, 'stul-list.jpg'), sheetCm: [40, 30],
    corners: { tl: [250, 350], tr: [550, 350], br: [640, 650], bl: [160, 650] }, imageSize: [800, 1000], mode: 'lie',
    paperWhite: 240, lightDir: [-1, -1], shadow: { dx: 0, dy: 0, blur: 1, opacity: 0 }, edge: {},
    cropTop: 0.5, center: [400, 500], maxShiftCm: 0, minTiltDeg: 1, maxTiltDeg: 1, tiltSign: 1, bounds: [0, 0, 800, 1000],
    paper: { liftMm: 0, curlMm: 0, waveMm: 0, contact: { opacity: 0 }, ...paper },
  };
};
const brightPixels = async (buf) => {
  const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let i = 0; i < data.length; i += 3) if (data[i + 1] > 150) n++;
  return n;
};

test('renderScene: the paper has a thickness (its near cut edge) and may lie on a bigger blank sheet', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'insta-'));
  const art = await artwork(), work = { id: 'abcde', size_cm: [20, 15] };
  const render = async (paper) => brightPixels((await renderScene({ art, work, scene: await slantedScene(dir, paper), config })).buf);
  const thin = await render({ thicknessMm: 0.01 }), thick = await render({ thicknessMm: 8 }), under = await render({ thicknessMm: 0.01, underlayCm: 2 });
  assert.ok(thick > thin * 1.02, `the cut edge of a thick paper shows: ${thick} > ${thin}`);
  assert.ok(under > thin * 1.3, `the blank sheet around the work: ${under} > ${thin}`);
  await fs.rm(dir, { recursive: true, force: true });
});

test('renderScene: the edge of the work (meta_edge): its side repeats its edge colour; a canvas is thick, flat and clean', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'insta-'));
  // a work painted red to its very edge (a canvas, or paper painted over), white in the middle (its white balance holds):
  // its side shows red, not white paper
  const red = await sharp({ create: { width: 400, height: 300, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } })
    .composite([{ input: await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } }).png().toBuffer(), left: 100, top: 100 }])
    .png().toBuffer();
  const scene = await slantedScene(dir, {});
  const reddish = async (meta_edge, paper, edge = {}) => {
    const { data } = await sharp((await renderScene({ art: red, work: { id: 'abcde', size_cm: [20, 15], meta_edge }, scene: { ...scene, paper: { ...scene.paper, ...paper }, edge }, config })).buf)
      .raw().toBuffer({ resolveWithObject: true });
    let n = 0, white = 0;
    for (let i = 0; i < data.length; i += 3) {
      if (data[i] > data[i + 1] + 60) n++;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) white++; // the white middle of the work counts too
    }
    return { n, white };
  };
  const thin = await reddish('deckle', { thicknessMm: 0.01 }), thick = await reddish('deckle', { thicknessMm: 8 });
  assert.ok(thick.n > thin.n * 1.02, `the side of a thick paper painted to its edge is red: ${thick.n} > ${thin.n}`);
  assert.ok(thick.white <= thin.white * 1.01, `no white cut edge: ${thick.white} <= ${thin.white}`);
  const canvas = await reddish('canvas', {}), paper = await reddish(undefined, {});
  assert.ok(canvas.n > paper.n * 1.05, `a canvas shows its 2 cm side: ${canvas.n} > ${paper.n}`);
  // a clean cut edge and a torn one (the edge of the scene torn) differ only along the edge
  const torn = { roughCm: 0.3, roughFreq: 2.5, softCm: 0.09 };
  const cut = await reddish('cut', {}, torn), deckle = await reddish('deckle', {}, torn);
  assert.notEqual(cut.n, deckle.n);
  assert.ok(Math.abs(cut.n - deckle.n) < deckle.n * 0.08, `${cut.n} ~ ${deckle.n}`);
  assert.deepEqual(Object.keys(EDGE_KINDS), ['deckle', 'cut', 'canvas']);
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
    assert.deepEqual(s.imageSize, [sheet.width, sheet.height], s.name);
    // the camera sees a true rectangle of the sheet close to its drawn corners, from a sensible place
    const cam = sceneCamera(s);
    // the drawn sheet: close to a true rectangle of this camera (generators draw it worse than the edges of the table)
    assert.ok(cam.rms < (cam.source === 'lines' ? 40 : 20), `${s.name}: rms ${cam.rms}`);
    assert.ok(cam.zenithDeg < 70 && cam.distanceCm > 40 && cam.distanceCm < 400, s.name);
    for (const axis of Object.keys(s.lines ?? {})) {
      assert.ok(['x', 'y'].includes(axis), `${s.name}: lines.${axis}`);
      for (const line of s.lines[axis]) assert.ok(line.length === 2 && line.every((p) => p.length === 2 && p.every(Number.isFinite)), `${s.name}: lines.${axis}`);
    }
    if (s.lines) assert.ok(cam.source === 'camera' || cam.lineRms < 5, `${s.name}: edges ${cam.lineRms} px from their vanishing points`);
    if (s.camera) for (const key of ['focalMm', 'zenithDeg', 'azimuthDeg', 'distanceCm']) assert.equal(typeof s.camera[key], 'number', `${s.name}: camera.${key}`);
    for (const c of s.circles ?? []) assert.ok(c.length === 4 && c[2] > c[0] && c[3] > c[1], `${s.name}: circle`);
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

// What the prompts of mockups/instagram/README.md asked the generator for (only what it kept to): the height of the
// camera above the table (or the ledge) ±25 % (it hangs on the size of the drawn sheet), the zenith ±5° (±7° for the
// rough "about 20 degrees" of the easel), the side (azimuth) and the turn of the drawn sheet ±5°.
const PROMPTED_CAMERAS = {
  // the dark table: the generator turned the sheet by -32° (asked 6°) and looks from the right (asked from the left)
  'stul-tmavy': { heightCm: 45, zenithDeg: [50, 55] },
  // the light table: with its edges across and along (at right angles) the camera is a long lens from far away, 142 cm
  // high (asked 70), a little from the left (asked from the right), the sheet not turned (asked -5°); only the tilt holds
  'stul-svetly': { zenithDeg: [30, 35] },
  stojan: { heightCm: 20, zenithDeg: [20, 20], azimuthDeg: [45, 135], sheetDeg: 0, above: true },
};

test('the cameras of the scenes agree with the prompts of the generator', async () => {
  const { scenes } = await loadInstagramScenes();
  assert.deepEqual(Object.keys(PROMPTED_CAMERAS), scenes.map((s) => s.name), 'every scene has its prompt');
  for (const s of scenes) assert.match(s.prompt ?? '', /\d+ cm nad/, `${s.name}: prompt in scenes.yaml`);
  for (const s of scenes) {
    const want = PROMPTED_CAMERAS[s.name], cam = sceneCamera(s), { R, t } = cam;
    // the camera in the plane of the sheet: x right, y down the sheet, z away from the camera
    const C = [0, 1, 2].map((j) => -(R[0][j] * t[0] + R[1][j] * t[1] + R[2][j] * t[2]));
    const height = s.mode === 'stand' ? s.sheetCm[1] - C[1] : -C[2];
    const tol = s.mode === 'stand' ? 7 : 5;
    if (want.heightCm) assert.ok(Math.abs(height / want.heightCm - 1) <= 0.25, `${s.name}: ${height.toFixed(1)} cm high, asked ${want.heightCm}`);
    assert.ok(cam.zenithDeg >= want.zenithDeg[0] - tol && cam.zenithDeg <= want.zenithDeg[1] + tol, `${s.name}: zenith ${cam.zenithDeg.toFixed(1)}`);
    if (want.azimuthDeg) assert.ok(cam.azimuthDeg >= want.azimuthDeg[0] && cam.azimuthDeg <= want.azimuthDeg[1], `${s.name}: azimuth ${cam.azimuthDeg.toFixed(1)}`);
    if (want.sheetDeg !== undefined) assert.ok(Math.abs((cam.sheetDeg ?? 0) - want.sheetDeg) <= 5, `${s.name}: sheet turned ${cam.sheetDeg.toFixed(1)}°`);
    if (want.above) assert.ok(C[1] < s.sheetCm[1] / 2, `${s.name}: seen from above`);
  }
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
    work: { title: 'Bobří hráz', text: 'Ráno u **bobří** hráze.\n', description: 'Jen pro Google.', technique: 'akvarel', size_cm: [30, 30], tags: ['krajina', 'plenér', 'voda'] },
    year: '2026', host: 'pavla.kramolis.cz', settings,
  });
  assert.equal(text, [
    'Bobří hráz', '', 'Ráno u bobří hráze.', '', 'akvarel · 30 × 30 cm · 2026', 'pavla.kramolis.cz', '',
    '#akvarel #krajina #plener #voda #umeni', '#watercolor #landscape #pleinair #art', '',
  ].join('\n'));
});

test('instagramPost: no DOPLNIT placeholder, "na prodej" for a work on sale, no duplicate hashtags', () => {
  const text = instagramPost({
    work: { title: 'Máky', text: 'DOPLNIT popis', technique: 'akvarel', tags: ['akvarel'] },
    year: '2026', host: 'pavla.kramolis.cz', onSale: true, settings,
  });
  assert.ok(!text.includes('DOPLNIT'));
  assert.match(text, /^Máky\n\nakvarel · 2026\nObraz je na prodej\.\npavla\.kramolis\.cz\n/);
  assert.match(text, /\n#akvarel #umeni\n#watercolor #art\n$/);
});

test('instagramPost: the id of the work after the address, so the gallery search finds it', () => {
  const text = instagramPost({ work: { id: 'jujn2', title: 'Bobří hráz', technique: 'akvarel' }, year: '2026', host: 'pavla.kramolis.cz', settings });
  assert.match(text, /\npavla\.kramolis\.cz · jujn2\n\n#akvarel/);
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

test('gridLayout: tiles 3:4 side by side with the gap of the profile between them, the work above the caption', () => {
  const L = gridLayout({ cols: 3, rows: 3 }, 30 / 42, { width: 1080, padding: 0.025 });
  assert.deepEqual([L.cols, L.rows, L.tileW, L.tileH, L.gap], [3, 3, 1080, 1440, 8]);
  assert.deepEqual([L.W, L.H], [3 * 1080 + 2 * 8, 3 * 1440 + 2 * 8]);
  assert.deepEqual(L.tiles.slice(0, 4), [{ left: 0, top: 0 }, { left: 1088, top: 0 }, { left: 2176, top: 0 }, { left: 0, top: 1448 }], 'the gap is left out');
  assert.ok(L.art.top + L.art.height < L.ruleY && L.ruleY < L.H, 'the caption under the work');
  assert.ok(L.fill > 0.7 && L.fill < 0.8);
  assert.ok(Math.abs(L.art.width / L.art.height - 30 / 42) < 0.01);
  assert.deepEqual([gridLayout({ cols: 3, rows: 1 }, 3, {}).rows, gridLayout({ cols: 3, rows: 2 }, 1.4, {}).rows, gridLayout({ cols: 3, rows: 4 }, 0.5, {}).rows], [1, 2, 4]);
  const pair = gridLayout({ cols: 2, rows: 1 }, 4 / 3, { width: 1080 });
  assert.deepEqual([pair.cols, pair.rows, pair.W, pair.H], [2, 1, 2 * 1080 + 8, 1440], 'a pair side by side');
  assert.ok(pair.fill > 0.6);
  assert.equal(gridLayout({ cols: 3, rows: 3 }, 1, { grid: { gapPx: 0 } }).W, 3240, 'no gap');
  assert.ok(gridLayout({ cols: 3, rows: 3 }, 3, {}).fill < 0.4, 'a wide work in a portrait grid: mostly empty paper');
});

test('gridSuffixes: the tiles in reading order and the preview', () => {
  assert.deepEqual(gridSuffixes({ cols: 3, rows: 1 }), ['-grid-03-1_1', '-grid-02-1_2', '-grid-01-1_3', '-grid-preview']);
  const nine = gridSuffixes({ cols: 3, rows: 3 });
  assert.deepEqual([nine[0], nine[2], nine[3], nine[8]], ['-grid-09-1_1', '-grid-07-1_3', '-grid-06-2_1', '-grid-01-3_3'], 'order-row_column');
  assert.equal(gridSuffixes({ cols: 3, rows: 4 })[11], '-grid-01-4_3');
  assert.deepEqual(gridSuffixes({ cols: 2, rows: 1 }), ['-grid-02-1_1', '-grid-01-1_2', '-grid-preview']);
  assert.deepEqual(gridSuffixes(null), []);
});

test('gridPosts: published from the last tile to the first; the last one (top left) carries the whole text', () => {
  const posts = gridPosts({ work: { title: 'Tetřevská slať' }, grid: { cols: 3, rows: 1 }, post: 'Tetřevská slať\n\nPopis.\n\n#akvarel #krajina\n#watercolor\n', handle: 'pavla' });
  assert.deepEqual(posts.map((p) => p.file), ['grid-01-1_3.jpg', 'grid-02-1_2.jpg', 'grid-03-1_1.jpg']);
  assert.equal(posts[0].text, 'Tetřevská slať · díl 1/3\n\nCelý obraz se skládá z 3 dílů na profilu @pavla.\n\n#akvarel #krajina\n#watercolor\n');
  assert.equal(posts[2].text, 'Tetřevská slať\n\nPopis.\n\n#akvarel #krajina\n#watercolor\n');
  assert.ok(gridPosts({ work: { title: 'A' }, grid: { cols: 3, rows: 1 }, post: 'A\n' })[0].text.includes('na profilu.'), 'without a handle');
});

test('renderGrid: tiles 3:4 that join up across the gap, a preview with the gaps', async () => {
  // a horizontal gradient: the colour at a column depends only on x, so the seams can be checked
  const w = 600, h = 840, raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; raw[i] = Math.round(x / w * 255); raw[i + 1] = 80; raw[i + 2] = 80; }
  const art = await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const config = { width: 1080, padding: 0.025, quality: 95, grid: { gapPx: 40 } };
  const { tiles, preview, layout } = await renderGrid({
    art, work: { title: 'Slať', technique: 'akvarel', size_cm: [30, 42] }, year: '2026', host: 'pavla.kramolis.cz',
    colors: PALETTES[0].colors, fonts: await loadFonts(), grid: { cols: 3, rows: 3 }, config,
  });
  assert.equal(tiles.length, 9);
  for (const t of tiles) { const m = await sharp(t).metadata(); assert.deepEqual([m.width, m.height], [1080, 1440]); }
  const row = async (buf, x) => (await sharp(buf).extract({ left: x, top: 700, width: 1, height: 1 }).raw().toBuffer())[0];
  // across the seam of tiles 4 and 5 (middle row) the red jumps by about the width of the gap, as the profile shows it
  const step = (await row(tiles[4], 0)) - (await row(tiles[3], 1079));
  const perPx = 255 / layout.art.width;
  assert.ok(Math.abs(step - 41 * perPx) < 3, `the gap is skipped (${step})`);
  const pm = await sharp(preview).metadata();
  assert.equal(pm.width, 1080);
  const gx = Math.round((1080 + 20) * 1080 / layout.W);
  const g = await sharp(preview).extract({ left: gx, top: 300, width: 1, height: 1 }).raw().toBuffer();
  assert.ok(g[0] < 30 && g[1] < 30, 'the gap in the preview is dark');
});

test('detailLayout: a detail close to 4:5 fills the frame, a long strip lies whole on paper', () => {
  assert.equal(detailLayout(0.8, 0.8), 'crop');
  assert.equal(detailLayout(1, 0.8), 'crop', 'a square keeps 80 %');
  assert.equal(detailLayout(4 / 3, 0.8), 'whole', '4:3 would lose 40 %');
  assert.equal(detailLayout(1861 / 625, 0.8), 'whole', 'the matrix of a linocut');
  assert.equal(detailLayout(4 / 3, 0.8, 0.5), 'crop', 'own threshold');
});

test('sceneWindow: a small narrow strip comes closer until it covers minArea of the frame, at most maxAreaZoom', () => {
  const strip = [[480, 700], [560, 700], [560, 716], [480, 716]];
  const byWidth = sceneWindow(1024, 1536, strip, { minFill: 0.45, maxZoom: 1.8 });
  assert.equal(byWidth.zoom, 1.8);
  const byArea = sceneWindow(1024, 1536, strip, { minFill: 0.45, maxZoom: 1.8, minArea: 0.08, maxAreaZoom: 3 });
  assert.equal(byArea.zoom, 3, 'capped');
  const big = [[100, 300], [900, 300], [900, 900], [100, 900]];
  assert.equal(sceneWindow(1024, 1536, big, { minFill: 0.45, maxZoom: 1.8, minArea: 0.08, maxAreaZoom: 3 }).zoom, 1, 'a big work stays as it is');
});

test('detailSuffixes: a long narrow detail becomes a panorama, any other one photo', () => {
  const cfg = { width: 1080, height: 1350, padding: 0.025 };
  assert.deepEqual(detailSuffixes('kvet', 1, cfg), ['-detail-kvet']);
  assert.deepEqual(detailSuffixes('matrice', 1861 / 625, cfg), ['-detail-matrice-pano-1', '-detail-matrice-pano-2', '-detail-matrice-pano-3']);
  assert.deepEqual(detailSuffixes('pole', 4 / 3, cfg), ['-detail-pole-pano-1', '-detail-pole-pano-2'], 'whole and wide enough');
  assert.deepEqual(detailSuffixes('vez', 0.5, cfg), ['-detail-vez'], 'tall: whole on paper');
  assert.deepEqual(detailSuffixes('x', 0, cfg), ['-detail-x'], 'unknown size');
});
