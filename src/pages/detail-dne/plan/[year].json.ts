// An archive year of the plan of the days of the game Detail dne (/detail-dne/plan/<year>.json): every year older than the one
// before this one (sitePlan, scripts/lib/game-plan.mjs), with its days and the works they refer to (archiveData). The page reads
// it only when a player opens one of its days (src/lib/detail-game.ts).
import { siteDataRoot } from '../../../lib/site';
import { gameWorks } from '../../../lib/detail-game-works';
import { archiveData } from '../../../../scripts/lib/detail-game-data.mjs';
import { planBuildYear, readPlanYear, sitePlan } from '../../../../scripts/lib/game-plan.mjs';

export async function getStaticPaths() {
  const { archive } = await sitePlan(siteDataRoot, planBuildYear());
  return archive.map((year) => ({ params: { year: String(year) } }));
}

export async function GET({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  const data = archiveData({ year, days: await readPlanYear(siteDataRoot, year), works: gameWorks() });
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
