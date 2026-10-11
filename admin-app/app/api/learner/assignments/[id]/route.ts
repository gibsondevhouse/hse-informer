import { courseStatus, initialState, isPlayerState } from '@/lib/lms/engine';
import { getRecordedCoursePackage, isPracticePackage } from '@/lib/lms/recorded-courses';
import { replayRecordedAction } from '@/lib/lms/recorded-actions';
import {
  ApiError,
  apiErrorResponse,
  assertSameOrigin,
  getLearnerContext,
} from '@/lib/server/context';
import {
  publicLearnerAssignment,
  readLearnerAssignment,
} from '@/lib/server/learner-assignment';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, route: RouteContext) {
  try {
    const context = await getLearnerContext(request);
    const { id } = await route.params;
    const row = await readLearnerAssignment(context, id);
    if (!row) throw new ApiError(404, 'Assignment not found.');
    const course = getRecordedCoursePackage(row.course_id, row.course_version);
    const assignment = publicLearnerAssignment(row);
    if (!course || !assignment.launchable) {
      return Response.json(
        { assignment: { ...assignment, launchable: false }, state: null, revision: null },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }
    const stored: unknown = row.state_json ? JSON.parse(row.state_json) : null;
    if (stored && !isPlayerState(stored, course)) {
      throw new ApiError(500, 'Recorded progress could not be read.');
    }
    return Response.json(
      {
        assignment,
        state: stored ?? initialState(course),
        revision: row.revision ?? 0,
        practice: isPracticePackage(course.id),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, route: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await getLearnerContext(request);
    const { id } = await route.params;
    const row = await readLearnerAssignment(context, id);
    if (!row) throw new ApiError(404, 'Assignment not found.');
    if (row.status === 'Cancelled') throw new ApiError(409, 'This assignment was cancelled.');
    if (!row.approved_at || row.deliverable !== 1) {
      throw new ApiError(409, 'This course release is unavailable.');
    }
    const course = getRecordedCoursePackage(row.course_id, row.course_version);
    if (!course) throw new ApiError(409, 'This course package is unavailable.');

    const raw = await request.text();
    if (raw.length > 65_536) throw new ApiError(413, 'Progress action is too large.');
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'Progress action must be JSON.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new ApiError(400, 'Progress action must be an object.');
    }
    const input = body as Record<string, unknown>;
    const expectedRevision = input.expectedRevision;
    if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0) {
      throw new ApiError(400, 'A progress revision is required.');
    }
    if (expectedRevision !== (row.revision ?? 0)) {
      throw new ApiError(409, 'Progress changed in another session. Reload to continue.');
    }
    const oldState: unknown = row.state_json ? JSON.parse(row.state_json) : initialState(course);
    if (!isPlayerState(oldState, course)) {
      throw new ApiError(500, 'Recorded progress could not be read.');
    }
    const now = new Date().toISOString();
    const result = replayRecordedAction(course, oldState, input.action, now);
    if (!result) throw new ApiError(400, 'This learner action is not allowed.');
    if (row.status === 'Knowledge Complete' &&
        !['open-overview', 'open-lesson', 'go-slide', 'back', 'open-assessment', 'open-summary'].includes(result.action.type)) {
      throw new ApiError(409, 'This completion is final.');
    }
    const serialized = JSON.stringify(result.state);
    if (serialized === JSON.stringify(oldState)) {
      return Response.json({ state: oldState, revision: row.revision ?? 0, status: row.status });
    }
    const nextRevision = (row.revision ?? 0) + 1;
    const computed = courseStatus(course, result.state);
    const status =
      computed === 'knowledge-complete'
        ? 'Knowledge Complete'
        : computed === 'in-progress' ||
            row.status === 'In progress' ||
            result.state.view !== 'overview'
          ? 'In progress'
          : 'Not started';
    const completedAt = status === 'Knowledge Complete' ? row.completed_at ?? now : null;
    const attemptCount = result.state.assessment.attempts.length;
    const previousAttemptCount = oldState.assessment.attempts.length;
    const actionId = crypto.randomUUID();
    const wasSaved = `EXISTS (SELECT 1 FROM assignment_progress p
                         WHERE p.assignment_id=? AND p.revision=? AND p.last_action_id=?)`;
    const statements: D1PreparedStatement[] = [
      context.db
        .prepare(
          `INSERT INTO assignment_progress(assignment_id,state_json,revision,last_action_id,updated_at)
           SELECT ?,?,?,?,? WHERE EXISTS
             (SELECT 1 FROM assignments WHERE id=? AND worker_id=? AND status<>'Cancelled')
           ON CONFLICT(assignment_id) DO UPDATE SET
             state_json=excluded.state_json,
             revision=excluded.revision,
             last_action_id=excluded.last_action_id,
             updated_at=excluded.updated_at
           WHERE assignment_progress.revision=?
             AND EXISTS (SELECT 1 FROM assignments
                          WHERE id=? AND worker_id=? AND status<>'Cancelled')`,
        )
        .bind(
          id, serialized, nextRevision, actionId, now,
          id, context.worker.id, expectedRevision, id, context.worker.id,
        ),
      context.db
        .prepare(
          `UPDATE assignments SET status=?,completed_at=?
           WHERE id=? AND worker_id=? AND status<>'Cancelled' AND ${wasSaved}`,
        )
        .bind(status, completedAt, id, context.worker.id, id, nextRevision, actionId),
    ];
    if (status !== row.status || attemptCount > previousAttemptCount) {
      const latest = result.state.assessment.attempts.at(-1);
      statements.push(
        context.db.prepare(
          `INSERT INTO audit_events
             (id,entity_type,entity_id,action,actor_sub,actor_email,site_id,reason,before_json,after_json,created_at)
           SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${wasSaved}`,
        ).bind(
          crypto.randomUUID(),
          'assignment',
          id,
          attemptCount > previousAttemptCount ? 'assessment_submitted' : 'learner_status_changed',
          context.actor.sub,
          context.actor.email,
          row.site_id,
          null,
          JSON.stringify({ status: row.status, attempts: previousAttemptCount }),
          JSON.stringify({
            status,
            attempts: attemptCount,
            score: attemptCount > previousAttemptCount ? latest?.percent : undefined,
            passed: attemptCount > previousAttemptCount ? latest?.passed : undefined,
            courseId: row.course_id,
            version: row.course_version,
            practice: isPracticePackage(row.course_id),
          }),
          now,
          id, nextRevision, actionId,
        ),
      );
    }
    const writes = await context.db.batch(statements);
    if (!writes[0].meta.changes || !writes[1].meta.changes) {
      throw new ApiError(409, 'Progress changed in another session. Reload to continue.');
    }
    return Response.json(
      { state: result.state, revision: nextRevision, status, completedAt },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
