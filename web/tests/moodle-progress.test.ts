import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readMoodleLearningProgress, type MoodleCompletion } from '../src/lib/server/moodle';

const tenant = '997d5681-f05f-49cd-96fb-98f29d03e49f';
const time = 1781184000;
const incomplete = (): MoodleCompletion => ({ completed: false, completedAt: null, score: null, attempts: null,
  scormObservation: null, quizObservation: null, raw: {} });
const activity = (changes = {}) => ({ cmid: 260, instance: 19, modname: 'quiz', tracking: 2,
  state: 0, timecompleted: 0, uservisible: true, istrackeduser: true, ...changes });

function fixture(lastaccess: number | null | undefined = 0) {
  const values: Record<string, unknown> = {
    core_enrol_get_users_courses: [{ id: 43, lastaccess: time }, { id: 42, lastaccess }],
    core_completion_get_activities_completion_status: { statuses: [activity()], warnings: [] }
  };
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const fn = (init.body as URLSearchParams).get('wsfunction')!;
    return Response.json(values[fn]);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { values, fetchMock };
}

beforeEach(() => {
  vi.stubEnv('MOODLE_CONNECTIONS_JSON', JSON.stringify({ [tenant]: {
    instanceId: 'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8', baseUrl: 'https://moodle.example.test', token: 'read-token'
  } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Moodle-owned learning progress', () => {
  it('does not treat enrollment or another course access as a learning start', async () => {
    const { fetchMock } = fixture();
    const result = await readMoodleLearningProgress(tenant, 42, 17, incomplete());
    expect(result).toMatchObject({ courseId: 42, userId: 17, started: false, courseLastAccessAt: null,
      activitiesWithProgress: 0, trackedActivities: 1, startedAttempts: null });
    expect(result.observedAt >= result.readStartedAt).toBe(true);
    const calls = fetchMock.mock.calls.map((call) => Object.fromEntries(call[1].body as URLSearchParams));
    expect(calls).toEqual([
      expect.objectContaining({ wsfunction: 'core_enrol_get_users_courses', userid: '17', returnusercount: '0' }),
      expect.objectContaining({ wsfunction: 'core_completion_get_activities_completion_status', courseid: '42', userid: '17' })
    ]);
    expect(JSON.stringify(result)).not.toContain('read-token');
  });

  it.each([null, undefined])('preserves hidden or missing last access as unknown (%s)', async (lastaccess) => {
    const { values } = fixture(lastaccess);
    if (lastaccess === undefined) values.core_enrol_get_users_courses = [{ id: 42 }];
    expect((await readMoodleLearningProgress(tenant, 42, 17, incomplete())).started).toBeNull();
  });

  it('observes real course access and Page activity without manufacturing course completion', async () => {
    fixture(time);
    expect((await readMoodleLearningProgress(tenant, 42, 17, incomplete())).started).toBe(true);
    const { values } = fixture(null);
    values.core_completion_get_activities_completion_status = { statuses: [
      activity({ cmid: 250, instance: 10, modname: 'page', state: 1, timecompleted: time }), activity()
    ], warnings: [] };
    const result = await readMoodleLearningProgress(tenant, 42, 17, incomplete());
    expect(result).toMatchObject({ started: true, activitiesWithProgress: 1, trackedActivities: 2 });
    expect(result).not.toHaveProperty('completedAt');
  });

  it('counts an in-progress Quiz attempt when its activity is still incomplete, excluding precreated attempts', async () => {
    fixture(null);
    const completion = incomplete();
    completion.quizObservation = { quizId: 19, courseId: 42, activityModuleId: 260,
      activityState: 0, activityUpdatedAt: null, maximumGrade: 100, totalMarks: 10,
      gradingMethod: 1, serviceAccountAttemptLimit: 3, observedAt: new Date(), attempts: [
        { id: 1, attemptNumber: 1, state: 'notstarted', currentPage: 0, startedAt: null,
          submittedAt: null, modifiedAt: new Date(time * 1000), rawMarks: null },
        { id: 2, attemptNumber: 2, state: 'inprogress', currentPage: 1, startedAt: new Date(time * 1000),
          submittedAt: null, modifiedAt: new Date(time * 1000), rawMarks: null }
      ] };
    expect(await readMoodleLearningProgress(tenant, 42, 17, completion)).toMatchObject({
      started: true, activitiesWithProgress: 0, startedAttempts: 1
    });
    completion.quizObservation.attempts.pop();
    expect((await readMoodleLearningProgress(tenant, 42, 17, completion)).started).toBeNull();
  });

  it.each([
    ['future last access', 'core_enrol_get_users_courses', [{ id: 42, lastaccess: 9_999_999_999 }]],
    ['missing mapped course', 'core_enrol_get_users_courses', [{ id: 43, lastaccess: time }]],
    ['duplicate course', 'core_enrol_get_users_courses', [{ id: 42 }, { id: 42 }]],
    ['warnings', 'core_completion_get_activities_completion_status', { statuses: [], warnings: [{ warningcode: 'denied' }] }],
    ['duplicate activity', 'core_completion_get_activities_completion_status', { statuses: [activity(), activity()], warnings: [] }],
    ['future activity time', 'core_completion_get_activities_completion_status', { statuses: [activity({ state: 1, timecompleted: 9_999_999_999 })], warnings: [] }],
    ['missing activity time', 'core_completion_get_activities_completion_status', { statuses: [activity({ state: 1, timecompleted: 0 })], warnings: [] }],
    ['invalid state', 'core_completion_get_activities_completion_status', { statuses: [activity({ state: 9 })], warnings: [] }]
  ])('rejects %s', async (_label, fn, response) => {
    const { values } = fixture(); values[fn as string] = response;
    await expect(readMoodleLearningProgress(tenant, 42, 17, incomplete())).rejects.toThrow();
  });
});
