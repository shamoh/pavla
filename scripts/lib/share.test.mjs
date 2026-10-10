import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHARE_COPY, SHARE_NATIVE, shareLinks } from './share.mjs';

test('shareLinks: Pinterest with the pin, Facebook with the page, WhatsApp with the title and the page', () => {
  const links = shareLinks({ url: 'https://example.test/a/', media: 'https://example.test/a/pin.jpg', title: 'Ráno & mlha', description: 'Popis' });
  assert.deepEqual(links.map((l) => l.method), ['pinterest', 'facebook', 'whatsapp']);
  for (const l of links) assert.ok(l.label && l.href.startsWith('https://'), l.method);
  const pin = new URL(links[0].href);
  assert.deepEqual([pin.searchParams.get('url'), pin.searchParams.get('media'), pin.searchParams.get('description')], ['https://example.test/a/', 'https://example.test/a/pin.jpg', 'Popis']);
  assert.equal(new URL(links[1].href).searchParams.get('u'), 'https://example.test/a/');
  assert.equal(new URL(links[2].href).searchParams.get('text'), 'Ráno & mlha https://example.test/a/');
  assert.deepEqual([SHARE_NATIVE, SHARE_COPY], ['native', 'copy']);
});
