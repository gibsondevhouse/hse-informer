import { createHash } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { query, transaction } from './db';
import { requireRole, type Actor } from './auth';
import { inspectMoodleCourse, inspectMoodleQuiz, moodleConnection, moodleCourseUrl } from './moodle';

const createSchema = z.strictObject({
  requirementId: z.uuid().optional(), code: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(250), version: z.string().trim().min(1).max(80),
  sourceContentId: z.string().trim().min(1).max(200),
  language: z.string().trim().min(2).max(30).default('en-US'),
  packageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  exportFormat: z.enum(['scorm_1_2','scorm_2004','xapi','cmi5','lti','video','url','unknown']),
  moodleCourseId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  moodleActivityId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  moodleScormId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  moodleQuizId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  practiceOnly: z.boolean().default(false),
  authority: z.string().trim().min(3).max(1000).default('Employer-authored content; HSE review pending'),
  audience: z.string().trim().min(3).max(1000).default('Assigned workers')
}).refine((v) => !(v.moodleScormId && v.moodleQuizId),
  { message: 'Choose one assessment: SCORM or a native Moodle quiz' })
  .refine((v) => Boolean(v.moodleActivityId) === Boolean(v.moodleScormId || v.moodleQuizId),
    { message: 'Provide the assessment activity module ID and its instance ID together, or leave all assessment IDs blank' });
const actionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('verify'), note: z.string().trim().min(15).max(3000) }),
  z.strictObject({ action: z.literal('approve') }),
  z.strictObject({ action: z.literal('approve-requirement') }),
  z.strictObject({ action: z.literal('retire') })
]);

interface CourseRow {
  id: string; requirement_id: string; requirement_version_id: string; code: string;
  title: string; content_id: string; content_version: string; language_code: string;
  practice_only: boolean; package_sha256: string; export_format: string;
  moodle_course_id: string | null; moodle_activity_id: string | null; moodle_scorm_id: string | null; moodle_quiz_id: string | null;
  review_status: string; requirement_review_status: string; reviewed_by: string | null;
  reviewed_at: Date | null; completion_criteria_verified: boolean; completion_verification_note: string | null;
}
export interface CourseItem {
  id: string; requirementId: string; requirementVersionId: string; code: string; title: string;
  sourceContentId: string; version: string; language: string; practiceOnly: boolean;
  packageSha256: string; exportFormat: string; moodleCourseId: number | null;
  moodleActivityId: number | null; moodleScormId: number | null; moodleQuizId: number | null; launchUrl: string | null;
  reviewStatus: string; requirementReviewStatus: string; reviewedBy: string | null; reviewedAt: string | null;
  completionVerified: boolean; verificationNote: string | null;
}
const select = `SELECT cv.id, rv.requirement_id, cv.requirement_version_id, r.code,
  COALESCE(cv.title, r.title) AS title, COALESCE(cv.content_id, cv.deephow_content_id, cv.id::text) AS content_id,
  COALESCE(cv.content_version, cv.deephow_version, rv.version) AS content_version,
  cv.language_code, cv.practice_only, cv.package_sha256, cv.export_format,
  cv.moodle_course_id, cv.moodle_activity_id, cv.moodle_scorm_id, cv.moodle_quiz_id,
  cv.review_status, rv.review_status AS requirement_review_status,
  cv.reviewed_by, cv.reviewed_at, cv.completion_criteria_verified, cv.completion_verification_note
  FROM course_versions cv
  JOIN requirement_versions rv ON rv.tenant_id = cv.tenant_id AND rv.id = cv.requirement_version_id
  JOIN requirements r ON r.tenant_id = rv.tenant_id AND r.id = rv.requirement_id`;

export async function listCourses(actor: Actor): Promise<CourseItem[]> {
  requireRole(actor, ['tenant_admin','site_admin','hse_reviewer','auditor']);
  return (await query<CourseRow>(`${select} WHERE cv.tenant_id = $1 ORDER BY r.title, cv.created_at DESC`, [actor.tenantId]))
    .map((row) => ({ id: row.id, requirementId: row.requirement_id, requirementVersionId: row.requirement_version_id,
      code: row.code, title: row.title, sourceContentId: row.content_id, version: row.content_version,
      language: row.language_code, practiceOnly: row.practice_only, packageSha256: row.package_sha256,
      exportFormat: row.export_format, moodleCourseId: row.moodle_course_id ? Number(row.moodle_course_id) : null,
      moodleActivityId: row.moodle_activity_id ? Number(row.moodle_activity_id) : null,
      moodleScormId: row.moodle_scorm_id ? Number(row.moodle_scorm_id) : null,
      moodleQuizId: row.moodle_quiz_id ? Number(row.moodle_quiz_id) : null,
      launchUrl: row.moodle_course_id ? moodleCourseUrl(actor.tenantId, Number(row.moodle_course_id)) : null,
      reviewStatus: row.review_status, requirementReviewStatus: row.requirement_review_status,
      reviewedBy: row.reviewed_by, reviewedAt: row.reviewed_at?.toISOString() ?? null,
      completionVerified: row.completion_criteria_verified, verificationNote: row.completion_verification_note }));
}

