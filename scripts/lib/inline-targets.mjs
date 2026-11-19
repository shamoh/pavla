// Inline scripts that run on an element before them (the view of a gallery grid and of "Nejnovější", the random
// cover): each finds the nearest earlier sibling with its marker attribute (viewGridBefore, pickBoxBefore), never just
// the element right before it (a component may put its own script after the grid, as WorkGrid.astro does for the
// hearts of favourites; the home page then went without its view switch).
// inlineScriptProblems checks built pages (npm run check:images) and evaluateInlineScripts the deployed ones (the weekly
// health check): every such script has its element, no inline script takes the fragile
// `document.currentScript.previousElementSibling`, and the data-view of the grid it finds is a valid setup (JSON with keys, views, tiles).
import { coded } from './codes.mjs';
import { decodeEntities } from './page-check.mjs';
import { VIEW_GRID_ATTRIBUTE, viewGridBefore } from './view-layout.mjs';
import { PICK_BOX_ATTRIBUTE, pickBoxBefore } from './random-pick.mjs';

/** Each finder of an inline script and the attribute of the element it finds. */
export const INLINE_TARGETS = [
  { finder: viewGridBefore.name, attribute: VIEW_GRID_ATTRIBUTE },
  { finder: pickBoxBefore.name, attribute: PICK_BOX_ATTRIBUTE },
];

/** What an inline script must never take: whatever happens to be right before it. */
export const FRAGILE_TARGET = 'document.currentScript.previousElementSibling';

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TAGS = new Set(['script', 'style', 'textarea', 'title']);
const TAG_PATTERN = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTRIBUTE_PATTERN = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** The attributes of a tag as a Map: name (lower case) -> value with entities decoded, null for one without a value. */
const attributeMap = (text) => new Map([...text.matchAll(ATTRIBUTE_PATTERN)].map(([, name, double, single, bare]) => {
  const value = double ?? single ?? bare;

  return [name.toLowerCase(), value === undefined ? null : decodeEntities(value)];
}));

/**
 * The elements of `html` in page order: { tag, attributes (a Map, attributeMap), parent (index, -1 = none), content (the
 * text of a script, style, textarea or title) }. Enough for built pages (closed tags, void and self-closing ones),
 * not a full HTML parser.
 */
export function htmlElements(html) {
  const lower = html.toLowerCase();
  const elements = [];
  const open = [];
  const pattern = new RegExp(TAG_PATTERN.source, 'g');
  let match;
  while ((match = pattern.exec(html))) {
    const [, closing, opening, attributes = '', selfClosing] = match;
    if (closing) {
      const name = closing.toLowerCase();
      const at = open.findLastIndex((index) => elements[index].tag === name);
      if (at >= 0) open.length = at;
      continue;
    }
    if (!opening) continue;
    const tag = opening.toLowerCase();
    const element = {
      tag,
      attributes: attributeMap(attributes),
      parent: open.at(-1) ?? -1,
      content: '',
    };
    elements.push(element);
    if (RAW_TAGS.has(tag)) {
      const end = lower.indexOf(`</${tag}`, pattern.lastIndex);
      const stop = end < 0 ? html.length : end;
      element.content = html.slice(pattern.lastIndex, stop);
      const after = html.indexOf('>', stop);
      pattern.lastIndex = after < 0 ? html.length : after + 1;
    } else if (!selfClosing && !VOID_TAGS.has(tag)) {
      open.push(elements.length - 1);
    }
  }

  return elements;
}

/**
 * The texts of each problem (`code` + `detail`): English for the console (npm run check:images), Czech for the report
 * of the weekly health check. The codes are those of all messages (scripts/lib/codes.mjs).
 */
const PROBLEM_TEXTS = {
  'skript-bere-predchozi-prvek': [
    `an inline script uses ${FRAGILE_TARGET} (find the element by its attribute, INLINE_TARGETS)`,
    'vložený skript bere prvek přímo před sebou (má ho hledat podle značky)',
  ],
  'skript-bez-prvku': [
    (d) => `${d.finder} finds no earlier element with ${d.attribute}`,
    (d) => `vložený skript ${d.finder} nenajde před sebou prvek s ${d.attribute}`,
  ],
  'data-view-neplatny': [(d) => `data-view is not a valid grid setup (${d})`, (d) => `nastavení mřížky (data-view) není v pořádku (${d})`],
};

/** The text of a problem ({ code, detail }) in `lang` ('en' or 'cs'), without its page. */
export function inlineProblemText({ code, detail }, lang = 'en') {
  const text = PROBLEM_TEXTS[code][lang === 'cs' ? 1 : 0];

  return typeof text === 'function' ? text(detail) : text;
}

