// The colours of a work: the pipeline analyses its small web picture once (analyseColours: its paper and every pixel
// balanced by it, in bins of hue × chroma × lightness) into `colors` of its info.json (workColoursInfo, COLOUR_VERSION);
// the site counts the shares of the colours a visitor can pick from it (site.config.yaml gallery.colors,
// colourSettings, familyShares) and its mood (warm / cool, light / dark, pastel / saturated, paletteMood), so a change
// of the list of colours needs no new analysis. How far apart two works are: colourDistance (similar works, Detail
// dne). The prototype .prototypes/barvy.html (scripts/prototypes/colors.html) tries it all on the real works.
// Colours are compared in OKLab (perceptually even: a step of 0.1 looks about the same everywhere), hues in OKLCH.
// Every function here is self-contained (no constants of the module): the prototype copies them as text
// (PROTOTYPE_FUNCTIONS in scripts/lib/prototypes.mjs).

/** Bump when the analysis changes (analyseColours): every work is analysed again (only its colours, never its images). */
export const COLOUR_VERSION = 1;

/** The longer side of the small picture the colours of a work are read from. */
export const COLOUR_ANALYSIS_SIZE = 160;

/** OKLab of an sRGB colour (0–255): [L 0–1, a, b]. */
export function rgbToOklab(r, g, b) {
  const linear = (c) => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** OKLCH of an OKLab colour: { l, c (chroma, 0 = grey, ~0.3 = very saturated), h (hue in degrees, 0–360) }. */
export function oklabToOklch([l, a, b]) {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

/**
 * The palette of a picture (raw pixels { data, width, height, channels }, with alpha = 4 channels: transparent pixels,
 * the background of a cut-out work, are left out): `k` colours by k-means in OKLab, the biggest first, each
 * { hex, lab, weight (share of the picture) }. A `margin` (share of each side) stays out: the edge of the paper, a
 * signature, a shadow of the photo. Deterministic: the first centres are spread by the farthest-point rule.
 */
export function workPalette({ data, width, height, channels }, { k = 8, margin = 0.04, iterations = 12 } = {}) {
  const points = [];
  const rgb = [];
  const x0 = Math.floor(width * margin);
  const y0 = Math.floor(height * margin);
  for (let y = y0; y < height - y0; y++) {
    for (let x = x0; x < width - x0; x++) {
      const i = (y * width + x) * channels;
      if (channels === 4 && data[i + 3] < 128) continue;
      points.push(rgbToOklab(data[i], data[i + 1], data[i + 2]));
      rgb.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  if (!points.length) return [];
  const dist = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  // the first centre: the average colour; every next one: the point farthest from all centres so far
  const mean = [0, 1, 2].map((c) => points.reduce((sum, p) => sum + p[c], 0) / points.length);
  const centres = [mean];
  const nearest = points.map((p) => dist(p, mean));
  while (centres.length < Math.min(k, points.length)) {
    let far = 0;
    for (let i = 1; i < points.length; i++) if (nearest[i] > nearest[far]) far = i;
    if (nearest[far] === 0) break;
    centres.push([...points[far]]);
    points.forEach((p, i) => { nearest[i] = Math.min(nearest[i], dist(p, points[far])); });
  }
  const owner = new Array(points.length).fill(0);
  for (let round = 0; round < iterations; round++) {
    points.forEach((p, i) => {
      let best = 0;
      for (let c = 1; c < centres.length; c++) if (dist(p, centres[c]) < dist(p, centres[best])) best = c;
      owner[i] = best;
    });
    const sums = centres.map(() => [0, 0, 0, 0]);
    points.forEach((p, i) => { const s = sums[owner[i]]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sums.forEach((s, c) => { if (s[3]) centres[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const groups = centres.map(() => ({ n: 0, r: 0, g: 0, b: 0, lab: [0, 0, 0] }));
  points.forEach((p, i) => {
    const g = groups[owner[i]];
    g.n++; g.r += rgb[i][0]; g.g += rgb[i][1]; g.b += rgb[i][2];
    g.lab[0] += p[0]; g.lab[1] += p[1]; g.lab[2] += p[2];
  });
  const hex2 = (v) => Math.round(v).toString(16).padStart(2, '0');
  const round3 = (v) => Math.round(v * 1000) / 1000;
  return groups.filter((g) => g.n).sort((a, b) => b.n - a.n).map((g) => ({
    hex: `#${hex2(g.r / g.n)}${hex2(g.g / g.n)}${hex2(g.b / g.n)}`,
    lab: g.lab.map((v) => round3(v / g.n)),
    weight: round3(g.n / points.length),
  }));
}

/**
 * The colours a visitor can pick (site.config.yaml gallery.colors, colourSettings): each { id (in the address
 * ?color=), label, color (#rrggbb, the swatch and the shade the colours of a work are compared with) }, the order of
 * the list = the order of the choice. Any list works: a coloured place of a work belongs to the nearest of them.
 */
export const DEFAULT_COLOUR_FAMILIES = [
  { id: 'cervena', label: 'červená', color: '#c8423b' },
  { id: 'ruzova', label: 'růžová', color: '#d98aa8' },
  { id: 'oranzova', label: 'oranžová', color: '#e08a3c' },
  { id: 'zluta', label: 'žlutá', color: '#e3c34b' },
  { id: 'hneda', label: 'hnědá', color: '#7a5434' },
  { id: 'zelena', label: 'zelená', color: '#5f9a52' },
  { id: 'tyrkysova', label: 'tyrkysová', color: '#3e9c9a' },
  { id: 'modra', label: 'modrá', color: '#4472b0' },
  { id: 'fialova', label: 'fialová', color: '#8063a8' },
];

/** The share of the painted part (the paper left out) a colour must have for a work to count as that colour, in %. */
export const DEFAULT_COLOUR_MIN_SHARE = 12;

/**
 * The colour settings of site.config.yaml (`config.gallery.colors`), missing ones from the defaults: { minShare (a share,
 * 0–1), families: [{ id, label, color, lab (OKLab of color) }] }. A bad value = error (the build stops).
 */
export function colourSettings(config) {
  const raw = config?.gallery?.colors ?? {};
  const where = 'site.config.yaml gallery.colors';
  const unknown = Object.keys(raw).filter((k) => !['minShare', 'families'].includes(k));
  if (unknown.length) throw new Error(`${where}: unknown ${unknown.join(', ')}`);
  const minShare = raw.minShare ?? DEFAULT_COLOUR_MIN_SHARE;
  if (typeof minShare !== 'number' || !(minShare > 0 && minShare <= 100)) throw new Error(`${where}.minShare must be a number from 1 to 100 (%), got ${JSON.stringify(minShare)}`);
  const families = raw.families ?? DEFAULT_COLOUR_FAMILIES;
  if (!Array.isArray(families) || !families.length) throw new Error(`${where}.families must be a list of colours`);
  const ids = new Set();
  return {
    minShare: minShare / 100,
    families: families.map((f, i) => {
      const at = `${where}.families[${i}]`;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(f?.id ?? ''))) throw new Error(`${at}.id must be lower-case letters, digits and dashes (it goes into the address), got ${JSON.stringify(f?.id)}`);
      if (ids.has(f.id)) throw new Error(`${at}.id ${f.id} is there twice`);
      ids.add(f.id);
      if (typeof f.label !== 'string' || !f.label.trim()) throw new Error(`${at}.label must be a text`);
      if (!/^#[0-9a-f]{6}$/i.test(String(f.color ?? ''))) throw new Error(`${at}.color must be #rrggbb, got ${JSON.stringify(f.color)}`);
      const hex = f.color.slice(1);
      const lab = rgbToOklab(...[0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16))).map((v) => Math.round(v * 1000) / 1000);
      return { id: f.id, label: f.label.trim(), color: f.color.toLowerCase(), lab };
    }),
  };
}

/**
 * The colour of `families` (colourSettings) a colour (OKLab `lab`) belongs to: the nearest by hue (60° counts as 1) and
 * by lightness (0.4 counts as 1), so a dark orange is brown when brown is in the list and orange when it is not;
 * null for a colour that is almost grey (chroma under `chroma`): no colour to pick it by.
 */
export function nearestFamily(lab, families, { chroma = 0.02 } = {}) {
  const hue = ([, a, b]) => {
    const h = (Math.atan2(b, a) * 180) / Math.PI;
    return h < 0 ? h + 360 : h;
  };
  if (Math.hypot(lab[1], lab[2]) < chroma || !families.length) return null;
  const h = hue(lab);
  let best = null;
  let bestDistance = Infinity;
  for (const f of families) {
    const dh = Math.abs(h - hue(f.lab));
    const distance = Math.min(dh, 360 - dh) / 60 + Math.abs(lab[0] - f.lab[0]) / 0.4;
    if (distance < bestDistance) { best = f.id; bestDistance = distance; }
  }
  return best;
}

/**
 * The paper of a picture from its palette (workPalette): the lightest colour that is almost grey (chroma under
 * `paperChroma`), light (over `paperMin`) and big (at least `paperShare`); its OKLab, null without one.
 */
export function paperOf(palette, { paperChroma = 0.05, paperMin = 0.55, paperShare = 0.08 } = {}) {
  const candidates = palette.filter((c) => Math.hypot(c.lab[1], c.lab[2]) < paperChroma && c.lab[0] > paperMin && c.weight >= paperShare);
  return candidates.length ? candidates.reduce((x, y) => (y.lab[0] > x.lab[0] ? y : x)).lab : null;
}

/**
 * The paper of a picture from its edge: the median OKLab of the band between `outer` and `inner` (shares of each side)
 * along the edges, where a watercolour usually shows its bare sheet. It is the paper only when it is light (over
 * `minLight`) and almost grey (under `maxChroma`), otherwise null (a work painted to its edges, a dark one): unlike the
 * lightest colour of the palette (paperOf) it never takes a pale sky for the paper. Transparent pixels left out.
 */
export function paperFromEdge({ data, width, height, channels }, { outer = 0.01, inner = 0.04, minLight = 0.6, maxChroma = 0.04 } = {}) {
  const values = [[], [], []];
  const [ox, oy, ix, iy] = [width * outer, height * outer, width * inner, height * inner].map(Math.floor);
  for (let y = oy; y < height - oy; y++) {
    for (let x = ox; x < width - ox; x++) {
      const inside = x >= ix && x < width - ix && y >= iy && y < height - iy;
      if (inside) continue;
      const i = (y * width + x) * channels;
      if (channels === 4 && data[i + 3] < 128) continue;
      rgbToOklab(data[i], data[i + 1], data[i + 2]).forEach((v, c) => values[c].push(v));
    }
  }
  if (!values[0].length) return null;
  const median = (list) => list.sort((a, b) => a - b)[Math.floor(list.length / 2)];
  const paper = values.map(median);
  return paper[0] > minLight && Math.hypot(paper[1], paper[2]) < maxChroma ? paper.map((v) => Math.round(v * 1000) / 1000) : null;
}

/**
 * Every pixel of a picture (raw pixels as workPalette, the same `margin`, transparent ones left out) balanced by its
 * `paper` (paperFromEdge: the tint taken out, the paper white; none = as it is) and counted in bins of hue (every 15°),
 * chroma (edges 0.008, 0.015, 0.025, 0.04, 0.07, 0.12) and lightness (tenths): [{ lab (the centre of the bin), weight }],
 * the bins under `minWeight` left out. Unlike a palette of a few colours it keeps the small coloured places of a
 * painting that is mostly paper (a palette averages them into grey).
 */
export function colourHistogram({ data, width, height, channels }, paper = null, { margin = 0.04, minWeight = 0.002 } = {}) {
  const edges = [0.008, 0.015, 0.025, 0.04, 0.07, 0.12];
  const centres = [0.004, 0.0115, 0.02, 0.0325, 0.055, 0.095, 0.16];
  const bins = new Map();
  let n = 0;
  const x0 = Math.floor(width * margin);
  const y0 = Math.floor(height * margin);
  for (let y = y0; y < height - y0; y++) {
    for (let x = x0; x < width - x0; x++) {
      const i = (y * width + x) * channels;
      if (channels === 4 && data[i + 3] < 128) continue;
      let [l, a, b] = rgbToOklab(data[i], data[i + 1], data[i + 2]);
      if (paper) { l = Math.min(1, l / paper[0]); a -= paper[1]; b -= paper[2]; }
      const c = Math.hypot(a, b);
      let h = (Math.atan2(b, a) * 180) / Math.PI;
      if (h < 0) h += 360;
      const cb = edges.filter((e) => c >= e).length;
      const hb = cb === 0 ? 0 : Math.floor(h / 15) % 24;
      const lb = Math.min(9, Math.floor(l * 10));
      const key = (hb * 7 + cb) * 10 + lb;
      bins.set(key, (bins.get(key) ?? 0) + 1);
      n++;
    }
  }
  const round3 = (v) => Math.round(v * 1000) / 1000;
  return [...bins].map(([key, count]) => {
    const lb = key % 10;
    const cb = Math.floor(key / 10) % 7;
    const hb = Math.floor(key / 70);
    const c = centres[cb];
    const h = (((hb + 0.5) * 15) * Math.PI) / 180;
    return { lab: [round3((lb + 0.5) / 10), round3(c * Math.cos(h)), round3(c * Math.sin(h))], weight: count / n };
  }).filter((bin) => bin.weight >= minWeight).sort((p, q) => q.weight - p.weight).map((bin) => ({ ...bin, weight: round3(bin.weight) }));
}

/**
 * A palette as the colours of the painting, not of the photo: its paper (the lightest big colour that is almost grey:
 * chroma under `paperChroma`, lightness over `paperMin`, at least `paperShare` of the picture) is found, every colour
 * near it (OKLab distance under `near`) is marked `paper: true`, and the tint and the exposure of the photo are taken
 * out: every colour is moved by the tint of the paper (a white balance) and its lightness scaled so the paper is
 * white. Without such a paper (a dark or a cut-out work) the palette stays as it is.
 */
export function balancePalette(palette, { paperChroma = 0.05, paperMin = 0.55, paperShare = 0.08, near = 0.06 } = {}) {
  const paper = paperOf(palette, { paperChroma, paperMin, paperShare });
  if (!paper) return palette.map((c) => ({ ...c, paper: false }));
  const d = (p, q) => Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
  const round3 = (v) => Math.round(v * 1000) / 1000;
  return palette.map((c) => ({
    ...c,
    lab: [Math.min(1, c.lab[0] / paper[0]), c.lab[1] - paper[1], c.lab[2] - paper[2]].map(round3),
    paper: d(c.lab, paper) < near,
  }));
}

/**
 * The shares of the colours of `families` in the painted part of a work (`colours`: its histogram or palette; the paper,
 * marked `paper`, left out): { <id>: share of the painted part }; grey places count to the painted part but to no colour.
 */
export function familyShares(colours, families, options = {}) {
  const shares = {};
  let painted = 0;
  for (const { lab, weight, paper } of colours) {
    if (paper) continue;
    painted += weight;
    const family = nearestFamily(lab, families, options);
    if (family) shares[family] = (shares[family] ?? 0) + weight;
  }
  return Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, Math.round((v / (painted || 1)) * 1000) / 1000]));
}

/**
 * The mood of a palette, each from -1 to 1 over its coloured part (the paper left out: marked by balancePalette, or
 * light and grey): `warm` (red, orange, yellow against blue and green), `light` (light against dark), `vivid`
 * (saturated against pastel and muted). `vividAt`: the chroma of a colour that is neither (watercolour is pale).
 */
export function paletteMood(palette, { paper = 0.88, chroma = 0.035, vividAt = 0.05 } = {}) {
  let weight = 0;
  let warm = 0;
  let light = 0;
  let vivid = 0;
  for (const { lab, weight: w, paper: isPaper } of palette) {
    const [l, a, b] = lab;
    const c = Math.hypot(a, b);
    if (isPaper || (c < chroma && l > paper)) continue;
    weight += w;
    // warm: towards red and yellow (a > 0, b > 0), cool: towards blue and green; scaled by how coloured it is
    warm += w * Math.max(-1, Math.min(1, ((a + b) / 0.1) * Math.min(1, c / 0.04)));
    light += w * Math.max(-1, Math.min(1, (l - 0.6) / 0.3));
    vivid += w * Math.max(-1, Math.min(1, (c - vividAt) / vividAt));
  }
  const round2 = (v) => Math.round((weight ? v / weight : 0) * 100) / 100;
  return { warm: round2(warm), light: round2(light), vivid: round2(vivid) };
}

/**
 * How far apart two palettes are (0 = the same): every colour of one to the nearest of the other in OKLab, weighted by
 * its share, both ways and averaged (a symmetric chamfer distance). The paper (marked by balancePalette, or light and
 * grey) counts less (`paperWeight`): two works on white paper are not alike for the white alone.
 */
export function paletteDistance(a, b, { paperWeight = 0.3, paper = 0.88, chroma = 0.035 } = {}) {
  if (!a.length || !b.length) return Infinity;
  const isPaper = (c) => c.paper || (c.lab[0] > paper && Math.hypot(c.lab[1], c.lab[2]) < chroma);
  const d = (p, q) => Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
  const oneWay = (from, to) => {
    let sum = 0;
    let weight = 0;
    for (const c of from) {
      const w = c.weight * (isPaper(c) ? paperWeight : 1);
      sum += w * Math.min(...to.map((t) => d(c.lab, t.lab)));
      weight += w;
    }
    return weight ? sum / weight : 0;
  };
  return Math.round(((oneWay(a, b) + oneWay(b, a)) / 2) * 1000) / 1000;
}

/**
 * How far apart two works are by their colour families and mood (0 = the same, about 1 = nothing in common): half the
 * sum of the differences of the shares of every family (shares of the painted part, the paper left out: familyShares
 * without `papir`, normalised), plus `moodWeight` × the average difference of the three moods (paletteMood, each from
 * -1 to 1). Coarser than paletteDistance but it tells works apart even when most of both is pale paint on paper.
 */
export function colourDistance(a, b, { moodWeight = 0.5 } = {}) {
  const painted = (shares) => {
    const { papir: _paper, ...rest } = shares;
    const sum = Object.values(rest).reduce((x, y) => x + y, 0) || 1;
    return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v / sum]));
  };
  const [pa, pb] = [painted(a.shares), painted(b.shares)];
  const families = new Set([...Object.keys(pa), ...Object.keys(pb)]);
  let diff = 0;
  for (const f of families) diff += Math.abs((pa[f] ?? 0) - (pb[f] ?? 0));
  const mood = ['warm', 'light', 'vivid'].reduce((sum, k) => sum + Math.abs((a.mood[k] ?? 0) - (b.mood[k] ?? 0)), 0) / 6;
  return Math.round((diff / 2 + moodWeight * mood) * 1000) / 1000;
}

/**
 * The colours of a picture as info.json keeps them (raw pixels as workPalette, with alpha: the surroundings of a cut-out
 * work stay out): { version (COLOUR_VERSION), paper (paperFromEdge, OKLab or null), bins: [[l, a, b, weight], …]
 * (colourHistogram balanced by the paper) }.
 */
export function analyseColours(pixels) {
  const paper = paperFromEdge(pixels);
  return { version: COLOUR_VERSION, paper, bins: colourHistogram(pixels, paper).map((b) => [...b.lab, b.weight]) };
}

/**
 * The bins of the colours of a work (info.json `colors`, analyseColours) as the functions here take them:
 * [{ lab, weight, paper }], a bin light and almost grey (lightness from `paper`, chroma under `chroma`) is the paper.
 * Nothing without an analysis.
 */
export function colourBins(colors, { paper = 0.88, chroma = 0.02 } = {}) {
  if (!Array.isArray(colors?.bins)) return [];
  return colors.bins.map(([l, a, b, weight]) => ({ lab: [l, a, b], weight, paper: l >= paper && Math.hypot(a, b) < chroma }));
}

/** Whether a work needs its colours analysed: none yet in its info.json, or from an older analysis (COLOUR_VERSION). */
export const needsColours = (info) => info?.colors?.version !== COLOUR_VERSION;

/**
 * The colours a visitor can find a work by (the filter „Barva“): the ids of the colours of `settings` (colourSettings)
 * that have at least `minShare` of its painted part, the biggest first. `colors`: its info.json `colors`; none without.
 */
export function workColourIds(colors, settings, options = {}) {
  const shares = familyShares(colourBins(colors, options), settings.families, options);
  return Object.entries(shares).filter(([, share]) => share >= settings.minShare).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
