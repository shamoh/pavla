import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatLaps, stopwatch } from './timing.mjs';

/** A clock that returns the given times one by one. */
const clock = (...times) => () => times.shift();

test('stopwatch: every lap is the time since the previous one, the total since the start', () => {
  const watch = stopwatch(clock(1000, 1400, 4400, 4500));
  watch.lap('web');
  watch.lap('mockups');
  assert.deepEqual(watch.laps(), [{ name: 'web', ms: 400 }, { name: 'mockups', ms: 3000 }]);
  assert.equal(watch.total(), 3500);
});

test('stopwatch: without laps there are no parts, only the total', () => {
  const watch = stopwatch(clock(0, 250));
  assert.deepEqual(watch.laps(), []);
  assert.equal(watch.total(), 250);
});

test('formatDuration: tenths of a second below a minute, minutes and seconds above', () => {
  assert.equal(formatDuration(0), '0.0 s');
  assert.equal(formatDuration(431), '0.4 s');
  assert.equal(formatDuration(12_345), '12.3 s');
  assert.equal(formatDuration(59_940), '59.9 s');
  assert.equal(formatDuration(60_000), '1 min 00 s');
  assert.equal(formatDuration(125_400), '2 min 05 s');
  assert.equal(formatDuration(-5), '0.0 s', 'never negative');
});

test('formatLaps: parts in their order, the same name added up, short ones left out, the total last', () => {
  const laps = [
    { name: 'web', ms: 12_300 }, { name: 'mockups', ms: 8000 }, { name: 'og', ms: 20 }, { name: 'mockups', ms: 12_100 },
  ];
  assert.equal(formatLaps(laps, 33_000), 'web 12.3 s · mockups 20.1 s · total 33.0 s');
  assert.equal(formatLaps(laps, 33_000, { minMs: 0 }), 'web 12.3 s · mockups 20.1 s · og 0.0 s · total 33.0 s');
  assert.equal(formatLaps([], 1500), 'total 1.5 s');
});
