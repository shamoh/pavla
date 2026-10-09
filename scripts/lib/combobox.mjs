// The collection filter of the gallery as a combobox (ARIA pattern; the browser part is src/lib/combobox.ts): typing
// lists the collections in Czech alphabetical order (czechOrder in scripts/lib/gallery-filter.mjs), typing narrows the list by the rules of the search
// (scripts/lib/search.mjs) and keeps the order, "vše" (and "žádná") stay on top. What is typed never goes to the URL,
// only the picked collection.

import { matchesQuery, normalizeQuery } from './search.mjs';

/**
 * The indexes of the options a combobox lists for the typed text (`labels`: the option names in order): every option
 * while nothing is typed; otherwise the first `keep` options ("vše", "žádná": never searched for, always a way back)
 * and those whose name has every typed word.
 */
export function comboMatches(labels, typed, keep = 1) {
  return labels.map((_, i) => i).filter((i) => i < keep || matchesQuery(labels[i], typed));
}

/**
 * The active option after an arrow key: `delta` +1 / -1 moves within `count` options and wraps around; from none
 * (-1) the first one going down, the last one going up. -1 when there is none.
 */
export function nextActive(current, delta, count) {
  if (count === 0) return -1;
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (current + delta + count) % count;
}

/**
 * The option a typed text points at (a position in `matches`): the first one after the kept ones, or the first one;
 * an emptied field points at the first one ("vše", which the field then shows as its hint); -1 for no options.
 */
export function typedActive(matches, typed, keep = 1) {
  if (matches.length === 0) return -1;
  if (!normalizeQuery(typed)) return 0;
  const found = matches.findIndex((i) => i >= keep);
  return found >= 0 ? found : 0;
}
