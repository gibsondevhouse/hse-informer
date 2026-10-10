import type {
  QualificationAssignment,
  QualificationEvent,
  QualificationSnapshot,
  QualificationWorker,
  SiteRoleRequirement,
} from '@/lib/qualification';
import { ApiError } from '@/lib/server/context';

type SiteRow = { id: string; name: string; code: string; location: string };
type ReleaseRow = { course_id: string; version: string; title: string };
type WorkerRow = {
  id: string; name: string; email: string; site_id: string;
  group_name: string; active: number;
};
type RequirementRow = {
  id: string; site_id: string; group_name: string; course_id: string;
  course_version: string;
  local_instruction_required: number; prerequisite_required: number;
  practical_evaluation_required: number; authorization_required: number;
  updated_at: string;
};
type AssignmentRow = {
  id: string; worker_id: string; site_id: string; course_id: string;
  course_version: string; assigned_at: string; due_date: string;
  status: QualificationAssignment['status']; reason: string;
  delivery_state: string; completed_at: string | null; cancelled_at: string | null;
};
type EventRow = {
  id: string; worker_id: string; site_id: string; course_id: string;
  assignment_id: string | null; course_version: string;
  step: QualificationEvent['step']; outcome: QualificationEvent['outcome'];
  evidence_ref: string; reference_version: string; expires_at: string | null;
  scope: string; restrictions: string; actor_sub: string; actor_email: string;
  reason: string; supersedes_id: string | null; created_at: string;
};

function scoped(table: string, column: string, siteIds: string[]) {
  return `SELECT * FROM ${table} WHERE ${column} IN (${siteIds.map(() => '?').join(',')})`;
}

export async function loadQualificationSnapshot(db: D1Database, siteIds: string[]): Promise<QualificationSnapshot> {
  if (!siteIds.length) {
    return { asOf: new Date().toISOString(), sites: [], releases: [], workers: [], requirements: [], assignments: [], events: [] };
  }
  const [siteResult, releaseResult, workerResult, requirementResult, assignmentResult, eventResult] = await Promise.all([
    db.prepare(scoped('sites', 'id', siteIds) + ' ORDER BY name').bind(...siteIds).all<SiteRow>(),
    db.prepare('SELECT course_id, version, title FROM course_releases WHERE approved_at IS NOT NULL AND deliverable = 1 ORDER BY title, version').all<ReleaseRow>(),
    db.prepare(scoped('workers', 'site_id', siteIds) + ' ORDER BY name').bind(...siteIds).all<WorkerRow>(),
    db.prepare(scoped('site_role_requirements', 'site_id', siteIds) + ' ORDER BY group_name, course_id').bind(...siteIds).all<RequirementRow>(),
    db.prepare(scoped('assignments', 'site_id', siteIds) + ' ORDER BY assigned_at DESC').bind(...siteIds).all<AssignmentRow>(),
    db.prepare(scoped('qualification_events', 'site_id', siteIds) + ' ORDER BY created_at, id').bind(...siteIds).all<EventRow>(),
  ]);
  return {
    asOf: new Date().toISOString(),
    sites: siteResult.results,
    releases: releaseResult.results.map((row) => ({ courseId: row.course_id, version: row.version, title: row.title })),
    workers: workerResult.results.map((row): QualificationWorker => ({
      id: row.id, name: row.name, email: row.email, siteId: row.site_id,
      groupName: row.group_name, active: row.active === 1,
    })),
    requirements: requirementResult.results.map((row): SiteRoleRequirement => ({
      id: row.id, siteId: row.site_id, groupName: row.group_name,
      courseId: row.course_id, courseVersion: row.course_version,
      localInstructionRequired: row.local_instruction_required === 1,
      prerequisiteRequired: row.prerequisite_required === 1,
      practicalEvaluationRequired: row.practical_evaluation_required === 1,
      authorizationRequired: row.authorization_required === 1,
      updatedAt: row.updated_at,
    })),
    assignments: assignmentResult.results.map((row): QualificationAssignment => ({
      id: row.id, workerId: row.worker_id, siteId: row.site_id,
      courseId: row.course_id, courseVersion: row.course_version,
      assignedAt: row.assigned_at, dueDate: row.due_date,
      status: row.status, reason: row.reason, deliveryState: row.delivery_state,
      completedAt: row.completed_at, cancelledAt: row.cancelled_at,
    })),
    events: eventResult.results.map((row): QualificationEvent => ({
      id: row.id, workerId: row.worker_id, siteId: row.site_id,
      courseId: row.course_id, assignmentId: row.assignment_id,
      courseVersion: row.course_version, step: row.step, outcome: row.outcome,
      evidenceRef: row.evidence_ref, referenceVersion: row.reference_version,
      expiresAt: row.expires_at, scope: row.scope, restrictions: row.restrictions,
      actorSub: row.actor_sub, actorEmail: row.actor_email, reason: row.reason,
      supersedesId: row.supersedes_id, createdAt: row.created_at,
    })),
  };
}

