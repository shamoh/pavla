// Where the paper sheet lies in a master photo that also shows some of its surroundings (npm run straighten
// keeps a margin of the floor so the paper edges are visible). The box is written into the JPEG as XMP
// metadata, so it travels with the file (renames, uploads), and the pipeline crops the master to the bare
// sheet where the surroundings must not appear: in the mockups (the work in a frame on a wall).
//
// Box: [left, top, right, bottom] as fractions 0–1 of the image width and height.

const NS = 'https://pavla.kramolis.cz/ns/1.0/';

/** XMP packet with the sheet box. */
export function sheetXmp([l, t, r, b]) {
  const v = [l, t, r, b].map((n) => n.toFixed(5)).join(' ');
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`
    + `<rdf:Description rdf:about="" xmlns:pavla="${NS}" pavla:sheet="${v}"/></rdf:RDF></x:xmpmeta>`;
}

/** Sheet box from XMP metadata (Buffer or string), or null when there is none or it is not a valid box. */
export function parseSheetXmp(xmp) {
  if (!xmp) return null;
  const m = /pavla:sheet="([^"]*)"/.exec(String(xmp));
  if (!m) return null;
  const box = m[1].trim().split(/\s+/).map(Number);
  const [l, t, r, b] = box;
  return box.length === 4 && box.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) && l < r && t < b ? box : null;
}

/** The box after rotating the image by `deg` (90 = clockwise, -90/270, 180). */
export function rotateBox([l, t, r, b], deg) {
  switch (((deg % 360) + 360) % 360) {
    case 90: return [1 - b, l, 1 - t, r];
    case 180: return [1 - r, 1 - b, 1 - l, 1 - t];
    case 270: return [t, 1 - r, b, 1 - l];
    default: return [l, t, r, b];
  }
}

/** Pixel region of the box in an image of width × height, for sharp's extract(). */
export function boxRegion([l, t, r, b], width, height) {
  const left = Math.round(l * width), top = Math.round(t * height);
  return { left, top, width: Math.max(1, Math.round(r * width) - left), height: Math.max(1, Math.round(b * height) - top) };
}
