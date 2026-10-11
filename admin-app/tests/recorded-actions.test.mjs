import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../lib/lms/engine.ts';
import { pbjCourse } from '../lib/lms/pbj-course.ts';
import {
  parseRecordedAction,
  replayRecordedAction,
} from '../lib/lms/recorded-actions.ts';
import { getRecordedCoursePackage } from '../lib/lms/recorded-courses.ts';

const now = '2026-10-07T12:00:00.000Z';

test('only a shipped version resolves to a recorded course package', () => {
  assert.equal(getRecordedCoursePackage(pbjCourse.id, pbjCourse.version), pbjCourse);
  assert.equal(getRecordedCoursePackage(pbjCourse.id, 'future-version'), null);
  assert.equal(getRecordedCoursePackage('respiratory', 'draft'), null);
});

test('recorded action parser excludes author and evidence-reset controls', () => {
  for (const type of ['reset', 'toggle-dev-notes', 'set-linear']) {
    assert.equal(parseRecordedAction({ type, value: false }, pbjCourse, now), null);
  }
  assert.equal(
    parseRecordedAction({ type: 'answer', blockId: 'made-up', response: 'a' }, pbjCourse, now),
    null,
  );
  assert.equal(
    parseRecordedAction({ type: 'answer', blockId: 'q-1-1-complete', response: 'a' }, pbjCourse, now)?.type,
    'answer',
  );
});

test('server time and reducer determine attempt and completion evidence', () => {
  const start = parseRecordedAction(
    { type: 'start-assessment', seed: 42, at: '2001-01-01T00:00:00Z' },
    pbjCourse,
    now,
  );
  assert.deepEqual(start, { type: 'start-assessment', seed: 42, at: now });
  const state = initialState(pbjCourse);
  const forged = replayRecordedAction(
    pbjCourse,
    state,
    { type: 'submit-assessment', passed: true, percent: 100, at: '2001-01-01T00:00:00Z' },
    now,
  );
  assert.equal(forged.status, 'not-started');
  assert.equal(forged.state.assessment.attempts.length, 0);
});
