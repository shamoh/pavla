// robots.txt: everything may be crawled, the map of the site is at /sitemap.xml; the test site nothing (scripts/lib/seo.mjs).
import { hiddenFromSearch, site } from '../lib/site';
import { robotsTxt } from '../../scripts/lib/seo.mjs';

export function GET() {
  return new Response(robotsTxt(site, { hidden: hiddenFromSearch }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
