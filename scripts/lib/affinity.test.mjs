import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AFFINITY_WEIGHTS, GAME_AFFINITY_SCALE, GAME_AFFINITY_WEIGHTS, colourProfile, techniqueFamily, workDistance } from './affinity.mjs';
import { analyseColours, colourSettings } from './colors.mjs';

const settings = colourSettings({});
/** The analysis of a picture of a colour square on a warm grey sheet. */
function colors(rgb) {
  const w = 40;
  const data = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) data.set(x > 10 && x < 30 && y > 10 && y < 30 ? [...rgb, 255] : [225, 215, 200, 255], (y * w + x) * 4);
  return analyseColours({ data, width: w, height: w, channels: 4 });
}
const work = (technique, tags, rgb) => ({ technique, tags, colourProfile: colourProfile(rgb ? colors(rgb) : undefined, settings) });

test('colourProfile: the shares of the colours and the mood; empty without an analysis', () => {
  const blue = colourProfile(colors([60, 100, 190]), settings);
  assert.equal(blue.analysed, true);
  assert.ok(blue.shares.modra > 0.9);
  assert.ok(blue.mood.warm < 0);
  assert.deepEqual(colourProfile(undefined, settings), { shares: {}, mood: { warm: 0, light: 0, vivid: 0 }, analysed: false });
});

test('workDistance: 0 for the same, colours, technique and tags make it farther', () => {
  const a = work('akvarel', ['krajina', 'voda'], [60, 100, 190]);
  assert.equal(workDistance(a, a), 0);
  const otherColour = work('akvarel', ['krajina', 'voda'], [230, 130, 40]);
  const otherTechnique = work('olej', ['krajina', 'voda'], [60, 100, 190]);
  const drawing = work('tuš', ['krajina', 'voda'], [60, 100, 190]);
  const otherTags = work('akvarel', ['portrét'], [60, 100, 190]);
  assert.ok(workDistance(a, otherColour) > 0.5, 'blue against orange');
  assert.equal(workDistance(a, otherTechnique), AFFINITY_WEIGHTS.sameFamily, 'another painting');
  assert.equal(workDistance(a, drawing), AFFINITY_WEIGHTS.technique, 'a drawing');
  assert.equal(workDistance(a, otherTags), AFFINITY_WEIGHTS.tags, 'no tag shared');
  assert.equal(workDistance(a, work('akvarel', ['krajina', 'les'], [60, 100, 190])), Math.round(AFFINITY_WEIGHTS.tags * 0.5 * 1000) / 1000, 'half of the tags shared');
  assert.equal(workDistance(a, work('akvarel', ['krajina'], [60, 100, 190])), 0, 'all of the smaller set shared: the same subject');
  assert.equal(workDistance(a, work('akvarel', [], [60, 100, 190])), 0, 'no tags: nothing to compare');
  assert.equal(workDistance(a, otherColour), workDistance(otherColour, a), 'symmetric');
});

test('workDistance: colours only when both works have them analysed', () => {
  const blue = work('akvarel', ['krajina'], [60, 100, 190]);
  const unknown = work('akvarel', ['krajina'], null);
  assert.equal(workDistance(blue, unknown), 0);
});

test('the weights of the game: the same gaps as the game had, the colours of the whole work up to 15', () => {
  const painting = work('akvarel', ['krajina'], null);
  const d = (other) => Math.round(GAME_AFFINITY_SCALE * workDistance(painting, other, GAME_AFFINITY_WEIGHTS));
  assert.equal(d(work('tuš', ['krajina'], null)), 25, 'a drawing among paintings');
  assert.equal(d(work('olej', ['krajina'], null)), 6, 'another painting technique');
  assert.equal(d(work('akvarel', ['zvířata'], null)), 8, 'another subject');
  const blue = work('akvarel', ['krajina'], [60, 100, 190]);
  const orange = work('akvarel', ['krajina'], [230, 130, 40]);
  const colour = GAME_AFFINITY_SCALE * workDistance(blue, orange, GAME_AFFINITY_WEIGHTS);
  assert.ok(colour > 5 && colour <= 15 * 1.5, `the colours of the whole work tip the balance (${colour})`);
  assert.equal(techniqueFamily('akvarel a fix'), 'colour');
});
