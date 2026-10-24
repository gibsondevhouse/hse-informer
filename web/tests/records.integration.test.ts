import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { database } from '../src/lib/server/db';
import type { Actor } from '../src/lib/server/auth';
import { amendCompletion, completionDetail, exportCompletions, listCompletions, recordManualCompletion } from '../src/lib/server/records';
import { listAssignments } from '../src/lib/server/assignments';
import { decideAuthorization } from '../src/lib/server/compliance';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('beta completion records', () => {
  const ids = { tenant: randomUUID(), foreignTenant: randomUUID(), site: randomUUID(), otherSite: randomUUID(),
    person: randomUUID(), otherPerson: randomUUID(), admin: randomUUID(), siteAdmin: randomUUID(),
    learner: randomUUID(), requirement: randomUUID(), version: randomUUID(), course: randomUUID(),
    otherCourse: randomUUID(), assignment: randomUUID(), foreignPerson: randomUUID(), foreignSite: randomUUID() };
  const admin: Actor = { id: ids.admin, tenantId: ids.tenant, tenantName: 'Records test', tenantSynthetic: true,
    personId: null, displayName: 'Records administrator', role: 'tenant_admin', siteIds: [] };
  const learner: Actor = { ...admin, id: ids.learner, personId: ids.person, displayName: 'Original Person', role: 'learner', siteIds: [ids.site] };
  const siteAdmin: Actor = { ...admin, id: ids.siteAdmin, role: 'site_admin', siteIds: [ids.otherSite] };
  const manual = { personId: ids.person, siteId: ids.site, courseVersionId: ids.course,
    completedAt: '2020-03-12T10:00:00.000Z', sourceReference: 'Instructor certificate 123',
    reason: 'Verified original certificate', satisfyAssignment: false, assignmentId: null };
  let unlinkedId: string;
  let linkedId: string;
  let correctedId: string;

  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants (id,slug,name,synthetic) VALUES
      ($1,$2,'Records test',true),($3,$4,'Foreign records test',true)`,
    [ids.tenant, `records-${ids.tenant}`, ids.foreignTenant, `records-${ids.foreignTenant}`]);
    await db.query(`INSERT INTO sites (id,tenant_id,code,name,state_code) VALUES
      ($1,$4,'records','Record site','GA'),($2,$4,'other','Other site','GA'),($3,$5,'foreign','Foreign site','GA')`,
    [ids.site, ids.otherSite, ids.foreignSite, ids.tenant, ids.foreignTenant]);
    await db.query(`INSERT INTO people (id,tenant_id,display_name,person_type,synthetic) VALUES
      ($1,$4,'Original Person','employee',true),($2,$4,'Other Person','employee',true),
      ($3,$5,'Foreign Person','employee',true)`, [ids.person, ids.otherPerson, ids.foreignPerson, ids.tenant, ids.foreignTenant]);
    await db.query(`INSERT INTO person_site_memberships (tenant_id,person_id,site_id) VALUES
      ($1,$2,$3),($1,$4,$3),($5,$6,$7)`, [ids.tenant, ids.person, ids.site, ids.otherPerson,
      ids.foreignTenant, ids.foreignPerson, ids.foreignSite]);
    await db.query(`INSERT INTO principals (id,tenant_id,oidc_issuer,oidc_subject,role,person_id) VALUES
      ($1,$4,'records-test',$1::uuid::text,'tenant_admin',NULL),($2,$4,'records-test',$2::uuid::text,'site_admin',NULL),
      ($3,$4,'records-test',$3::uuid::text,'learner',$5)`, [ids.admin, ids.siteAdmin, ids.learner, ids.tenant, ids.person]);
    await db.query(`INSERT INTO requirements (id,tenant_id,code,title) VALUES ($1,$2,'REC','Records course')`,
      [ids.requirement, ids.tenant]);
    await db.query(`INSERT INTO requirement_versions (id,tenant_id,requirement_id,version,legal_status,
      authority,audience,site_overlay_requirement,content_digest,review_status,reviewed_by,reviewed_at,authorization_prerequisites)
      VALUES ($1,$2,$3,'1','general_awareness','Test','Test','None',repeat('a',64),'approved','Test',now(),'["knowledge"]')`,
    [ids.version, ids.tenant, ids.requirement]);
    await db.query(`UPDATE requirements SET active_version_id = $3 WHERE tenant_id = $1 AND id = $2`,
      [ids.tenant, ids.requirement, ids.version]);
    for (const [id, version] of [[ids.course,'1'],[ids.otherCourse,'2']]) {
      await db.query(`INSERT INTO course_versions (id,tenant_id,requirement_version_id,content_id,content_version,
        title,package_sha256,export_format,moodle_course_id,review_status,reviewed_by,reviewed_at)
        VALUES ($1,$2,$3,'records-test',$4,'Records course',repeat('b',64),'scorm_1_2',42,'approved','Test',now())`,
      [id, ids.tenant, ids.version, version]);
    }
    await db.query(`INSERT INTO assignments (id,tenant_id,person_id,site_id,requirement_id,requirement_version_id,
      course_version_id,reason,trigger_kind,due_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'Test','manual',now()+interval '1 year',$8)`,
    [ids.assignment, ids.tenant, ids.person, ids.site, ids.requirement, ids.version, ids.course, ids.admin]);
  });

  it('records transcript-only manual provenance without inventing an assessment', async () => {
    unlinkedId = await recordManualCompletion(admin, manual);
    const detail = await completionDetail(admin, unlinkedId);
    expect(detail.item).toMatchObject({ source: 'manual', assignmentId: null, score: null, attempts: null,
      completedAt: manual.completedAt, sourceReference: manual.sourceReference, recordedBy: ids.admin,
      personName: 'Original Person', courseVersion: '1', state: 'effective' });
    const rows = await database().query('SELECT id FROM effective_knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [ids.tenant, ids.assignment]);
    expect(rows.rowCount).toBe(0);
    expect((await listCompletions(admin, { search: 'certificate 123' })).total).toBe(1);
  });

  it('requires an explicit exact assignment decision and rejects wrong versions or people', async () => {
    await expect(recordManualCompletion(admin, { ...manual, assignmentId: ids.assignment })).rejects.toMatchObject({ status: 400 });
    await expect(recordManualCompletion(admin, { ...manual, satisfyAssignment: true })).rejects.toMatchObject({ status: 400 });
    await expect(recordManualCompletion(admin, { ...manual, satisfyAssignment: true, assignmentId: ids.assignment,
      courseVersionId: ids.otherCourse })).rejects.toMatchObject({ status: 409 });
    await expect(recordManualCompletion(admin, { ...manual, personId: ids.otherPerson,
      satisfyAssignment: true, assignmentId: ids.assignment })).rejects.toMatchObject({ status: 409 });
    linkedId = await recordManualCompletion(admin, { ...manual, satisfyAssignment: true, assignmentId: ids.assignment });
    const rows = await database().query('SELECT id FROM effective_knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [ids.tenant, ids.assignment]);
    expect(rows.rows.map((r) => r.id)).toEqual([linkedId]);
    expect((await listAssignments(admin)).find((a) => a.id === ids.assignment)?.knowledgeComplete).toBe(true);
  });

  it('enforces source and site permissions and only exposes the learner own transcript', async () => {
    await expect(recordManualCompletion(learner, manual)).rejects.toMatchObject({ status: 403 });
    await expect(recordManualCompletion(siteAdmin, manual)).rejects.toMatchObject({ status: 403 });
    await expect(recordManualCompletion(admin, { ...manual, personId: ids.foreignPerson })).rejects.toMatchObject({ status: 404 });
    await expect(completionDetail(siteAdmin, linkedId)).rejects.toMatchObject({ status: 404 });
    const otherId = await recordManualCompletion(admin, { ...manual, personId: ids.otherPerson });
    const mine = await listCompletions(learner, { state: 'all' });
    expect(mine.items.every((r) => r.personId === ids.person)).toBe(true);
    await expect(completionDetail(learner, otherId)).rejects.toMatchObject({ status: 404 });
    expect((await listCompletions(siteAdmin, { state: 'all' })).items).toEqual([]);
  });

  it('preserves snapshots after a profile edit', async () => {
    await database().query('UPDATE people SET display_name=$3 WHERE tenant_id=$1 AND id=$2', [ids.tenant, ids.person, 'Changed Person']);
    expect((await completionDetail(admin, unlinkedId)).item.personName).toBe('Original Person');
  });

  it('corrects with an append-only manual replacement and re-evaluates assignment evidence', async () => {
    const result = await amendCompletion(admin, linkedId, { kind: 'corrected', reason: 'Original completion date was wrong',
      replacement: { ...manual, completedAt: '2020-03-13T10:00:00.000Z', reason: 'Rechecked original source' } });
    correctedId = result.replacementId!;
    expect((await completionDetail(admin, linkedId)).item).toMatchObject({ state: 'superseded', replacementId: correctedId });
    const detail = await completionDetail(admin, correctedId);
    expect(detail.item).toMatchObject({ source: 'manual', supersedesId: linkedId, assignmentId: null });
    expect(detail.history).toHaveLength(2);
    expect(detail.events[0]).toMatchObject({ kind: 'corrected', reason: 'Original completion date was wrong', recordedBy: ids.admin });
    const effective = await database().query('SELECT id FROM effective_knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [ids.tenant, ids.assignment]);
    expect(effective.rowCount).toBe(0);
    expect((await listAssignments(admin)).find((a) => a.id === ids.assignment)?.knowledgeComplete).toBe(false);
    await expect(database().query('UPDATE knowledge_evidence SET score=100 WHERE tenant_id=$1 AND id=$2',
      [ids.tenant, linkedId])).rejects.toThrow('immutable evidence');
  });

  it('voids once, retains linked history, and audits every mutation', async () => {
    await amendCompletion(admin, correctedId, { kind: 'voided', reason: 'Source document was withdrawn' });
    const detail = await completionDetail(admin, linkedId);
    expect(detail.history).toHaveLength(2);
    expect(detail.history.find((r) => r.id === correctedId)?.state).toBe('voided');
    expect(detail.events.map((e) => e.kind)).toEqual(['corrected','voided']);
    await expect(amendCompletion(admin, correctedId, { kind: 'voided', reason: 'Duplicate request' })).rejects.toMatchObject({ status: 409 });
    await expect(amendCompletion(admin, linkedId, { kind: 'voided', reason: 'Already corrected' })).rejects.toMatchObject({ status: 409 });
    await expect(amendCompletion(learner, unlinkedId, { kind: 'voided', reason: 'Not permitted' })).rejects.toMatchObject({ status: 403 });
    const audit = await database().query('SELECT action FROM audit_log WHERE tenant_id=$1 AND entity_id=$2', [ids.tenant, linkedId]);
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['completion.manual_recorded','completion.corrected']));
    await expect(database().query('DELETE FROM completion_record_events WHERE tenant_id=$1', [ids.tenant])).rejects.toThrow('immutable evidence');
  });

  it('exports the same filtered scope and records the export decision', async () => {
    const filtered = await listCompletions(admin, { state: 'voided', from: '2020-03-13', through: '2020-03-13' });
    const csv = await exportCompletions(admin, { state: 'voided', from: '2020-03-13', through: '2020-03-13' });
    expect(filtered.total).toBe(1);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2);
    expect(csv).toContain(correctedId);
    expect(csv).not.toContain(linkedId);
    const audit = await database().query('SELECT after_value FROM audit_log WHERE tenant_id=$1 AND action=$2', [ids.tenant, 'completion.exported']);
    expect(audit.rows.at(-1)?.after_value).toMatchObject({ count: 1, recordIds: [correctedId] });
    const restricted = await exportCompletions(siteAdmin, { state: 'all' });
    expect(restricted.split('\r\n').filter(Boolean)).toHaveLength(1);
    await expect(listCompletions(admin, { from: '2020-03-14', through: '2020-03-13' })).rejects.toMatchObject({ status: 400 });
  });

  it('retains original Moodle facts when an administrator records a correction', async () => {
    const result = await database().query<{ id: string }>(`INSERT INTO knowledge_evidence
      (tenant_id,assignment_id,course_version_id,moodle_course_id,moodle_user_id,moodle_timecompleted,
        score,attempts,delivery_method,source_payload) VALUES ($1,$2,$3,42,99,'2020-03-14T10:00:00Z',85,2,'scorm','{"attempts":[{"score":40},{"score":85}]}') RETURNING id`,
    [ids.tenant, ids.assignment, ids.course]);
    const moodleId = result.rows[0].id;
    const corrected = await amendCompletion(admin, moodleId, { kind: 'corrected', reason: 'Documented instructor correction',
      replacement: { ...manual, sourceReference: 'Original Moodle completion plus instructor correction', satisfyAssignment: true, assignmentId: ids.assignment } });
    const original = await database().query('SELECT score,attempts,source_payload FROM knowledge_evidence WHERE tenant_id=$1 AND id=$2', [ids.tenant, moodleId]);
    expect(Number(original.rows[0].score)).toBe(85);
    expect(original.rows[0].attempts).toBe(2);
    expect(original.rows[0].source_payload.attempts).toEqual([{ score: 40 },{ score: 85 }]);
    expect((await completionDetail(admin, corrected.replacementId!)).item).toMatchObject({ source: 'manual', score: null, attempts: null, assignmentId: ids.assignment });
    const effective = await database().query('SELECT id FROM effective_knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [ids.tenant, ids.assignment]);
    expect(effective.rows.map((r) => r.id)).toEqual([corrected.replacementId]);
  });

  it('rejects fabricated manual grades and missing immutable provenance in the database', async () => {
    await expect(database().query(`INSERT INTO knowledge_evidence
      (tenant_id,course_version_id,delivery_source,completed_at,score,delivery_method,source_payload)
      VALUES ($1,$2,'manual',now(),100,'manual_record','{}')`, [ids.tenant, ids.course])).rejects.toThrow('manual_evidence_has_no_assessment_fields');
    await expect(database().query(`INSERT INTO knowledge_evidence
      (tenant_id,course_version_id,delivery_source,completed_at,delivery_method,source_payload)
      VALUES ($1,$2,'manual',now(),'manual_record','{}')`, [ids.tenant, ids.course])).rejects.toThrow('immutable provenance');
  });

  it('credits an explicitly linked manual record while retaining Moodle drift and authorization guards', async () => {
    const effective = await database().query<{ id: string }>(
      'SELECT id FROM effective_knowledge_evidence WHERE tenant_id=$1 AND assignment_id=$2', [ids.tenant, ids.assignment]);
    expect(effective.rows).toHaveLength(1);
    await decideAuthorization(admin, { assignmentId: ids.assignment, decision: 'authorized' });
    expect((await listAssignments(admin)).find((a) => a.id === ids.assignment)?.authorized).toBe(true);
    await database().query(`INSERT INTO integration_drifts (tenant_id,assignment_id,kind,details)
      VALUES ($1,$2,'completion_missing','{"reason":"Synthetic Moodle feed failure"}')`, [ids.tenant, ids.assignment]);
    const assignment = (await listAssignments(admin)).find((a) => a.id === ids.assignment);
    expect(assignment).toMatchObject({ knowledgeComplete: true, state: 'knowledge_complete',
      completionDrift: true, authorized: false });
    await expect(decideAuthorization(admin, { assignmentId: ids.assignment, decision: 'authorized' }))
      .rejects.toMatchObject({ status: 409 });
    await amendCompletion(admin, effective.rows[0].id, { kind: 'voided', reason: 'Synthetic manual evidence withdrawn' });
    expect((await listAssignments(admin)).find((a) => a.id === ids.assignment))
      .toMatchObject({ knowledgeComplete: false, completionDrift: true, authorized: false });
  });
});
