import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PICK_BOX_ATTRIBUTE, applyRandomPick, hiddenInList, pickBoxBefore, randomPickScript } from './random-pick.mjs';
import { fakeElement, runInlineScript } from './test-support/inline-script-dom.mjs';

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

test('randomPickScript: self-contained, runs the function itself on the box found by pickBoxBefore', () => {
  assert.doesNotThrow(() => new Function(randomPickScript));
  assert.match(randomPickScript, /\(function applyRandomPick\(box, random = Math\.random\)/);
  assert.match(randomPickScript, /var box = pickBoxBefore\(document\.currentScript\);/);
  assert.doesNotMatch(randomPickScript, /currentScript\.previousElementSibling/, 'never just the element right before it');
  assert.doesNotMatch(randomPickScript, /\bimport\b|=>/, 'self-contained, plain functions');
  assert.match(String(pickBoxBefore), new RegExp(`'${PICK_BOX_ATTRIBUTE}'`), 'looks for the attribute the box carries');
});

/** A box of the random cover with candidates `ids`, as Cover.astro renders it. */
const pickBox = (ids) => fakeElement({
  attributes: { [PICK_BOX_ATTRIBUTE]: '' },
  children: ids.map((id, i) => Object.assign(fakeElement({ attributes: { 'data-pick': '', 'data-id': id } }), { hidden: i > 0 })),
});
const shownIds = (box) => box.children.filter((c) => !c.hidden).map((c) => c.getAttribute('data-id'));

test('pickBoxBefore: the nearest earlier sibling with data-pick-box, or null', () => {
  const box = pickBox(['a', 'b']);
  const other = fakeElement({ tagName: 'SCRIPT', previous: box });
  assert.equal(pickBoxBefore(fakeElement({ tagName: 'SCRIPT', previous: box })), box);
  assert.equal(pickBoxBefore(fakeElement({ tagName: 'SCRIPT', previous: other })), box, 'past a script after the box');
  assert.equal(pickBoxBefore(fakeElement({ tagName: 'SCRIPT', previous: fakeElement() })), null);
  assert.equal(pickBoxBefore(fakeElement({ tagName: 'SCRIPT' })), null);
});

test('randomPickScript in a page: shows exactly one candidate, also with a script between the box and it', () => {
  const right = runInlineScript(randomPickScript, [pickBox(['a', 'b', 'c'])]).grid;
  assert.equal(shownIds(right).length, 1);
  const between = runInlineScript(randomPickScript, [pickBox(['a', 'b', 'c']), fakeElement({ tagName: 'SCRIPT', attributes: { type: 'module' } })]).grid;
  assert.equal(shownIds(between).length, 1);
  assert.doesNotThrow(() => runInlineScript(randomPickScript, [fakeElement({ tagName: 'P' })]), 'no box = does nothing');
});
