// The share image of the page of the game Detail dne (/detail-dne/og-<fingerprint>.jpg, og:image): three close-ups of works of the
// site drawn while it is built (scripts/lib/detail-game-share.mjs, gameShareImage).
import path from 'node:path';
import { siteDataRoot } from '../../lib/site';
import { gameShareImage } from '../../lib/detail-game-works';
import { renderGameShare } from '../../../scripts/lib/detail-game-share.mjs';

export function getStaticPaths() {
  const image = gameShareImage();
  return image ? [{ params: { file: image.name } }] : [];
}

export async function GET() {
  const image = gameShareImage()!;
  const jpeg = await renderGameShare(image.parts, path.join(siteDataRoot, 'public'), image.size);
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } });
}
