import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courses,
  sites,
  learners,
  seedAssignments,
  summarize,
  scopedAssignments,
  isOverdue,
  isDueSoon,
  eligibleLearners,
  isAssignment,
} from '../lib/training.ts';

test('launch library contains exactly the five approved syllabi', () => {
  assert.deepEqual(
    courses.map((c) => c.name),
    [
      'Respiratory Protection',
      'Lockout/Tagout',
      'Confined Space',
      'Chemical Hygiene',
      'Hazard Communication',
    ],
  );
  assert.deepEqual(
    courses.map((c) => c.lessons.length),
    [9, 9, 10, 10, 10],
  );
});
test('site scopes partition all assignments and preserve totals', () => {
  const all = summarize(seedAssignments);
  const scopes = sites.map((site) =>
    scopedAssignments(seedAssignments, site.id),
  );
  assert.equal(scopes.flat().length, all.total);
  assert.equal(new Set(scopes.flat().map((r) => r.id)).size, all.total);
  for (const site of sites) {
    assert.ok(
      scopedAssignments(seedAssignments, site.id).every(
        (r) => learners.find((p) => p.id === r.learnerId).siteId === site.id,
      ),
    );
  }
  for (const metric of [
    'total',
    'people',
    'incompletePeople',
    'complete',
    'overdue',
    'dueSoon',
  ]) {
    assert.equal(
      scopes.map((s) => summarize(s)[metric]).reduce((a, b) => a + b, 0),
      all[metric],
    );
  }
});
test('completed knowledge is never overdue and deadlines have explicit boundaries', () => {
  const base = { ...seedAssignments[0], status: 'Not started' };
  assert.equal(isOverdue({ ...base, due: '2026-09-08' }), true);
  assert.equal(isOverdue({ ...base, due: '2026-09-09' }), false);
  assert.equal(isDueSoon({ ...base, due: '2026-09-09' }), true);
  assert.equal(isDueSoon({ ...base, due: '2026-10-09' }), true);
  assert.equal(isDueSoon({ ...base, due: '2026-10-10' }), false);
  assert.equal(
    isOverdue({ ...base, due: '2026-01-01', status: 'Knowledge Complete' }),
    false,
  );
  assert.equal(
    isDueSoon({ ...base, due: '2026-09-20', status: 'Knowledge Complete' }),
    false,
  );
});
test('assignment audience respects sites, groups, and duplicate open assignments', () => {
  const eligible = eligibleLearners(
    seedAssignments,
    'loto',
    ['north'],
    'Production',
  );
  assert.ok(eligible.length > 0);
  assert.ok(
    eligible.every((p) => p.siteId === 'north' && p.group === 'Production'),
  );
  assert.ok(
    eligible.every(
      (p) =>
        !seedAssignments.some(
          (r) =>
            r.courseId === 'loto' &&
            r.learnerId === p.id &&
            r.status !== 'Knowledge Complete',
        ),
    ),
  );
  const assigned = eligible.map((p) => ({
    ...seedAssignments[0],
    learnerId: p.id,
    courseId: 'loto',
    status: 'Not started',
  }));
  assert.equal(
    eligibleLearners(
      [...seedAssignments, ...assigned],
      'loto',
      ['north'],
      'Production',
    ).length,
    0,
  );
  assert.equal(
    eligibleLearners(seedAssignments, 'loto', [], 'All employees').length,
    0,
  );
});
test('empty scopes have finite summaries and preview records remain valid', () => {
  assert.deepEqual(summarize([]), {
    total: 0,
    people: 0,
    incompletePeople: 0,
    complete: 0,
    percent: 0,
    overdue: 0,
    dueSoon: 0,
  });
  assert.ok(seedAssignments.every(isAssignment));
  assert.equal(
    isAssignment({ ...seedAssignments[0], courseId: 'unapproved-course' }),
    false,
  );
  assert.equal(
    isAssignment({ ...seedAssignments[0], status: 'Authorized' }),
    false,
  );
  assert.equal(
    isAssignment({ ...seedAssignments[0], learnerId: 'outside-workspace' }),
    false,
  );
  assert.equal(isAssignment({ ...seedAssignments[0], due: 'bad date' }), false);
});

test('unfinished people counts each learner once across incomplete assignments', () => {
  const base = seedAssignments[0];
  const records = [
    { ...base, id: 'one', learnerId: learners[0].id, status: 'Not started' },
    { ...base, id: 'two', learnerId: learners[0].id, status: 'In progress' },
    {
      ...base,
      id: 'three',
      learnerId: learners[0].id,
      status: 'Knowledge Complete',
    },
    {
      ...base,
      id: 'four',
      learnerId: learners[1].id,
      status: 'Knowledge Complete',
    },
    { ...base, id: 'five', learnerId: learners[12].id, status: 'In progress' },
  ];
  assert.equal(summarize(records).incompletePeople, 2);
  assert.equal(
    summarize(scopedAssignments(records, learners[0].siteId)).incompletePeople,
    1,
  );
  assert.equal(
    summarize(
      records.map((record) => ({ ...record, status: 'Knowledge Complete' })),
    ).incompletePeople,
    0,
  );
});
