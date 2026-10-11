import { apiErrorResponse, getLearnerContext } from '@/lib/server/context';
import { getRecordedCoursePackage } from '@/lib/lms/recorded-courses';
import {
  publicLearnerAssignment,
  type LearnerAssignmentRow,
} from '@/lib/server/learner-assignment';

export async function GET(request: Request) {
  try {
    const context = await getLearnerContext(request);
    const rows = await context.db
      .prepare(
        `SELECT a.id,a.worker_id,a.site_id,a.course_id,a.course_version,
                r.title,r.approved_at,r.deliverable,a.due_date,a.assigned_at,
                a.status,a.reason,a.delivery_state,a.completed_at,a.cancelled_at,
                p.state_json,p.revision
           FROM assignments a
           JOIN course_releases r ON r.course_id=a.course_id AND r.version=a.course_version
           LEFT JOIN assignment_progress p ON p.assignment_id=a.id
          WHERE a.worker_id=?
          ORDER BY CASE WHEN a.status='Cancelled' THEN 1 ELSE 0 END,
                   a.due_date ASC,a.assigned_at DESC`,
      )
      .bind(context.worker.id)
      .all<LearnerAssignmentRow>();
    const assignments = rows.results.map((row) => ({
      ...publicLearnerAssignment(row),
      launchable:
        publicLearnerAssignment(row).launchable &&
        getRecordedCoursePackage(row.course_id, row.course_version) !== null,
    }));
    return Response.json(
      { worker: context.worker, assignments, asOf: context.asOf },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
