import { getRecordedCoursePackage } from '@/lib/lms/recorded-courses';
import { apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, permittedSiteIds, readJsonObject, ApiError } from '@/lib/server/context';
import { auditStatement, isoDate, requiredString, sitePlaceholders, type AssignmentRow } from '@/lib/server/records';
import { addMonths } from '@/lib/server/schedule';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const ids = await permittedSiteIds(context);
    if (!ids.length) return Response.json({ assignments: [], asOf: context.asOf });
    const requestedSite = new URL(request.url).searchParams.get('siteId');
    if (requestedSite) assertSiteAccess(context, requestedSite);
    const visible = requestedSite ? [requestedSite] : ids;
    const result = await context.db.prepare(`SELECT * FROM assignments WHERE site_id IN (${sitePlaceholders(visible)}) ORDER BY assigned_at DESC, id DESC`)
      .bind(...visible).all<AssignmentRow>();
    return Response.json({ assignments: result.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const body = await readJsonObject(request);
    const workerIds = body.workerIds;
    if (!Array.isArray(workerIds) || workerIds.length < 1 || workerIds.length > 100 ||
      !workerIds.every((id) => typeof id === 'string' && id.length > 0) ||
      new Set(workerIds).size !== workerIds.length) {
      throw new ApiError(400, 'Choose 1 to 100 distinct workers.');
    }
    const courseId = requiredString(body.courseId, 'Course', 100);
    const version = requiredString(body.version, 'Course version', 100);
    const dueDate = isoDate(body.dueDate, 'Due date');
    if (dueDate < context.asOf.slice(0, 10)) throw new ApiError(400, 'Due date cannot be in the past.');
    const reason = requiredString(body.reason, 'Assignment reason', 500);
    const cadence = requiredString(body.cadence, 'Cadence', 100);
    const recurrenceMonths: number | null = body.recurrenceMonths == null
      ? null : typeof body.recurrenceMonths === 'number' ? body.recurrenceMonths : Number.NaN;
    if (recurrenceMonths !== null && (!Number.isInteger(recurrenceMonths) || recurrenceMonths < 1 || recurrenceMonths > 120)) {
      throw new ApiError(400, 'Recurrence must be 1 to 120 months.');
    }
    const release = await context.db.prepare(`SELECT course_id, version, title, launch_path FROM course_releases
      WHERE course_id = ? AND version = ? AND approved_at IS NOT NULL AND deliverable = 1`)
      .bind(courseId, version).first<{ course_id: string; version: string; title: string; launch_path: string }>();
    if (!release || !getRecordedCoursePackage(courseId, version)) {
      throw new ApiError(409, 'This course version is not approved and deliverable.');
    }
    const placeholders = workerIds.map(() => '?').join(',');
    const workers = await context.db.prepare(`SELECT w.id, w.site_id FROM workers w
      JOIN sites s ON s.id = w.site_id AND s.active = 1 WHERE w.id IN (${placeholders}) AND w.active = 1`)
      .bind(...workerIds).all<{ id: string; site_id: string }>();
    if (workers.results.length !== workerIds.length) throw new ApiError(400, 'One or more workers are not active.');
    for (const worker of workers.results) assertSiteAccess(context, worker.site_id, 'manage');
    const open = await context.db.prepare(`SELECT worker_id FROM assignments
      WHERE worker_id IN (${placeholders}) AND course_id = ? AND status IN ('Not started','In progress')`)
      .bind(...workerIds, courseId).all<{ worker_id: string }>();
    const openIds = new Set(open.results.map((row) => row.worker_id));
    const skipped = workerIds.filter((workerId) => openIds.has(workerId)).map((workerId) => ({ workerId, reason: 'An open assignment already exists.' }));
    const created: AssignmentRow[] = [];
    const statements: D1PreparedStatement[] = [];
    const byId = new Map(workers.results.map((worker) => [worker.id, worker]));
    for (const workerId of workerIds) {
      if (openIds.has(workerId)) continue;
      const worker = byId.get(workerId)!;
      const assignment: AssignmentRow = {
        id: crypto.randomUUID(), worker_id: workerId, site_id: worker.site_id,
        course_id: courseId, course_version: version, assigned_at: context.asOf,
        due_date: dueDate, status: 'Not started', reason, cadence,
        delivery_state: 'pending', delivered_at: null, completed_at: null,
        cancelled_at: null, recurrence_months: recurrenceMonths,
        next_due_at: recurrenceMonths ? addMonths(dueDate, recurrenceMonths) : null,
      };
      created.push(assignment);
      statements.push(context.db.prepare(`INSERT INTO assignments
        (id,worker_id,site_id,course_id,course_version,assigned_at,due_date,status,reason,cadence,delivery_state,recurrence_months,next_due_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(assignment.id, workerId, worker.site_id, courseId, version, context.asOf, dueDate,
          'Not started', reason, cadence, 'pending', recurrenceMonths, assignment.next_due_at));
      statements.push(context.db.prepare(`INSERT INTO assignment_outbox
        (id,assignment_id,kind,scheduled_at,state) VALUES (?,?,?,?,?)`)
        .bind(crypto.randomUUID(), assignment.id, 'assignment', context.asOf, 'pending'));
      statements.push(auditStatement(context, 'assignment', assignment.id, 'created', worker.site_id, reason, null, assignment));
    }
    if (statements.length) await context.db.batch(statements);
    return Response.json({ created, skipped, asOf: context.asOf }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
