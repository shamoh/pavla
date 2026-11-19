// One of several candidates at random, per visit: the cover of the home page and of a collection
// (the newest works of the author's selection, see coverCandidates in works.mjs).
//
// The page renders every candidate as a child of the box (`data-pick-box`) with `data-pick` (the first one visible, the
// others `hidden`, their images lazy, so hidden ones are never loaded) and runs applyRandomPick after the box as an
// inline script (on the nearest box before it, pickBoxBefore): it shows a random candidate before the page is painted, so nothing flickers. Without JavaScript the
// first candidate stays.
// Optionally the box names a list (`data-pick-exclude="<selector>"`) whose cards (`data-id`) should not repeat the
// shown candidate, showing at most `data-pick-show` of the rest (the home page: the newest works below the cover).
//
// applyRandomPick is inlined into the page by its source text, so it must stay self-contained (no imports, no
// closures over this module) and use only plain DOM features.

/** Shows one child with `data-pick` at random, hides the others, updates the excluded list; returns the shown id. */
export function applyRandomPick(box, random = Math.random) {
  var items = Array.prototype.filter.call(box.children, function (el) { return el.hasAttribute('data-pick'); });
  if (!items.length) return null;
  var chosen = items.length > 1 ? Math.min(items.length - 1, Math.floor(random() * items.length)) : 0;
  items.forEach(function (el, i) { el.hidden = i !== chosen; });
  var id = items[chosen].getAttribute('data-id');
  var selector = box.getAttribute('data-pick-exclude');
  var list = selector && box.ownerDocument.querySelector(selector);
  if (list) {
    var show = Number(box.getAttribute('data-pick-show')) || Infinity;
    var rest = Array.prototype.filter.call(list.children, function (card) { return card.getAttribute('data-id') !== id; });
    Array.prototype.forEach.call(list.children, function (card) {
      var at = rest.indexOf(card);
      card.hidden = at === -1 || at >= show;
    });
  }
  return id;
}

/** The attribute of the box the inline script runs on (Cover.astro). */
export const PICK_BOX_ATTRIBUTE = 'data-pick-box';

/**
 * The box an inline random pick runs on: the nearest element before `script` with data-pick-box, null when there is
 * none. Not just the element right before the script: a component may put its own script or element after the box.
 */
export function pickBoxBefore(script) {
  var element = script.previousElementSibling;
  while (element && !element.hasAttribute('data-pick-box')) element = element.previousElementSibling;

  return element;
}

/** The inline script placed after a box: runs applyRandomPick on it (pickBoxBefore). */
export const randomPickScript =
  `(function () {\n${pickBoxBefore}\nvar box = pickBoxBefore(document.currentScript);\nif (box) (${applyRandomPick})(box);\n})();`;

/**
 * Which of `ids` (a list below the cover, e.g. the newest works) are hidden in the HTML, before the script runs:
 * the first candidate is shown, so its card is hidden, and at most `show` of the others are visible.
 */
export function hiddenInList(ids, shownId, show) {
  const rest = ids.filter((id) => id !== shownId);
  return ids.map((id) => id === shownId || rest.indexOf(id) >= show);
}
