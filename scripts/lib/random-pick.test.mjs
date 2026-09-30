import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRandomPick, hiddenInList, randomPickScript } from './random-pick.mjs';

/** A minimal element: attributes, children, the hidden flag. */
function el(attrs = {}, children = []) {
  return {
    hidden: false,
    children,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
    hasAttribute: (name) => name in attrs,
  };
}

test('applyRandomPick shows exactly one candidate, the one the random number points to', () => {
  const items = ['a', 'b', 'c'].map((id) => el({ 'data-pick': '', 'data-id': id }));
  const box = el({}, [el({ class: 'not-a-candidate' }), ...items]);
  assert.equal(applyRandomPick(box, () => 0.5), 'b');
  assert.deepEqual(items.map((i) => i.hidden), [true, false, true]);
  assert.equal(applyRandomPick(box, () => 0.999), 'c');
  assert.equal(applyRandomPick(box, () => 0), 'a');
  assert.equal(box.children[0].hidden, false, 'other children are left alone');
});

test('applyRandomPick with one candidate or none', () => {
  const only = el({ 'data-pick': '', 'data-id': 'a' });
  assert.equal(applyRandomPick(el({}, [only]), () => 0.9), 'a');
  assert.equal(only.hidden, false);
  assert.equal(applyRandomPick(el({}, [])), null);
});

test('applyRandomPick: the list below never repeats the shown work and keeps its size', () => {
  const cards = ['a', 'x', 'y', 'z'].map((id) => el({ 'data-id': id }));
  const list = el({}, cards);
  const items = ['a', 'b'].map((id) => el({ 'data-pick': '', 'data-id': id }));
  const box = el({ 'data-pick-exclude': '#recent', 'data-pick-show': '3' }, items);
  box.ownerDocument = { querySelector: (sel) => (sel === '#recent' ? list : null) };
  applyRandomPick(box, () => 0); // "a" is shown, it is also the newest card
  assert.deepEqual(cards.map((c) => c.hidden), [true, false, false, false]);
  applyRandomPick(box, () => 0.9); // "b" is not in the list: the three newest stay
  assert.deepEqual(cards.map((c) => c.hidden), [false, false, false, true]);
});

test('hiddenInList matches the page before the script runs', () => {
  assert.deepEqual(hiddenInList(['a', 'x', 'y', 'z'], 'a', 3), [true, false, false, false]);
  assert.deepEqual(hiddenInList(['a', 'x', 'y', 'z'], 'b', 3), [false, false, false, true]);
  assert.deepEqual(hiddenInList(['a'], 'a', 6), [true]);
  assert.deepEqual(hiddenInList([], undefined, 6), []);
});

test('randomPickScript is the function itself, run on the element right before the script', () => {
  assert.match(randomPickScript, /^\(function applyRandomPick\(box, random = Math\.random\)/);
  assert.match(randomPickScript, /\)\(document\.currentScript\.previousElementSibling\);$/);
  assert.doesNotMatch(randomPickScript, /\bimport\b|=>/, 'self-contained, plain functions');
});
