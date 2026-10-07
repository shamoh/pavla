// The cover of a place (a collection, a year, the home page), one rule for all of them:
//   1. its own photo (the collection's _cover.jpg, roky/<year>.jpg, _cover.jpg in the content root),
//   2. `cover: <id>`: a published work of the place, or `cover: <id>#<detail>`: one of its detail photos,
//   3. otherwise one of the newest works of the author's selection (featured) at random per visit,
//   4. otherwise the newest work.
// Every cover is shown whole, as it is, unless `aspect` (e.g. "3:2") or `focus` is set: then a chosen cover (the own
// photo or `cover`) is cropped to that aspect ratio (default 1:1) around `focus` (default [50, 50]), on the page and in
// its share image. A random cover is never cropped, so `aspect` and `focus` without a chosen one are an error.
// Pure helpers of the pipeline; the site mirrors them in src/lib/site.ts.

import path from 'node:path';
import { isValidFocus } from './photos.mjs';
import { WORKS_SUBDIR } from './content.mjs';
import { detailKey } from './works.mjs';

/** "vjr39#1-kvety" → { id: "vjr39", detail: "1-kvety" }; "vjr39" → { id: "vjr39", detail: null }. */
export function parseCoverRef(cover) {
  const [id, ...rest] = String(cover).trim().split('#');
  return { id: id.trim(), detail: rest.length ? detailKey(rest.join('#')) : null };
}

/** True when `cover` is set (not missing, not empty). */
export const hasCoverRef = (data) => data?.cover !== undefined && data.cover !== null && String(data.cover).trim() !== '';

/** True when `focus` is set (not missing, not empty). */
export const hasFocus = (data) => data?.focus !== undefined && data.focus !== null && data.focus !== '' && !(Array.isArray(data.focus) && !data.focus.length);

/** True when `aspect` is set (not missing, not empty). */
export const hasAspect = (data) => data?.aspect !== undefined && data.aspect !== null && String(data.aspect).trim() !== '';

/** "3:2" → { ratio: 1.5, css: "3 / 2" }; null for anything else (positive numbers, decimal point or comma). */
export function parseAspect(aspect) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)\s*$/.exec(String(aspect ?? ''));
  if (!m) return null;
  const [w, h] = [m[1], m[2]].map((n) => Number(n.replace(',', '.')));
  return w > 0 && h > 0 ? { ratio: w / h, css: `${w} / ${h}` } : null;
}

export const DEFAULT_ASPECT = '1:1';
export const DEFAULT_FOCUS = [50, 50];

/**
 * The crop of a chosen cover (`chosen`: an own photo or `cover`), { ratio, css, focus } when `aspect` or `focus` is set
 * (the other one defaults to DEFAULT_ASPECT / DEFAULT_FOCUS) and both are valid; null for a whole cover.
 */
export function coverCrop(data, chosen = hasCoverRef(data)) {
  if (!chosen || !(hasAspect(data) || hasFocus(data))) return null;
  const aspect = parseAspect(hasAspect(data) ? data.aspect : DEFAULT_ASPECT);
  const focus = hasFocus(data) ? data.focus : DEFAULT_FOCUS;
  return aspect && isValidFocus(focus) ? { ...aspect, focus } : null;
}

/**
 * Problems of the cover of one place. `where`: the file for messages; `data`: its description; `photoPath`: its own
 * cover photo or null; `works`: { id, data, details, slug, dir } of the whole content; `inScope(work)`: whether a work
 * belongs to the place; `scope`: its name in messages ("this collection", "2026"…).
 */
export function coverProblems({ where, data, photoPath, works, inScope = () => true, scope = '' }) {
  const problems = [];
  if (hasFocus(data) && !isValidFocus(data.focus)) {
    problems.push(`${where}: focus musí být [x, y] v procentech (0-100), např. focus: [50, 30]`);
  }
  if (hasAspect(data) && !parseAspect(data.aspect)) {
    problems.push(`${where}: aspect musí být šířka:výška, např. aspect: "3:2"`);
  }
  const cropKeys = [hasAspect(data) && 'aspect', hasFocus(data) && 'focus'].filter(Boolean).join(' a ');
  if (cropKeys && !hasCoverRef(data) && !photoPath) {
    problems.push(`${where}: ${cropKeys} ořezává jen vybraný úvodní obraz (cover: <kód> nebo vlastní úvodní fotka), náhodný se ukazuje celý; smaž ${cropKeys}`);
  }
  if (!hasCoverRef(data)) return problems;
  const cover = data.cover;
  const { id, detail } = parseCoverRef(cover);
  const work = works.find((w) => w.id === id);
  if (photoPath) problems.push(`${where}: je zadaný cover ${cover} i úvodní fotka ${path.basename(photoPath)}, nech jen jedno`);
  else if (!work) problems.push(`${where}: cover ${cover}: ${id} není kód žádného obrazu`);
  else if (!inScope(work)) problems.push(`${where}: cover ${cover} (${work.data.title}) nepatří do ${scope}`);
  else if (work.data.meta_draft) problems.push(`${where}: cover ${cover} (${work.data.title}) je rozpracovaný (meta_draft: true), na webu není`);
  else if (detail !== null && !(work.details ?? []).some((d) => d.name === detail)) {
    problems.push(`${where}: cover ${cover}: obraz ${work.data.title} nemá detailní fotku „${detail}“ (složka ${WORKS_SUBDIR}/${work.dir ? `${work.dir}/` : ''}${work.slug}/)`);
  }
  return problems;
}

/**
 * Source of the share image of a cover: { source (master file), crop (coverCrop) or null (the whole image on paper,
 * like the share image of a work) }. Null when the site uses the share image of a work: a random cover, or
 * `cover: <id>` without crop. Works: { id, data, masterPath, details: [{ name, path }] } from prepareContent.
 */
export function coverShareSource({ photoPath, data, works }) {
  if (photoPath) return { source: photoPath, crop: coverCrop(data, true) };
  if (!hasCoverRef(data)) return null;
  const { id, detail } = parseCoverRef(data.cover);
  const work = works.find((w) => w.id === id && !w.data.meta_draft);
  if (!work) return null;
  const crop = coverCrop(data);
  const source = detail ? work.details?.find((d) => d.name === detail)?.path : work.masterPath;
  if (!source || (!detail && !crop)) return null;
  return { source, crop };
}
