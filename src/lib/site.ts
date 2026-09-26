import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { parseWorkKey } from '../../scripts/lib/works.mjs';

const root = process.cwd();

export const config = YAML.parse(fs.readFileSync(path.join(root, 'site.config.yaml'), 'utf8'));
export const site = config.site as {
  url: string; title: string; tagline: string; author: string;
  email: string; instagram: string; fler: string;
};

export type Status = 'available' | 'reserved' | 'sold' | 'not-for-sale';

/** A generated responsive image: <width>.{avif,webp,jpg} for each of `widths`. */
export interface ImageSet { width: number; height: number; widths: number[]; dominant: string }
export interface Mockup extends ImageSet { scene: string; label: string }
export interface Photo extends ImageSet { alt: string; caption: string }

export interface Work {
  id: string;
  slug: string;
  /** "<slug>-<id>", used in URLs and folder names. */
  key: string;
  title: string;
  date: Date;
  year: number;
  technique: string;
  support?: string;
  size_cm?: [number, number];
  tags: string[];
  status: Status;
  price?: number;
  fler?: string;
  featured?: boolean;
  description?: string;
  image: ImageSet & { mockups?: Mockup[] };
}

export const statusLabel: Record<Status, string> = {
  available: 'K prodeji',
  reserved: 'Rezervováno',
  sold: 'Prodáno',
  'not-for-sale': 'Není na prodej',
};

let cache: Work[] | null = null;

/**
 * All published works (with generated images, not drafts), newest first.
 * Layout: content/works/<year>/<slug>-<id>.yaml and public/works/<year>/<slug>-<id>/info.json.
 */
export function getWorks(): Work[] {
  if (cache) return cache;
  const dir = path.join(root, 'content/works');
  const works: Work[] = [];
  const years = fs.existsSync(dir) ? fs.readdirSync(dir).filter((y) => /^\d{4}$/.test(y)) : [];
  for (const year of years) {
    for (const file of fs.readdirSync(path.join(dir, year)).filter((f) => f.endsWith('.yaml'))) {
      const key = file.replace(/\.yaml$/, '');
      const parsed = parseWorkKey(key);
      if (!parsed) {
        console.warn(`[works] ${year}/${file}: file name is not "<slug>-<id>.yaml", skipped`);
        continue;
      }
      const data = YAML.parse(fs.readFileSync(path.join(dir, year, file), 'utf8'));
      if (data.id !== parsed.id) {
        console.warn(`[works] ${year}/${file}: id in file (${data.id}) does not match file name, skipped`);
        continue;
      }
      if (data.draft) continue;
      const infoPath = path.join(root, 'public/works', year, key, 'info.json');
      if (!fs.existsSync(infoPath)) {
        console.warn(`[works] ${year}/${key}: images missing, run "npm run images", skipped`);
        continue;
      }
      works.push({
        ...data,
        id: parsed.id,
        slug: parsed.slug,
        key,
        date: new Date(data.date),
        year: Number(year),
        tags: data.tags ?? [],
        status: data.status ?? 'not-for-sale',
        image: JSON.parse(fs.readFileSync(infoPath, 'utf8')),
      });
    }
  }
  cache = works.sort((a, b) => b.date.getTime() - a.date.getTime());
  return cache;
}

const photoCache = new Map<string, Photo | null>();

/** A photo from public/photos/<name>/ (source: pavla-content/fotky/), or null while it does not exist. */
export function getPhoto(name: string): Photo | null {
  if (!photoCache.has(name)) {
    const infoPath = path.join(root, 'public/photos', name, 'info.json');
    if (!fs.existsSync(infoPath)) console.warn(`[photos] ${name}: not found, add pavla-content/fotky/${name}.jpg and run "npm run images"`);
    photoCache.set(name, fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : null);
  }
  return photoCache.get(name)!;
}

/** Years that have at least one published work, newest first. */
export const getYears = () => [...new Set(getWorks().map((w) => w.year))].sort((a, b) => b - a);

export const formatSize = (s?: [number, number]) => (s ? `${s[0]} × ${s[1]} cm` : '');
export const formatPrice = (p?: number) =>
  p ? new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p) : '';
export const url = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;

/** Detail page of a work: /tvorba/<year>/<slug>-<id>/ */
export const workUrl = (w: Work) => url(`/tvorba/${w.year}/${w.key}/`);
/** Folder with the web images of a work (without base URL, for og:image etc.). */
export const workImagePath = (w: Work) => `/works/${w.year}/${w.key}`;
