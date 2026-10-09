// Every CSS custom property the site uses (var(--name)) must be defined somewhere: by the palettes (paletteCss:
// colours like --paper-2, shadows) or in the source itself (a declaration `--name:` in CSS or a style attribute,
// or style.setProperty('--name', …) in a script). A misspelt name (--paper2 for --paper-2) is otherwise silent:
// the browser just drops the rule. Checked over src/ by css-vars.test.mjs (npm test).

const NAME = '--[a-z][a-z0-9-]*[a-z0-9]';

/** The custom properties `text` uses: var(--name …), each once, in order of first use. */
export function usedVars(text) {
  return [...new Set([...text.matchAll(new RegExp(`var\\(\\s*(${NAME})(?=\\s*[,)])`, 'g'))].map((m) => m[1]))];
}

/** The custom properties `text` defines: declarations `--name:` and setProperty('--name', …). */
export function definedVars(text) {
  const declared = [...text.matchAll(new RegExp(`(${NAME})\\s*:`, 'g'))].map((m) => m[1]);
  const set = [...text.matchAll(new RegExp(`setProperty\\(\\s*['"\`](${NAME})`, 'g'))].map((m) => m[1]);
  return [...new Set([...declared, ...set])];
}

/**
 * The uses of undefined custom properties as [{ file, name }]: `files` ([{ file, text }]) use them and define some,
 * `extra` are texts that only define (the generated palette CSS).
 */
export function undefinedVars(files, extra = []) {
  const defined = new Set([...files.map((f) => f.text), ...extra].flatMap(definedVars));
  return files.flatMap(({ file, text }) => usedVars(text).filter((name) => !defined.has(name)).map((name) => ({ file, name })));
}
