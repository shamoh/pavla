import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENTS, filterEventParams, gtagConfigScript, gtagSrc, isMeasurementId, measurementIdFor, trackEvent, trackedClick,
} from './analytics.mjs';

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

test('filterEventParams: only the active filters, always the number of matching works', () => {
  const state = { tag: ['krajina'], technique: '', year: '2026', collection: '', status: 'unsold', page: 2, perPage: 24 };
  assert.deepEqual(filterEventParams(state, 5), { tag: 'krajina', year: '2026', status: 'unsold', results: 5 });
  assert.deepEqual(filterEventParams({ tag: [], technique: '', year: '', collection: '', status: '' }, 21), { results: 21 });
  assert.deepEqual(filterEventParams({ collection: '2026-plener-sumava', technique: 'akvarel' }, 0), { technique: 'akvarel', collection: '2026-plener-sumava', results: 0 });
  assert.deepEqual(filterEventParams({ tag: ['krajina', 'voda'] }, 2), { tag: 'krajina,voda', results: 2 }, 'several tags in one value');
  assert.deepEqual(filterEventParams({ tag: [], featured: '1' }, 4), { featured: '1', results: 4 }, 'the author\'s selection too');
});

test('trackedClick: the buttons of a work with its id and title, nothing for other elements', () => {
  assert.deepEqual(trackedClick({ track: EVENTS.fler, workId: 'k4ts5', workTitle: 'Malý a Velký Roklan' }),
    { name: 'fler_click', params: { work_id: 'k4ts5', work_title: 'Malý a Velký Roklan' } });
  assert.deepEqual(trackedClick({ track: EVENTS.email, workId: 'k4ts5' }), { name: 'email_click', params: { work_id: 'k4ts5' } });
  assert.equal(trackedClick({ track: 'something_else' }), null);
  assert.equal(trackedClick({}), null);
  assert.equal(trackedClick(undefined), null);
});

test('trackEvent: sends through gtag when the Google tag is on the page, otherwise only logs', () => {
  const sent = [];
  trackEvent('fler_click', { work_id: 'k4ts5' }, { gtag: (...args) => sent.push(args) });
  assert.deepEqual(sent, [['event', 'fler_click', { work_id: 'k4ts5' }]]);

  const logged = [];
  trackEvent('gallery_filter', { results: 3 }, { console: { debug: (...args) => logged.push(args) } });
  assert.deepEqual(logged, [['[analytics]', 'gallery_filter', { results: 3 }]]);
  assert.doesNotThrow(() => trackEvent('gallery_filter', {}, {}));
});
