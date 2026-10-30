import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import YAML from 'yaml';
import {
  CAPTION_MODES, CINEMA_DEFAULTS, captionMode, cinemaCard, cinemaPalette, cinemaPalettes, cinemaSources, cinemaFromParams, intervalLabel, cinemaSettings, cinemaToParams, dragStep, fitBox, imageWidth, shuffledOrder, wrapIndex,
} from './cinema.mjs';

const settings = cinemaSettings({});

test('cinemaSettings: the defaults, own values over them, bad values are errors; site.config.yaml is valid', () => {
  assert.deepEqual(settings, CINEMA_DEFAULTS);
  const own = cinemaSettings({ cinema: { intervals: [20, 8], defaultInterval: 8, swipe: { minPx: 30 } } });
  assert.deepEqual(own.intervals, [8, 20], 'sorted for the controls');
  assert.equal(own.swipe.minPx, 30);
  assert.equal(own.swipe.fraction, CINEMA_DEFAULTS.swipe.fraction, 'the rest of swipe from the defaults');
  assert.throws(() => cinemaSettings({ cinema: { defaultInterval: 12 } }), /defaultInterval: one of cinema.intervals/);
  assert.throws(() => cinemaSettings({ cinema: { intervals: [] } }), /intervals/);
  assert.throws(() => cinemaSettings({ cinema: { intervals: [2.5], defaultInterval: 2.5 } }), /intervals/);
  assert.throws(() => cinemaSettings({ cinema: { fadeMs: -1 } }), /fadeMs/);
  assert.throws(() => cinemaSettings({ cinema: { captionMs: 1.5 } }), /captionMs/);
  assert.throws(() => cinemaSettings({ cinema: { palette: 'cerna' } }), /cinema.palette: one of papir, pergamen, noc, auto/);
  assert.equal(cinemaSettings({ cinema: { palette: 'auto' } }).palette, 'auto');
  assert.throws(() => cinemaSettings({ cinema: { marginPercent: 60 } }), /marginPercent/);
  assert.throws(() => cinemaSettings({ cinema: { swipe: { fraction: 0 } } }), /swipe.fraction/);
  const config = YAML.parse(fs.readFileSync(new URL('../../site.config.yaml', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => cinemaSettings(config));
});

test('cinemaFromParams / cinemaToParams: the work and a picked interval; the default and an unknown one are left out', () => {
  assert.deepEqual(cinemaFromParams(new URLSearchParams('tag=voda&cinema=k3f9a&interval=45'), settings), { id: 'k3f9a', interval: 45 });
  assert.deepEqual(cinemaFromParams(new URLSearchParams('cinema=k3f9a&interval=7'), settings), { id: 'k3f9a', interval: 15 }, 'unknown = default');
  assert.deepEqual(cinemaFromParams(new URLSearchParams('tag=voda'), settings), { id: null, interval: 15 });
  assert.equal(cinemaFromParams(new URLSearchParams('cinema=a'), settings, '45').interval, 45, 'remembered without a link');
  assert.equal(cinemaFromParams(new URLSearchParams('cinema=a&interval=5'), settings, '45').interval, 5, 'the link decides');
  assert.equal(cinemaFromParams(new URLSearchParams('cinema=a'), settings, '7').interval, 15, 'remembered but no longer offered');
  const p = new URLSearchParams('tag=voda');
  assert.equal(String(cinemaToParams(p, { id: 'k3f9a', interval: 180 }, settings)), 'tag=voda&cinema=k3f9a&interval=180');
  assert.equal(String(cinemaToParams(p, { id: 'b2c3d', interval: 15 }, settings)), 'tag=voda&cinema=b2c3d', 'the default interval left out');
  assert.equal(String(cinemaToParams(p, { id: null, interval: 15 }, settings)), 'tag=voda', 'closed: neither');
});

test('captionMode / intervalLabel: the remembered mode or "for a while"; seconds and minutes', () => {
  assert.deepEqual(CAPTION_MODES.map(captionMode), CAPTION_MODES);
  assert.equal(captionMode(null), 'timed');
  assert.equal(captionMode('maybe'), 'timed');
  assert.deepEqual([5, 15, 60, 90, 180].map(intervalLabel), ['5 s', '15 s', '1 min', '90 s', '3 min']);
});

test('cinemaCard: what the cinema shows of a work, its text plain and short, a DOPLNIT text none', () => {
  const work = { title: 'Mlha', technique: 'akvarel', year: 2026, text: 'Ráno nad **rybníkem**.', image: { width: 300, height: 210, widths: [480, 960], transparent: true } };
  assert.deepEqual(cinemaCard(work, { url: '/tvorba/2026/mlha-a1b2c/', base: '/tvorba/2026/mlha-a1b2c', size: '30 × 21 cm' }), {
    title: 'Mlha', meta: 'akvarel · 30 × 21 cm · 2026', text: 'Ráno nad rybníkem.', url: '/tvorba/2026/mlha-a1b2c/',
    base: '/tvorba/2026/mlha-a1b2c', widths: [480, 960], ratio: 0.7, cutout: true,
  });
  const bare = cinemaCard({ ...work, technique: '', text: 'DOPLNIT popisek', image: { width: 3, height: 1, widths: [480] } }, { url: '/', base: '/x', size: '' });
  assert.deepEqual([bare.meta, bare.text, bare.cutout, bare.ratio], ['2026', '', false, 0.3333]);
});

test('cinemaPalettes / cinemaPalette: every palette and auto; remembered colours of the cinema or its default (Noc)', () => {
  assert.deepEqual(cinemaPalettes().map((p) => p.id), ['papir', 'pergamen', 'noc', 'auto']);
  assert.equal(cinemaPalettes().at(-1).label, 'podle systému');
  assert.equal(cinemaPalette(null, settings), 'noc');
  assert.equal(cinemaPalette('auto', settings), 'auto');
  assert.equal(cinemaPalette('pergamen', settings), 'pergamen');
  assert.equal(cinemaPalette('cerna', settings), 'noc', 'no longer offered: the default');
});

test('shuffledOrder: every id once, the first one first; wrapIndex goes round', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const order = shuffledOrder(ids, 'd', random);
  assert.equal(order[0], 'd');
  assert.deepEqual([...order].sort(), ids);
  assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'e'], 'the input is left alone');
  assert.deepEqual([...shuffledOrder(ids, 'x', random)].sort(), ids, 'an unknown first one: just shuffled');
  assert.deepEqual(shuffledOrder([], 'a'), []);
  assert.equal(wrapIndex(5, 5), 0);
  assert.equal(wrapIndex(-1, 5), 4);
  assert.equal(wrapIndex(3, 0), 0);
});

