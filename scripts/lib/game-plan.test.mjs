import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DETAILS_FILE, PLAN_DIR, planBuildYear, planYears, pragueDate, readPlan, readPlanYear, sitePlan, writePlan } from './game-plan.mjs';

const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'pavla-plan-'));
const day = (date) => ({ date, easy: { targetId: 'a', detail: 1, crop: {}, optionIds: ['a'], look: 'clear' } });

test('pragueDate: the day in Prague, also when it is still yesterday in UTC (GitHub)', () => {
  assert.equal(pragueDate(new Date('2026-11-15T23:30:00Z')), '2026-11-16', 'winter: UTC + 1');
  assert.equal(pragueDate(new Date('2026-07-15T22:30:00Z')), '2026-07-16', 'summer: UTC + 2');
  assert.equal(pragueDate(new Date('2026-11-15T12:00:00Z')), '2026-11-15');
});

test('writePlan and readPlan: a file per year and one of the details, only the changed ones written, read back whole', async () => {
  const dir = await tempDir();
  assert.deepEqual(await readPlan(dir), { details: {}, days: {} }, 'nothing yet');
  const plan = { details: { a: [{ n: 1, level: 'easy', x: 0.5, y: 0.5, size: 0.2 }] }, days: { 0: day('2026-11-01'), 61: day('2027-01-01') } };
  assert.deepEqual(await writePlan(dir, plan, '2026-11-01'), [path.join(PLAN_DIR, DETAILS_FILE), path.join(PLAN_DIR, '2026.json'), path.join(PLAN_DIR, '2027.json')]);
  assert.deepEqual(await planYears(dir), [2026, 2027]);
  assert.deepEqual(await readPlan(dir), JSON.parse(JSON.stringify(plan)));
  assert.deepEqual(Object.keys(await readPlanYear(dir, 2027)), ['61']);
  const later = { ...plan, days: { ...plan.days, 62: day('2027-01-02') } };
  assert.deepEqual(await writePlan(dir, later, '2026-11-01'), [path.join(PLAN_DIR, '2027.json')], 'a year over stays untouched');
  const file = JSON.parse(await fs.readFile(path.join(dir, PLAN_DIR, '2027.json'), 'utf8'));
  assert.deepEqual(Object.keys(file.days), ['2027-1', '2027-2'], 'in the file by the key of the day (dayId)');
  await fs.writeFile(path.join(dir, PLAN_DIR, '2027.json'), JSON.stringify({ ...file, version: 1 }));
  assert.deepEqual(await readPlanYear(dir, 2027), {}, 'a file of another version is left out (the plan starts again from the computed days)');
  await writePlan(dir, later, '2026-11-01');
  await fs.writeFile(path.join(dir, PLAN_DIR, '2026.json'), '{ broken');
  assert.deepEqual(Object.keys((await readPlan(dir)).days), ['61', '62'], 'a file that cannot be read is left out');
  await fs.rm(dir, { recursive: true, force: true });
});

test('sitePlan: this year and the one before for the page, older years as the archive', async () => {
  const dir = await tempDir();
  await writePlan(dir, { details: {}, days: { 0: day('2026-11-01'), 61: day('2027-01-01'), 426: day('2028-01-01'), 792: day('2029-01-01') } }, '2026-11-01');
  assert.deepEqual(await sitePlan(dir, 2029), { days: { 426: day('2028-01-01'), 792: day('2029-01-01') }, archive: [2026, 2027] });
  assert.deepEqual((await sitePlan(dir, 2027)).archive, []);
  assert.deepEqual(await sitePlan(await tempDir(), 2027), { days: {}, archive: [] });
  await fs.rm(dir, { recursive: true, force: true });
});

test('planBuildYear: the year in Prague, or DETAIL_DNE_YEAR to try the archive', () => {
  assert.equal(planBuildYear({}, new Date('2026-12-31T23:30:00Z')), 2027);
  assert.equal(planBuildYear({ DETAIL_DNE_YEAR: '2028' }), 2028);
  assert.equal(planBuildYear({ DETAIL_DNE_YEAR: 'x' }, new Date('2026-06-01T12:00:00Z')), 2026);
});
