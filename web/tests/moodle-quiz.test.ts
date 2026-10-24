import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectMoodleQuiz, readCompletion } from '../src/lib/server/moodle';

const tenant = '997d5681-f05f-49cd-96fb-98f29d03e49f';
const instanceId = 'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8';
const canonicalTime = 1781184000;
const quizMetadata = () => ({ quizzes: [
  { id: 19, course: 42, coursemodule: 260, name: 'Pinned native assessment', grade: 100, sumgrades: 10,
    grademethod: 1, attempts: 3, password: 'must-not-be-retained', subnet: 'private-setting' },
  { id: 20, course: 42, coursemodule: 261, name: 'Unrelated assessment', grade: 100, sumgrades: 50,
    grademethod: 1, attempts: 0 }
], warnings: [] });
const finished = (number: number, marks: number | null = 0) => ({ id: 900 + number, quiz: 19, userid: 17,
  attempt: number, currentpage: 4, preview: 0, state: 'finished', timestart: canonicalTime - 1000 + number,
  timefinish: canonicalTime - 500 + number, timemodified: canonicalTime - 500 + number, sumgrades: marks,
  layout: 'not-retained', feedback: { feedbacktext: 'not-retained' } });

function fixture() {
  const values: Record<string, unknown> = {
    mod_quiz_get_quizzes_by_courses: quizMetadata(),
    core_completion_get_course_completion_status: { completionstatus: { completed: true, completions: [] }, warnings: [] },
    local_hse_evidence_get_completion: { courseid: 42, userid: 17, completed: true,
      completionid: 123, timecompleted: canonicalTime, score: 91.5 },
    core_completion_get_activities_completion_status: { statuses: [
      { cmid: 260, instance: 19, modname: 'quiz', state: 2, timecompleted: canonicalTime - 500 },
      { cmid: 261, instance: 20, modname: 'quiz', state: 2, timecompleted: canonicalTime - 100 }
    ], warnings: [] },
    mod_quiz_get_user_quiz_attempts: { attempts: [finished(3, 0), finished(1, 0), finished(2, 10)], warnings: [] }
  };
  const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
    const fn = (options.body as URLSearchParams).get('wsfunction')!;
    if (!(fn in values)) throw new Error(`Unexpected Moodle call ${fn}`);
    return new Response(JSON.stringify(values[fn]), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { values, fetchMock };
}

beforeEach(() => {
  vi.stubEnv('MOODLE_CONNECTIONS_JSON', JSON.stringify({ [tenant]: { instanceId,
    baseUrl: 'https://moodle.example.test', token: 'read-token', completionEvidence: 'local_hse_evidence' } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('exact native Moodle Quiz observations', () => {
  it('pins one quiz and module, retains its three attempts, and keeps canonical course time/grade authoritative', async () => {
    const { fetchMock } = fixture();
    const result = await readCompletion(tenant, 42, 17, null, 260, 19);
    expect(result).toMatchObject({ completed: true, completedAt: new Date(canonicalTime * 1000),
      score: 91.5, attempts: 3, sourceCompletionId: 123, scormObservation: null,
      quizObservation: { quizId: 19, courseId: 42, activityModuleId: 260, activityState: 2,
        activityUpdatedAt: new Date((canonicalTime - 500) * 1000), maximumGrade: 100, totalMarks: 10,
        gradingMethod: 1, serviceAccountAttemptLimit: 3, observedAt: expect.any(Date) }
    });
    expect(result.quizObservation?.attempts.map((attempt) => [attempt.attemptNumber, attempt.rawMarks])).toEqual([[1, 0], [2, 10], [3, 0]]);
    expect(JSON.stringify(result.raw)).not.toMatch(/must-not-be-retained|private-setting|not-retained|password|subnet|layout|feedback/);
    expect((result.raw as { quiz: unknown }).quiz).toBe(result.quizObservation);
    const calls = fetchMock.mock.calls.map((call) => Object.fromEntries(call[1].body as URLSearchParams));
    expect(calls[0]).toMatchObject({ wsfunction: 'mod_quiz_get_quizzes_by_courses', 'courseids[0]': '42' });
    expect(calls.at(-1)).toMatchObject({ wsfunction: 'mod_quiz_get_user_quiz_attempts', quizid: '19', userid: '17', status: 'all', includepreviews: '0' });
    expect(calls.some((call) => call.wsfunction.startsWith('mod_scorm'))).toBe(false);
  });

  it('keeps real unfinished states and hidden marks while excluding precreated attempts from the count', async () => {
    const { values } = fixture();
    values.mod_quiz_get_user_quiz_attempts = { attempts: [
      { ...finished(1), state: 'notstarted', currentpage: 0, timestart: 0, timefinish: 0, sumgrades: null },
      { ...finished(2), state: 'inprogress', currentpage: 1, timefinish: 0, sumgrades: null },
      { ...finished(3), state: 'overdue', timefinish: 0, sumgrades: null },
      { ...finished(4), state: 'submitted', sumgrades: null },
      { ...finished(5), state: 'abandoned', timefinish: 0, sumgrades: null },
      finished(6, null)
    ], warnings: [] };
    const result = await readCompletion(tenant, 42, 17, null, 260, 19);
    expect(result.attempts).toBe(5);
    expect(result.quizObservation?.attempts.map((attempt) => attempt.state)).toEqual([
      'notstarted', 'inprogress', 'overdue', 'submitted', 'abandoned', 'finished'
    ]);
    expect(result.quizObservation?.attempts.every((attempt) => attempt.rawMarks === null)).toBe(true);
  });

  it('represents no attempts as zero and does not invent canonical completion from a passed activity', async () => {
    const { values, fetchMock } = fixture();
    values.mod_quiz_get_user_quiz_attempts = { attempts: [], warnings: [] };
    values.core_completion_get_course_completion_status = { completionstatus: { completed: false, completions: [] }, warnings: [] };
    const result = await readCompletion(tenant, 42, 17, null, 260, 19);
    expect(result).toMatchObject({ completed: false, completedAt: null, score: null, attempts: 0,
      quizObservation: { activityState: 2, attempts: [] } });
    expect(fetchMock.mock.calls.some((call) => (call[1].body as URLSearchParams).get('wsfunction') === 'local_hse_evidence_get_completion')).toBe(false);
  });

  it.each([
    ['another course', { course: 43 }], ['another module', { coursemodule: 261 }], ['another quiz', { id: 21 }]
  ])('rejects metadata for %s before reading completion or attempts', async (_label, change) => {
    const { values, fetchMock } = fixture();
    const metadata = quizMetadata();
    Object.assign(metadata.quizzes[0], change);
    values.mod_quiz_get_quizzes_by_courses = metadata;
    await expect(readCompletion(tenant, 42, 17, null, 260, 19)).rejects.toMatchObject({
      code: 'invalid_mapping', functionName: 'mod_quiz_get_quizzes_by_courses'
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate quiz definitions and malformed assessment settings', async () => {
    for (const quizzes of [
      [quizMetadata().quizzes[0], quizMetadata().quizzes[0]],
      [{ ...quizMetadata().quizzes[0], grade: '100' }],
      [{ ...quizMetadata().quizzes[0], sumgrades: -1 }],
      [{ ...quizMetadata().quizzes[0], grademethod: 5 }],
      [{ ...quizMetadata().quizzes[0], attempts: -1 }]
    ]) {
      const { values } = fixture();
      values.mod_quiz_get_quizzes_by_courses = { quizzes, warnings: [] };
      await expect(inspectMoodleQuiz(tenant, 42, 19, 260)).rejects.toMatchObject({ functionName: 'mod_quiz_get_quizzes_by_courses' });
    }
  });

  it('rejects incomplete and mixed assessment mappings without a remote request', async () => {
    const { fetchMock } = fixture();
    for (const mapping of [[30, 260, 19], [null, null, 19], [null, 260, null]] as const) {
      await expect(readCompletion(tenant, 42, 17, ...mapping)).rejects.toMatchObject({ code: 'invalid_mapping' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong user', { userid: 18 }], ['wrong quiz', { quiz: 20 }], ['preview', { preview: 1 }],
    ['unknown state', { state: 'graded' }], ['negative page', { currentpage: -1 }],
    ['marks in submitted state', { state: 'submitted', sumgrades: 10 }],
    ['invalid marks', { sumgrades: '10' }], ['missing start', { timestart: 0 }],
    ['missing finish', { timefinish: 0 }], ['invalid modified time', { timemodified: -1 }]
  ])('rejects %s in an attempt response', async (_label, change) => {
    const { values } = fixture();
    values.mod_quiz_get_user_quiz_attempts = { attempts: [{ ...finished(1), ...change }], warnings: [] };
    await expect(readCompletion(tenant, 42, 17, null, 260, 19)).rejects.toMatchObject({
      code: 'invalid_response', functionName: 'mod_quiz_get_user_quiz_attempts'
    });
  });

  it('rejects duplicate attempt IDs and ordinal numbers instead of inflating the count', async () => {
    for (const second of [{ ...finished(2), id: 901 }, { ...finished(2), attempt: 1 }]) {
      const { values } = fixture();
      values.mod_quiz_get_user_quiz_attempts = { attempts: [finished(1), second], warnings: [] };
      await expect(readCompletion(tenant, 42, 17, null, 260, 19)).rejects.toMatchObject({
        code: 'invalid_response', functionName: 'mod_quiz_get_user_quiz_attempts'
      });
    }
  });

  it('rejects activity identity drift independently of the quiz metadata', async () => {
    const { values } = fixture();
    values.core_completion_get_activities_completion_status = { statuses: [
      { cmid: 261, instance: 19, modname: 'quiz', state: 2, timecompleted: canonicalTime }
    ], warnings: [] };
    await expect(readCompletion(tenant, 42, 17, null, 260, 19)).rejects.toMatchObject({
      code: 'activity_mapping_changed', functionName: 'core_completion_get_activities_completion_status'
    });
  });

  it('accepts hidden-fail activity state and rejects warnings from each quiz read', async () => {
    const { values } = fixture();
    values.core_completion_get_activities_completion_status = { statuses: [
      { cmid: 260, instance: 19, modname: 'quiz', state: 4, timecompleted: canonicalTime }
    ], warnings: [] };
    expect((await readCompletion(tenant, 42, 17, null, 260, 19)).quizObservation?.activityState).toBe(4);
    for (const fn of ['mod_quiz_get_quizzes_by_courses', 'mod_quiz_get_user_quiz_attempts']) {
      const next = fixture();
      next.values[fn] = { ...(next.values[fn] as object), warnings: [{ warningcode: 'nopermissions' }] };
      await expect(readCompletion(tenant, 42, 17, null, 260, 19)).rejects.toMatchObject({ code: 'moodle_warning', functionName: fn });
    }
  });
});
