import { apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, readJsonObject, ApiError } from '@/lib/server/context';
import { assignmentById, auditStatementIfAction, isoDate, requiredString, type AssignmentRow } from '@/lib/server/records';
import { addMonths } from '@/lib/server/schedule';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, route: RouteContext) {
  try {
    const context = await getAdminContext(request);
    const assignment = await assignmentById(context.db, (await route.params).id);
    assertSiteAccess(context, assignment.site_id);
    const [progress, audit] = await Promise.all([
      context.db.prepare('SELECT state_json,revision,updated_at FROM assignment_progress WHERE assignment_id = ?').bind(assignment.id).first(),
      context.db.prepare(`SELECT id,action,actor_email,reason,before_json,after_json,created_at FROM audit_events
        WHERE entity_type = 'assignment' AND entity_id = ? ORDER BY created_at, id`).bind(assignment.id).all(),
    ]);
    return Response.json({ assignment, progress, audit: audit.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, route: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const assignment = await assignmentById(context.db, (await route.params).id);
    assertSiteAccess(context, assignment.site_id, 'manage');
    const body = await readJsonObject(request);
    const operation = requiredString(body.operation, 'Operation', 40);
    const reason = operation === 'send_reminder' ? null : requiredString(body.reason, 'Change reason', 500);
    const open = assignment.status === 'Not started' || assignment.status === 'In progress';
    if (!open) throw new ApiError(409, 'Only open assignments can be changed.');
    const actionId = crypto.randomUUID();
    const guard = `id = ? AND worker_id = ? AND status = ? AND due_date = ? AND last_admin_action_id IS ?`;
    const guardValues = [assignment.id, assignment.worker_id, assignment.status,
      assignment.due_date, assignment.last_admin_action_id ?? null];
    const won = `EXISTS (SELECT 1 FROM assignments WHERE id = ? AND last_admin_action_id = ?)`;

    if (operation === 'change_due_date') {
      const dueDate = isoDate(body.dueDate, 'Due date');
      if (dueDate < context.asOf.slice(0, 10)) throw new ApiError(400, 'Due date cannot be in the past.');
      if (dueDate === assignment.due_date) {
        const current = await assignmentById(context.db, assignment.id);
        if (current.status !== assignment.status || current.due_date !== assignment.due_date ||
          current.last_admin_action_id !== assignment.last_admin_action_id) {
          throw new ApiError(409, 'Assignment changed in another session. Reload and try again.');
        }
        return Response.json({ assignment, asOf: context.asOf });
      }
      const nextDue = assignment.recurrence_months ? addMonths(dueDate, assignment.recurrence_months) : null;
      const updated = { ...assignment, due_date: dueDate, next_due_at: nextDue, last_admin_action_id: actionId };
      const writes = await context.db.batch([
        context.db.prepare(`UPDATE assignments SET due_date = ?,next_due_at = ?,last_admin_action_id = ? WHERE ${guard}`)
          .bind(dueDate, nextDue, actionId, ...guardValues),
        auditStatementIfAction(context, assignment.id, 'due_date_changed', assignment.site_id, reason, assignment, updated, actionId),
      ]);
      if (!writes[0].meta.changes) throw new ApiError(409, 'Assignment changed in another session. Reload and try again.');
      return Response.json({ assignment: updated, asOf: context.asOf });
    }

    if (operation === 'cancel') {
      const updated: AssignmentRow = { ...assignment, status: 'Cancelled', cancelled_at: context.asOf, last_admin_action_id: actionId };
      const writes = await context.db.batch([
        context.db.prepare(`UPDATE assignments SET status = 'Cancelled', cancelled_at = ?,last_admin_action_id = ? WHERE ${guard}`)
          .bind(context.asOf, actionId, ...guardValues),
        context.db.prepare(`UPDATE assignment_outbox SET state = 'failed', last_error = 'Assignment cancelled'
          WHERE assignment_id = ? AND state IN ('pending','configuration_required','processing') AND ${won}`)
          .bind(assignment.id, assignment.id, actionId),
        auditStatementIfAction(context, assignment.id, 'cancelled', assignment.site_id, reason, assignment, updated, actionId),
      ]);
      if (!writes[0].meta.changes) throw new ApiError(409, 'Assignment changed in another session. Reload and try again.');
      return Response.json({ assignment: updated, asOf: context.asOf });
    }

    if (operation === 'reassign') {
      const workerId = requiredString(body.workerId, 'New worker');
      const worker = await context.db.prepare('SELECT id,site_id FROM workers WHERE id = ? AND active = 1')
        .bind(workerId).first<{ id: string; site_id: string }>();
      if (!worker || workerId === assignment.worker_id) throw new ApiError(400, 'Choose a different active worker.');
      assertSiteAccess(context, worker.site_id, 'manage');
      const conflict = await context.db.prepare(`SELECT id FROM assignments WHERE worker_id = ? AND course_id = ?
        AND status IN ('Not started','In progress')`).bind(workerId, assignment.course_id).first();
      if (conflict) throw new ApiError(409, 'The new worker already has an open assignment for this course.');
      const replacement: AssignmentRow = {
        ...assignment, id: crypto.randomUUID(), worker_id: workerId, site_id: worker.site_id,
        assigned_at: context.asOf, status: 'Not started', delivery_state: 'pending',
        delivered_at: null, completed_at: null, cancelled_at: null, last_admin_action_id: null,
      };
      const cancelled: AssignmentRow = { ...assignment, status: 'Cancelled', cancelled_at: context.asOf, last_admin_action_id: actionId };
      const writes = await context.db.batch([
        context.db.prepare(`UPDATE assignments SET status = 'Cancelled', cancelled_at = ?,last_admin_action_id = ? WHERE ${guard}`)
          .bind(context.asOf, actionId, ...guardValues),
        context.db.prepare(`UPDATE assignment_outbox SET state = 'failed', last_error = 'Assignment reassigned'
          WHERE assignment_id = ? AND state IN ('pending','configuration_required','processing') AND ${won}`)
          .bind(assignment.id, assignment.id, actionId),
        context.db.prepare(`INSERT INTO assignments
          (id,worker_id,site_id,course_id,course_version,assigned_at,due_date,status,reason,cadence,delivery_state,recurrence_months,next_due_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${won}`)
          .bind(replacement.id, replacement.worker_id, replacement.site_id, replacement.course_id,
            replacement.course_version, replacement.assigned_at, replacement.due_date,
            replacement.status, replacement.reason, replacement.cadence,
            replacement.delivery_state, replacement.recurrence_months, replacement.next_due_at,
            assignment.id, actionId),
        context.db.prepare(`INSERT INTO assignment_outbox (id,assignment_id,kind,scheduled_at,state)
          SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM assignments WHERE id = ?)`)
          .bind(crypto.randomUUID(), replacement.id, 'assignment', context.asOf, 'pending', replacement.id),
        auditStatementIfAction(context, assignment.id, 'reassigned_from', assignment.site_id, reason, assignment, cancelled, actionId),
        context.db.prepare(`INSERT INTO audit_events
          (id,entity_type,entity_id,action,actor_sub,actor_email,site_id,reason,before_json,after_json,created_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM assignments WHERE id = ?)`)
          .bind(crypto.randomUUID(), 'assignment', replacement.id, 'reassigned_to', context.actor.sub,
            context.actor.email, worker.site_id, reason, null, JSON.stringify(replacement), context.asOf, replacement.id),
      ]);
      if (!writes[0].meta.changes || !writes[2].meta.changes) {
        throw new ApiError(409, 'Assignment changed in another session. Reload and try again.');
      }
      return Response.json({ assignment: cancelled, replacement, asOf: context.asOf });
    }

    if (operation === 'send_reminder') {
      const existing = await context.db.prepare(`SELECT id FROM assignment_outbox
        WHERE assignment_id = ? AND kind = 'reminder' AND substr(scheduled_at,1,10) = ?`)
        .bind(assignment.id, context.asOf.slice(0, 10)).first<{ id: string }>();
      if (existing) return Response.json({ queued: false, reason: 'A reminder was already queued today.', asOf: context.asOf });
      const outboxId = `reminder-${assignment.id}-${context.asOf.slice(0, 10)}`;
      const scheduledAt = `${context.asOf.slice(0, 10)}T00:00:00.000Z`;
      const writes = await context.db.batch([
        context.db.prepare(`INSERT OR IGNORE INTO assignment_outbox (id,assignment_id,kind,scheduled_at,state)
          SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM assignments WHERE ${guard})`)
          .bind(outboxId, assignment.id, 'reminder', scheduledAt, 'pending', ...guardValues),
        context.db.prepare(`INSERT OR IGNORE INTO audit_events
          (id,entity_type,entity_id,action,actor_sub,actor_email,site_id,reason,before_json,after_json,created_at)
          SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS
            (SELECT 1 FROM assignment_outbox WHERE id = ?)`)
          .bind(`audit-${outboxId}`, 'assignment', assignment.id, 'reminder_queued', context.actor.sub,
            context.actor.email, assignment.site_id, null, null, JSON.stringify({ outboxId }), context.asOf,
            outboxId),
      ]);
      if (!writes[0].meta.changes) throw new ApiError(409, 'Assignment changed or a reminder was already queued today.');
      return Response.json({ queued: true, outboxId, asOf: context.asOf });
    }

    throw new ApiError(400, 'Unsupported assignment operation.');
  } catch (error) { return apiErrorResponse(error); }
}
