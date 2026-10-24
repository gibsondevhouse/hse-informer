import { error } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requireRole, requireSite, type Actor } from './auth';
import { mayAuthorize } from './domain';
import { query, transaction } from './db';

const siteTrainingInput = z.object({ assignmentId: z.uuid(), completedAt: z.iso.datetime({ offset: true }),
  evidenceUri: z.url().optional() });
const evaluationInput = z.strictObject({ assignmentId: z.uuid(), checklistVersionId: z.uuid(),
  evaluatedAt: z.iso.datetime({ offset: true }), passed: z.boolean(),
  results: z.record(z.string(), z.enum(['pass','fail','not_applicable'])),
  restrictions: z.string().trim().max(1000).optional() });
const attestationInput = z.object({ targetKind: z.enum(['site_training','practical_evaluation']),
  targetId: z.uuid(), recordSha256: z.string().regex(/^[a-f0-9]{64}$/), acknowledged: z.literal(true) });
const authorizationInput = z.object({ assignmentId: z.uuid(),
  decision: z.enum(['authorized','restricted','revoked']), restrictions: z.string().trim().max(1000).optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional() });

export async function recordSiteTraining(actor: Actor, input: unknown, now = new Date()): Promise<string> {
  requireRole(actor, ['tenant_admin','site_admin']);
  const parsed = siteTrainingInput.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  if (new Date(value.completedAt) > now) throw error(400, 'Site training completion cannot be in the future');
  return transaction(async (client) => {
    const rows = await client.query<{ site_id: string; addendum_id: string | null; review_status: string | null }>(
      `SELECT a.site_id, a.site_addendum_version_id AS addendum_id, sav.review_status
       FROM assignments a LEFT JOIN site_addendum_versions sav
         ON sav.tenant_id = a.tenant_id AND sav.id = a.site_addendum_version_id
       WHERE a.tenant_id = $1 AND a.id = $2 AND a.cancelled_at IS NULL FOR UPDATE OF a`,
      [actor.tenantId, value.assignmentId]);
    if (!rows.rowCount) throw error(404, 'Assignment not found');
    requireSite(actor, rows.rows[0].site_id);
    if (!rows.rows[0].addendum_id || rows.rows[0].review_status !== 'approved') {
      throw error(409, 'An approved site addendum must be attached before site training can be recorded');
    }
    const result = await client.query<{ id: string }>(`INSERT INTO site_training_evidence
      (tenant_id, assignment_id, site_addendum_version_id, completed_at, attested_by, evidence_uri)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [actor.tenantId, value.assignmentId, rows.rows[0].addendum_id, value.completedAt, actor.id, value.evidenceUri ?? null]);
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'site_training.recorded','site_training_evidence',$3,$4::jsonb)`,
      [actor.tenantId, actor.id, result.rows[0].id, JSON.stringify({ assignmentId: value.assignmentId, completedAt: value.completedAt })]);
    return result.rows[0].id;
  });
}

