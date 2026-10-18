// Prototype pages for trying out how the works are shown (and the cameras of the Instagram scenes) (npm run prototypes, scripts/prototypes.mjs): standalone HTML
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
import {
  aimRotation, cameraAngles, cameraFromAngles, circleRatio, facingDeg, fitCamera, fitCameraToLines, insidePolygon, ledgeDepth, lineMisfit, lineY,
  planPlacement, polygonDistance, project, quadFits, sceneCamera, sceneWindow, segmentDistance, tiltDeg, unit, unproject, workQuad,
} from './instagram.mjs';

/** The prototypes: published file name → template in scripts/prototypes/. */
export const PROTOTYPES = {
  'zarovnani-sloupcu.html': 'columns.html',
  'znacky-dlazdic.html': 'marks.html',
  'kamera-scen.html': 'scene-camera.html',
};

/** The functions of the site a prototype calculates with, copied into it by their source text (self-contained ones). */
export const PROTOTYPE_FUNCTIONS = [
  columnCount, balanceColumns, columnPlan, orderColumns,
  project, unproject, lineY, ledgeDepth, circleRatio, aimRotation, cameraFromAngles, cameraAngles, lineMisfit, fitCameraToLines,
  // where the pipeline puts a work in a scene and the 4:5 window it cuts
  unit, tiltDeg, facingDeg, insidePolygon, segmentDistance, polygonDistance, quadFits, workQuad, planPlacement, sceneWindow,
];

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
          id: data.id,
          date: String(data.date),
          title: data.title ?? data.id,
          sub: [data.technique, data.size_cm ? formatSizeCm(data.size_cm) : ''].filter(Boolean).join(' · '),
          sizeCm: Array.isArray(data.size_cm) ? data.size_cm : null,
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

/** The settings of a scene the placement of a work (planPlacement) and its 4:5 window (sceneWindow) take. */
const PLACEMENT_KEYS = ['maxShiftCm', 'maxSlideCm', 'minTiltDeg', 'maxTiltDeg', 'tiltSign', 'maxExtraTiltDeg', 'propMarginPx', 'cropTop', 'minFill', 'maxZoom', 'minArea', 'maxAreaZoom'];

// unrounded: the prototype places a work exactly as the pipeline does (a rounded camera can tip a borderline placement)
const setupOf = (cam) => ({
  focalMm: cam.focalMm, zenithDeg: cam.zenithDeg, azimuthDeg: cam.azimuthDeg, rollDeg: cam.rollDeg, distanceCm: cam.distanceCm,
  sheetCenter: cam.sheetCenter, sheetDeg: cam.sheetDeg ?? 0,
});

/**
 * The Instagram scenes (loadInstagramScenes, with imageSize) as the prototype of their cameras needs them: what
 * scenes.yaml says (with the edges of the support `lines`), the pictures (relative to `outDir`), the camera the
 * pipeline uses (`camera`, where from: `source` = camera | lines | corners), the one fitted to the drawn corners
 * (`fitted`) and, with lines, the one from the lines (`fromLines`), all as camera setups.
 */
export function prototypeScenes(scenes, outDir) {
  const rel = (file) => path.relative(path.resolve(outDir), file).split(path.sep).join('/');
  return scenes.map((scene) => {
    const fitted = fitCamera(scene.corners, scene.sheetCm, scene.imageSize, { focalMm: scene.focalMm, circles: scene.circles, mode: scene.mode });
    const cam = sceneCamera(scene);
    const fromLines = scene.lines ? fitCameraToLines(scene, fitted) : null;
    return {
      name: scene.name, label: scene.label, mode: scene.mode, sheetCm: scene.sheetCm, imageSize: scene.imageSize,
      corners: scene.corners, circles: scene.circles ?? [], center: scene.center ?? null, ledge: scene.ledge ?? null,
      axis: scene.axis ?? null, sinkPx: scene.sinkPx ?? 0, focalMm: scene.focalMm ?? null, prompt: scene.prompt ?? null,
      front: scene.front ?? [], props: scene.props ?? [], bounds: scene.bounds ?? null,
      // what planPlacement and sceneWindow read, as the pipeline has it
      ...Object.fromEntries(PLACEMENT_KEYS.filter((k) => scene[k] !== undefined).map((k) => [k, scene[k]])),
      lines: { x: scene.lines?.x ?? [], y: scene.lines?.y ?? [] },
      image: rel(scene.path), sheetImage: rel(scene.sheetPath),
      camera: setupOf(cam), source: cam.source, fitted: setupOf(fitted),
      fromLines: fromLines && setupOf({ ...fromLines.setup, sheetDeg: fromLines.sheetDeg }),
    };
  });
}

/** Writes every prototype into `outDir` from the templates in `templatesDir`; returns the written files. */
export function writePrototypes({ dataRoot, outDir, templatesDir, config, scenes = [] }) {
  const data = { works: prototypeWorks(dataRoot), public: publicPath(outDir, dataRoot), config: prototypeConfig(config), scenes: prototypeScenes(scenes, outDir) };
  fs.mkdirSync(outDir, { recursive: true });
  return Object.entries(PROTOTYPES).map(([name, template]) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, fillTemplate(fs.readFileSync(path.join(templatesDir, template), 'utf8'), data));
    return file;
  });
}