export async function createCourse(actor: Actor, input: unknown): Promise<string> {
  requireRole(actor, ['tenant_admin','hse_reviewer']);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  return transaction(async (client) => {
    let requirementVersionId: string;
    if (value.requirementId) {
      const found = await client.query<{ active_version_id: string | null; authority: string; legal_status: string }>(
        `SELECT r.active_version_id, rv.authority, rv.legal_status FROM requirements r
         JOIN requirement_versions rv ON rv.tenant_id = r.tenant_id AND rv.id = r.active_version_id
         WHERE r.tenant_id = $1 AND r.id = $2`, [actor.tenantId, value.requirementId]);
      if (!found.rows[0]?.active_version_id) throw error(404, 'Requirement not found');
      if (value.practiceOnly && (found.rows[0].legal_status !== 'general_awareness' ||
        found.rows[0].authority !== 'Practice workflow only; no safety or workplace authorization claim')) {
        throw error(400, 'Practice courses need their own practice requirement');
      }
      requirementVersionId = found.rows[0].active_version_id;
    } else {
      const requirement = await client.query<{ id: string }>(`INSERT INTO requirements (tenant_id, code, title)
        VALUES ($1,$2,$3) ON CONFLICT (tenant_id, code) DO NOTHING RETURNING id`, [actor.tenantId, value.code, value.title]);
      if (!requirement.rowCount) throw error(409, 'That program code exists. Choose its requirement to add a course version.');
      const definition = { code: value.code, title: value.title, authority: value.authority, audience: value.audience,
        practiceOnly: value.practiceOnly, version: value.version };
      const digest = createHash('sha256').update(JSON.stringify(definition)).digest('hex');
      const version = await client.query<{ id: string }>(`INSERT INTO requirement_versions
        (tenant_id, requirement_id, version, legal_status, authority, audience, site_overlay_requirement,
         content_digest, authorization_prerequisites, review_status, reviewed_by, reviewed_at)
        VALUES ($1,$2,$3,'general_awareness',$4,$5,'None for this knowledge course',$6,'["knowledge"]',
          $7,$8,$9) RETURNING id`, [actor.tenantId, requirement.rows[0].id, value.version,
        value.practiceOnly ? 'Practice workflow only; no safety or workplace authorization claim' : value.authority,
        value.audience, digest, value.practiceOnly ? 'approved' : 'unapproved',
        value.practiceOnly ? actor.displayName : null, value.practiceOnly ? new Date() : null]);
      requirementVersionId = version.rows[0].id;
      await client.query('UPDATE requirements SET active_version_id = $3 WHERE tenant_id = $1 AND id = $2',
        [actor.tenantId, requirement.rows[0].id, requirementVersionId]);
    }
    // A stable source ID plus version cannot silently acquire another package.
    const duplicate = await client.query('SELECT id FROM course_versions WHERE tenant_id = $1 AND content_source = $2 AND content_id = $3 AND content_version = $4',
      [actor.tenantId, 'in_house', value.sourceContentId, value.version]);
    if (duplicate.rowCount) throw error(409, 'This content version already exists. Create a new version.');
    // Keep this check and the mapping insert in one serialized decision. A
    // legacy tenant may already have duplicate Moodle IDs, so migration cannot
    // safely impose a global unique constraint without an explicit review.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [`${actor.tenantId}:moodle-course:${value.moodleCourseId}`]);
    const reused = await client.query('SELECT id FROM course_versions WHERE tenant_id = $1 AND moodle_course_id = $2',
      [actor.tenantId, value.moodleCourseId]);
    if (reused.rowCount) throw error(409, 'Create a separate Moodle course for this version so older assignments retain their exact content.');
    const result = await client.query<{ id: string }>(`INSERT INTO course_versions
      (tenant_id, requirement_version_id, content_source, content_id, content_version, title, language_code,
       practice_only, package_sha256, export_format, moodle_course_id, moodle_activity_id, moodle_scorm_id, moodle_quiz_id)
      VALUES ($1,$2,'in_house',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [actor.tenantId, requirementVersionId, value.sourceContentId, value.version, value.title, value.language,
      value.practiceOnly, value.packageSha256, value.exportFormat, value.moodleCourseId,
      value.moodleActivityId ?? null, value.moodleScormId ?? null, value.moodleQuizId ?? null]);
    const id = result.rows[0].id;
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'course.create','course_version',$3,$4::jsonb)`, [actor.tenantId, actor.id, id, JSON.stringify(value)]);
    return id;
  });
}