export async function recordPracticalEvaluation(actor: Actor, input: unknown, now = new Date()): Promise<string> {
  requireRole(actor, ['evaluator']);
  const parsed = evaluationInput.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  if (new Date(value.evaluatedAt) > now) throw error(400, 'Practical evaluation cannot be in the future');
  return transaction(async (client) => {
    const assignments = await client.query<{ site_id: string; requirement_id: string }>(
      `SELECT site_id, requirement_id FROM assignments
       WHERE tenant_id = $1 AND id = $2 AND cancelled_at IS NULL FOR UPDATE`, [actor.tenantId, value.assignmentId]);
    if (!assignments.rowCount) throw error(404, 'Assignment not found');
    const assignment = assignments.rows[0];
    requireSite(actor, assignment.site_id);
    const checklists = await client.query<{ checklist: { items?: Array<{ id?: string }> } }>(
      `SELECT checklist FROM practical_checklist_versions WHERE tenant_id = $1 AND id = $2
       AND requirement_id = $3 AND (site_id IS NULL OR site_id = $4) AND review_status = 'approved'`,
      [actor.tenantId, value.checklistVersionId, assignment.requirement_id, assignment.site_id]);
    if (!checklists.rowCount) throw error(409, 'Approved checklist does not match this assignment');
    const itemIds = checklists.rows[0].checklist?.items?.map((item) => item.id).filter((item): item is string => !!item);
    if (!itemIds?.length || itemIds.some((item) => !(item in value.results))
      || Object.keys(value.results).some((item) => !itemIds.includes(item))) {
      throw error(400, 'Evaluation results must cover exactly the approved checklist items');
    }
    if (value.passed && Object.values(value.results).includes('fail')) throw error(400, 'A passing evaluation cannot contain failed items');
    const qualifications = await client.query<{ id: string }>(`SELECT id FROM evaluator_qualifications
      WHERE tenant_id = $1 AND evaluator_principal_id = $2 AND requirement_id = $3
        AND (site_id IS NULL OR site_id = $4) AND valid_from <= $5
        AND (valid_until IS NULL OR valid_until > $5)
        AND valid_from <= $6 AND (valid_until IS NULL OR valid_until > $6)
      ORDER BY valid_from DESC LIMIT 1`,
      [actor.tenantId, actor.id, assignment.requirement_id, assignment.site_id, value.evaluatedAt, now]);
    if (!qualifications.rowCount) throw error(403, 'Evaluator qualification is missing or expired');
    const result = await client.query<{ id: string }>(`INSERT INTO practical_evaluations
      (tenant_id, assignment_id, checklist_version_id, evaluator_qualification_id,
       evaluator_principal_id, evaluated_at, passed, results, restrictions,
       evaluator_attested_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,now()) RETURNING id`,
      [actor.tenantId, value.assignmentId, value.checklistVersionId, qualifications.rows[0].id,
        actor.id, value.evaluatedAt, value.passed, JSON.stringify(value.results), value.restrictions ?? null]);
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'practical_evaluation.recorded','practical_evaluation',$3,$4::jsonb)`,
      [actor.tenantId, actor.id, result.rows[0].id, JSON.stringify({ assignmentId: value.assignmentId, passed: value.passed })]);
    return result.rows[0].id;
  });
}

export async function attestationTarget(actor: Actor, targetKind: 'site_training' | 'practical_evaluation', targetId: string) {
  if (!actor.personId) throw error(403, 'Individual worker identity is required');
  const source = targetKind === 'site_training' ? 'site_training_evidence' : 'practical_evaluations';
  const rows = await query<{ person_id: string; record: Record<string, unknown> }>(
    `SELECT a.person_id, to_jsonb(target) AS record FROM ${source} target
     JOIN assignments a ON a.tenant_id = target.tenant_id AND a.id = target.assignment_id
     WHERE target.tenant_id = $1 AND target.id = $2`, [actor.tenantId, targetId]);
  if (!rows.length) throw error(404, 'Evidence record not found');
  if (rows[0].person_id !== actor.personId) throw error(403, 'Only the assigned worker may attest');
  const recordSha256 = createHash('sha256').update(JSON.stringify(rows[0].record)).digest('hex');
  return { targetKind, targetId, record: rows[0].record, recordSha256,
    statement: 'I acknowledge that this record accurately describes the site training or practical evaluation I received.' };
}

export async function attestEvidence(actor: Actor, input: unknown): Promise<string> {
  const parsed = attestationInput.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  const target = await attestationTarget(actor, value.targetKind, value.targetId);
  if (target.recordSha256 !== value.recordSha256) throw error(409, 'Evidence record changed; review it again');
  return transaction(async (client) => {
    const result = await client.query<{ id: string }>(`INSERT INTO employee_attestations
      (tenant_id, person_id, principal_id, target_kind, target_id, record_sha256)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [actor.tenantId, actor.personId, actor.id, value.targetKind, value.targetId, value.recordSha256]);
    if (!result.rowCount) throw error(409, 'This record was already attested');
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'employee.attested','employee_attestation',$3,$4::jsonb)`,
      [actor.tenantId, actor.id, result.rows[0].id,
        JSON.stringify({ targetKind: value.targetKind, targetId: value.targetId, recordSha256: value.recordSha256 })]);
    return result.rows[0].id;
  });
}

type EvidenceRow = { id: string; valid: boolean };
export async function decideAuthorization(actor: Actor, input: unknown, now = new Date()): Promise<string> {
  requireRole(actor, ['tenant_admin','site_admin']);
  const parsed = authorizationInput.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  if (value.decision === 'restricted' && !value.restrictions) throw error(400, 'Restrictions are required for a restricted authorization');
  if (value.expiresAt && new Date(value.expiresAt) <= now) throw error(400, 'Authorization expiry must be in the future');
  return transaction(async (client) => {
    const assignments = await client.query<{ site_id: string; person_id: string; requirement_id: string;
      course_version_id: string | null; site_addendum_version_id: string | null;
      authorization_prerequisites: string[]; review_status: string; practice_only: boolean | null }>(
      `SELECT a.site_id, a.person_id, a.requirement_id, a.course_version_id,
        a.site_addendum_version_id, rv.authorization_prerequisites, rv.review_status, cv.practice_only
       FROM assignments a JOIN requirement_versions rv ON rv.tenant_id = a.tenant_id AND rv.id = a.requirement_version_id
       LEFT JOIN course_versions cv ON cv.tenant_id=a.tenant_id AND cv.id=a.course_version_id
       WHERE a.tenant_id = $1 AND a.id = $2 AND a.cancelled_at IS NULL FOR UPDATE OF a`,
      [actor.tenantId, value.assignmentId]);
    if (!assignments.rowCount) throw error(404, 'Assignment not found');
    const assignment = assignments.rows[0];
    requireSite(actor, assignment.site_id);
    const snapshot: Record<string, string> = {};
    if (value.decision !== 'revoked') {
      if (assignment.practice_only) throw error(409, 'Practice completions cannot support workplace authorization');
      if (assignment.review_status !== 'approved' || !assignment.authorization_prerequisites?.length) {
        throw error(409, 'Approved prerequisites are required before authorization');
      }
      const reads: Array<[string, string, unknown[]]> = [
        ['knowledge', `SELECT id, true AS valid FROM effective_knowledge_evidence WHERE tenant_id = $1 AND assignment_id = $2
          AND course_version_id = $3 AND completed_at <= $4
          AND NOT EXISTS (SELECT 1 FROM integration_drifts d WHERE d.tenant_id = $1
            AND d.assignment_id = $2 AND d.resolved_at IS NULL AND d.kind LIKE 'completion_%')
          ORDER BY observed_at DESC, id DESC LIMIT 1`,
          [actor.tenantId, value.assignmentId, assignment.course_version_id, now]],
        ['site', `SELECT st.id, EXISTS (SELECT 1 FROM employee_attestations ea
          WHERE ea.tenant_id = st.tenant_id AND ea.target_kind = 'site_training' AND ea.target_id = st.id
            AND ea.person_id = $4) AS valid FROM site_training_evidence st
          WHERE st.tenant_id = $1 AND st.assignment_id = $2
          AND st.site_addendum_version_id = $3 AND st.completed_at <= $5
          ORDER BY st.completed_at DESC, st.created_at DESC, st.id DESC LIMIT 1`,
          [actor.tenantId, value.assignmentId, assignment.site_addendum_version_id, assignment.person_id, now]],
        ['practical', `SELECT pe.id, (pe.passed AND EXISTS (SELECT 1 FROM employee_attestations ea
          WHERE ea.tenant_id = pe.tenant_id AND ea.target_kind = 'practical_evaluation'
            AND ea.target_id = pe.id AND ea.person_id = $3)) AS valid
          FROM practical_evaluations pe WHERE pe.tenant_id = $1 AND pe.assignment_id = $2
            AND pe.evaluated_at <= $4
          ORDER BY pe.evaluated_at DESC, pe.created_at DESC, pe.id DESC LIMIT 1`,
          [actor.tenantId, value.assignmentId, assignment.person_id, now]],
        ['medical', `SELECT id, (cleared AND (expires_at IS NULL OR expires_at > $4)) AS valid
          FROM clearance_statuses WHERE tenant_id = $1 AND person_id = $2
          AND requirement_id = $3 AND kind = 'medical' AND effective_at <= $4
          ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1`,
          [actor.tenantId, assignment.person_id, assignment.requirement_id, now]],
        ['fitTest', `SELECT id, (cleared AND (expires_at IS NULL OR expires_at > $4)) AS valid
          FROM clearance_statuses WHERE tenant_id = $1 AND person_id = $2
          AND requirement_id = $3 AND kind = 'fit_test' AND effective_at <= $4
          ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1`,
          [actor.tenantId, assignment.person_id, assignment.requirement_id, now]],
        ['externalCredential', `SELECT id, true AS valid FROM external_credentials WHERE tenant_id = $1 AND person_id = $2
          AND requirement_id = $3 AND verified_at <= $4 AND (expires_at IS NULL OR expires_at > $4)
          ORDER BY verified_at DESC, id DESC LIMIT 1`,
          [actor.tenantId, assignment.person_id, assignment.requirement_id, now]]
      ];
      for (const [key, sql, params] of reads) {
        if (!assignment.authorization_prerequisites.includes(key)) continue;
        const found = await client.query<EvidenceRow>(sql, params);
        if (found.rows[0]?.valid) snapshot[key] = found.rows[0].id;
      }
      const present = { knowledge: !!snapshot.knowledge, site: !!snapshot.site, practical: !!snapshot.practical,
        medical: !!snapshot.medical, fitTest: !!snapshot.fitTest, externalCredential: !!snapshot.externalCredential };
      if (!mayAuthorize(assignment.authorization_prerequisites, present)) throw error(409, 'Authorization prerequisites are incomplete');
    }
    const inserted = await client.query<{ id: string }>(`INSERT INTO authorizations
      (tenant_id, assignment_id, decision, restrictions, decided_at, expires_at, decided_by, prerequisite_evidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
      [actor.tenantId, value.assignmentId, value.decision, value.restrictions ?? null,
        now, value.expiresAt ?? null, actor.id, JSON.stringify(snapshot)]);
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'authorization.decided','authorization',$3,$4::jsonb)`,
      [actor.tenantId, actor.id, inserted.rows[0].id,
        JSON.stringify({ assignmentId: value.assignmentId, decision: value.decision, evidence: snapshot })]);
    return inserted.rows[0].id;
  });
}

export async function auditPacket(actor: Actor, personId: string, requirementId: string) {
  requireRole(actor, ['tenant_admin','site_admin','hse_reviewer','auditor']);
  const rows = await query<{ id: string; site_id: string; record: Record<string, unknown> }>(
    `SELECT a.id, a.site_id, jsonb_build_object(
      'assignment', to_jsonb(a), 'person', to_jsonb(p) - 'email', 'site', to_jsonb(s),
      'requirementVersion', to_jsonb(rv), 'courseVersion', to_jsonb(cv),
      'siteAddendumVersion', to_jsonb(sav),
      'knowledge', (SELECT jsonb_agg(to_jsonb(k) ORDER BY k.observed_at) FROM knowledge_evidence k
        WHERE k.tenant_id = a.tenant_id AND k.assignment_id = a.id),
      'siteTraining', (SELECT jsonb_agg(to_jsonb(st) ORDER BY st.completed_at) FROM site_training_evidence st
        WHERE st.tenant_id = a.tenant_id AND st.assignment_id = a.id),
      'practical', (SELECT jsonb_agg(to_jsonb(pe) ORDER BY pe.evaluated_at) FROM practical_evaluations pe
        WHERE pe.tenant_id = a.tenant_id AND pe.assignment_id = a.id),
      'employeeAttestations', (SELECT jsonb_agg(to_jsonb(ea) ORDER BY ea.attested_at)
        FROM employee_attestations ea WHERE ea.tenant_id = a.tenant_id AND ea.person_id = a.person_id
          AND ((ea.target_kind = 'site_training' AND EXISTS (SELECT 1 FROM site_training_evidence st
            WHERE st.tenant_id = a.tenant_id AND st.assignment_id = a.id AND st.id = ea.target_id))
          OR (ea.target_kind = 'practical_evaluation' AND EXISTS (SELECT 1 FROM practical_evaluations pe
            WHERE pe.tenant_id = a.tenant_id AND pe.assignment_id = a.id AND pe.id = ea.target_id)))),
      'clearances', (SELECT jsonb_agg(to_jsonb(cs) ORDER BY cs.effective_at)
        FROM clearance_statuses cs WHERE cs.tenant_id = a.tenant_id AND cs.person_id = a.person_id
          AND cs.requirement_id = a.requirement_id),
      'externalCredentials', (SELECT jsonb_agg(to_jsonb(ec) ORDER BY ec.verified_at)
        FROM external_credentials ec WHERE ec.tenant_id = a.tenant_id AND ec.person_id = a.person_id
          AND ec.requirement_id = a.requirement_id),
      'authorizations', (SELECT jsonb_agg(to_jsonb(au) ORDER BY au.decided_at) FROM authorizations au
        WHERE au.tenant_id = a.tenant_id AND au.assignment_id = a.id)
    ) AS record
    FROM assignments a
    JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
    JOIN sites s ON s.tenant_id = a.tenant_id AND s.id = a.site_id
    JOIN requirement_versions rv ON rv.tenant_id = a.tenant_id AND rv.id = a.requirement_version_id
    LEFT JOIN course_versions cv ON cv.tenant_id = a.tenant_id AND cv.id = a.course_version_id
    LEFT JOIN site_addendum_versions sav ON sav.tenant_id = a.tenant_id AND sav.id = a.site_addendum_version_id
    WHERE a.tenant_id = $1 AND a.person_id = $2 AND a.requirement_id = $3
      ${actor.role === 'site_admin' ? 'AND a.site_id = ANY($4::uuid[])' : ''}
    ORDER BY a.assigned_at`, actor.role === 'site_admin'
      ? [actor.tenantId, personId, requirementId, actor.siteIds]
      : [actor.tenantId, personId, requirementId]);
  const provenance = await query<{ id: string; hsi_record_id: string; original_completed_raw: string;
    original_expires_raw: string | null; original_timezone: string | null; original_completed_at: Date;
    original_expires_at: Date | null; export_sha256: string; import_batch: string;
    moodle_timecompleted: Date | null; moodle_completion_key: string | null }>(
    `SELECT id, hsi_record_id, site_id, original_completed_raw, original_expires_raw, original_timezone,
      original_completed_at, original_expires_at, export_sha256, import_batch,
      moodle_timecompleted, moodle_completion_key FROM historical_provenance
      WHERE tenant_id = $1 AND person_id = $2 AND requirement_id = $3
        ${actor.role === 'site_admin' ? 'AND site_id = ANY($4::uuid[])' : ''}
      ORDER BY original_completed_at`, actor.role === 'site_admin'
      ? [actor.tenantId, personId, requirementId, actor.siteIds]
      : [actor.tenantId, personId, requirementId]);
  const reassignmentDecisions = await query(`SELECT id, site_id, requirement_version_id,
      context_version_id, event_id, source_assignment_id, assignment_id,
      trigger_kind, trigger_id, decision, reason, input_snapshot, evaluated_at
      FROM reassignment_decisions WHERE tenant_id = $1 AND person_id = $2
        AND requirement_id = $3
        ${actor.role === 'site_admin' ? 'AND site_id = ANY($4::uuid[])' : ''}
      ORDER BY evaluated_at, id`, actor.role === 'site_admin'
    ? [actor.tenantId, personId, requirementId, actor.siteIds]
    : [actor.tenantId, personId, requirementId]);
  return { personId, requirementId, generatedAt: new Date().toISOString(), assignments: rows.map((row) => row.record),
    reassignmentDecisions, historicalProvenance: provenance };
}
