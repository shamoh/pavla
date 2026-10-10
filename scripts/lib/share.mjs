// "Sdílet" on the page of a work: plain links to the sharing forms of a few services (no scripts of theirs, no
// cookies on the site), and a button that shares the link natively (phone) or copies it (src/lib/share-button.ts).
// Every click is the GA event `share` with `method` = the service (scripts/lib/analytics.mjs).

import { pinSaveUrl } from './pinterest.mjs';

export { SHARE_COPY, SHARE_NATIVE } from './analytics.mjs';

/**
 * Links to share a work: [{ method, label, href }] in the order shown.
 * `url`: the address of its page, `media`: its picture for Pinterest (the pin), `title`, `description` (of the pin).
 */
export function shareLinks({ url, media, title, description }) {
  const text = [title, url].filter(Boolean).join(' ');
  return [
    { method: 'pinterest', label: 'Uložit na Pinterest', href: pinSaveUrl({ url, media, description }) },
    { method: 'facebook', label: 'Sdílet na Facebooku', href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}` },
    { method: 'whatsapp', label: 'Poslat přes WhatsApp', href: `https://wa.me/?${new URLSearchParams({ text })}` },
  ];
}
