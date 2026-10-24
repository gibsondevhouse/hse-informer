import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '../src/lib/server/db';
import { runJobs } from '../src/lib/server/jobs';

const mock = vi.hoisted(() => ({ readCompletion: vi.fn() }));
vi.mock('../src/lib/server/moodle', () => ({
  moodleConnection: () => ({ instanceId: 'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8',
    baseUrl: 'https://moodle.example.test', token: 'synthetic-token' }),
  readCompletion: mock.readCompletion, isUserEnrolled: vi.fn().mockResolvedValue(true),
  findMoodleUserByHseId: vi.fn(), provisionMoodleUser: vi.fn(), suspendMoodleUser: vi.fn(),
  suppressMoodleEmail: vi.fn(), linkMoodleUser: vi.fn(), addUserToCohort: vi.fn(), enrollUser: vi.fn()
}));

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('native Quiz reconciliation snapshots', () => {
  const id = { tenant: randomUUID(), site: randomUUID(), person: randomUUID(), principal: randomUUID(),
    requirement: randomUUID(), version: randomUUID(), course: randomUUID(), assignment: randomUUID(), job: randomUUID() };
  const completedAt = new Date('2026-10-10T00:00:00Z');
  const observation = {
    quizId: 19, courseId: 42, activityModuleId: 260, activityState: 2,
    activityUpdatedAt: '2026-10-09T23:59:00.000Z', maximumGrade: 100, totalMarks: 10,
    gradingMethod: 1, serviceAccountAttemptLimit: 3, observedAt: '2026-10-10T00:01:00.000Z',
    attempts: [1, 2, 3].map((attemptNumber) => ({ id: 900 + attemptNumber, attemptNumber,
      state: 'finished', currentPage: 4, rawMarks: attemptNumber === 2 ? 10 : 0,
      startedAt: '2026-10-09T23:50:00.000Z', submittedAt: '2026-10-09T23:59:00.000Z', modifiedAt: '2026-10-09T23:59:00.000Z' }))
  };

  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants(id,slug,name,synthetic) VALUES($1,$2,'Synthetic native Quiz test',false)`, [id.tenant, `quiz-jobs-${id.tenant}`]);
    await db.query(`INSERT INTO sites(id,tenant_id,code,name,state_code) VALUES($1,$2,'test','Synthetic site','GA')`, [id.site, id.tenant]);
    await db.query(`INSERT INTO people(id,tenant_id,display_name,person_type,synthetic,email)
      VALUES($1,$2,'Mock quiz worker','employee',false,'quiz-worker@example.test')`, [id.person, id.tenant]);
    await db.query(`INSERT INTO principals(id,tenant_id,oidc_issuer,oidc_subject,role)
      VALUES($1,$2,'synthetic-test',$3,'tenant_admin')`, [id.principal, id.tenant, id.principal]);
    await db.query(`INSERT INTO person_external_ids(tenant_id,person_id,source,external_id,instance_key)
      VALUES($1,$2,'moodle','17','f5a21bbd-1582-45fa-8b7f-71d01d66a4f8')`, [id.tenant, id.person]);
    await db.query(`INSERT INTO requirements(id,tenant_id,code,title)
      VALUES($1,$2,'native-quiz','Synthetic native assessment')`, [id.requirement, id.tenant]);
    await db.query(`INSERT INTO requirement_versions(id,tenant_id,requirement_id,version,
      legal_status,authority,audience,site_overlay_requirement,content_digest,authorization_prerequisites,
      review_status,reviewed_by,reviewed_at) VALUES($1,$2,$3,'test','general_awareness','Synthetic only',
      'Synthetic workers','None',repeat('a',64),'["knowledge"]','approved','Synthetic reviewer',now())`, [id.version, id.tenant, id.requirement]);
    await db.query(`INSERT INTO course_versions(id,tenant_id,requirement_version_id,package_sha256,export_format,
      moodle_course_id,moodle_activity_id,moodle_quiz_id,review_status,reviewed_by,reviewed_at,
      completion_criteria_verified,completion_verification_note)
      VALUES($1,$2,$3,repeat('b',64),'url',42,260,19,'approved','Synthetic reviewer',now(),true,'Synthetic job test')`, [id.course, id.tenant, id.version]);
    await db.query(`INSERT INTO assignments(id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,
      course_version_id,reason,trigger_kind,assigned_at,due_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,'Synthetic native Quiz test','manual','2026-10-01','2027-01-01',$8)`,
    [id.assignment, id.tenant, id.person, id.site, id.requirement, id.version, id.course, id.principal]);
    await db.query(`INSERT INTO moodle_enrollments(tenant_id,assignment_id,moodle_user_id,moodle_course_id,enrolled_at)
      VALUES($1,$2,17,42,'2026-10-01')`, [id.tenant, id.assignment]);
    await db.query(`INSERT INTO integration_outbox(id,tenant_id,kind,aggregate_id)
      VALUES($1,$2,'moodle_reconcile',$3)`, [id.job, id.tenant, id.assignment]);
  });

  const again = async () => database().query(`UPDATE integration_outbox SET state='pending',next_attempt_at=now(),completed_at=NULL WHERE id=$1`, [id.job]);

  it('keeps failed exact-mapping reads retryable and stores only the approved quiz observation after success', async () => {
    mock.readCompletion.mockRejectedValueOnce(new Error('Quiz does not match the pinned course and activity module'));
    expect(await runJobs(1, id.tenant)).toEqual({ done: 0, failed: 1 });
    expect((await database().query('SELECT id FROM knowledge_evidence WHERE tenant_id=$1', [id.tenant])).rowCount).toBe(0);
    expect(mock.readCompletion).toHaveBeenLastCalledWith(id.tenant, 42, 17, null, 260, 19);
    mock.readCompletion.mockResolvedValueOnce({ completed: true, completedAt, score: 91.5, attempts: 3,
      scormObservation: null, quizObservation: observation, sourceCompletionId: 123,
      raw: { canonical: { completionid: 123, score: 91.5 }, quiz: observation } });
    await again();
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    const result = await database().query(`SELECT score::float8 AS score,attempts,completed_at,source_payload FROM knowledge_evidence WHERE tenant_id=$1`, [id.tenant]);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toMatchObject({ score: 91.5, attempts: 3, completed_at: completedAt,
      source_payload: { canonical: { completionid: 123, score: 91.5 }, quiz: observation } });
  });

  it('preserves the original attempt snapshot when later attempts are observed for the same completion', async () => {
    const later = { ...observation, observedAt: '2026-10-11T00:01:00.000Z', attempts: [...observation.attempts,
      { ...observation.attempts[0], id: 904, attemptNumber: 4, state: 'inprogress', rawMarks: null }] };
    mock.readCompletion.mockResolvedValueOnce({ completed: true, completedAt, score: 100, attempts: 4,
      scormObservation: null, quizObservation: later, sourceCompletionId: 123, raw: { quiz: later } });
    await again();
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    const result = await database().query(`SELECT score::float8 AS score,attempts,completed_at,source_payload FROM knowledge_evidence WHERE tenant_id=$1`, [id.tenant]);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toMatchObject({ score: 91.5, attempts: 3, completed_at: completedAt,
      source_payload: { canonical: { completionid: 123, score: 91.5 }, quiz: observation } });
    await expect(database().query(`UPDATE knowledge_evidence SET source_payload='{}' WHERE tenant_id=$1`, [id.tenant])).rejects.toThrow(/immutable/);
  });
});
