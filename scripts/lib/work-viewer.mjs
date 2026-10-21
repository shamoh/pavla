// Addresses of the pictures in the viewer of a work page: /tvorba/<year>/<slug>-<id>/#<view>, where <view> is
// "obraz" (the work itself), "detail-<detail name>" or "mockup-<scene>". A link with it opens that picture directly;
// an unknown one leaves the page as it is and drops the hash.

/** The view of the work itself. */
export const MAIN_VIEW = 'obraz';

/** Id of a view in the viewer: { kind: 'main' } | { kind: 'detail' | 'mockup', name } (name = slug of the file). */
export const viewId = ({ kind, name }) => (kind === 'main' ? MAIN_VIEW : `${kind}-${name}`);

/** The id a location hash names ("#detail-oci" → "detail-oci"), '' without one or when it cannot be decoded. */
export function hashId(hash) {
  try {
    return decodeURIComponent(String(hash ?? '').replace(/^#/, ''));
  } catch {
    return '';
  }
}

/** Index in `ids` (view ids in the order of the viewer) of the view a location hash names, or -1. */
export function viewIndex(hash, ids) {
  const id = hashId(hash);
  return id ? ids.indexOf(id) : -1;
}
