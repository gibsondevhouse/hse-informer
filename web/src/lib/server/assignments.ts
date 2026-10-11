import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { query, transaction } from './db';
import { assignmentState, authorizationCurrent, evidenceSnapshotCurrent, type AssignmentState, type DeliveryState } from './domain';
import { requireRole, requireSite, type Actor } from './auth';
import { moodleCourseUrl } from './moodle';

const createSchema = z.object({
  personIds: z.array(z.uuid()).min(1),
  siteId: z.uuid(), requirementId: z.uuid(),
  dueAt: z.iso.datetime({ offset: true }), reason: z.string().trim().min(3).max(500),
  triggerKind: z.enum(['manual','applicability','recurrence','event']).default('manual'),
  triggerRef: z.string().trim().max(200).optional()
});
const patchSchema = z.object({ dueAt: z.iso.datetime({ offset: true }) });

interface AssignmentRow {
  id: string; tenant_id: string; person_id: string; person_name: string; site_id: string; site_name: string;
  requirement_id: string; requirement_title: string; requirement_code: string; reason: string;
  assigned_at: Date; due_at: Date; closed_at: Date | null; enrolled_at: Date | null; knowledge_completed_at: Date | null;
  auth_decision: 'authorized' | 'restricted' | 'revoked' | null; auth_expires_at: Date | null;
  auth_restrictions: string | null; auth_evidence: Record<string, string> | null;
  review_status: string; course_review_status: string | null; moodle_course_id: string | null;
  authorization_prerequisites: string[];
  prerequisites_current: boolean;
  completion_drift: boolean;
  knowledge_evidence_id: string | null; site_evidence_id: string | null; practical_evidence_id: string | null;
  medical_evidence_id: string | null; fit_evidence_id: string | null; external_evidence_id: string | null;
}

export interface AssignmentItem {
  id: string;
  person: { id: string; displayName: string };
  site: { id: string; name: string };
  requirement: { id: string; code: string; title: string; reviewStatus: string };
  reason: string; assignedAt: string; dueAt: string;
  state: AssignmentState; deliveryState: DeliveryState; knowledgeComplete: boolean; authorized: boolean;
  authorizationDecision: 'authorized' | 'restricted' | 'revoked' | null;
  authorizationRestrictions: string | null; launchUrl: string | null;
  completionDrift: boolean;
}

function visibleSiteClause(actor: Actor, start = 2): { sql: string; params: unknown[] } {
  if (actor.role === 'tenant_admin' || actor.role === 'hse_reviewer' || actor.role === 'auditor') return { sql: '', params: [] };
  if (actor.role === 'learner') return { sql: ` AND a.person_id = $${start}`, params: [actor.personId] };
  return { sql: ` AND a.site_id = ANY($${start}::uuid[])`, params: [actor.siteIds] };
}

