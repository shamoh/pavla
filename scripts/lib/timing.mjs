// How long the parts of a pipeline run take, for its log: the phases of the run (checks, previews of drafts, works,
// the rest) and the steps of every regenerated work (web images, mockups, details, exports…), so a slow run on
// GitHub shows where its time goes.

/**
 * A stopwatch: lap(name) ends the part since the previous lap (or the start) under `name`; laps() the parts so far,
 * total() the time since the start, both in ms. `now` returns ms (performance.now by default; tests pass their own).
 */
export function stopwatch(now = () => performance.now()) {
  const start = now();
  let last = start;
  const parts = [];
  return {
    lap(name) {
      const t = now();
      parts.push({ name, ms: t - last });
      last = t;
    },
    laps: () => parts,
    total: () => now() - start,
  };
}

/** "0.4 s", "12.3 s", "2 min 05 s". */
export function formatDuration(ms) {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const whole = Math.round(s);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`;
}

/**
 * One line for the log: the parts in the order they first came (parts of the same name added up, e.g. the mockups
 * of several scenes), those under `minMs` left out, and the total: "web 12.3 s · mockups 20.1 s · total 33.0 s".
 */
export function formatLaps(laps, total, { minMs = 50 } = {}) {
  const sums = new Map();
  for (const { name, ms } of laps) sums.set(name, (sums.get(name) ?? 0) + ms);
  const parts = [...sums].filter(([, ms]) => ms >= minMs).map(([name, ms]) => `${name} ${formatDuration(ms)}`);
  return [...parts, `total ${formatDuration(total)}`].join(' · ');
}
