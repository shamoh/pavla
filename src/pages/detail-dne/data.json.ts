// The data of the game Detail dne (/detail-dne/data.json): its answers and thumbnails prepared from the pictures of the site
// while it is built (scripts/lib/detail-game-data.mjs) and the plan of the days the pipeline keeps (game/detail-dne/,
// scripts/lib/game-plan.mjs: this year and the one before, older years are files of their own, plan/[year].json.ts), so the
// browser only plays (src/lib/detail-game.ts).
import { gamePageData } from '../../lib/detail-game-works';

export async function GET() {
  return new Response(JSON.stringify(await gamePageData()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