export async function listAssignments(actor: Actor, now = new Date()): Promise<AssignmentItem[]> {
  const scope = visibleSiteClause(actor, 3);
  const rows = await query<AssignmentRow>(`SELECT a.id, a.tenant_id, a.person_id, p.display_name AS person_name,
    a.site_id, s.name AS site_name, a.requirement_id, r.title AS requirement_title, r.code AS requirement_code,
    a.reason, a.assigned_at, a.due_at, a.closed_at, me.enrolled_at,
    ke.moodle_timecompleted AS knowledge_completed_at, au.decision AS auth_decision,
    au.expires_at AS auth_expires_at, au.restrictions AS auth_restrictions,
    au.prerequisite_evidence AS auth_evidence,
    ke.id AS knowledge_evidence_id, site_latest.id AS site_evidence_id,
    practical_latest.id AS practical_evidence_id, medical_latest.id AS medical_evidence_id,
    fit_latest.id AS fit_evidence_id, external_latest.id AS external_evidence_id,
    drift.completion_drift,
    rv.review_status, rv.authorization_prerequisites, cv.review_status AS course_review_status, cv.moodle_course_id,
    (rv.review_status = 'approved')
    AND jsonb_array_length(rv.authorization_prerequisites) > 0
    AND (rv.authorization_prerequisites <@ '["knowledge","site","practical","medical","fitTest","externalCredential"]'::jsonb)
    AND (NOT (rv.authorization_prerequisites ? 'knowledge') OR
      (cv.review_status = 'approved' AND ke.moodle_timecompleted IS NOT NULL
        AND NOT drift.completion_drift))
    AND (NOT (rv.authorization_prerequisites ? 'site') OR COALESCE(site_latest.valid, false))
    AND (NOT (rv.authorization_prerequisites ? 'practical') OR COALESCE(practical_latest.valid, false))
    AND (NOT (rv.authorization_prerequisites ? 'medical') OR COALESCE(medical_latest.valid, false))
    AND (NOT (rv.authorization_prerequisites ? 'fitTest') OR COALESCE(fit_latest.valid, false))
    AND (NOT (rv.authorization_prerequisites ? 'externalCredential') OR external_latest.id IS NOT NULL)
      AS prerequisites_current
    FROM assignments a
    JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
    JOIN sites s ON s.tenant_id = a.tenant_id AND s.id = a.site_id
    JOIN requirements r ON r.tenant_id = a.tenant_id AND r.id = a.requirement_id
    JOIN requirement_versions rv ON rv.tenant_id = a.tenant_id AND rv.id = a.requirement_version_id
    LEFT JOIN course_versions cv ON cv.tenant_id = a.tenant_id AND cv.id = a.course_version_id
    LEFT JOIN moodle_enrollments me ON me.tenant_id = a.tenant_id AND me.assignment_id = a.id
    LEFT JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM integration_drifts d
      WHERE d.tenant_id = a.tenant_id AND d.assignment_id = a.id AND d.resolved_at IS NULL
        AND d.kind LIKE 'completion_%') AS completion_drift) drift ON true
    LEFT JOIN LATERAL (SELECT id, moodle_timecompleted FROM knowledge_evidence k
      WHERE k.tenant_id = a.tenant_id AND k.assignment_id = a.id
        AND k.course_version_id = a.course_version_id AND k.moodle_timecompleted <= $2
      ORDER BY observed_at DESC, id DESC LIMIT 1) ke ON true
    LEFT JOIN LATERAL (SELECT decision, expires_at, restrictions, prerequisite_evidence FROM authorizations x
      WHERE x.tenant_id = a.tenant_id AND x.assignment_id = a.id
      ORDER BY decided_at DESC, created_at DESC, id DESC LIMIT 1) au ON true
    LEFT JOIN LATERAL (SELECT ste.id, EXISTS (SELECT 1 FROM employee_attestations ea
        WHERE ea.tenant_id = ste.tenant_id AND ea.target_kind = 'site_training'
          AND ea.target_id = ste.id AND ea.person_id = a.person_id) AS valid
      FROM site_training_evidence ste WHERE ste.tenant_id = a.tenant_id
        AND ste.assignment_id = a.id AND ste.site_addendum_version_id = a.site_addendum_version_id
        AND ste.completed_at <= $2
      ORDER BY ste.completed_at DESC, ste.created_at DESC, ste.id DESC LIMIT 1) site_latest ON true
    LEFT JOIN LATERAL (SELECT pe.id, (pe.passed AND EXISTS (SELECT 1 FROM employee_attestations ea
        WHERE ea.tenant_id = pe.tenant_id AND ea.target_kind = 'practical_evaluation'
          AND ea.target_id = pe.id AND ea.person_id = a.person_id)) AS valid
      FROM practical_evaluations pe WHERE pe.tenant_id = a.tenant_id AND pe.assignment_id = a.id
        AND pe.evaluated_at <= $2
      ORDER BY evaluated_at DESC, created_at DESC, id DESC LIMIT 1) practical_latest ON true
    LEFT JOIN LATERAL (SELECT id, (cleared AND (expires_at IS NULL OR expires_at > $2)) AS valid
      FROM clearance_statuses cs WHERE cs.tenant_id = a.tenant_id AND cs.person_id = a.person_id
        AND cs.requirement_id = a.requirement_id AND cs.kind = 'medical' AND cs.effective_at <= $2
      ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1) medical_latest ON true
    LEFT JOIN LATERAL (SELECT id, (cleared AND (expires_at IS NULL OR expires_at > $2)) AS valid
      FROM clearance_statuses cs WHERE cs.tenant_id = a.tenant_id AND cs.person_id = a.person_id
        AND cs.requirement_id = a.requirement_id AND cs.kind = 'fit_test' AND cs.effective_at <= $2
      ORDER BY effective_at DESC, created_at DESC, id DESC LIMIT 1) fit_latest ON true
    LEFT JOIN LATERAL (SELECT id FROM external_credentials ec WHERE ec.tenant_id = a.tenant_id
        AND ec.person_id = a.person_id AND ec.requirement_id = a.requirement_id
        AND ec.verified_at <= $2 AND (ec.expires_at IS NULL OR ec.expires_at > $2)
      ORDER BY ec.verified_at DESC, ec.id DESC LIMIT 1) external_latest ON true
    WHERE a.tenant_id = $1 AND a.cancelled_at IS NULL ${scope.sql}
    ORDER BY a.due_at ASC, p.display_name ASC`, [actor.tenantId, now, ...scope.params]);
  return rows.map((row) => {
    const currentEvidence = { knowledge: row.knowledge_evidence_id, site: row.site_evidence_id,
      practical: row.practical_evidence_id, medical: row.medical_evidence_id,
      fitTest: row.fit_evidence_id, externalCredential: row.external_evidence_id };
    const evidenceCurrent = row.prerequisites_current === true
      && evidenceSnapshotCurrent(row.authorization_prerequisites, row.auth_evidence, currentEvidence);
    const signals = { dueAt: row.due_at, closedAt: row.closed_at, enrolled: !!row.enrolled_at,
      knowledgeCompletedAt: row.knowledge_completed_at, authorizationDecision: row.auth_decision,
      authorizationExpiresAt: row.auth_expires_at, prerequisitesCurrent: evidenceCurrent,
      needsReview: row.authorization_prerequisites.some((item) => item !== 'knowledge'),
      hasBlockingDrift: row.completion_drift };
    const state = assignmentState(signals, now);
    const deliveryState: DeliveryState = row.enrolled_at ? 'enrolled' : row.review_status === 'approved'
      && row.course_review_status === 'approved' && row.moodle_course_id ? 'queued' : 'draft';
    return {
      id: row.id, person: { id: row.person_id, displayName: row.person_name },
      site: { id: row.site_id, name: row.site_name },
      requirement: { id: row.requirement_id, code: row.requirement_code, title: row.requirement_title,
        reviewStatus: row.review_status },
      reason: row.reason, assignedAt: row.assigned_at.toISOString(), dueAt: row.due_at.toISOString(),
      state, deliveryState, knowledgeComplete: !!row.knowledge_completed_at && !row.completion_drift,
      authorized: authorizationCurrent(signals, now),
      authorizationDecision: row.auth_decision, authorizationRestrictions: row.auth_restrictions,
      completionDrift: row.completion_drift,
      launchUrl: row.enrolled_at && row.moodle_course_id ? moodleCourseUrl(actor.tenantId, Number(row.moodle_course_id)) : null
    };
  });
}

