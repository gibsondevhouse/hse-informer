/** Server-only Moodle boundary. Function availability and return shapes must be verified against the pinned installation. */
export const MOODLE_FUNCTIONS = [
  'core_course_get_courses_by_field',
  'local_hse_evidence_get_completion',
  'local_hse_evidence_end_user_sessions',
  'local_hse_evidence_link_oauth_login',
  'enrol_manual_enrol_users',
  'core_completion_get_course_completion_status',
  'core_enrol_get_users_courses',
  'core_user_get_users_by_field',
  'core_user_create_users',
  'core_user_update_users',
  'core_user_update_user_preferences',
  'core_message_get_user_notification_preferences',
  'core_cohort_add_cohort_members',
  'mod_scorm_get_scorm_attempt_count',
  'mod_scorm_get_scorm_scoes',
  'mod_scorm_get_scorm_sco_tracks',
  'mod_quiz_get_quizzes_by_courses',
  'mod_quiz_get_user_quiz_attempts',
  'core_completion_get_activities_completion_status'
] as const;
type MoodleFunction = typeof MOODLE_FUNCTIONS[number];

interface Connection { instanceId: string; baseUrl: string; token: string; learnerRoleId?: number; authMethod?: string;
  oauthIssuerId?: number; oauthBridgeToken?: string;
  completionEvidence?: 'local_hse_evidence' }

function connections(): Record<string, Connection> {
  const raw = process.env.MOODLE_CONNECTIONS_JSON ?? '{}';
  const parsed = JSON.parse(raw) as Record<string, Connection>;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid MOODLE_CONNECTIONS_JSON');
  const instances = new Set<string>();
  const instanceIds = new Set<string>();
  for (const connection of Object.values(parsed)) {
    if (connection.oauthIssuerId !== undefined && (!Number.isSafeInteger(connection.oauthIssuerId) || connection.oauthIssuerId <= 0)) {
      throw new Error('Moodle OAuth issuer ID must be a positive integer');
    }
    if (connection.completionEvidence !== undefined && connection.completionEvidence !== 'local_hse_evidence') {
      throw new Error('Unknown Moodle completion evidence provider');
    }
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
  const token = fn === 'local_hse_evidence_link_oauth_login' ? connection.oauthBridgeToken : connection.token;
  if (!token) throw new MoodleError('The dedicated Moodle identity bridge token is not configured', fn, 'not_configured');
  const body = new URLSearchParams({ wstoken: token, wsfunction: fn, moodlewsrestformat: 'json' });
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
    enrolments: [{ roleid: learnerRoleId, userid: userId, courseid: courseId }]
  });
}

/** Bind an existing external-auth learner through Moodle's supported OAuth linking API. */
export async function linkMoodleUser(tenantId: string, identity: {
  userId: number; hseId: string; subject: string; identityEmail: string; issuer: string;
}): Promise<void> {
  const fn = 'local_hse_evidence_link_oauth_login';
  const connection = moodleConnection(tenantId);
  const expectedIssuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
  if (connection?.authMethod !== 'oauth2' || !connection.oauthIssuerId
    || typeof connection.oauthBridgeToken !== 'string' || !connection.oauthBridgeToken || !expectedIssuer) {
    throw new MoodleError('The Moodle OAuth identity bridge is not configured', fn, 'not_configured');
  }
  positiveInteger(identity.userId, fn);
  if (identity.issuer !== expectedIssuer || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(identity.hseId)
    || !/^[a-z0-9][a-z0-9._:@-]{0,254}$/.test(identity.subject) || !identity.identityEmail || identity.identityEmail.length > 254) {
    throw new MoodleError('Invalid scoped Moodle identity binding', fn, 'invalid_identity');
  }
  const result = responseObject(await moodleCall<unknown>(tenantId, fn, {
    userid: identity.userId, hseid: identity.hseId, subject: identity.subject,
    identityemail: identity.identityEmail, issuerid: connection.oauthIssuerId, issuerurl: expectedIssuer
  }), fn);
  if (result.userid !== identity.userId || result.issuerid !== connection.oauthIssuerId || result.linked !== true) {
    throw new MoodleError('Moodle did not confirm the exact identity binding', fn, 'invalid_response');
  }
}

