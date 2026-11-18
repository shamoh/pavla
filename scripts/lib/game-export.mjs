// export/detail-dne/ of the content repository: for every work in the game Detail dne its picture with the details the game
// plans (the numbered places of the plan, game/detail-dne/details.json: a square with its number, coloured by level) and the
// places the author keeps out (meta_game_skip, hatched; a detail touching one crossed out), so the author can see what the
// game asks and where to exclude more. A README for each work (the details, when they were and will be in the game) and one
// for all of them; the works kept out of the game altogether are listed at the end. Drawn only when its inputs change
// (the fingerprint in the README of the work, like the cut previews of drafts). A ruler along the top and left edges and a
// faint grid give the pixels of the master photo (as meta_corners and meta_game_skip count them), so a place to keep out
// can be read off the picture. Written by the pipeline after the plan of the days, or alone by `npm run game-export`.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { SKIP_KEY, cropRect, touches } from './game-exclusions.mjs';
import { gameLevels } from './detail-game.mjs';
import { cutOut, masterSize, trimTransparent } from './corners.mjs';
import { cutsSheet } from './edges.mjs';
import { readmeFingerprint } from './export-readme.mjs';
import { EXPORT_FILES, exportFolder, isValidId, planFolderPrune, workKey } from './works.mjs';
import { workImageDir } from './site-images.mjs';

export const GAME_EXPORT_DIR = 'detail-dne';
export const GAME_EXPORT_IMAGE = 'detaily.jpg';
/** Bump when the drawing changes, so every picture is drawn again once. */
export const GAME_EXPORT_VERSION = 2;
/** The width of the drawn picture (px). */
export const GAME_EXPORT_WIDTH = 1400;
/** Colours of the levels in the drawing (the levels of the site: ok, accent, error of the paper palette). */
export const LEVEL_COLOURS = { easy: '#2f7d45', medium: '#2f6f8f', hard: '#b0422b' };
const EXCLUDED_COLOUR = '#c0182a';

/**
 * The fingerprint of the drawing of a work: its picture, its details, its excluded places and where the picture lies in the
 * photo (`region`, the pixels of the ruler; it follows meta_corners).
 */
export function gameExportFingerprint(pictureBytes, details, areas, region = null) {
  return crypto.createHash('sha1').update(String(GAME_EXPORT_VERSION)).update(pictureBytes)
    .update(JSON.stringify([details, areas, region])).digest('hex').slice(0, 16);
}

/**
 * Where the web picture of a work lies in its master photo, in the photo's pixels (after its EXIF rotation): `{ offset, width,
 * height }`. The whole photo, or the part kept by its corners (meta_corners: cut out and trimmed as the web images are).
 */
export async function photoRegion(masterPath, corners, edges) {
  const { width, height } = await masterSize(masterPath);
  if (!cutsSheet(corners)) return { offset: { left: 0, top: 0 }, width, height };
  const buf = await sharp(masterPath).rotate().toColorspace('srgb').toBuffer();
  const t = await trimTransparent(await cutOut(buf, corners, edges));
  return { offset: { left: t.left, top: t.top }, width: t.width, height: t.height };
}

/** A round step of the ruler for `span` px of the photo: about 10–20 labels along the longer side. */
export function rulerStep(span) {
  return [50, 100, 200, 250, 500, 1000, 2000].find((s) => span / s <= 20) ?? 5000;
}

/**
 * The ruler of a picture `width` × `height` px drawn from `region` of the photo: ticks and labels in the photo's pixels along the
 * top and left edges (on a light strip), and a faint grid across, every `rulerStep`.
 */