export async function createAssignments(actor: Actor, input: unknown): Promise<{ created: string[]; skipped: string[] }> {
  requireRole(actor, ['tenant_admin','site_admin']);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  requireSite(actor, value.siteId);
  if (value.triggerKind !== 'manual' && !value.triggerRef?.trim()) {
    throw error(400, 'A stable triggerRef is required for applicability, recurrence, and event assignments');
  }
  const triggerRef = value.triggerKind === 'manual' ? null : value.triggerRef!.trim();
  const triggerId = triggerRef ?? `manual:${value.siteId}`;
  const peopleIds = [...new Set(value.personIds)];
  if (peopleIds.length > 500) throw error(400, 'At most 500 recipients per request');
  return transaction(async (client) => {
    const site = await client.query('SELECT 1 FROM sites WHERE tenant_id = $1 AND id = $2', [actor.tenantId, value.siteId]);
    if (!site.rowCount) throw error(404, 'Site not found');
    const requirement = await client.query<{ version_id: string; review_status: string;
      course_version_id: string | null; addendum_version_id: string | null;
      authorization_prerequisites: string[] }>(
      `SELECT rv.id AS version_id, rv.review_status, rv.authorization_prerequisites,
       (SELECT cv.id FROM course_versions cv WHERE cv.tenant_id = r.tenant_id
         AND cv.requirement_version_id = rv.id AND cv.review_status = 'approved'
         AND cv.moodle_course_id IS NOT NULL AND (cv.effective_at IS NULL OR cv.effective_at <= now())
         ORDER BY cv.effective_at DESC NULLS LAST, cv.created_at DESC LIMIT 1) AS course_version_id,
       (SELECT sav.id FROM site_addendum_versions sav WHERE sav.tenant_id = r.tenant_id
         AND sav.requirement_id = r.id AND sav.site_id = $3 AND sav.review_status = 'approved'
         AND (sav.effective_at IS NULL OR sav.effective_at <= now())
         ORDER BY sav.effective_at DESC NULLS LAST, sav.created_at DESC LIMIT 1) AS addendum_version_id
       FROM requirements r JOIN requirement_versions rv ON rv.tenant_id = r.tenant_id AND rv.id = r.active_version_id
       WHERE r.tenant_id = $1 AND r.id = $2`, [actor.tenantId, value.requirementId, value.siteId]);
    if (!requirement.rowCount) throw error(404, 'Requirement not found');
    if (requirement.rows[0].review_status !== 'approved' || !requirement.rows[0].course_version_id) {
      throw error(409, 'Requirement and Moodle course mapping require HSE approval before assignment');
    }
    if (requirement.rows[0].authorization_prerequisites.includes('site')
      && !requirement.rows[0].addendum_version_id) {
      throw error(409, 'An approved site addendum is required before this assignment');
    }
    const eligible = await client.query<{ id: string }>(
      `SELECT DISTINCT p.id FROM people p JOIN tenants t ON t.id = p.tenant_id
        JOIN person_site_memberships m
        ON m.tenant_id = p.tenant_id AND m.person_id = p.id
       WHERE p.tenant_id = $1 AND p.id = ANY($2::uuid[]) AND p.active
         AND (t.synthetic OR NOT p.synthetic)
         AND m.site_id = $3 AND m.ended_at IS NULL`, [actor.tenantId, peopleIds, value.siteId]);
    if (eligible.rowCount !== peopleIds.length) throw error(400,
      'Every recipient must be active, assigned to the site, and eligible for live assignment');
    const created: string[] = [];
    const skipped: string[] = [];
    for (const personId of peopleIds) {
      const duplicate = await client.query(`SELECT 1 FROM assignments
        WHERE tenant_id = $1 AND person_id = $2 AND requirement_version_id = $3
          AND trigger_id = $4 AND closed_at IS NULL AND cancelled_at IS NULL`,
      [actor.tenantId, personId, requirement.rows[0].version_id, triggerId]);
      if (duplicate.rowCount) { skipped.push(personId); continue; }
      const prior = await client.query<{ id: string }>(`SELECT id FROM assignments
        WHERE tenant_id = $1 AND person_id = $2 AND site_id = $3 AND requirement_id = $4
          AND closed_at IS NULL AND cancelled_at IS NULL
        ORDER BY assigned_at DESC, id DESC LIMIT 1 FOR UPDATE`,
      [actor.tenantId, personId, value.siteId, value.requirementId]);
      const supersedes = prior.rows[0]?.id ?? null;
      if (supersedes) {
        await client.query(`UPDATE assignments SET cancelled_at = now() WHERE tenant_id = $1 AND id = $2`,
          [actor.tenantId, supersedes]);
        await client.query(`INSERT INTO audit_log
          (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
          VALUES ($1,$2,'assignment.superseded','assignment',$3,$4::jsonb)`,
        [actor.tenantId, actor.id, supersedes, JSON.stringify({ triggerId })]);
      }
      const result = await client.query<{ id: string }>(`INSERT INTO assignments
        (tenant_id, person_id, site_id, requirement_id, requirement_version_id, course_version_id,
         site_addendum_version_id, reason, trigger_kind, trigger_ref, due_at, created_by,
         supersedes_assignment_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT DO NOTHING RETURNING id`,
        [actor.tenantId, personId, value.siteId, value.requirementId, requirement.rows[0].version_id,
          requirement.rows[0].course_version_id, requirement.rows[0].addendum_version_id,
          value.reason, value.triggerKind, triggerRef, value.dueAt, actor.id, supersedes]);
      if (!result.rowCount) {
        if (supersedes) throw error(409, 'Assignment changed concurrently; retry this trigger');
        skipped.push(personId); continue;
      }
      const id = result.rows[0].id;
      created.push(id);
      await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
        VALUES ($1,$2,'assignment.created','assignment',$3,$4::jsonb)`,
        [actor.tenantId, actor.id, id, JSON.stringify({ personId, siteId: value.siteId,
          requirementId: value.requirementId, dueAt: value.dueAt, reason: value.reason,
          triggerId, supersedesAssignmentId: supersedes })]);
      await client.query(`INSERT INTO integration_outbox (tenant_id, kind, aggregate_id)
        VALUES ($1,'moodle_enrol',$2) ON CONFLICT DO NOTHING`, [actor.tenantId, id]);
    }
    return { created, skipped };
  });
}

export async function changeDueDate(actor: Actor, assignmentId: string, input: unknown): Promise<string> {
  requireRole(actor, ['tenant_admin','site_admin']);
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  return transaction(async (client) => {
    const before = await client.query<{ site_id: string; due_at: Date }>(
      'SELECT site_id, due_at FROM assignments WHERE tenant_id = $1 AND id = $2 AND closed_at IS NULL AND cancelled_at IS NULL FOR UPDATE',
      [actor.tenantId, assignmentId]);
    if (!before.rowCount) throw error(404, 'Open assignment not found');
    requireSite(actor, before.rows[0].site_id);
    await client.query('UPDATE assignments SET due_at = $3 WHERE tenant_id = $1 AND id = $2',
      [actor.tenantId, assignmentId, parsed.data.dueAt]);
    await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, before_value, after_value)
      VALUES ($1,$2,'assignment.due_date_changed','assignment',$3,$4::jsonb,$5::jsonb)`,
      [actor.tenantId, actor.id, assignmentId, JSON.stringify({ dueAt: before.rows[0].due_at.toISOString() }),
        JSON.stringify({ dueAt: parsed.data.dueAt })]);
    return parsed.data.dueAt;
  });
}

