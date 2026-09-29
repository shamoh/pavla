import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gtagConfigScript, gtagSrc, isMeasurementId, measurementIdFor } from './analytics.mjs';

const analytics = { googleMeasurementId: 'G-HPZNHYZ2MQ' };

test('measurementIdFor: only the production build of the real site measures', () => {
  assert.equal(measurementIdFor(analytics, { production: true, demo: false }), 'G-HPZNHYZ2MQ');
  assert.equal(measurementIdFor(analytics, { production: false, demo: false }), null, 'dev server');
  assert.equal(measurementIdFor(analytics, { production: true, demo: true }), null, 'site from the test data');
});

test('measurementIdFor: no ID means no statistics, a broken ID is an error', () => {
  for (const a of [undefined, null, {}, { googleMeasurementId: '' }, { googleMeasurementId: null }]) {
    assert.equal(measurementIdFor(a, { production: true, demo: false }), null);
  }
  for (const id of ['UA-12345-1', 'g-hpznhyz2mq', 'G-HPZ NHY', 'G-HPZNHYZ2MQ"><script>', 42]) {
    assert.throws(() => measurementIdFor({ googleMeasurementId: id }, { production: true, demo: false }), /must look like G-/);
  }
});

test('isMeasurementId accepts GA4 IDs only', () => {
  assert.equal(isMeasurementId('G-HPZNHYZ2MQ'), true);
  assert.equal(isMeasurementId('G-94EC5C6TB0'), true);
  assert.equal(isMeasurementId('GTM-ABC123'), false);
  assert.equal(isMeasurementId(undefined), false);
});

test('gtag: loader URL and the config from the installation guide (the page is reported with its query string)', () => {
  assert.equal(gtagSrc('G-HPZNHYZ2MQ'), 'https://www.googletagmanager.com/gtag/js?id=G-HPZNHYZ2MQ');
  const script = gtagConfigScript('G-HPZNHYZ2MQ');
  assert.match(script, /window\.dataLayer = window\.dataLayer \|\| \[\];/);
  assert.match(script, /gtag\('config', 'G-HPZNHYZ2MQ'\);$/);
  assert.doesNotMatch(script, /page_location/);
  assert.throws(() => gtagConfigScript("G-X');alert(1);//"), /invalid measurement ID/);
});