export async function changeCourse(actor: Actor, courseId: string, input: unknown): Promise<void> {
  requireRole(actor, ['tenant_admin','hse_reviewer']);
  if (!z.uuid().safeParse(courseId).success) throw error(400, 'Invalid course ID');
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  // Network reads precede the transaction; course mapping content is immutable.
  const rows = await query<CourseRow>(`${select} WHERE cv.tenant_id = $1 AND cv.id = $2`, [actor.tenantId, courseId]);
  const course = rows[0];
  if (!course) throw error(404, 'Course not found');
  if ((value.action === 'approve' || value.action === 'approve-requirement') && !course.practice_only && actor.role !== 'hse_reviewer') {
    throw error(403, 'A named HSE reviewer must approve safety content and its requirement');
  }
  let verificationNote: string | null = null;
  if (value.action === 'verify') {
    if (course.review_status !== 'unapproved') throw error(409, 'Create a new version to change reviewed verification');
    if (!course.moodle_course_id) throw error(409, 'A Moodle course mapping is required');
    if (moodleConnection(actor.tenantId)?.completionEvidence !== 'local_hse_evidence') {
      throw error(409, 'Configure the read-only Moodle completion evidence service before verifying this course');
    }
    const observed = await inspectMoodleCourse(actor.tenantId, Number(course.moodle_course_id));
    if (!observed.visible) throw error(409, 'Publish the course in Moodle before verifying its HSE mapping');
    if (!observed.completionEnabled) throw error(409, 'Enable Moodle course completion before verifying its HSE mapping');
    if (course.moodle_quiz_id) {
      if (!course.moodle_activity_id || course.moodle_scorm_id) throw error(409, 'The Moodle quiz assessment mapping is incomplete or ambiguous');
      await inspectMoodleQuiz(actor.tenantId, Number(course.moodle_course_id),
        Number(course.moodle_quiz_id), Number(course.moodle_activity_id));
    }
    verificationNote = `${value.note}\nMoodle course ${observed.id} (${observed.title}) inspected with completion enabled on ${new Date().toISOString()} by ${actor.displayName}.`;
    if (course.moodle_quiz_id) verificationNote += `\nNative Moodle quiz ${course.moodle_quiz_id} and activity module ${course.moodle_activity_id} confirmed in this course.`;
  }
  await transaction(async (client) => {
    const locked = await client.query<CourseRow>(`${select} WHERE cv.tenant_id = $1 AND cv.id = $2 FOR UPDATE OF cv, rv`, [actor.tenantId, courseId]);
    const current = locked.rows[0];
    if (!current) throw error(404, 'Course not found');
    if (value.action === 'approve-requirement') {
      if (current.requirement_review_status !== 'unapproved') throw error(409, 'Requirement has already been reviewed');
      await client.query(`UPDATE requirement_versions SET review_status = 'approved', reviewed_by = $3, reviewed_at = now(), effective_at = now()
        WHERE tenant_id = $1 AND id = $2`, [actor.tenantId, current.requirement_version_id, actor.displayName]);
    } else if (value.action === 'retire') {
      if (current.review_status !== 'approved') throw error(409, 'Only a published version can be retired');
      await client.query(`UPDATE course_versions SET review_status = 'retired', retired_at = now() WHERE tenant_id = $1 AND id = $2`, [actor.tenantId, courseId]);
    } else {
      if (current.review_status !== 'unapproved') throw error(409, 'This course version has already been reviewed');
      if (value.action === 'verify') {
        await client.query(`UPDATE course_versions SET completion_criteria_verified = true, completion_verification_note = $3
          WHERE tenant_id = $1 AND id = $2`, [actor.tenantId, courseId, verificationNote]);
      } else {
        if (current.requirement_review_status !== 'approved' || !current.completion_criteria_verified) {
          throw error(409, 'Approve the requirement and verify Moodle completion behavior before publishing');
        }
        await client.query(`UPDATE course_versions SET review_status = 'approved', reviewed_by = $3, reviewed_at = now(), effective_at = now()
          WHERE tenant_id = $1 AND id = $2`, [actor.tenantId, courseId, actor.displayName]);
      }
    }
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, before_value, after_value)
      VALUES ($1,$2,$3,'course_version',$4,$5::jsonb,$6::jsonb)`,
    [actor.tenantId, actor.id, `course.${value.action}`, courseId, JSON.stringify(current), JSON.stringify({ ...value, verificationNote })]);
  });
}
