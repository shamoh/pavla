import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGE_TYPES, contactLink, contextFromQuery, contextLabel, defaultType, isAccessKey, messageEventParams, messageSubject, messageType,
  mailtoLink, messagesMode, messagesSettings, needsEmail, pageContext, sitePath,
  validateMessage, web3formsBody, workContext,
} from './messages.mjs';

const KEY = '0f8a6c2e-1b3d-4e5f-9a7b-2c4d6e8f0a1b';
const ovce = workContext({ title: 'Ovce', id: 'v39nd', year: 2026, onSale: false }, '/tvorba/2026/ovce-v39nd/');
const site = { title: 'Pavla Kramolišová', url: 'https://web.test' };

test('message types: unique ids, a question about a work and a purchase need an address', () => {
  assert.equal(new Set(MESSAGE_TYPES.map((t) => t.id)).size, MESSAGE_TYPES.length);
  assert.deepEqual(MESSAGE_TYPES.filter((t) => needsEmail(t.id)).map((t) => t.id), ['work', 'purchase']);
  assert.equal(messageType('nonsense').id, 'greeting', 'an unknown id from an old draft falls back to the first kind');
});

test('defaultType: a work for sale = purchase, another work = question, any other page or none = greeting', () => {
  assert.equal(defaultType({ ...ovce, onSale: true }), 'purchase');
  assert.equal(defaultType(ovce), 'work');
  assert.equal(defaultType(pageContext('/tvorba/', 'Tvorba')), 'greeting');
  assert.equal(defaultType(null), 'greeting');
});

test('contextLabel and messageSubject say what the message is about', () => {
  assert.equal(contextLabel(ovce), 'K obrazu: Ovce (2026)');
  assert.equal(contextLabel(pageContext('/tvorba/kolekce/', 'Kolekce')), 'Ke stránce: Kolekce');
  assert.equal(contextLabel(pageContext('/x/', '')), 'Ke stránce: /x/', 'a page without a title is named by its address');
  assert.equal(contextLabel(null), null);
  assert.equal(messageSubject('work', ovce), '[pavla-web] Dotaz na obraz: Ovce (v39nd)');
  assert.equal(messageSubject('bug', pageContext('/tvorba/kolekce/', 'Kolekce')), '[pavla-web] Chyba na webu: Kolekce');
  assert.equal(messageSubject('greeting', null), '[pavla-web] Pozdrav nebo vzkaz');
});

test('validateMessage: text is required, the address must look right and is required only where an answer is needed', () => {
  assert.deepEqual(validateMessage({ type: 'greeting', text: 'Ahoj', email: '' }), {});
  assert.deepEqual(Object.keys(validateMessage({ type: 'greeting', text: '  ', email: '' })), ['text']);
  assert.deepEqual(Object.keys(validateMessage({ type: 'work', text: 'Je volný?', email: '' })), ['email']);
  assert.deepEqual(Object.keys(validateMessage({ type: 'greeting', text: 'Ahoj', email: 'nope' })), ['email']);
  assert.deepEqual(validateMessage({ type: 'purchase', text: 'Chci', email: ' a@b.cz ' }), {});
});

test('messagesMode: the real site with a key = live, without = no form; the test data = always a preview', () => {
  assert.equal(messagesMode({ accessKey: KEY }, { demo: false }), 'live');
  assert.equal(messagesMode({ accessKey: KEY }, { demo: true }), 'preview', 'trying the test data never e-mails the author');
  assert.throws(() => messagesMode({ accessKey: 'abc' }, { demo: true }), /access key/);
  assert.equal(messagesMode({ accessKey: '' }, { demo: true }), 'preview');
  assert.equal(messagesMode(undefined, { demo: false }), null);
  assert.throws(() => messagesMode({ accessKey: 'abc' }, { demo: false }), /access key/);
  assert.ok(isAccessKey(KEY.toUpperCase()));
});