export async function saveRequirement(
  db: D1Database,
  requirement: SiteRoleRequirement,
  audit: { actorSub: string; actorEmail: string; reason: string; before: SiteRoleRequirement | null },
) {
  const now = new Date().toISOString();
  const id = audit.before?.id ?? requirement.id;
  const writes = [
    db.prepare(`INSERT INTO site_role_requirements
      (id, site_id, group_name, course_id, course_version, local_instruction_required,
       prerequisite_required, practical_evaluation_required,
       authorization_required, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(site_id, group_name, course_id) DO UPDATE SET
       course_version = excluded.course_version,
       local_instruction_required = excluded.local_instruction_required,
       prerequisite_required = excluded.prerequisite_required,
       practical_evaluation_required = excluded.practical_evaluation_required,
       authorization_required = excluded.authorization_required,
       updated_at = excluded.updated_at`).bind(
      id, requirement.siteId, requirement.groupName, requirement.courseId, requirement.courseVersion,
      Number(requirement.localInstructionRequired), Number(requirement.prerequisiteRequired),
      Number(requirement.practicalEvaluationRequired), Number(requirement.authorizationRequired), now,
    ),
    db.prepare(`INSERT INTO audit_events
      (id, entity_type, entity_id, action, actor_sub, actor_email,
       site_id, reason, before_json, after_json, created_at)
      VALUES (?, 'site_role_requirement', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      crypto.randomUUID(), id, audit.before ? 'updated' : 'created',
      audit.actorSub, audit.actorEmail, requirement.siteId, audit.reason,
      audit.before ? JSON.stringify(audit.before) : null,
      JSON.stringify({ ...requirement, id, updatedAt: now }), now,
    ),
  ];
  await db.batch(writes);
  return { ...requirement, id, updatedAt: now };
}

export async function appendQualificationEvent(db: D1Database, event: QualificationEvent) {
  const result = await db.batch([
    db.prepare(`INSERT INTO qualification_events
      (id, worker_id, site_id, course_id, assignment_id, course_version,
       step, outcome, evidence_ref, reference_version, expires_at, scope,
       restrictions, actor_sub, actor_email, reason, supersedes_id, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT id FROM qualification_events
        WHERE worker_id = ? AND site_id = ? AND course_id = ? AND step = ?
        ORDER BY created_at DESC, id DESC LIMIT 1) IS ?`).bind(
      event.id, event.workerId, event.siteId, event.courseId,
      event.assignmentId, event.courseVersion, event.step, event.outcome,
      event.evidenceRef, event.referenceVersion, event.expiresAt,
      event.scope, event.restrictions, event.actorSub, event.actorEmail,
      event.reason, event.supersedesId, event.createdAt,
      event.workerId, event.siteId, event.courseId, event.step, event.supersedesId,
    ),
    db.prepare(`INSERT INTO audit_events
      (id, entity_type, entity_id, action, actor_sub, actor_email,
       site_id, reason, before_json, after_json, created_at)
      SELECT ?, 'qualification_event', ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM qualification_events WHERE id = ?`).bind(
      crypto.randomUUID(), event.id, event.supersedesId ? 'corrected' : 'recorded',
      event.actorSub, event.actorEmail, event.siteId, event.reason,
      event.supersedesId ? JSON.stringify({ supersedesId: event.supersedesId }) : null,
      JSON.stringify(event), event.createdAt, event.id,
    ),
  ]);
  if (result[0].meta.changes !== 1)
    throw new ApiError(409, 'This evidence changed. Refresh and review the latest record.');
}

export type AuditRow = {
  id: string; entity_type: string; entity_id: string; action: string;
  actor_sub: string; actor_email: string; site_id: string | null;
  reason: string | null; before_json: string | null; after_json: string | null;
  created_at: string;
};

export async function loadScopedAudit(db: D1Database, siteIds: string[]): Promise<AuditRow[]> {
  if (!siteIds.length) return [];
  const result = await db.prepare(
    scoped('audit_events', 'site_id', siteIds) + ' ORDER BY created_at, id',
  ).bind(...siteIds).all<AuditRow>();
  return result.results;
}
