/** Server-only Moodle boundary. Function availability and return shapes must be verified against the pinned installation. */
export const MOODLE_FUNCTIONS = [
  'enrol_manual_enrol_users',
  'core_completion_get_course_completion_status',
  'core_enrol_get_users_courses',
  'core_user_get_users_by_field',
  'core_user_create_users',
  'core_cohort_add_cohort_members',
  'mod_scorm_get_scorm_attempt_count'
] as const;
type MoodleFunction = typeof MOODLE_FUNCTIONS[number];

interface Connection { instanceId: string; baseUrl: string; token: string; learnerRoleId?: number; authMethod?: string }

function connections(): Record<string, Connection> {
  const raw = process.env.MOODLE_CONNECTIONS_JSON ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, Connection>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid MOODLE_CONNECTIONS_JSON');
  const instances = new Set<string>();
  const instanceIds = new Set<string>();
  for (const connection of Object.values(parsed)) {
    if (!connection?.baseUrl || !connection.token || !connection.instanceId
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connection.instanceId)) {
      throw new Error('Moodle connection requires a stable UUID instanceId, baseUrl, and token');
    }
    const url = new URL(connection.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Invalid Moodle connection configuration');
    }
    const instance = url.origin + url.pathname.replace(/\/+$/, '');
    if (instances.has(instance)) throw new Error('A Moodle instance cannot be shared by multiple tenants');
    if (instanceIds.has(connection.instanceId.toLowerCase())) throw new Error('A Moodle instance ID cannot be shared by multiple tenants');
    instances.add(instance);
    instanceIds.add(connection.instanceId.toLowerCase());
  }
  return parsed;
}

export function moodleConnection(tenantId: string): Connection | null {
  const connection = connections()[tenantId];
  if (!connection) return null;
  const url = new URL(connection.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !connection.token) {
    throw new Error('Invalid Moodle connection configuration');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production Moodle connection must use HTTPS');
  return { ...connection, baseUrl: url.origin + url.pathname.replace(/\/$/, '') };
}

export function moodleCourseUrl(tenantId: string, courseId: number): string | null {
  const connection = moodleConnection(tenantId);
  if (!connection || !Number.isSafeInteger(courseId) || courseId <= 0) return null;
  return `${connection.baseUrl}/course/view.php?id=${courseId}`;
}

export class MoodleError extends Error {
  constructor(message: string, readonly functionName: MoodleFunction, readonly code?: string) { super(message); }
}

function appendParams(body: URLSearchParams, prefix: string, value: unknown): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) { value.forEach((item, index) => appendParams(body, `${prefix}[${index}]`, item)); return; }
  if (typeof value === 'object') { Object.entries(value).forEach(([key, item]) => appendParams(body, `${prefix}[${key}]`, item)); return; }
  body.set(prefix, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
}

