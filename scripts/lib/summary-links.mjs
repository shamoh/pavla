// Links from the run summary (scripts/lib/summary.mjs) to the files of the content repository on GitHub, on the
// branch the run was for, at the line a message is about when it can be told. The address comes from the workflow
// of the content repository (CONTENT_BLOB_URL, e.g. <server>/<owner>/<repo>/blob/<branch>), so this repository never
// names it; without it (locally) the summary has no links.

import fs from 'node:fs';
import path from 'node:path';

/**
 * The line (1-based) of `text` a message is about: one it names ("na řádku 43", "(řádek 44)"), or the line of the
 * attribute it starts with ("date musí být …" → the line "date:", or "# date:" when it is commented out); null else.
 */
export function lineOf(text, message) {
  const named = /řád(?:ek|ku) (\d+)/.exec(message ?? '');
  if (named) return Number(named[1]);
  const key = /^([a-z][a-z0-9_]*)\b/.exec(message ?? '')?.[1];
  if (!key || typeof text !== 'string') return null;
  const lines = text.split('\n');
  for (const pattern of [new RegExp(`^${key}:`), new RegExp(`^# ?${key}:`)]) {
    const at = lines.findIndex((l) => pattern.test(l));
    if (at !== -1) return at + 1;
  }
  return null;
}

/** A path of the content repository ("tvorba/a b/c.yaml") as part of a URL, every segment encoded. */
const urlPath = (file) => file.split('/').map(encodeURIComponent).join('/');

/**
 * `link(file, message)` for formatSummary: the URL of `file` under `base` (CONTENT_BLOB_URL), with "#L<line>" when
 * the message tells the line (lineOf, reading the file in `contentDir`); null for something that is no file of the
 * content repository. Returns null without a `base`.
 */
export function fileLinks(base, contentDir) {
  if (!base) return null;
  const root = base.replace(/\/+$/, '');
  const texts = new Map();
  const read = (file) => {
    if (!texts.has(file)) {
      let text = null;
      try { text = fs.readFileSync(path.join(contentDir, file), 'utf8'); } catch { /* not a file (any more) */ }
      texts.set(file, text);
    }
    return texts.get(file);
  };
  return (file, message = '') => {
    if (!file || !/^[^\s:]+(?:\/[^/:]+)*\.[a-z]+$/i.test(file)) return null;
    const line = message ? lineOf(read(file), message) : null;
    return `${root}/${urlPath(file)}${line ? `#L${line}` : ''}`;
  };
}
