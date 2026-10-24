import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '../src/lib/server/db';
import { listAssignments, summarize } from '../src/lib/server/assignments';
import type { Actor } from '../src/lib/server/auth';
import { runJobs } from '../src/lib/server/jobs';

const mock = vi.hoisted(() => ({ completion: vi.fn(), progress: vi.fn() }));
vi.mock('../src/lib/server/moodle', () => ({
  moodleConnection: () => ({ instanceId: 'f5a21bbd-1582-45fa-8b7f-71d01d66a4f8',
    baseUrl: 'https://moodle.example.test', token: 'test-only' }),
  moodleCourseUrl: () => 'https://moodle.example.test/course/view.php?id=42',
  readCompletion: mock.completion, readMoodleLearningProgress: mock.progress,
  isUserEnrolled: vi.fn().mockResolvedValue(true), findMoodleUserByHseId: vi.fn(), provisionMoodleUser: vi.fn(),
  linkMoodleUser: vi.fn(), suspendMoodleUser: vi.fn(), suppressMoodleEmail: vi.fn(),
  addUserToCohort: vi.fn(), enrollUser: vi.fn()
}));

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('source-owned learner progress', () => {
  const id = { tenant: randomUUID(), site: randomUUID(), person: randomUUID(), principal: randomUUID(),
    requirement: randomUUID(), version: randomUUID(), course: randomUUID(), assignment: randomUUID(), job: randomUUID() };
  const clock = new Date('2026-10-11T12:00:00Z');
  const actor: Actor = { id: id.principal, tenantId: id.tenant, tenantName: 'Progress test', tenantSynthetic: false,
    personId: id.person, displayName: 'Mock learner', role: 'learner', siteIds: [id.site] };
  const incomplete = { completed: false, completedAt: null, score: null, attempts: 0,
    scormObservation: null, quizObservation: null, raw: {} };
  const observation = (started: boolean | null, read: string, observed: string) => ({
    courseId: 42, userId: 17, started, courseLastAccessAt: started ? new Date('2026-10-11T09:00:00Z') : null,
    activitiesWithProgress: started ? 1 : 0, trackedActivities: 4, startedAttempts: 0,
    readStartedAt: new Date(read), observedAt: new Date(observed), activities: []
  });
  const again = async () => database().query(`UPDATE integration_outbox SET state='pending',next_attempt_at=now(),completed_at=NULL WHERE id=$1`, [id.job]);

  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants(id,slug,name,synthetic) VALUES($1,$2,'Mock Moodle progress',false)`, [id.tenant, `progress-${id.tenant}`]);
    await db.query(`INSERT INTO sites(id,tenant_id,code,name,state_code,time_zone)
      VALUES($1,$2,'test','Progress site','GA','America/New_York')`, [id.site, id.tenant]);
    await db.query(`INSERT INTO people(id,tenant_id,display_name,person_type,synthetic,email)
      VALUES($1,$2,'Mock progress learner','employee',false,'progress@example.test')`, [id.person, id.tenant]);
    await db.query(`INSERT INTO principals(id,tenant_id,oidc_issuer,oidc_subject,person_id,role)
      VALUES($1,$2,'mock-progress',$3,$4,'learner')`, [id.principal, id.tenant, id.principal, id.person]);
    await db.query(`INSERT INTO person_external_ids(tenant_id,person_id,source,external_id,instance_key)
      VALUES($1,$2,'moodle','17','f5a21bbd-1582-45fa-8b7f-71d01d66a4f8')`, [id.tenant, id.person]);
    await db.query(`INSERT INTO requirements(id,tenant_id,code,title) VALUES($1,$2,'progress','Progress course')`, [id.requirement, id.tenant]);
    await db.query(`INSERT INTO requirement_versions(id,tenant_id,requirement_id,version,legal_status,
      authority,audience,site_overlay_requirement,content_digest,authorization_prerequisites,review_status,reviewed_by,reviewed_at)
      VALUES($1,$2,$3,'1','general_awareness','Mock only','Mock learners','None',repeat('a',64),'["knowledge"]','approved','Test reviewer',now())`, [id.version, id.tenant, id.requirement]);
    await db.query(`INSERT INTO course_versions(id,tenant_id,requirement_version_id,content_id,content_version,title,
      package_sha256,export_format,moodle_course_id,review_status,reviewed_by,reviewed_at,completion_criteria_verified,completion_verification_note)
      VALUES($1,$2,$3,'progress-test','1','Progress course',repeat('b',64),'url',42,'approved','Test reviewer',now(),true,'Mocked progress test only')`, [id.course, id.tenant, id.version]);
    await db.query(`INSERT INTO assignments(id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,course_version_id,
      reason,trigger_kind,assigned_at,due_at,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,'Mock progress assignment','manual','2026-10-01','2026-10-19T03:59:59Z',$8)`,
    [id.assignment, id.tenant, id.person, id.site, id.requirement, id.version, id.course, id.principal]);
    await db.query(`INSERT INTO moodle_enrollments(tenant_id,assignment_id,moodle_user_id,moodle_course_id,enrolled_at)
      VALUES($1,$2,17,42,'2026-10-01')`, [id.tenant, id.assignment]);
    await db.query(`INSERT INTO integration_outbox(id,tenant_id,kind,aggregate_id) VALUES($1,$2,'moodle_reconcile',$3)`, [id.job, id.tenant, id.assignment]);
    mock.completion.mockResolvedValue(incomplete);
  });

  it('keeps enrollment unknown until observed, then records no-start without creating completion evidence', async () => {
    const initial = await listAssignments(actor, clock);
    expect(initial[0]).toMatchObject({ state: 'progress_unknown', dueSoon: true,
      progress: { status: 'unknown', observedAt: null } });
    expect(summarize(initial, clock).counts).toMatchObject({ total: 1, progressUnknown: 1, inProgress: 0, notStarted: 0 });
    let completionReadAt: Date | undefined;
    mock.completion.mockImplementationOnce(async () => { completionReadAt = new Date(); return incomplete; });
    mock.progress.mockResolvedValueOnce(observation(false, '2026-10-11T09:00:00Z', '2026-10-11T09:01:00Z'));
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    expect(mock.progress.mock.calls[0][4]).toBeInstanceOf(Date);
    expect(mock.progress.mock.calls[0][4].getTime()).toBeLessThanOrEqual(completionReadAt!.getTime());
    expect((await listAssignments(actor, clock))[0]).toMatchObject({ state: 'not_started', dueSoon: true,
      progress: { status: 'not_started', observedAt: '2026-10-11T09:01:00.000Z', trackedActivities: 4 } });
    expect((await database().query('SELECT id FROM knowledge_evidence WHERE tenant_id=$1', [id.tenant])).rowCount).toBe(0);
  });

  it('shows observed progress within the original learner/site/tenant scope and ignores out-of-order reads', async () => {
    await again();
    mock.progress.mockResolvedValueOnce(observation(true, '2026-10-11T09:02:00Z', '2026-10-11T09:03:00Z'));
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    expect((await listAssignments(actor, clock))[0]).toMatchObject({ state: 'in_progress', knowledgeComplete: false,
      progress: { status: 'in_progress', activitiesWithProgress: 1 } });
    expect(await listAssignments({ ...actor, personId: randomUUID() }, clock)).toEqual([]);
    expect(await listAssignments({ ...actor, role: 'site_admin', siteIds: [randomUUID()] }, clock)).toEqual([]);
    expect(await listAssignments({ ...actor, tenantId: randomUUID() }, clock)).toEqual([]);
    await again();
    mock.progress.mockResolvedValueOnce(observation(false, '2026-10-11T09:01:00Z', '2026-10-11T09:04:00Z'));
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    expect((await listAssignments(actor, clock))[0]).toMatchObject({ state: 'in_progress',
      progress: { observedAt: '2026-10-11T09:03:00.000Z' } });
    expect((await listAssignments(actor, new Date('2026-10-11T09:02:00Z')))[0]).toMatchObject({
      state: 'progress_unknown', progress: { observedAt: null } });
  });

  it('retains the last observation on read failure and lets canonical completion win over unknown progress', async () => {
    await again(); mock.progress.mockRejectedValueOnce(new Error('Moodle progress permission unavailable'));
    expect(await runJobs(1, id.tenant)).toEqual({ done: 0, failed: 1 });
    expect((await listAssignments(actor, clock))[0].progress.observedAt).toBe('2026-10-11T09:03:00.000Z');
    await again();
    mock.progress.mockResolvedValueOnce(observation(null, '2026-10-11T09:05:00Z', '2026-10-11T09:06:00Z'));
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    expect((await listAssignments(actor, clock))[0].state).toBe('progress_unknown');
    await again();
    mock.completion.mockResolvedValueOnce({ ...incomplete, completed: true,
      completedAt: new Date('2026-10-10T00:00:00Z'), score: 90, attempts: 2, raw: { canonical: 'Mock source fact' } });
    expect(await runJobs(1, id.tenant)).toEqual({ done: 1, failed: 0 });
    expect((await listAssignments(actor, clock))[0]).toMatchObject({ state: 'knowledge_complete', knowledgeComplete: true,
      dueSoon: false, progress: { status: 'unknown' } });
    const evidence = await database().query('SELECT score,attempts,source_payload FROM knowledge_evidence WHERE tenant_id=$1', [id.tenant]);
    expect(evidence.rows[0]).toMatchObject({ attempts: 2, source_payload: { canonical: 'Mock source fact' } });
    await expect(database().query('UPDATE knowledge_evidence SET score=100 WHERE tenant_id=$1', [id.tenant])).rejects.toThrow(/immutable/);
  });
});
