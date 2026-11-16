import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CODE_MESSAGES, codeEvent, codeFromInput, codePath, isBulkInput, opensCodeJump } from './code-jump.mjs';

test('codeFromInput: the code itself, any case and spaces', () => {
  assert.equal(codeFromInput('jujn2'), 'jujn2');
  assert.equal(codeFromInput('  JUJN2 '), 'jujn2');
});

test('codeFromInput: the line of an Instagram post and addresses of a work', () => {
  assert.equal(codeFromInput('pavla.kramolis.cz · jujn2'), 'jujn2');
  assert.equal(codeFromInput('pavla.kramolis.cz * jujn2'), 'jujn2');
  assert.equal(codeFromInput('https://pavla.kramolis.cz/tvorba/jujn2/'), 'jujn2');
  assert.equal(codeFromInput('pavla.kramolis.cz/tvorba/2026/bobri-hraz-jujn2/?utm_source=x'), 'jujn2');
  assert.equal(codeFromInput('pavla.kramolis.cz/tvorba/2026/bobri-hraz-jujn2'), 'jujn2', 'without the slash at the end');
});

test('codeFromInput: nothing that is no code', () => {
  for (const text of ['', '   ', 'pavla.kramolis.cz', 'abc', 'jujn2x', '22222', 'obraz', null, undefined]) {
    assert.equal(codeFromInput(text), null, String(text));
  }
  assert.equal(codeFromInput('https://pavla.kramolis.cz/tvorba/2026/'), null, 'a year is no code');
});

test('codePath and messages', () => {
  assert.equal(codePath('jujn2'), '/tvorba/jujn2/');
  assert.match(CODE_MESSAGES.missing('jujn2'), /jujn2/);
});

test('codeEvent: code_open with the work and how it was opened', () => {
  assert.deepEqual(codeEvent('jujn2', 'paste'), { name: 'code_open', params: { work_id: 'jujn2', method: 'paste' } });
  assert.deepEqual(codeEvent('jujn2', 'enter').params.method, 'enter');
  assert.deepEqual(codeEvent('jujn2', 'other').params.method, 'enter', 'anything else counts as confirmed');
});

test('isBulkInput: a paste or a whole code typed at once (the clipboard bar of a phone keyboard), not a letter', () => {
  assert.ok(isBulkInput({ inputType: 'insertFromPaste', data: null }));
  assert.ok(isBulkInput({ inputType: 'insertText', data: 'pavla.kramolis.cz · jujn2' }));
  assert.ok(!isBulkInput({ inputType: 'insertText', data: 'j' }));
  assert.ok(!isBulkInput({ inputType: 'deleteContentBackward', data: null }));
  assert.ok(!isBulkInput());
});

test('opensCodeJump: "#" outside fields, without Ctrl / Cmd', () => {
  assert.ok(opensCodeJump({ key: '#' }, { tagName: 'BODY' }));
  assert.ok(opensCodeJump({ key: '#', altKey: true }, { tagName: 'A' }), 'AltGr on a Czech keyboard');
  assert.ok(!opensCodeJump({ key: '#' }, { tagName: 'INPUT' }));
  assert.ok(!opensCodeJump({ key: '#' }, { tagName: 'TEXTAREA' }));
  assert.ok(!opensCodeJump({ key: '#' }, { tagName: 'DIV', isContentEditable: true }));
  assert.ok(!opensCodeJump({ key: '#', metaKey: true }, { tagName: 'BODY' }));
  assert.ok(!opensCodeJump({ key: '3' }, { tagName: 'BODY' }));
});
