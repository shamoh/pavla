// Map of the site (/sitemap.xml): the canonical address of every page with its lastmod (scripts/lib/sitemap.mjs).
import { getCollections, getWorks, getYears, site } from '../lib/site';
import { sitemapEntries, sitemapXml } from '../../scripts/lib/sitemap.mjs';

export function GET() {
  const entries = sitemapEntries({ years: getYears(), collections: getCollections(), works: getWorks() });
  return new Response(sitemapXml(site.url, entries), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
