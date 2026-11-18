import test from 'node:test';
import assert from 'node:assert/strict';
import { gameLevels, gameLooks } from './detail-game.mjs';
import { levelParam } from './detail-teaser.mjs';
import {
  QUIZ_DECOYS, QUIZ_PREVIEW, cropExcluded, quizCrop, quizEventParams, quizFromParams, quizOffer, quizOnOpen, quizShareText, quizSimilar, quizToParams, quizUrl, quizView, quizWindows,
} from './my-quiz.mjs';

const ids = ['a1', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'i1', 'j1'];
const works = new Map(ids.map((id) => [id, { id }]));
const [easy] = gameLevels();
const look = gameLooks().find((l) => l.level === easy.id);
const quiz = { workId: 'a1', level: easy.id, x: 0.4256, y: 0.5, look: look.id, offer: ids.slice(1, 9) };

test('quizToParams: every part in order, shares as percent with one decimal', () => {
  const params = quizToParams(quiz);
  assert.deepEqual([...params.keys()], ['obraz', 'uroven', 'x', 'y', 'zkresleni', 'nabidka']);
  assert.equal(params.get('uroven'), levelParam(easy));
  assert.equal(params.get('x'), '42.6');
  assert.equal(params.get('nabidka'), 'b1,c1,d1,e1,f1,g1,h1,i1');
  assert.match(quizUrl('https://example.cz', quiz), /^https:\/\/example\.cz\/detail-dne\/muj\/\?obraz=a1&/);
});

test('quizFromParams: the round of an address, the same shuffle for everybody', () => {
  const read = quizFromParams(quizToParams(quiz), works);
  assert.equal(read.workId, 'a1');
  assert.equal(read.level.id, easy.id);
  assert.equal(read.look.id, look.id);
  assert.deepEqual(read.crop, { x: 0.426, y: 0.5, size: easy.size });
  assert.equal(read.optionIds.length, QUIZ_DECOYS + 1);
  assert.deepEqual([...read.optionIds].sort(), ids.slice(0, 9).sort());
  assert.deepEqual(quizFromParams(quizToParams(quiz), works).optionIds, read.optionIds);
});

test('quizFromParams: null for a cut, unknown or excluded address', () => {
  const broken = (change) => { const p = quizToParams(quiz); change(p); return quizFromParams(p, works); };
  assert.equal(broken((p) => p.delete('nabidka')), null);
  assert.equal(broken((p) => p.set('nabidka', 'b1,c1')), null);
  assert.equal(broken((p) => p.set('nabidka', 'a1,c1,d1,e1,f1,g1,h1,i1')), null);
  assert.equal(broken((p) => p.set('nabidka', 'b1,b1,d1,e1,f1,g1,h1,i1')), null);
  assert.equal(broken((p) => p.set('obraz', 'zz')), null);
  assert.equal(broken((p) => p.set('x', '120')), null);
  assert.equal(broken((p) => p.set('x', 'abc')), null);
  assert.equal(broken((p) => p.set('uroven', 'nic')), null);
  assert.equal(broken((p) => p.set('zkresleni', 'nic')), null);
  const other = gameLooks().find((l) => l.level !== easy.id);
  assert.equal(broken((p) => p.set('zkresleni', other.id)), null, 'a look of another level');
  assert.equal(quizFromParams(quizToParams(quiz), works, { c1: false }), null, 'an offered work out of the game');
  assert.equal(quizFromParams(quizToParams(quiz), works, { a1: false }), null);
});

test('quizCrop: the square of the level kept whole inside the picture', () => {
  const crop = quizCrop([0, 0], easy, 1);
  assert.equal(crop.size, easy.size);
  assert.ok(Math.abs(crop.x - easy.size / 2) < 1e-9 && Math.abs(crop.y - easy.size / 2) < 1e-9);
  const middle = quizCrop([0.5, 0.5], easy, 1);
  assert.deepEqual([middle.x, middle.y], [0.5, 0.5]);
});

