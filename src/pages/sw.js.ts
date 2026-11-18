// Service worker of the site (/sw.js): offline copies of what a visitor has seen, one version per build
// (scripts/lib/app-install.mjs swScript). Registered by src/lib/app-install.ts in production builds.
import { version } from '../lib/site';
import { swScript } from '../../scripts/lib/app-install.mjs';

export function GET() {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return new Response(swScript(version.label, base), { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
}
