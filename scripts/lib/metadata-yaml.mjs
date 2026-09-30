// Keeps the content YAML files (works, collections, photos) in line with their schema (scripts/lib/schema.mjs):
//   - every attribute of the schema is there, in schema order; a missing one is added with its default value,
//   - right above each attribute stands its technical comment, worded as in the schema; "DOPLNIT" in front of it
//     marks a value that still needs checking (added by the pipeline, removed by people),
//   - an author's own comment above an attribute stays, above the technical one,
//   - attributes the schema does not know stay too, at the end, marked "NEZNÁMÝ",
//   - the comment at the top of the file stays there, separated by an empty line,
//   - values never change (the result is checked), nor does the way they are written (| blocks, [a, b], quotes).
// Files written before technical comments existed are converted: comments at the end of a line become the author's
// own comment above the attribute, unless they come from the old templates (LEGACY_COMMENTS).

import { isDeepStrictEqual } from 'node:util';
import YAML from 'yaml';
import { LEGACY_COMMENTS, TODO, UNKNOWN_DOC, docLines } from './schema.mjs';

const STRINGIFY = { lineWidth: 0, nullStr: '', flowCollectionPadding: false };

/** Comment text of the yaml library (" line\n line") as lines, and back. */
const toLines = (comment) => (comment ? comment.split('\n').map((l) => (l.startsWith(' ') ? l.slice(1) : l)) : []);
const toComment = (lines) => (lines.length ? lines.map((l) => (l ? ` ${l}` : '')).join('\n') : undefined);

/**
 * Splits the comment lines above an attribute into the author's own lines and a technical comment at their end
 * (current or older wording of one of `docs`). Returns { own, found, todo }.
 */
function splitComment(lines, docs) {
  for (const doc of docs) {
    const n = doc.length;
    if (lines.length < n) continue;
    const tail = lines.slice(lines.length - n);
    const first = tail[0].startsWith(`${TODO} `) ? tail[0].slice(TODO.length + 1) : tail[0];
    if (first === doc[0] && tail.slice(1).every((l, i) => l === doc[i + 1])) {
      return { own: lines.slice(0, lines.length - n), found: true, todo: first !== tail[0] };
    }
  }
  return { own: lines, found: false, todo: false };
}

const withoutLegacy = (lines) => lines.filter((l) => !LEGACY_COMMENTS.has(l.trim()) && !LEGACY_COMMENTS.has(l));

/** Technical comment lines, with DOPLNIT in front when the value still needs checking. */
const technical = (doc, todo) => (todo ? [`${TODO} ${doc[0]}`, ...doc.slice(1)] : doc);

function newValueNode(doc, field, value) {
  const node = doc.createNode(value);
  if (Array.isArray(value)) node.flow = true;
  if (field.block && typeof value === 'string') node.type = 'BLOCK_LITERAL';
  return node;
}

/**
 * Brings one YAML text in line with `schema`. Every added attribute is marked DOPLNIT, except generated ones.
 * An added attribute gets the value that means the same as its absence (`missing` in the schema), so nothing
 * changes on the site. Options: `values` (values of added attributes, e.g. { id, title, date } of a new skeleton),
 * `header` (top comment when the file has none), `fresh` (a new skeleton: schema defaults instead).
 * Returns { text, changed, added (keys), unknown (keys), problem } — with a problem the text is the original.
 */
