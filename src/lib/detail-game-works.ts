// The works of the site as the game Detail dne takes them, for its data (src/pages/detail-dne/data.json.ts) and the archive
// files of the plan of the days (src/pages/detail-dne/plan/[year].json.ts).
import { formatSize, getCollections, getWorks, workUrl } from './site';
import { workImageDir } from '../../scripts/lib/site-images.mjs';
import { ownText } from '../../scripts/lib/rich-text.mjs';
import { summarize } from '../../scripts/lib/seo.mjs';
import { VIEWER_TEXT_MAX } from '../../scripts/lib/work-viewer.mjs';

/** Every published work with what the game needs of it (the analysis of its picture: technique, tags, colours, its folder). */
export function gameWorks() {
  const titles = new Map(getCollections().map((c) => [c.slug, c.title]));
  return getWorks().map((w) => ({
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
}
