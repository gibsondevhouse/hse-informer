import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../src/lib/server/auth';
import { actorForSubject } from '../src/lib/server/auth';
import { database } from '../src/lib/server/db';
import { changeDueDate, createAssignments, listAssignments } from '../src/lib/server/assignments';
import { attestEvidence, attestationTarget, decideAuthorization, recordPracticalEvaluation, recordSiteTraining } from '../src/lib/server/compliance';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('PostgreSQL tenant isolation and evidence', () => {
  const ids = { tenantA: randomUUID(), tenantB: randomUUID(), siteA: randomUUID(), siteB: randomUUID(),
    personA: randomUUID(), personB: randomUUID(), principalA: randomUUID(), principalB: randomUUID(),
    requirementA: randomUUID(), requirementB: randomUUID(), versionA: randomUUID(), versionB: randomUUID(),
    assignmentA: randomUUID(), assignmentB: randomUUID() };
  const actorA: Actor = { id: ids.principalA, tenantId: ids.tenantA, tenantName: 'A', tenantSynthetic: true,
    personId: null, displayName: 'Admin A', role: 'tenant_admin', siteIds: [] };
  const actorB: Actor = { id: ids.principalB, tenantId: ids.tenantB, tenantName: 'B', tenantSynthetic: true,
    personId: null, displayName: 'Admin B', role: 'tenant_admin', siteIds: [] };

  beforeAll(async () => {
    const db = database();
    for (const [tenantId, label] of [[ids.tenantA,'A'],[ids.tenantB,'B']]) {
      await db.query('INSERT INTO tenants (id, slug, name, synthetic) VALUES ($1,$2,$3,true)',
        [tenantId, `test-${tenantId}`, `Synthetic ${label}`]);
    }
    for (const [tenantId, siteId, personId, principalId, requirementId, versionId, assignmentId, label] of [
      [ids.tenantA, ids.siteA, ids.personA, ids.principalA, ids.requirementA, ids.versionA, ids.assignmentA, 'A'],
      [ids.tenantB, ids.siteB, ids.personB, ids.principalB, ids.requirementB, ids.versionB, ids.assignmentB, 'B']
    ]) {
      await db.query('INSERT INTO sites (id, tenant_id, code, name, state_code) VALUES ($1,$2,$3,$4,$5)',
        [siteId, tenantId, label, `Site ${label}`, 'GA']);
      await db.query(`INSERT INTO people (id, tenant_id, display_name, person_type, synthetic)
        VALUES ($1,$2,$3,'employee',true)`, [personId, tenantId, `Learner ${label}`]);
      await db.query(`INSERT INTO principals (id, tenant_id, oidc_issuer, oidc_subject, role)
        VALUES ($1,$2,'synthetic-dev',$3,'tenant_admin')`, [principalId, tenantId, `admin-${label}`]);
      await db.query('INSERT INTO requirements (id, tenant_id, code, title) VALUES ($1,$2,$3,$4)',
        [requirementId, tenantId, `R-${label}`, `Requirement ${label}`]);
      await db.query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version, legal_status,
        authority, audience, site_overlay_requirement, content_digest)
        VALUES ($1,$2,$3,'draft','general_awareness','Unreviewed test','Test audience','Pending',repeat('a',64))`,
        [versionId, tenantId, requirementId]);
      await db.query('UPDATE requirements SET active_version_id = $3 WHERE tenant_id = $1 AND id = $2',
        [tenantId, requirementId, versionId]);
      await db.query(`INSERT INTO assignments (id, tenant_id, person_id, site_id, requirement_id,
        requirement_version_id, reason, trigger_kind, assigned_at, due_at, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,'Synthetic test','manual',
        '2026-09-30T00:00:00Z','2027-01-01T00:00:00Z',$7)`,
        [assignmentId, tenantId, personId, siteId, requirementId, versionId, principalId]);
    }
  });

  it('does not reveal another company in assignment reads', async () => {
    const a = await listAssignments(actorA, new Date('2026-10-11T00:00:00Z'));
    const b = await listAssignments(actorB, new Date('2026-10-11T00:00:00Z'));
    expect(a.map((item) => item.id)).toContain(ids.assignmentA);
    expect(a.map((item) => item.id)).not.toContain(ids.assignmentB);
    expect(b.map((item) => item.id)).toContain(ids.assignmentB);
    expect(b.map((item) => item.id)).not.toContain(ids.assignmentA);
  });

  it('rejects cross-company due-date changes', async () => {
    await expect(changeDueDate(actorB, ids.assignmentA, { dueAt: '2027-02-01T00:00:00Z' })).rejects.toMatchObject({ status: 404 });
  });

  it('scopes learner identity to issuer, subject, and site membership', async () => {
    const db = database();
    const issuer = `https://identity.test/${randomUUID()}`;
    const subject = randomUUID();
    await db.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id)
      VALUES ($1,$2,$3)`, [ids.tenantA, ids.personA, ids.siteA]);
    await db.query(`INSERT INTO principals (tenant_id, oidc_issuer, oidc_subject, person_id, role)
      VALUES ($1,$2,$3,$4,'learner')`, [ids.tenantA, issuer, subject, ids.personA]);
    const actor = await actorForSubject(issuer, subject);
    expect(actor?.personId).toBe(ids.personA);
    expect(actor?.siteIds).toEqual([ids.siteA]);
    expect(await actorForSubject(`${issuer}/other`, subject)).toBeNull();
    await db.query(`INSERT INTO principals (tenant_id, oidc_issuer, oidc_subject, person_id, role)
      VALUES ($1,$2,$3,$4,'learner')`, [ids.tenantB, issuer, subject, ids.personB]);
    expect(await actorForSubject(issuer, subject)).toBeNull();
  });

  it('rejects mutation of immutable evidence', async () => {
    const db = database();
    const courseId = randomUUID();
    await db.query(`INSERT INTO course_versions (id, tenant_id, requirement_version_id,
      deephow_content_id, deephow_version, package_sha256, export_format)
      VALUES ($1,$2,$3,'synthetic','draft',repeat('b',64),'unknown')`, [courseId, ids.tenantA, ids.versionA]);
    const evidenceId = randomUUID();
    await db.query(`INSERT INTO knowledge_evidence (id, tenant_id, assignment_id, course_version_id,
      moodle_course_id, moodle_user_id, moodle_timecompleted, delivery_method, source_payload)
      VALUES ($1,$2,$3,$4,42,17,'2026-10-10T00:00:00Z','synthetic-test','{}')`,
      [evidenceId, ids.tenantA, ids.assignmentA, courseId]);
    await expect(db.query(`UPDATE knowledge_evidence SET score = 100 WHERE id = $1`, [evidenceId]))
      .rejects.toThrow(/immutable evidence/);
  });

  it('records verified completion criteria before course approval and freezes them afterward', async () => {
    const db = database();
    const courseId = randomUUID();
    await db.query(`INSERT INTO course_versions (id, tenant_id, requirement_version_id,
      deephow_content_id, deephow_version, package_sha256, export_format)
      VALUES ($1,$2,$3,$4,'draft',repeat('d',64),'scorm_1_2')`,
    [courseId, ids.tenantA, ids.versionA, `synthetic-${courseId}`]);
    await db.query(`UPDATE course_versions SET moodle_course_id = 42,
      completion_criteria_verified = true,
      completion_verification_note = 'Synthetic criteria inspection only'
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, courseId]);
    await db.query(`UPDATE course_versions SET review_status = 'approved',
      reviewed_by = 'Synthetic reviewer', reviewed_at = now()
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, courseId]);
    await expect(db.query(`UPDATE course_versions
      SET completion_verification_note = 'Changed after approval'
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, courseId]))
      .rejects.toThrow(/reviewed versions cannot be changed/);
  });

  it('refuses to assign a synthetic person inside a non-synthetic tenant', async () => {
    const db = database();
    const tenantId = randomUUID();
    const siteId = randomUUID();
    const personId = randomUUID();
    const principalId = randomUUID();
    const requirementId = randomUUID();
    const versionId = randomUUID();
    await db.query(`INSERT INTO tenants (id, slug, name, synthetic)
      VALUES ($1,$2,'Live-boundary test',false)`, [tenantId, `live-${tenantId}`]);
    await db.query(`INSERT INTO sites (id, tenant_id, code, name, state_code)
      VALUES ($1,$2,'test','Test site','GA')`, [siteId, tenantId]);
    await db.query(`INSERT INTO people (id, tenant_id, display_name, person_type, synthetic)
      VALUES ($1,$2,'Synthetic worker','employee',true)`, [personId, tenantId]);
    await db.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id)
      VALUES ($1,$2,$3)`, [tenantId, personId, siteId]);
    await db.query(`INSERT INTO principals (id, tenant_id, oidc_issuer, oidc_subject, role)
      VALUES ($1,$2,'synthetic-test',$3,'tenant_admin')`, [principalId, tenantId, principalId]);
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,'approved-test','Approved synthetic test')`, [requirementId, tenantId]);
    await db.query(`INSERT INTO requirement_versions
      (id, tenant_id, requirement_id, version, legal_status, authority, audience,
       site_overlay_requirement, content_digest, authorization_prerequisites,
       review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'v1','general_awareness','Synthetic test','Synthetic workers',
        'Not needed',repeat('e',64),'["knowledge"]','approved','Synthetic reviewer',now())`,
    [versionId, tenantId, requirementId]);
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [tenantId, requirementId, versionId]);
    await db.query(`INSERT INTO course_versions
      (tenant_id, requirement_version_id, deephow_content_id, deephow_version,
       package_sha256, export_format, moodle_course_id, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'v1',repeat('f',64),'scorm_1_2',42,
        'approved','Synthetic reviewer',now())`, [tenantId, versionId, `synthetic-${randomUUID()}`]);
    const actor: Actor = { id: principalId, tenantId, tenantName: 'Live-boundary test',
      tenantSynthetic: false, personId: null, displayName: 'Synthetic admin', role: 'tenant_admin', siteIds: [] };
    await expect(createAssignments(actor, { personIds: [personId], siteId, requirementId,
      dueAt: '2027-01-01T00:00:00Z', reason: 'Synthetic boundary check' }))
      .rejects.toMatchObject({ status: 400 });
    await expect(db.query(`INSERT INTO assignments
      (tenant_id, person_id, site_id, requirement_id, requirement_version_id,
       reason, trigger_kind, due_at)
      VALUES ($1,$2,$3,$4,$5,'Bypassed service','manual','2027-01-01T00:00:00Z')`,
    [tenantId, personId, siteId, requirementId, versionId]))
      .rejects.toThrow(/synthetic person cannot be assigned/);
    const assignments = await db.query(`SELECT 1 FROM assignments
      WHERE tenant_id = $1 AND person_id = $2`, [tenantId, personId]);
    expect(assignments.rowCount).toBe(0);
  });

  it('keeps assignment identity and pinned versions immutable while allowing audited due-date edits', async () => {
    const db = database();
    await expect(db.query(`UPDATE assignments SET site_id = $2 WHERE id = $1`,
      [ids.assignmentA, ids.siteB])).rejects.toThrow(/assignment identity and pinned versions/);
    await expect(db.query(`UPDATE assignments SET requirement_version_id = $2 WHERE id = $1`,
      [ids.assignmentA, ids.versionB])).rejects.toThrow(/assignment identity and pinned versions/);
    await expect(db.query(`DELETE FROM assignments WHERE id = $1`, [ids.assignmentA]))
      .rejects.toThrow(/assignment decisions cannot be deleted/);
    await changeDueDate(actorA, ids.assignmentA, { dueAt: '2027-02-01T00:00:00Z' });
  });

  it('withdraws current authorization when a later clearance revokes it', async () => {
    const db = database();
    const requirementId = randomUUID();
    const versionId = randomUUID();
    const assignmentId = randomUUID();
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,$3,'Synthetic medical gate')`,
    [requirementId, ids.tenantA, `medical-${requirementId}`]);
    await db.query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version, legal_status,
      authority, audience, site_overlay_requirement, content_digest, authorization_prerequisites,
      review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'medical-gate','general_awareness','Test only','Test audience','Pending',
      repeat('c',64),'["medical"]','approved','Synthetic test reviewer',now())`,
      [versionId, ids.tenantA, requirementId]);
    await db.query(`INSERT INTO assignments (id, tenant_id, person_id, site_id, requirement_id,
      requirement_version_id, reason, trigger_kind, assigned_at, due_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,'Synthetic medical gate','manual',
      '2026-09-30T00:00:00Z','2027-01-01T00:00:00Z',$7)`,
    [assignmentId, ids.tenantA, ids.personA, ids.siteA, requirementId, versionId, ids.principalA]);
    const firstClearance = await db.query<{ id: string }>(`INSERT INTO clearance_statuses
      (tenant_id, person_id, requirement_id, kind, cleared, effective_at, recorded_by)
      VALUES ($1,$2,$3,'medical',true,'2026-10-01T00:00:00Z',$4) RETURNING id`,
      [ids.tenantA, ids.personA, requirementId, ids.principalA]);
    await decideAuthorization(actorA, { assignmentId, decision: 'authorized' },
      new Date('2026-10-02T00:00:00Z'));
    const recorded = await db.query<{ prerequisite_evidence: { medical: string } }>(
      `SELECT prerequisite_evidence FROM authorizations WHERE tenant_id = $1 AND assignment_id = $2`,
      [ids.tenantA, assignmentId]);
    expect(recorded.rows[0].prerequisite_evidence.medical).toBe(firstClearance.rows[0].id);
    const before = await listAssignments(actorA, new Date('2026-10-11T00:00:00Z'));
    expect(before.find((item) => item.id === assignmentId)?.authorized).toBe(true);
    await db.query(`INSERT INTO clearance_statuses
      (tenant_id, person_id, requirement_id, kind, cleared, effective_at, recorded_by)
      VALUES ($1,$2,$3,'medical',false,'2026-10-10T00:00:00Z',$4)`,
      [ids.tenantA, ids.personA, requirementId, ids.principalA]);
    const after = await listAssignments(actorA, new Date('2026-10-11T00:00:00Z'));
    expect(after.find((item) => item.id === assignmentId)?.authorized).toBe(false);
    await db.query(`INSERT INTO clearance_statuses
      (tenant_id, person_id, requirement_id, kind, cleared, effective_at, recorded_by)
      VALUES ($1,$2,$3,'medical',true,'2026-10-12T00:00:00Z',$4)`,
      [ids.tenantA, ids.personA, requirementId, ids.principalA]);
    const recovered = await listAssignments(actorA, new Date('2026-10-13T00:00:00Z'));
    expect(recovered.find((item) => item.id === assignmentId)?.authorized).toBe(false);
    await decideAuthorization(actorA, { assignmentId, decision: 'authorized' },
      new Date('2026-10-13T00:00:00Z'));
    const reauthorized = await listAssignments(actorA, new Date('2026-10-13T00:00:00Z'));
    expect(reauthorized.find((item) => item.id === assignmentId)?.authorized).toBe(true);
  });

  it('requires the assigned worker to acknowledge site evidence before authorization', async () => {
    const db = database();
    const personId = randomUUID();
    const workerId = randomUUID();
    const requirementId = randomUUID();
    const versionId = randomUUID();
    const addendumId = randomUUID();
    const assignmentId = randomUUID();
    const worker: Actor = { id: workerId, tenantId: ids.tenantA, tenantName: 'A', tenantSynthetic: true,
      personId, displayName: 'Synthetic Worker', role: 'learner', siteIds: [ids.siteA] };
    await db.query(`INSERT INTO people (id, tenant_id, display_name, person_type, synthetic)
      VALUES ($1,$2,'Synthetic Worker','employee',true)`, [personId, ids.tenantA]);
    await db.query(`INSERT INTO principals (id, tenant_id, oidc_issuer, oidc_subject, person_id, role)
      VALUES ($1,$2,'synthetic-dev',$3,$4,'learner')`, [workerId, ids.tenantA, `worker-${workerId}`, personId]);
    await db.query('INSERT INTO requirements (id, tenant_id, code, title) VALUES ($1,$2,$3,$4)',
      [requirementId, ids.tenantA, `ACK-${requirementId}`, 'Synthetic site training']);
    await db.query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version,
      legal_status, authority, audience, site_overlay_requirement, content_digest,
      authorization_prerequisites, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'test','general_awareness','Synthetic test only','Synthetic workers',
      'Required',repeat('d',64),'["site"]','approved','Synthetic test reviewer',now())`,
    [versionId, ids.tenantA, requirementId]);
    await db.query(`INSERT INTO site_addendum_versions (id, tenant_id, site_id, requirement_id,
      version, title, content_sha256, content_uri, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'test','Synthetic addendum',repeat('e',64),
      'synthetic://site-addendum','approved','Synthetic test reviewer',now())`,
    [addendumId, ids.tenantA, ids.siteA, requirementId]);
    await db.query(`INSERT INTO assignments (id, tenant_id, person_id, site_id, requirement_id,
      requirement_version_id, site_addendum_version_id, reason, trigger_kind, due_at, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Synthetic attestation test','manual',
      '2027-01-01T00:00:00Z',$8)`,
    [assignmentId, ids.tenantA, personId, ids.siteA, requirementId, versionId, addendumId, ids.principalA]);

    const evidenceId = await recordSiteTraining(actorA, {
      assignmentId, completedAt: '2026-10-10T00:00:00Z'
    });
    await expect(decideAuthorization(actorA, { assignmentId, decision: 'authorized' }))
      .rejects.toMatchObject({ status: 409 });
    await expect(attestationTarget(actorA, 'site_training', evidenceId))
      .rejects.toMatchObject({ status: 403 });
    const target = await attestationTarget(worker, 'site_training', evidenceId);
    await expect(attestEvidence(actorA, { targetKind: 'site_training', targetId: evidenceId,
      recordSha256: target.recordSha256, acknowledged: true }))
      .rejects.toMatchObject({ status: 403 });
    await attestEvidence(worker, { targetKind: 'site_training', targetId: evidenceId,
      recordSha256: target.recordSha256, acknowledged: true });
    const authorizationId = await decideAuthorization(actorA, { assignmentId, decision: 'authorized' });
    expect(authorizationId).toBeTruthy();
    const assignments = await listAssignments(actorA);
    expect(assignments.find((item) => item.id === assignmentId)?.authorized).toBe(true);
  });

  it('pins an approved site addendum and links a new event assignment to its predecessor', async () => {
    const db = database();
    const requirementId = randomUUID();
    const versionId = randomUUID();
    const courseId = randomUUID();
    const addendumId = randomUUID();
    await db.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id)
      VALUES ($1,$2,$3)`, [ids.tenantA, ids.personA, ids.siteA]);
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,$3,'Synthetic site assignment')`, [requirementId, ids.tenantA, `SITE-${requirementId}`]);
    await db.query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version,
      legal_status, authority, audience, site_overlay_requirement, content_digest,
      authorization_prerequisites, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'approved-test','general_awareness','Synthetic test only','Synthetic workers',
      'Required',repeat('a',64),'["site"]','approved','Synthetic test reviewer',now())`,
      [versionId, ids.tenantA, requirementId]);
    await db.query(`UPDATE requirements SET active_version_id = $3 WHERE tenant_id = $1 AND id = $2`,
      [ids.tenantA, requirementId, versionId]);
    await db.query(`INSERT INTO course_versions (id, tenant_id, requirement_version_id,
      deephow_content_id, deephow_version, package_sha256, export_format,
      moodle_course_id, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'test',repeat('b',64),'scorm_1_2',42,
      'approved','Synthetic test reviewer',now())`,
      [courseId, ids.tenantA, versionId, `synthetic-${courseId}`]);
    const input = { personIds: [ids.personA], siteId: ids.siteA, requirementId,
      dueAt: '2027-02-01T00:00:00Z', reason: 'Synthetic site trigger',
      triggerKind: 'event', triggerRef: 'equipment-change-001' };
    await expect(createAssignments(actorA, input)).rejects.toMatchObject({ status: 409 });
    await db.query(`INSERT INTO site_addendum_versions (id, tenant_id, site_id, requirement_id,
      version, title, content_sha256, content_uri, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'test','Synthetic addendum',repeat('c',64),
      'synthetic://site-addendum','approved','Synthetic test reviewer',now())`,
      [addendumId, ids.tenantA, ids.siteA, requirementId]);
    const first = await createAssignments(actorA, input);
    expect(first.created).toHaveLength(1);
    expect(await createAssignments(actorA, input)).toEqual({ created: [], skipped: [ids.personA] });
    const next = await createAssignments(actorA, { ...input, triggerRef: 'equipment-change-002' });
    expect(next.created).toHaveLength(1);
    const rows = await db.query<{ id: string; site_addendum_version_id: string;
      supersedes_assignment_id: string | null; cancelled_at: Date | null }>(
      `SELECT id, site_addendum_version_id, supersedes_assignment_id, cancelled_at
       FROM assignments WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [ids.tenantA, [...first.created, ...next.created]]);
    const original = rows.rows.find((row) => row.id === first.created[0]);
    const replacement = rows.rows.find((row) => row.id === next.created[0]);
    expect(original?.cancelled_at).not.toBeNull();
    expect(replacement).toMatchObject({ site_addendum_version_id: addendumId,
      supersedes_assignment_id: first.created[0], cancelled_at: null });
  });

  it('rejects future evidence and expired evaluator qualification at signing', async () => {
    const db = database();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const evaluatorId = randomUUID();
    const checklistId = randomUUID();
    const evaluator: Actor = { id: evaluatorId, tenantId: ids.tenantA, tenantName: 'A', tenantSynthetic: true,
      personId: null, displayName: 'Synthetic evaluator', role: 'evaluator', siteIds: [ids.siteA] };
    await db.query(`INSERT INTO principals (id, tenant_id, oidc_issuer, oidc_subject, role)
      VALUES ($1,$2,'synthetic-dev',$3,'evaluator')`, [evaluatorId, ids.tenantA, `evaluator-${evaluatorId}`]);
    await db.query(`INSERT INTO practical_checklist_versions (id, tenant_id, requirement_id, site_id,
      version, checklist, content_sha256, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'test',$5::jsonb,repeat('d',64),'approved','Synthetic reviewer',now())`,
      [checklistId, ids.tenantA, ids.requirementA, ids.siteA,
        JSON.stringify({ items: [{ id: 'seal-check' }] })]);
    await db.query(`INSERT INTO evaluator_qualifications (tenant_id, evaluator_principal_id,
      requirement_id, site_id, valid_from, valid_until, evidence_uri, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,'synthetic://expired',$7)`,
      [ids.tenantA, evaluatorId, ids.requirementA, ids.siteA, yesterday, oneHourAgo, ids.principalA]);
    await expect(recordSiteTraining(actorA, { assignmentId: ids.assignmentA,
      completedAt: tomorrow.toISOString() }, now)).rejects.toMatchObject({ status: 400 });
    const input = { assignmentId: ids.assignmentA, checklistVersionId: checklistId,
      evaluatedAt: yesterday.toISOString(), passed: true, results: { 'seal-check': 'pass' } };
    await expect(recordPracticalEvaluation(evaluator, { ...input,
      evaluatedAt: tomorrow.toISOString() }, now)).rejects.toMatchObject({ status: 400 });
    await expect(recordPracticalEvaluation(evaluator, input, now)).rejects.toMatchObject({ status: 403 });
    await db.query(`INSERT INTO evaluator_qualifications (tenant_id, evaluator_principal_id,
      requirement_id, site_id, valid_from, valid_until, evidence_uri, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,'synthetic://current',$7)`,
      [ids.tenantA, evaluatorId, ids.requirementA, ids.siteA, yesterday, tomorrow, ids.principalA]);
    expect(await recordPracticalEvaluation(evaluator, input, now)).toBeTruthy();
  });
});
