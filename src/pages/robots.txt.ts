// robots.txt: everything may be crawled, the map of the site is at /sitemap.xml (scripts/lib/seo.mjs).
import { site } from '../lib/site';
import { robotsTxt } from '../../scripts/lib/seo.mjs';

export function GET() {
  return new Response(robotsTxt(site), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
