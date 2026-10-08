import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { coverCandidates, dateYear, detailKey, formatSizeCm, isValidId, workKey } from '../../scripts/lib/works.mjs';
import { photoFocus } from '../../scripts/lib/photos.mjs';
import { readCopies } from '../../scripts/lib/site-content.mjs';
import { HOME_PAGE_DIR, UNCOLLECTED_PAGE_DIR, collectionPageDir, coverDir, ogFile, photoDir, workImageDir, yearPageDir } from '../../scripts/lib/site-images.mjs';
import { coverCrop, parseCoverRef } from '../../scripts/lib/covers.mjs';
import { HOME_TEXT, UNCOLLECTED_TEXT } from '../../scripts/lib/schema.mjs';
import { buildVersion } from '../../scripts/lib/build-version.mjs';
import { NO_COLLECTION_TITLE } from '../../scripts/lib/gallery-filter.mjs';
import { sortCollections } from '../../scripts/lib/collection-filter.mjs';
import { measurementIdFor } from '../../scripts/lib/analytics.mjs';
import { messagesSettings } from '../../scripts/lib/messages.mjs';
import { workTooltip } from '../../scripts/lib/tooltip.mjs';
import { execSync } from 'node:child_process';

const root = process.cwd();
// Generated data (content/ and public/): this repo for the real site, .demo/site for the test data (npm run demo).
const dataRoot = process.env.SITE_DATA_DIR ? path.resolve(root, process.env.SITE_DATA_DIR) : root;

export const config = YAML.parse(fs.readFileSync(path.join(root, 'site.config.yaml'), 'utf8'));
export const site = config.site as {
  url: string; title: string; tagline: string; author: string;
  email: string; instagram: string; fler: string;
  /** Where the author lives and paints, shown on the contact page; empty = nothing. */
  location?: string;
  /** Codes proving to search engines that the site is ours (meta tags, scripts/lib/seo.mjs verificationMeta). */
  verification?: { google?: string; bing?: string; seznam?: string };
};

export type Status = 'available' | 'reserved' | 'sold' | 'gifted' | 'not-for-sale';

/** A generated responsive image: <width>.{avif,webp,jpg} for each of `widths`. */
// transparent: the surroundings of the sheet are transparent (meta_corners): no placeholder colour, a drop shadow
export interface ImageSet { width: number; height: number; widths: number[]; dominant: string; transparent?: boolean }
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
 * chosen, `random` takes turns among the newest works of the author's selection. All are shown whole; a chosen one
 * with `crop` (`aspect` and/or `focus`, coverCrop) is cropped to that aspect ratio around focus. `og`: its share image.
 */
export type Cover =
  | { kind: 'photo'; base: string; image: ImageSet & { alt: string }; crop?: { css: string; focus: [number, number] }; og?: string }
  | { kind: 'work'; work: Work; detail?: Detail; crop?: { css: string; focus: [number, number] }; og?: string }
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
  /** Slug of the collection (the folder of content/tvorba/<slug>/), if the work belongs to one. */
  collection?: string;
  description?: string;
  /** The day (YYYY-MM-DD) its public attributes or images last changed (derived_modified of the public copy). */
  modified?: string;
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

/** One label for works the author no longer has: sold and given away look the same on the site (never told apart). */
export const GONE_LABEL = 'V soukromé sbírce';

/** The status as the page's HTML may show it: given away is written as sold, so the two are never told apart. */
export const shownStatus = (s: Status): Status => (s === 'gifted' ? 'sold' : s);

export const statusLabel: Record<Status, string> = {
  available: 'K prodeji',
  reserved: 'Rezervováno',
  sold: GONE_LABEL,
  gifted: GONE_LABEL,
  'not-for-sale': 'Není na prodej',
};

let cache: Work[] | null = null;
let copiesCache: ReturnType<typeof readCopies> | null = null;
/** The public copies of the descriptions (content/, a mirror of the content repository, scripts/lib/site-content.mjs). */
const copies = () => (copiesCache ??= readCopies(dataRoot));

/**
 * All published works (with generated images; drafts never reach this repository), newest first.
 * Layout: content/tvorba/[<collection>/]<slug>.yaml (the year comes from `date`, the collection from the folder)
 * and public/tvorba/<year>/<slug>-<id>/info.json (the images lie in the folder of the work's page).
 */