/** Moodle 5.3 core suspends login and destroys the user's sessions in this call. */
export async function suspendMoodleUser(tenantId: string, userId: number, suspended: boolean): Promise<void> {
  positiveInteger(userId, 'core_user_update_users');
  if (typeof suspended !== 'boolean') throw new Error('A boolean Moodle suspension state is required');
  const result = responseObject(await moodleCall<unknown>(tenantId, 'core_user_update_users', {
    users: [{ id: userId, suspended }]
  }), 'core_user_update_users');
  checkedWarnings(result.warnings, 'core_user_update_users');
  const users = await moodleCall<Array<{ id: number; suspended?: boolean | number }>>(tenantId, 'core_user_get_users_by_field', {
    field: 'id', values: [String(userId)]
  });
  if (!Array.isArray(users) || users.length !== 1 || users[0].id !== userId ||
    ![true, false, 0, 1].includes(users[0].suspended as boolean | number) || Boolean(users[0].suspended) !== suspended) {
    throw new MoodleError('Moodle did not confirm the requested account suspension state', 'core_user_update_users', 'invalid_response');
  }
}

/** Suppress notifications for a technical identity address and verify Moodle applied it. */
export async function suppressMoodleEmail(tenantId: string, userId: number): Promise<void> {
  positiveInteger(userId, 'core_user_update_user_preferences');
  const result = await moodleCall<unknown>(tenantId, 'core_user_update_user_preferences', {
    userid: userId, emailstop: 1, preferences: []
  });
  if (result !== null) throw new MoodleError('Unexpected notification update response', 'core_user_update_user_preferences', 'invalid_response');
  const readback = responseObject(await moodleCall<unknown>(tenantId, 'core_message_get_user_notification_preferences', { userid: userId }),
    'core_message_get_user_notification_preferences');
  checkedWarnings(readback.warnings, 'core_message_get_user_notification_preferences');
  const preferences = responseObject(readback.preferences, 'core_message_get_user_notification_preferences');
  if (preferences.userid !== userId || preferences.disableall !== 1) {
    throw new MoodleError('Moodle did not confirm notification suppression for the technical identity',
      'core_message_get_user_notification_preferences', 'invalid_response');
  }
}

/** End only the server-resolved worker's Moodle sessions during coordinated logout. */
export async function endMoodleUserSessions(tenantId: string, userId: number): Promise<void> {
  const fn = 'local_hse_evidence_end_user_sessions';
  positiveInteger(userId, fn);
  if (moodleConnection(tenantId)?.completionEvidence !== 'local_hse_evidence') {
    throw new MoodleError('The Moodle session-ending service is not configured', fn, 'not_configured');
  }
  const result = responseObject(await moodleCall<unknown>(tenantId, fn, { userid: userId }), fn);
  if (result.userid !== userId || result.ended !== true) {
    throw new MoodleError('Moodle did not confirm that the mapped worker sessions ended', fn, 'invalid_response');
  }
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
  scormObservation: MoodleScormObservation | null;
  quizObservation: MoodleQuizObservation | null;
  raw: unknown;
  sourceCompletionId?: number;
}

/** Read the exact mapped course; the token must be able to inspect its settings. */
export async function inspectMoodleCourse(tenantId: string, courseId: number) {
  const fn = 'core_course_get_courses_by_field';
  positiveInteger(courseId, fn);
  const result = responseObject(await moodleCall<unknown>(tenantId, fn, { field: 'id', value: String(courseId) }), fn);
  checkedWarnings(result.warnings, fn);
  if (!Array.isArray(result.courses) || result.courses.length !== 1) {
    throw new MoodleError('Moodle course was not found or is inaccessible', fn, 'invalid_mapping');
  }
  const course = responseObject(result.courses[0], fn);
  if (course.id !== courseId || typeof course.fullname !== 'string' || course.enablecompletion !== 1) {
    throw new MoodleError('Moodle course completion must be enabled and inspectable', fn, 'invalid_mapping');
  }
  return { id: courseId, title: course.fullname, shortName: String(course.shortname ?? ''),
    completionEnabled: true, visible: course.visible === 1 };
}

