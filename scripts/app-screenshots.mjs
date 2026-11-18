// Screenshots of the site for the install dialog (APP_SCREENSHOTS of scripts/lib/favicons.mjs, site.webmanifest):
// Chrome without a window, driven over the DevTools protocol, opens each page of a running build as a phone (mobile
// viewport, touch) or a computer, and the picture goes to <out>/<file> as WebP (--out, default .app-screenshots/, out of
// git). The deploy takes them once a week and copies them into dist/ (.github/workflows/deploy.yml). Statistics are cut off (their hosts
// resolve nowhere), so nothing is counted; the floating "Napište mi" is hidden.
//   npm run build && npx astro preview        (the real site)  then in another terminal:
//   npm run app-screenshots -- [http://localhost:4321] [--out <dir>]
// Chrome: CHROME=<path to the binary>, default the usual place on macOS; in CI without its sandbox (the runner forbids it).
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { APP_SCREENSHOTS, SCREENSHOT_FORMS } from './lib/favicons.mjs';

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outDir = path.resolve(outAt >= 0 ? args[outAt + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.app-screenshots'));
const origin = (args.find((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1)) ?? 'http://localhost:4321').replace(/\/$/, '');
await fs.mkdir(outDir, { recursive: true });
/** After the page has loaded: time for fonts, pictures and the scripts that lay out the page. */
const SETTLE_MS = 2500;

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'app-screenshots-'));
const browser = spawn(chrome, [
  '--headless=new', '--hide-scrollbars', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  ...(process.env.CI ? ['--no-sandbox'] : []),
  '--host-resolver-rules=MAP *.googletagmanager.com ~NOTFOUND, MAP *.google-analytics.com ~NOTFOUND', 'about:blank',
], { stdio: 'ignore' });

/** The DevTools address Chrome writes into its profile once it listens. */
async function devtoolsUrl() {
  for (let i = 0; i < 100; i++) {
    const text = await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    const [port] = text.split('\n');
    if (port) {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return targets.find((t) => t.type === 'page').webSocketDebuggerUrl;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Chrome did not start (CHROME=…?)');
}

const socket = new WebSocket(await devtoolsUrl());
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let next = 0;
const waiting = new Map();
const listeners = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && waiting.has(message.id)) {
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else if (listeners.has(message.method)) listeners.get(message.method)(message.params);
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++next;
  waiting.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const once = (method) => new Promise((resolve) => listeners.set(method, resolve));

try {
  await send('Page.enable');
  // The floating "Napište mi" (and its hint bubble) would cover the works: left out of the pictures.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "addEventListener('DOMContentLoaded', () => document.head.append(Object.assign(document.createElement('style'), { textContent: '[data-message-panel] { display: none !important; }' })));",
  });
  for (const shot of APP_SCREENSHOTS) {
    const form = SCREENSHOT_FORMS[shot.form];
    const mobile = shot.form === 'narrow';
    await send('Emulation.setDeviceMetricsOverride', { width: form.width, height: form.height, deviceScaleFactor: form.ratio, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: `${origin}${shot.path}` });
    await loaded;
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await sharp(Buffer.from(data, 'base64'))
      .resize(Math.round(form.width * form.ratio), Math.round(form.height * form.ratio), { fit: 'cover', position: 'top' })
      .webp({ quality: 82 }).toFile(path.join(outDir, shot.file));
    console.log(`✓ ${path.relative(process.cwd(), path.join(outDir, shot.file))} (${shot.path}, ${shot.form})`);
  }
} finally {
  socket.close();
  browser.kill();
  await new Promise((r) => setTimeout(r, 300));
  await fs.rm(profile, { recursive: true, force: true });
}
