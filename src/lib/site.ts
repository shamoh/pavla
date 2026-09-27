import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { detailKey, parseWorkKey } from '../../scripts/lib/works.mjs';
import { parseCoverRef } from '../../scripts/lib/collections.mjs';

const root = process.cwd();
// Generated data (content/ and public/): this repo for the real site, .demo/site for the test data (npm run demo).
const dataRoot = process.env.SITE_DATA_DIR ? path.resolve(root, process.env.SITE_DATA_DIR) : root;

export const config = YAML.parse(fs.readFileSync(path.join(root, 'site.config.yaml'), 'utf8'));
export const site = config.site as {
  url: string; title: string; tagline: string; author: string;
  email: string; instagram: string; fler: string;
};

export type Status = 'available' | 'reserved' | 'sold' | 'not-for-sale';

/** A generated responsive image: <width>.{avif,webp,jpg} for each of `widths`. */
export interface ImageSet { width: number; height: number; widths: number[]; dominant: string }
export interface Mockup extends ImageSet { scene: string; label: string }
export interface Photo extends ImageSet {
  alt: string;
  caption: string;
  /** Point kept in view when a page crops the photo: [x, y] in % from the left and top edge. */
  focus?: [number, number];
}
export interface Detail extends ImageSet { name: string }

/** Image for link previews (og:image) with its dimensions, so social networks can show it right away. */
export interface ShareImage { src: string; width: number; height: number }

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
  /** Captions of detail photos: "<detail photo name>: <caption>" (keys match via detailKey). */
  details?: Record<string, string>;
  /** Slug of the collection (content/collections/<slug>.yaml), if the work belongs to one. */
  collection?: string;
  description?: string;
  /** og: share image og.jpg in the work's folder (the whole work on paper, 3:2). */
  image: ImageSet & { mockups?: Mockup[]; details?: Detail[]; og?: { width: number; height: number } };
}

export interface Collection {
  slug: string;
  title: string;
  description?: string;
  /** Cover photo from public/collections/<slug>/, if the collection has one. */
  cover: (ImageSet & { alt: string }) | null;
  /** The work shown as cover when there is no cover photo: `cover: <id>` from the YAML, otherwise the newest work. */
  coverWork: Work;
  /** Detail photo of coverWork shown instead of the whole work (`cover: <id>#<detail>`). */
  coverDetail?: Detail;
  /** Point kept in view when the cover is cropped: [x, y] in % from the left and top edge. */
  focus: [number, number];
  /** Published works of the collection, newest first. */
  works: Work[];
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
  const dir = path.join(dataRoot, 'content/works');
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
      const infoPath = path.join(dataRoot, 'public/works', year, key, 'info.json');
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
        collection: data.collection || undefined,
        status: data.status ?? 'not-for-sale',
        image: JSON.parse(fs.readFileSync(infoPath, 'utf8')),
      });
    }
  }
  cache = works.sort((a, b) => b.date.getTime() - a.date.getTime());
  return cache;
}

let collectionCache: Collection[] | null = null;

/**
 * Collections with at least one published work, the one with the newest work first.
 * Layout: content/collections/<slug>.yaml and public/collections/<slug>/info.json (cover photo).
 */
export function getCollections(): Collection[] {
  if (collectionCache) return collectionCache;
  const dir = path.join(dataRoot, 'content/collections');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')) : [];
  const works = getWorks();
  const collections: Collection[] = [];
  for (const file of files) {
    const slug = file.replace(/\.yaml$/, '');
    const data = YAML.parse(fs.readFileSync(path.join(dir, file), 'utf8')) ?? {};
    const members = works.filter((w) => w.collection === slug);
    if (!members.length) continue;
    const coverPath = path.join(dataRoot, 'public/collections', slug, 'info.json');
    const cover = fs.existsSync(coverPath) ? JSON.parse(fs.readFileSync(coverPath, 'utf8')) : null;
    const ref = data.cover ? parseCoverRef(data.cover) : null;
    const coverWork = members.find((w) => w.id === ref?.id) ?? members[0];
    const coverDetail = ref?.detail ? coverWork.image.details?.find((d) => d.name === ref.detail) : undefined;
    const focus: [number, number] = Array.isArray(data.focus) && data.focus.length === 2 ? data.focus : [50, 50];
    collections.push({ slug, title: data.title ?? slug, description: data.description, cover, coverWork, coverDetail, focus, works: members });
  }
  collectionCache = collections.sort((a, b) => b.works[0].date.getTime() - a.works[0].date.getTime());
  return collectionCache;
}

export const getCollection = (slug?: string) => (slug ? getCollections().find((c) => c.slug === slug) : undefined);

const photoCache = new Map<string, Photo | null>();

/** A photo from public/photos/<name>/ (source: pavla-content/fotky/), or null while it does not exist. */
export function getPhoto(name: string): Photo | null {
  if (!photoCache.has(name)) {
    const infoPath = path.join(dataRoot, 'public/photos', name, 'info.json');
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
/** Caption of a detail photo of a work, or '' when the author did not write one. */
export function detailCaption(work: Work, name: string): string {
  const entry = Object.entries(work.details ?? {}).find(([key]) => detailKey(key) === name);
  return entry ? String(entry[1]).trim() : '';
}

/** Largest generated JPEG of a collection's cover (for og:image). */
export function collectionCoverImage(c: Collection): string {
  if (c.cover) return `/collections/${c.slug}/${c.cover.widths[c.cover.widths.length - 1]}.jpg`;
  if (c.coverDetail) return `${workImagePath(c.coverWork)}/detail-${c.coverDetail.name}-${c.coverDetail.widths[c.coverDetail.widths.length - 1]}.jpg`;
  return `${workImagePath(c.coverWork)}/1600.jpg`;
}

/**
 * Share image (og:image) of a work: og.jpg from the pipeline (the whole work on paper, 3:2),
 * falling back to the largest web size up to 1600 px while it does not exist.
 */
export function workShareImage(w: Work): ShareImage {
  if (w.image.og) return { src: `${workImagePath(w)}/og.jpg`, ...w.image.og };
  const width = [...w.image.widths].filter((x) => x <= 1600).pop() ?? w.image.widths[0];
  return { src: `${workImagePath(w)}/${width}.jpg`, width, height: Math.round((w.image.height * width) / w.image.width) };
}

/** Share image of a list of works (a year): its first featured work, otherwise its newest one. */
export const worksShareImage = (works: Work[]): ShareImage | undefined => {
  const w = works.find((x) => x.featured) ?? works[0];
  return w && workShareImage(w);
};

/**
 * Share image (og:image) of a collection: the cover cropped to 3:2 around `focus` by the pipeline
 * (public/og/collections/<slug>.jpg), falling back to the share image of its cover work.
 */
export function collectionShareImage(c: Collection): ShareImage {
  const src = `/og/collections/${c.slug}.jpg`;
  if (!fs.existsSync(path.join(dataRoot, 'public', src))) return workShareImage(c.coverWork);
  return { src, width: config.images.og.width, height: config.images.og.height };
}

/** Page of a collection: /tvorba/kolekce/<slug>/ */
export const collectionUrl = (slug: string) => url(`/tvorba/kolekce/${slug}/`);

/** Folder with the web images of a work (without base URL, for og:image etc.). */
export const workImagePath = (w: Work) => `/works/${w.year}/${w.key}`;
