// The game Detail dne on the home page (/detail-dne/dnes.json, src/components/GameTeaser.astro): the puzzles of the days around
// the build (TEASER_DAYS) as the game plays them and the works they ask for (teaserData); the browser picks today, so the home
// page shows the right day although it is built only once in a while.
import { gamePageData } from '../../lib/detail-game-works';
import { gameDay, pragueDate } from '../../../scripts/lib/detail-game.mjs';
import { TEASER_DAYS, teaserData } from '../../../scripts/lib/detail-teaser.mjs';

export async function GET() {
  const data = await gamePageData();
  const today = gameDay(pragueDate(), data.epoch);
  const teaser = teaserData({ data, from: today - TEASER_DAYS.before, to: today + TEASER_DAYS.after });
  return new Response(JSON.stringify(teaser), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
