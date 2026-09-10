import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentStatus,
  summarizeAssignmentStatuses,
  scopedAssignments,
  seedAssignments,
  sites,
  summarize,
} from '../lib/training.ts';

test('the four displayed statuses partition assignments without double-counting overdue work', () => {
  const base = seedAssignments[0];
  const records = [
    { ...base, status: 'Not started', due: '2026-09-09' },
    { ...base, status: 'In progress', due: '2026-09-30' },
    { ...base, status: 'Knowledge Complete', due: '2026-09-01' },
    { ...base, status: 'Not started', due: '2026-09-08' },
    { ...base, status: 'In progress', due: '2026-09-08' },
  ];
  const breakdown = summarizeAssignmentStatuses(records);
  assert.deepEqual(
    breakdown.map(({ key, count, percent }) => ({ key, count, percent })),
    [
      { key: 'not-started', count: 1, percent: 20 },
      { key: 'in-progress', count: 1, percent: 20 },
      { key: 'complete', count: 1, percent: 20 },
      { key: 'overdue', count: 2, percent: 40 },
    ],
  );
  for (const status of breakdown) {
    assert.equal(
      records.filter((record) => assignmentStatus(record) === status.key)
        .length,
      status.count,
    );
  }
});

test('status percentages and drill-down counts use the entire selected site scope', () => {
  for (const site of ['all', ...sites.map((item) => item.id)]) {
    const records = scopedAssignments(seedAssignments, site);
    const breakdown = summarizeAssignmentStatuses(records);
    assert.equal(
      breakdown.reduce((total, status) => total + status.count, 0),
      records.length,
    );
    assert.equal(
      breakdown.find((status) => status.key === 'complete').percent,
      summarize(records).percent,
    );
    assert.equal(
      breakdown.find((status) => status.key === 'overdue').count,
      summarize(records).overdue,
    );
    for (const status of breakdown) {
      assert.equal(
        records.filter((record) => assignmentStatus(record) === status.key)
          .length,
        status.count,
      );
    }
  }
});

test('empty and fully complete scopes keep all four statuses with finite values', () => {
  const empty = summarizeAssignmentStatuses([]);
  assert.equal(empty.length, 4);
  assert.ok(
    empty.every((status) => status.count === 0 && status.percent === 0),
  );
  const complete = summarizeAssignmentStatuses([
    { ...seedAssignments[0], status: 'Knowledge Complete' },
  ]);
  assert.equal(
    complete.find((status) => status.key === 'complete').percent,
    100,
  );
  assert.ok(
    complete
      .filter((status) => status.key !== 'complete')
      .every((status) => status.count === 0 && status.percent === 0),
  );
});
