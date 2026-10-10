import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEED_UTM, PIN_DESCRIPTION_CHARS, clip, withParams, feedImages, pinDescription, pinKeywords, pinSaveUrl, pinterestFeed } from './pinterest.mjs';

test('clip: whitespace collapsed, cut after a whole word with "…"', () => {
  assert.equal(clip('  Ráno   u\nrybníka ', 100), 'Ráno u rybníka');
  assert.equal(clip('jedna dva tři čtyři', 12), 'jedna dva…');
  assert.ok(clip('a'.repeat(50), 10).length <= 10, 'a single long word is cut inside');
  assert.equal(clip(undefined, 10), '');
});

const dictionary = { akvarel: 'watercolor', krajina: 'landscape', mlha: 'fog' };

test('pinKeywords: technique and tags in Czech, then their English translations; a word without one only Czech', () => {
  assert.equal(pinKeywords({ technique: 'akvarel', tags: ['krajina', 'mlha'] }, dictionary), 'akvarel, krajina, mlha · watercolor, landscape, fog');
  assert.equal(pinKeywords({ technique: 'akvarel', tags: ['Krajina', 'šumava', 'akvarel'] }, dictionary), 'akvarel, Krajina, šumava · watercolor, landscape');
  assert.equal(pinKeywords({ technique: 'kvaš' }, dictionary), 'kvaš', 'no translation: no English part');
  assert.equal(pinKeywords({}, dictionary), '');
  assert.equal(pinKeywords({ technique: 'akvarel' }), 'akvarel', 'no dictionary');
});

test('pinDescription: the description, technique · size · year, the keywords; never DOPLNIT', () => {
  const work = { description: 'Mlha nad vodou.', technique: 'akvarel', size_cm: [40, 30], tags: ['mlha'] };
  assert.equal(pinDescription(work, 2026, dictionary), 'Mlha nad vodou. akvarel · 40 × 30 cm · 2026. akvarel, mlha · watercolor, fog');
  assert.equal(pinDescription({ ...work, description: 'DOPLNIT popis' }, 2026, dictionary), 'akvarel · 40 × 30 cm · 2026. akvarel, mlha · watercolor, fog');
  const long = pinDescription({ ...work, description: 'slovo '.repeat(200) }, 2026, dictionary);
  assert.ok(long.length <= PIN_DESCRIPTION_CHARS);
  assert.ok(long.endsWith('akvarel, mlha · watercolor, fog') && long.includes('…'), 'a long description is shortened, the keywords stay');
});

const channel = { title: 'Pavla & spol.', link: 'https://example.test/', description: 'Akvarely', self: 'https://example.test/pinterest.xml' };
const item = {
  id: 'jujn2', title: 'Bobří <hráz>', link: 'https://example.test/tvorba/2026/bobri-hraz-jujn2/', description: 'Voda "a" mlha',
  date: new Date('2026-06-14'), image: { url: 'https://example.test/tvorba/2026/bobri-hraz-jujn2/pin.jpg', bytes: 1234 },
};

test('pinterestFeed: RSS 2.0, one escaped item per pin, guid = id of the work, the pin as enclosure', () => {
  const xml = pinterestFeed(channel, [item]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0"/);
  assert.ok(xml.includes('<title>Pavla &amp; spol.</title>'));
  assert.ok(xml.includes('<atom:link href="https://example.test/pinterest.xml" rel="self" type="application/rss+xml"/>'));
  assert.ok(xml.includes('<title>Bobří &lt;hráz&gt;</title>'));
  assert.ok(xml.includes('<guid isPermaLink="false">jujn2</guid>'));
  assert.ok(xml.includes('<description>Voda &quot;a&quot; mlha</description>'));
  assert.ok(xml.includes('<pubDate>Sun, 14 Jun 2026 00:00:00 GMT</pubDate>'));
  assert.ok(xml.includes('<enclosure url="https://example.test/tvorba/2026/bobri-hraz-jujn2/pin.jpg" length="1234" type="image/jpeg"/>'));
  assert.equal((xml.match(/<item>/g) ?? []).length, 1);
  assert.deepEqual(feedImages(xml), [item.image.url]);
});

test('pinterestFeed: no pins = an empty channel; an invalid date is left out', () => {
  const empty = pinterestFeed(channel, []);
  assert.ok(empty.includes('<channel>') && !empty.includes('<item>'));
  assert.deepEqual(feedImages(empty), []);
  assert.ok(!pinterestFeed(channel, [{ ...item, date: 'nikdy' }]).includes('<pubDate>'));
});

test('pinSaveUrl: Pinterest\'s form with the page, the picture and the description', () => {
  const u = new URL(pinSaveUrl({ url: 'https://example.test/a/', media: 'https://example.test/a/pin.jpg', description: 'Ráno & mlha' }));
  assert.equal(u.origin + u.pathname, 'https://www.pinterest.com/pin/create/button/');
  assert.deepEqual(Object.fromEntries(u.searchParams), { url: 'https://example.test/a/', media: 'https://example.test/a/pin.jpg', description: 'Ráno & mlha' });
});

test('withParams: UTM parameters of the feed added to the address of a page', () => {
  assert.equal(withParams('https://example.test/tvorba/2026/a-b1c2d/', FEED_UTM),
    'https://example.test/tvorba/2026/a-b1c2d/?utm_source=pinterest&utm_medium=social&utm_campaign=rss');
  assert.equal(withParams('https://example.test/a/?x=1&utm_source=old', { utm_source: 'pinterest' }), 'https://example.test/a/?x=1&utm_source=pinterest');
  assert.ok(pinterestFeed({ title: 't', link: 'l', description: 'd' }, [{
    id: 'a', title: 'A', link: withParams('https://example.test/a/', FEED_UTM), description: '', image: { url: 'https://example.test/a/pin.jpg' },
  }]).includes('<link>https://example.test/a/?utm_source=pinterest&amp;utm_medium=social&amp;utm_campaign=rss</link>'), 'escaped in the XML');
});