export function getWorks(): Work[] {
  if (cache) return cache;
  const works: Work[] = [];
  for (const { slug, collection, data } of copies().works) {
    const where = [collection, slug].filter(Boolean).join('/');
    const year = dateYear(data.date);
    if (!isValidId(data.id) || !Number.isInteger(year)) {
      console.warn(`[works] ${where}: no valid id or date, skipped`);
      continue;
    }
    const key = workKey(slug, data.id);
    const infoPath = path.join(dataRoot, 'public', workImageDir(year, key), 'info.json');
    if (!fs.existsSync(infoPath)) {
      console.warn(`[works] ${year}/${key}: images missing, run "npm run images", skipped`);
      continue;
    }
    works.push({
      ...data,
      id: data.id,
      slug,
      key,
      date: new Date(data.date),
      year,
      tags: data.tags ?? [],
      collection: collection ?? undefined,
      modified: data.derived_modified,
      status: data.status ?? 'not-for-sale',
      image: JSON.parse(fs.readFileSync(infoPath, 'utf8')),
    });
  }
  cache = works.sort((a, b) => b.date.getTime() - a.date.getTime());
  return cache;
}

let collectionCache: Collection[] | null = null;

/**
 * Collections with at least one published work, the one with the newest work first.
 * Layout: content/tvorba/<slug>/_index.yaml and public/tvorba/kolekce/<slug>/ (own cover photo _cover/, og.jpg).
 */
export function getCollections(): Collection[] {
  if (collectionCache) return collectionCache;
  const works = getWorks();
  const collections: Collection[] = [];
  for (const { slug, data } of copies().collections) {
    const members = works.filter((w) => w.collection === slug);
    if (!members.length) continue;
    const page = collectionPageDir(slug);
    const cover = resolveCover(members, data, coverDir(page), ogFile(page), data.title ?? slug)!;
    collections.push({ slug, title: data.title ?? slug, description: data.description, cover, works: members });
  }
  collectionCache = sortCollections(collections);
  return collectionCache;
}

/**
 * The works in no collection as one more item of the collections overview ("Mimo kolekce", leading to the gallery
 * filtered to them, ?collection=none). Its cover follows the rule of every place (resolveCover) from tvorba/_index.yaml
 * of the content repository: its own photo tvorba/_cover.jpg, `cover` among these works, otherwise random. No share
 * image (no page of its own). Its text: `description` of that file, otherwise UNCOLLECTED_TEXT.
 * Null when every work is in a collection.
 */
export function getUncollected(): { title: string; description: string; cover: Cover; works: Work[] } | null {
  const works = getWorks().filter((w) => !w.collection);
  if (!works.length) return null;
  const cover = resolveCover(works, copies().uncollected ?? {}, coverDir(UNCOLLECTED_PAGE_DIR), ogFile(UNCOLLECTED_PAGE_DIR), NO_COLLECTION_TITLE)!;
  const description = String(copies().uncollected?.description ?? '').trim() || UNCOLLECTED_TEXT;
  return { title: NO_COLLECTION_TITLE, description, cover, works };
}

export const getCollection = (slug?: string) => (slug ? getCollections().find((c) => c.slug === slug) : undefined);

const photoCache = new Map<string, Photo | null>();

/**
 * A photo (source: fotky/ of the content repository): its images from public/fotky/<name>/info.json, its alt,
 * caption and focus from content/fotky/<name>.yaml; null while it does not exist.
 */
