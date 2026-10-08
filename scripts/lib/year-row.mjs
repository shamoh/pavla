// A row of years (the year links above the gallery, the year chips of the collections overview) stays on one line,
// newest first: as many years as fit, the older ones behind one control "2017–2003 ▾" that unfolds them in place.
// The browser part (src/lib/year-row.ts) measures; this decides. Without JavaScript the row simply wraps.

/** The label of the control for the hidden years (newest first): "2017–2003", one year alone "2003". */
export function hiddenYearsLabel(years) {
  if (years.length === 0) return '';
  const [first, last] = [years[0], years.at(-1)];
  return first === last ? String(first) : `${first}–${last}`;
}

/**
 * How many of `n` years to show: the most for which `fits(k)` (k years shown, the control for the rest beside them
 * when k < n) is true, at least 0 (only the control).
 */
export function visibleCount(n, fits) {
  for (let k = n; k > 0; k--) if (fits(k)) return k;
  return 0;
}

/** True when the picked year (its index, -1 = none) is among the hidden ones: the row then starts unfolded. */
export const pickedIsHidden = (pickedIndex, shown) => pickedIndex >= shown;
