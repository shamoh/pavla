// Feed for Pinterest (/pinterest.xml): every work with meta_pinterest (pin.feed in info.json) is an item, newest first;
// Pinterest reads it about once a day and pins the new ones (scripts/lib/pinterest.mjs).
import { config, getWorks, site, workPinImage } from '../lib/site';
import { absolute } from '../../scripts/lib/seo.mjs';
import { FEED_UTM, pinDescription, pinterestFeed, withParams } from '../../scripts/lib/pinterest.mjs';

export function GET() {
  const items = getWorks().filter((w) => w.image.pin?.feed).map((w) => ({
    id: w.id,
    title: w.title,
    // UTM: Google Analytics knows the visit came from a pin of the feed (FEED_UTM)
    link: withParams(absolute(site, `/tvorba/${w.year}/${w.key}/`), FEED_UTM),
    description: pinDescription(w, w.year, config.pinterestKeywords?.en),
    date: w.date,
    image: { url: absolute(site, workPinImage(w).src), bytes: w.image.pin?.bytes ?? 0 },
  }));
  const channel = { title: site.title, link: absolute(site, '/'), description: site.tagline, self: absolute(site, '/pinterest.xml') };
  return new Response(pinterestFeed(channel, items), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
