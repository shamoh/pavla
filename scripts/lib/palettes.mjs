// Colour palettes of the site ("Papír", "Pergamen", "Noc") and the visitor's choice of one of them.
// Every colour of the pages comes from these tokens (CSS custom properties); a new palette is one more entry in
// PALETTES and nothing else: the CSS, the switcher in the footer and the contrast check follow from the list.
// The choice ("auto" = light or dark by the system) is kept in localStorage and applied by a small inline script
// in <head> before the page is painted, so it never flashes. Used by src/layouts/Base.astro and PalettePicker.astro.

/**
 * The palettes, in the order of the switcher. `scheme`: light or dark (form controls, scrollbars of the browser).
 * Tokens: paper = background, paper2 = surfaces (chips, hover), ink = text, inkSoft = quiet text, line = rules and
 * borders, accent = links and highlights, ok = "for sale", error = form errors.
 * `picture`: how pictures lift off the page: `shadow` = strength of their (black) shadow, 1 = as on light paper;
 * `edge` = a hairline around them (CSS colour) where a shadow alone would not show the edge (dark paper), or null.
 */
export const PALETTES = [
  {
    id: 'papir', label: 'Papír', scheme: 'light',
    colors: { paper: '#f7f4ee', paper2: '#efeae0', ink: '#2b2724', inkSoft: '#6d655c', line: '#ddd5c7', accent: '#487282', ok: '#4b7556', error: '#a4513c' },
    picture: { shadow: 1, edge: null },
  },
  {
    id: 'pergamen', label: 'Pergamen', scheme: 'light',
    colors: { paper: '#ece2cc', paper2: '#e2d6bb', ink: '#2e2720', inkSoft: '#62574a', line: '#cfbf9e', accent: '#3a6573', ok: '#41683a', error: '#99442f' },
    picture: { shadow: 1.2, edge: null },
  },
  {
    id: 'noc', label: 'Noc', scheme: 'dark',
    colors: { paper: '#1c1a18', paper2: '#252220', ink: '#ece6dc', inkSoft: '#a89f93', line: '#3a3531', accent: '#8fb7c4', ok: '#93bf9c', error: '#e0937d' },
    picture: { shadow: 2.2, edge: 'rgb(255 255 255 / 0.08)' },
  },
];

/** The choice that follows the system: the first light palette by day, the first dark one at night. */
export const AUTO = 'auto';
/** Key in localStorage; nothing stored = AUTO. */
export const PALETTE_KEY = 'pavla.palette';

/** CSS custom property of a token: inkSoft -> --ink-soft, paper2 -> --paper-2. */
export const tokenVar = (token) => `--${token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()}`;

/** Text tokens that must be readable on the background (WCAG AA for normal text: 4.5 : 1). */
export const TEXT_TOKENS = ['ink', 'inkSoft', 'accent', 'ok', 'error'];
export const MIN_CONTRAST = 4.5;

