// The folder of the test site (demo-content/site/, scripts/demo.mjs): the settings the tests of the code use, so
// they never depend on the settings of a real site (a site checks its own data: npm run check:site).
import path from 'node:path';
import { CODE_ROOT, readSiteConfig, sitePaths } from '../site-dir.mjs';

/** The source of the folder of the test site. */
export const DEMO_SITE_DIR = path.join(CODE_ROOT, 'demo-content', 'site');

/** The settings of the test site (its site.config.yaml). */
export const demoSiteConfig = () => readSiteConfig(DEMO_SITE_DIR);

/** Paths in the folder of the test site (its fonts, scenes, icon) for tests of the code that need some. */
export const DEMO_SITE = sitePaths(DEMO_SITE_DIR);
