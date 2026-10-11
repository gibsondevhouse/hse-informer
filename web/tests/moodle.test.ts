import { afterEach, describe, expect, it, vi } from 'vitest';
import { addUserToCohort, enrollUser, findMoodleUserByHseId, isUserEnrolled, moodleConnection, moodleCourseUrl,
  provisionMoodleUser, readCompletion } from '../src/lib/server/moodle';

const tenant = 'ffef29ba-5d6b-4a7a-8bdd-07e9508303b5';
const instanceId = 'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8';
const original = process.env.MOODLE_CONNECTIONS_JSON;

afterEach(() => {
  process.env.MOODLE_CONNECTIONS_JSON = original;
  vi.unstubAllGlobals();
});

describe('Moodle server adapter', () => {
  it('sends enrollment via allowlisted POST and never puts token in URL', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token', learnerRoleId: 5 } });
    const fetchMock = vi.fn().mockResolvedValue(new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    await enrollUser(tenant, 42, 17, 5);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://moodle.example.test/webservice/rest/server.php');
    expect(url).not.toContain('secret-test-token');
    const body = options.body as URLSearchParams;
    expect(body.get('wsfunction')).toBe('enrol_manual_enrol_users');
    expect(body.get('enrolments[0][courseid]')).toBe('42');
    expect(body.get('enrolments[0][userid]')).toBe('17');
    expect(moodleCourseUrl(tenant, 42)).toBe('https://moodle.example.test/course/view.php?id=42');
  });

  it('does not promote a criterion timestamp to a course completion timestamp or invent a score', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      completionstatus: { completed: true, aggregation: 1,
        completions: [{ timecompleted: 1781184000 }] }, warnings: []
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    const result = await readCompletion(tenant, 42, 17);
    expect(result.completed).toBe(true);
    expect(result.completedAt).toBeNull();
    expect(result.score).toBeNull();
    expect(result.attempts).toBeNull();
  });

  it('reads enrolled courses without requesting participant counts and rejects a malformed response', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({
      [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' }
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 42 }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await isUserEnrolled(tenant, 42, 17)).toBe(true);
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get('wsfunction')).toBe('core_enrol_get_users_courses');
    expect(body.get('returnusercount')).toBe('0');
    await expect(isUserEnrolled(tenant, 42, 17)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('observes the hosted Moodle 5.3.0 synthetic SCORM result without promoting course evidence', async () => {
    // Shapes and IDs from CI run 38169852450, synthetic-scorm-browser-evidence.
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ completionstatus: { completed: true,
        completions: [{ timecompleted: 1791748664 }] }, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attemptscount: 1, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statuses: [{ cmid: 3, modname: 'scorm',
        instance: 1, state: 1, timecompleted: 1791748664 }], warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ scoes: [{ id: 2, scorm: 1,
        scormtype: 'sco' }], warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { attempt: 1, tracks: [
        { element: 'score_raw', value: 100 }, { element: 'status', value: 'completed' },
        { element: 'cmi.core.score.raw', value: '100' },
        { element: 'cmi.core.lesson_status', value: 'completed' }
      ] }, warnings: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await readCompletion(tenant, 3, 4, 1, 3);
    expect(result.attempts).toBe(1);
    expect(result.completedAt).toBeNull();
    expect(result.score).toBeNull();
    expect(result.scormObservation).toMatchObject({ scormId: 1, activityModuleId: 3,
      activityState: 1, latestAttempt: 1, scoId: 2, lessonStatus: 'completed', rawScore: 100 });
    expect(result.scormObservation?.activityTimecompleted?.toISOString()).toBe('2026-10-11T19:57:44.000Z');
    expect(fetchMock.mock.calls.map((call) => (call[1] as RequestInit).body as URLSearchParams)
      .map((body) => body.get('wsfunction'))).toEqual([
        'core_completion_get_course_completion_status', 'mod_scorm_get_scorm_attempt_count',
        'core_completion_get_activities_completion_status', 'mod_scorm_get_scorm_scoes',
        'mod_scorm_get_scorm_sco_tracks'
      ]);
    const tracksBody = (fetchMock.mock.calls[4][1] as RequestInit).body as URLSearchParams;
    expect(tracksBody.get('scoid')).toBe('2');
    expect(tracksBody.get('attempt')).toBe('0');
  });

  it('observes an incomplete SCORM activity without inventing an attempt or completion time', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ completionstatus: { completed: false,
        completions: [] }, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attemptscount: 0, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statuses: [{ cmid: 3, modname: 'scorm',
        instance: 9, state: 0, timecompleted: 0 }], warnings: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await readCompletion(tenant, 42, 17, 9, 3);
    expect(result).toMatchObject({ completed: false, completedAt: null, score: null, attempts: 0,
      scormObservation: { activityState: 0, activityTimecompleted: null, latestAttempt: null,
        lessonStatus: null, rawScore: null } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails closed when a SCORM activity differs from the pinned course mapping', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ completionstatus: { completed: true,
        completions: [] }, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attemptscount: 1, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statuses: [{ cmid: 8, modname: 'scorm',
        instance: 9, state: 1, timecompleted: 1791748664 }], warnings: [] }), { status: 200 })));
    await expect(readCompletion(tenant, 42, 17, 9, 3)).rejects.toMatchObject({ code: 'activity_mapping_changed' });
  });

  it('fails closed on ambiguous SCOs or conflicting score tracks', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    const course = new Response(JSON.stringify({ completionstatus: { completed: true, completions: [] }, warnings: [] }), { status: 200 });
    const attempts = new Response(JSON.stringify({ attemptscount: 1, warnings: [] }), { status: 200 });
    const activity = new Response(JSON.stringify({ statuses: [{ cmid: 3, modname: 'scorm',
      instance: 9, state: 1, timecompleted: 1791748664 }], warnings: [] }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(course)
      .mockResolvedValueOnce(attempts)
      .mockResolvedValueOnce(activity)
      .mockResolvedValueOnce(new Response(JSON.stringify({ scoes: [
        { id: 2, scorm: 9, scormtype: 'sco' }, { id: 3, scorm: 9, scormtype: 'sco' }
      ], warnings: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(readCompletion(tenant, 42, 17, 9, 3)).rejects.toMatchObject({ code: 'unsupported_scorm_structure' });

    const conflicting = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ completionstatus: { completed: true, completions: [] }, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attemptscount: 1, warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ statuses: [{ cmid: 3, modname: 'scorm',
        instance: 9, state: 1, timecompleted: 1791748664 }], warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ scoes: [{ id: 2, scorm: 9,
        scormtype: 'sco' }], warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { attempt: 1, tracks: [
        { element: 'status', value: 'completed' }, { element: 'score_raw', value: 100 },
        { element: 'cmi.core.score.raw', value: 75 }
      ] }, warnings: [] }), { status: 200 }));
    vi.stubGlobal('fetch', conflicting);
    await expect(readCompletion(tenant, 42, 17, 9, 3)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('fails closed when Moodle returns duplicate exact HSE IDs', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: 17, idnumber: 'same-hse-id' }, { id: 18, idnumber: 'same-hse-id' }
    ]), { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(findMoodleUserByHseId(tenant, 'same-hse-id')).rejects.toMatchObject({ code: 'duplicate_hse_id' });
  });

  it('provisions an HSE ID through the configured external auth method', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({
      [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' }
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 17 }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await provisionMoodleUser(tenant, { hseId: '11111111-1111-4111-8111-111111111111',
      username: 'hse_test', firstName: 'Synthetic', lastName: 'Worker', email: 'synthetic@example.test'
    }, 'oauth2')).toBe(17);
    const lookup = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    const create = (fetchMock.mock.calls[1][1] as RequestInit).body as URLSearchParams;
    expect(lookup.get('wsfunction')).toBe('core_user_get_users_by_field');
    expect(lookup.get('values[0]')).toBe('11111111-1111-4111-8111-111111111111');
    expect(create.get('wsfunction')).toBe('core_user_create_users');
    expect(create.get('users[0][idnumber]')).toBe('11111111-1111-4111-8111-111111111111');
    expect(create.get('users[0][auth]')).toBe('oauth2');
    expect(create.get('users[0][createpassword]')).toBe('0');
  });

  it('submits instance-specific cohort membership and fails on Moodle warnings', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({
      [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' }
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ warnings: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ warnings: [
        { item: 'user', itemid: 17, warningcode: '2', message: 'User not found' }
      ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await addUserToCohort(tenant, 9, 17);
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
    expect(body.get('wsfunction')).toBe('core_cohort_add_cohort_members');
    expect(body.get('members[0][cohorttype][type]')).toBe('id');
    expect(body.get('members[0][cohorttype][value]')).toBe('9');
    expect(body.get('members[0][usertype][value]')).toBe('17');
    await expect(addUserToCohort(tenant, 9, 17)).rejects.toThrow(/User not found/);
  });

  it('rejects the same Moodle instance configured for different tenants', () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({
      [tenant]: { instanceId, baseUrl: 'https://moodle.example.test/', token: 'one' },
      'ddd38bf7-eaa5-4fed-a747-e17cf20d61f5': { instanceId: 'fc66cb77-2a35-4383-ad7b-91c8f67c65cc',
        baseUrl: 'https://moodle.example.test', token: 'two' }
    });
    expect(() => moodleConnection(tenant)).toThrow(/cannot be shared/);
  });
});
