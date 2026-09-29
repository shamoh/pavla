// Test (demo) data are kept strictly apart from the real content:
//   real content  pavla-content/         what the public site is built from, never contains test data
//   test data     pavla/demo/            used by `npm run demo`, every item is marked as test data
// A test item is marked by its name (works and collections: "demo-…") and by `demo: true` in its YAML
// (photos have fixed names, so for them only the field counts). The pipeline checks both directions,
// so nothing can be copied from one set into the other unnoticed.

export const DEMO_PREFIX = 'demo-';

/** True when a work, collection or photo is marked as test data. */
export const isDemo = (name, data) => String(name).startsWith(DEMO_PREFIX) || data?.demo === true;

/**
 * Problems of a data set. `dataset` is 'real' (test data are forbidden) or 'demo' (every item must be
 * fully marked: works and collections by name and field, photos by field).
 * Items: works [{ slug, data, yamlPath }], collections [{ slug, data }], photos [{ name, data }].
 */
export function demoProblems({ works = [], collections = [], photos = [] }, dataset) {
  const items = [
    ...works.map((w) => ({ where: w.yamlPath ?? `tvorba/${w.year}/${w.slug}.yaml`, name: w.slug, data: w.data, named: true })),
    ...collections.map((c) => ({ where: c.yamlPath ?? `tvorba/${c.dir ?? c.slug}/_kolekce.yaml`, name: c.slug, data: c.data, named: true })),
    ...photos.map((p) => ({ where: `fotky/${p.name}.yaml`, name: p.name, data: p.data, named: false })),
  ];
  const problems = [];
  for (const { where, name, data, named } of items) {
    if (dataset === 'real' && isDemo(name, data)) {
      problems.push(`${where}: test data do not belong in the real content; test data live in pavla/demo (npm run demo)`);
    } else if (dataset === 'demo') {
      if (data?.demo !== true) problems.push(`${where}: every item of the test data needs "demo: true"`);
      if (named && !String(name).startsWith(DEMO_PREFIX)) problems.push(`${where}: names of test works and collections start with "${DEMO_PREFIX}"`);
    }
  }
  return problems;
}