export function rulerSvg({ width, height, region }) {
  const step = rulerStep(Math.max(region.width, region.height));
  const sx = width / region.width;
  const sy = height / region.height;
  const font = Math.max(11, Math.round(width / 110));
  const band = font + 8;
  const lines = [];
  const labels = [];
  for (let v = Math.ceil(region.offset.left / step) * step; v <= region.offset.left + region.width; v += step) {
    const x = (v - region.offset.left) * sx;
    lines.push(`<line x1="${x.toFixed(1)}" y1="${band}" x2="${x.toFixed(1)}" y2="${height}" stroke="#000" stroke-opacity=".18" stroke-dasharray="4 6"/>`);
    labels.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${band}" stroke="#222"/><text x="${(x + 3).toFixed(1)}" y="${font + 2}" font-size="${font}" font-family="Helvetica, Arial, sans-serif" fill="#222">${v}</text>`);
  }
  for (let v = Math.ceil(region.offset.top / step) * step; v <= region.offset.top + region.height; v += step) {
    const y = (v - region.offset.top) * sy;
    if (y < band) continue;
    lines.push(`<line x1="${band}" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}" stroke="#000" stroke-opacity=".18" stroke-dasharray="4 6"/>`);
    labels.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${band}" y2="${y.toFixed(1)}" stroke="#222"/><text x="2" y="${(y - 3).toFixed(1)}" font-size="${font}" font-family="Helvetica, Arial, sans-serif" fill="#222">${v}</text>`);
  }
  return `${lines.join('')}<rect x="0" y="0" width="${width}" height="${band}" fill="#fff" fill-opacity=".8"/><rect x="0" y="${band}" width="${band}" height="${height - band}" fill="#fff" fill-opacity=".8"/>${labels.join('')}`;
}

/** Whether a detail (`{ x, y, size }`) touches one of the excluded `areas` of a picture of height / width `ratio`. */
export const detailExcluded = (detail, ratio, areas = []) => areas.some((a) => touches(cropRect(detail, ratio), a));

/**
 * The SVG drawn over a picture of `width` × `height` px: the excluded `areas` hatched (shares of the picture), the `details`
 * as squares in the colour of their level with their number in a label at the top left, a detail touching an area dashed
 * and crossed out. The biggest (easy) first, so the small ones stay on top.
 */
