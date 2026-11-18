// Web app manifest (/site.webmanifest): name, colours and home screen icons for Android (scripts/lib/favicons.mjs).
import { hasFeaturedWorks, site } from '../lib/site';
import { PALETTES } from '../../scripts/lib/palettes.mjs';
import { webManifest } from '../../scripts/lib/favicons.mjs';

export function GET() {
  return new Response(JSON.stringify(webManifest(site, PALETTES[0].colors.paper, { hasFeatured: hasFeaturedWorks() }), null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
}