test('web3formsBody: subject, reply-to and the page; no address = no reply-to', () => {
  const body = web3formsBody(KEY, site, { type: 'work', text: ' Je ještě volný? ', email: 'a@b.cz' }, ovce);
  assert.equal(body.access_key, KEY);
  assert.equal(body.subject, '[pavla-web] Dotaz na obraz: Ovce (v39nd)');
  assert.equal(body.replyto, 'a@b.cz');
  assert.equal(body['Zpráva'], 'Je ještě volný?');
  assert.equal(body['Stránka'], 'https://web.test/tvorba/2026/ovce-v39nd/');
  assert.equal(body['Obraz'], 'Ovce (v39nd)');
  assert.equal(body.botcheck, false);
  const plain = web3formsBody(KEY, site, { type: 'greeting', text: 'Ahoj', email: '' }, null);
  assert.equal(plain.replyto, undefined);
  assert.equal(plain['Stránka'], undefined);
});

test('contactLink and contextFromQuery: the context survives the trip to the contact page', () => {
  const back = (ctx) => contextFromQuery(new URL(contactLink(ctx), 'https://web.test').searchParams);
  assert.deepEqual(back(pageContext('/tvorba/kolekce/', 'Kolekce')), pageContext('/tvorba/kolekce/', 'Kolekce'));
  assert.deepEqual(back(ovce), { kind: 'work', path: ovce.path, title: 'Ovce', id: 'v39nd', onSale: false });
  assert.equal(contactLink(null), '/kontakt/');
  assert.equal(contextFromQuery(new URLSearchParams('')), null);
  assert.equal(contextFromQuery(new URLSearchParams('stranka=https://evil.test/')), null, 'only addresses of this site');
  assert.equal(contextFromQuery(new URLSearchParams('stranka=//evil.test/')), null);
});

test('messagesSettings: the key goes into the pages only when messages are live', () => {
  assert.deepEqual(messagesSettings({ accessKey: KEY }, { demo: false }), { mode: 'live', accessKey: KEY });
  assert.deepEqual(messagesSettings({ accessKey: KEY }, { demo: true }), { mode: 'preview', accessKey: '' }, 'the preview has no key');
  assert.deepEqual(messagesSettings({ accessKey: '' }, { demo: false }), { mode: null, accessKey: '' });
});

test('messageEventParams: the kind, and the work when the message is about one', () => {
  assert.deepEqual(messageEventParams({ type: 'purchase', context: ovce }), { message_type: 'purchase', work_id: 'v39nd', work_title: 'Ovce' });
  assert.deepEqual(messageEventParams({ type: 'bug', context: pageContext('/tvorba/', 'Tvorba') }), { message_type: 'bug' });
  assert.deepEqual(messageEventParams({ type: 'nonsense', context: null }), { message_type: 'greeting' });
});

test('mailtoLink: the same subject as a sent message, encoded', () => {
  assert.equal(mailtoLink('a@b.cz', 'greeting', null), `mailto:a@b.cz?subject=${encodeURIComponent('[pavla-web] Pozdrav nebo vzkaz')}`);
  const link = mailtoLink('a@b.cz', 'work', ovce);
  assert.equal(decodeURIComponent(link.split('subject=')[1]), '[pavla-web] Dotaz na obraz: Ovce (v39nd)');
});

test('sitePath: only paths on this site, read as a browser reads them', () => {
  assert.equal(sitePath('/tvorba/2026/ovce-v39nd/'), '/tvorba/2026/ovce-v39nd/');
  assert.equal(sitePath('/tvorba/?tag=voda'), '/tvorba/?tag=voda');
  assert.equal(sitePath('/a/../kontakt/'), '/kontakt/');
  for (const bad of ['//evil.test/', '/\\evil.test/', '/\\/evil.test', 'https://evil.test/', 'evil.test', '/x\ny', '', null, undefined]) {
    assert.equal(sitePath(bad), null, String(bad));
  }
});

test('contextFromQuery and web3formsBody never point the e-mail to another site', () => {
  assert.equal(contextFromQuery(new URLSearchParams({ stranka: '/\\evil.test/', nazev: 'X' })), null);
  const body = web3formsBody(KEY, site, { type: 'bug', text: 'x', email: '' }, pageContext('/\\evil.test/', 'X'));
  assert.equal(body['Stránka'], undefined, 'a forged context from the draft does not make a link either');
  assert.equal(web3formsBody(KEY, site, { type: 'bug', text: 'x', email: '' }, pageContext('/tvorba/', 'Tvorba'))['Stránka'], 'https://web.test/tvorba/');
});
