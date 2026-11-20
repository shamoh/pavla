// Launch screens of the installed app on iPhone and iPad (/splash/apple-splash-<scheme>-<w>x<h>.png), drawn while
// the site is built from the home screen icon and the fonts of the site (scripts/lib/splash.mjs).
import fs from 'node:fs/promises';
import { site, siteDir } from '../../lib/site';
import { renderSplash, splashScreens } from '../../../scripts/lib/splash.mjs';
import { loadFonts } from '../../../scripts/lib/instagram.mjs';
import { sitePaths } from '../../../scripts/lib/site-dir.mjs';

// The icon and the fonts of the site, from the folder of the site.
const paths = sitePaths(siteDir);
let shared: Promise<{ homeSvg: Buffer; fonts: Awaited<ReturnType<typeof loadFonts>> }> | null = null;
const inputs = () => (shared ??= (async () => ({
  homeSvg: await fs.readFile(paths.homeScreenIcon),
  fonts: await loadFonts(paths.fonts),
}))());

export function getStaticPaths() {
  return splashScreens().map((screen) => ({ params: { file: screen.file }, props: { screen } }));
}

export async function GET({ props }: { props: { screen: ReturnType<typeof splashScreens>[number] } }) {
  const png = await renderSplash(props.screen, { ...(await inputs()), title: site.title, tagline: site.tagline });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
