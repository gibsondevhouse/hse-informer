import { escapeCsv } from '@/lib/qualification';
import {
  ApiError, apiErrorResponse, assertSiteAccess, getAdminContext, permittedSiteIds,
} from '@/lib/server/context';
import { loadQualificationSnapshot, loadScopedAudit } from '@/lib/server/qualification-store';

const headers = [
  'record_type', 'worker_id', 'worker_name', 'worker_role', 'site_id', 'site_name',
  'course_id', 'course_version', 'assignment_id', 'assignment_reason',
  'assigned_at', 'due_date', 'knowledge_status', 'completed_at',
  'evidence_step', 'evidence_result', 'evidence_reference', 'reference_version',
  'expires_at', 'authorization_scope', 'restrictions', 'actor', 'recorded_at',
  'change_reason', 'before_json', 'after_json',
] as const;
type Column = (typeof headers)[number];
type Row = Partial<Record<Column, string | null>>;

function line(row: Row) {
  return headers.map((header) => escapeCsv(row[header] ?? '')).join(',');
}

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    if (context.actor.role === 'evaluator')
      throw new ApiError(403, 'Evidence export requires an admin, site manager, or auditor.');
    const params = new URL(request.url).searchParams;
    const siteId = params.get('site');
    const allowed = await permittedSiteIds(context);
    if (siteId && siteId !== 'all') {
      assertSiteAccess(context, siteId);
      if (!allowed.includes(siteId)) throw new ApiError(404, 'Site not found in your permitted scope.');
    }
    const siteIds = siteId && siteId !== 'all' ? [siteId] : allowed;
    const workerId = params.get('worker');
    const snapshot = await loadQualificationSnapshot(context.db, siteIds);
    const worker = workerId ? snapshot.workers.find((item) => item.id === workerId) : null;
    if (workerId && !worker) throw new ApiError(404, 'Worker not found in your permitted sites.');
    const workers = worker ? [worker] : snapshot.workers;
    const workerIds = new Set(workers.map((item) => item.id));
    const assignments = snapshot.assignments.filter((item) => workerIds.has(item.workerId));
    const events = snapshot.events.filter((item) => workerIds.has(item.workerId));
    const assignmentIds = new Set(assignments.map((item) => item.id));
    const eventIds = new Set(events.map((item) => item.id));
    const requirementIds = new Set(snapshot.requirements
      .filter((item) => workers.some((person) => person.siteId === item.siteId && person.groupName === item.groupName))
      .map((item) => item.id));
    const audit = (await loadScopedAudit(context.db, siteIds)).filter((item) =>
      !workerId || workerIds.has(item.entity_id) || assignmentIds.has(item.entity_id) ||
      eventIds.has(item.entity_id) || requirementIds.has(item.entity_id),
    );
    const siteName = new Map(snapshot.sites.map((item) => [item.id, item.name]));
    const workerById = new Map(snapshot.workers.map((item) => [item.id, item]));
    const assignmentById = new Map(assignments.map((item) => [item.id, item]));
    const eventById = new Map(events.map((item) => [item.id, item]));
    const rows: Row[] = [];
    for (const item of snapshot.requirements) {
      const matchingWorkers = worker
        ? (worker.siteId === item.siteId && worker.groupName === item.groupName ? [worker] : [])
        : [null];
      for (const person of matchingWorkers) rows.push({
        record_type: 'site_role_requirement',
        worker_id: person?.id, worker_name: person?.name,
        worker_role: item.groupName, site_id: item.siteId,
        site_name: siteName.get(item.siteId), course_id: item.courseId,
        course_version: item.courseVersion,
        evidence_step: [
          item.localInstructionRequired && 'local_instruction',
          item.prerequisiteRequired && 'prerequisite',
          item.practicalEvaluationRequired && 'practical_evaluation',
          item.authorizationRequired && 'authorization',
        ].filter(Boolean).join(';'),
        recorded_at: item.updatedAt,
      });
    }
    for (const item of assignments) {
      const person = workerById.get(item.workerId);
      rows.push({
        record_type: 'assignment', worker_id: item.workerId,
        worker_name: person?.name, worker_role: person?.groupName,
        site_id: item.siteId, site_name: siteName.get(item.siteId),
        course_id: item.courseId, course_version: item.courseVersion,
        assignment_id: item.id, assignment_reason: item.reason,
        assigned_at: item.assignedAt, due_date: item.dueDate,
        knowledge_status: item.status, completed_at: item.completedAt,
        evidence_result: item.deliveryState, recorded_at: item.assignedAt,
      });
    }
    for (const item of events) {
      const person = workerById.get(item.workerId);
      rows.push({
        record_type: 'qualification_evidence', worker_id: item.workerId,
        worker_name: person?.name, worker_role: person?.groupName,
        site_id: item.siteId, site_name: siteName.get(item.siteId),
        course_id: item.courseId, course_version: item.courseVersion,
        assignment_id: item.assignmentId, evidence_step: item.step,
        evidence_result: item.outcome, evidence_reference: item.evidenceRef,
        reference_version: item.referenceVersion, expires_at: item.expiresAt,
        authorization_scope: item.scope, restrictions: item.restrictions,
        actor: item.actorEmail, recorded_at: item.createdAt,
        change_reason: item.reason,
      });
    }
    for (const item of audit) {
      const linkedAssignment = assignmentById.get(item.entity_id);
      const linkedEvent = eventById.get(item.entity_id);
      const person = linkedAssignment
        ? workerById.get(linkedAssignment.workerId)
        : linkedEvent
          ? workerById.get(linkedEvent.workerId)
          : workerById.get(item.entity_id);
      rows.push({
        record_type: `audit:${item.entity_type}:${item.action}`,
        worker_id: person?.id, worker_name: person?.name,
        worker_role: person?.groupName,
        site_id: item.site_id, site_name: siteName.get(item.site_id ?? ''),
        course_id: linkedAssignment?.courseId ?? linkedEvent?.courseId,
        course_version: linkedAssignment?.courseVersion ?? linkedEvent?.courseVersion,
        assignment_id: linkedAssignment?.id ?? linkedEvent?.assignmentId,
        actor: item.actor_email, recorded_at: item.created_at,
        change_reason: item.reason, before_json: item.before_json,
        after_json: item.after_json,
      });
    }
    rows.sort((a, b) =>
      String(a.recorded_at ?? '').localeCompare(String(b.recorded_at ?? '')) ||
      String(a.record_type ?? '').localeCompare(String(b.record_type ?? '')),
    );
    const csv = [headers.map(escapeCsv).join(','), ...rows.map(line)].join('\r\n') + '\r\n';
    const now = new Date().toISOString();
    if (siteIds.length) await context.db.batch(siteIds.map((id) => context.db.prepare(`INSERT INTO audit_events
      (id, entity_type, entity_id, action, actor_sub, actor_email, site_id,
       reason, before_json, after_json, created_at)
      VALUES (?, 'evidence_export', ?, 'downloaded', ?, ?, ?, ?, NULL, ?, ?)`).bind(
      crypto.randomUUID(), workerId ?? id, context.actor.sub, context.actor.email,
      id, workerId ? `Worker evidence export: ${workerId}` : 'Site evidence export',
      JSON.stringify({ siteId: id, workerId, rowCount: rows.length }), now,
    )));
    const filename = workerId
      ? `worker-evidence-${workerId.replaceAll(/[^a-zA-Z0-9_-]/g, '_')}.csv`
      : 'site-evidence.csv';
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
