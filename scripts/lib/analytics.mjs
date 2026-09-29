// Visitor statistics: Google Analytics 4 (gtag.js), configured by analytics.googleMeasurementId in site.config.yaml.
// Only the production build of the real site measures: never `astro dev`, never the site from the test data.
// GA stores its usual first-party cookies (_ga, _ga_<id>), so returning visitors are recognised.

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
