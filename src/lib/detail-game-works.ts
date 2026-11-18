// The works of the site as the game Detail dne takes them, for its data (src/pages/detail-dne/data.json.ts, and dnes.json.ts of
// the home page) and the archive files of the plan of the days (src/pages/detail-dne/plan/[year].json.ts).
import { config, formatSize, getCollections, getWorks, site, siteDataRoot, workUrl } from './site';
import { gameShareName, gameShareParts } from '../../scripts/lib/detail-game-share.mjs';
import { gameData, gameWorkFields, prepareGame } from '../../scripts/lib/detail-game-data.mjs';
import { planBuildYear, readSkips, sitePlan } from '../../scripts/lib/game-plan.mjs';
import { quizSimilar } from '../../scripts/lib/my-quiz.mjs';
import { workImageDir } from '../../scripts/lib/site-images.mjs';
import { ownText } from '../../scripts/lib/rich-text.mjs';
import { summarize } from '../../scripts/lib/seo.mjs';
import { VIEWER_TEXT_MAX } from '../../scripts/lib/work-viewer.mjs';

/**
 * Every published work in the game with what the game needs of it (the analysis of its picture: technique, tags, colours, its
 * folder); a work with `game: false` is never in it (nor in a quiz of a visitor).
 */
export function gameWorks() {
  const titles = new Map(getCollections().map((c) => [c.slug, c.title]));
  return getWorks().filter((w) => w.game !== false).map((w) => ({
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

let pageData: Promise<any> | null = null;
/**
 * The data of the page /detail-dne/ (gameData: works, prepared answers, the plan of this year and the one before), made once per
 * build: the page's data.json and the home page's dnes.json (scripts/lib/detail-teaser.mjs) both read it.
 */
export function gamePageData(): Promise<any> {
  pageData ??= (async () => {
    const works = gameWorks();
    const { prepared } = await prepareGame(works, siteDataRoot);
    const plan = await sitePlan(siteDataRoot, planBuildYear());
    return gameData({ works, prepared, site: site.url, plan });
  })();
  return pageData;
}

/**
 * The share image of the page of the game (scripts/lib/detail-game-share.mjs): its parts (three works of the site), its fingerprinted
 * name and size; drawn by src/pages/detail-dne/[file].ts. Null without works.
 */
export function gameShareImage() {
  const og = config.images.og;
  const size = { width: og.width, height: og.height, background: og.background, quality: og.quality };
  const parts = gameShareParts(getWorks().map((w) => ({ id: w.id, featured: w.featured, folder: workImageDir(w.year, w.key), widths: w.image.widths, modified: w.modified })));
  if (!parts.length) return null;
  const name = gameShareName(parts, size);
  return { parts, size, name, src: `/detail-dne/${name}`, width: og.width, height: og.height };
}

/**
 * The data of the quiz of a visitor ("Můj Detail dne", /detail-dne/muj/data.json; scripts/lib/my-quiz.mjs): the works in the game
 * (what a thumbnail, a hint and the card of the end need), for each the works most like it to draw the offer from (quizSimilar),
 * the places the game picked in each level ("Vybrat místo za mě": level → id → [{ x, y, size }]) and the places kept out of the
 * game (skips.json of the plan: id → [{ x0, y0, x1, y1 }] in shares of the picture).
 */
export async function quizPageData() {
  const works = gameWorks();
  const { prepared } = await gamePageData();
  const picks = Object.fromEntries(Object.entries(prepared as Record<string, Record<string, { crop: { x: number; y: number; size: number } }[]>>)
    .map(([level, answers]) => [level, Object.fromEntries(Object.entries(answers).map(([id, crops]) => [id, crops.map((c) => ({ x: c.crop.x, y: c.crop.y, size: c.crop.size }))]))]));
  return {
    author: site.author,
    works: works.map(gameWorkFields),
    similar: quizSimilar(works),
    picks,
    skips: await readSkips(siteDataRoot),
  };
}
