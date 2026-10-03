import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  artworkLd, authorId, breadcrumbLd, collectionPageLd, graphLd, jsonLdText, personLd, robotsTxt, summarize,
  verificationMeta, websiteLd, workDescription,
} from './seo.mjs';

const site = { url: 'https://web.test', title: 'Pavla Kramolišová', tagline: 'Akvarely a kresby', author: 'Pavla Kramolišová', instagram: 'pavla.k', fler: '' };
const work = { title: 'Ovce', key: 'ovce-v39nd', year: 2026, date: new Date('2026-09-26'), technique: 'akvarel', size_cm: [42, 30], status: 'not-for-sale' };

test('summarize: whitespace collapsed, at most max characters, cut after a whole word with an ellipsis', () => {
  assert.equal(summarize('  Tři ovce\n  z pastviny. '), 'Tři ovce z pastviny.');
  assert.equal(summarize(''), '');
  assert.equal(summarize(undefined), '');
  const long = summarize('slovo '.repeat(60), 40);
  assert.ok(long.length <= 40, long);
  assert.match(long, /slovo…$/);
});

test('workDescription: the own text, otherwise made of technique, support, size and year', () => {
  assert.equal(workDescription({ ...work, description: 'Tři ovce z pastviny.\n' }, site), 'Tři ovce z pastviny.');
  assert.equal(workDescription(work, site), 'Ovce – akvarel, 42 × 30 cm, 2026. Pavla Kramolišová.');
  assert.equal(workDescription({ ...work, support: 'papír Arches 300 g' }, site), 'Ovce – akvarel, papír Arches 300 g, 42 × 30 cm, 2026. Pavla Kramolišová.');
  assert.equal(workDescription({ title: 'Skica', year: 2025 }, site), 'Skica – 2025. Pavla Kramolišová.');
  assert.equal(workDescription({ ...work, size_cm: [29.5, 29.5] }, site), 'Ovce – akvarel, 29,5 × 29,5 cm, 2026. Pavla Kramolišová.');
});

test('artworkLd: a VisualArtwork by the author, with size in cm; on sale only availability, never a price', () => {
  const ld = artworkLd(work, site, { path: '/tvorba/2026/ovce-v39nd/', image: 'https://web.test/og.jpg' });
  assert.equal(ld['@type'], 'VisualArtwork');
  assert.equal(ld.url, 'https://web.test/tvorba/2026/ovce-v39nd/');
  assert.deepEqual(ld.creator, { '@id': authorId(site) });
  assert.equal(ld.width.value, 42);
  // structured data keep numbers (29.5), only the texts use the Czech comma
  assert.equal(artworkLd({ ...work, size_cm: [29.5, 40] }, site, { path: '/x/' }).width.value, 29.5);
  assert.equal(ld.height.unitCode, 'CMT');
  assert.equal(ld.dateCreated, '2026-09-26');
  assert.equal(ld.offers, undefined, 'not for sale: no offer');
  const onSale = artworkLd({ ...work, status: 'available', price: 2500 }, site, { path: '/x/' });
  assert.deepEqual(onSale.offers, { '@type': 'Offer', availability: 'https://schema.org/InStock', url: 'https://web.test/x/' });
  assert.doesNotMatch(JSON.stringify(onSale), /2500|price/i, 'the price never reaches search engines');
  assert.equal(artworkLd({ ...work, status: 'reserved' }, site, { path: '/x/' }).offers.availability, 'https://schema.org/LimitedAvailability');
  assert.equal(artworkLd({ ...work, status: 'sold' }, site, { path: '/x/' }).offers, undefined);
  assert.equal(artworkLd({ title: 'X' }, site, { path: '/x/' }).width, undefined, 'no size, no width');
});

test('personLd and websiteLd: one author node, her profiles elsewhere, the site in Czech', () => {
  const person = personLd(site, { image: 'https://web.test/p.jpg' });
  assert.equal(person['@id'], 'https://web.test/#autorka');
  assert.deepEqual(person.sameAs, ['https://www.instagram.com/pavla.k/'], 'an empty Fler address is left out');
  assert.equal(person.image, 'https://web.test/p.jpg');
  assert.equal(personLd(site).image, undefined);
  assert.equal(person.homeLocation, undefined, 'no place without site.location');
  assert.deepEqual(personLd({ ...site, location: 'Roztoky' }).homeLocation,
    { '@type': 'Place', name: 'Roztoky', address: { '@type': 'PostalAddress', addressLocality: 'Roztoky', addressCountry: 'CZ' } });
  const web = websiteLd(site);
  assert.equal(web.inLanguage, 'cs');
  assert.deepEqual(web.author, { '@id': person['@id'] });
});

test('collectionPageLd and breadcrumbLd: items in order with absolute addresses', () => {
  const page = collectionPageLd(site, { path: '/tvorba/', name: 'Tvorba', description: 'Vše.', items: [work, { ...work, title: 'Rano', key: 'rano-k3f9a' }], itemPath: (w) => `/tvorba/2026/${w.key}/` });
  assert.equal(page.mainEntity.numberOfItems, 2);
  assert.deepEqual(page.mainEntity.itemListElement[1], { '@type': 'ListItem', position: 2, url: 'https://web.test/tvorba/2026/rano-k3f9a/', name: 'Rano' });
  const crumbs = breadcrumbLd(site, [{ name: 'Úvod', path: '/' }, { name: 'Tvorba', path: '/tvorba/' }]);
  assert.deepEqual(crumbs.itemListElement.map((i) => [i.position, i.item]), [[1, 'https://web.test/'], [2, 'https://web.test/tvorba/']]);
});

test('graphLd and jsonLdText: one @graph, nothing for no nodes, "<" can never close the script element', () => {
  assert.equal(graphLd(), null);
  assert.equal(graphLd(null, undefined), null);
  const g = graphLd(websiteLd(site), [personLd(site)]);
  assert.equal(g['@context'], 'https://schema.org');
  assert.equal(g['@graph'].length, 2);
  const text = jsonLdText({ name: '</script><script>alert(1)</script>' });
  assert.doesNotMatch(text, /</);
  assert.equal(JSON.parse(text).name, '</script><script>alert(1)</script>');
});

test('verificationMeta and robotsTxt', () => {
  assert.deepEqual(verificationMeta({ google: 'g1', bing: '', seznam: 's1' }), [
    { name: 'google-site-verification', content: 'g1' }, { name: 'seznam-wmt', content: 's1' },
  ]);
  assert.deepEqual(verificationMeta(undefined), []);
  assert.equal(robotsTxt({ url: 'https://web.test/' }), 'User-agent: *\nAllow: /\n\nSitemap: https://web.test/sitemap.xml\n');
});
