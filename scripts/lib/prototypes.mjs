// Prototype pages for trying out how the works are shown (npm run prototypes, scripts/prototypes.mjs): standalone HTML
// files over the site data (content/ and public/ of the site, or of the test data with SITE_DATA_DIR) that take their
// pictures straight from public/ and the calculations of the site as their source text, so a prototype always shows
// what the site would. The templates are in scripts/prototypes/*.html, with placeholders filled here.
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { COPIES_DIR } from './site-content.mjs';
import { formatSizeCm, isOnSale } from './works.mjs';
import { balanceColumns, columnCount, columnPlan, columnsFor, orderColumns } from './view-layout.mjs';
import { homeRecent } from './home-view.mjs';
import { MARK_ICONS, SALE_ICONS, tileMarksFor } from './tile-marks.mjs';

/** The prototypes: published file name → template in scripts/prototypes/. */
export const PROTOTYPES = {
  'zarovnani-sloupcu.html': 'columns.html',
  'znacky-dlazdic.html': 'marks.html',
};

/** The functions of the site a prototype calculates with, copied into it by their source text (self-contained ones). */
export const PROTOTYPE_FUNCTIONS = [columnCount, balanceColumns, columnPlan, orderColumns];

/**
 * The works of the site data at `dataRoot` (content/tvorba/[<collection>/]<slug>.yaml + public/tvorba/<year>/<slug>-<id>/info.json),
 * newest first, as much as a prototype needs: date, title, technique · size, featured, on sale, the picture's ratio,
 * whether it is cut out, its widths and folder (relative to public/). Works without pictures are left out, like on the site.
 */
export function prototypeWorks(dataRoot) {
  const works = [];
  const root = path.join(dataRoot, COPIES_DIR, 'tvorba');
  if (!fs.existsSync(root)) return works;
  (function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (name.endsWith('.yaml') && !name.startsWith('_')) {
        const data = YAML.parse(fs.readFileSync(file, 'utf8')) ?? {};
        if (!data.id || !data.date) continue;
        const folder = `tvorba/${String(data.date).slice(0, 4)}/${name.replace(/\.yaml$/, '')}-${data.id}`;
        const infoPath = path.join(dataRoot, 'public', folder, 'info.json');
        if (!fs.existsSync(infoPath)) continue;
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        works.push({
          date: String(data.date),
          title: data.title ?? data.id,
          sub: [data.technique, data.size_cm ? formatSizeCm(data.size_cm) : ''].filter(Boolean).join(' · '),
          featured: data.featured === true,
          forSale: isOnSale(data.status),
          ratio: info.height / info.width,
          transparent: Boolean(info.transparent),
          widths: info.widths,
          folder,
        });
      }
    }
  })(root);
  return works.sort((a, b) => b.date.localeCompare(a.date));
}

/** The settings of site.config.yaml (`config`) a prototype starts from: the counts of the home page, columns and marks of each place. */
export function prototypeConfig(config) {
  return {
    recent: homeRecent(config?.home?.recent),
    columns: { home: columnsFor(config, 'home'), gallery: columnsFor(config, 'gallery') },
    marks: { home: tileMarksFor(config, 'home'), gallery: tileMarksFor(config, 'gallery') },
    icons: Object.fromEntries(['star', ...SALE_ICONS].map((icon) => [icon, `<svg viewBox="0 0 24 24">${MARK_ICONS[icon]}</svg>`])),
  };
}

/** The path from a page in `outDir` to the public/ of `dataRoot`, as used in the page (forward slashes). */
export const publicPath = (outDir, dataRoot) => path.relative(path.resolve(outDir), path.resolve(dataRoot, 'public')).split(path.sep).join('/') || '.';

/**
 * The page of `template` with its placeholders filled: `/*DATA*\/{}` = `data` as JSON (safe inside <script>), and
 * `/*FUNCTIONS*\/` = the source of PROTOTYPE_FUNCTIONS. A missing placeholder is an error (a template out of date).
 */
export function fillTemplate(template, data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const fills = [['/*DATA*/{}', json], ['/*FUNCTIONS*/', PROTOTYPE_FUNCTIONS.map(String).join('\n')]];
  let page = template;
  for (const [placeholder, value] of fills) {
    if (!page.includes(placeholder)) throw new Error(`prototype template without ${placeholder}`);
    page = page.replace(placeholder, () => value);
  }
  return page;
}

/** Writes every prototype into `outDir` from the templates in `templatesDir`; returns the written files. */
export function writePrototypes({ dataRoot, outDir, templatesDir, config }) {
  const data = { works: prototypeWorks(dataRoot), public: publicPath(outDir, dataRoot), config: prototypeConfig(config) };
  fs.mkdirSync(outDir, { recursive: true });
  return Object.entries(PROTOTYPES).map(([name, template]) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, fillTemplate(fs.readFileSync(path.join(templatesDir, template), 'utf8'), data));
    return file;
  });
}
