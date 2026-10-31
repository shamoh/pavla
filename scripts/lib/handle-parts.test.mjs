import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleParts } from './handle-parts.mjs';

const AUTHOR = 'Pavla Kramolišová';
// given name in [], surname in {}, the rest as it is
const marked = (text, author = AUTHOR) => handleParts(text, author)
  .map((p) => (p.kind === 'given' ? `[${p.text}]` : p.kind === 'surname' ? `{${p.text}}` : p.text)).join('');

test('handleParts: the given name, the surname (or its longest beginning) and the rest; joined = the text', () => {
  assert.equal(marked('pavla@kramolis.cz'), '[pavla]@{kramolis}.cz');
  assert.equal(marked('@pavla.kramolisova'), '@[pavla].{kramolisova}');
  assert.equal(marked('@pavlakramolisova'), '@[pavla]{kramolisova}');
  assert.equal(marked('Kramolisova.Pavla@example.com'), '{Kramolisova}.[Pavla]@example.com', 'any order and case, as written');
  assert.deepEqual(handleParts('pavla@kramolis.cz', AUTHOR).map((p) => p.kind), ['given', 'rest', 'surname', 'rest']);
  for (const text of ['pavla@kramolis.cz', '@pavla.kramolisova', 'Fler', 'kramolis.cz']) {
    assert.equal(handleParts(text, AUTHOR).map((p) => p.text).join(''), text);
  }
});

test('handleParts: one of the names alone; a short given name whole; the names never overlap', () => {
  assert.equal(marked('info@kramolis.cz'), 'info@{kramolis}.cz');
  assert.equal(marked('@pavla.art'), '@[pavla].art');
  assert.equal(marked('eva@novak.cz', 'Eva Nováková'), '[eva]@{novak}.cz', 'a given name shorter than MIN_NAME only whole');
  assert.equal(marked('@evelina', 'Eva Nováková'), '@evelina', 'its beginning is no mark');
  assert.equal(marked('@pavlapavla', 'Pavla Pavla'), '@[pavla]{pavla}');
});

test('handleParts: without the names (or too short a part of them) one plain part', () => {
  assert.deepEqual(handleParts('Fler', AUTHOR), [{ text: 'Fler', kind: null }]);
  assert.deepEqual(handleParts('@kram', AUTHOR), [{ text: '@kram', kind: null }], 'shorter than MIN_NAME letters is no mark');
  assert.deepEqual(handleParts('pavla@kramolis.cz', ''), [{ text: 'pavla@kramolis.cz', kind: null }]);
  assert.deepEqual(handleParts('', AUTHOR), []);
});
