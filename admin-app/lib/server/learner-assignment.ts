import type { LearnerContext } from './context';

export type LearnerAssignmentRow = {
  id: string;
  worker_id: string;
  site_id: string;
  course_id: string;
  course_version: string;
  title: string;
  approved_at: string | null;
  deliverable: number;
  due_date: string;
  assigned_at: string;
  status: 'Not started' | 'In progress' | 'Knowledge Complete' | 'Cancelled';
  reason: string;
  delivery_state: string;
  completed_at: string | null;
  cancelled_at: string | null;
  state_json: string | null;
  revision: number | null;
};

export async function readLearnerAssignment(
  context: LearnerContext,
  id: string,
): Promise<LearnerAssignmentRow | null> {
  return context.db
    .prepare(
      `SELECT a.id,a.worker_id,a.site_id,a.course_id,a.course_version,
              r.title,r.approved_at,r.deliverable,a.due_date,a.assigned_at,
              a.status,a.reason,a.delivery_state,a.completed_at,a.cancelled_at,
              p.state_json,p.revision
         FROM assignments a
         JOIN course_releases r ON r.course_id=a.course_id AND r.version=a.course_version
         LEFT JOIN assignment_progress p ON p.assignment_id=a.id
        WHERE a.id=? AND a.worker_id=?`,
    )
    .bind(id, context.worker.id)
    .first<LearnerAssignmentRow>();
}

export function publicLearnerAssignment(row: LearnerAssignmentRow) {
  return {
    id: row.id,
    courseId: row.course_id,
    version: row.course_version,
    title: row.title,
    dueDate: row.due_date,
    assignedAt: row.assigned_at,
    status: row.status,
    reason: row.reason,
    deliveryState: row.delivery_state,
    completedAt: row.completed_at,
    launchable:
      row.approved_at !== null &&
      row.deliverable === 1 &&
      row.status !== 'Cancelled',
    href: `/learn/assignments/${encodeURIComponent(row.id)}`,
  };
}
