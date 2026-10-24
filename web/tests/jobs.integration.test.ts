import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '../src/lib/server/db';
import { listAssignments } from '../src/lib/server/assignments';
import type { Actor } from '../src/lib/server/auth';
import { enqueueReconciliation, runJobs } from '../src/lib/server/jobs';

const mock = vi.hoisted(() => ({
  isUserEnrolled: vi.fn(), readCompletion: vi.fn(), suspendMoodleUser: vi.fn(), suppressMoodleEmail: vi.fn()
}));
vi.mock('../src/lib/server/moodle', () => ({
  moodleConnection: () => ({ instanceId: 'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8',
    baseUrl: 'https://moodle.example.test', token: 'synthetic-token', learnerRoleId: 5 }),
  isUserEnrolled: mock.isUserEnrolled,
  readCompletion: mock.readCompletion,
  suspendMoodleUser: mock.suspendMoodleUser,
  suppressMoodleEmail: mock.suppressMoodleEmail,
  findMoodleUserByHseId: vi.fn(), provisionMoodleUser: vi.fn(),
  addUserToCohort: vi.fn(), enrollUser: vi.fn(), moodleCourseUrl: vi.fn()
}));

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('Moodle reconciliation drift lifecycle', () => {
  const id = { tenant: randomUUID(), site: randomUUID(), person: randomUUID(), principal: randomUUID(),
    requirement: randomUUID(), version: randomUUID(), course: randomUUID(), assignment: randomUUID(),
    job: randomUUID() };
  const actor: Actor = { id: id.principal, tenantId: id.tenant, tenantName: 'Synthetic integration test',
    tenantSynthetic: false, personId: null, displayName: 'Synthetic test admin', role: 'tenant_admin', siteIds: [] };
  const completedAt = new Date('2026-10-10T00:00:00Z');

  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants (id, slug, name, synthetic)
      VALUES ($1,$2,'Synthetic integration test',false)`, [id.tenant, `jobs-${id.tenant}`]);
    await db.query(`INSERT INTO sites (id, tenant_id, code, name, state_code)
      VALUES ($1,$2,'test','Synthetic site','GA')`, [id.site, id.tenant]);
    // Disposable test-only data uses the live-path flags to exercise reconciliation;
    // Moodle calls are mocked and this database is never a production evidence store.
    await db.query(`INSERT INTO people (id, tenant_id, display_name, person_type, synthetic, email)
      VALUES ($1,$2,'Mock worker','employee',false,'worker@example.test')`, [id.person, id.tenant]);
    await db.query(`INSERT INTO principals (id, tenant_id, oidc_issuer, oidc_subject, role)
      VALUES ($1,$2,'synthetic-test',$3,'tenant_admin')`, [id.principal, id.tenant, id.principal]);
    await db.query(`INSERT INTO person_external_ids
      (tenant_id, person_id, source, external_id, instance_key)
      VALUES ($1,$2,'moodle','17','f5a21bbd-1582-45fa-8b7f-71d01d66a4f8')`, [id.tenant, id.person]);
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,'synthetic','Synthetic course')`, [id.requirement, id.tenant]);
    await db.query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version,
      legal_status, authority, audience, site_overlay_requirement, content_digest,
      authorization_prerequisites, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'test','general_awareness','Synthetic test only','Synthetic workers',
      'None',repeat('a',64),'["knowledge"]','approved','Synthetic test reviewer',now())`,
    [id.version, id.tenant, id.requirement]);
    await db.query(`INSERT INTO course_versions (id, tenant_id, requirement_version_id,
      deephow_content_id, deephow_version, package_sha256, export_format,
      moodle_course_id, review_status, reviewed_by, reviewed_at,
      completion_criteria_verified, completion_verification_note)
      VALUES ($1,$2,$3,'synthetic','test',repeat('b',64),'scorm_1_2',42,
      'approved','Synthetic test reviewer',now(),true,'Synthetic job algorithm test')`,
    [id.course, id.tenant, id.version]);
    await db.query(`INSERT INTO assignments (id, tenant_id, person_id, site_id, requirement_id,
      requirement_version_id, course_version_id, reason, trigger_kind,
      assigned_at, due_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Synthetic reconciliation test','manual',
      '2026-10-01T00:00:00Z','2027-01-01T00:00:00Z',$8)`,
    [id.assignment, id.tenant, id.person, id.site, id.requirement, id.version, id.course, id.principal]);
    await db.query(`INSERT INTO moodle_enrollments
      (tenant_id, assignment_id, moodle_user_id, moodle_course_id, enrolled_at)
      VALUES ($1,$2,17,42,'2026-10-01T00:00:00Z')`, [id.tenant, id.assignment]);
    await db.query(`INSERT INTO knowledge_evidence
      (tenant_id, assignment_id, course_version_id, moodle_course_id, moodle_user_id,
      moodle_timecompleted, delivery_method, source_payload)
      VALUES ($1,$2,$3,42,17,$4,'synthetic-verified-test','{}')`,
    [id.tenant, id.assignment, id.course, completedAt]);
    await db.query(`INSERT INTO integration_outbox (id, tenant_id, kind, aggregate_id)
      VALUES ($1,$2,'moodle_reconcile',$3)`, [id.job, id.tenant, id.assignment]);
  });

  async function queueAgain() {
    await database().query(`UPDATE integration_outbox
      SET state = 'pending', next_attempt_at = now(), completed_at = NULL WHERE id = $1`, [id.job]);
  }

  it('flags a missing enrollment and deleted completion, then resolves both after recovery', async () => {
    mock.isUserEnrolled.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    mock.readCompletion.mockResolvedValueOnce({ completed: false, completedAt: null,
      score: null, attempts: null, raw: { completionstatus: { completed: false } } })
      .mockResolvedValueOnce({ completed: true, completedAt,
        score: null, attempts: null, raw: { syntheticVerifiedCourseTime: true } })
      .mockResolvedValueOnce({ completed: true, completedAt: null,
        score: null, attempts: null,
        raw: { course: { completionstatus: { completed: true,
          completions: [{ timecompleted: 1781184000 }] } } } });

    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    let drifts = await database().query<{ kind: string; resolved_at: Date | null }>(
      `SELECT kind, resolved_at FROM integration_drifts WHERE tenant_id = $1`, [id.tenant]);
    expect(drifts.rows.some((row) => row.kind === 'moodle_enrollment_missing' && !row.resolved_at)).toBe(true);

    await queueAgain();
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    drifts = await database().query(`SELECT kind, resolved_at FROM integration_drifts WHERE tenant_id = $1`, [id.tenant]);
    expect(drifts.rows.some((row) => row.kind === 'moodle_enrollment_missing' && !!row.resolved_at)).toBe(true);
    expect(drifts.rows.some((row) => row.kind === 'completion_missing' && !row.resolved_at)).toBe(true);
    const duringDrift = await listAssignments(actor, new Date('2026-10-11T00:00:00Z'));
    expect(duringDrift.find((item) => item.id === id.assignment)).toMatchObject({
      state: 'needs_review', knowledgeComplete: false, completionDrift: true, authorized: false
    });

    await queueAgain();
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    drifts = await database().query(`SELECT kind, resolved_at FROM integration_drifts WHERE tenant_id = $1`, [id.tenant]);
    expect(drifts.rows.some((row) => row.kind === 'completion_missing' && !!row.resolved_at)).toBe(true);
    const recovered = await listAssignments(actor, new Date('2026-10-11T00:00:00Z'));
    expect(recovered.find((item) => item.id === id.assignment)).toMatchObject({
      state: 'knowledge_complete', knowledgeComplete: true, completionDrift: false
    });

    await queueAgain();
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    drifts = await database().query(`SELECT kind, resolved_at FROM integration_drifts WHERE tenant_id = $1`, [id.tenant]);
    expect(drifts.rows.some((row) => row.kind === 'completion_timestamp_unverified' && !row.resolved_at)).toBe(true);
    const noCanonicalTime = await listAssignments(actor, new Date('2026-10-11T00:00:00Z'));
    expect(noCanonicalTime.find((item) => item.id === id.assignment)).toMatchObject({
      state: 'needs_review', knowledgeComplete: false, completionDrift: true, authorized: false
    });
  });
  it('suspends and resumes the mapped Moodle account using current profile state', async () => {
    const db = database();
    await db.query('UPDATE people SET active=false WHERE id=$1', [id.person]);
    const stateJob = await db.query<{id:string}>(`INSERT INTO integration_outbox (tenant_id,kind,aggregate_id)
      VALUES ($1,'moodle_user_state',$2) RETURNING id`, [id.tenant, id.person]);
    mock.suspendMoodleUser.mockResolvedValue(undefined);
    expect(await runJobs(1, id.tenant)).toEqual({done:1,failed:0});
    expect(mock.suspendMoodleUser).toHaveBeenLastCalledWith(id.tenant,17,true);
    await db.query('UPDATE people SET active=true WHERE id=$1',[id.person]);
    await db.query(`UPDATE integration_outbox SET state='pending',next_attempt_at=now() WHERE id=$1`,[stateJob.rows[0].id]);
    expect(await runJobs(1,id.tenant)).toEqual({done:1,failed:0});
    expect(mock.suspendMoodleUser).toHaveBeenLastCalledWith(id.tenant,17,false);
  });

  it('preserves a requeued account state change while a worker finishes', async () => {
    const db=database();
    await db.query(`UPDATE integration_outbox SET state='pending',next_attempt_at=now()
      WHERE tenant_id=$1 AND kind='moodle_user_state'`,[id.tenant]);
    mock.suspendMoodleUser.mockImplementationOnce(async()=>{
      await db.query(`UPDATE integration_outbox SET state='pending',next_attempt_at=now()
        WHERE tenant_id=$1 AND kind='moodle_user_state'`,[id.tenant]);
    });
    expect(await runJobs(1,id.tenant)).toEqual({done:1,failed:0});
    const rows=await db.query(`SELECT state FROM integration_outbox WHERE tenant_id=$1 AND kind='moodle_user_state'`,[id.tenant]);
    expect(rows.rows[0].state).toBe('pending');
    expect(await runJobs(1,id.tenant)).toEqual({done:1,failed:0});
  });

  it('keeps activation-blocked enrollment retryable without claiming success or discarding backoff', async () => {
    const db=database();
    await db.query('DELETE FROM moodle_enrollments WHERE tenant_id=$1 AND assignment_id=$2',[id.tenant,id.assignment]);
    await db.query('UPDATE people SET account_access_locked=true WHERE id=$1',[id.person]);
    await db.query(`INSERT INTO integration_outbox(tenant_id,kind,aggregate_id) VALUES($1,'moodle_enrol',$2)`,[id.tenant,id.assignment]);
    expect(await runJobs(1,id.tenant)).toEqual({done:0,failed:1});
    await enqueueReconciliation(id.tenant);
    let row=await db.query(`SELECT state FROM integration_outbox WHERE tenant_id=$1 AND aggregate_id=$2 AND kind='moodle_enrol'`,[id.tenant,id.assignment]);
    expect(row.rows[0].state).toBe('failed');
    await db.query('UPDATE people SET account_access_locked=false WHERE id=$1',[id.person]);
    await db.query(`INSERT INTO site_moodle_cohorts(tenant_id,site_id,moodle_cohort_id,instance_key)
      VALUES($1,$2,3,'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8')`,[id.tenant,id.site]);
    await enqueueReconciliation(id.tenant);
    row=await db.query(`SELECT state FROM integration_outbox WHERE tenant_id=$1 AND aggregate_id=$2 AND kind='moodle_enrol'`,[id.tenant,id.assignment]);
    expect(row.rows[0].state).toBe('failed');
    // Activation wakes the retry in the account API (covered separately); this
    // direct-SQL fixture makes the failed job due without bypassing its guard.
    await db.query(`UPDATE integration_outbox SET next_attempt_at=now()
      WHERE tenant_id=$1 AND aggregate_id=$2 AND kind='moodle_enrol'`,[id.tenant,id.assignment]);
    mock.isUserEnrolled.mockResolvedValue(false);
    expect(await runJobs(3,id.tenant)).toEqual({done:2,failed:0});
    const enrollment=await db.query('SELECT moodle_user_id FROM moodle_enrollments WHERE tenant_id=$1 AND assignment_id=$2',[id.tenant,id.assignment]);
    expect(Number(enrollment.rows[0].moodle_user_id)).toBe(17);
  });

});
