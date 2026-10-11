import test from 'node:test';
import assert from 'node:assert/strict';
import {
  learners,
  courses,
  seedAssignments,
  scopedAssignments,
  sortAssignments,
} from '../lib/training.ts';

const record = (
  id,
  personName,
  courseName,
  due,
  reason,
  status = 'Not started',
) => ({
  ...seedAssignments[0],
  id,
  learnerId: learners.find((p) => p.name === personName).id,
  courseId: courses.find((c) => c.name === courseName).id,
  due,
  reason,
  status,
});
const rows = [
  record(
    'a',
    'Avery Morgan',
    'Respiratory Protection',
    '2026-12-01',
    'Initial assignment',
  ),
  record(
    'b',
    'Sam Mitchell',
    'Hazard Communication',
    '2026-11-01',
    'Required recurring interval',
  ),
  record(
    'c',
    'Remy Lewis',
    'Chemical Hygiene',
    '2026-10-01',
    'Equipment or process change',
  ),
];

test('each textual field and due date sorts in both directions', () => {
  const expected = {
    learner: ['a', 'c', 'b'],
    site: ['a', 'b', 'c'],
    course: ['c', 'b', 'a'],
    reason: ['c', 'a', 'b'],
    due: ['c', 'b', 'a'],
  };
  for (const [key, order] of Object.entries(expected)) {
    assert.deepEqual(
      sortAssignments(rows, { key, direction: 'asc' }).map((r) => r.id),
      order,
      key,
    );
    assert.deepEqual(
      sortAssignments(rows, { key, direction: 'desc' }).map((r) => r.id),
      [...order].reverse(),
      key,
    );
  }
});

test('status sorting follows displayed urgency and never marks completed records overdue', () => {
  const statuses = [
    { ...rows[0], id: 'overdue', due: '2026-09-08', status: 'In progress' },
    { ...rows[0], id: 'not-started', status: 'Not started' },
    { ...rows[0], id: 'in-progress', status: 'In progress' },
    {
      ...rows[0],
      id: 'complete',
      due: '2026-09-01',
      status: 'Knowledge Complete',
    },
  ];
  const expected = statuses.map((r) => r.id);
  assert.deepEqual(
    sortAssignments([...statuses].reverse(), {
      key: 'status',
      direction: 'asc',
    }).map((r) => r.id),
    expected,
  );
  assert.deepEqual(
    sortAssignments(statuses, { key: 'status', direction: 'desc' }).map(
      (r) => r.id,
    ),
    [...expected].reverse(),
  );
});

test('sorting preserves saved input and scope, with deterministic ties', () => {
  const original = structuredClone(seedAssignments);
  const north = scopedAssignments(seedAssignments, 'north');
  for (const key of ['learner', 'site', 'course', 'reason', 'status', 'due']) {
    const ascending = sortAssignments(north, { key, direction: 'asc' });
    assert.deepEqual(
      ascending,
      sortAssignments([...north].reverse(), { key, direction: 'asc' }),
    );
    assert.deepEqual(
      new Set(ascending.map((r) => r.id)),
      new Set(north.map((r) => r.id)),
    );
  }
  assert.deepEqual(seedAssignments, original);
});

test('sorting considers rows beyond the first page and updated deadlines', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({
    ...rows[0],
    id: `row-${i}`,
    due: `2026-10-${String(25 - i).padStart(2, '0')}`,
  }));
  const firstPage = sortAssignments(many, {
    key: 'due',
    direction: 'asc',
  }).slice(0, 20);
  assert.equal(firstPage[0].id, 'row-24');
  assert.equal(firstPage.at(-1).id, 'row-5');
  const updated = many.map((row) =>
    row.id === 'row-0' ? { ...row, due: '2026-09-01' } : row,
  );
  assert.equal(
    sortAssignments(updated, { key: 'due', direction: 'asc' })[0].id,
    'row-0',
  );
});