export function gameDetailsSvg({ width, height, details, areas = [], region = null }) {
  const ratio = height / width;
  const order = Object.fromEntries(gameLevels().map((l, i) => [l.id, i]));
  const px = (r) => ({ x: r.x0 * width, y: r.y0 * height, w: (r.x1 - r.x0) * width, h: (r.y1 - r.y0) * height });
  const font = Math.max(14, Math.round(width / 70));
  const hatch = areas.map((a) => {
    const r = px(a);
    return `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="url(#hatch)" stroke="${EXCLUDED_COLOUR}" stroke-width="3"/>`;
  }).join('');
  const squares = [...details].sort((a, b) => (order[a.level] ?? 0) - (order[b.level] ?? 0) || a.n - b.n).map((d) => {
    const r = px(cropRect(d, ratio));
    const colour = LEVEL_COLOURS[d.level] ?? '#333';
    const out = detailExcluded(d, ratio, areas);
    const label = String(d.n);
    const lw = font * (0.62 * label.length + 0.6);
    const cross = out ? `<path d="M${r.x} ${r.y}L${r.x + r.w} ${r.y + r.h}M${r.x + r.w} ${r.y}L${r.x} ${r.y + r.h}" stroke="${colour}" stroke-width="2" opacity=".8"/>` : '';
    return `<g opacity="${out ? 0.75 : 1}"><rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="none" stroke="#fff" stroke-width="5" opacity=".7"/>`
      + `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="none" stroke="${colour}" stroke-width="2.5"${out ? ' stroke-dasharray="8 6"' : ''}/>${cross}`
      + `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${lw.toFixed(1)}" height="${(font * 1.3).toFixed(1)}" fill="${colour}"/>`
      + `<text x="${(r.x + lw / 2).toFixed(1)}" y="${(r.y + font * 1.02).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="${font}" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="${EXCLUDED_COLOUR}" fill-opacity=".12"/><line x1="0" y1="0" x2="0" y2="14" stroke="${EXCLUDED_COLOUR}" stroke-width="4" stroke-opacity=".55"/></pattern></defs>${region ? rulerSvg({ width, height, region }) : ''}${hatch}${squares}</svg>`;
}

/** The picture of a work (`input`: its web picture) with its details and excluded places, `GAME_EXPORT_WIDTH` wide, as JPEG. */
export async function renderGameDetails(input, { details, areas = [], region = null, paper = '#f7f4ee' }) {
  const meta = await sharp(input).metadata();
  const width = Math.min(GAME_EXPORT_WIDTH, meta.width);
  const height = Math.round((meta.height * width) / meta.width);
  const base = await sharp(input).resize(width, height).flatten({ background: paper }).toBuffer();
  return sharp(base).composite([{ input: Buffer.from(gameDetailsSvg({ width, height, details, areas, region })) }]).jpeg({ quality: 82 }).toBuffer();
}

/** When each detail of a work was or will be in the game: detail number → [{ date, level }], from the planned `days`. */
export function detailUses(days, workId) {
  const uses = {};
  for (const entry of Object.values(days ?? {})) {
    for (const level of gameLevels()) {
      const p = entry?.[level.id];
      if (p?.targetId !== workId || !p.detail) continue;
      (uses[p.detail] ??= []).push({ date: entry.date, level: level.id });
    }
  }
  for (const list of Object.values(uses)) list.sort((a, b) => a.date.localeCompare(b.date));
  return uses;
}

const LEVEL_LABELS = Object.fromEntries(gameLevels().map((l) => [l.id, l.label]));
const czDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${y}`; };
/** Czech noun after a number: 1 výřez, 2–4 výřezy, 0 and 5+ výřezů. */
const count = (n, [one, few, many]) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
const esc = (s) => String(s ?? '').replace(/[|<>]/g, (c) => ({ '|': '\\|', '<': '&lt;', '>': '&gt;' })[c]);

/**
 * README of a work in export/detail-dne/: its title and page, the picture (`image`: its file name; null = not drawn yet),
 * the legend, and a table of its details (number, level, size, when in the game, kept out), `today` (YYYY-MM-DD) splits the
 * past from the planned; the fingerprint of the picture as a comment.
 */
export function gameWorkReadme({ title, code, pageUrl = '', image, details, uses = {}, ratio, areas = [], today, fingerprint = '' }) {
  const lines = [`# ${esc(title)}${code ? ` · \`${code}\`` : ''}`, ''];
  if (pageUrl) lines.push(`[Obraz na webu](${pageUrl})`, '');
  lines.push('Výřezy, které hra Detail dne z obrazu bere: čtverec s číslem, barva podle úrovně (zelená lehká, modrá střední, červená těžká).');
  if (areas.length) lines.push('Šrafovaná místa jsou vynechaná (`meta_game_skip`); přeškrtnuté výřezy do nich zasahují a hra je už nepoužije.');
  lines.push('Měřítko nahoře a vlevo a čárkovaná mřížka jsou v pixelech fotky v `tvorba/` (jako `meta_corners`): podle nich zapíšeš místo, které má hra vynechat, jako `[zleva, shora, šířka, výška]`.');
  lines.push('', image ? `<img src="${image}" width="100%" alt="${esc(title)}">` : '_Obrázek zatím není nakreslený._', '');
  lines.push('| Číslo | Úroveň | Velikost | Ve hře |', '|---|---|---|---|');
  for (const d of [...details].sort((a, b) => a.n - b.n)) {
    const out = detailExcluded(d, ratio, areas);
    const when = (uses[d.n] ?? []).map((u) => (u.date > today ? `${czDate(u.date)} (plán)` : czDate(u.date))).join(', ');
    lines.push(`| ${d.n} | ${LEVEL_LABELS[d.level] ?? d.level} | ${Math.round(d.size * 100)} % | ${out ? 'vynecháno' : when || '–'} |`);
  }
  if (fingerprint) lines.push('', `<!-- otisk: ${fingerprint} -->`);
  return `${lines.join('\n')}\n`;
}

/**
 * README of export/detail-dne/: every work in the game by collection (`entries`: { title, code, folder, collection, image,
 * count, skips (places written in meta_game_skip), outside (of them wholly outside the picture: cut off with the background),
 * excluded (details touching them), played }), then the works kept out of the game (`out`: { title, code, collection }).
 */
export function gameIndexReadme(entries, out = []) {
  const lines = ['# Detail dne: výřezy obrazů', '',
    'Pro každý obraz ve hře výřezy, které z něj hra bere (čtverec s číslem, barva podle úrovně), a vynechaná místa (šrafovaná,',
    '`meta_game_skip`). Místo, které výřez prozrazuje (kroužková vazba, páska), zapiš do popisu obrazu jako',
    '`meta_game_skip: [[zleva, shora, šířka, výška]]` v pixelech fotky (nejlíp v editoru `npm run corners`); celý obraz',
    'mimo hru: `meta_game: false`.',
    '', `Ve hře: ${count(entries.length, ['obraz', 'obrazy', 'obrazů'])}.`];
  const groups = new Map();
  for (const e of entries) {
    const key = e.collection || 'Mimo kolekce';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === 'Mimo kolekce') - (b === 'Mimo kolekce') || a.localeCompare(b, 'cs'));
  for (const key of keys) {
    lines.push('', `## ${esc(key)}`, '', '<table>');
    for (const e of groups.get(key)) {
      const thumb = e.image ? `<a href="${e.folder}/"><img src="${e.folder}/${e.image}" width="200" alt="${esc(e.title)}"></a>` : 'bez obrázku';
      const places = e.skips ? `${count(e.skips, ['vynechané místo', 'vynechaná místa', 'vynechaných míst'])}${e.outside ? ` (${e.outside} mimo obrázek)` : ''}` : '';
      const facts = [
        count(e.count, ['výřez', 'výřezy', 'výřezů']), places,
        e.excluded ? `kvůli ${e.skips === 1 ? 'němu' : 'nim'} ${count(e.excluded, ['vynechaný výřez', 'vynechané výřezy', 'vynechaných výřezů'])}` : '',
        e.played ? `ve hře ${e.played}×` : 'zatím ve hře nebyl',
      ].filter(Boolean).join(' · ');
      lines.push(`<tr><td>${thumb}</td><td><a href="${e.folder}/"><b>${esc(e.title)}</b></a>${e.code ? ` <code>${e.code}</code>` : ''}<br>${facts}</td></tr>`);
    }
    lines.push('</table>');
  }
  if (out.length) {
    lines.push('', '## Mimo hru', '', 'Obrazy s `meta_game: false`: hra je nepoužije ani jako hádanku, ani v nabídce.', '');
    for (const o of out) lines.push(`- ${esc(o.title)}${o.code ? ` \`${o.code}\`` : ''}${o.collection ? ` (${esc(o.collection)})` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

/** A text file written only when its content changes (git sees no change otherwise). */
async function writeIfChanged(file, text) {
  if ((await fs.readFile(file, 'utf8').catch(() => null)) === text) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
}

/** Every file under `root`, relative to it with '/', none for a missing folder. */
async function listFiles(root, rel = '') {
  const entries = await fs.readdir(path.join(root, rel), { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const e of entries) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) files.push(...await listFiles(root, p));
    else files.push(p);
  }
  return files;
}

/** Removes the empty folders under `root` (not `root` itself). */
async function removeEmptyDirs(root) {
  for (const e of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!e.isDirectory()) continue;
    const dir = path.join(root, e.name);
    await removeEmptyDirs(dir);
    if (!(await fs.readdir(dir)).length) await fs.rmdir(dir);
  }
}

/**
 * Writes export/detail-dne/ under `exportRoot`: for every published work of the game (`works`: { id, data, year, slug, yamlPath,
 * collection, masterPath }) with details in the plan (`plan.details`, `plan.days`) its picture (drawn again only when its
 * fingerprint changes), its README and the README of all; a work kept out (`exclusions[id] === false`) only in the list at the
 * end. `exclusions` = id → false | { areas } (contentExclusions), `collectionTitles` = collection folder → title, `siteDir` =
 * where the web pictures are (public/), `edges` = the edge settings of the cut (images.edges). Returns the files removed.
 */
export async function writeGameExport({ works, exclusions = {}, plan, collectionTitles = new Map(), siteDir, exportRoot, edges, siteUrl = '', log = () => {}, today = new Date().toISOString().slice(0, 10) }) {
  const gameRoot = path.join(exportRoot, GAME_EXPORT_DIR);
  const wanted = new Map([['', new Set(['README.md'])]]);
  const entries = [];
  const out = [];
  const exists = (p) => fs.access(p).then(() => true, () => false);
  for (const w of works) {
    if (w.data?.meta_draft === true || !w.year || !isValidId(w.id)) continue;
    const collection = collectionTitles.get(w.collection) ?? '';
    if (exclusions[w.id] === false) { out.push({ title: w.data.title, code: w.id, collection }); continue; }
    const details = plan.details?.[w.id];
    if (!details?.length || !w.masterPath) continue;
    const webDir = path.join(siteDir, 'public', workImageDir(w.year, workKey(w.slug, w.id)));
    const info = JSON.parse(await fs.readFile(path.join(webDir, 'info.json'), 'utf8').catch(() => 'null'));
    if (!info?.widths?.length) continue;
    const picture = path.join(webDir, `${info.widths.filter((x) => x <= 1600).at(-1) ?? Math.min(...info.widths)}.webp`);
    if (!(await exists(picture))) continue;
    const folder = exportFolder(w.yamlPath, w.slug);
    const dir = path.join(gameRoot, folder);
    const areas = exclusions[w.id]?.areas ?? [];
    const ratio = info.height / info.width;
    const fingerprint = gameExportFingerprint(await fs.readFile(picture), details, areas, [w.data.meta_corners ?? null, edges]);
    const readmePath = path.join(dir, 'README.md');
    const current = readmeFingerprint(await fs.readFile(readmePath, 'utf8').catch(() => ''));
    await fs.mkdir(dir, { recursive: true });
    if (current !== fingerprint || !(await exists(path.join(dir, GAME_EXPORT_IMAGE)))) {
      const region = await photoRegion(w.masterPath, w.data.meta_corners, edges);
      await fs.writeFile(path.join(dir, GAME_EXPORT_IMAGE), await renderGameDetails(picture, { details, areas, region }));
      log(`→ export/${GAME_EXPORT_DIR}/${folder}/: details of the game`);
    }
    const uses = detailUses(plan.days, w.id);
    const pageUrl = siteUrl ? `${siteUrl}/${workImageDir(w.year, workKey(w.slug, w.id))}/` : '';
    await writeIfChanged(readmePath, gameWorkReadme({ title: w.data.title, code: w.id, pageUrl, image: GAME_EXPORT_IMAGE, details, uses, ratio, areas, today, fingerprint }));
    wanted.set(folder, new Set([GAME_EXPORT_IMAGE, 'README.md']));
    entries.push({
      title: w.data.title, code: w.id, folder, collection, image: GAME_EXPORT_IMAGE, count: details.length,
      skips: Array.isArray(w.data[SKIP_KEY]) ? w.data[SKIP_KEY].length : 0,
      outside: Array.isArray(w.data[SKIP_KEY]) ? w.data[SKIP_KEY].length - areas.length : 0,
      excluded: details.filter((d) => detailExcluded(d, ratio, areas)).length,
      played: Object.values(uses).flat().filter((u) => u.date <= today).length,
    });
  }
  await writeIfChanged(path.join(gameRoot, 'README.md'), gameIndexReadme(entries, out));
  const removed = [];
  for (const rel of planFolderPrune(await listFiles(gameRoot), wanted, EXPORT_FILES[GAME_EXPORT_DIR])) {
    await fs.rm(path.join(gameRoot, rel));
    removed.push(`export/${GAME_EXPORT_DIR}/${rel}`);
  }
  await removeEmptyDirs(gameRoot);
  return removed;
}
