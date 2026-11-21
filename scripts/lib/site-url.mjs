// The address of a site (site.url of site.config.yaml) may have a path: a site in a folder of a host, e.g. the test
// site on GitHub Pages of the engine (https://<owner>.github.io/<repository>/). The path is the base of every page
// (Astro `base`, import.meta.env.BASE_URL in the code); a site on its own domain has the base "/".

/** The base of the pages of the site at `siteUrl`, with slashes on both ends: "/" or "/web-tvorba-engine/". */
export function siteBase(siteUrl) {
  const { pathname } = new URL(siteUrl);

  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/** The address of the home page of the site at `siteUrl`, with the slash at the end ("https://host/folder/"). */
export const siteRoot = (siteUrl) => new URL(siteBase(siteUrl), siteUrl).href;

/** The full address of `path` of the site at `siteUrl` ("/kontakt/" or "kontakt/" → "https://host/folder/kontakt/"). */
export const siteAddress = (siteUrl, path) => new URL(path.replace(/^\//, ''), siteRoot(siteUrl)).href;
