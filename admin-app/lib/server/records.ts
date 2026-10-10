import { ApiError, type AdminContext } from './context';

export type AssignmentRow = {
  id: string;
  worker_id: string;
  site_id: string;
  course_id: string;
  course_version: string;
  assigned_at: string;
  due_date: string;
  status: 'Not started' | 'In progress' | 'Knowledge Complete' | 'Cancelled';
  reason: string;
  cadence: string;
  delivery_state: 'pending' | 'configuration_required' | 'sent' | 'failed';
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  recurrence_months: number | null;
  next_due_at: string | null;
  last_admin_action_id?: string | null;
};

export function requiredString(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new ApiError(400, `${label} is required and must be ${max} characters or less.`);
  }
  return value.trim();
}

export function isoDate(value: unknown, label: string): string {
  const date = requiredString(value, label, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ApiError(400, `${label} must be a valid YYYY-MM-DD date.`);
  }
  return date;
}

export function auditStatement(
  context: AdminContext,
  entityType: string,
  entityId: string,
  action: string,
  siteId: string | null,
  reason: string | null,
  before: unknown,
  after: unknown,
): D1PreparedStatement {
  return context.db
    .prepare(`INSERT INTO audit_events
      (id, entity_type, entity_id, action, actor_sub, actor_email, site_id, reason, before_json, after_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`) 
    .bind(
      crypto.randomUUID(),
      entityType,
      entityId,
      action,
      context.actor.sub,
      context.actor.email,
      siteId,
      reason,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      context.asOf,
    );
}

/** Append audit only when the preceding guarded assignment mutation won. */
export function auditStatementIfAction(
  context: AdminContext,
  entityId: string,
  action: string,
  siteId: string,
  reason: string | null,
  before: unknown,
  after: unknown,
  actionId: string,
): D1PreparedStatement {
  return context.db.prepare(`INSERT INTO audit_events
    (id,entity_type,entity_id,action,actor_sub,actor_email,site_id,reason,before_json,after_json,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS
      (SELECT 1 FROM assignments WHERE id = ? AND last_admin_action_id = ?)`)
    .bind(crypto.randomUUID(), 'assignment', entityId, action, context.actor.sub, context.actor.email,
      siteId, reason, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after),
      context.asOf, entityId, actionId);
}

export async function assignmentById(db: D1Database, id: string): Promise<AssignmentRow> {
  const row = await db.prepare('SELECT * FROM assignments WHERE id = ?').bind(id).first<AssignmentRow>();
  if (!row) throw new ApiError(404, 'Assignment not found.');
  return row;
}

export function sitePlaceholders(ids: string[]): string {
  return ids.map(() => '?').join(',');
}
