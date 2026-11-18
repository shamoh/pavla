// Launch screens of the installed app on iPhone and iPad (/splash/apple-splash-<scheme>-<w>x<h>.png), drawn while
// the site is built from the home screen icon and the fonts of the site (scripts/lib/splash.mjs).
import fs from 'node:fs/promises';
import path from 'node:path';
import { site } from '../../lib/site';
import { renderSplash, splashScreens } from '../../../scripts/lib/splash.mjs';
import { loadFonts } from '../../../scripts/lib/instagram.mjs';

// The repository, not the bundled module (the build moves it): the icon and the fonts are read from there.
const root = process.cwd();
let shared: Promise<{ homeSvg: Buffer; fonts: Awaited<ReturnType<typeof loadFonts>> }> | null = null;
const inputs = () => (shared ??= (async () => ({
  homeSvg: await fs.readFile(path.join(root, 'scripts/home-screen-icon.svg')),
  fonts: await loadFonts(path.join(root, 'fonts')),
}))());

export function getStaticPaths() {
  return splashScreens().map((screen) => ({ params: { file: screen.file }, props: { screen } }));
}

export async function GET({ props }: { props: { screen: ReturnType<typeof splashScreens>[number] } }) {
  const png = await renderSplash(props.screen, { ...(await inputs()), title: site.title, tagline: site.tagline });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
