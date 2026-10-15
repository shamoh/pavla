// Marks over the pictures of the tiles view (WorkCard.astro, shown only with tiles, never with big pictures, where the
// title has the star and the card the status chip): a star for the author's selection (`featured`) and a cart for
// a work on sale (isOnSale). A silhouette in the ink colour of the palette with a thin rim of the paper colour, so it
// reads on light and dark pictures alike. Settings in site.config.yaml, each place on its own: `home.tileMarks` for the
// home page, `gallery.tileMarks` for galleries, years and collections (tileMarksFor).

/** Corners of a picture a mark can sit in: top left, top right, bottom left, bottom right. */
export const MARK_CORNERS = ['tl', 'tr', 'bl', 'br'];

/** Own simple silhouettes (24 × 24, currentColor): the star of the selection and the icons a work on sale can have. */
export const MARK_ICONS = {
  star: '<path fill="currentColor" d="M12 2.2l2.95 6.1 6.7.85-4.9 4.65 1.25 6.65L12 17.2l-6 3.25 1.25-6.65L2.35 9.15l6.7-.85z"/>',
  cart: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M2.5 3.5h2.6l2.4 11.2h10.3l2.2-7.7H6.4"/><circle cx="9" cy="19.3" r="1.8" fill="currentColor"/><circle cx="16.6" cy="19.3" r="1.8" fill="currentColor"/>',
  tag: '<path fill="currentColor" fill-rule="evenodd" d="M3 4.2C3 3.54 3.54 3 4.2 3h7.3c.32 0 .62.13.85.35l8.6 8.6c.47.47.47 1.23 0 1.7l-7.3 7.3c-.47.47-1.23.47-1.7 0l-8.6-8.6A1.2 1.2 0 0 1 3 11.5V4.2zM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/>',
  bag: '<path fill="currentColor" fill-rule="evenodd" d="M8.5 7V6a3.5 3.5 0 0 1 7 0v1h2.6c.6 0 1.1.46 1.15 1.06l1 12A1.15 1.15 0 0 1 19.1 21.3H4.9a1.15 1.15 0 0 1-1.15-1.24l1-12C4.8 7.46 5.3 7 5.9 7h2.6zm1.8 0h3.4V6a1.7 1.7 0 0 0-3.4 0v1z"/>',
};

/** Icons a work on sale can have (site.config.yaml tileMarks.sale.icon). */
export const SALE_ICONS = ['cart', 'tag', 'bag'];

const TILE_SIZES = ['s', 'm', 'l'];

/**
 * The defaults: the mark 10 % of the tile width, at least 12 px and at most 22 px, 90 % opaque; the star top left on
 * every tile size, the cart bottom right only on medium and large tiles (small ones are too small for two marks).
 */
export const TILE_MARK_DEFAULTS = {
  size: 10,
  min: 12,
  max: 22,
  opacity: 90,
  featured: { corner: 'tl', tiles: ['s', 'm', 'l'] },
  sale: { corner: 'br', icon: 'cart', tiles: ['m', 'l'] },
};

/** Where the mark settings apply: the home page, the galleries (years, collections, /tvorba/). */
export const MARK_PLACES = ['home', 'gallery'];

/**
 * The mark settings of `place` from site.config.yaml (`config`): its `<place>.tileMarks`, missing ones from
 * TILE_MARK_DEFAULTS. A top-level `tileMarks` (shared by both before) is an error, so it is never silently ignored.
 */
export function tileMarksFor(config, place) {
  if (!MARK_PLACES.includes(place)) throw new Error(`unknown place of tile marks ${JSON.stringify(place)}`);
  if (config?.tileMarks !== undefined) throw new Error('site.config.yaml tileMarks: moved to home.tileMarks and gallery.tileMarks, each on its own');
  return tileMarks(config?.[place]?.tileMarks, `${place}.tileMarks`);
}

/** The settings `raw` (at `at` in site.config.yaml), missing ones from TILE_MARK_DEFAULTS; a bad or unknown value = error (the build stops). */
export function tileMarks(raw, at = 'tileMarks') {
  const where = (key) => `site.config.yaml ${at}.${key}`;
  const bad = (key, what, value) => new Error(`${where(key)} must be ${what}, got ${JSON.stringify(value)}`);
  const known = (object, keys, path) => {
    const unknown = Object.keys(object ?? {}).filter((k) => !keys.includes(k));
    if (unknown.length) throw new Error(`site.config.yaml ${at}${path}: unknown ${unknown.join(', ')}`);
  };
  known(raw, Object.keys(TILE_MARK_DEFAULTS), '');
  const out = {};
  for (const [key, low, high] of [['size', 1, 50], ['min', 0, 100], ['max', 0, 100], ['opacity', 0, 100]]) {
    const value = raw?.[key] ?? TILE_MARK_DEFAULTS[key];
    if (typeof value !== 'number' || !(value >= low && value <= high)) throw bad(key, `a number from ${low} to ${high}`, value);
    out[key] = value;
  }
  if (out.min > out.max) throw bad('min', `at most max (${out.max})`, out.min);
  for (const mark of ['featured', 'sale']) {
    const fields = mark === 'sale' ? ['corner', 'icon', 'tiles'] : ['corner', 'tiles'];
    known(raw?.[mark], fields, `.${mark}`);
    const value = { ...TILE_MARK_DEFAULTS[mark], ...(raw?.[mark] ?? {}) };
    if (!MARK_CORNERS.includes(value.corner)) throw bad(`${mark}.corner`, `one of ${MARK_CORNERS.join(', ')}`, value.corner);
    if (mark === 'sale' && !SALE_ICONS.includes(value.icon)) throw bad('sale.icon', `one of ${SALE_ICONS.join(', ')}`, value.icon);
    if (!Array.isArray(value.tiles) || value.tiles.some((t) => !TILE_SIZES.includes(t))) {
      throw bad(`${mark}.tiles`, `a list of tile sizes (${TILE_SIZES.join(', ')}, none = never)`, value.tiles);
    }
    out[mark] = { ...value, tiles: TILE_SIZES.filter((t) => value.tiles.includes(t)) };
  }
  return out;
}

/**
 * The marks of `work` ({ featured, onSale }): [{ kind, corner, tiles, icon, beside }], `beside` = a second mark in the
 * same corner, drawn next to the first one.
 */
export function workMarks({ featured, onSale }, marks) {
  const out = [];
  if (featured && marks.featured.tiles.length) out.push({ kind: 'featured', corner: marks.featured.corner, tiles: marks.featured.tiles, icon: 'star', beside: false });
  if (onSale && marks.sale.tiles.length) {
    const beside = out.some((m) => m.corner === marks.sale.corner);
    out.push({ kind: 'sale', corner: marks.sale.corner, tiles: marks.sale.tiles, icon: marks.sale.icon, beside });
  }
  return out;
}