const isNameList = (value) => Array.isArray(value) && value.length > 0 && value.every((name) => typeof name === 'string' && name !== '');
const isName = (value) => typeof value === 'string' && value !== '';

/**
 * Why `text` (a data-view, the setup of a grid: viewSetup in view-layout.mjs) is no usable setup, null when it is one:
 * not JSON, not an object, `keys` without the storage keys `view` and `tile`, `views` / `tiles` not a list of names or
 * without the default (`defaultView`, `defaultTile`). All the reasons, joined by "; ".
 */
export function viewSetupProblem(text) {
  let setup;
  try {
    setup = JSON.parse(text ?? '');
  } catch (e) {
    return e.message;
  }
  if (!setup || typeof setup !== 'object' || Array.isArray(setup)) return 'not an object';
  const reasons = [];
  const keys = setup.keys;
  if (!keys || typeof keys !== 'object' || !isName(keys.view) || !isName(keys.tile)) reasons.push('keys without view and tile');
  for (const [list, fallback] of [['views', 'defaultView'], ['tiles', 'defaultTile']]) {
    if (!isNameList(setup[list])) reasons.push(`${list} is not a list of names`);
    else if (!setup[list].includes(setup[fallback])) reasons.push(`${fallback} ${JSON.stringify(setup[fallback] ?? null)} is not among ${list}`);
  }

  return reasons.length ? reasons.join('; ') : null;
}

/**
 * Problems of the inline scripts of built `pages` ({ path, html }) as [{ path, code, detail }]:
 * `skript-bere-predchozi-prvek` = a script takes the element right before it, `skript-bez-prvku` = a script with no
 * earlier sibling with the attribute its finder looks for (it would do nothing; detail { finder, attribute }),
 * `data-view-neplatny` = the data-view of the grid a view script finds is no valid setup (viewSetupProblem) (the script would fail;
 * detail = why; the buttons of the view switch carry a data-view of their own, not checked).
 */
export function inlineScriptProblems(pages) {
  return pages.flatMap(({ path, html }) => {
    const elements = htmlElements(html);

    return elements.flatMap((element, index) => {
      if (element.tag !== 'script' || element.attributes.has('src')) return [];
      if (element.content.includes(FRAGILE_TARGET)) return [{ path, code: 'skript-bere-predchozi-prvek' }];
      const before = elements.slice(0, index).filter((other) => other.parent === element.parent);

      return INLINE_TARGETS
        .filter((target) => element.content.includes(`${target.finder}(document.currentScript)`))
        .flatMap((target) => {
          const found = before.findLast((other) => other.attributes.has(target.attribute));
          if (!found) return [{ path, code: 'skript-bez-prvku', detail: target }];
          // the grid a view script found: its setup is parsed as JSON (buttons of the switch have data-view too)
          const problem = target.attribute === VIEW_GRID_ATTRIBUTE && viewSetupProblem(found.attributes.get(VIEW_GRID_ATTRIBUTE));

          return problem ? [{ path, code: 'data-view-neplatny', detail: problem }] : [];
        });
    });
  });
}

/**
 * Czech result of the checks of the inline scripts over the pages of the deployed site (`pages`: [{ path, html }] as
 * the weekly health check read them, null = not read) for its report, at most `limit` problems listed. All pages,
 * also those with noindex (a grid is on them too).
 */
export function evaluateInlineScripts(pages, { limit = 10 } = {}) {
  if (pages === null) return { ok: true, message: 'Vložené skripty stránek nebyly zkontrolovány.' };
  const problems = inlineScriptProblems(pages);
  if (problems.length === 0) {
    return { ok: true, message: `Vložené skripty stránek najdou své prvky (${pages.length} ${pages.length === 1 ? 'stránka' : pages.length >= 2 && pages.length <= 4 ? 'stránky' : 'stránek'}).` };
  }
  const lines = [`Vložené skripty stránek mají ${problems.length} ${problems.length === 1 ? 'problém' : problems.length <= 4 ? 'problémy' : 'problémů'} (zobrazení galerie, „Nejnovější“ nebo úvodní obraz nejspíš nefungují):`];
  lines.push(...problems.slice(0, limit).map((p) => `- ${p.path}: ${coded(p.code, inlineProblemText(p, 'cs'))}`));
  if (problems.length > limit) lines.push(`- … a dalších ${problems.length - limit}`);
  lines.push('„Kontrola kódu“ to hlídá před sloučením, nasazený web je tedy nejspíš z commitu, který jí neprošel; spusť `npm run build` a `npm run check:images`.');

  return { ok: false, message: lines.join('\n') };
}
