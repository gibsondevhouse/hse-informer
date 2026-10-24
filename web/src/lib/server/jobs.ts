import { database, query, transaction } from './db';
import type { PoolClient } from 'pg';
import { addUserToCohort, enrollUser, findMoodleUserByHseId, isUserEnrolled, linkMoodleUser, moodleConnection, provisionMoodleUser, readCompletion, readMoodleLearningProgress, suspendMoodleUser, suppressMoodleEmail } from './moodle';

interface Job { id: string; tenant_id: string; kind: 'moodle_enrol' | 'moodle_reconcile' | 'moodle_user_state'; aggregate_id: string; attempt_count: number }
type JobClient = Pick<PoolClient, 'query'>;

export async function enqueueReconciliation(tenantId?: string): Promise<number> {
  // A job skipped while an account was awaiting activation must not strand its assignment.
  // Repair only completed/missing enrollment jobs; preserve retry backoff and running leases.
  await query(`INSERT INTO integration_outbox (tenant_id,kind,aggregate_id)
    SELECT a.tenant_id,'moodle_enrol',a.id FROM assignments a
    JOIN tenants t ON t.id=a.tenant_id JOIN people p ON p.tenant_id=a.tenant_id AND p.id=a.person_id
    WHERE a.cancelled_at IS NULL AND NOT t.synthetic AND p.active AND NOT p.account_access_locked
      AND ($1::uuid IS NULL OR a.tenant_id=$1)
      AND NOT EXISTS(SELECT 1 FROM moodle_enrollments me WHERE me.tenant_id=a.tenant_id AND me.assignment_id=a.id)
    ON CONFLICT(tenant_id,kind,aggregate_id) DO UPDATE SET state='pending',next_attempt_at=now(),completed_at=NULL
      WHERE integration_outbox.state='done'`, [tenantId ?? null]);
  const rows = await query<{ id: string }>(`INSERT INTO integration_outbox (tenant_id, kind, aggregate_id)
    SELECT a.tenant_id, 'moodle_reconcile', a.id FROM assignments a
    JOIN tenants t ON t.id = a.tenant_id JOIN people p ON p.tenant_id=a.tenant_id AND p.id=a.person_id
    WHERE a.cancelled_at IS NULL AND NOT t.synthetic AND p.active AND NOT p.account_access_locked
      AND ($1::uuid IS NULL OR a.tenant_id=$1)
    ON CONFLICT (tenant_id, kind, aggregate_id) DO UPDATE
      SET state = 'pending', next_attempt_at = now(), completed_at = NULL
    RETURNING id`, [tenantId ?? null]);
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

async function assignmentForJob(job: Job, instanceKey: string, client: JobClient) {
  const result = await client.query<{ id: string; tenant_id: string; person_id: string; hse_id: string; moodle_user_ids: string[];
    moodle_course_id: string | null; moodle_scorm_id: string | null; moodle_activity_id: string | null; moodle_quiz_id: string | null;
    course_version_id: string | null;
    display_name: string; email: string | null; identity_email: string; identity_email_technical: boolean; synthetic: boolean; person_synthetic: boolean; assigned_at: Date;
    course_review_status: string | null; completion_criteria_verified: boolean | null;
    site_id: string; moodle_cohort_id: string | null }>(`SELECT a.id, a.tenant_id, a.person_id, p.hse_id,
      p.display_name, p.email, p.identity_email, p.identity_email_technical, p.synthetic AS person_synthetic,
      ARRAY(SELECT external_id FROM person_external_ids x WHERE x.tenant_id = p.tenant_id
        AND x.person_id = p.id AND x.source = 'moodle' AND x.instance_key = $3
        AND x.superseded_at IS NULL ORDER BY x.created_at) AS moodle_user_ids,
      cv.moodle_course_id, cv.moodle_scorm_id, cv.moodle_activity_id, cv.moodle_quiz_id, cv.id AS course_version_id,
      cv.review_status AS course_review_status, cv.completion_criteria_verified,
      a.site_id, smc.moodle_cohort_id, a.assigned_at, t.synthetic
      FROM assignments a JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
      JOIN tenants t ON t.id = a.tenant_id
      LEFT JOIN course_versions cv ON cv.tenant_id = a.tenant_id AND cv.id = a.course_version_id
      LEFT JOIN site_moodle_cohorts smc ON smc.tenant_id = a.tenant_id AND smc.site_id = a.site_id
        AND smc.instance_key = $3
      WHERE a.tenant_id = $1 AND a.id = $2 AND a.cancelled_at IS NULL AND p.active AND NOT p.account_access_locked`,
  [job.tenant_id, job.aggregate_id, instanceKey]);
  return result.rows[0] ?? null;
}

async function recordDrift(job: Job, kind: string, details: Record<string, unknown>) {
  await database().query(`INSERT INTO integration_drifts (tenant_id, assignment_id, kind, details)
    VALUES ($1,$2,$3,$4::jsonb)
    ON CONFLICT (tenant_id, assignment_id, kind) WHERE resolved_at IS NULL
    DO UPDATE SET details = EXCLUDED.details, detected_at = now()`,
  [job.tenant_id, job.aggregate_id, kind, JSON.stringify(details)]);
}

async function resolveDrifts(job: Job, kinds: string[], client: JobClient = database()) {
  await client.query(`UPDATE integration_drifts SET resolved_at = now()
    WHERE tenant_id = $1 AND assignment_id = $2 AND kind = ANY($3::text[])
      AND resolved_at IS NULL`, [job.tenant_id, job.aggregate_id, kinds]);
}

async function syncMoodleUserState(job: Job): Promise<void> {
  const connection = moodleConnection(job.tenant_id);
  if (!connection) throw new Error('Moodle connection is not configured');
  await transaction(async (client) => {
    const result = await client.query<{ active: boolean; synthetic: boolean; tenant_synthetic: boolean; hse_id: string }>(
      `SELECT (p.active AND NOT p.account_access_locked) AS active,p.synthetic,t.synthetic AS tenant_synthetic,p.hse_id FROM people p
       JOIN tenants t ON t.id=p.tenant_id WHERE p.tenant_id=$1 AND p.id=$2 FOR UPDATE OF p`,
      [job.tenant_id, job.aggregate_id]);
    const person = result.rows[0];
    if (!person) throw new Error('Person not found');
    if (person.synthetic || person.tenant_synthetic) throw new Error('Synthetic data must not be sent to Moodle');
    const mappings = await client.query<{ external_id: string }>(`SELECT external_id FROM person_external_ids
      WHERE tenant_id=$1 AND person_id=$2 AND source='moodle' AND instance_key=$3 AND superseded_at IS NULL`,
      [job.tenant_id, job.aggregate_id, connection.instanceId]);
    if (mappings.rows.length > 1) throw new Error('Ambiguous Moodle account mapping');
    const userId = mappings.rows[0] ? Number(mappings.rows[0].external_id) : await findMoodleUserByHseId(job.tenant_id, person.hse_id);
    if (userId === null && !person.active) {
      // An HTTP timeout does not prove Moodle rolled back a remote create. Keep
      // checking current state until a potentially late account can be suspended.
      // Include cancelled assignments: cancellation cannot cancel an in-flight
      // remote write that an earlier enrollment attempt may have started.
      const attempted = await client.query(`SELECT 1 FROM integration_outbox o
        JOIN assignments a ON a.tenant_id=o.tenant_id AND a.id=o.aggregate_id
        WHERE o.tenant_id=$1 AND a.person_id=$2 AND o.kind='moodle_enrol' AND o.attempt_count>0 LIMIT 1`,
      [job.tenant_id, job.aggregate_id]);
      if (attempted.rowCount) {
        throw new Error('Moodle suspension is awaiting absence or provisioning confirmation after an enrollment attempt');
      }
    }
    if (userId !== null) await suspendMoodleUser(job.tenant_id, userId, !person.active);
    await client.query(`INSERT INTO audit_log (tenant_id,action,entity_type,entity_id,after_value)
      VALUES ($1,'person.moodle_state_synced','person',$2,$3::jsonb)`,
      [job.tenant_id, job.aggregate_id, JSON.stringify({ suspended: !person.active, mappedAccountFound: userId !== null })]);
  });
}

async function perform(job: Job, client: JobClient = database()): Promise<void> {
  if (job.kind === 'moodle_user_state') return syncMoodleUserState(job);
  const connection = moodleConnection(job.tenant_id);
  if (!connection) throw new Error('Moodle connection is not configured');
  const assignment = await assignmentForJob(job, connection.instanceId, client);
  if (!assignment) return;
  if (assignment.synthetic || assignment.person_synthetic) {
    throw new Error('Synthetic data must not be sent to Moodle');
  }
  if (!assignment.course_version_id || !assignment.moodle_course_id
    || !['approved', 'retired'].includes(assignment.course_review_status ?? '')) throw new Error('Approved Moodle course mapping is missing');
  const courseId = Number(assignment.moodle_course_id);
  // Resolve the source identity before any user provisioning. Assignment order is
  // independent of account invitation; a missing account remains a retryable job.
  let oauthIdentity: { subject: string; issuer: string } | null = null;
  if (job.kind === 'moodle_enrol' && connection.authMethod === 'oauth2') {
    if (!connection.oauthIssuerId || typeof connection.oauthBridgeToken !== 'string' || !connection.oauthBridgeToken) {
      throw new Error('The Moodle OAuth identity bridge is not configured');
    }
    const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
    if (!issuer) throw new Error('The expected portal OIDC issuer is not configured');
    const principals = await client.query<{ oidc_subject: string; oidc_issuer: string }>(`SELECT pr.oidc_subject,pr.oidc_issuer
      FROM principals pr JOIN people p ON p.tenant_id=pr.tenant_id AND p.id=pr.person_id
      WHERE pr.tenant_id=$1 AND pr.person_id=$2 AND pr.oidc_issuer=$3
        AND pr.active AND p.active AND NOT p.account_access_locked FOR SHARE OF pr`,
    [job.tenant_id, assignment.person_id, issuer]);
    if (principals.rows.length !== 1) throw new Error('Moodle enrollment awaits one active portal account for this person and issuer');
    oauthIdentity = { subject: principals.rows[0].oidc_subject, issuer: principals.rows[0].oidc_issuer };
  }
  if (assignment.moodle_user_ids.length > 1) throw new Error('Ambiguous active Moodle user mapping for this instance');
  let userId = assignment.moodle_user_ids[0] ? Number(assignment.moodle_user_ids[0]) : null;
  if (!userId) {
    userId = await findMoodleUserByHseId(job.tenant_id, assignment.hse_id);
    if (!userId && job.kind === 'moodle_enrol' && connection.authMethod && assignment.identity_email) {
      const names = assignment.display_name.trim().split(/\s+/);
      userId = await provisionMoodleUser(job.tenant_id, {
        hseId: assignment.hse_id, username: `hse_${assignment.hse_id.replaceAll('-', '')}`,
        firstName: names[0] ?? 'Worker', lastName: names.slice(1).join(' ') || 'Worker',
        email: assignment.identity_email, suppressEmail: assignment.identity_email_technical
      }, connection.authMethod);
    }
    if (!userId) throw new Error('Moodle user is not mapped; a verified external authMethod and matching sign-in identifier are required for provisioning');
    await client.query(`INSERT INTO person_external_ids
      (tenant_id, person_id, source, external_id, instance_key)
      SELECT a.tenant_id, a.person_id, 'moodle', $3, $4 FROM assignments a
      WHERE a.tenant_id = $1 AND a.id = $2 ON CONFLICT DO NOTHING`,
    [job.tenant_id, job.aggregate_id, String(userId), connection.instanceId]);
  }
  if (assignment.identity_email_technical) await suppressMoodleEmail(job.tenant_id, userId);
  if (oauthIdentity) await linkMoodleUser(job.tenant_id, {
    userId, hseId: assignment.hse_id, identityEmail: assignment.identity_email, ...oauthIdentity
  });
  if (job.kind === 'moodle_enrol') {
    if (!assignment.moodle_cohort_id) throw new Error('Site has no Moodle cohort mapping for this instance');
    if (!connection.learnerRoleId) throw new Error('Moodle learnerRoleId is not configured');
    await addUserToCohort(job.tenant_id, Number(assignment.moodle_cohort_id), userId);
    await enrollUser(job.tenant_id, courseId, userId, connection.learnerRoleId);
    await client.query(`INSERT INTO moodle_enrollments
      (tenant_id, assignment_id, moodle_user_id, moodle_course_id, enrolled_at, last_verified_at)
      VALUES ($1,$2,$3,$4,now(),now()) ON CONFLICT (tenant_id, assignment_id)
      DO UPDATE SET last_verified_at = now()`, [job.tenant_id, job.aggregate_id, userId, courseId]);
    await resolveDrifts(job, ['moodle_enrollment_missing'], client);
    return;
  }
  const enrolled = await isUserEnrolled(job.tenant_id, courseId, userId);
  if (!enrolled) { await recordDrift(job, 'moodle_enrollment_missing', { userId, courseId }); return; }
  await resolveDrifts(job, ['moodle_enrollment_missing']);
  await database().query(`UPDATE moodle_enrollments SET last_verified_at = now()
    WHERE tenant_id = $1 AND assignment_id = $2`, [job.tenant_id, job.aggregate_id]);
  if (!assignment.completion_criteria_verified) {
    await recordDrift(job, 'completion_criteria_unverified', { courseId,
      reason: 'Pinned course completion and assessment success criteria require Gate B verification' });
    return;
  }
  await resolveDrifts(job, ['completion_criteria_unverified']);
  const progressReadStartedAt = new Date();
  const completion = await readCompletion(job.tenant_id, courseId, userId,
    assignment.moodle_scorm_id ? Number(assignment.moodle_scorm_id) : null,
    assignment.moodle_activity_id ? Number(assignment.moodle_activity_id) : null,
    assignment.moodle_quiz_id ? Number(assignment.moodle_quiz_id) : null);
  const previous = await query<{ moodle_timecompleted: Date; course_version_id: string;
    moodle_course_id: string; moodle_user_id: string }>(`SELECT moodle_timecompleted,
      course_version_id, moodle_course_id, moodle_user_id FROM knowledge_evidence
    WHERE tenant_id = $1 AND assignment_id = $2 AND delivery_source = 'moodle' ORDER BY observed_at DESC LIMIT 1`, [job.tenant_id, job.aggregate_id]);
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
    const progress = await readMoodleLearningProgress(job.tenant_id, courseId, userId, completion, progressReadStartedAt);
    await database().query(`INSERT INTO moodle_learning_progress
      (tenant_id,assignment_id,course_version_id,instance_key,moodle_course_id,moodle_user_id,
       started,course_last_access_at,activities_with_progress,tracked_activities,started_attempts,
       read_started_at,observed_at,source_observation)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
      ON CONFLICT(tenant_id,assignment_id) DO UPDATE SET
        course_version_id=EXCLUDED.course_version_id,instance_key=EXCLUDED.instance_key,
        moodle_course_id=EXCLUDED.moodle_course_id,moodle_user_id=EXCLUDED.moodle_user_id,
        started=EXCLUDED.started,course_last_access_at=EXCLUDED.course_last_access_at,
        activities_with_progress=EXCLUDED.activities_with_progress,tracked_activities=EXCLUDED.tracked_activities,
        started_attempts=EXCLUDED.started_attempts,read_started_at=EXCLUDED.read_started_at,
        observed_at=EXCLUDED.observed_at,source_observation=EXCLUDED.source_observation
      WHERE moodle_learning_progress.read_started_at < EXCLUDED.read_started_at`,
    [job.tenant_id, job.aggregate_id, assignment.course_version_id, connection.instanceId, courseId, userId,
      progress.started, progress.courseLastAccessAt, progress.activitiesWithProgress, progress.trackedActivities,
      progress.startedAttempts, progress.readStartedAt, progress.observedAt, JSON.stringify(progress)]);
    return;
  }
  if (!completion.completedAt) {
    await resolveDrifts(job, ['completion_missing', 'completion_time_missing', 'completion_changed']);
    await recordDrift(job, 'completion_timestamp_unverified', { userId, courseId,
      reason: 'Moodle course-completion response has no canonical course completion timestamp',
      scormObservation: completion.scormObservation, quizObservation: completion.quizObservation });
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
      if (job.kind === 'moodle_enrol') {
        await transaction(async (client) => {
          await client.query("SET LOCAL lock_timeout='30s'");
          // Profile/account transitions and Moodle state sync lock this same
          // row. NO KEY UPDATE blocks state changes while allowing FK checks
          // from assignment writers, avoiding assignment/person lock inversion.
          // Hold it through remote effects and the local success commit.
          const person = await client.query<{ active: boolean; account_access_locked: boolean }>(
            `SELECT p.active,p.account_access_locked FROM assignments a
             JOIN people p ON p.tenant_id=a.tenant_id AND p.id=a.person_id
             WHERE a.tenant_id=$1 AND a.id=$2 AND a.cancelled_at IS NULL FOR NO KEY UPDATE OF p`,
            [job.tenant_id, job.aggregate_id]);
          if (person.rows[0] && (!person.rows[0].active || person.rows[0].account_access_locked)) {
            throw new Error('Moodle enrollment is blocked while the profile is inactive or awaiting account activation');
          }
          // Keep mapping, enrollment, and success writes on this client so they
          // commit atomically before releasing the shared person guard.
          await perform(job, client);
          await finishJob(job, client);
        });
      } else {
        await perform(job);
        await finishJob(job, database());
      }
      done++;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const delay = Math.min(3600, 2 ** Math.min(job.attempt_count + 1, 12) * 10);
      await database().query(`UPDATE integration_outbox SET state = 'failed', last_error = $2,
        next_attempt_at = now() + ($3 * interval '1 second') WHERE id = $1 AND state = 'running' AND attempt_count = $4`, [job.id, message.slice(0, 1000), delay, job.attempt_count + 1]);
      failed++;
    }
  }
  return { done, failed };
}

async function finishJob(job: Job, client: JobClient): Promise<void> {
  await client.query(`UPDATE integration_outbox SET state='done',completed_at=now(),last_error=NULL
    WHERE id=$1 AND state='running' AND attempt_count=$2`, [job.id,job.attempt_count+1]);
}