/** Resolve one pinned Quiz in its exact course/module without retaining manager-only settings. */
export async function inspectMoodleQuiz(tenantId: string, courseId: number, quizId: number, activityModuleId: number) {
  const fn = 'mod_quiz_get_quizzes_by_courses';
  for (const id of [courseId, quizId, activityModuleId]) positiveInteger(id, fn);
  const result = responseObject(await moodleCall<unknown>(tenantId, fn, { courseids: [courseId] }), fn);
  checkedWarnings(result.warnings, fn);
  if (!Array.isArray(result.quizzes)) throw new MoodleError('Missing Moodle quiz list', fn, 'invalid_response');
  const matching = result.quizzes.filter((item: unknown) => item && typeof item === 'object'
    && !Array.isArray(item) && (item as Record<string, unknown>).id === quizId);
  if (matching.length !== 1) throw new MoodleError('Quiz mapping is missing or ambiguous', fn, 'invalid_mapping');
  const quiz = responseObject(matching[0], fn);
  if (quiz.course !== courseId || quiz.coursemodule !== activityModuleId) {
    throw new MoodleError('Quiz does not match the pinned course and activity module', fn, 'invalid_mapping');
  }
  if (typeof quiz.name !== 'string' || typeof quiz.grade !== 'number' || !Number.isFinite(quiz.grade) || quiz.grade < 0
    || typeof quiz.sumgrades !== 'number' || !Number.isFinite(quiz.sumgrades) || quiz.sumgrades < 0
    || ![1, 2, 3, 4].includes(quiz.grademethod as number)
    || !Number.isSafeInteger(quiz.attempts) || (quiz.attempts as number) < 0) {
    throw new MoodleError('Quiz assessment settings are missing or malformed', fn, 'invalid_response');
  }
  return { id: quizId, courseId, activityModuleId, title: quiz.name,
    maximumGrade: quiz.grade, totalMarks: quiz.sumgrades,
    gradingMethod: quiz.grademethod as 1 | 2 | 3 | 4, serviceAccountAttemptLimit: quiz.attempts as number };
}

export interface MoodleQuizObservation {
  quizId: number;
  courseId: number;
  activityModuleId: number;
  activityState: 0 | 1 | 2 | 3 | 4;
  /** Activity state update time, not a course completion timestamp. */
  activityUpdatedAt: Date | null;
  maximumGrade: number;
  totalMarks: number;
  gradingMethod: 1 | 2 | 3 | 4;
  /** Service-account effective setting; learner overrides are not exposed here. Zero means unlimited. */
  serviceAccountAttemptLimit: number;
  observedAt: Date;
  attempts: Array<{
    id: number;
    attemptNumber: number;
    state: 'notstarted' | 'inprogress' | 'overdue' | 'submitted' | 'finished' | 'abandoned';
    currentPage: number;
    startedAt: Date | null;
    /** Moodle timefinish is submission time; grading may complete later. */
    submittedAt: Date | null;
    modifiedAt: Date | null;
    /** Quiz marks, not a percent or canonical course grade; may be hidden. */
    rawMarks: number | null;
  }>;
}

/** Observed SCORM and activity fields only. This is not course-completion evidence. */
export interface MoodleScormObservation {
  scormId: number;
  activityModuleId: number;
  activityState: 0 | 1 | 2 | 3;
  /** Moodle's activity `timecompleted` field is backed by state `timemodified`. */
  activityTimecompleted: Date | null;
  latestAttempt: number | null;
  scoId: number | null;
  lessonStatus: string | null;
  rawScore: number | null;
}

function responseObject(value: unknown, fn: MoodleFunction): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MoodleError('Malformed Moodle response', fn, 'invalid_response');
  }
  return value as Record<string, unknown>;
}

function checkedWarnings(value: unknown, fn: MoodleFunction): void {
  if (!Array.isArray(value)) throw new MoodleError('Missing Moodle warnings array', fn, 'invalid_response');
  if (value.length) throw new MoodleError('Moodle returned warnings', fn, 'moodle_warning');
}

function positiveInteger(value: unknown, fn: MoodleFunction): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new MoodleError('Invalid Moodle identifier or attempt', fn, 'invalid_response');
  }
  return value as number;
}

function activityTimestamp(value: unknown): Date | null {
  const fn = 'core_completion_get_activities_completion_status';
  if (value === 0 || value === null) return null;
  const seconds = positiveInteger(value, fn);
  const date = new Date(seconds * 1000);
  if (!Number.isFinite(date.getTime())) throw new MoodleError('Invalid Moodle activity timestamp', fn, 'invalid_response');
  return date;
}

