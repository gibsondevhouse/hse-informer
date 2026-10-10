import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, recurrenceId } from '../lib/server/schedule.ts';

test('monthly recurrence clamps end-of-month dates and follows leap years', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2028-02-29', 12), '2029-02-28');
  assert.equal(addMonths('2026-12-31', 1), '2027-01-31');
});

test('recurrence IDs are deterministic and bounded across repeated renewals', async () => {
  const first = await recurrenceId('assignment-1');
  assert.equal(first, await recurrenceId('assignment-1'));
  assert.notEqual(first, await recurrenceId('assignment-2'));
  assert.equal(first.length, (await recurrenceId(first)).length);
});
