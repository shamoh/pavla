import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOOLTIP_DESCRIPTION_MAX, workTooltip } from './tooltip.mjs';

const labels = { available: 'K prodeji', reserved: 'Rezervováno', sold: 'Prodáno', 'not-for-sale': 'Není na prodej' };
const work = {
  title: 'Jez na Otavě', technique: 'akvarel', size_cm: [41, 30], year: 2025,
  support: 'papír Canson XL Aquarelle (300 g)', status: 'available', description: 'Ráno u jezu,\n mlha nad vodou.',
};

test('workTooltip: title, facts, support and status in lines, the description after an empty line', () => {
  assert.equal(
    workTooltip(work, labels),
    'Jez na Otavě\nakvarel · 41 × 30 cm · 2025\npapír Canson XL Aquarelle (300 g)\nK prodeji\n\nRáno u jezu, mlha nad vodou.',
  );
});

test('workTooltip leaves out what is missing, and the status not-for-sale', () => {
  assert.equal(workTooltip({ title: 'Skica', technique: 'tužka', year: 2026, status: 'not-for-sale' }, labels), 'Skica\ntužka · 2026');
  assert.equal(workTooltip({ ...work, support: ' ', description: '  ', size_cm: [0, 0], status: 'sold' }, labels), 'Jez na Otavě\nakvarel · 2025\nProdáno');
});

test('workTooltip of a detail cover names the detail, with its caption when there is one', () => {
  assert.match(workTooltip(work, labels, { detail: 'mlha u hladiny' }), /^Jez na Otavě, detail: mlha u hladiny\nakvarel/);
  assert.match(workTooltip(work, labels, { detail: '' }), /^Jez na Otavě, detail\nakvarel/);
});

test('workTooltip shortens a long description after a whole word', () => {
  const tip = workTooltip({ ...work, description: 'slovo '.repeat(100) }, labels);
  const description = tip.split('\n\n')[1];
  assert.ok(description.length <= TOOLTIP_DESCRIPTION_MAX, String(description.length));
  assert.match(description, /slovo…$/);
});
