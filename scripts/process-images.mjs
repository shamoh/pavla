#!/usr/bin/env node
// Obrázková pipeline: z jedné master fotky každého díla vyrobí
//   public/works/<slug>/<šířka>.{avif,webp,jpg}   → web (commitnout)
//   export/instagram/<slug>-clean.jpg              → Instagram, čistá verze 4:5
//   export/instagram/<slug>-wall.jpg               → Instagram, obraz v rámu na stěně (ve správném měřítku)
//   export/fler/<slug>.jpg                          → Fler, s vodoznakem (jméno autorky)
//
// Použití:  npm run images            (zpracuje jen díla, jejichž výstupy chybí nebo jsou starší než master)
//           npm run images -- --force (přegeneruje vše)
//           npm run images -- <slug>  (jen jedno dílo)

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import YAML from 'yaml';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const config = YAML.parse(await fs.readFile(path.join(root, 'site.config.yaml'), 'utf8'));
const img = config.images;
const mastersDir = path.resolve(root, process.env.MASTERS_DIR || img.mastersDir);
const worksDir = path.join(root, 'content/works');
const webOut = path.join(root, 'public/works');
const exportOut = path.join(root, 'export');

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

const exists = (p) => fs.access(p).then(() => true, () => false);
const mtime = (p) => fs.stat(p).then((s) => s.mtimeMs, () => 0);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function findMaster(slug) {
  for (const ext of ['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp']) {
    const p = path.join(mastersDir, `${slug}.${ext}`);
    if (await exists(p)) return p;
  }
  return null;
}

// Master načteme jednou: převod do sRGB, otočení podle EXIF. Metadata (EXIF, GPS) se do výstupů nepropisují.
async function loadMaster(file) {
  const buf = await sharp(file).rotate().toColorspace('srgb').toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, width: meta.width, height: meta.height };
}

async function web(slug, m) {
  const dir = path.join(webOut, slug);
  await fs.mkdir(dir, { recursive: true });
  // Nikdy nezvětšujeme: menší master dostane navíc variantu ve své plné šířce.
  const fit = img.web.widths.filter((w) => w <= m.width);
  const unique = fit.length === img.web.widths.length ? fit : [...fit, m.width];
  for (const w of unique) {
    const base = sharp(m.buf).resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: img.web.quality - 22, effort: 5 }).toFile(path.join(dir, `${w}.avif`));
    await base.clone().webp({ quality: img.web.quality }).toFile(path.join(dir, `${w}.webp`));
    await base.clone().jpeg({ quality: img.web.quality, mozjpeg: true, progressive: true }).toFile(path.join(dir, `${w}.jpg`));
  }
  // Rozměry a barva pro placeholder při načítání — čte je web.
  const { dominant } = await sharp(m.buf).stats();
  const info = { width: m.width, height: m.height, widths: unique, dominant: `rgb(${dominant.r},${dominant.g},${dominant.b})` };
  await fs.writeFile(path.join(dir, 'info.json'), JSON.stringify(info, null, 2));
}

async function instagramClean(slug, m) {
  const { width: W, height: H, background, padding } = img.instagram;
  const pad = Math.round(W * padding);
  const inner = await sharp(m.buf).resize({ width: W - 2 * pad, height: H - 2 * pad, fit: 'inside' }).toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background } })
    .composite([{ input: inner, gravity: 'center' }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(exportOut, 'instagram', `${slug}-clean.jpg`));
}

