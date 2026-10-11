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
        completions: [{ timecompleted: 1781184000 }] }
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

  it('reads Moodle 5.3 SCORM attemptscount while keeping completion time unverified', async () => {
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [tenant]: { instanceId, baseUrl: 'https://moodle.example.test', token: 'secret-test-token' } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ completionstatus: { completed: true, completions: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attemptscount: 2 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await readCompletion(tenant, 42, 17, 9);
    expect(result.attempts).toBe(2);
    expect(result.completedAt).toBeNull();
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toEqual(expect.any(URLSearchParams));
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