function quizTimestamp(value: unknown): Date | null {
  if (value === 0 || value === null) return null;
  const fn = 'mod_quiz_get_user_quiz_attempts';
  const date = new Date(positiveInteger(value, fn) * 1000);
  if (!Number.isFinite(date.getTime())) throw new MoodleError('Invalid Quiz attempt timestamp', fn, 'invalid_response');
  return date;
}

function quizAttempts(value: unknown, quizId: number, userId: number): MoodleQuizObservation['attempts'] {
  const fn = 'mod_quiz_get_user_quiz_attempts';
  const response = responseObject(value, fn);
  checkedWarnings(response.warnings, fn);
  if (!Array.isArray(response.attempts)) throw new MoodleError('Missing Quiz attempts', fn, 'invalid_response');
  const ids = new Set<number>();
  const numbers = new Set<number>();
  const attempts = response.attempts.map((item: unknown) => {
    const attempt = responseObject(item, fn);
    const id = positiveInteger(attempt.id, fn);
    const attemptNumber = positiveInteger(attempt.attempt, fn);
    if (attempt.quiz !== quizId || attempt.userid !== userId || attempt.preview !== 0
      || ids.has(id) || numbers.has(attemptNumber)) {
      throw new MoodleError('Quiz attempts are duplicated or outside the pinned learner and assessment', fn, 'invalid_response');
    }
    ids.add(id);
    numbers.add(attemptNumber);
    if (!['notstarted', 'inprogress', 'overdue', 'submitted', 'finished', 'abandoned'].includes(attempt.state as string)
      || !Number.isSafeInteger(attempt.currentpage) || (attempt.currentpage as number) < 0
      || (attempt.sumgrades !== null && (typeof attempt.sumgrades !== 'number' || !Number.isFinite(attempt.sumgrades)))
      || (attempt.state !== 'finished' && attempt.sumgrades !== null)) {
      throw new MoodleError('Malformed Quiz attempt state or marks', fn, 'invalid_response');
    }
    const startedAt = quizTimestamp(attempt.timestart);
    const submittedAt = quizTimestamp(attempt.timefinish);
    const modifiedAt = quizTimestamp(attempt.timemodified);
    if ((attempt.state !== 'notstarted' && !startedAt)
      || (attempt.state === 'finished' && !submittedAt)
      || (startedAt && submittedAt && submittedAt < startedAt)) {
      throw new MoodleError('Quiz attempt timestamps do not match its state', fn, 'invalid_response');
    }
    return { id, attemptNumber, state: attempt.state as MoodleQuizObservation['attempts'][number]['state'],
      currentPage: attempt.currentpage as number, startedAt, submittedAt, modifiedAt,
      rawMarks: attempt.sumgrades as number | null };
  });
  return attempts.sort((left, right) => left.attemptNumber - right.attemptNumber);
}

function scormTracks(value: unknown): { attempt: number; lessonStatus: string; rawScore: number | null } {
  const fn = 'mod_scorm_get_scorm_sco_tracks';
  const response = responseObject(value, fn);
  checkedWarnings(response.warnings, fn);
  const data = responseObject(response.data, fn);
  const attempt = positiveInteger(data.attempt, fn);
  if (!Array.isArray(data.tracks)) throw new MoodleError('Missing SCORM tracks', fn, 'invalid_response');
  const tracks = new Map<string, string>();
  for (const item of data.tracks) {
    const track = responseObject(item, fn);
    if (typeof track.element !== 'string' || !track.element
      || (typeof track.value !== 'string' && typeof track.value !== 'number')) {
      throw new MoodleError('Malformed SCORM track', fn, 'invalid_response');
    }
    const value = String(track.value);
    if (tracks.has(track.element) && tracks.get(track.element) !== value) {
      throw new MoodleError('Conflicting SCORM track values', fn, 'invalid_response');
    }
    tracks.set(track.element, value);
  }
  const status = tracks.get('status') ?? tracks.get('cmi.core.lesson_status');
  const reportedStatus = tracks.get('cmi.core.lesson_status');
  if (!status || (reportedStatus && reportedStatus !== status)) {
    throw new MoodleError('Missing or conflicting SCORM lesson status', fn, 'invalid_response');
  }
  const scoreText = tracks.get('score_raw') ?? tracks.get('cmi.core.score.raw');
  const reportedScore = tracks.get('cmi.core.score.raw');
  if (scoreText !== undefined && reportedScore !== undefined && Number(scoreText) !== Number(reportedScore)) {
    throw new MoodleError('Conflicting SCORM scores', fn, 'invalid_response');
  }
  let rawScore: number | null = null;
  if (scoreText !== undefined) {
    rawScore = Number(scoreText);
    if (!scoreText.trim() || !Number.isFinite(rawScore) || rawScore < 0 || rawScore > 100) {
      throw new MoodleError('Invalid SCORM raw score', fn, 'invalid_response');
    }
  }
  return { attempt, lessonStatus: status, rawScore };
}

