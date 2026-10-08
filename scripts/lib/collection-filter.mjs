// Year filter of the collections overview (/tvorba/kolekce/), shared by its build, its browser script and the tests.
// A collection belongs to every year one of its works was painted in (the year of its `date`); picking a year
// leaves the collections with at least one work of that year, each with the number of its works from that year
// and a link opening the collection filtered to it. The year lives in the URL (?year=2025), so the filtered
// overview can be shared as a link.

import { offersOption } from './gallery-filter.mjs';

/** Works of a collection per year, newest first: [[2026, 2], [2025, 3]]. */
export function yearCounts(works) {
  const counts = new Map();
  for (const w of works) counts.set(w.year, (counts.get(w.year) ?? 0) + 1);
  return [...counts].sort((a, b) => b[0] - a[0]);
}

/** yearCounts written to a data attribute: "2026:2|2025:3". */
export const encodeYearCounts = (counts) => counts.map(([y, n]) => `${y}:${n}`).join('|');

/** A data attribute back to yearCounts: [[2026, 2], [2025, 3]]; '' = []. */
export const parseYearCounts = (text) => (text ? text.split('|').map((pair) => pair.split(':').map(Number)) : []);

/**
 * The year options worth offering for collections given by their years ([[2026, 2025], [2026]]), newest first:
 * [{ year, count }] with count = collections of that year. Like the gallery filters (offersOption), a year with no
 * collection or with all of them (the same as "Vše") is not offered; [] = no year filter at all.
 */
export function yearOptions(collectionsYears) {
  const counts = new Map();
  for (const years of collectionsYears) for (const y of new Set(years)) counts.set(y, (counts.get(y) ?? 0) + 1);
  return [...counts]
    .map(([year, count]) => ({ year, count }))
    .filter((o) => offersOption(o.count, collectionsYears.length))
    .sort((a, b) => b.year - a.year);
}

/** The year picked in the URL (?year=2025) when it is one of the offered years (numbers), otherwise '' (all). */
export function yearFromParams(params, offered) {
  const year = params.get('year') ?? '';
  return offered.some((y) => String(y) === year) ? year : '';
}

/** URL search params of a picked year ('' = all, no parameter). */
export const yearToParams = (year) => new URLSearchParams(year ? { year } : {});

/** True when a collection with these years (strings or numbers) is shown for the picked year ('' = all). */
export const matchesYear = (years, year) => !year || years.some((y) => String(y) === String(year));

/** Czech noun after a number of works: 1 dílo, 2–4 díla, 0 and 5+ děl. */
export const worksPlural = (n) => (n === 1 ? 'dílo' : n >= 2 && n <= 4 ? 'díla' : 'děl');

/**
 * The number of works of a collection: "5 děl", with a year picked "2 z 5 děl" (count of that year, of all);
 * when the year has all of them, just "5 děl". The "z <total>" part is always 2 or more, so always "děl".
 */
export const worksLabel = (count, total) => (count < total ? `${count} z ${total} děl` : `${total} ${worksPlural(total)}`);

/**
 * The link to a collection page from the overview: with the picked year (?year=2025) the collection opens filtered
 * to it, unless the year has all its works (the filter would change nothing). A link that has a query already
 * (the works in no collection, /tvorba/?collection=none) gets the year added to it.
 */
export const collectionLink = (href, year, count, total) =>
  (year && count < total ? `${href}${href.includes('?') ? '&' : '?'}${yearToParams(year)}` : href);

/**
 * The link to the collections overview from a year page: filtered to the year when the overview offers it
 * (`offered`: yearOptions years), otherwise the whole overview.
 */
export const overviewLink = (href, year, offered) => (offered.includes(year) ? `${href}?${yearToParams(String(year))}` : href);
