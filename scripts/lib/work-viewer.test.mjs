import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoHide, CONTROLS_MS, VIEWER_TEXT_MAX, workCaption, hashId, MAIN_VIEW, MOCKUPS_NOTE, mockupCaption, mockupsHeading, swipeStep, SWIPE_PX, viewId, viewIndex } from './work-viewer.mjs';

test('viewId names the work, its details and its mockups', () => {
  assert.equal(viewId({ kind: 'main' }), MAIN_VIEW);
  assert.equal(viewId({ kind: 'main' }), 'obraz');
  assert.equal(viewId({ kind: 'detail', name: 'oci' }), 'detail-oci');
  assert.equal(viewId({ kind: 'mockup', name: 'obyvak-svetly' }), 'mockup-obyvak-svetly');
});

test('hashId reads the id from a location hash', () => {
  assert.equal(hashId('#detail-oci'), 'detail-oci');
  assert.equal(hashId('detail-oci'), 'detail-oci');
  assert.equal(hashId('#detail-%C5%A1ipka'), 'detail-šipka');
  for (const hash of ['', '#', null, undefined, '#%E0%A4%A']) assert.equal(hashId(hash), '', String(hash));
});

test('viewIndex finds the view a hash names, -1 for none or an unknown one', () => {
  const ids = ['obraz', 'detail-oblicej', 'detail-oci', 'mockup-obyvak-svetly'];
  assert.equal(viewIndex('#obraz', ids), 0);
  assert.equal(viewIndex('#detail-oci', ids), 2);
  assert.equal(viewIndex('#mockup-obyvak-svetly', ids), 3);
  for (const hash of ['', '#', '#detail-nos', '#oci', '#mockup-', '#viewer', '#%E0%A4%A']) assert.equal(viewIndex(hash, ids), -1, hash);
});

test('mockupsHeading speaks to a buyer only when the work is on sale', () => {
  assert.equal(mockupsHeading(true), 'Jak by mohl vypadat u vás');
  assert.equal(mockupsHeading(false), 'Jak by mohl vypadat na zdi');
});

test('a mockup is called a visualisation, the note says the frame is not part of the work', () => {
  assert.equal(mockupCaption('Obývák večer'), 'Obývák večer (vizualizace)');
  assert.match(MOCKUPS_NOTE, /^Vizualizace/);
  assert.match(MOCKUPS_NOTE, /rám/);
});

test('swipeStep: to the left = next, to the right = previous, short or vertical moves are no swipe', () => {
  assert.equal(swipeStep(-80, 10), 1);
  assert.equal(swipeStep(80, -10), -1);
  assert.equal(swipeStep(-SWIPE_PX, 0), 1);
  assert.equal(swipeStep(-(SWIPE_PX - 1), 0), 0);
  assert.equal(swipeStep(0, 0), 0);
  assert.equal(swipeStep(-80, 120), 0, 'scrolling down');
  assert.equal(swipeStep(-80, -80), 0, 'diagonal');
  assert.equal(swipeStep(-30, 0, 20), 1, 'own minimum');
});

// a fake clock: timers run when the test moves the time on
function clock() {
  let now = 0, next = 1;
  const timers = new Map();
  return {
    setTimer: (fn, ms) => { timers.set(next, { at: now + ms, fn }); return next++; },
    clearTimer: (id) => timers.delete(id),
    tick(ms) {
      now += ms;
      for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); }
    },
    get pending() { return timers.size; },
  };
}

test('autoHide shows the controls for a while, every show() starts the time again', () => {
  const c = clock();
  const seen = [];
  const controls = autoHide((v) => seen.push(v), c);
  assert.equal(controls.visible, false);
  controls.show();
  assert.equal(controls.visible, true);
  c.tick(CONTROLS_MS - 1);
  controls.show();
  c.tick(CONTROLS_MS - 1);
  assert.equal(controls.visible, true, 'moved again: still there');
  c.tick(1);
  assert.equal(controls.visible, false);
  assert.deepEqual(seen, [true, false], 'applied only on a change');
  assert.equal(c.pending, 0);
});

test('autoHide keeps the controls while held (the pointer over an arrow), then the time runs again', () => {
  const c = clock();
  const controls = autoHide(() => {}, c);
  controls.show();
  controls.hold(true);
  c.tick(CONTROLS_MS * 5);
  assert.equal(controls.visible, true);
  controls.hold(false);
  c.tick(CONTROLS_MS);
  assert.equal(controls.visible, false);
});

test('autoHide: a tap toggles, hide() is immediate and forgets the hold', () => {
  const c = clock();
  const controls = autoHide(() => {}, c);
  controls.toggle();
  assert.equal(controls.visible, true);
  controls.toggle();
  assert.equal(controls.visible, false);
  assert.equal(c.pending, 0);
  controls.hold(true);
  controls.hide();
  assert.equal(controls.visible, false);
  controls.show();
  c.tick(CONTROLS_MS);
  assert.equal(controls.visible, false, 'no hold left over');
});

test('workCaption: the title and the text of the work, plain and shortened; the title alone without text', () => {
  assert.equal(workCaption({ title: 'Orangutan', text: 'Mládě se **tiskne** k [mámě](/tvorba/).\n\nDruhý odstavec.' }), 'Orangutan · Mládě se tiskne k mámě. Druhý odstavec.');
  for (const text of [undefined, '', '  \n ']) assert.equal(workCaption({ title: 'Orangutan', text }), 'Orangutan');
  const long = workCaption({ title: 'T', text: 'slovo '.repeat(100) });
  assert.ok(long.length <= 'T · '.length + VIEWER_TEXT_MAX && long.endsWith('…'), long);
});
