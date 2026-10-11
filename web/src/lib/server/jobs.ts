import { database, query, transaction } from './db';
import { addUserToCohort, enrollUser, findMoodleUserByHseId, isUserEnrolled, moodleConnection, provisionMoodleUser, readCompletion } from './moodle';

interface Job { id: string; tenant_id: string; kind: 'moodle_enrol' | 'moodle_reconcile'; aggregate_id: string; attempt_count: number }

export async function enqueueReconciliation(): Promise<number> {
  const rows = await query<{ id: string }>(`INSERT INTO integration_outbox (tenant_id, kind, aggregate_id)
    SELECT a.tenant_id, 'moodle_reconcile', a.id FROM assignments a
    JOIN tenants t ON t.id = a.tenant_id WHERE a.cancelled_at IS NULL AND NOT t.synthetic
    ON CONFLICT (tenant_id, kind, aggregate_id) DO UPDATE
      SET state = 'pending', next_attempt_at = now(), completed_at = NULL
    RETURNING id`);
  return rows.length;
}

async function takeJob(tenantId?: string): Promise<Job | null> {
  return transaction(async (client) => {
    await client.query(`UPDATE integration_outbox SET state = 'failed', next_attempt_at = now()
      WHERE state = 'running' AND next_attempt_at < now() - interval '15 minutes'`);
    const result = await client.query<Job>(`SELECT id, tenant_id, kind, aggregate_id, attempt_count
      FROM integration_outbox WHERE state IN ('pending','failed') AND next_attempt_at <= now()
        AND ($1::uuid IS NULL OR tenant_id = $1)
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [tenantId ?? null]);
    const job = result.rows[0];
    if (job) await client.query(`UPDATE integration_outbox SET state = 'running',
      attempt_count = attempt_count + 1, next_attempt_at = now() WHERE id = $1`, [job.id]);
    return job ?? null;
  });
}

async function assignmentForJob(job: Job, instanceKey: string) {
  const rows = await query<{ id: string; tenant_id: string; hse_id: string; moodle_user_ids: string[];
    moodle_course_id: string | null; moodle_scorm_id: string | null; moodle_activity_id: string | null;
    course_version_id: string | null;
    display_name: string; email: string | null; synthetic: boolean; person_synthetic: boolean; assigned_at: Date;
    course_review_status: string | null; completion_criteria_verified: boolean | null;
    site_id: string; moodle_cohort_id: string | null }>(`SELECT a.id, a.tenant_id, p.hse_id,
      p.display_name, p.email, p.synthetic AS person_synthetic,
      ARRAY(SELECT external_id FROM person_external_ids x WHERE x.tenant_id = p.tenant_id
        AND x.person_id = p.id AND x.source = 'moodle' AND x.instance_key = $3
        AND x.superseded_at IS NULL ORDER BY x.created_at) AS moodle_user_ids,
      cv.moodle_course_id, cv.moodle_scorm_id, cv.moodle_activity_id, cv.id AS course_version_id,
      cv.review_status AS course_review_status, cv.completion_criteria_verified,
      a.site_id, smc.moodle_cohort_id, a.assigned_at, t.synthetic
      FROM assignments a JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
      JOIN tenants t ON t.id = a.tenant_id
      LEFT JOIN course_versions cv ON cv.tenant_id = a.tenant_id AND cv.id = a.course_version_id
      LEFT JOIN site_moodle_cohorts smc ON smc.tenant_id = a.tenant_id AND smc.site_id = a.site_id
        AND smc.instance_key = $3
      WHERE a.tenant_id = $1 AND a.id = $2 AND a.cancelled_at IS NULL`,
  [job.tenant_id, job.aggregate_id, instanceKey]);
  return rows[0] ?? null;
}

async function recordDrift(job: Job, kind: string, details: Record<string, unknown>) {
  await database().query(`INSERT INTO integration_drifts (tenant_id, assignment_id, kind, details)
    VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (tenant_id, assignment_id, kind) WHERE resolved_at IS NULL
    DO UPDATE SET details = EXCLUDED.details, detected_at = now()`,
  [job.tenant_id, job.aggregate_id, kind, JSON.stringify(details)]);
}

async function resolveDrifts(job: Job, kinds: string[]) {
  await database().query(`UPDATE integration_drifts SET resolved_at = now()
    WHERE tenant_id = $1 AND assignment_id = $2 AND kind = ANY($3::text[])
      AND resolved_at IS NULL`, [job.tenant_id, job.aggregate_id, kinds]);
}

async function perform(job: Job): Promise<void> {
  const connection = moodleConnection(job.tenant_id);
  if (!connection) throw new Error('Moodle connection is not configured');
  const assignment = await assignmentForJob(job, connection.instanceId);
  if (!assignment) return;
  if (assignment.synthetic || assignment.person_synthetic) {
    throw new Error('Synthetic data must not be sent to Moodle');
  }
  if (!assignment.course_version_id || !assignment.moodle_course_id
    || assignment.course_review_status !== 'approved') throw new Error('Approved Moodle course mapping is missing');
  const courseId = Number(assignment.moodle_course_id);
  if (assignment.moodle_user_ids.length > 1) throw new Error('Ambiguous active Moodle user mapping for this instance');
  let userId = assignment.moodle_user_ids[0] ? Number(assignment.moodle_user_ids[0]) : null;
  if (!userId) {
    userId = await findMoodleUserByHseId(job.tenant_id, assignment.hse_id);
    if (!userId && connection.authMethod && assignment.email) {
      const names = assignment.display_name.trim().split(/\s+/);
      userId = await provisionMoodleUser(job.tenant_id, {
        hseId: assignment.hse_id, username: `hse_${assignment.hse_id.replaceAll('-', '')}`,
        firstName: names[0] ?? 'Worker', lastName: names.slice(1).join(' ') || 'Worker',
        email: assignment.email
      }, connection.authMethod);
    }
    if (!userId) throw new Error('Moodle user is not mapped; a verified external authMethod and worker email are required for provisioning');
    await database().query(`INSERT INTO person_external_ids
      (tenant_id, person_id, source, external_id, instance_key)
      SELECT a.tenant_id, a.person_id, 'moodle', $3, $4 FROM assignments a
      WHERE a.tenant_id = $1 AND a.id = $2 ON CONFLICT DO NOTHING`,
    [job.tenant_id, job.aggregate_id, String(userId), connection.instanceId]);
  }
  if (job.kind === 'moodle_enrol') {
    if (!assignment.moodle_cohort_id) throw new Error('Site has no Moodle cohort mapping for this instance');
    if (!connection.learnerRoleId) throw new Error('Moodle learnerRoleId is not configured');
    await addUserToCohort(job.tenant_id, Number(assignment.moodle_cohort_id), userId);
    await enrollUser(job.tenant_id, courseId, userId, connection.learnerRoleId);
    await database().query(`INSERT INTO moodle_enrollments
      (tenant_id, assignment_id, moodle_user_id, moodle_course_id, enrolled_at, last_verified_at)
      VALUES ($1,$2,$3,$4,now(),now()) ON CONFLICT (tenant_id, assignment_id)
      DO UPDATE SET last_verified_at = now()`, [job.tenant_id, job.aggregate_id, userId, courseId]);
    await resolveDrifts(job, ['moodle_enrollment_missing']);
    return;
  }
  const enrolled = await isUserEnrolled(job.tenant_id, courseId, userId);
  if (!enrolled) { await recordDrift(job, 'moodle_enrollment_missing', { userId, courseId }); return; }
  await resolveDrifts(job, ['moodle_enrollment_missing']);
  await database().query(`UPDATE moodle_enrollments SET last_verified_at = now()
    WHERE tenant_id = $1 AND assignment_id = $2`, [job.tenant_id, job.aggregate_id]);
  if (!assignment.completion_criteria_verified) {
    await recordDrift(job, 'completion_criteria_unverified', { courseId,
      reason: 'Pinned course completion and SCORM success criteria require Gate B verification' });
    return;
  }
  await resolveDrifts(job, ['completion_criteria_unverified']);
  const completion = await readCompletion(job.tenant_id, courseId, userId,
    assignment.moodle_scorm_id ? Number(assignment.moodle_scorm_id) : null,
    assignment.moodle_activity_id ? Number(assignment.moodle_activity_id) : null);
  const previous = await query<{ moodle_timecompleted: Date; course_version_id: string;
    moodle_course_id: string; moodle_user_id: string }>(`SELECT moodle_timecompleted,
      course_version_id, moodle_course_id, moodle_user_id FROM knowledge_evidence
    WHERE tenant_id = $1 AND assignment_id = $2 ORDER BY observed_at DESC LIMIT 1`, [job.tenant_id, job.aggregate_id]);
  if (previous.length && (previous[0].course_version_id !== assignment.course_version_id
    || Number(previous[0].moodle_course_id) !== courseId || Number(previous[0].moodle_user_id) !== userId)) {
    await recordDrift(job, 'completion_wrong_mapping', { userId, courseId,
      pinnedCourseVersionId: assignment.course_version_id,
      priorCourseVersionId: previous[0].course_version_id,
      priorCourseId: previous[0].moodle_course_id,
      priorUserId: previous[0].moodle_user_id });
    return;
  }
  await resolveDrifts(job, ['completion_wrong_mapping']);
  if (!completion.completed) {
    await resolveDrifts(job, ['completion_timestamp_unverified', 'completion_time_missing',
      'completion_changed', 'completion_before_assignment']);
    if (previous.length) await recordDrift(job, 'completion_missing', {
      prior: previous[0].moodle_timecompleted.toISOString(), userId, courseId
    });
    return;
  }
  if (!completion.completedAt) {
    await resolveDrifts(job, ['completion_missing', 'completion_time_missing', 'completion_changed']);
    await recordDrift(job, 'completion_timestamp_unverified', { userId, courseId,
      reason: 'Moodle course-completion response has no canonical course completion timestamp' });
    return;
  }
  if (completion.completedAt < assignment.assigned_at) {
    await recordDrift(job, 'completion_before_assignment', { userId, courseId,
      assignedAt: assignment.assigned_at.toISOString(),
      moodleTimecompleted: completion.completedAt.toISOString() });
    return;
  }
  await resolveDrifts(job, ['completion_before_assignment']);
  if (previous.length && previous[0].moodle_timecompleted.getTime() !== completion.completedAt.getTime()) {
    await resolveDrifts(job, ['completion_missing', 'completion_timestamp_unverified', 'completion_time_missing']);
    await recordDrift(job, 'completion_changed', { prior: previous[0].moodle_timecompleted.toISOString(),
      current: completion.completedAt.toISOString(), userId, courseId });
    return;
  }
  await resolveDrifts(job, ['completion_missing', 'completion_timestamp_unverified',
    'completion_time_missing', 'completion_changed', 'completion_before_assignment']);
  await database().query(`INSERT INTO knowledge_evidence
    (tenant_id, assignment_id, course_version_id, moodle_course_id, moodle_user_id,
     moodle_timecompleted, score, attempts, delivery_method, source_payload)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'moodle',$9::jsonb)
    ON CONFLICT (tenant_id, assignment_id, moodle_timecompleted) DO NOTHING`,
    [job.tenant_id, job.aggregate_id, assignment.course_version_id, courseId, userId,
      completion.completedAt, completion.score, completion.attempts, JSON.stringify(completion.raw)]);
}

export async function runJobs(limit = 100, tenantId?: string): Promise<{ done: number; failed: number }> {
  let done = 0; let failed = 0;
  for (let i = 0; i < limit; i++) {
    const job = await takeJob(tenantId);
    if (!job) break;
    try {
      await perform(job);
      await database().query(`UPDATE integration_outbox SET state = 'done', completed_at = now(), last_error = NULL
        WHERE id = $1`, [job.id]);
      done++;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const delay = Math.min(3600, 2 ** Math.min(job.attempt_count + 1, 12) * 10);
      await database().query(`UPDATE integration_outbox SET state = 'failed', last_error = $2,
        next_attempt_at = now() + ($3 * interval '1 second') WHERE id = $1`, [job.id, message.slice(0, 1000), delay]);
      failed++;
    }
  }
  return { done, failed };
}
