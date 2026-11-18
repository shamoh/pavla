// An overview of the looks of Detail dne for the author (npm run game-overview): the levels, every look with its numbers
// and a real puzzle of the plan to play through its tries, all combinations of effects and colours, and a lab to try other
// numbers and sizes of the close-up. The page uses the functions of the game itself (copied as text, like the prototypes),
// so it shows exactly what the game does with the current settings; regenerate it after a change.
// Reads the built site (npm run build first: dist/detail-dne/data.json, the pictures in public/). Writes
// .prototypes/prehled-hry/index.html + img/ (out of git); published as a page for the author to comment on.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOOK_COUNTS, drawPixels, effectSettings, effectStrength, effectStyle, frameSource, gameFrame, gameLevels, gameLooks, waveRipple,
} from './lib/detail-game.mjs';
import { isoDay } from './lib/app-install.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.prototypes', 'prehled-hry');
const data = JSON.parse(await fs.readFile(path.join(root, 'dist/detail-dne/data.json'), 'utf8'));
const works = new Map(data.works.map((w) => [w.id, w]));
const today = isoDay(new Date());
/**
 * Works never used as an example: something on them gives the answer away at once, not what the page wants to show
 * (rpxz5 Barbora III: two sheets with the ring binding of the sketchbook between them). The game itself still plays them.
 */
const NOT_EXAMPLES = new Set(['rpxz5']);

/** For every look the latest puzzle of the plan up to today that used it (the author may have played it). */
const days = Object.values(data.plan.days).filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
const examples = [];
for (const look of gameLooks()) {
  const day = days.find((d) => d[look.level]?.look === look.id && !NOT_EXAMPLES.has(d[look.level].targetId));
  if (!day) continue;
  const puzzle = day[look.level];
  const work = works.get(puzzle.targetId);
  if (!work) continue;
  const width = Math.max(...work.widths);
  examples.push({
    look: look.id, level: look.level, date: day.date, workId: work.id, title: work.title, url: work.url, ratio: work.ratio,
    crop: { x: puzzle.crop.x, y: puzzle.crop.y, size: puzzle.crop.size }, src: `img/${work.id}-${width}.webp`,
    from: path.join(root, 'public', work.folder, `${width}.webp`),
  });
}
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'img'), { recursive: true });
for (const e of examples) await fs.copyFile(e.from, path.join(out, e.src));

// the rules of the counts of looks by level (a test in detail-game.test.mjs keeps the game within them)
const page = {
  lookCounts: LOOK_COUNTS,
  levels: gameLevels().map(({ id, label, size, zone, pick, options, reach, lastView, guesses, hints, drops, looks }) => ({ id, label, size, zone, pick, options, reach, lastView, guesses, hints, drops, looks })),
  looks: gameLooks(),
  settings: effectSettings(),
  examples: examples.map(({ from, ...e }) => e),
  generated: today,
};
// the game's own functions, as text: the page draws exactly what the game draws
const functions = [effectSettings, effectStrength, effectStyle, waveRipple, gameFrame, frameSource, drawPixels].map((f) => f.toString()).join('\n\n');
const template = await fs.readFile(path.join(root, 'scripts/prototypes/prehled-hry.html'), 'utf8');
const html = template
  .replace('/*DATA*/', () => `const PAGE = ${JSON.stringify(page)};`)
  .replace('/*FUNCTIONS*/', () => functions);
await fs.writeFile(path.join(out, 'index.html'), html);
console.log(`✓ ${path.relative(root, out)}/index.html: ${examples.length} looks with a real puzzle, ${new Set(examples.map((e) => e.workId)).size} pictures`);
