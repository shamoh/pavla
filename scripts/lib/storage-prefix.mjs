// The prefix of the names under which the browser of a visitor keeps what the site remembers: localStorage and
// sessionStorage keys ("<prefix>.favorites") and the caches of the service worker ("<prefix>-images"). It is
// site.storagePrefix of site.config.yaml, so two sites never share a name; the build puts it into the code
// (astro.config.mjs defines STORAGE_PREFIX_GLOBAL, also for the scripts of the browser). Outside the build (Node:
// tests, pipeline, prototypes) it is DEFAULT_STORAGE_PREFIX. Changing it on a published site makes visitors lose
// what their browser remembered (favourites, palette, progress of the game).

/** Without site.storagePrefix. */
export const DEFAULT_STORAGE_PREFIX = 'web';

/** The name the build replaces with the prefix of the site (vite define, as a JSON string). */
export const STORAGE_PREFIX_GLOBAL = '__SITE_STORAGE_PREFIX__';

/** A prefix: small letters and digits, words joined by "-", starting with a letter ("pavla", "ukazka", "kacka-web"). */
export const isStoragePrefix = (value) => typeof value === 'string' && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(value);

/** The prefix of the site with the settings `config` (site.config.yaml); not set = DEFAULT_STORAGE_PREFIX, invalid = an error. */
export function storagePrefixOf(config) {
  const value = config?.site?.storagePrefix;
  if (value === undefined || value === null || value === '') return DEFAULT_STORAGE_PREFIX;
  if (!isStoragePrefix(value)) throw new Error(`site.storagePrefix must be small letters and digits joined by "-", got ${JSON.stringify(value)}`);

  return value;
}

/* global __SITE_STORAGE_PREFIX__ */
/** The prefix of this build (see above). */
export const STORAGE_PREFIX = typeof __SITE_STORAGE_PREFIX__ === 'string' ? __SITE_STORAGE_PREFIX__ : DEFAULT_STORAGE_PREFIX;

/** A key of localStorage or sessionStorage: "favorites" -> "<prefix>.favorites". */
export const storageKey = (name) => `${STORAGE_PREFIX}.${name}`;

/**
 * A name of this build (storageKey, CACHE_PREFIX…) with the prefix `prefix` instead: for pages written outside the build
 * that must use the names of a site (the prototypes, scripts/lib/prototypes.mjs). A name without the prefix is an error.
 */
export function withStoragePrefix(name, prefix) {
  const rest = name.slice(STORAGE_PREFIX.length);
  if (!name.startsWith(STORAGE_PREFIX) || !/^[.-]/.test(rest)) throw new Error(`${JSON.stringify(name)} is no name of the browser with the prefix ${JSON.stringify(STORAGE_PREFIX)}`);

  return `${prefix}${rest}`;
}