export async function moodleCall<T>(tenantId: string, fn: MoodleFunction, params: Record<string, unknown>): Promise<T> {
  const connection = moodleConnection(tenantId);
  if (!connection) throw new MoodleError('Moodle connection is not configured', fn, 'not_configured');
  const body = new URLSearchParams({ wstoken: connection.token, wsfunction: fn, moodlewsrestformat: 'json' });
  Object.entries(params).forEach(([key, value]) => appendParams(body, key, value));
  const response = await fetch(`${connection.baseUrl}/webservice/rest/server.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new MoodleError(`Moodle HTTP ${response.status}`, fn, 'http_error');
  const result = await response.json() as Record<string, unknown>;
  if (result && typeof result === 'object' && typeof result.exception === 'string') {
    throw new MoodleError(String(result.message ?? result.exception), fn, String(result.errorcode ?? result.exception));
  }
  return result as T;
}

export async function enrollUser(tenantId: string, courseId: number, userId: number, learnerRoleId: number): Promise<void> {
  if (![courseId, userId, learnerRoleId].every((value) => Number.isSafeInteger(value) && value > 0)) throw new Error('Invalid Moodle enrollment IDs');
  await moodleCall<unknown>(tenantId, 'enrol_manual_enrol_users', {
    enrollments: [{ roleid: learnerRoleId, userid: userId, courseid: courseId }]
  });
}

export async function addUserToCohort(tenantId: string, cohortId: number, userId: number): Promise<void> {
  if (![cohortId, userId].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error('Invalid Moodle cohort or user ID');
  }
  const result = await moodleCall<{ warnings?: Array<{ warningcode: string | number; message?: string }> }>(
    tenantId, 'core_cohort_add_cohort_members', {
      members: [{ cohorttype: { type: 'id', value: String(cohortId) },
        usertype: { type: 'id', value: String(userId) } }]
    });
  if (!result || !Array.isArray(result.warnings)) throw new Error('Moodle did not confirm cohort membership');
  const failures = result.warnings.filter((warning) => String(warning.warningcode) !== '3');
  if (failures.length) throw new Error(`Moodle cohort membership failed: ${failures[0].message ?? 'warning'}`);
}

export interface MoodleCompletion {
  completed: boolean;
  completedAt: Date | null;
  score: number | null;
  attempts: number | null;
  raw: unknown;
}

export async function readCompletion(tenantId: string, courseId: number, userId: number, scormId?: number | null): Promise<MoodleCompletion> {
  const raw = await moodleCall<{ completionstatus?: { completed?: boolean; aggregation?: number;
    completions?: Array<{ timecompleted?: number | null }> } }>(
    tenantId, 'core_completion_get_course_completion_status', { courseid: courseId, userid: userId });
  const status = raw.completionstatus;
  const completed = status?.completed === true;
  // This Moodle 5.3 response has criterion timestamps, not a canonical course completion time.
  // Do not promote one criterion's time to the course completion evidence without Gate B validation.
  const completedAt = null;
  let attempts: number | null = null;
  let scormRaw: unknown = null;
  if (scormId && completed) {
    scormRaw = await moodleCall<{ attemptscount?: number }>(tenantId, 'mod_scorm_get_scorm_attempt_count', { scormid: scormId, userid: userId });
    const value = (scormRaw as { attemptscount?: unknown }).attemptscount;
    if (typeof value === 'number' && Number.isSafeInteger(value)) attempts = value;
  }
  // Moodle's course-completion service does not itself guarantee score or attempt details.
  // Score stays null until Gate B validates the actual activity and a documented read path.
  return { completed, completedAt, score: null, attempts, raw: { course: raw, scorm: scormRaw } };
}

export async function isUserEnrolled(tenantId: string, courseId: number, userId: number): Promise<boolean> {
  const courses = await moodleCall<Array<{ id: number }>>(tenantId, 'core_enrol_get_users_courses', {
    userid: userId, returnusercount: false
  });
  if (!Array.isArray(courses)) {
    throw new MoodleError('Moodle did not return an enrolled-course list', 'core_enrol_get_users_courses', 'invalid_response');
  }
  return courses.some((course) => course.id === courseId);
}

export async function findMoodleUserByHseId(tenantId: string, hseId: string): Promise<number | null> {
  const users = await moodleCall<Array<{ id: number; idnumber?: string }>>(tenantId, 'core_user_get_users_by_field',
    { field: 'idnumber', values: [hseId] });
  const matches = users.filter((user) => user.idnumber === hseId);
  if (matches.length > 1) throw new MoodleError('Multiple Moodle users share one HSE ID',
    'core_user_get_users_by_field', 'duplicate_hse_id');
  const match = matches[0];
  return match && Number.isSafeInteger(match.id) && match.id > 0 ? match.id : null;
}

export async function provisionMoodleUser(tenantId: string, person: {
  hseId: string; username: string; firstName: string; lastName: string; email: string;
}, authMethod: string): Promise<number> {
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(authMethod) || authMethod === 'manual') throw new Error('A tested external Moodle auth method is required');
  const existing = await findMoodleUserByHseId(tenantId, person.hseId);
  if (existing) return existing;
  const created = await moodleCall<Array<{ id: number }>>(tenantId, 'core_user_create_users', {
    users: [{ username: person.username, firstname: person.firstName, lastname: person.lastName,
      email: person.email, idnumber: person.hseId, auth: authMethod, createpassword: 0 }]
  });
  if (!Array.isArray(created) || !created[0] || !Number.isSafeInteger(created[0].id)) throw new Error('Moodle did not return a created user ID');
  return created[0].id;
}
