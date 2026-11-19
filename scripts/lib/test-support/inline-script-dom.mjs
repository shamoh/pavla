// A minimal fake page for running the inline view scripts (viewScript, homeScript in view-layout.mjs) in node:vm:
// the elements before the script as siblings (the grid with its cards and data-view, then whatever the page puts
// after the grid, e.g. the module script of a component), storage, the address and media queries.
import vm from 'node:vm';

/** A fake element: attributes, classes, children (cards) and the sibling before it. */
export function fakeElement({ tagName = 'DIV', attributes = {}, children = [], previous = null } = {}) {
  const classes = new Set();
  return {
    tagName,
    hidden: false,
    style: {},
    clientWidth: 0,
    children,
    previousElementSibling: previous,
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
    hasAttribute: (name) => name in attributes,
    setAttribute: (name, value) => { attributes[name] = String(value); },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => ((on ?? !classes.has(name)) ? classes.add(name) : classes.delete(name), classes.has(name)),
    },
    querySelectorAll: (selector) => (selector === '.card' ? children : []),
    appendChild: (child) => child,
    getBoundingClientRect: () => ({ height: 100 }),
  };
}

/** `value` made in the script's own realm (vm) as a plain value of this one, for deepEqual. */
export const plain = (value) => JSON.parse(JSON.stringify(value));

/** A fake card of a work. */
export const fakeCard = (id) => fakeElement({ attributes: { 'data-id': id, class: 'card' } });

/**
 * Runs `script` as an inline script placed right after `siblings` (in page order, the grid first) and returns
 * { grid: siblings[0], address: the address the script wrote (history.replaceState) or null }.
 */
export function runInlineScript(script, siblings, { search = '', stored = {}, width = 1400 } = {}) {
  let previous = null;
  for (const element of siblings) {
    element.previousElementSibling = previous;
    previous = element;
  }
  const currentScript = fakeElement({ tagName: 'SCRIPT', previous });
  let address = null;
  const context = {
    document: {
      currentScript,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => fakeElement(),
    },
    location: { search, pathname: '/', hash: '' },
    history: { state: null, replaceState: (_state, _title, url) => { address = url; } },
    localStorage: { getItem: (key) => stored[key] ?? null },
    matchMedia: (query) => ({ matches: /max-width:\s*(\d+)px/.test(query) && width <= Number(query.match(/max-width:\s*(\d+)px/)[1]) }),
    getComputedStyle: () => ({ columnGap: '0', columnCount: 'auto', columnWidth: 'auto', marginBottom: '0' }),
    URLSearchParams,
    JSON,
  };
  vm.runInNewContext(script, context);

  return { grid: siblings[0], address };
}
