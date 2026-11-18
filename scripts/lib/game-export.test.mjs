import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  GAME_EXPORT_WIDTH, LEVEL_COLOURS, detailExcluded, detailUses, gameDetailsSvg, gameExportFingerprint, gameIndexReadme, gameWorkReadme, renderGameDetails,
} from './game-export.mjs';
import { EXPORT_FILES } from './works.mjs';

const details = [
  { n: 1, level: 'easy', x: 0.3, y: 0.4, size: 0.24 },
  { n: 2, level: 'hard', x: 0.5, y: 0.5, size: 0.11 },
];
const areas = [{ x0: 0.48, y0: 0, x1: 0.52, y1: 1 }];

test('gameDetailsSvg: every detail with its number in the colour of its level, areas hatched, a touched detail crossed out', () => {
  const svg = gameDetailsSvg({ width: 1000, height: 750, details, areas });
  assert.match(svg, />1<\/text>/);
  assert.match(svg, />2<\/text>/);
  assert.ok(svg.includes(LEVEL_COLOURS.easy) && svg.includes(LEVEL_COLOURS.hard));
  assert.match(svg, /fill="url\(#hatch\)"/);
  assert.equal((svg.match(/stroke-dasharray/g) ?? []).length, 1, 'only detail 2 touches the area');
  assert.ok(svg.indexOf('>1</text>') < svg.indexOf('>2</text>'), 'the big easy one under the small hard one');
  assert.equal(detailExcluded(details[1], 0.75, areas), true);
  assert.equal(detailExcluded(details[0], 0.75, areas), false);
});

test('renderGameDetails: a JPEG at most GAME_EXPORT_WIDTH wide in the shape of the picture', async () => {
  const picture = await sharp({ create: { width: 2000, height: 1500, channels: 4, background: { r: 200, g: 180, b: 160, alpha: 1 } } }).webp().toBuffer();
  const meta = await sharp(await renderGameDetails(picture, { details, areas })).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', GAME_EXPORT_WIDTH, 1050]);
});

test('gameExportFingerprint: changes with the picture, the details and the areas', () => {
  const base = gameExportFingerprint(Buffer.from('a'), details, []);
  assert.equal(base, gameExportFingerprint(Buffer.from('a'), details, []));
  assert.notEqual(base, gameExportFingerprint(Buffer.from('b'), details, []));
  assert.notEqual(base, gameExportFingerprint(Buffer.from('a'), details.slice(1), []));
  assert.notEqual(base, gameExportFingerprint(Buffer.from('a'), details, areas));
});

test('detailUses: the days of each detail of a work, by date', () => {
  const days = {
    3: { date: '2026-11-04', easy: { targetId: 'a', detail: 1 }, hard: { targetId: 'b', detail: 1 } },
    1: { date: '2026-11-02', easy: { targetId: 'a', detail: 1 }, medium: { targetId: 'a', detail: 2 } },
  };
  assert.deepEqual(detailUses(days, 'a'), {
    1: [{ date: '2026-11-02', level: 'easy' }, { date: '2026-11-04', level: 'easy' }],
    2: [{ date: '2026-11-02', level: 'medium' }],
  });
});

