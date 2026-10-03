// Test (demo) data are kept strictly apart from the real content:
//   real content  content repository     what the public site is built from, never contains test data
//   test data     pavla/demo-content/    a made-up content repository used by `npm run demo`
// The test data as a whole are marked by the file DEMO_MARKER in their root, every test work and collection
// by its name ("demo-…"). The pipeline checks both directions, so neither the whole set nor a single work or
// collection can be copied from one into the other unnoticed.

export const DEMO_PREFIX = 'demo-';
/** File in the root of the test data that marks them as such; the real content must never have it. */
export const DEMO_MARKER = 'demo-content.yaml';

/** True when a work or collection is named as test data. */
export const isDemo = (name) => String(name).startsWith(DEMO_PREFIX);

/**
 * Problems of a data set. `dataset` is 'real' (test data are forbidden) or 'demo' (the set must carry the marker,
 * every work and collection a "demo-" name). `marked`: the content has the DEMO_MARKER file.
 * Items: works [{ slug, yamlPath }], collections [{ slug, yamlPath }].
 */
export function demoProblems({ works = [], collections = [], marked = false }, dataset) {
  const items = [
    ...works.map((w) => ({ where: w.yamlPath ?? `tvorba/${w.slug}.yaml`, name: w.slug })),
    ...collections.map((c) => ({ where: c.yamlPath ?? `tvorba/${c.dir ?? c.slug}/_index.yaml`, name: c.slug })),
  ];
  const problems = [];
  if (dataset === 'real' && marked) {
    problems.push(`${DEMO_MARKER}: this content is the test data, not the real content; test data live in pavla/demo-content (npm run demo)`);
  }
  if (dataset === 'demo' && !marked) {
    problems.push(`${DEMO_MARKER} missing: the test data are marked by this file in the root of the content`);
  }
  for (const { where, name } of items) {
    if (dataset === 'real' && isDemo(name)) {
      problems.push(`${where}: test data do not belong in the real content; test data live in pavla/demo-content (npm run demo)`);
    } else if (dataset === 'demo' && !isDemo(name)) {
      problems.push(`${where}: names of test works and collections start with "${DEMO_PREFIX}"`);
    }
  }
  return problems;
}