export function normalizeMetadata(text, schema, { values = {}, header = null, fresh = false } = {}) {
  const doc = YAML.parseDocument(text);
  if (doc.errors.length) return { text, changed: false, added: [], unknown: [], problem: `invalid YAML (${doc.errors[0].message.split('\n')[0]})` };
  if (doc.contents !== null && !YAML.isMap(doc.contents)) {
    return { text, changed: false, added: [], unknown: [], problem: 'must be a list of attributes (key: value)' };
  }
  const before = doc.toJS() ?? {};
  const pairs = doc.contents?.items ?? [];
  const byKey = new Map(pairs.map((p) => [String(p.key?.value ?? p.key), p]));
  const known = new Map(schema.fields.map((f) => [f.key, f]));

  let top = toLines(doc.commentBefore);
  const items = [];
  const added = [];
  const expected = { ...before };

  const place = (pair, field, index) => {
    const docs = field ? [docLines(field), ...(field.previous ?? []).map((d) => (Array.isArray(d) ? d : [d]))] : [[UNKNOWN_DOC]];
    let lines = toLines(pair.key.commentBefore);
    // a known attribute may still carry the NEZNÁMÝ mark from before it was known
    if (field) lines = splitComment(lines, [[UNKNOWN_DOC]]).own;
    const split = splitComment(lines, docs);
    let own = split.own;
    // before technical comments existed, the comment above the first attribute was the file's comment
    if (index === 0 && !split.found && pairs[0] === pair && own.length && !doc.commentBefore) {
      top = [...top, ...own];
      own = [];
    }
    const trailing = [pair.key.comment, pair.value?.comment, YAML.isCollection(pair.value) ? pair.value.commentBefore : null]
      .flatMap(toLines).filter((l) => l.trim());
    own = withoutLegacy([...own, ...trailing]);
    pair.key.comment = undefined;
    if (pair.value) {
      pair.value.comment = undefined;
      if (YAML.isCollection(pair.value)) pair.value.commentBefore = undefined;
      pair.value.spaceBefore = false;
    }
    const doc_ = field ? docLines(field) : [UNKNOWN_DOC];
    pair.key.commentBefore = toComment([...own, ...technical(doc_, field ? split.todo : false)]);
    pair.key.spaceBefore = index > 0;
    items.push(pair);
  };

  for (const field of schema.fields) {
    const pair = byKey.get(field.key);
    if (pair) {
      place(pair, field, items.length);
      continue;
    }
    if (field.optional && !(field.key in values)) continue;
    const value = field.key in values ? values[field.key] : !fresh && 'missing' in field ? field.missing : field.value;
    const newPair = doc.createPair(field.key, null);
    newPair.value = newValueNode(doc, field, value);
    newPair.key = doc.createNode(field.key);
    newPair.key.commentBefore = toComment(technical(docLines(field), !field.generated));
    newPair.key.spaceBefore = items.length > 0;
    items.push(newPair);
    added.push(field.key);
    expected[field.key] = value;
  }
  const unknown = [];
  for (const pair of pairs) {
    const key = String(pair.key?.value ?? pair.key);
    if (known.has(key)) continue;
    place(pair, null, items.length);
    unknown.push(key);
  }

  const out = new YAML.Document(new YAML.YAMLMap());
  out.contents.items = items;
  if (!top.length && header) top = header;
  // the file's comment on top, then an empty line
  const result = (top.length ? `${top.map((l) => (l ? `# ${l}` : '#')).join('\n')}\n\n` : '') + out.toString(STRINGIFY);

  // safety: the values must be exactly the same (plus the added attributes)
  const after = YAML.parse(result) ?? {};
  if (!isDeepStrictEqual(after, expected)) {
    return { text, changed: false, added: [], unknown, problem: 'the pipeline could not rewrite this file without changing a value, please report it' };
  }
  return { text: result, changed: result !== text, added, unknown, problem: null };
}

/** A new file of `schema`: every attribute with its default or given value, all marked DOPLNIT except generated ones. */
export function skeleton(schema, values = {}) {
  return normalizeMetadata('', schema, { values, header: schema.header, fresh: true }).text;
}

/**
 * Attributes whose technical comment still starts with DOPLNIT (the value was not checked yet), in file order.
 * Reads the text as the pipeline writes it: DOPLNIT opens the comment block right above the attribute.
 */
export function todoKeys(text) {
  const keys = [];
  let marked = false;
  for (const line of text.split('\n')) {
    if (line.startsWith(`# ${TODO} `)) marked = true;
    else if (line.startsWith('#')) continue;
    else if (!line.trim()) marked = false;
    else {
      const m = line.match(/^([^\s#:][^:]*):/);
      if (m && marked) keys.push(m[1]);
      marked = false;
    }
  }
  return keys;
}
