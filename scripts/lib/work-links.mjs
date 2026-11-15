// Links between works by their id: `related: [<id>, …]` of a work (its page shows "Související obrazy", both ways,
// relatedWorks in scripts/lib/works.mjs) and links in formatted texts "[text](<id>)" (scripts/lib/rich-text.mjs) of
// any description. The id of a work never changes, so a link stays right after the work is renamed or moved.
// workLinkProblems checks them all against the works of the content repository (Czech, for the run summary).
// A link with an empty label "[](<id>)" gets the title of the work (fillWorkLinkTitles): the pipeline fills it in the
// data it copies to the site and uses for exports, never in the author's file, so a renamed work renames its links.

import { workLinkIds } from './rich-text.mjs';
import { isValidId, workPath } from './works.mjs';

/** The ids `related` of a work lists (only valid ones, each once); [] for anything else. */
export const relatedIds = (data) => (Array.isArray(data?.related) ? [...new Set(data.related.filter(isValidId))] : []);

/** The ids every formatted attribute of a description links to: [{ key, id }] (`rich` fields and each text of `richMap`). */
function textLinks(data, schema) {
  const links = [];
  for (const field of schema.fields) {
    const value = data?.[field.key];
    if (field.rich) links.push(...workLinkIds(value).map((id) => ({ key: field.key, id })));
    if (field.richMap && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [name, text] of Object.entries(value)) links.push(...workLinkIds(text).map((id) => ({ key: `${field.key} ${name}`, id })));
    }
  }
  return links;
}

/**
 * Problems of the links between works: `works` [{ id, data, yamlPath | slug + dir }] (all of them, drafts too),
 * `descriptions` [{ yamlPath, data, schema, draft? }] every description with formatted texts (works included).
 * Returns { problems (errors: an id no work has, `related` that is no list of ids or lists the work itself),
 * advice (a published description links to a draft: the site shows it once that is published) }.
 */
export function workLinkProblems({ works = [], descriptions = [] }) {
  const byId = new Map(works.filter((w) => isValidId(w.id)).map((w) => [w.id, w]));
  const problems = [];
  const advice = [];
  const target = (where, what, id, draft) => {
    const work = byId.get(id);
    if (!work) {
      problems.push(`${where}: ${what} vede na kód „${id}“, který žádný obraz nemá; oprav ho podle id obrazu v jeho popisu [neznamy-obraz-v-odkazu]`);
    } else if (work.data?.meta_draft && !draft) {
      advice.push(`${where}: ${what} vede na rozpracovaný obraz ${workPath(work)} (${id}); na webu se ukáže, až ho zveřejníš [odkaz-na-rozpracovany]`);
    }
  };
  for (const w of works) {
    const related = w.data?.related;
    if (related === undefined || related === null || (Array.isArray(related) && !related.length)) continue;
    const where = workPath(w);
    if (!Array.isArray(related) || related.some((id) => !isValidId(id))) {
      problems.push(`${where}: related musí být seznam kódů id obrazů, např. [k3f9a, chqmf], ne „${JSON.stringify(related)}“ [spatne-souvisejici]`);
      continue;
    }
    if (related.includes(w.id)) problems.push(`${where}: related obsahuje kód tohoto obrazu (${w.id}), obraz nemůže souviset sám se sebou [spatne-souvisejici]`);
    for (const id of relatedIds(w.data).filter((id) => id !== w.id)) target(where, 'related', id, Boolean(w.data?.meta_draft));
  }
  for (const d of descriptions) {
    for (const { key, id } of textLinks(d.data, d.schema)) target(d.yamlPath, `odkaz v ${key}`, id, Boolean(d.draft));
  }
  return { problems, advice };
}

/** A link to a work with an empty label: "[](chqmf)", also "[ ](chqmf)". */
const EMPTY_LINK = /\[\s*\]\(([^)\s]+)\)/g;

/**
 * A formatted text with the title of the work in every link to it with an empty label ("[](chqmf)" -> "[PF 2025](chqmf)");
 * `titleOf(id)` the title of a work, nothing for an unknown id (that link stays, workLinkProblems reports it). Square
 * brackets of a title are left out (they would end the label); anything else as it is.
 */
export const fillWorkLinkTitles = (text, titleOf) => (typeof text === 'string'
  ? text.replace(EMPTY_LINK, (whole, id) => {
    const title = isValidId(id) ? String(titleOf(id) ?? '').replace(/[[\]\n]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    return title ? `[${title}](${id})` : whole;
  })
  : text);

/**
 * Fills the titles into the links with an empty label of every formatted attribute of `descriptions`
 * ([{ data, schema }], workLinkProblems), in place: their data is what the site and the exports get. `works` all of
 * them (drafts too: a link to a draft shows its title as plain text). Returns how many texts changed.
 */
export function fillDescriptionsWorkLinks(descriptions, works) {
  const titles = new Map(works.filter((w) => isValidId(w.id)).map((w) => [w.id, w.data?.title]));
  const titleOf = (id) => (typeof titles.get(id) === 'string' ? titles.get(id) : '');
  let changed = 0;
  const fill = (text) => {
    const filled = fillWorkLinkTitles(text, titleOf);
    if (filled !== text) changed += 1;
    return filled;
  };
  for (const { data, schema } of descriptions) {
    if (!data || typeof data !== 'object') continue;
    for (const field of schema.fields) {
      const value = data[field.key];
      if (field.rich && typeof value === 'string') data[field.key] = fill(value);
      if (field.richMap && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [name, text] of Object.entries(value)) value[name] = fill(text);
      }
    }
  }
  return changed;
}