export function summarize(items: AssignmentItem[], now = new Date()) {
  const base = { total: 0, notStarted: 0, inProgress: 0, knowledgeComplete: 0, overdue: 0, needsReview: 0, authorized: 0 };
  const add = (counts: typeof base, item: AssignmentItem) => {
    counts.total++;
    if (item.state === 'not_started') counts.notStarted++;
    if (item.state === 'in_progress') counts.inProgress++;
    if (item.knowledgeComplete) counts.knowledgeComplete++;
    if (item.state === 'overdue') counts.overdue++;
    if (item.state === 'needs_review') counts.needsReview++;
    if (item.authorized) counts.authorized++;
  };
  const counts = { ...base };
  const byCourse = new Map<string, { requirementId: string; title: string } & typeof base>();
  const bySite = new Map<string, { siteId: string; name: string; total: number; overdue: number; authorized: number }>();
  for (const item of items) {
    add(counts, item);
    const course = byCourse.get(item.requirement.id) ?? { requirementId: item.requirement.id, title: item.requirement.title, ...base };
    add(course, item); byCourse.set(item.requirement.id, course);
    const site = bySite.get(item.site.id) ?? { siteId: item.site.id, name: item.site.name, total: 0, overdue: 0, authorized: 0 };
    site.total++;
    if (item.state === 'overdue') site.overdue++;
    if (item.authorized) site.authorized++;
    bySite.set(item.site.id, site);
  }
  return { asOf: now.toISOString(), counts, courses: [...byCourse.values()], sites: [...bySite.values()] };
}
