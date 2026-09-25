import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const root = process.cwd();

export const config = YAML.parse(fs.readFileSync(path.join(root, 'site.config.yaml'), 'utf8'));
export const site = config.site as {
  url: string; title: string; tagline: string; author: string;
  email: string; instagram: string; fler: string;
};

export type Status = 'available' | 'reserved' | 'sold' | 'not-for-sale';

export interface Work {
  slug: string;
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
  image: { width: number; height: number; widths: number[]; dominant: string };
}

export const statusLabel: Record<Status, string> = {
  available: 'K prodeji',
  reserved: 'Rezervováno',
  sold: 'Prodáno',
  'not-for-sale': 'Není na prodej',
};

let cache: Work[] | null = null;

/** Všechna díla, která mají vygenerované obrázky, od nejnovějšího. */
export function getWorks(): Work[] {
  if (cache) return cache;
  const dir = path.join(root, 'content/works');
  const works: Work[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml'))) {
    const slug = file.replace(/\.yaml$/, '');
    const infoPath = path.join(root, 'public/works', slug, 'info.json');
    if (!fs.existsSync(infoPath)) {
      console.warn(`[works] ${slug}: chybí obrázky, spusť "npm run images" — dílo přeskočeno`);
      continue;
    }
    const data = YAML.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const date = new Date(data.date);
    works.push({
      slug,
      ...data,
      date,
      year: date.getFullYear(),
      tags: data.tags ?? [],
      status: data.status ?? 'not-for-sale',
      image: JSON.parse(fs.readFileSync(infoPath, 'utf8')),
    });
  }
  cache = works.sort((a, b) => b.date.getTime() - a.date.getTime());
  return cache;
}

export const formatSize = (s?: [number, number]) => (s ? `${s[0]} × ${s[1]} cm` : '');
export const formatPrice = (p?: number) =>
  p ? new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p) : '';
export const url = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;
