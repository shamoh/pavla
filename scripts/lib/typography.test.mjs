import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepTogether, keepTogetherHtml } from './typography.mjs';

const nb = ' ';
/** The text with "~" for each non-breaking space, to read the expectations easily. */
const k = (text) => keepTogether(text).replaceAll(nb, '~').replaceAll('\u2060', '^');

test('keepTogether: one-letter words stay with the next word', () => {
  assert.equal(k('Začalo to v roce 2019 a k tomu i s Kamilou.'), 'Začalo to v~roce 2019 a~k~tomu i~s~Kamilou.');
  assert.equal(k('V lese, (u vody) „a pak“ O nás'), 'V~lese, (u~vody) „a~pak“ O~nás', 'capitals, after brackets and quotes');
  assert.equal(k('Vitamín C je x. Konec a'), 'Vitamín C je x. Konec a', 'other letters and a word at the very end stay');
  assert.equal(k('slovo-a slovo'), 'slovo-a slovo', 'only a word of its own');
});

test('keepTogether: numbers with units, the multiplication sign, thousands', () => {
  assert.equal(k('Akvarel 30 × 40 cm'), 'Akvarel 30~×~40~cm');
  assert.equal(k('30 x 40 cm'), '30~x~40~cm');
  assert.equal(k('5 cm, 12 mm, 3 m a 2 km'), '5~cm, 12~mm, 3~m a~2~km');
  assert.equal(k('Cena 2 500 Kč, sleva 20 %, venku 25 °C'), 'Cena 2~500~Kč, sleva 20~%, venku 25~°C');
  assert.equal(k('V roce 2019 maluji'), 'V~roce 2019 maluji', 'a year and a word: no unit');
  assert.equal(k('2 malé obrazy, 5 mořských vln'), '2 malé obrazy, 5 mořských vln', 'a unit only as a word of its own');
  assert.equal(k('rok 2019 300 lidí'), 'rok 2019 300 lidí', 'no thousands after a four-digit number');
});

test('keepTogether: abbreviations stay with the next word', () => {
  assert.equal(k('např. akvarel, tzv. mokré do mokrého, tj. hned'), 'např.~akvarel, tzv.~mokré do mokrého, tj.~hned');
  assert.equal(k('Např. sv. Vít a cca 5 obrazů, MUDr. Novák'), 'Např.~sv.~Vít a~cca~5 obrazů, MUDr.~Novák');
  assert.equal(k('Konec věty. Další'), 'Konec věty. Další');
});

test('keepTogether: anything but a text as it is', () => {
  assert.equal(keepTogether(undefined), '');
  assert.equal(keepTogether(''), '');
  assert.equal(keepTogether(5), 5);
});

test('keepTogetherHtml: the text only, never a tag, across tags too', () => {
  assert.equal(keepTogetherHtml('<a href="/a b" title="v x">v x</a> a <strong>s barvou</strong>'),
    `<a href="/a b" title="v x">v${nb}x</a> a${nb}<strong>s${nb}barvou</strong>`);
  assert.equal(keepTogetherHtml('<em>30 × 40 cm</em>'), `<em>30${nb}×${nb}40${nb}cm</em>`);
  assert.equal(keepTogetherHtml(''), '');
});

test('keepTogether: dates and ordinal numbers', () => {
  assert.equal(k('Dne 15. 11. 2026 jsem malovala'), 'Dne 15.~11.~2026 jsem malovala');
  assert.equal(k('od 1. 7. do 15. 8.'), 'od 1.~7.~do 15.~8.', 'a date without a year also keeps the next lower-case word');
  assert.equal(k('1. místo, 15. listopadu, 3. ročník'), '1.~místo, 15.~listopadu, 3.~ročník');
  assert.equal(k('V roce 2019. Pak jsem'), 'V~roce 2019. Pak jsem', 'the end of a sentence stays');
  assert.equal(k('Bylo mi 5. Potom'), 'Bylo mi 5. Potom', 'a capital after the dot: a new sentence');
});

test('keepTogether: ranges of numbers and dashes in sentences', () => {
  assert.equal(k('V letech 2019–2024 a 2019 – 2024 i 2019 - 2024'), 'V~letech 2019^–^2024 a~2019^–^2024 i~2019^–^2024');
  assert.equal(k('2019-2024'), '2019^-^2024', 'a hyphen stays a hyphen');
  assert.equal(k('chvíle – kdy se svět zpomalí'), 'chvíle~– kdy se svět zpomalí');
  assert.equal(k('chvíle - kdy, a — pak'), 'chvíle~- kdy, a~— pak');
  assert.equal(k('Plenér Šumava-jih'), 'Plenér Šumava-jih', 'a hyphen inside a word stays');
});

test('keepTogether: three dots are the ellipsis, never in an address or with more dots', () => {
  assert.equal(k('kopretiny... v jemných tónech'), 'kopretiny… v~jemných tónech');
  assert.equal(k('...vyprávění a konec...'), '…vyprávění a~konec…');
  assert.equal(k('a....b'), 'a....b', 'four dots stay');
  assert.equal(k('viz https://x.cz/a...b a www.x...cz'), 'viz https://x.cz/a...b a~www.x...cz');
  assert.equal(keepTogetherHtml('<a href="/a...b/">tak...</a>'), '<a href="/a...b/">tak…</a>', 'the address of a link is a tag');
});
