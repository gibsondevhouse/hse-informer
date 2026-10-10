import assert from 'node:assert/strict';
import test from 'node:test';
import {
  escapeCsv, qualificationReadiness, queueRows,
} from '../lib/qualification.ts';

const worker = {
  id: 'worker-1', name: 'Avery', email: 'avery@example.test',
  siteId: 'north', groupName: 'Production', active: true,
};
const requirement = {
  id: 'rule-1', siteId: 'north', groupName: 'Production',
  courseId: 'respiratory', courseVersion: '2.0',
  localInstructionRequired: true, prerequisiteRequired: true,
  practicalEvaluationRequired: true, authorizationRequired: true,
  updatedAt: '2026-10-01T00:00:00Z',
};
const assignment = (id, status, assignedAt, version = '2.0') => ({
  id, workerId: worker.id, siteId: worker.siteId,
  courseId: 'respiratory', courseVersion: version, assignedAt,
  dueDate: '2026-10-06', status,
  reason: 'Initial assignment', deliveryState: 'sent',
  completedAt: status === 'Knowledge Complete' ? assignedAt : null,
  cancelledAt: null,
});
const event = (step, overrides = {}) => ({
  id: `${step}-1`, workerId: worker.id, siteId: worker.siteId,
  courseId: 'respiratory', assignmentId: 'a1', courseVersion: '2.0',
  step, outcome: 'satisfied', evidenceRef: 'record-1',
  referenceVersion: 'site-v2', expiresAt: null,
  scope: 'Line 1 respirator use', restrictions: '', actorSub: 'manager-1',
  actorEmail: 'manager@example.test', reason: 'Verified',
  supersedesId: null, createdAt: '2026-10-04T00:00:00Z',
  ...overrides,
});
const evidence = [
  event('local_instruction'), event('prerequisite'),
  event('practical_evaluation'), event('authorization'),
];

test('newer open work and a mismatched release block authorization', () => {
  const complete = assignment('a1', 'Knowledge Complete', '2026-10-02T00:00:00Z');
  assert.equal(qualificationReadiness(worker, requirement, [complete], evidence, '2026-10-07').authorized, true);
  const renewed = assignment('a2', 'Not started', '2026-10-06T00:00:00Z');
  const blocked = qualificationReadiness(worker, requirement, [complete, renewed], evidence, '2026-10-07');
  assert.equal(blocked.authorized, false);
  assert.deepEqual(blocked.missing, ['Knowledge completion']);
  const oldVersion = assignment('a3', 'Knowledge Complete', '2026-10-07T00:00:00Z', '1.0');
  assert.equal(qualificationReadiness(worker, requirement, [complete, oldVersion], evidence, '2026-10-07').authorized, false);
});

test('expired or corrected prerequisite and old-version practical evidence block readiness', () => {
  const complete = assignment('a1', 'Knowledge Complete', '2026-10-02T00:00:00Z');
  const expired = evidence.map((item) => item.step === 'prerequisite'
    ? { ...item, expiresAt: '2026-10-06' } : item);
  assert.deepEqual(qualificationReadiness(worker, requirement, [complete], expired, '2026-10-07').missing, ['Prerequisite']);
  const corrected = [...evidence, event('prerequisite', {
    id: 'prerequisite-2', outcome: 'revoked',
    supersedesId: 'prerequisite-1', createdAt: '2026-10-06T00:00:00Z',
  })];
  assert.deepEqual(qualificationReadiness(worker, requirement, [complete], corrected, '2026-10-07').missing, ['Prerequisite']);
  const oldPractical = evidence.map((item) => item.step === 'practical_evaluation'
    ? { ...item, courseVersion: '1.0' } : item);
  assert.deepEqual(qualificationReadiness(worker, requirement, [complete], oldPractical, '2026-10-07').missing, ['Practical evaluation']);
});

test('queues expose their exact worker-course rows and exclude inactive workers', () => {
  const snapshot = {
    asOf: '2026-10-07T12:00:00Z', sites: [{ id: 'north', name: 'North', code: 'N', location: '' }],
    releases: [], workers: [worker, { ...worker, id: 'inactive', active: false }],
    requirements: [requirement], assignments: [], events: [],
  };
  assert.equal(queueRows(snapshot, 'unassigned').length, 1);
  assert.equal(queueRows(snapshot, 'overdue').length, 0);
  snapshot.assignments = [assignment('a1', 'In progress', '2026-10-01T00:00:00Z')];
  assert.equal(queueRows(snapshot, 'unassigned').length, 0);
  assert.equal(queueRows(snapshot, 'overdue').length, 1);
  snapshot.assignments[0].deliveryState = 'failed';
  assert.equal(queueRows(snapshot, 'failed_delivery').length, 1);
});

test('CSV export neutralizes spreadsheet formulas and escapes quotes', () => {
  assert.equal(escapeCsv('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(escapeCsv('ordinary'), '"ordinary"');
});
