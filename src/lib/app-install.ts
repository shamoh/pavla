// The site as an app (scripts/lib/app-install.mjs): the service worker, "Nainstalovat aplikaci" in the footer with its
// how-to dialog, and "←" in the header of the installed app. Run on every page from Base.astro.
import {
  backTarget, buildAssets, GAME_OFFLINE_KEY, gameOfflineFiles, INSTALL_HELP, INSTALL_METHODS, installMode, isIos, isoDay, SW_FILE,
} from '../../scripts/lib/app-install.mjs';
import { EVENTS, trackEvent } from '../../scripts/lib/analytics.mjs';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/**
 * The service worker only in a production build (the deployed site, `npm run demo:build` + preview). The dev server
 * removes one left from a preview on the same address, so it never answers the dev server's requests.
 */
function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) {
    navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister())).catch(() => {});
    return;
  }
  const register = () => navigator.serviceWorker.register(`${base}${SW_FILE}`, { scope: base }).catch(() => {});
  if (document.readyState === 'complete') register();
  else addEventListener('load', register, { once: true });
}

/** "Nainstalovat aplikaci": the browser's prompt when it offers one, else the how-to of the phone, else nothing. */
function installButton() {
  const button = document.querySelector<HTMLButtonElement>('[data-app-install]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-app-help]');
  if (!button || !dialog) return;
  let deferred: InstallPrompt | null = null;
  const mode = () => installMode({
    standalone: standalone(), prompt: Boolean(deferred), ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
    phone: matchMedia('(pointer: coarse)').matches,
  });
  const refresh = () => { button.hidden = mode() === 'hidden'; };
  // Not prevented: the browser may still show its own install bar; the event stays usable for the button.
  addEventListener('beforeinstallprompt', (e) => { deferred = e as InstallPrompt; refresh(); });
  addEventListener('appinstalled', () => {
    deferred = null;
    trackEvent(EVENTS.appInstall, { method: INSTALL_METHODS.installed });
    refresh();
  });
  button.addEventListener('click', async () => {
    const now = mode();
    if (now === 'prompt' && deferred) {
      const asked = deferred;
      deferred = null;
      await asked.prompt();
      const { outcome } = await asked.userChoice;
      trackEvent(EVENTS.appInstall, { method: outcome === 'accepted' ? INSTALL_METHODS.accepted : INSTALL_METHODS.dismissed });
      refresh();
      return;
    }

    if (now === 'ios' || now === 'menu') {
      dialog.querySelector('[data-app-help-text]')!.textContent = INSTALL_HELP[now];
      dialog.showModal();
      trackEvent(EVENTS.appInstall, { method: INSTALL_METHODS[now] });
    }
  });
  refresh();
}

/** "←" in the header of the installed app: back to the previous page of the site, or to the start page. */
function backButton() {
  const button = document.querySelector<HTMLButtonElement>('[data-app-back]');
  if (!button || !standalone()) return;
  const target = backTarget({ pathname: location.pathname, referrer: document.referrer, origin: location.origin, base });
  if (!target) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    if (target === 'history') history.back();
    else location.href = target;
  });
}

/** GET `url` through the service worker (it keeps the answer); the text of a page or a script, else nothing. */
async function keep(url: string, text = false): Promise<string | null> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return text ? response.text() : null;
}

/**
 * Detail dne playable offline: once a day (GAME_OFFLINE_KEY), in the installed app or on the page of the game, the
 * page of the game with its build files, its data, the close-ups of the home page and the pictures of today's and
 * tomorrow's puzzles go through the service worker into its caches. Quietly, after the page has loaded; any failure
 * (offline, a missing file) just tries again on the next page.
 */
async function keepGameOffline() {
  const worker = navigator.serviceWorker?.controller;
  const onGamePage = location.pathname.startsWith(`${base}detail-dne/`);
  if (!worker || !navigator.onLine || !(standalone() || onGamePage)) return;
  const today = isoDay(new Date());
  try { if (localStorage.getItem(GAME_OFFLINE_KEY) === today) return; } catch { return; }
  const page = `${location.origin}${base}detail-dne/`;
  const seen = new Set<string>();
  const assets = async (text: string, from: string) => {
    for (const url of buildAssets(text, from, base)) {
      if (seen.has(url)) continue;
      seen.add(url);
      const body = await keep(url, url.endsWith('.js'));
      if (body) await assets(body, url);
    }
  };
  await assets((await keep(page, true))!, page);
  const data = await (await fetch(`${base}detail-dne/data.json`)).json();
  await keep(`${base}detail-dne/dnes.json`);
  for (const file of gameOfflineFiles(data, [today, isoDay(new Date(), 1)], base)) await keep(file);
  try { localStorage.setItem(GAME_OFFLINE_KEY, today); } catch { /* tried again next time */ }
}

serviceWorker();
installButton();
backButton();
// After the page and its pictures, so it never slows the page down.
const later = () => setTimeout(() => keepGameOffline().catch(() => {}), 3000);
if (document.readyState === 'complete') later();
else addEventListener('load', later, { once: true });
