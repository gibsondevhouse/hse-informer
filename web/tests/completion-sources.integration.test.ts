import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { database } from '../src/lib/server/db';
import { runJobs } from '../src/lib/server/jobs';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const originalConnections = process.env.MOODLE_CONNECTIONS_JSON;

describe.skipIf(!enabled)('canonical Moodle completions and durable source snapshots', () => {
  const ids = { tenant: randomUUID(), site: randomUUID(), person: randomUUID(), principal: randomUUID(),
    requirement: randomUUID(), version: randomUUID(), course: randomUUID(), assignment: randomUUID(), instance: randomUUID() };
  const completedAt = new Date('2026-10-10T00:00:00Z');
  let evidenceId: string;
  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants (id,slug,name,synthetic) VALUES ($1,$2,'Mock Moodle completion pipeline',false)`, [ids.tenant, `canonical-${ids.tenant}`]);
    await db.query(`INSERT INTO sites (id,tenant_id,code,name,state_code) VALUES ($1,$2,'main','Original site','GA')`, [ids.site, ids.tenant]);
    await db.query(`INSERT INTO people (id,tenant_id,display_name,person_type,synthetic,email) VALUES ($1,$2,'Original learner','employee',false,'learner@example.test')`, [ids.person, ids.tenant]);
    await db.query(`INSERT INTO principals (id,tenant_id,oidc_issuer,oidc_subject,role) VALUES ($1,$2,'test',$3,'tenant_admin')`, [ids.principal, ids.tenant, ids.principal]);
    await db.query(`INSERT INTO person_external_ids (tenant_id,person_id,source,external_id,instance_key) VALUES ($1,$2,'moodle','17',$3)`, [ids.tenant, ids.person, ids.instance]);
    await db.query(`INSERT INTO requirements (id,tenant_id,code,title) VALUES ($1,$2,'CANONICAL','Original course')`, [ids.requirement, ids.tenant]);
    await db.query(`INSERT INTO requirement_versions (id,tenant_id,requirement_id,version,legal_status,authority,audience,
      site_overlay_requirement,content_digest,authorization_prerequisites,review_status,reviewed_by,reviewed_at)
      VALUES ($1,$2,$3,'v1','general_awareness','Mocked test only','Test people','None',repeat('a',64),'["knowledge"]','approved','Test reviewer',now())`, [ids.version, ids.tenant, ids.requirement]);
    await db.query(`INSERT INTO course_versions (id,tenant_id,requirement_version_id,content_source,content_id,content_version,
      title,package_sha256,export_format,moodle_course_id,review_status,reviewed_by,reviewed_at,completion_criteria_verified,completion_verification_note)
      VALUES ($1,$2,$3,'in_house','canonical-test','v1','Original course',repeat('b',64),'url',42,'approved','Test reviewer',now(),true,'Mocked integration test only')`, [ids.course, ids.tenant, ids.version]);
    await db.query(`INSERT INTO assignments (id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,course_version_id,
      reason,trigger_kind,assigned_at,due_at,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Mocked canonical evidence test','manual','2026-10-01','2027-01-01',$8)`,
    [ids.assignment, ids.tenant, ids.person, ids.site, ids.requirement, ids.version, ids.course, ids.principal]);
    await db.query(`INSERT INTO moodle_enrollments (tenant_id,assignment_id,moodle_user_id,moodle_course_id,enrolled_at)
      VALUES ($1,$2,17,42,'2026-10-01')`, [ids.tenant, ids.assignment]);
    process.env.MOODLE_CONNECTIONS_JSON = JSON.stringify({ [ids.tenant]: { instanceId: ids.instance,
      baseUrl: 'https://moodle.example.test', token: 'mock-token', completionEvidence: 'local_hse_evidence' } });
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
      const fn = (options.body as URLSearchParams).get('wsfunction');
      const response = fn === 'core_enrol_get_users_courses' ? [{ id: 42 }]
        : fn === 'core_completion_get_course_completion_status' ? { completionstatus: { completed: true, completions: [] }, warnings: [] }
        : fn === 'local_hse_evidence_get_completion' ? { courseid: 42, userid: 17, completed: true,
          completionid: 1234, timecompleted: completedAt.getTime() / 1000, score: 92 }
        : { exception: 'unexpected_function', message: `Unexpected function ${fn}` };
      return new Response(JSON.stringify(response), { status: 200 });
    }));
  });
  afterAll(() => { process.env.MOODLE_CONNECTIONS_JSON = originalConnections; vi.unstubAllGlobals(); });

  it('reconciles canonical source time and score without a native learning runtime', async () => {
    await database().query(`INSERT INTO integration_outbox (tenant_id,kind,aggregate_id) VALUES ($1,'moodle_reconcile',$2)`, [ids.tenant, ids.assignment]);
    expect(await runJobs(1, ids.tenant)).toEqual({ done: 1, failed: 0 });
    const rows = await database().query(`SELECT * FROM knowledge_evidence WHERE tenant_id = $1 AND assignment_id = $2`, [ids.tenant, ids.assignment]);
    expect(rows.rows).toHaveLength(1);
    const evidence = rows.rows[0]; evidenceId = evidence.id;
    expect(evidence.completed_at.toISOString()).toBe(completedAt.toISOString());
    expect(evidence.moodle_timecompleted.toISOString()).toBe(completedAt.toISOString());
    expect(evidence.delivery_source).toBe('moodle');
    expect(Number(evidence.score)).toBe(92);
    expect(evidence.source_payload.canonical.completionid).toBe(1234);
    expect(evidence.completion_snapshot.person.displayName).toBe('Original learner');
    expect(evidence.completion_snapshot.site.name).toBe('Original site');
    expect(evidence.completion_snapshot.course).toMatchObject({ title: 'Original course', version: 'v1' });
  });

  it('preserves identity and exact version after profile edits, and deduplicates synchronization', async () => {
    await database().query('UPDATE people SET display_name = $2 WHERE tenant_id = $1 AND id = $3', [ids.tenant, 'Renamed learner', ids.person]);
    await database().query('UPDATE sites SET name = $2 WHERE tenant_id = $1 AND id = $3', [ids.tenant, 'Renamed site', ids.site]);
    await database().query(`UPDATE integration_outbox SET state = 'pending', next_attempt_at = now() WHERE tenant_id = $1 AND aggregate_id = $2`, [ids.tenant, ids.assignment]);
    expect(await runJobs(1, ids.tenant)).toEqual({ done: 1, failed: 0 });
    const rows = await database().query(`SELECT * FROM knowledge_evidence WHERE tenant_id = $1 AND assignment_id = $2`, [ids.tenant, ids.assignment]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].id).toBe(evidenceId);
    expect(rows.rows[0].completion_snapshot.person.displayName).toBe('Original learner');
    expect(rows.rows[0].completion_snapshot.site.name).toBe('Original site');
    await expect(database().query('UPDATE knowledge_evidence SET score = 100 WHERE id = $1', [evidenceId])).rejects.toThrow(/immutable evidence/);
  });

  it('rejects invented source-neutral timestamps on Moodle evidence', async () => {
    await expect(database().query(`INSERT INTO knowledge_evidence (tenant_id,assignment_id,course_version_id,moodle_course_id,moodle_user_id,
      moodle_timecompleted,completed_at,delivery_method,source_payload)
      VALUES ($1,$2,$3,42,17,'2026-10-11','2026-10-12','moodle','{}')`, [ids.tenant, ids.assignment, ids.course]))
      .rejects.toThrow(/timestamps must match their source/);
  });
});
