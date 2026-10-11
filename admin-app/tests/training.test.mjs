import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courses,
  courseIds,
  legalStatuses,
  reasons,
  cadences,
  defaultCadence,
  STORAGE_KEY,
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

test('library contains ten mapped course outlines', () => {
  assert.equal(STORAGE_KEY, 'hse-informer-admin-preview-v2');
  assert.deepEqual(
    courses.map((c) => c.name),
    [
      'Respiratory Protection',
      'Lockout/Tagout',
      'Confined Space',
      'Chemical Hygiene',
      'Hazard Communication',
      'Electrical Safety',
      'Heat and Thermal Stress',
      'Powered Industrial Trucks',
      'Bloodborne Pathogens',
      'Walking-Working Surfaces',
    ],
  );
  assert.deepEqual(
    courses.map((c) => c.lessons.length),
    [7, 9, 10, 10, 10, 9, 9, 10, 10, 10],
  );
  const respiratory = courses.find((course) => course.id === 'respiratory');
  assert.equal(respiratory.unitLabel, 'modules');
  assert.deepEqual(respiratory.lessons, [
    'Respiratory hazards and program scope',
    'Assigned respirators, selection, and limitations',
    'Donning, doffing, inspection, and user seal checks',
    'Routine use and work practices',
    'Maintenance, cleaning, storage, and replacement',
    'Emergency response and respirator malfunction',
    'Medical signs, training requirements, and retraining',
  ]);
  assert.equal(respiratory.authorizationPrerequisites.length, 5);
  assert.match(
    respiratory.authorizationPrerequisites.at(-1),
    /course completion alone does not authorize wear/,
  );
  assert.ok(
    ['(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(k)', '(l)', '(m)'].every(
      (paragraph) => respiratory.regulatory.paragraphs.includes(paragraph),
    ),
  );
  assert.ok(
    respiratory.regulatory.retrainingTriggers.some((trigger) =>
      trigger.includes('annually'),
    ),
  );
  assert.ok(
    respiratory.regulatory.retrainingTriggers.some((trigger) =>
      trigger.includes('Workplace or respirator-type changes'),
    ),
  );
  assert.ok(
    respiratory.regulatory.references.some(({ href }) => href.endsWith('AppA')),
  );
  assert.ok(
    respiratory.regulatory.references.some(({ href }) => href.endsWith('AppB1')),
  );
  assert.ok(
    respiratory.regulatory.references.some(({ href }) => href.endsWith('AppD')),
  );
  assert.deepEqual(
    courses.map((c) => c.id),
    courseIds,
  );
  assert.ok(courses.every((course) => course.local.length === 3));
});
test('regulatory summaries have valid status, recurrence, and source links', () => {
  const kinds = [
    'annual',
    'three-year-evaluation',
    'event-driven',
    'employer-defined',
  ];
  for (const course of courses) {
    assert.equal(
      Boolean(course.regulatory) !== Boolean(course.reviewNote),
      true,
      course.id,
    );
    assert.ok(cadences.includes(defaultCadence(course)), course.id);
    if (!course.regulatory) continue;
    assert.ok(legalStatuses.includes(course.regulatory.legalStatus), course.id);
    assert.ok(kinds.includes(course.regulatory.recurrence.kind), course.id);
    assert.ok(course.regulatory.references.length > 0, course.id);
    for (const { href } of course.regulatory.references) {
      const url = new URL(href);
      assert.equal(url.protocol, 'https:', course.id);
      assert.ok(
        ['osha.gov', 'ecfr.gov', 'cdc.gov'].some(
          (domain) =>
            url.hostname === domain || url.hostname.endsWith(`.${domain}`),
        ),
        href,
      );
    }
  }
  assert.ok(
    seedAssignments.every((assignment) => reasons.includes(assignment.reason)),
  );
  assert.equal(reasons.length, 9);
  assert.deepEqual(
    Object.fromEntries(
      courses.map((course) => [course.id, defaultCadence(course)]),
    ),
    {
      respiratory: 'Annual (required)',
      loto: 'Event-driven',
      confined: 'Event-driven',
      hygiene: 'Interval to be determined',
      hazcom: 'Event-driven',
      electrical: 'Event-driven',
      heat: 'Interval to be determined',
      pit: 'Every three years (evaluation)',
      bbp: 'Annual (required)',
      walking: 'Event-driven',
    },
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
