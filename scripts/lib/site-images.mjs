// Generated images in public/ of this repo lie where the page they belong to is (the folders are the page URLs):
//   public/tvorba/<year>/<slug>-<id>/        a work: web sizes, details, mockups, og-<hash>.jpg, pin-<hash>.jpg, info.json
//                                            (page /tvorba/<year>/<slug>-<id>/)
//   public/tvorba/<year>/_cover/, _og/       a year: its own cover photo, the share image of a chosen cover (page /tvorba/<year>/)
//   public/tvorba/kolekce/<slug>/_cover/, _og/   a collection (page /tvorba/kolekce/<slug>/)
//   public/_cover/, public/_og/              the home page (page /)
//   public/tvorba/_cover/                    the works without a collection: own cover photo of "Mimo kolekce" (page /tvorba/)
//   public/fotky/<name>/                     another photo of the site (O mně, Kontakt)
// _cover is the same name as the own cover photo in the content repository (_cover.jpg); a work key never starts with "_".
// Share images (og) and pins carry a fingerprint of their content in the name (fingerprintedName): a changed image gets
// a new address, so services that keep images by their address (Pinterest, link previews) take the new one.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Folder of the page of the works and their years (also the start of their URLs). */
export const WORKS_PAGES = 'tvorba';
/** Folder of an own cover photo inside the folder of its page. */
export const COVER_DIR = '_cover';
/** Folder of the share image of a chosen cover inside the folder of its page (one file og-<hash>.jpg). */
export const OG_DIR = '_og';
/** The former share image of the home page (public/og.jpg), only for the prune; years and collections lie in containers. */
export const LEGACY_OG_FILE = 'og.jpg';

/** `<prefix>-<8 hex of the SHA-1 of the bytes>.jpg`: the name changes exactly when the content does. */
export const fingerprintedName = (prefix, buf) => `${prefix}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)}.jpg`;

/** A share image or pin with a fingerprinted name. */
export const isFingerprinted = (prefix, name) => new RegExp(`^${prefix}-[0-9a-f]{8}\\.jpg$`).test(name);

/** Folder (relative to public/, i.e. the URL without the leading slash) of the images of a work. */
export const workImageDir = (year, key) => `${WORKS_PAGES}/${year}/${key}`;
/** Folder of the page of a year. */
export const yearPageDir = (year) => `${WORKS_PAGES}/${year}`;
/** Folder of the page of a collection. */
export const collectionPageDir = (slug) => `${WORKS_PAGES}/kolekce/${slug}`;
/** Folder of the works without a collection (their gallery /tvorba/?collection=none); only an own cover photo. */
export const UNCOLLECTED_PAGE_DIR = WORKS_PAGES;
/** Folder of the home page (the root). */
export const HOME_PAGE_DIR = '';
/** Folder of the own cover photo of a page (collection, year, home page). */
export const coverDir = (pageDir) => path.posix.join(pageDir, COVER_DIR);
/** Folder of the share image of the chosen cover of a page. */
export const ogDir = (pageDir) => path.posix.join(pageDir, OG_DIR);

/**
 * The share image of the chosen cover of a page as it lies in `publicDir` (relative to it, = its URL without the
 * leading slash), or null when the page has none.
 */
export function pageShareFile(publicDir, pageDir) {
  const dir = ogDir(pageDir);
  const name = fs.existsSync(path.join(publicDir, dir)) ? fs.readdirSync(path.join(publicDir, dir)).find((f) => isFingerprinted('og', f)) : null;
  return name ? path.posix.join(dir, name) : null;
}
/** Folder of the images of another photo of the site. */
export const photoDir = (name) => `fotky/${name}`;

/** Everything the pipeline writes into public/ lies under these (static files of the site such as favicon.svg do not). */
export const OUTPUT_ROOTS = [WORKS_PAGES, 'fotky', COVER_DIR, OG_DIR, LEGACY_OG_FILE];

/**
 * Folders that only hold other outputs (tvorba/, tvorba/<year>/, tvorba/kolekce/, tvorba/kolekce/<slug>/, fotky/):
 * the prune always looks inside them, so it reports each stale item, never a whole container.
 */
export function isContainer(rel) {
  const parts = rel.split('/');
  if (parts[0] === 'fotky') return parts.length === 1;
  if (parts[0] !== WORKS_PAGES) return false;
  return parts.length <= 2 || (parts.length === 3 && parts[1] === 'kolekce');
}

/**
 * Outputs under public/ of `siteDir` that a full run did not want: [{ rel, dir }] (rel relative to public/), sorted.
 * `wanted`: paths relative to public/ of the items the run produced (work, photo, _cover and _og folders;
 * a wanted folder is kept whole). Containers are looked into, any other item under OUTPUT_ROOTS that is not wanted
 * is stale. Empty containers are left to the caller.
 */
export function staleOutputs(siteDir, wanted) {
  const publicDir = path.join(siteDir, 'public');
  const stale = [];
  const visit = (rel) => {
    const abs = path.join(publicDir, rel);
    if (!fs.existsSync(abs) || wanted.has(rel)) return;
    const dir = fs.statSync(abs).isDirectory();
    if (dir && isContainer(rel)) {
      for (const e of fs.readdirSync(abs).sort()) visit(path.posix.join(rel, e));
      return;
    }
    stale.push({ rel, dir });
  };
  for (const root of OUTPUT_ROOTS) visit(root);
  return stale.sort((a, b) => a.rel.localeCompare(b.rel));
}