/** WCAG contrast ratio of two #rrggbb colours (1 … 21). */
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Problems of the palettes (empty = fine): missing or invalid colours, duplicate ids, text that is hard to read. */
export function checkPalettes(palettes = PALETTES) {
  const problems = [];
  const tokens = Object.keys(palettes[0]?.colors ?? {});
  const ids = new Set();
  if (!palettes.some((p) => p.scheme === 'light') || !palettes.some((p) => p.scheme === 'dark')) problems.push('need at least one light and one dark palette');
  for (const p of palettes) {
    if (ids.has(p.id) || p.id === AUTO) problems.push(`${p.id}: duplicate or reserved id`);
    ids.add(p.id);
    for (const t of tokens) if (!/^#[0-9a-f]{6}$/i.test(p.colors[t] ?? '')) problems.push(`${p.id}: ${t} must be #rrggbb`);
    if (Object.keys(p.colors).length !== tokens.length) problems.push(`${p.id}: must have exactly the tokens ${tokens.join(', ')}`);
    if (!(p.picture?.shadow > 0)) problems.push(`${p.id}: picture.shadow must be a positive number`);
    for (const t of TEXT_TOKENS) {
      const ratio = /^#[0-9a-f]{6}$/i.test(p.colors[t] ?? '') ? contrast(p.colors[t], p.colors.paper) : 0;
      if (ratio < MIN_CONTRAST) problems.push(`${p.id}: ${t} on paper has contrast ${ratio.toFixed(2)}, needs ${MIN_CONTRAST}`);
    }
  }
  return problems;
}

/** Parameters of the palette_change event (scripts/lib/analytics.mjs EVENTS.palette): what was chosen, auto included. */
export const paletteEventParams = (choice, palettes = PALETTES) => ({
  palette: palettes.some((p) => p.id === choice) ? choice : AUTO,
});

/** The palette shown for a choice: a palette id as it is, otherwise (AUTO, unknown) by the system light/dark. */
export function resolvePalette(choice, prefersDark, palettes = PALETTES) {
  return palettes.find((p) => p.id === choice) ?? palettes.find((p) => p.scheme === (prefersDark ? 'dark' : 'light'));
}

/**
 * Shadows of pictures for a palette: --shadow-soft (cards in the gallery), --shadow-deep (the cover, the work itself).
 * The alphas are those of the light palette times `picture.shadow`; `picture.edge` adds a hairline in front.
 */
export function pictureShadows({ shadow, edge }) {
  const a = (x) => `rgb(0 0 0 / ${Math.min(1, +(x * shadow).toFixed(3))})`;
  const ring = edge ? `0 0 0 1px ${edge}, ` : '';
  return {
    '--shadow-soft': `${ring}0 1px 2px ${a(0.06)}, 0 8px 24px -12px ${a(0.18)}`,
    '--shadow-deep': `${ring}0 2px 4px ${a(0.05)}, 0 24px 48px -24px ${a(0.3)}`,
  };
}

/**
 * How a picture with white paper edges (e.g. the photo on Kontakt) blends into the page: --paper-blend. On light
 * paper `multiply` turns its white into the colour of the paper; on dark paper it would darken the whole picture,
 * so it stays as it is (`normal`).
 */
export const paperBlend = (scheme) => (scheme === 'light' ? 'multiply' : 'normal');

const block = (p) => [
  `color-scheme:${p.scheme}`,
  ...Object.entries(p.colors).map(([t, c]) => `${tokenVar(t)}:${c}`),
  ...Object.entries(pictureShadows(p.picture)).map(([k, v]) => `${k}:${v}`),
  `--paper-blend:${paperBlend(p.scheme)}`,
].join(';');

/**
 * The CSS of all palettes. Without JavaScript the system decides (first light / first dark palette); the script sets
 * data-palette on <html>, whose selector outweighs the plain :root of the media query.
 */
export function paletteCss(palettes = PALETTES) {
  const light = resolvePalette(AUTO, false, palettes);
  const dark = resolvePalette(AUTO, true, palettes);
  return [
    `:root{${block(light)}}`,
    `@media (prefers-color-scheme: dark){:root{${block(dark)}}}`,
    ...palettes.map((p) => `:root[data-palette="${p.id}"]{${block(p)}}`),
  ].join('\n');
}

/**
 * Inline script for <head>: reads the choice, sets data-palette (the palette shown) and data-palette-choice (what was
 * chosen, AUTO included) on <html>, the theme-color of the browser bar, follows the system while on AUTO, and offers
 * window.pavlaPalette.set(choice) to the switcher. Kept small and dependency free; it runs before anything else.
 */
export function paletteScript(palettes = PALETTES) {
  const data = palettes.map((p) => ({ id: p.id, dark: p.scheme === 'dark', bar: p.colors.paper }));
  return `(function(){var P=${JSON.stringify(data)},K=${JSON.stringify(PALETTE_KEY)},A=${JSON.stringify(AUTO)},c=A,h=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');
try{c=localStorage.getItem(K)||A}catch(e){}
function find(id){for(var i=0;i<P.length;i++)if(P[i].id===id)return P[i];return null}
function apply(){var p=find(c);if(!p){c=A;for(var i=0;i<P.length;i++)if(P[i].dark===m.matches){p=P[i];break}}
h.setAttribute('data-palette',p.id);h.setAttribute('data-palette-choice',c);
var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute('content',p.bar);
document.dispatchEvent(new CustomEvent('palettechange',{detail:{choice:c,palette:p.id}}))}
apply();(m.addEventListener?m.addEventListener('change',function(){if(c===A)apply()}):0);
window.pavlaPalette={get:function(){return c},set:function(v){c=find(v)?v:A;try{c===A?localStorage.removeItem(K):localStorage.setItem(K,c)}catch(e){}apply()}}})();`;
}