test('dragStep: far enough or a quick flick steps, a short slow drag or an upright one goes back', () => {
  const swipe = settings.swipe;
  assert.equal(dragStep(-300, 10, 1000, 900, swipe), 1, 'far to the left = next');
  assert.equal(dragStep(300, 10, 1000, 900, swipe), -1, 'far to the right = previous');
  assert.equal(dragStep(-120, 0, 1000, 900, swipe), 0, 'short and slow');
  assert.equal(dragStep(-120, 0, 1000, 150, swipe), 1, 'short but a flick');
  assert.equal(dragStep(-40, 0, 1000, 20, swipe), 0, 'a flick under minPx is a tap');
  assert.equal(dragStep(-300, 400, 1000, 300, swipe), 0, 'more up and down');
});

test('fitBox / imageWidth: as large as fits with the margin; the smallest sharp width', () => {
  assert.deepEqual(fitBox(1.5, 1000, 800, 2), { width: (800 - 32) / 1.5, height: 800 - 32 }, 'upright work: the height decides');
  assert.deepEqual(fitBox(0.5, 1000, 800, 0), { width: 1000, height: 500 }, 'wide work: the width decides');
  assert.equal(imageWidth([480, 960, 1600, 2385], 700, 2), 1600);
  assert.equal(imageWidth([480, 960, 1600, 2385], 300, 1), 480);
  assert.equal(imageWidth([960, 480], 3000, 2), 960, 'none sharp enough: the largest');
  assert.deepEqual(cinemaSources('/tvorba/2026/mlha-a1b2c', 1600), {
    avif: '/tvorba/2026/mlha-a1b2c/1600.avif', webp: '/tvorba/2026/mlha-a1b2c/1600.webp', jpg: '/tvorba/2026/mlha-a1b2c/1600.jpg',
  });
});
