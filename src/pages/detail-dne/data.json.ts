// The data of the game Detail dne (/detail-dne/data.json): its answers and thumbnails prepared from the pictures of the site
// while it is built (scripts/lib/detail-game-data.mjs) and the plan of the days the pipeline keeps (game/detail-dne/,
// scripts/lib/game-plan.mjs: this year and the one before, older years are files of their own, plan/[year].json.ts), so the
// browser only plays (src/lib/detail-game.ts).
import { site, siteDataRoot } from '../../lib/site';
import { gameWorks } from '../../lib/detail-game-works';
import { gameData, prepareGame } from '../../../scripts/lib/detail-game-data.mjs';
import { planBuildYear, sitePlan } from '../../../scripts/lib/game-plan.mjs';

export async function GET() {
  const works = gameWorks();
  const { prepared } = await prepareGame(works, siteDataRoot);
  const plan = await sitePlan(siteDataRoot, planBuildYear());
  return new Response(JSON.stringify(gameData({ works, prepared, site: site.url, plan })), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