// Obraz v rámu s paspartou na stěně. Velikost rámu se počítá z reálných cm,
// aby mockup nezkresloval skutečnou velikost díla.
async function instagramWall(slug, m, work) {
  const { width: W, height: H } = img.instagram;
  const mk = img.mockup;
  const [wCm, hCm] = work.size_cm || [30, 40];
  const pxPerCm = W / mk.wallWidthCm;
  const artW = Math.round(wCm * pxPerCm);
  const artH = Math.round(hCm * pxPerCm);
  const mat = Math.round(mk.matCm * pxPerCm);
  const frame = Math.max(3, Math.round(mk.frameCm * pxPerCm));
  const outerW = artW + 2 * (mat + frame);
  const outerH = artH + 2 * (mat + frame);
  if (outerW > W * 0.95 || outerH > H * 0.9) {
    console.warn(`  ! ${slug}: dílo je na stěnu ${mk.wallWidthCm} cm velké — zvyš images.mockup.wallWidthCm`);
  }
  const left = Math.round((W - outerW) / 2);
  const top = Math.round(H * 0.42 - outerH / 2);

  const art = await sharp(m.buf).resize(artW, artH, { fit: 'cover' }).toBuffer();
  const framed = await sharp({ create: { width: outerW, height: outerH, channels: 3, background: mk.frameColor } })
    .composite([
      { input: { create: { width: outerW - 2 * frame, height: outerH - 2 * frame, channels: 3, background: mk.matColor } }, left: frame, top: frame },
      { input: art, left: frame + mat, top: frame + mat },
    ])
    .png()
    .toBuffer();

  // Stěna: jemný svislý přechod + měkký stín pod rámem (světlo shora).
  const wall = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${mk.wall}"/><stop offset="1" stop-color="${mk.wall}" stop-opacity="0.82"/>
      </linearGradient>
      <radialGradient id="light" cx="0.5" cy="0.15" r="0.9">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(frame * 2.2 + 6)}"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="#8a8173"/>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#light)"/>
    <rect x="${left + 4}" y="${top + frame * 1.6 + 8}" width="${outerW}" height="${outerH}" fill="#000" opacity="0.28" filter="url(#blur)"/>
  </svg>`);

  await sharp(wall)
    .composite([{ input: framed, left, top }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(path.join(exportOut, 'instagram', `${slug}-wall.jpg`));
}

async function fler(slug, m) {
  const f = img.fler;
  const resized = await sharp(m.buf).resize({ width: f.longEdge, height: f.longEdge, fit: 'inside', withoutEnlargement: true }).toBuffer();
  const { width, height } = await sharp(resized).metadata();
  const size = Math.round(Math.min(width, height) * 0.035);
  const margin = Math.round(size * 1.2);
  // Barvu signatury volíme podle jasu rohu, kam přijde: na světlém papíře tmavá, na tmavé malbě světlá.
  const cw = Math.round(width * 0.4), ch = Math.round(size * 2.5);
  const corner = await sharp(resized).extract({ left: width - cw, top: height - ch, width: cw, height: ch }).stats();
  const [r, g, b] = corner.channels.map((c) => c.mean);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  const [ink, halo] = light ? ['#3a3430', '#ffffff'] : ['#ffffff', '#000000'];
  // Diskrétní signatura v pravém dolním rohu, se slabým stínem, aby byla čitelná na světlém i tmavém.
  const mark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>text{font-family:'DejaVu Serif','Georgia',serif;font-style:italic;font-size:${size}px}</style>
    <text x="${width - margin + 1}" y="${height - margin + 1}" text-anchor="end" fill="${halo}" fill-opacity="${f.watermarkOpacity * 0.5}">${esc(f.watermark)}</text>
    <text x="${width - margin}" y="${height - margin}" text-anchor="end" fill="${ink}" fill-opacity="${f.watermarkOpacity}">${esc(f.watermark)}</text>
  </svg>`);
  await sharp(resized)
    .composite([{ input: mark }])
    .jpeg({ quality: f.quality, mozjpeg: true })
    .toFile(path.join(exportOut, 'fler', `${slug}.jpg`));
}

await fs.mkdir(path.join(exportOut, 'instagram'), { recursive: true });
await fs.mkdir(path.join(exportOut, 'fler'), { recursive: true });

const files = (await fs.readdir(worksDir)).filter((f) => f.endsWith('.yaml'));
let done = 0, skipped = 0, missing = [];
for (const file of files) {
  const slug = file.replace(/\.yaml$/, '');
  if (only.length && !only.includes(slug)) continue;
  const work = YAML.parse(await fs.readFile(path.join(worksDir, file), 'utf8'));
  const master = await findMaster(slug);
  if (!master) {
    // Bez masteru je v pořádku, pokud web výstupy už existují (typicky CI nebo jiný počítač).
    if (!(await exists(path.join(webOut, slug, 'info.json')))) missing.push(slug);
    continue;
  }
  const upToDate = (await mtime(path.join(webOut, slug, 'info.json'))) > (await mtime(master));
  if (upToDate && !force) { skipped++; continue; }
  console.log(`→ ${slug}`);
  const m = await loadMaster(master);
  await web(slug, m);
  await instagramClean(slug, m);
  await instagramWall(slug, m, work);
  await fler(slug, m);
  done++;
}
console.log(`Hotovo: ${done} zpracováno, ${skipped} beze změny.`);
if (missing.length) {
  console.error(`Chybí master fotka (hledám v ${mastersDir}): ${missing.join(', ')}`);
  process.exitCode = 1;
}
