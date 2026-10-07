import { test } from 'node:test';
import assert from 'node:assert/strict';
import { endsSentence, endsWithFullStop, pageAdvice, startsLowercase, workAdvice } from './advice.mjs';

const good = {
  title: 'Ráno u jezu', tags: ['voda'], description: 'Mlha nad vodou.', details: { mlha: 'Hladina v mlze.' },
  status: 'available', mockups: true,
};
const work = (data, extra = {}) => ({ slug: 'rano', dir: 'plener', data: { ...good, ...data }, ...extra });

test('startsLowercase looks at the first letter, past quotes and brackets; a digit first is fine', () => {
  for (const t of ['ráno', '„ráno“', '(ráno)', 'čáp']) assert.ok(startsLowercase(t), t);
  for (const t of ['Ráno', '„Ráno“', '3 ovce', 'Čáp']) assert.ok(!startsLowercase(t), t);
});

test('endsSentence accepts . ! ? … also before a closing quote; endsWithFullStop only a single full stop', () => {
  for (const t of ['Ráno.', 'Ráno!', 'Ráno?', 'Ráno…', 'Řekla „ráno.“', '(Ráno.)']) assert.ok(endsSentence(t), t);
  for (const t of ['Ráno', 'Ráno,', 'Ráno:']) assert.ok(!endsSentence(t), t);
  assert.ok(endsWithFullStop('Ráno.'));
  for (const t of ['Ráno', 'Ráno...', 'Ráno…', 'Ráno!']) assert.ok(!endsWithFullStop(t), t);
});

test('workAdvice: nothing for a well written work', () => {
  assert.deepEqual(workAdvice([work({})]), []);
});

test('workAdvice: tags, title, description and detail captions, in the file of the work', () => {
  const advice = workAdvice([work({
    tags: [], title: 'ráno u jezu.', description: 'mlha nad vodou', details: { mlha: 'hladina v mlze', most: 'Most.' },
  })]);
  assert.deepEqual(advice, [
    'tvorba/plener/rano.yaml: nemá štítky (tags), podle nich se v galerii filtruje',
    'tvorba/plener/rano.yaml: title začíná malým písmenem',
    'tvorba/plener/rano.yaml: title by neměl končit tečkou',
    'tvorba/plener/rano.yaml: description začíná malým písmenem',
    'tvorba/plener/rano.yaml: description by měl končit tečkou',
    'tvorba/plener/rano.yaml: popisek detailu mlha začíná malým písmenem',
    'tvorba/plener/rano.yaml: popisek detailu mlha by měl končit tečkou',
  ]);
  assert.match(workAdvice([work({ tags: undefined }, { yamlPath: 'tvorba/x.yaml' })])[0], /^tvorba\/x\.yaml: nemá štítky/);
});

test('workAdvice: a work on sale without mockups; sold, not for sale or with mockups is fine', () => {
  assert.deepEqual(workAdvice([work({ mockups: false }), work({ status: 'reserved', mockups: undefined })]).map((a) => a.slice(a.indexOf(': ') + 2)), [
    'je na prodej, ale nemá mockupy (mockups: true ukáže obraz v interiéru na webu i na Fleru)',
    'je na prodej, ale nemá mockupy (mockups: true ukáže obraz v interiéru na webu i na Fleru)',
  ]);
  assert.deepEqual(workAdvice([work({ status: 'sold', mockups: false }), work({ status: 'not-for-sale', mockups: false })]), []);
});

test('workAdvice leaves DOPLNIT texts and empty ones to the checks', () => {
  assert.deepEqual(workAdvice([work({ title: 'DOPLNIT název', description: 'DOPLNIT popis', details: { mlha: 'DOPLNIT popisek detailu', most: '' } })]), []);
  assert.deepEqual(workAdvice([work({ description: undefined, details: undefined })]), []);
});

test('pageAdvice: title and description of a collection, description of a year and of the home page', () => {
  const advice = pageAdvice({
    collections: [
      { yamlPath: 'tvorba/plener/_index.yaml', data: { title: 'plenér Šumava.', description: 'v září' } },
      { yamlPath: 'tvorba/zahrada/_index.yaml', data: { title: 'Ze zahrady', description: 'Květiny ze zahrady.' } },
    ],
    years: [{ yamlPath: 'roky/2026.yaml', data: { description: 'Rok, kdy jsem malovala' } }, { yamlPath: 'roky/2025.yaml', data: { description: '' } }],
    home: { yamlPath: '_index.yaml', data: { description: 'maluji pro radost.' } },
  });
  assert.deepEqual(advice, [
    'tvorba/plener/_index.yaml: title začíná malým písmenem',
    'tvorba/plener/_index.yaml: title by neměl končit tečkou',
    'tvorba/plener/_index.yaml: description začíná malým písmenem',
    'tvorba/plener/_index.yaml: description by měl končit tečkou',
    'roky/2026.yaml: description by měl končit tečkou',
    '_index.yaml: description začíná malým písmenem',
  ]);
});

test('pageAdvice: alt and caption of a photo of a page, in its file', () => {
  assert.deepEqual(pageAdvice({ photos: [
    { name: 'portret', data: { alt: 'pavla na plenéru', caption: 'Na Šumavě.' } },
    { name: 'kontakt', data: { alt: 'Pavla maluje u potoka.', caption: 'můj ateliér' } },
    { name: 'o-mne', data: { alt: 'DOPLNIT popis fotky', caption: '' } },
  ] }), [
    'fotky/portret.yaml: alt začíná malým písmenem',
    'fotky/portret.yaml: alt by měl končit tečkou',
    'fotky/kontakt.yaml: caption začíná malým písmenem',
    'fotky/kontakt.yaml: caption by měl končit tečkou',
  ]);
});

test('pageAdvice: nothing without pages, for DOPLNIT texts, or for a year with a title by mistake', () => {
  assert.deepEqual(pageAdvice({}), []);
  assert.deepEqual(pageAdvice({
    collections: [{ yamlPath: 'tvorba/k/_index.yaml', data: { title: 'DOPLNIT název', description: 'DOPLNIT popis' } }],
    years: [{ yamlPath: 'roky/2026.yaml', data: { title: 'rok.', description: 'Dobrý rok.' } }],
    home: { yamlPath: '_index.yaml', data: {} },
  }), []);
});