test('gameWorkReadme: the picture, the legend, a row per detail (played, planned, kept out), the fingerprint', () => {
  const text = gameWorkReadme({
    title: 'Barbora III', code: 'rpxz5', pageUrl: 'https://x.test/tvorba/2026/barbora-lll-rpxz5/', image: 'detaily.jpg', details, ratio: 0.75, areas,
    uses: { 1: [{ date: '2026-11-17', level: 'easy' }, { date: '2026-11-25', level: 'easy' }] }, today: '2026-11-18', fingerprint: 'abc123',
  });
  assert.match(text, /^# Barbora III · `rpxz5`/);
  assert.match(text, /<img src="detaily\.jpg"/);
  assert.match(text, /Šrafovaná místa jsou vynechaná/);
  assert.match(text, /\| 1 \| Lehká \| 24 % \| 17\. 11\. 2026, 25\. 11\. 2026 \(plán\) \|/);
  assert.match(text, /\| 2 \| Těžká \| 11 % \| vynecháno \|/);
  assert.match(text, /<!-- otisk: abc123 -->/);
});

test('gameIndexReadme: works by collection with their facts, then the works out of the game', () => {
  const text = gameIndexReadme([
    { title: 'Bez kolekce', code: 'a', folder: 'bez', collection: '', image: 'detaily.jpg', count: 3, excluded: 0, played: 0 },
    { title: 'Barbora III', code: 'b', folder: '2026-ostatni/barbora', collection: 'Ostatní', image: 'detaily.jpg', count: 22, skips: 1, outside: 0, excluded: 2, played: 3 },
    { title: 'Moldoveanu', code: 'm', folder: '2026-ostatni/moldoveanu', collection: 'Ostatní', image: 'detaily.jpg', count: 27, skips: 2, outside: 1, excluded: 0, played: 1 },
  ], [{ title: 'Akt', code: 'c', collection: 'Ostatní' }]);
  assert.ok(text.indexOf('## Ostatní') < text.indexOf('## Mimo kolekce'));
  assert.match(text, /22 výřezů · 1 vynechané místo · kvůli němu 2 vynechané výřezy · ve hře 3×/);
  assert.match(text, /27 výřezů · 2 vynechaná místa \(1 mimo obrázek\) · ve hře 1×/);
  assert.match(text, /3 výřezy · zatím ve hře nebyl/);
  assert.match(text, /Ve hře: 3 obrazy\./);
  assert.match(text, /## Mimo hru[\s\S]*- Akt `c` \(Ostatní\)/);
  assert.ok(EXPORT_FILES['detail-dne'].test('detaily.jpg') && EXPORT_FILES['detail-dne'].test('README.md'));
});

test('rulerStep and rulerSvg: a round step, labels in the pixels of the photo from the offset of the picture, a grid across', async () => {
  const { rulerStep, rulerSvg } = await import('./game-export.mjs');
  assert.equal(rulerStep(1000), 50);
  assert.equal(rulerStep(4000), 200);
  assert.equal(rulerStep(9000), 500);
  const svg = rulerSvg({ width: 1000, height: 500, region: { offset: { left: 150, top: 0 }, width: 2000, height: 1000 } });
  assert.match(svg, />200<\/text>/, 'the first label is the first round pixel of the photo inside the picture');
  assert.doesNotMatch(svg, /y="13"[^>]*>100<\/text>/, 'cut off by the corners: not on the top ruler');
  assert.match(svg, /y="47.0"[^>]*>100<\/text>/, 'the left ruler from the top of the photo');
  assert.match(svg, />2100<\/text>/);
  assert.match(svg, /stroke-dasharray="4 6"/);
  assert.match(gameDetailsSvg({ width: 1000, height: 500, details, region: { offset: { left: 0, top: 0 }, width: 2000, height: 1000 } }), />1000<\/text>/);
});

test('writeGameExport: a folder per work with its picture and README, the README of all, drawn again only on a change, stale folders go', async () => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { writeGameExport } = await import('./game-export.mjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'game-export-'));
  const siteDir = path.join(root, 'site');
  const exportRoot = path.join(root, 'export');
  const web = path.join(siteDir, 'public/tvorba/2026/rano-k3f9a');
  await fs.mkdir(web, { recursive: true });
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ccbbaa' } }).webp().toFile(path.join(web, '480.webp'));
  await fs.writeFile(path.join(web, 'info.json'), JSON.stringify({ width: 800, height: 600, widths: [480] }));
  const master = path.join(root, 'rano.jpg');
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ccbbaa' } }).jpeg().toFile(master);
  const works = [
    { id: 'k3f9a', slug: 'rano', year: '2026', yamlPath: 'tvorba/plener/rano.yaml', collection: 'plener', masterPath: master, data: { id: 'k3f9a', title: 'Ráno', meta_game_skip: [[384, 0, 32, 600]] } },
    { id: 'd3e4f', slug: 'akt', year: '2026', yamlPath: 'tvorba/akt.yaml', collection: '', masterPath: master, data: { id: 'd3e4f', title: 'Akt' } },
    { id: 'g5h6i', slug: 'draft', year: '2026', yamlPath: 'tvorba/draft.yaml', collection: '', masterPath: master, data: { id: 'g5h6i', title: 'Rozpracované', meta_draft: true } },
  ];
  const plan = { details: { k3f9a: details }, days: { 1: { date: '2026-11-02', easy: { targetId: 'k3f9a', detail: 1 } } } };
  await fs.mkdir(path.join(exportRoot, 'detail-dne/stare'), { recursive: true });
  await fs.writeFile(path.join(exportRoot, 'detail-dne/stare/detaily.jpg'), 'x');
  const drawn = [];
  const args = { works, exclusions: { d3e4f: false, k3f9a: { areas, ratio: 0.75 } }, plan, collectionTitles: new Map([['plener', 'Plenér']]), siteDir, exportRoot, edges: {}, log: (l) => drawn.push(l), today: '2026-11-18' };
  const removed = await writeGameExport(args);
  assert.deepEqual(removed, ['export/detail-dne/stare/detaily.jpg']);
  assert.equal(drawn.length, 1);
  const readme = await fs.readFile(path.join(exportRoot, 'detail-dne/plener/rano/README.md'), 'utf8');
  assert.match(readme, /\| 1 \| Lehká \| 24 % \| 2\. 11\. 2026 \|/);
  assert.match(readme, /Měřítko nahoře a vlevo/);
  const index = await fs.readFile(path.join(exportRoot, 'detail-dne/README.md'), 'utf8');
  assert.match(index, /## Plenér[\s\S]*Ráno[\s\S]*1 vynechané místo · kvůli němu 1 vynechaný výřez[\s\S]*## Mimo hru[\s\S]*Akt/);
  assert.doesNotMatch(index, /Rozpracované/);
  await writeGameExport(args);
  assert.equal(drawn.length, 1, 'nothing changed: not drawn again');
  await writeGameExport({ ...args, exclusions: { d3e4f: false } });
  assert.equal(drawn.length, 2, 'the excluded places changed: drawn again');
  await fs.rm(root, { recursive: true, force: true });
});