export async function readCompletion(tenantId: string, courseId: number, userId: number,
  scormId?: number | null, expectedActivityModuleId?: number | null, quizId?: number | null): Promise<MoodleCompletion> {
  positiveInteger(courseId, 'core_completion_get_course_completion_status');
  positiveInteger(userId, 'core_completion_get_course_completion_status');
  const hasScorm = scormId !== null && scormId !== undefined;
  const hasQuiz = quizId !== null && quizId !== undefined;
  if ((hasScorm && hasQuiz) || (hasQuiz && (expectedActivityModuleId === null || expectedActivityModuleId === undefined))) {
    throw new MoodleError('Map one assessment with its exact activity module', 'mod_quiz_get_quizzes_by_courses', 'invalid_mapping');
  }
  if (expectedActivityModuleId !== null && expectedActivityModuleId !== undefined) {
    positiveInteger(expectedActivityModuleId, 'core_completion_get_activities_completion_status');
    if (!hasScorm && !hasQuiz) {
      throw new MoodleError('Activity mapping requires an assessment mapping',
        'core_completion_get_activities_completion_status', 'invalid_mapping');
    }
  }
  const quiz = hasQuiz ? await inspectMoodleQuiz(tenantId, courseId, quizId, expectedActivityModuleId!) : null;
  const courseRaw = await moodleCall<unknown>(
    tenantId, 'core_completion_get_course_completion_status', { courseid: courseId, userid: userId });
  const course = responseObject(courseRaw, 'core_completion_get_course_completion_status');
  checkedWarnings(course.warnings, 'core_completion_get_course_completion_status');
  const status = responseObject(course.completionstatus, 'core_completion_get_course_completion_status');
  if (typeof status.completed !== 'boolean' || !Array.isArray(status.completions)) {
    throw new MoodleError('Malformed course completion status', 'core_completion_get_course_completion_status', 'invalid_response');
  }
  const completed = status.completed;
  // This Moodle 5.3 response has criterion timestamps, not a canonical course completion time.
  // Do not promote one criterion's time to the course completion evidence without Gate B validation.
  let completedAt: Date | null = null;
  let canonicalRaw: unknown = null;
  let canonicalScore: number | null = null;
  let sourceCompletionId: number | undefined;
  if (completed && moodleConnection(tenantId)?.completionEvidence === 'local_hse_evidence') {
    canonicalRaw = await moodleCall<unknown>(tenantId, 'local_hse_evidence_get_completion', { courseid: courseId, userid: userId });
    const canonical = responseObject(canonicalRaw, 'local_hse_evidence_get_completion');
    if (canonical.courseid !== courseId || canonical.userid !== userId || canonical.completed !== true) {
      throw new MoodleError('Canonical completion does not match the requested learner and course',
        'local_hse_evidence_get_completion', 'invalid_response');
    }
    sourceCompletionId = positiveInteger(canonical.completionid, 'local_hse_evidence_get_completion');
    const seconds = positiveInteger(canonical.timecompleted, 'local_hse_evidence_get_completion');
    completedAt = new Date(seconds * 1000);
    if (!Number.isFinite(completedAt.getTime()) || completedAt.getTime() > Date.now() + 1000) {
      throw new MoodleError('Invalid canonical completion timestamp', 'local_hse_evidence_get_completion', 'invalid_response');
    }
    if (canonical.score !== null && canonical.score !== undefined) {
      if (typeof canonical.score !== 'number' || !Number.isFinite(canonical.score) || canonical.score < 0 || canonical.score > 100) {
        throw new MoodleError('Invalid canonical course grade', 'local_hse_evidence_get_completion', 'invalid_response');
      }
      canonicalScore = canonical.score;
    }
  }
  let attempts: number | null = null;
  let scormObservation: MoodleScormObservation | null = null;
  let quizObservation: MoodleQuizObservation | null = null;
  let attemptRaw: unknown = null;
  let scoesRaw: unknown = null;
  let tracksRaw: unknown = null;
  let activityRaw: unknown = null;
  if (scormId !== null && scormId !== undefined) {
    positiveInteger(scormId, 'mod_scorm_get_scorm_attempt_count');
    attemptRaw = await moodleCall<unknown>(tenantId, 'mod_scorm_get_scorm_attempt_count', { scormid: scormId, userid: userId });
    const attemptResponse = responseObject(attemptRaw, 'mod_scorm_get_scorm_attempt_count');
    checkedWarnings(attemptResponse.warnings, 'mod_scorm_get_scorm_attempt_count');
    if (!Number.isSafeInteger(attemptResponse.attemptscount) || (attemptResponse.attemptscount as number) < 0) {
      throw new MoodleError('Invalid SCORM attempt count', 'mod_scorm_get_scorm_attempt_count', 'invalid_response');
    }
    attempts = attemptResponse.attemptscount as number;

    activityRaw = await moodleCall<unknown>(tenantId, 'core_completion_get_activities_completion_status',
      { courseid: courseId, userid: userId });
    const activityResponse = responseObject(activityRaw, 'core_completion_get_activities_completion_status');
    checkedWarnings(activityResponse.warnings, 'core_completion_get_activities_completion_status');
    if (!Array.isArray(activityResponse.statuses)) {
      throw new MoodleError('Missing Moodle activity statuses', 'core_completion_get_activities_completion_status', 'invalid_response');
    }
    const matching = activityResponse.statuses.filter((item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const candidate = item as Record<string, unknown>;
      return candidate.modname === 'scorm' && candidate.instance === scormId;
    });
    if (matching.length !== 1) {
      throw new MoodleError('SCORM activity mapping is missing or ambiguous', 'core_completion_get_activities_completion_status', 'invalid_response');
    }
    const activity = responseObject(matching[0], 'core_completion_get_activities_completion_status');
    const activityModuleId = positiveInteger(activity.cmid, 'core_completion_get_activities_completion_status');
    if (expectedActivityModuleId !== null && expectedActivityModuleId !== undefined
      && activityModuleId !== expectedActivityModuleId) {
      throw new MoodleError('SCORM activity differs from the pinned course version',
        'core_completion_get_activities_completion_status', 'activity_mapping_changed');
    }
    if (![0, 1, 2, 3].includes(activity.state as number)) {
      throw new MoodleError('Invalid SCORM activity state', 'core_completion_get_activities_completion_status', 'invalid_response');
    }
    const activityState = activity.state as 0 | 1 | 2 | 3;
    const activityTimecompleted = activityTimestamp(activity.timecompleted);
    if (activityState !== 0 && !activityTimecompleted) {
      throw new MoodleError('Completed SCORM activity lacks timestamp', 'core_completion_get_activities_completion_status', 'invalid_response');
    }

    let scoId: number | null = null;
    let latestAttempt: number | null = null;
    let lessonStatus: string | null = null;
    let rawScore: number | null = null;
    if (attempts > 0) {
      scoesRaw = await moodleCall<unknown>(tenantId, 'mod_scorm_get_scorm_scoes', { scormid: scormId });
      const scoesResponse = responseObject(scoesRaw, 'mod_scorm_get_scorm_scoes');
      checkedWarnings(scoesResponse.warnings, 'mod_scorm_get_scorm_scoes');
      if (!Array.isArray(scoesResponse.scoes)) {
        throw new MoodleError('Missing SCORM SCO list', 'mod_scorm_get_scorm_scoes', 'invalid_response');
      }
      const scoes = scoesResponse.scoes.filter((item: unknown) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
        return (item as Record<string, unknown>).scormtype === 'sco';
      });
      if (scoes.length !== 1) {
        throw new MoodleError('SCORM observation requires exactly one SCO', 'mod_scorm_get_scorm_scoes', 'unsupported_scorm_structure');
      }
      const sco = responseObject(scoes[0], 'mod_scorm_get_scorm_scoes');
      scoId = positiveInteger(sco.id, 'mod_scorm_get_scorm_scoes');
      if (sco.scorm !== scormId) {
        throw new MoodleError('SCO belongs to a different SCORM activity', 'mod_scorm_get_scorm_scoes', 'invalid_response');
      }
      tracksRaw = await moodleCall<unknown>(tenantId, 'mod_scorm_get_scorm_sco_tracks',
        { scoid: scoId, userid: userId, attempt: 0 });
      const tracks = scormTracks(tracksRaw);
      latestAttempt = tracks.attempt;
      lessonStatus = tracks.lessonStatus;
      rawScore = tracks.rawScore;
    }
    scormObservation = { scormId, activityModuleId, activityState, activityTimecompleted,
      latestAttempt, scoId, lessonStatus, rawScore };
  }
  if (quiz) {
    const fn = 'core_completion_get_activities_completion_status';
    const response = responseObject(await moodleCall<unknown>(tenantId, fn,
      { courseid: courseId, userid: userId }), fn);
    checkedWarnings(response.warnings, fn);
    if (!Array.isArray(response.statuses)) throw new MoodleError('Missing Moodle activity statuses', fn, 'invalid_response');
    const matching = response.statuses.filter((item: unknown) => item && typeof item === 'object'
      && !Array.isArray(item) && (item as Record<string, unknown>).modname === 'quiz'
      && (item as Record<string, unknown>).instance === quiz.id);
    if (matching.length !== 1) throw new MoodleError('Quiz activity mapping is missing or ambiguous', fn, 'invalid_mapping');
    const activity = responseObject(matching[0], fn);
    if (activity.cmid !== quiz.activityModuleId) {
      throw new MoodleError('Quiz activity differs from the pinned course version', fn, 'activity_mapping_changed');
    }
    if (![0, 1, 2, 3, 4].includes(activity.state as number)) {
      throw new MoodleError('Invalid Quiz activity state', fn, 'invalid_response');
    }
    const activityUpdatedAt = activityTimestamp(activity.timecompleted);
    if (activity.state !== 0 && !activityUpdatedAt) {
      throw new MoodleError('Completed Quiz activity lacks its state timestamp', fn, 'invalid_response');
    }
    const observedAttempts = quizAttempts(await moodleCall<unknown>(tenantId, 'mod_quiz_get_user_quiz_attempts',
      { quizid: quiz.id, userid: userId, status: 'all', includepreviews: false }), quiz.id, userId);
    attempts = observedAttempts.filter((attempt) => attempt.state !== 'notstarted').length;
    quizObservation = { quizId: quiz.id, courseId, activityModuleId: quiz.activityModuleId,
      activityState: activity.state as MoodleQuizObservation['activityState'], activityUpdatedAt,
      maximumGrade: quiz.maximumGrade, totalMarks: quiz.totalMarks, gradingMethod: quiz.gradingMethod,
      serviceAccountAttemptLimit: quiz.serviceAccountAttemptLimit, observedAt: new Date(), attempts: observedAttempts };
  }
  // Assessment observations describe the scoped state when read. Only the
  // canonical completion provider establishes the course completion time/grade.
  return { completed, completedAt, score: canonicalScore, attempts, scormObservation, quizObservation, sourceCompletionId,
    raw: { course: courseRaw, canonical: canonicalRaw, scormAttemptCount: attemptRaw, scormScoes: scoesRaw,
      scormTracks: tracksRaw, activity: activityRaw, quiz: quizObservation } };
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
  hseId: string; username: string; firstName: string; lastName: string; email: string; suppressEmail?: boolean;
}, authMethod: string): Promise<number> {
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(authMethod) || authMethod === 'manual') throw new Error('A tested external Moodle auth method is required');
  const existing = await findMoodleUserByHseId(tenantId, person.hseId);
  if (existing) {
    if (person.suppressEmail) await suppressMoodleEmail(tenantId, existing);
    return existing;
  }
  const created = await moodleCall<Array<{ id: number }>>(tenantId, 'core_user_create_users', {
    users: [{ username: person.username, firstname: person.firstName, lastname: person.lastName,
      email: person.email, idnumber: person.hseId, auth: authMethod, createpassword: 0 }]
  });
  if (!Array.isArray(created) || !created[0] || !Number.isSafeInteger(created[0].id)) throw new Error('Moodle did not return a created user ID');
  if (person.suppressEmail) await suppressMoodleEmail(tenantId, created[0].id);
  return created[0].id;
}
