import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { coverCandidates, detailKey, parseWorkKey } from '../../scripts/lib/works.mjs';
import { parseCoverRef } from '../../scripts/lib/covers.mjs';
import { HOME_TEXT } from '../../scripts/lib/schema.mjs';
import { buildVersion } from '../../scripts/lib/build-version.mjs';
import { measurementIdFor } from '../../scripts/lib/analytics.mjs';
import { execSync } from 'node:child_process';

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

/**
 * The cover of a collection, a year or the home page (resolveCover). `photo` (own photo) and `work` (`cover`) are
 * chosen, `random` takes turns among the newest works of the author's selection. All are shown whole; only a `work`
 * with `focus` is cropped to 3:2 around it. `og`: the share image the pipeline made for it, if any.
 */
export type Cover =
  | { kind: 'photo'; base: string; image: ImageSet & { alt: string }; og?: string }
  | { kind: 'work'; work: Work; detail?: Detail; focus?: [number, number]; og?: string }
  | { kind: 'random'; works: Work[] };

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
  /** Mockups (the work in a frame on a wall) shown on the page, independent of the status. */
  mockups?: boolean;
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
  /** The cover (resolveCover): its own photo, `cover`, or random from the author's selection. */
  cover: Cover;
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
    const cover = resolveCover(members, data, `collections/${slug}`, `og/collections/${slug}.jpg`, data.title ?? slug)!;
    collections.push({ slug, title: data.title ?? slug, description: data.description, cover, works: members });
  }
  collectionCache = collections.sort((a, b) => b.works[0].date.getTime() - a.works[0].date.getTime());
  return collectionCache;
}

export const getCollection = (slug?: string) => (slug ? getCollections().find((c) => c.slug === slug) : undefined);

const photoCache = new Map<string, Photo | null>();

/** A photo from public/photos/<name>/ (source: fotky/ of the content repository), or null while it does not exist. */
export function getPhoto(name: string): Photo | null {
  if (!photoCache.has(name)) {
    const infoPath = path.join(dataRoot, 'public/photos', name, 'info.json');
    if (!fs.existsSync(infoPath)) console.warn(`[photos] ${name}: not found, add fotky/${name}.jpg to the content repository and run "npm run images"`);
    photoCache.set(name, fs.existsSync(infoPath) ? JSON.parse(fs.readFileSync(infoPath, 'utf8')) : null);
  }
  return photoCache.get(name)!;
}

/** Commit the site is built from: GITHUB_SHA on GitHub Actions, otherwise the local checkout; '' when unknown. */
function currentCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

/** Version of this build for the footer (CalVer from the build time, see scripts/lib/build-version.mjs). */
export const version = buildVersion(new Date(), currentCommit());

/** Google Analytics measurement ID for this build, null when it must not measure (dev server, test data). */
export const analyticsId = measurementIdFor(config.analytics, { production: import.meta.env.PROD, demo: Boolean(process.env.SITE_DATA_DIR) });

/** Years that have at least one published work, newest first. */
/**
 * The cover of a place (a collection, a year, the home page), the same rule as the pipeline (scripts/lib/covers.mjs):
 * its own photo (public/<photoDir>/), otherwise `cover: <id>` or `<id>#<detail>` among `works` (cropped to 3:2 only
 * with `focus`), otherwise one of the newest works of the author's selection at random. `ogFile`: the share image the
 * pipeline makes for a chosen cover. Null only without any work.
 */
export function resolveCover(works: Work[], data: any, photoDir: string, ogFile: string, alt: string): Cover | null {
  const focus = Array.isArray(data?.focus) && data.focus.length === 2 ? (data.focus as [number, number]) : undefined;
  const og = fs.existsSync(path.join(dataRoot, 'public', ogFile)) ? `/${ogFile}` : undefined;
  const info = path.join(dataRoot, 'public', photoDir, 'info.json');
  if (fs.existsSync(info)) {
    const photo = JSON.parse(fs.readFileSync(info, 'utf8'));
    return { kind: 'photo', base: `/${photoDir}`, image: { ...photo, alt: photo.alt || alt }, og };
  }
  const ref = typeof data?.cover === 'string' && data.cover.trim() ? parseCoverRef(data.cover) : null;
  const work = ref && works.find((w) => w.id === ref.id);
  if (work) {
    const detail = ref!.detail ? work.image.details?.find((d) => d.name === ref!.detail) : undefined;
    return { kind: 'work', work, detail, focus, og };
  }
  const candidates = coverCandidates(works);
  return candidates.length ? { kind: 'random', works: candidates } : null;
}

/** The id of the work a cover shows first (the one in the HTML), for lists that should not repeat it. */
export const coverWorkId = (c: Cover | null) => (c?.kind === 'work' ? c.work.id : c?.kind === 'random' ? c.works[0].id : undefined);

/** Share image of a cover: the pipeline's 3:2 crop of a chosen cover, otherwise the share image of the (first) work. */
export function coverShareImage(c: Cover | null): ShareImage | undefined {
  if (!c) return undefined;
  if (c.kind !== 'random' && c.og) return { src: c.og, width: config.images.og.width, height: config.images.og.height };
  if (c.kind === 'work') return workShareImage(c.work);
  if (c.kind === 'random') return workShareImage(c.works[0]);
  return undefined;
}

/** A year page: the author's text about the year (content/years/<year>.yaml) and its cover. */
export function getYear(year: number): { description?: string; cover: Cover | null } {
  const file = path.join(dataRoot, 'content/years', `${year}.yaml`);
  const data = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) ?? {} : {};
  const text = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined;
  const works = getWorks().filter((w) => w.year === year);
  return { description: text, cover: resolveCover(works, data, `years/${year}`, `og/years/${year}.jpg`, `Tvorba ${year}`) };
}

/**
 * The home page: its text (content/home.yaml; without the file, e.g. before the first pipeline run, the text the page
 * always had) and its cover.
 */
export function getHome(): { description?: string; cover: Cover | null } {
  const file = path.join(dataRoot, 'content/home.yaml');
  const data = fs.existsSync(file) ? YAML.parse(fs.readFileSync(file, 'utf8')) ?? {} : { description: HOME_TEXT };
  const text = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined;
  return { description: text, cover: resolveCover(getWorks(), data, 'home', 'og/home.jpg', site.title) };
}

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

/**
 * Share image (og:image) of a work: og.jpg from the pipeline (the whole work on paper, 3:2),
 * falling back to the largest web size up to 1600 px while it does not exist.
 */
export function workShareImage(w: Work): ShareImage {
  if (w.image.og) return { src: `${workImagePath(w)}/og.jpg`, ...w.image.og };
  const width = [...w.image.widths].filter((x) => x <= 1600).pop() ?? w.image.widths[0];
  return { src: `${workImagePath(w)}/${width}.jpg`, width, height: Math.round((w.image.height * width) / w.image.width) };
}

/** Share image (og:image) of a collection: its chosen cover cropped to 3:2, otherwise its (random) cover work. */
export const collectionShareImage = (c: Collection): ShareImage | undefined => coverShareImage(c.cover);

/** Page of a collection: /tvorba/kolekce/<slug>/ */
export const collectionUrl = (slug: string) => url(`/tvorba/kolekce/${slug}/`);

/** Folder with the web images of a work (without base URL, for og:image etc.). */
export const workImagePath = (w: Work) => `/works/${w.year}/${w.key}`;
