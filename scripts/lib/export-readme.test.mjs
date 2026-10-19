import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_EDGE, collectionIndexes, draftIndex, draftReadme, exportIndex, flerReadme, instagramReadme, noteMarks, readmeFingerprint } from './export-readme.mjs';

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
  assert.match(md, /## Příběh \(story\)\n\n.*nálepku „Odkaz“ s adresou níže/);
  assert.ok(md.includes('```text\nhttps://pavla.kramolis.cz/tvorba/2026/bobri-hraz-jujn2/?utm_source=instagram&utm_medium=social&utm_campaign=story\n```'),
    'the link of the sticker with UTM, ready to copy');
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
    work: { ...work, support: 'papír Arches', status: 'available', price: 2500, text: 'Ráno u hráze.' }, year: '2026',
    files: { original: ['original.jpg'], mockups: ['mockup-komoda.jpg'] },
  });
  assert.match(md, /^# Fler: Bobří hráz\n\nakvarel · 30 × 30 cm · 2026, papír Arches\.\n\nStav: \*\*na prodej\*\* · Cena: \*\*2\s500 Kč\*\*/);
  assert.ok(md.includes('```text\nRáno u hráze.\n```'));
  assert.ok(md.includes('<img src="original.jpg"') && md.includes('<img src="mockup-komoda.jpg"'));
  const plain = flerReadme({ work: { ...work, status: 'reserved', text: 'DOPLNIT' }, year: '2026', files: { original: ['original.jpg'], mockups: [] } });
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

test('exportIndex (Instagram): the story of a collection: frames by date, the link of every frame and of the collection', () => {
  const u = (p) => `https://pavla.kramolis.cz/${p}?utm_source=instagram&utm_medium=social&utm_campaign=story`;
  const e = (title, folder, date, collection = 'Plenér Šumava 2026') => ({
    title, folder, thumb: 'caption-papir.jpg', note: '', collection, url: '', story: 'story.jpg', date,
    storyUrl: u(`tvorba/2026/${folder.split('/').pop()}/`), collectionUrl: collection ? u('tvorba/kolekce/2026-plener-sumava/') : '',
  });
  const md = exportIndex('instagram', [
    e('Nad Modravou', '2026-plener-sumava/nad-modravou', '2026-07-24'),
    e('Bobří hráz', '2026-plener-sumava/bobri-hraz', '2026-07-22'),
    e('Malý princ', 'maly-princ', '2021-01-01', ''),
  ]);
  const story = md.slice(md.indexOf('### Příběh kolekce'));
  assert.equal((md.match(/### Příběh kolekce/g) ?? []).length, 1, 'only for a collection');
  assert.ok(story.indexOf('bobri-hraz/story.jpg') < story.indexOf('nad-modravou/story.jpg'), 'frames by date');
  assert.ok(story.includes('1. Bobří hráz\n\n```text\n' + u('tvorba/2026/bobri-hraz/') + '\n```'));
  assert.ok(story.includes('2. Nad Modravou'));
  assert.ok(story.includes('Odkaz na celou kolekci') && story.includes(u('tvorba/kolekce/2026-plener-sumava/')));
  assert.ok(!exportIndex('fler', [{ ...e('A', 'k/a', '2026-01-01') }]).includes('Příběh kolekce'), 'not on Fler');
});

test('instagramReadme: the grid with its preview, the tiles in rows of three and the posts in the order of publishing', () => {
  const md = instagramReadme({
    work, year: '2026', post: 'x', files: {
      captions: [], scenes: [], details: [],
      grid: { tiles: ['grid-06-1_1.jpg', 'grid-05-1_2.jpg', 'grid-04-1_3.jpg', 'grid-03-2_1.jpg', 'grid-02-2_2.jpg', 'grid-01-2_3.jpg'], preview: 'grid-preview.jpg',
        cols: 3, posts: [{ file: 'grid-01-2_3.jpg', text: 'díl 1/6\n' }, { file: 'grid-06-1_1.jpg', text: 'celý text\n' }] },
    },
  });
  assert.ok(md.includes('## Mřížka na profilu (3 × 2)') && md.includes('<img src="grid-preview.jpg" width="360"'));
  assert.ok(md.includes('grid-04-1_3.jpg" width="120" alt="grid-04-1_3.jpg"></a>\n<br>\n<a href="grid-03-2_1.jpg"'), 'rows of three');
  assert.ok(md.includes('**Zveřejňuj pozpátku**'));
  assert.ok(md.indexOf('1. `grid-01-2_3.jpg`') < md.indexOf('2. `grid-06-1_1.jpg`') && md.includes('```text\ncelý text\n```'));
});

const draftFiles = { backgrounds: 'backgrounds.jpg', cut: 'cut.jpg', frames: 'frames.jpg' };

test('draftReadme: title, facts, the three previews, the corners used and the fingerprint (not shown by GitHub)', () => {
  const text = draftReadme({
    work: { title: 'Ráno <u> rybníka', technique: 'akvarel', size_cm: [40, 30] }, year: '2026', files: draftFiles,
    corners: 'meta_corners:\n  photo: [400, 300]', collection: 'Plenér Šumava 2026', fingerprint: 'abc123',
  });
  assert.match(text, /^# Rozpracováno: Ráno &lt;u&gt; rybníka\n/);
  assert.ok(text.includes('akvarel · 40 × 30 cm · 2026') && text.includes('Kolekce: Plenér Šumava 2026'));
  assert.ok(text.includes(`${DRAFT_EDGE} px`) && text.includes('nahledy-orezu'));
  for (const f of Object.values(draftFiles)) assert.ok(text.includes(`<a href="${f}"><img src="${f}"`), f);
  assert.match(text, /```yaml\nmeta_corners:\n {2}photo: \[400, 300\]\n```/);
  assert.equal(readmeFingerprint(text), 'abc123');
  assert.equal(readmeFingerprint('# bez otisku'), null);
  assert.equal(readmeFingerprint(null), null);
});

test('draftReadme: without a collection, corners or fingerprint those lines are left out', () => {
  const text = draftReadme({ work: { title: 'X' }, year: '2026', files: draftFiles });
  assert.ok(!text.includes('Kolekce:') && !text.includes('```yaml') && !text.includes('otisk'));
});

test('draftReadme: the state of the description in the groups of the run summary, before the previews', () => {
  const notes = { errors: ['status: <xyz> neznámá'], review: [], advice: ['obraz nemá štítky', 'název končí tečkou'], todo: ['date'] };
  const text = draftReadme({ work: { title: 'X' }, year: '2026', files: draftFiles, notes });
  assert.match(text, /## Stav popisu\n\nTotéž, co[^\n]*\n\n### ✗ Chyby \(1\)\n\n[^\n]+\n\n- status: &lt;xyz&gt; neznámá\n\n### 💡 Doporučení \(2\)\n\n[^\n]+\n\n- obraz nemá štítky\n- název končí tečkou\n\n### ✎ Zbývá doplnit \(1\)\n\n[^\n]+\n\n- date\n/);
  assert.ok(!text.includes('Ke kontrole'), 'an empty group is left out');
  assert.ok(text.indexOf('## Stav popisu') < text.indexOf('## Na papíru webu'));
  const clean = draftReadme({ work: { title: 'X' }, year: '2026', files: draftFiles, notes: { errors: [], review: [], advice: [], todo: [] } });
  assert.match(clean, /## Stav popisu\n\nPoslední běh zpracování u tohoto obrazu nic nehlásí\.\n/);
  assert.ok(!draftReadme({ work: { title: 'X' }, year: '2026', files: draftFiles }).includes('Stav popisu'), 'without notes no section');
});

test('draftReadme: without previews (a draft with an error of its own) it says so instead of the images', () => {
  const text = draftReadme({ work: { title: 'X' }, year: '2026', files: null, notes: { errors: ['chyba'], review: [], advice: [], todo: [] } });
  assert.match(text, /Náhledy ořezu zatím nejsou/);
  assert.ok(!text.includes('<img') && !text.includes('## Ořez'));
});

test('draftReadme: a draft without previews says why (no photo, errors) and how it goes', () => {
  const at = (noPreviews) => draftReadme({ work: { title: 'X' }, year: '2026', files: null, noPreviews });
  assert.match(at('photo'), /## Náhledy ořezu\n\nFotka obrazu zatím chybí/);
  assert.match(at('errors'), /viz chyby výše/);
  assert.match(at(undefined), /viz chyby výše/);
  assert.match(at('photo'), /^# Rozpracováno: X\n\n2026\. Rozpracovaný obraz: až ho zveřejníš/);
  assert.ok(!at('photo').includes('nahledy-orezu'));
});

test('noteMarks: errors, review, advice and attributes to fill in as short counts; nothing = empty', () => {
  assert.equal(noteMarks({ errors: ['a'], review: [], advice: ['b', 'c', 'd'], todo: ['date', 'technique'] }), '✗ 1 · 💡 3 · ✎ 2');
  assert.equal(noteMarks({ errors: [], review: ['x', 'y'], advice: [], todo: [] }), '⚠ 2');
  assert.equal(noteMarks({ errors: [], review: [], advice: [], todo: [] }), '');
  assert.equal(noteMarks(null), '');
});

test('draftIndex: the marks of the state under the facts, a legend on top, "bez náhledu" without a preview', () => {
  const text = draftIndex([
    { title: 'Ráno', folder: 'rano', thumb: 'backgrounds.jpg', note: 'akvarel · 2026', collection: '', marks: '✗ 1 · 💡 3' },
    { title: 'Bez fotky', folder: 'bez-fotky', thumb: null, note: '2026', collection: '', marks: '' },
  ]);
  assert.match(text, /Značky stavu popisu[^\n]*✗ chyby, ⚠ ke kontrole, 💡 doporučení, ✎ zbývá doplnit/);
  assert.ok(text.includes('<b>Ráno</b></a><br>akvarel · 2026<br>✗ 1 · 💡 3</td>'));
  assert.ok(text.includes('<tr><td>bez náhledu</td><td><a href="bez-fotky/"><b>Bez fotky</b></a><br>2026</td></tr>'));
});

test('draftIndex: drafts grouped by collection, without one last; empty = "Zatím žádné."', () => {
  const text = draftIndex([
    { title: 'Bez kolekce', folder: 'bez', thumb: 'backgrounds.jpg', note: 'akvarel · 2026', collection: '' },
    { title: 'Ráno', folder: 'plener/rano', thumb: 'backgrounds.jpg', note: 'akvarel · 2026', collection: 'Plenér' },
  ]);
  assert.ok(text.startsWith('# Rozpracované obrazy\n') && text.includes('Celkem 2.'));
  assert.ok(text.indexOf('## Plenér') < text.indexOf('## Mimo kolekce'));
  assert.ok(text.includes('<a href="plener/rano/"><img src="plener/rano/backgrounds.jpg"'));
  assert.match(draftIndex([]), /Zatím žádné\.\n$/);
});

test('the code of the work (id) in the README of its Instagram and Fler folder and next to its title in the overviews', () => {
  const work = { id: 'mpugj', title: 'Jez', technique: 'akvarel', status: 'available', price: 2500 };
  const insta = instagramReadme({ work, year: '2026', files: { captions: [], scenes: [], details: [] }, post: 'text' });
  assert.ok(insta.includes('Kód obrazu: `mpugj`'));
  const fler = flerReadme({ work, year: '2026', files: { original: ['original.jpg'], mockups: [] } });
  assert.ok(fler.includes('Kód obrazu: `mpugj`'));
  // without an id (never on real data) no line
  assert.ok(!flerReadme({ work: { ...work, id: undefined }, year: '2026', files: { original: ['original.jpg'], mockups: [] } }).includes('Kód obrazu'));
  for (const platform of ['instagram', 'fler']) {
    const text = exportIndex(platform, [{ title: 'Jez', code: 'mpugj', folder: 'jez', thumb: 't.jpg', note: 'akvarel', collection: '', url: '' }]);
    assert.ok(text.includes('<b>Jez</b></a> <code>mpugj</code><br>akvarel'), platform);
  }
});

test('drafts: the code of the work in its README (with the collection) and next to its title in the overview', () => {
  const text = draftReadme({ work: { id: 'mpugj', title: 'Jez' }, year: '2026', files: draftFiles, collection: 'Plenér' });
  assert.ok(text.includes('\n\nKód obrazu: `mpugj`  \nKolekce: Plenér\n'));
  assert.ok(draftReadme({ work: { id: 'mpugj', title: 'Jez' }, year: '2026', files: draftFiles }).includes('\n\nKód obrazu: `mpugj`\n'));
  const index = draftIndex([{ title: 'Jez', code: 'mpugj', folder: 'jez', thumb: null, note: '2026', collection: '', marks: '' }]);
  assert.ok(index.includes('<b>Jez</b></a> <code>mpugj</code><br>2026</td>'));
});

test('collectionIndexes: the entries by the folder of their collection, folders relative to it, none without one', () => {
  const groups = collectionIndexes([
    { title: 'A', folder: 'plener/a', collection: 'Plenér' },
    { title: 'B', folder: 'b', collection: '' },
    { title: 'C', folder: 'olejomalby/c', collection: '' },
    { title: 'D', folder: 'plener/d', collection: 'Plenér' },
  ]);
  assert.deepEqual(groups.map((g) => [g.dir, g.title, g.entries.map((e) => e.folder)]), [
    ['olejomalby', 'olejomalby', ['c']],
    ['plener', 'Plenér', ['a', 'd']],
  ]);
});

test('exportIndex and draftIndex within a collection: its title in the heading, a link back, no group heading', () => {
  const entry = { title: 'Ráno', code: 'k3f9a', folder: 'rano', thumb: 't.jpg', note: 'akvarel', collection: 'Plenér', url: '' };
  const insta = exportIndex('instagram', [entry], { within: 'Plenér' });
  assert.ok(insta.startsWith('# Fotky pro Instagram: Plenér\n\n[← Všechny](../README.md)\n\nObrazy s'));
  assert.ok(!insta.includes('## Plenér') && insta.includes('<a href="rano/">'));
  const draft = draftIndex([{ ...entry, marks: '✎ 1' }], { within: 'Plenér' });
  assert.ok(draft.startsWith('# Rozpracované obrazy: Plenér\n\n[← Všechny](../README.md)\n'));
  assert.ok(!draft.includes('## Plenér') && draft.includes('✎ 1'));
  // the whole overview keeps its group headings and no link back
  assert.ok(exportIndex('fler', [entry]).includes('## Plenér') && !exportIndex('fler', [entry]).includes('Všechny'));
});

test('draftReadme: the four corners close up as a 2 × 2 table above the whole photo with its frames', () => {
  const files = { ...draftFiles, 'frames-tl': 'frames-tl.jpg', 'frames-tr': 'frames-tr.jpg', 'frames-br': 'frames-br.jpg', 'frames-bl': 'frames-bl.jpg' };
  const text = draftReadme({ work: { title: 'X' }, year: '2026', files });
  assert.match(text, /<table>\n<tr><td><a href="frames-tl\.jpg"><img src="frames-tl\.jpg" width="400"[^\n]*<td><a href="frames-tr\.jpg">[^\n]*<\/tr>\n<tr><td><a href="frames-bl\.jpg">[^\n]*<td><a href="frames-br\.jpg">[^\n]*<\/tr>\n<\/table>/);
  assert.ok(text.indexOf('<table>') < text.indexOf('src="frames.jpg"'), 'above the whole photo');
  assert.ok(!draftReadme({ work: { title: 'X' }, year: '2026', files: draftFiles }).includes('<table>'), 'none without them');
});


test('draftReadme: the texts formatted as they will look on the site, links to the site with its full address', () => {
  const text = draftReadme({
    work: { title: 'Ráno', id: 'a1b2c', text: 'Ráno **u jezu**.\n\nViz [kolekci](/tvorba/kolekce/x/).\n', description: 'Pro Google.', details: { mlha: '*Mlha*' } },
    year: '2026', files: null, siteUrl: 'https://pavla.example',
  });
  assert.match(text, /\n## Text na webu\n\n.*\n\nRáno \*\*u jezu\*\*\.\n\nViz \[kolekci\]\(https:\/\/pavla\.example\/tvorba\/kolekce\/x\/\)\.\n\nGoogle: Pro Google\.\n\ndetail mlha: \*Mlha\*\n/);
  assert.match(draftReadme({ work: { title: 'Ráno' }, year: '2026', files: null }), /\n## Text na webu\n\nObraz zatím nemá text/);
});