export function getPhoto(name: string): Photo | null {
  if (!photoCache.has(name)) {
    const infoPath = path.join(dataRoot, 'public', photoDir(name), 'info.json');
    if (!fs.existsSync(infoPath)) console.warn(`[photos] ${name}: not found, add fotky/${name}.jpg to the content repository and run "npm run images"`);
    const data = copies().photos.get(name) ?? {};
    const photo = fs.existsSync(infoPath)
      ? { ...JSON.parse(fs.readFileSync(infoPath, 'utf8')), alt: data.alt ?? '', caption: data.caption ?? '', focus: photoFocus(data) }
      : null;
    photoCache.set(name, photo);
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

/**
 * Messages from visitors (scripts/lib/messages.mjs messagesSettings): `mode` 'live' = sent by Web3Forms, 'preview' = the
 * test data without a key (the form works, nothing is sent), null = no form; the keys are public by design.
 */
export const messages = messagesSettings(config.messages, { demo: Boolean(process.env.SITE_DATA_DIR) }) as {
  mode: 'live' | 'preview' | null; accessKey: string;
};

/** Years that have at least one published work, newest first. */
/**
 * The cover of a place (a collection, a year, the home page), the same rule as the pipeline (scripts/lib/covers.mjs):
 * its own photo (public/<photoDir>/), otherwise `cover: <id>` or `<id>#<detail>` among `works` (both cropped only
 * with `aspect` or `focus`, coverCrop), otherwise one of the newest works of the author's selection at random. `ogFile`: the
 * share image the pipeline makes for a chosen cover. Null only without any work.
 */
export function resolveCover(works: Work[], data: any, photoDir: string, ogFile: string, alt: string): Cover | null {
  const toCrop = (chosen: boolean) => {
    const cut = coverCrop(data, chosen);
    return cut ? { css: cut.css, focus: cut.focus as [number, number] } : undefined;
  };
  const og = fs.existsSync(path.join(dataRoot, 'public', ogFile)) ? `/${ogFile}` : undefined;
  const info = path.join(dataRoot, 'public', photoDir, 'info.json');
  if (fs.existsSync(info)) {
    const photo = JSON.parse(fs.readFileSync(info, 'utf8'));
    return { kind: 'photo', base: `/${photoDir}`, image: { ...photo, alt: photo.alt || alt }, crop: toCrop(true), og };
  }
  const ref = typeof data?.cover === 'string' && data.cover.trim() ? parseCoverRef(data.cover) : null;
  const work = ref && works.find((w) => w.id === ref.id);
  if (work) {
    const detail = ref!.detail ? work.image.details?.find((d) => d.name === ref!.detail) : undefined;
    return { kind: 'work', work, detail, crop: toCrop(true), og };
  }
  const candidates = coverCandidates(works);
  return candidates.length ? { kind: 'random', works: candidates } : null;
}

/** The id of the work a cover shows first (the one in the HTML), for lists that should not repeat it. */
export const coverWorkId = (c: Cover | null) => (c?.kind === 'work' ? c.work.id : c?.kind === 'random' ? c.works[0].id : undefined);

/** Share image of a cover: the pipeline's one for a chosen cover, otherwise the share image of the (first) work. */
export function coverShareImage(c: Cover | null): ShareImage | undefined {
  if (!c) return undefined;
  if (c.kind !== 'random' && c.og) return { src: c.og, width: config.images.og.width, height: config.images.og.height };
  if (c.kind === 'work') return workShareImage(c.work);
  if (c.kind === 'random') return workShareImage(c.works[0]);
  return undefined;
}

/** A year page: the author's text about the year (content/roky/<year>.yaml) and its cover. */
export function getYear(year: number): { description?: string; cover: Cover | null } {
  const data = copies().years.get(String(year)) ?? {};
  const text = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined;
  const works = getWorks().filter((w) => w.year === year);
  const page = yearPageDir(year);
  return { description: text, cover: resolveCover(works, data, coverDir(page), ogFile(page), `Tvorba ${year}`) };
}

/**
 * The home page: its text (content/_index.yaml; without the file, e.g. before the first pipeline run, the text the
 * page always had) and its cover.
 */
export function getHome(): { description?: string; cover: Cover | null } {
  const data = copies().home ?? { description: HOME_TEXT };
  const text = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined;
  return { description: text, cover: resolveCover(getWorks(), data, coverDir(HOME_PAGE_DIR), ogFile(HOME_PAGE_DIR), site.title) };
}

export const getYears = () => [...new Set(getWorks().map((w) => w.year))].sort((a, b) => b - a);

/** "29,5 × 29,5 cm": Czech decimal comma (scripts/lib/works.mjs formatSizeCm). */
export const formatSize = (s?: [number, number]) => formatSizeCm(s);
export const formatPrice = (p?: number) =>
  p ? new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p) : '';
export const url = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;

/** Tooltip over a picture of a work (scripts/lib/tooltip.mjs); `detail` = caption of the detail photo shown. */
export const workTitle = (w: Work, detail?: string) => workTooltip(w, statusLabel, { detail });

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

/** Absolute address of the largest web size up to 1600 px of another photo (fotky/), for structured data; null without it. */
export function photoImageUrl(name: string): string | null {
  const photo = getPhoto(name);
  if (!photo) return null;
  const width = [...photo.widths].filter((x) => x <= 1600).pop() ?? photo.widths[0];
  return new URL(`/${photoDir(name)}/${width}.jpg`, site.url).href;
}

/** Folder with the web images of a work (without base URL, for og:image etc.). */
export const workImagePath = (w: Work) => `/${workImageDir(w.year, w.key)}`;
