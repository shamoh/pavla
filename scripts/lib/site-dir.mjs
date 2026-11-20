// The folder of a site: everything that belongs to one site and not to the code (the engine).
// The code reads it only through these paths, so the same code can build another site from another folder:
//   site.config.yaml        identity and settings of the site
//   fonts/                  fonts of the captions (Instagram, pins, launch screens)
//   mockups/                interiors of the mockups (scenes.yaml + photos), mockups/instagram/ the studio scenes
//   home-screen-icon.svg    the icon of the site on a home screen (npm run favicons, launch screens)
//   public/                 static files of the site (favicon, icons, CNAME) and the images the pipeline makes
//   content/                public copies of the descriptions (made by the pipeline)
//   game/                   lasting state of the game Detail dne (plan of the days, analyses of the images)
//   binary.lock             the tree of the images of the site (scripts/binary.mjs)
//   dist/                   the built site
// SITE_DIR names the folder (relative to the working directory); without it the folder is the root of the code,
// where the real site lives today. The test data build their own complete folder (.demo/site, scripts/demo.mjs).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

/** The root of the code (this repository). */
export const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The environment variable naming the folder of the site. */
export const SITE_DIR_VARIABLE = 'SITE_DIR';

/** The settings file of a site. */
export const SITE_CONFIG_FILE = 'site.config.yaml';

/**
 * The folder of the site: SITE_DIR of `env` resolved against `cwd`, without it `codeRoot`.
 */
export function siteDirectory({ env = process.env, cwd = process.cwd(), codeRoot = CODE_ROOT } = {}) {
  const named = env[SITE_DIR_VARIABLE];

  return named ? path.resolve(cwd, named) : codeRoot;
}

/** Paths of everything a site holds, in the folder `siteDir`. */
export function sitePaths(siteDir) {
  const mockups = path.join(siteDir, 'mockups');

  return {
    root: siteDir,
    config: path.join(siteDir, SITE_CONFIG_FILE),
    fonts: path.join(siteDir, 'fonts'),
    mockups,
    instagramScenes: path.join(mockups, 'instagram'),
    homeScreenIcon: path.join(siteDir, 'home-screen-icon.svg'),
    public: path.join(siteDir, 'public'),
    dist: path.join(siteDir, 'dist'),
    previews: path.join(siteDir, '.previews'),
  };
}

/** The settings of the site in `siteDir` (site.config.yaml). */
export function readSiteConfig(siteDir) {
  return YAML.parse(fs.readFileSync(sitePaths(siteDir).config, 'utf8'));
}

/**
 * True when the site is built from the test data: its settings say `demo: true`. Such a site never measures
 * visits (Google Analytics) nor sends messages (the form is only a preview).
 */
export const isDemoSite = (config) => config?.demo === true;