test('cropExcluded and quizView: never a view over a place kept out', () => {
  const crop = { x: 0.3, y: 0.5, size: 0.2 };
  assert.equal(cropExcluded(crop, 1, []), false);
  assert.equal(cropExcluded(crop, 1, [{ x0: 0.35, y0: 0, x1: 0.5, y1: 1 }]), true);
  const areas = [{ x0: 0.7, y0: 0, x1: 1, y1: 1 }];
  assert.equal(quizView({ crop, ratio: 1, level: { ...easy, size: 0.2 }, areas: [] }), easy.lastView);
  const view = quizView({ crop, ratio: 1, level: { ...easy, size: 0.2 }, areas });
  assert.ok(view < easy.lastView && view >= crop.size);
});

test('quizSimilar: the closest others, never the work itself nor the works out of the game', () => {
  const list = ['a', 'b', 'c'].map((id, i) => ({ id, technique: 'akvarel', tags: i < 2 ? ['les'] : ['moře'], colourProfile: null }));
  const similar = quizSimilar(list, { c: false }, 5);
  assert.deepEqual(Object.keys(similar), ['a', 'b']);
  assert.deepEqual(similar.a, ['b']);
});

test('quizOffer: eight other works, the same for the same seed', () => {
  const similar = { a1: ids.slice(1) };
  const offer = quizOffer({ workId: 'a1', level: easy, similar, seed: 'x' });
  assert.equal(offer.length, QUIZ_DECOYS);
  assert.ok(!offer.includes('a1'));
  assert.deepEqual(quizOffer({ workId: 'a1', level: easy, similar, seed: 'x' }), offer);
});

test('quizEventParams and quizShareText', () => {
  const read = quizFromParams(quizToParams(quiz), works);
  assert.deepEqual(quizEventParams(read), { source: 'quiz', level: easy.id, look: look.id, work_id: 'a1' });
  assert.deepEqual(quizEventParams(read, { solved: true, misses: 1 }), { source: 'quiz', level: easy.id, look: look.id, work_id: 'a1', solved: 'yes', misses: 1 });
  assert.match(quizShareText({ level: easy, author: 'Pavla K.' }), /^Můj Detail dne \(.+\): poznáš, ze kterého obrazu je tenhle výřez\? Obrazy: Pavla K\.$/);
  assert.match(quizShareText({ level: easy, author: '' }), /výřez\?$/);
});

test('quizWindows: a window per look of the level and the preview with the chosen look; the preview never painted as a look', () => {
  for (const level of gameLevels()) {
    const own = gameLooks().filter((l) => l.level === level.id);
    const chosen = own.at(-1);
    const windows = quizWindows({ level: level.id, look: chosen.id });
    assert.deepEqual(windows.map((w) => w.window), [...own.map((l) => l.id), QUIZ_PREVIEW]);
    assert.deepEqual(windows.at(-1).look, chosen);
    for (const { window, look: painted } of windows) assert.ok(gameLooks().some((l) => l.id === painted.id), window);
  }
  assert.ok(!gameLooks().some((l) => l.id === QUIZ_PREVIEW), 'no look may be called like the preview');
  // a look of another level (or none yet): the preview shows the first look of the level
  const windows = quizWindows({ level: easy.id, look: 'nope' });
  assert.deepEqual(windows.at(-1).look, gameLooks().find((l) => l.level === easy.id));
  assert.deepEqual(quizWindows({ level: 'nope', look: 'clear' }), []);
});

test('quizOnOpen: an address of a quiz is always a new round, also of the same quiz played to the end; a reload goes on', () => {
  const address = new URLSearchParams('obraz=a1&uroven=lehka&x=0.5&y=0.5');
  const over = { params: address.toString(), round: { guesses: ['a1'], solved: true, over: true } };
  // the same link again after the end: a new round
  assert.deepEqual(quizOnOpen(address, over), { params: address.toString(), round: null, fresh: true });
  // another quiz: a new round of it
  assert.deepEqual(quizOnOpen(new URLSearchParams('obraz=b1'), over), { params: 'obraz=b1', round: null, fresh: true });
  // a reload of the cleaned address: the kept round goes on
  assert.deepEqual(quizOnOpen(new URLSearchParams(''), over), { params: over.params, round: over.round, fresh: false });
  // nothing kept, no address: the page tells how to make a quiz
  assert.deepEqual(quizOnOpen(new URLSearchParams(''), null), { params: '', round: null, fresh: false });
  assert.deepEqual(quizOnOpen(new URLSearchParams('x=1'), { params: '' }), { params: '', round: null, fresh: false });
});
