// The cover of a place (a collection, a year, the home page), one rule for all of them:
//   1. its own photo (the collection's _uvod.jpg, roky/<year>.jpg, uvod.jpg),
//   2. `cover: <id>`: a published work of the place, or `cover: <id>#<detail>`: one of its detail photos,
//   3. otherwise one of the newest works of the author's selection (featured) at random per visit,
//   4. otherwise the newest work.
// Every cover is shown whole, as it is. Only `cover` together with `focus` crops the chosen work (or detail photo) to
// 3:2 around `focus`, on the page and in its share image; `focus` without `cover` is an error (it would do nothing).
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

/** True when `focus` is set (not missing, not empty): the chosen cover is then cropped to 3:2 around it. */
export const hasFocus = (data) => data?.focus !== undefined && data.focus !== null && data.focus !== '' && !(Array.isArray(data.focus) && !data.focus.length);

/**
 * Problems of the cover of one place. `where`: the file for messages; `data`: its description; `photoPath`: its own
 * cover photo or null; `works`: { id, data, details, slug, dir } of the whole content; `inScope(work)`: whether a work
 * belongs to the place; `scope`: its name in messages ("this collection", "2026"…).
 */
export function coverProblems({ where, data, photoPath, works, inScope = () => true, scope = '' }) {
  const problems = [];
  if (hasFocus(data) && !isValidFocus(data.focus)) {
    problems.push(`${where}: focus must be [x, y] in % (0–100), e.g. focus: [50, 30]`);
  }
  if (hasFocus(data) && !hasCoverRef(data)) {
    problems.push(photoPath
      ? `${where}: focus does not apply to the own cover photo ${path.basename(photoPath)}, it is shown as it is; remove focus`
      : `${where}: focus only crops the work chosen by cover (cover: <id>); without cover remove focus`);
  }
  if (!hasCoverRef(data)) return problems;
  const cover = data.cover;
  const { id, detail } = parseCoverRef(cover);
  const work = works.find((w) => w.id === id);
  if (photoPath) problems.push(`${where}: cover ${cover} and the cover photo ${path.basename(photoPath)} both set, keep one`);
  else if (!work) problems.push(`${where}: cover ${cover}: ${id} is not the id of any work`);
  else if (!inScope(work)) problems.push(`${where}: cover ${cover} (${work.data.title}) is not in ${scope}`);
  else if (work.data.draft) problems.push(`${where}: cover ${cover} (${work.data.title}) is a draft, it is not on the web`);
  else if (detail !== null && !(work.details ?? []).some((d) => d.name === detail)) {
    problems.push(`${where}: cover ${cover}: ${work.data.title} has no detail photo "${detail}" (folder ${WORKS_SUBDIR}/${work.dir ? `${work.dir}/` : ''}${work.slug}/)`);
  }
  return problems;
}

/**
 * Source of the share image of a cover: { source (master file), focus (crop to 3:2 around it) or null (the whole
 * image on paper, like the share image of a work) }. Null when the site uses the share image of a work: a random cover,
 * or `cover: <id>` without focus. Works: { id, data, masterPath, details: [{ name, path }] } from prepareContent.
 */
export function coverShareSource({ photoPath, data, works }) {
  if (photoPath) return { source: photoPath, focus: null };
  if (!hasCoverRef(data)) return null;
  const { id, detail } = parseCoverRef(data.cover);
  const work = works.find((w) => w.id === id && !w.data.draft);
  if (!work) return null;
  const focus = hasFocus(data) ? data.focus : null;
  const source = detail ? work.details?.find((d) => d.name === detail)?.path : work.masterPath;
  if (!source || (!detail && !focus)) return null;
  return { source, focus };
}
