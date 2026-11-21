// Settings of the overview of the looks of Detail dne for the author (npm run game-overview, scripts/game-overview.mjs).

import { isValidId } from './works.mjs';

/**
 * The works never shown as an example of a look in the overview (site.config.yaml game.overviewSkip: a list of ids),
 * e.g. a work whose close-ups give the answer away at once. The game itself still plays them (out of the game =
 * `game: false` in the description of the work). Not set = none; anything else than a list of ids is an error.
 */
export function overviewSkips(config) {
  const value = config?.game?.overviewSkip;
  if (value === undefined || value === null) return new Set();
  if (!Array.isArray(value) || !value.every(isValidId)) throw new Error(`game.overviewSkip must be a list of ids of works, got ${JSON.stringify(value)}`);

  return new Set(value);
}
