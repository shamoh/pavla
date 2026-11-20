// The folder of the test site (demo-content/site/, scripts/demo.mjs): the settings the tests of the code use, so
// they never depend on the settings of a real site.
import fs from 'node:fs';
import path from 'node:path';
import { CODE_ROOT, readSiteConfig, siteDirectory, sitePaths } from '../site-dir.mjs';

/** The source of the folder of the test site. */
export const DEMO_SITE_DIR = path.join(CODE_ROOT, 'demo-content', 'site');

/** The settings of the test site (its site.config.yaml). */
export const demoSiteConfig = () => readSiteConfig(DEMO_SITE_DIR);

/** Paths in the folder of the test site (its fonts, scenes, icon) for tests of the code that need some. */
export const DEMO_SITE = sitePaths(DEMO_SITE_DIR);

/**
 * The site folders whose own files the tests check (complete scenes, icons): the test site and the site of SITE_DIR
 * (by default the root of the code, the real site while it lives there), each once, only an existing one.
 */
export const checkedSiteDirs = () => [...new Set([DEMO_SITE_DIR, siteDirectory()])].filter((dir) => fs.existsSync(sitePaths(dir).config));

/** The folder of the real site (SITE_DIR, by default the root of the code) for checks of its own data. */
export const realSiteDir = () => siteDirectory();
