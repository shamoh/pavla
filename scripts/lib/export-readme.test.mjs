import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportIndex, flerReadme, instagramReadme } from './export-readme.mjs';

const work = { title: 'Bobří hráz', technique: 'akvarel', size_cm: [30, 30] };

test('instagramReadme: every photo as a linked thumbnail and the text of the post in a block', () => {
  const md = instagramReadme({
    work, year: '2026', post: 'Bobří hráz\n\n#akvarel\n',
    files: { captions: ['caption-papir.jpg', 'caption-noc.jpg'], scenes: ['scene-stojan.jpg'], details: [] },
  });
  assert.match(md, /^# Instagram: Bobří hráz\n\nakvarel · 30 × 30 cm · 2026\./);
  for (const f of ['caption-papir.jpg', 'caption-noc.jpg', 'scene-stojan.jpg']) assert.ok(md.includes(`<a href="${f}"><img src="${f}" width="260"`), f);
  assert.ok(md.includes('## Ve scénách ateliéru') && !md.includes('## Detaily'));
  assert.ok(md.includes('```text\nBobří hráz\n\n#akvarel\n```'));
  assert.ok(md.indexOf('## Text příspěvku') < md.indexOf('## S popiskem'), 'the text first');
});

test('instagramReadme: the panorama in order after the captions, the story with the link for the sticker', () => {
  const md = instagramReadme({
    work, year: '2026', post: 'x', pageUrl: 'https://pavla.kramolis.cz/tvorba/2026/bobri-hraz-jujn2/',
    files: { captions: ['caption-papir.jpg'], scenes: ['scene-stojan.jpg'], panorama: ['pano-1.jpg', 'pano-2.jpg'], story: 'story.jpg', details: [] },
  });
  assert.ok(md.includes('## Panorama pro karusel') && md.includes('přes 2 navazující snímky'));
  assert.ok(md.indexOf('## S popiskem') < md.indexOf('## Panorama') && md.indexOf('## Panorama') < md.indexOf('## Ve scénách'));
  assert.ok(md.indexOf('pano-1.jpg') < md.indexOf('pano-2.jpg'));
  assert.match(md, /## Příběh \(story\)\n\n.*nálepku „Odkaz“ s adresou <https:\/\/pavla\.kramolis\.cz\/tvorba\/2026\/bobri-hraz-jujn2\/>/);
  assert.ok(md.includes('<img src="story.jpg"'));
  const none = instagramReadme({ work, year: '2026', post: 'x', files: { captions: [], scenes: [], details: [] } });
  assert.ok(!none.includes('## Panorama') && !none.includes('## Příběh'), 'only what the work has');
});

test('instagramReadme: a post with ``` gets a longer fence; a title with < is escaped', () => {
  const md = instagramReadme({ work: { title: 'A <b>' }, year: '2026', post: 'x ``` y', files: { captions: [], scenes: [], details: ['detail-a.jpg'] } });
  assert.ok(md.includes('````text\nx ``` y\n````'));
  assert.ok(md.includes('# Instagram: A &lt;b&gt;'));
  assert.ok(md.includes('## Detaily'));
});

test('flerReadme: facts, status and price, description to copy, original and mockups', () => {
  const md = flerReadme({
    work: { ...work, support: 'papír Arches', status: 'available', price: 2500, description: 'Ráno u hráze.' }, year: '2026',
    files: { original: ['original.jpg'], mockups: ['mockup-komoda.jpg'] },
  });
  assert.match(md, /^# Fler: Bobří hráz\n\nakvarel · 30 × 30 cm · 2026, papír Arches\.\n\nStav: \*\*na prodej\*\* · Cena: \*\*2\s500 Kč\*\*/);
  assert.ok(md.includes('```text\nRáno u hráze.\n```'));
  assert.ok(md.includes('<img src="original.jpg"') && md.includes('<img src="mockup-komoda.jpg"'));
  const plain = flerReadme({ work: { ...work, status: 'reserved', description: 'DOPLNIT' }, year: '2026', files: { original: ['original.jpg'], mockups: [] } });
  assert.ok(plain.includes('Stav: **rezervováno**') && !plain.includes('## Popis') && !plain.includes('## Mockupy'));
});

test('exportIndex: a row per work with a thumbnail linking to its folder, grouped by collection, with its state', () => {
  const md = exportIndex('instagram', [
    { title: 'Bobří hráz', folder: '2026-plener-sumava/bobri-hraz', thumb: 'caption-papir.jpg', note: 'akvarel', collection: 'Plenér Šumava 2026', url: 'https://www.instagram.com/p/x/' },
    { title: 'Malý princ', folder: 'maly-princ', thumb: 'caption-papir.jpg', note: 'akvarel', collection: '', url: '' },
    { title: 'Jez', folder: '2026-plener-steken/jez', thumb: 'caption-papir.jpg', note: 'akvarel', collection: 'Plenér Štěkeň jaro 2026', url: '' },
  ]);
  assert.match(md, /^# Fotky pro Instagram/);
  assert.ok(md.includes('Celkem 3, z toho na Instagramu 1, zatím nezveřejněno 2.'));
  const at = (h) => md.indexOf(h);
  // Czech order: Štěkeň (t) before Šumava (u); the works without a collection last
  assert.ok(at('## Plenér Štěkeň jaro 2026') < at('## Plenér Šumava 2026') && at('## Plenér Šumava 2026') < at('## Mimo kolekce'), 'alphabetical, no collection last');
  assert.ok(md.includes('✓ <a href="https://www.instagram.com/p/x/">na Instagramu</a>') && md.includes('○ zatím nezveřejněno'));
  assert.ok(md.includes('<a href="2026-plener-sumava/bobri-hraz/"><img src="2026-plener-sumava/bobri-hraz/caption-papir.jpg" width="120"'));
  assert.match(exportIndex('fler', []), /^# Fotky pro Fler[\s\S]*Zatím žádné\.\n$/);
});

test('the READMEs of a work name its collection and link its page on the site', () => {
  const about = { collection: 'Plenér Šumava 2026', pageUrl: 'https://pavla.kramolis.cz/tvorba/2026/bobri-hraz-jujn2/' };
  for (const md of [
    instagramReadme({ work, year: '2026', post: 'x', files: { captions: [], scenes: [], details: [] }, ...about }),
    flerReadme({ work: { ...work, status: 'available', price: 900 }, year: '2026', files: { original: ['original.jpg'], mockups: [] }, ...about }),
  ]) {
    assert.ok(md.includes('Kolekce: Plenér Šumava 2026  \nNa webu: <https://pavla.kramolis.cz/tvorba/2026/bobri-hraz-jujn2/>'));
  }
  assert.ok(!instagramReadme({ work, year: '2026', post: 'x', files: { captions: [], scenes: [], details: [] } }).includes('Na webu'));
});

test('the READMEs of a work say whether it is on Instagram and on Fler yet', () => {
  const insta = (extra) => instagramReadme({ work: { ...work, ...extra }, year: '2026', post: 'x', files: { captions: [], scenes: [], details: [] } });
  assert.ok(insta({ instagram: 'https://www.instagram.com/p/x/' }).includes('Na Instagramu: <https://www.instagram.com/p/x/>'));
  assert.ok(insta({}).includes('Na Instagramu: zatím nezveřejněno (odkaz doplň do popisu obrazu jako `instagram:`)'));
  const fler = (extra) => flerReadme({ work: { ...work, status: 'available', price: 900, ...extra }, year: '2026', files: { original: ['original.jpg'], mockups: [] } });
  assert.ok(fler({ fler: 'https://www.fler.cz/zbozi/x' }).includes('Na Fleru: <https://www.fler.cz/zbozi/x>'));
  assert.ok(fler({ fler: '' }).includes('Na Fleru: zatím nepřidáno (odkaz doplň do popisu obrazu jako `fler:`)'));
});
