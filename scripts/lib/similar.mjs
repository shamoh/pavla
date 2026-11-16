// "Podobné obrazy" on the page of a work: a filter of the gallery made of what the work shares with others (its
// technique and its tags; its colours once the works have them; never its collection: the page links the collection
// itself, the similar works should lead across the whole work), a link to the gallery with that
// filter and the first works it shows there (newest first, as the gallery), without the work itself and without the
// works already shown under "Související obrazy".
// The filter is the most specific one that still leaves at least SIMILAR_COUNT other works: greedily, every step
// adds the criterion that keeps the fewest works but not fewer than SIMILAR_COUNT. When even one criterion leaves
// fewer, the one with the most works (at least one) is the filter; without any, the work has no similar works.

import { galleryLinkTitle, filtersToParams, matchesFilters } from './gallery-filter.mjs';

/** How many similar works the page shows (one row of small pictures on a computer, twice the columns of the related). */
export const SIMILAR_COUNT = 6;

/**
 * The size of tile of the gallery the small pictures of the similar works count as (they are about as wide as a
 * medium tile): the marks over them are those of that size (site.config.yaml gallery.tileMarks, SimilarTile.astro).
 */
export const SIMILAR_TILE_SIZE = 'm';

/** An empty filter of the gallery (gallery-filter.mjs stateFromParams without any value). */
const EMPTY = { tag: [], technique: '', color: '', year: '', collection: '', status: '', featured: '', q: '' };

/** The criteria of a work, most general first: its technique, its tags (in its order). */
function criteria(work) {
  return [
    ...(work.technique ? [{ key: 'technique', value: work.technique }] : []),
    ...(Array.isArray(work.tags) ? [...new Set(work.tags.filter(Boolean))].map((t) => ({ key: 'tag', value: t })) : []),
  ];
}

const withCriterion = (state, { key, value }) => (key === 'tag'
  ? { ...state, tag: [...state.tag, value].sort((a, b) => a.localeCompare(b, 'cs')) }
  : { ...state, [key]: value });

/** A work as matchesFilters takes it (the year as text, no collection = ''). */
const filterable = (w) => ({ ...w, year: String(w.year ?? ''), collection: w.collection ?? '', tags: w.tags ?? [], search: '' });

/**
 * The similar works of `work` among `works` (the published ones, newest first): { state (the filter of the gallery),
 * works (the first `count` matching, without the work and the `exclude` ids), total (how many works the gallery shows
 * with the filter, the work itself included) }, or null without any similar work (also when all of them are among
 * `exclude`: the section would only repeat "Související obrazy").
 */
export function similarWorks(work, works, { exclude = [], count = SIMILAR_COUNT } = {}) {
  const skip = new Set([work.id, ...exclude]);
  const pool = works.filter((w) => !skip.has(w.id)).map((w) => [w, filterable(w)]);
  const matching = (state) => pool.filter(([, f]) => matchesFilters(f, state)).map(([w]) => w);
  let state = EMPTY;
  let left = criteria(work);
  for (;;) {
    const options = left.map((c) => ({ c, n: matching(withCriterion(state, c)).length })).filter((o) => o.n >= count);
    if (!options.length) break;
    const best = options.reduce((a, b) => (b.n < a.n ? b : a));
    state = withCriterion(state, best.c);
    left = left.filter((c) => c !== best.c);
  }
  if (state === EMPTY) {
    const options = left.map((c) => ({ c, n: matching(withCriterion(state, c)).length })).filter((o) => o.n > 0);
    if (!options.length) return null;
    state = withCriterion(state, options.reduce((a, b) => (b.n > a.n ? b : a)).c);
  }
  const shown = matching(state);
  return {
    state,
    works: shown.slice(0, count),
    total: works.filter((w) => matchesFilters(filterable(w), state)).length,
  };
}

/** The address of the gallery with the filter `state` (without the site base: url() adds it). */
export const galleryStatePath = (state) => `/tvorba/?${filtersToParams({ ...EMPTY, ...state })}`;

/**
 * The words of the filter for the link ("akvarel · Plenér Šumava · #krajina · #voda"): its technique, the title of its
 * collection (`collectionTitle(slug)`), its tags with "#".
 */
export const similarLabel = (state, collectionTitle = (slug) => slug) => [
  state.technique,
  state.collection && collectionTitle(state.collection),
  ...state.tag.map((t) => `#${t}`),
].filter(Boolean).join(' · ');

/** "1 obraz", "3 obrazy", "12 obrazů". */
export const worksCount = (n) => `${n} ${n === 1 ? 'obraz' : n >= 2 && n <= 4 ? 'obrazy' : 'obrazů'}`;

/** The tooltip of the link: all works of the gallery with the filter, in the wording of galleryLinkTitle. */
export const similarLinkTitle = (state, collectionTitle = (slug) => slug) => `${galleryLinkTitle('all')}: ${similarLabel(state, collectionTitle)}`;
