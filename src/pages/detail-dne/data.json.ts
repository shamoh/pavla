// The data of the game Detail dne (/detail-dne/data.json): its answers and thumbnails prepared from the pictures of the site
// while it is built (scripts/lib/detail-game-data.mjs), so the browser only plays (src/lib/detail-game.ts).
import { formatSize, getCollections, getWorks, site, siteDataRoot, workUrl } from '../../lib/site';
import { gameData, prepareGame } from '../../../scripts/lib/detail-game-data.mjs';
import { workImageDir } from '../../../scripts/lib/site-images.mjs';
import { ownText } from '../../../scripts/lib/rich-text.mjs';
import { summarize } from '../../../scripts/lib/seo.mjs';
import { VIEWER_TEXT_MAX } from '../../../scripts/lib/work-viewer.mjs';

export async function GET() {
  const titles = new Map(getCollections().map((c) => [c.slug, c.title]));
  const works = getWorks().map((w) => ({
    id: w.id,
    title: w.title,
    sub: [w.technique, formatSize(w.size_cm)].filter(Boolean).join(' · '),
    year: w.year,
    technique: w.technique,
    tags: w.tags,
    // the colours and mood of the whole work: how alike two works are (workDistance), with the close-up in rankLookalikes
    colourProfile: w.colourProfile,
    collection: w.collection ?? '',
    collectionTitle: w.collection ? titles.get(w.collection) ?? '' : '',
    text: summarize(ownText(w.text), VIEWER_TEXT_MAX),
    url: workUrl(w),
    folder: workImageDir(w.year, w.key),
    widths: w.image.widths,
    ratio: w.image.height / w.image.width,
  }));
  const { prepared } = await prepareGame(works, siteDataRoot);
  return new Response(JSON.stringify(gameData({ works, prepared, site: site.url })), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
