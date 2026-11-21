import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overviewSkips } from './game-overview.mjs';
import { demoSiteConfig } from './test-support/demo-site.mjs';

test('overviewSkips: the ids of game.overviewSkip, none without it, an error for anything else', () => {
  assert.deepEqual([...overviewSkips({ game: { overviewSkip: ['rpxz5', 'k3f9a'] } })], ['rpxz5', 'k3f9a']);
  for (const config of [undefined, {}, { game: {} }, { game: { overviewSkip: null } }, { game: { overviewSkip: [] } }]) {
    assert.equal(overviewSkips(config).size, 0);
  }
  for (const bad of ['rpxz5', ['Barbora III'], ['rpxz'], [12345], { rpxz5: true }]) {
    assert.throws(() => overviewSkips({ game: { overviewSkip: bad } }), /game\.overviewSkip must be a list of ids/, JSON.stringify(bad));
  }
  assert.equal(overviewSkips(demoSiteConfig()).size, 0, 'the test site skips none');
});
