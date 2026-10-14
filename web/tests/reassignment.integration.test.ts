import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../src/lib/server/auth';
import { auditPacket } from '../src/lib/server/compliance';
import { database } from '../src/lib/server/db';
import { processChangeEvent, processDueChangeEvents, processDueRecurrences,
  recordChangeEvent, recordTrainingContext } from '../src/lib/server/reassignment';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('reviewed event and recurrence reassignment', () => {
  const ids = { tenantA: randomUUID(), tenantB: randomUUID(), ocilla: randomUUID(),
    tifton: randomUUID(), otherSite: randomUUID(), reviewerA: randomUUID(), reviewerB: randomUUID(),
    workerA: randomUUID(), workerB: randomUUID(), workerNoContext: randomUUID(),
    workerTifton: randomUUID(), workerOtherTenant: randomUUID() };
  const reviewerA: Actor = { id: ids.reviewerA, tenantId: ids.tenantA, tenantName: 'Synthetic A',
    tenantSynthetic: true, personId: null, displayName: 'Synthetic HSE reviewer A',
    role: 'hse_reviewer', siteIds: [] };
  const reviewerB: Actor = { id: ids.reviewerB, tenantId: ids.tenantB, tenantName: 'Synthetic B',
    tenantSynthetic: true, personId: null, displayName: 'Synthetic HSE reviewer B',
    role: 'hse_reviewer', siteIds: [] };
  const requirement = { id: '', version: '', course: '' };

  async function approvedRequirement(code: string, recurrence: unknown,
    triggers: string[]): Promise<{ id: string; version: string; course: string }> {
    const db = database();
    const item = { id: randomUUID(), version: randomUUID(), course: randomUUID() };
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,$3,$4)`, [item.id, ids.tenantA, code, `Synthetic ${code}`]);
    await db.query(`INSERT INTO requirement_versions
      (id, tenant_id, requirement_id, version, legal_status, authority, audience,
       applicability, recurrence, retraining_triggers, authorization_prerequisites,
       site_overlay_requirement, content_digest, review_status, reviewed_by,
       reviewed_at, effective_at)
      VALUES ($1,$2,$3,'synthetic-test','general_awareness','Synthetic test only',
        'Synthetic test audience',$4::jsonb,$5::jsonb,$6::jsonb,'["knowledge"]',
        'Not needed in synthetic test',repeat('a',64),'approved',
        'Synthetic test reviewer',now(),'2024-01-01T00:00:00Z')`,
    [item.version, ids.tenantA, item.id, JSON.stringify({ roles: ['press_operator'] }),
      JSON.stringify(recurrence), JSON.stringify(triggers)]);
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, item.id, item.version]);
    await db.query(`INSERT INTO course_versions
      (id, tenant_id, requirement_version_id, deephow_content_id, deephow_version,
       package_sha256, export_format, moodle_course_id, review_status,
       reviewed_by, reviewed_at, effective_at,
       completion_criteria_verified, completion_verification_note)
      VALUES ($1,$2,$3,$4,'synthetic-test',repeat('b',64),'scorm_1_2',42,
        'approved','Synthetic test reviewer',now(),'2024-01-01T00:00:00Z',
        true,'Synthetic completion semantics for engine test only')`,
    [item.course, ids.tenantA, item.version, `synthetic-${item.course}`]);
    return item;
  }

  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants (id, slug, name, synthetic)
      VALUES ($1,$2,'Synthetic A',true),($3,$4,'Synthetic B',true)`,
    [ids.tenantA, `reassign-a-${ids.tenantA}`, ids.tenantB, `reassign-b-${ids.tenantB}`]);
    for (const [tenantId, siteId, code] of [
      [ids.tenantA, ids.ocilla, 'ocilla'], [ids.tenantA, ids.tifton, 'tifton'],
      [ids.tenantB, ids.otherSite, 'ocilla']
    ]) {
      await db.query(`INSERT INTO sites (id, tenant_id, code, name, state_code)
        VALUES ($1,$2,$3,$3,'GA')`, [siteId, tenantId, code]);
    }
    for (const [tenantId, principalId] of [[ids.tenantA, ids.reviewerA],
      [ids.tenantB, ids.reviewerB]]) {
      await db.query(`INSERT INTO principals
        (id, tenant_id, oidc_issuer, oidc_subject, role)
        VALUES ($1,$2,'synthetic-test',$3,'hse_reviewer')`,
      [principalId, tenantId, principalId]);
    }
    for (const [tenantId, personId, siteId, label] of [
      [ids.tenantA, ids.workerA, ids.ocilla, 'A'],
      [ids.tenantA, ids.workerB, ids.ocilla, 'B'],
      [ids.tenantA, ids.workerNoContext, ids.ocilla, 'No context'],
      [ids.tenantA, ids.workerTifton, ids.tifton, 'Tifton'],
      [ids.tenantB, ids.workerOtherTenant, ids.otherSite, 'Other company']
    ]) {
      await db.query(`INSERT INTO people (id, tenant_id, display_name, person_type, synthetic)
        VALUES ($1,$2,$3,'employee',true)`, [personId, tenantId, label]);
      await db.query(`INSERT INTO person_site_memberships
        (tenant_id, person_id, site_id, effective_at)
        VALUES ($1,$2,$3,'2024-01-01T00:00:00Z')`, [tenantId, personId, siteId]);
    }
    for (const [personId, siteId, equipment] of [
      [ids.workerA, ids.ocilla, 'press-a'],
      [ids.workerB, ids.ocilla, 'press-b'],
      [ids.workerTifton, ids.tifton, 'press-a']
    ]) {
      await recordTrainingContext(reviewerA, { personId, siteId,
        effectiveAt: '2024-01-02T00:00:00Z', sourceReference: 'synthetic://reviewed-context',
        context: { personType: 'employee', roles: ['press_operator'], equipment: [equipment] } });
    }
    Object.assign(requirement, await approvedRequirement(`procedure-${randomUUID()}`,
      { kind: 'event_only' }, ['procedure_change']));
  });

  it('targets only the affected site and context, keeps review decisions, and retries safely', async () => {
    const eventInput = { sourceKey: `procedure-${randomUUID()}`, siteId: ids.ocilla,
      requirementId: requirement.id, eventKind: 'procedure_change',
      scope: { equipment: ['press-a'] }, reason: 'Synthetic Ocilla procedure version changed',
      sourceReference: 'synthetic://procedure/v2',
      occurredAt: '2026-10-01T00:00:00Z', effectiveAt: '2026-10-01T00:00:00Z',
      dueAt: '2026-11-01T00:00:00Z' };
    const eventId = await recordChangeEvent(reviewerA, eventInput);
    expect(await recordChangeEvent(reviewerA, eventInput)).toBe(eventId);
    await expect(recordChangeEvent(reviewerA, { ...eventInput, reason: 'Changed replay payload' }))
      .rejects.toMatchObject({ status: 409 });
    await expect(processChangeEvent(reviewerB, eventId,
      new Date('2026-10-11T00:00:00Z'))).rejects.toMatchObject({ status: 404 });
    const first = await processChangeEvent(reviewerA, eventId,
      new Date('2026-10-11T00:00:00Z'));
    expect(first).toEqual({ required: 1, notRequired: 1, needsReview: 1, skipped: 0 });
    const retry = await processChangeEvent(reviewerA, eventId,
      new Date('2026-10-11T00:00:00Z'));
    expect(retry).toEqual({ required: 0, notRequired: 0, needsReview: 0, skipped: 3 });
    const db = database();
    const decisions = await db.query<{ person_id: string; decision: string; assignment_id: string | null;
      input_snapshot: { contextVersionId: string | null } }>(
      `SELECT person_id, decision, assignment_id, input_snapshot
       FROM reassignment_decisions WHERE tenant_id = $1 AND event_id = $2`,
      [ids.tenantA, eventId]);
    expect(decisions.rows).toHaveLength(3);
    expect(decisions.rows.find((row) => row.person_id === ids.workerA)?.decision).toBe('required');
    expect(decisions.rows.find((row) => row.person_id === ids.workerB)?.decision).toBe('not_required');
    expect(decisions.rows.find((row) => row.person_id === ids.workerNoContext)).toMatchObject({
      decision: 'needs_review', assignment_id: null,
      input_snapshot: { contextVersionId: null }
    });
    expect(decisions.rows.some((row) => row.person_id === ids.workerTifton
      || row.person_id === ids.workerOtherTenant)).toBe(false);
    const packet = await auditPacket(reviewerA, ids.workerA, requirement.id);
    expect(packet.reassignmentDecisions.some((row) => row.event_id === eventId
      && row.decision === 'required')).toBe(true);
    const foreignPacket = await auditPacket(reviewerB, ids.workerA, requirement.id);
    expect(foreignPacket.assignments).toHaveLength(0);
    expect(foreignPacket.reassignmentDecisions).toHaveLength(0);
    const assignmentId = decisions.rows.find((row) => row.person_id === ids.workerA)?.assignment_id;
    expect(assignmentId).toBeTruthy();
    const outbox = await db.query(`SELECT 1 FROM integration_outbox
      WHERE tenant_id = $1 AND kind = 'moodle_enrol' AND aggregate_id = $2`,
    [ids.tenantA, assignmentId]);
    expect(outbox.rowCount).toBe(1);
    const evidence = await db.query(`SELECT 1 FROM knowledge_evidence
      WHERE tenant_id = $1 AND assignment_id = $2`, [ids.tenantA, assignmentId]);
    expect(evidence.rowCount).toBe(0);
    const authorization = await db.query(`SELECT 1 FROM authorizations
      WHERE tenant_id = $1 AND assignment_id = $2`, [ids.tenantA, assignmentId]);
    expect(authorization.rowCount).toBe(0);

    const contextId = await recordTrainingContext(reviewerA, {
      personId: ids.workerNoContext, siteId: ids.ocilla,
      effectiveAt: '2026-10-02T00:00:00Z', sourceReference: 'synthetic://late-review',
      context: { roles: ['press_operator'], equipment: ['press-a'] }
    });
    await expect(db.query(`UPDATE person_training_context_versions
      SET source_reference = 'changed' WHERE id = $1`, [contextId]))
      .rejects.toThrow(/immutable evidence/);
    const reviewed = await processChangeEvent(reviewerA, eventId,
      new Date('2026-10-11T00:00:00Z'));
    expect(reviewed).toEqual({ required: 1, notRequired: 0, needsReview: 0, skipped: 2 });
    const allDecisions = await db.query(`SELECT 1 FROM reassignment_decisions
      WHERE tenant_id = $1 AND event_id = $2`, [ids.tenantA, eventId]);
    expect(allDecisions.rowCount).toBe(4);
  });

  it('creates linked replacements and an outbox entry for a second procedure change', async () => {
    const db = database();
    const before = await db.query<{ id: string }>(`SELECT id FROM assignments
      WHERE tenant_id = $1 AND person_id = $2 AND requirement_id = $3 AND cancelled_at IS NULL`,
    [ids.tenantA, ids.workerA, requirement.id]);
    expect(before.rowCount).toBe(1);
    const eventId = await recordChangeEvent(reviewerA, {
      sourceKey: `procedure-${randomUUID()}`, siteId: ids.ocilla,
      requirementId: requirement.id, eventKind: 'procedure_change',
      scope: { equipment: ['press-a'] }, reason: 'Synthetic Ocilla procedure version changed again',
      sourceReference: 'synthetic://procedure/v3',
      occurredAt: '2026-10-12T00:00:00Z', effectiveAt: '2026-10-12T00:00:00Z',
      dueAt: '2026-11-12T00:00:00Z'
    });
    expect(await processChangeEvent(reviewerA, eventId,
      new Date('2026-10-13T00:00:00Z'))).toMatchObject({ required: 2 });
    const after = await db.query<{ id: string; supersedes_assignment_id: string;
      course_version_id: string; cancelled_at: Date | null }>(`SELECT a.* FROM assignments a
      WHERE a.tenant_id = $1 AND a.person_id = $2 AND a.requirement_id = $3
      ORDER BY a.assigned_at DESC, a.id DESC`, [ids.tenantA, ids.workerA, requirement.id]);
    const current = after.rows.find((row) => !row.cancelled_at);
    expect(current?.supersedes_assignment_id).toBe(before.rows[0].id);
    expect(current?.course_version_id).toBe(requirement.course);
    expect(after.rows.find((row) => row.id === before.rows[0].id)?.cancelled_at).not.toBeNull();
    const outbox = await db.query(`SELECT 1 FROM integration_outbox
      WHERE tenant_id = $1 AND kind = 'moodle_enrol' AND aggregate_id = $2`,
    [ids.tenantA, current?.id]);
    expect(outbox.rowCount).toBe(1);
    const audit = await db.query(`SELECT action FROM audit_log
      WHERE tenant_id = $1 AND entity_id = $2`, [ids.tenantA, current?.id]);
    expect(audit.rows.some((row) => row.action === 'assignment.created_by_reassignment')).toBe(true);
  });

  it('dispatches a future-dated change once it becomes effective', async () => {
    const eventId = await recordChangeEvent(reviewerA, {
      sourceKey: `scheduled-${randomUUID()}`, siteId: ids.ocilla,
      requirementId: requirement.id, eventKind: 'procedure_change',
      scope: { equipment: ['press-b'] }, reason: 'Synthetic future Ocilla procedure change',
      sourceReference: 'synthetic://procedure/future',
      occurredAt: '2026-10-19T00:00:00Z', effectiveAt: '2026-10-20T00:00:00Z',
      dueAt: '2026-11-20T00:00:00Z'
    });
    expect(await processDueChangeEvents(ids.tenantA,
      new Date('2026-10-19T00:00:00Z'))).toMatchObject({ events: 0 });
    const dispatched = await processDueChangeEvents(ids.tenantA,
      new Date('2026-10-20T00:00:00Z'));
    expect(dispatched.events).toBe(1);
    expect(dispatched.decisions.required).toBe(1);
    expect(await processDueChangeEvents(ids.tenantA,
      new Date('2026-10-20T00:00:00Z'))).toMatchObject({ events: 0 });
    const rows = await database().query<{ person_id: string; decision: string }>(
      `SELECT person_id, decision FROM reassignment_decisions
       WHERE tenant_id = $1 AND event_id = $2`, [ids.tenantA, eventId]);
    expect(rows.rows.find((row) => row.person_id === ids.workerB)?.decision).toBe('required');
    expect(rows.rows.find((row) => row.person_id === ids.workerTifton)).toBeUndefined();
  });

  it('records a blocked event and continues to the next due event', async () => {
    const db = database();
    const blocked = await approvedRequirement(`blocked-event-${randomUUID()}`,
      { kind: 'event_only' }, ['procedure_change']);
    const good = await approvedRequirement(`good-event-${randomUUID()}`,
      { kind: 'event_only' }, ['procedure_change']);
    const event = (requirementId: string, suffix: string, effectiveAt: string) => ({
      sourceKey: `queued-${suffix}-${randomUUID()}`, siteId: ids.ocilla,
      requirementId, eventKind: 'procedure_change',
      scope: { equipment: ['press-b'] }, reason: `Synthetic ${suffix} procedure change`,
      sourceReference: `synthetic://procedure/${suffix}`,
      occurredAt: effectiveAt, effectiveAt, dueAt: '2026-11-01T00:00:00Z'
    });
    const blockedId = await recordChangeEvent(reviewerA,
      event(blocked.id, 'blocked', '2026-10-05T00:00:00Z'));
    const goodId = await recordChangeEvent(reviewerA,
      event(good.id, 'good', '2026-10-06T00:00:00Z'));
    const draft = randomUUID();
    await db.query(`INSERT INTO requirement_versions
      (id, tenant_id, requirement_id, version, legal_status, authority, audience,
       site_overlay_requirement, content_digest)
      VALUES ($1,$2,$3,'unapproved-change','general_awareness',
        'Synthetic draft','Synthetic','Synthetic',repeat('e',64))`,
    [draft, ids.tenantA, blocked.id]);
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, blocked.id, draft]);
    const first = await processDueChangeEvents(ids.tenantA,
      new Date('2026-10-10T00:00:00Z'), 1);
    expect(first).toMatchObject({ events: 1, failures: 1,
      decisions: { required: 1 } });
    const failure = await db.query<{ resolved_at: Date | null }>(
      `SELECT resolved_at FROM training_change_event_failures
       WHERE tenant_id = $1 AND event_id = $2`, [ids.tenantA, blockedId]);
    expect(failure.rows[0]?.resolved_at).toBeNull();
    const goodDecision = await db.query(`SELECT 1 FROM reassignment_decisions
      WHERE tenant_id = $1 AND event_id = $2 AND person_id = $3 AND decision = 'required'`,
    [ids.tenantA, goodId, ids.workerB]);
    expect(goodDecision.rowCount).toBe(1);
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, blocked.id, blocked.version]);
    const recovered = await processDueChangeEvents(ids.tenantA,
      new Date('2026-10-10T00:00:00Z'), 1);
    expect(recovered).toMatchObject({ events: 1, failures: 0 });
    const resolved = await db.query<{ resolved_at: Date | null }>(
      `SELECT resolved_at FROM training_change_event_failures
       WHERE tenant_id = $1 AND event_id = $2`, [ids.tenantA, blockedId]);
    expect(resolved.rows[0]?.resolved_at).not.toBeNull();
  });

  it('creates annual and three-year cycles at their exact dates, then stays idempotent', async () => {
    const db = database();
    const annual = await approvedRequirement(`annual-${randomUUID()}`,
      { kind: 'annual' }, []);
    const threeYear = await approvedRequirement(`three-year-${randomUUID()}`,
      { kind: 'three_year' }, []);
    const sources: Array<{ requirement: typeof annual; completion: string; due: string }> = [
      { requirement: annual, completion: '2024-02-29T10:30:00Z', due: '2025-02-28T10:30:00Z' },
      { requirement: threeYear, completion: '2024-03-15T10:30:00Z', due: '2027-03-15T10:30:00Z' }
    ];
    for (const source of sources) {
      const assignmentId = randomUUID();
      await db.query(`INSERT INTO assignments
        (id, tenant_id, person_id, site_id, requirement_id, requirement_version_id,
         course_version_id, reason, trigger_kind, assigned_at, due_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'Synthetic source completion','manual',
          '2024-01-01T00:00:00Z','2024-12-31T00:00:00Z')`,
      [assignmentId, ids.tenantA, ids.workerA, ids.ocilla, source.requirement.id,
        source.requirement.version, source.requirement.course]);
      await db.query(`INSERT INTO knowledge_evidence
        (tenant_id, assignment_id, course_version_id, moodle_course_id,
         moodle_user_id, moodle_timecompleted, delivery_method, source_payload)
        VALUES ($1,$2,$3,42,17,$4,'synthetic-time-shift-test',$5::jsonb)`,
      [ids.tenantA, assignmentId, source.requirement.course, source.completion,
        JSON.stringify({ synthetic: true, noProductionEvidence: true })]);
    }
    const before = await processDueRecurrences(ids.tenantA,
      new Date('2025-01-29T10:29:59Z'));
    expect(before.required).toBe(0);
    const annualRun = await processDueRecurrences(ids.tenantA,
      new Date('2025-01-29T10:30:00Z'));
    expect(annualRun.required).toBe(1);
    const annualAssignments = await db.query<{ due_at: Date; trigger_ref: string;
      supersedes_assignment_id: string }>(`SELECT due_at, trigger_ref, supersedes_assignment_id
      FROM assignments WHERE tenant_id = $1 AND requirement_id = $2 AND trigger_kind = 'recurrence'`,
    [ids.tenantA, annual.id]);
    expect(annualAssignments.rowCount).toBe(1);
    expect(annualAssignments.rows[0].due_at.toISOString()).toBe('2025-02-28T10:30:00.000Z');
    expect(annualAssignments.rows[0].trigger_ref).toMatch(/^recurrence:/);
    const repeat = await processDueRecurrences(ids.tenantA,
      new Date('2025-01-29T10:30:00Z'));
    expect(repeat.required).toBe(0);
    const threeYearRun = await processDueRecurrences(ids.tenantA,
      new Date('2027-02-13T10:30:00Z'));
    expect(threeYearRun.required).toBe(1);
    const threeYearAssignments = await db.query<{ due_at: Date }>(`SELECT due_at FROM assignments
      WHERE tenant_id = $1 AND requirement_id = $2 AND trigger_kind = 'recurrence'`,
    [ids.tenantA, threeYear.id]);
    expect(threeYearAssignments.rowCount).toBe(1);
    expect(threeYearAssignments.rows[0].due_at.toISOString()).toBe('2027-03-15T10:30:00.000Z');
  });

  it('scans past more than one page of not-yet-due completions', async () => {
    const db = database();
    const farFuture = await approvedRequirement(`far-future-${randomUUID()}`,
      { kind: 'three_year' }, []);
    const dueSoon = await approvedRequirement(`due-soon-${randomUUID()}`,
      { kind: 'annual' }, []);
    const marker = `scan-${randomUUID()}`;
    await db.query(`INSERT INTO people
      (tenant_id, display_name, person_type, synthetic)
      SELECT $1,$2 || '-' || gs::text,'employee',true FROM generate_series(1,260) gs`,
    [ids.tenantA, marker]);
    await db.query(`INSERT INTO assignments
      (tenant_id, person_id, site_id, requirement_id, requirement_version_id,
       course_version_id, reason, trigger_kind, assigned_at, due_at)
      SELECT $1,p.id,$2,$3,$4,$5,'Synthetic future scan fixture','manual',
        '2024-01-01T00:00:00Z','2026-12-31T00:00:00Z'
      FROM people p WHERE p.tenant_id = $1 AND p.display_name LIKE $6`,
    [ids.tenantA, ids.ocilla, farFuture.id, farFuture.version, farFuture.course, `${marker}-%`]);
    await db.query(`INSERT INTO knowledge_evidence
      (tenant_id, assignment_id, course_version_id, moodle_course_id,
       moodle_user_id, moodle_timecompleted, delivery_method, source_payload)
      SELECT $1,a.id,$2,42,17,'2026-01-01T00:00:00Z',
        'synthetic-scan-test','{"synthetic":true}'::jsonb
      FROM assignments a WHERE a.tenant_id = $1 AND a.requirement_id = $3`,
    [ids.tenantA, farFuture.course, farFuture.id]);
    const dueSource = randomUUID();
    await db.query(`INSERT INTO assignments
      (id, tenant_id, person_id, site_id, requirement_id, requirement_version_id,
       course_version_id, reason, trigger_kind, assigned_at, due_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Synthetic due scan fixture','manual',
        '2024-02-01T00:00:00Z','2026-12-31T00:00:00Z')`,
    [dueSource, ids.tenantA, ids.workerA, ids.ocilla,
      dueSoon.id, dueSoon.version, dueSoon.course]);
    await db.query(`INSERT INTO knowledge_evidence
      (tenant_id, assignment_id, course_version_id, moodle_course_id,
       moodle_user_id, moodle_timecompleted, delivery_method, source_payload)
      VALUES ($1,$2,$3,42,17,'2026-02-01T00:00:00Z',
        'synthetic-scan-test','{"synthetic":true}'::jsonb)`,
    [ids.tenantA, dueSource, dueSoon.course]);
    const result = await processDueRecurrences(ids.tenantA,
      new Date('2027-01-02T00:00:00Z'), 1);
    expect(result.required).toBe(1);
    const replacement = await db.query<{ due_at: Date }>(`SELECT due_at FROM assignments
      WHERE tenant_id = $1 AND requirement_id = $2 AND trigger_kind = 'recurrence'`,
    [ids.tenantA, dueSoon.id]);
    expect(replacement.rowCount).toBe(1);
    expect(replacement.rows[0].due_at.toISOString()).toBe('2027-02-01T00:00:00.000Z');
  });

  it('keeps a drift-blocked recurrence in review and assigns only after resolution', async () => {
    const db = database();
    const reviewed = await approvedRequirement(`drift-${randomUUID()}`,
      { kind: 'annual' }, []);
    const sourceId = randomUUID();
    await db.query(`INSERT INTO assignments
      (id, tenant_id, person_id, site_id, requirement_id, requirement_version_id,
       course_version_id, reason, trigger_kind, assigned_at, due_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Synthetic drift fixture','manual',
        '2024-03-01T00:00:00Z','2026-12-31T00:00:00Z')`,
    [sourceId, ids.tenantA, ids.workerA, ids.ocilla,
      reviewed.id, reviewed.version, reviewed.course]);
    await db.query(`INSERT INTO knowledge_evidence
      (tenant_id, assignment_id, course_version_id, moodle_course_id,
       moodle_user_id, moodle_timecompleted, delivery_method, source_payload)
      VALUES ($1,$2,$3,42,17,'2026-02-01T00:00:00Z',
        'synthetic-drift-test','{"synthetic":true}'::jsonb)`,
    [ids.tenantA, sourceId, reviewed.course]);
    const drift = await db.query<{ id: string }>(`INSERT INTO integration_drifts
      (tenant_id, assignment_id, kind, details)
      VALUES ($1,$2,'completion_missing','{"synthetic":true}'::jsonb)
      RETURNING id`, [ids.tenantA, sourceId]);
    const at = new Date('2027-01-02T00:00:00Z');
    expect(await processDueRecurrences(ids.tenantA, at, 1)).toMatchObject({
      required: 0, needsReview: 1
    });
    const blocked = await db.query(`SELECT 1 FROM assignments
      WHERE tenant_id = $1 AND requirement_id = $2 AND trigger_kind = 'recurrence'`,
    [ids.tenantA, reviewed.id]);
    expect(blocked.rowCount).toBe(0);
    await db.query(`UPDATE integration_drifts SET resolved_at = now()
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, drift.rows[0].id]);
    expect(await processDueRecurrences(ids.tenantA, at, 1)).toMatchObject({
      required: 1
    });
    const decisions = await db.query<{ decision: string }>(`SELECT decision FROM reassignment_decisions
      WHERE tenant_id = $1 AND source_assignment_id = $2 ORDER BY evaluated_at`,
    [ids.tenantA, sourceId]);
    expect(decisions.rows.map((row) => row.decision)).toEqual(['needs_review', 'required']);
  });

  it('records an unapproved current recurrence rule as a review drift', async () => {
    const db = database();
    const approved = await approvedRequirement(`blocked-cycle-${randomUUID()}`,
      { kind: 'annual' }, []);
    const sourceId = randomUUID();
    await db.query(`INSERT INTO assignments
      (id, tenant_id, person_id, site_id, requirement_id, requirement_version_id,
       course_version_id, reason, trigger_kind, assigned_at, due_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'Synthetic rule-change fixture','manual',
        '2024-04-01T00:00:00Z','2026-12-31T00:00:00Z')`,
    [sourceId, ids.tenantA, ids.workerA, ids.ocilla,
      approved.id, approved.version, approved.course]);
    await db.query(`INSERT INTO knowledge_evidence
      (tenant_id, assignment_id, course_version_id, moodle_course_id,
       moodle_user_id, moodle_timecompleted, delivery_method, source_payload)
      VALUES ($1,$2,$3,42,17,'2026-02-01T00:00:00Z',
        'synthetic-rule-test','{"synthetic":true}'::jsonb)`,
    [ids.tenantA, sourceId, approved.course]);
    const draft = randomUUID();
    await db.query(`INSERT INTO requirement_versions
      (id, tenant_id, requirement_id, version, legal_status, authority, audience,
       site_overlay_requirement, content_digest)
      VALUES ($1,$2,$3,'unapproved-change','general_awareness',
        'Synthetic draft','Synthetic','Synthetic',repeat('e',64))`,
    [draft, ids.tenantA, approved.id]);
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, approved.id, draft]);
    const at = new Date('2027-01-02T00:00:00Z');
    expect(await processDueRecurrences(ids.tenantA, at, 1)).toMatchObject({
      required: 0, needsReview: 1
    });
    const drift = await db.query<{ resolved_at: Date | null }>(
      `SELECT resolved_at FROM integration_drifts WHERE tenant_id = $1
       AND assignment_id = $2 AND kind = 'reassignment_configuration_blocked'`,
    [ids.tenantA, sourceId]);
    expect(drift.rows[0]?.resolved_at).toBeNull();
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, approved.id, approved.version]);
    expect(await processDueRecurrences(ids.tenantA, at, 1)).toMatchObject({ required: 1 });
    const resolved = await db.query<{ resolved_at: Date | null }>(
      `SELECT resolved_at FROM integration_drifts WHERE tenant_id = $1
       AND assignment_id = $2 AND kind = 'reassignment_configuration_blocked'`,
    [ids.tenantA, sourceId]);
    expect(resolved.rows[0]?.resolved_at).not.toBeNull();
  });

  it('does not schedule unapproved requirements or promote completion to authorization', async () => {
    const db = database();
    const draftId = randomUUID();
    const draftVersion = randomUUID();
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,$3,'Synthetic unapproved requirement')`,
    [draftId, ids.tenantA, `draft-${draftId}`]);
    await db.query(`INSERT INTO requirement_versions
      (id, tenant_id, requirement_id, version, legal_status, authority, audience,
       applicability, recurrence, retraining_triggers, site_overlay_requirement,
       content_digest)
      VALUES ($1,$2,$3,'draft','general_awareness','Unreviewed','Synthetic',
        '{"roles":["press_operator"]}','{"kind":"annual"}',
        '["procedure_change"]','Unreviewed',repeat('c',64))`,
    [draftVersion, ids.tenantA, draftId]);
    await db.query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenantA, draftId, draftVersion]);
    await expect(recordChangeEvent(reviewerA, {
      sourceKey: `draft-${randomUUID()}`, siteId: ids.ocilla, requirementId: draftId,
      eventKind: 'procedure_change', reason: 'Synthetic draft event must fail',
      sourceReference: 'synthetic://draft', occurredAt: '2026-10-01T00:00:00Z',
      effectiveAt: '2026-10-01T00:00:00Z', dueAt: '2026-11-01T00:00:00Z'
    })).rejects.toMatchObject({ status: 409 });
    const accidental = await db.query(`SELECT 1 FROM assignments
      WHERE tenant_id = $1 AND requirement_id = $2`, [ids.tenantA, draftId]);
    expect(accidental.rowCount).toBe(0);
    const auth = await db.query(`SELECT 1 FROM authorizations a
      JOIN assignments assigned ON assigned.tenant_id = a.tenant_id
        AND assigned.id = a.assignment_id
      WHERE a.tenant_id = $1 AND assigned.trigger_kind IN ('event','recurrence')`, [ids.tenantA]);
    expect(auth.rowCount).toBe(0);
  });
});
