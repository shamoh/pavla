// Visitor statistics: Google Analytics 4 (gtag.js), configured by analytics.googleMeasurementId in site.config.yaml.
// Only the production build of the real site measures: never `astro dev`, never the site from the test data.
// GA stores its usual first-party cookies (_ga, _ga_<id>), so returning visitors are recognised.
// Own events (sent from the browser, see EVENTS): a filter change in the gallery and clicks on the buttons
// of a work ("Koupit na Fleru", "Napsat autorce"). This module runs both in the build and in the browser.

import { FILTER_KEYS } from './gallery-filter.mjs';

/** A GA4 measurement ID, e.g. "G-HPZNHYZ2MQ". */
export const isMeasurementId = (id) => typeof id === 'string' && /^G-[A-Z0-9]{4,16}$/.test(id);

/**
 * The measurement ID to put into the pages, or null when this build must not measure.
 * `production`: a production build (not the dev server); `demo`: the site is built from the test data.
 * An ID that is set but invalid is an error, so a typo does not silently switch the statistics off.
 */
export function measurementIdFor(analytics, { production, demo }) {
  const id = analytics?.googleMeasurementId;
  if (id === undefined || id === null || id === '') return null;
  if (!isMeasurementId(id)) throw new Error(`analytics.googleMeasurementId must look like G-XXXXXXXXXX, got ${JSON.stringify(id)}`);
  return production && !demo ? id : null;
}

/** URL of the gtag.js loader. */
export const gtagSrc = (id) => `https://www.googletagmanager.com/gtag/js?id=${id}`;

/**
 * Inline script that configures gtag, as in the Google Analytics installation guide. The page is reported with
 * its query string, so gallery filters and paging (?status=…&page=2) can be told apart in the reports
 * ("Page path + query string"), while "Page path and screen class" adds them up per page.
 */
export function gtagConfigScript(id) {
  if (!isMeasurementId(id)) throw new Error(`invalid measurement ID ${JSON.stringify(id)}`);
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('config', '${id}');`,
  ].join('\n');
}

/** Names of the own events; their parameters must be registered as custom dimensions in GA (see README). */
export const EVENTS = {
  filter: 'gallery_filter', // tag, technique, year, collection, status (only the active ones), results
  fler: 'fler_click', // work_id, work_title
  email: 'email_click', // the address on the contact page; "Napsat autorce" of a work (work_id, work_title) without messages
  message: 'message_sent', // message_type, work_id and work_title (a message about a work)
  palette: 'palette_change', // palette: the chosen colours (papir, pergamen, noc, auto)
};

/** Parameters of gallery_filter: the active filters (empty ones left out) and how many works match. */
export function filterEventParams(state, results) {
  const params = {};
  for (const key of FILTER_KEYS) if (state[key]) params[key] = String(state[key]);
  params.results = results;
  return params;
}

/**
 * The event of a clicked element marked with data-track="<event>" (and data-work-id, data-work-title),
 * or null when it is not one of our events.
 */
export function trackedClick(dataset) {
  const name = dataset?.track;
  if (!Object.values(EVENTS).includes(name)) return null;
  const params = {};
  if (dataset.workId) params.work_id = dataset.workId;
  if (dataset.workTitle) params.work_title = dataset.workTitle;
  return { name, params };
}

/**
 * Sends an event to GA. Without the Google tag (dev server, test data) nothing is sent; the event is only
 * logged to the console (level "Verbose"/debug), so it can be checked locally.
 */
export function trackEvent(name, params, w = globalThis) {
  if (typeof w.gtag === 'function') w.gtag('event', name, params);
  else w.console?.debug?.('[analytics]', name, params);
}
