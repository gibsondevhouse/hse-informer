import { getRecordedCoursePackage } from '@/lib/lms/recorded-courses';
import { ApiError, apiErrorResponse, getDatabase, runtimeEnv } from '@/lib/server/context';
import { addMonths, recurrenceId } from '@/lib/server/schedule';

type DueRecurrence = {
  id: string; worker_id: string; site_id: string; course_id: string; course_version: string;
  due_date: string; cadence: string; recurrence_months: number; next_due_at: string;
};
type PendingDelivery = {
  id: string; assignment_id: string; kind: 'assignment' | 'reminder'; attempts: number;
  worker_email: string; worker_name: string; course_id: string; course_version: string;
  course_title: string; due_date: string; site_id: string;
};

function systemAudit(db: D1Database, id: string, assignmentId: string, siteId: string, action: string, now: string, detail: unknown) {
  return db.prepare(`INSERT OR IGNORE INTO audit_events
    (id,entity_type,entity_id,action,actor_sub,actor_email,site_id,reason,before_json,after_json,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM assignments WHERE id = ?)`)
    .bind(id, 'assignment', assignmentId, action, 'system:job', 'job@hse-informer.internal', siteId,
      null, null, JSON.stringify(detail), now, assignmentId);
}

function deliveryAudit(db: D1Database, id: string, delivery: PendingDelivery, action: string, now: string, detail: unknown, claimToken: string, state: string) {
  return db.prepare(`INSERT OR IGNORE INTO audit_events
    (id,entity_type,entity_id,action,actor_sub,actor_email,site_id,reason,before_json,after_json,created_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS
      (SELECT 1 FROM assignment_outbox WHERE id = ? AND claim_token = ? AND state = ?)`)
    .bind(id, 'assignment', delivery.assignment_id, action, 'system:job', 'job@hse-informer.internal',
      delivery.site_id, null, null, JSON.stringify(detail), now, delivery.id, claimToken, state);
}

/** An external scheduler calls this endpoint with a secret. Runs are idempotent by source assignment and outbox ID. */
export async function POST(request: Request) {
  try {
    const config = runtimeEnv();
    if (!config.HSE_JOB_TOKEN || config.HSE_JOB_TOKEN.length < 24) throw new ApiError(503, 'Job authentication is not configured.');
    if (request.headers.get('Authorization') !== `Bearer ${config.HSE_JOB_TOKEN}`) throw new ApiError(401, 'Invalid job token.');
    const db = getDatabase();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const due = await db.prepare(`SELECT a.id,a.worker_id,a.site_id,a.course_id,a.course_version,a.due_date,a.cadence,
      a.recurrence_months,a.next_due_at FROM assignments a
      JOIN workers w ON w.id = a.worker_id AND w.active = 1
      JOIN sites s ON s.id = a.site_id AND s.active = 1
      JOIN course_releases r ON r.course_id = a.course_id AND r.version = a.course_version
        AND r.approved_at IS NOT NULL AND r.deliverable = 1
      WHERE a.status = 'Knowledge Complete' AND a.next_due_at IS NOT NULL AND a.next_due_at <= ?
        AND a.recurrence_months BETWEEN 1 AND 120 ORDER BY a.next_due_at LIMIT 50`)
      .bind(today).all<DueRecurrence>();
    let renewed = 0;
    for (const source of due.results) {
      if (!getRecordedCoursePackage(source.course_id, source.course_version)) continue;
      const open = await db.prepare(`SELECT id FROM assignments WHERE worker_id = ? AND course_id = ?
        AND status IN ('Not started','In progress') LIMIT 1`).bind(source.worker_id, source.course_id).first();
      if (open) continue;
      const id = await recurrenceId(source.id);
      const nextDue = addMonths(source.next_due_at, source.recurrence_months);
      const result = await db.batch([
        db.prepare(`INSERT OR IGNORE INTO assignments
          (id,worker_id,site_id,course_id,course_version,assigned_at,due_date,status,reason,cadence,
            delivery_state,recurrence_months,next_due_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, source.worker_id, source.site_id, source.course_id, source.course_version,
            now, source.next_due_at, 'Not started', 'Scheduled recurrence', source.cadence,
            'pending', source.recurrence_months, nextDue),
        db.prepare(`INSERT OR IGNORE INTO assignment_outbox (id,assignment_id,kind,scheduled_at,state)
          SELECT ?,id,'assignment',?,'pending' FROM assignments WHERE id = ?`)
          .bind(`outbox-${id}`, now, id),
        db.prepare(`UPDATE assignments SET next_due_at = NULL WHERE id = ? AND next_due_at = ?
          AND EXISTS (SELECT 1 FROM assignments WHERE id = ?)`)
          .bind(source.id, source.next_due_at, id),
        systemAudit(db, `audit-${id}`, id, source.site_id, 'recurrence_created', now, { sourceAssignmentId: source.id }),
      ]);
      if (result[0].meta.changes) renewed += 1;
    }

    const providerUrl = config.HSE_NOTIFICATION_WEBHOOK;
    const providerToken = config.HSE_NOTIFICATION_TOKEN;
    const deliveries = await db.prepare(`SELECT o.id,o.assignment_id,o.kind,o.attempts,
      w.email AS worker_email,w.name AS worker_name,
      a.course_id,a.course_version,a.due_date,a.site_id,r.title AS course_title
      FROM assignment_outbox o JOIN assignments a ON a.id = o.assignment_id
      JOIN workers w ON w.id = a.worker_id AND w.active = 1
      JOIN sites s ON s.id = a.site_id AND s.active = 1
      JOIN course_releases r ON r.course_id = a.course_id AND r.version = a.course_version
        AND r.approved_at IS NOT NULL AND r.deliverable = 1
      WHERE (o.state IN ('pending','configuration_required','failed') OR
        (o.state = 'processing' AND o.claim_until <= ?)) AND o.attempts < 3
        AND o.scheduled_at <= ? AND a.status IN ('Not started','In progress')
      ORDER BY o.scheduled_at,o.id LIMIT 50`).bind(now, now).all<PendingDelivery>();
    let sent = 0;
    let failed = 0;
    let configurationRequired = 0;
    for (const delivery of deliveries.results) {
      const claimToken = crypto.randomUUID();
      const claimUntil = new Date(Date.now() + 5 * 60_000).toISOString();
      const claim = await db.prepare(`UPDATE assignment_outbox SET state = 'processing',claim_token = ?,claim_until = ?
        WHERE id = ? AND attempts < 3 AND
          (state IN ('pending','configuration_required','failed') OR
           (state = 'processing' AND claim_until <= ?))`)
        .bind(claimToken, claimUntil, delivery.id, now).run();
      if (!claim.meta.changes) continue;
      const stillEligible = await db.prepare(`SELECT o.id FROM assignment_outbox o
        JOIN assignments a ON a.id = o.assignment_id
        JOIN workers w ON w.id = a.worker_id AND w.active = 1
        JOIN sites s ON s.id = a.site_id AND s.active = 1
        JOIN course_releases r ON r.course_id = a.course_id AND r.version = a.course_version
          AND r.approved_at IS NOT NULL AND r.deliverable = 1
        WHERE o.id = ? AND o.claim_token = ? AND o.state = 'processing'
          AND a.status IN ('Not started','In progress')`).bind(delivery.id, claimToken).first();
      if (!stillEligible) {
        await db.prepare(`UPDATE assignment_outbox SET state = 'failed',claim_until = NULL,
          last_error = 'Assignment is no longer deliverable'
          WHERE id = ? AND claim_token = ? AND state = 'processing'`).bind(delivery.id, claimToken).run();
        continue;
      }
      if (!providerUrl || !providerToken) {
        await db.batch([
          db.prepare(`UPDATE assignment_outbox SET state = 'configuration_required',claim_until = NULL,
            last_error = 'Notification provider not configured' WHERE id = ? AND claim_token = ? AND state = 'processing'`)
            .bind(delivery.id, claimToken),
          db.prepare(`UPDATE assignments SET delivery_state = 'configuration_required' WHERE id = ? AND ? = 'assignment'
            AND EXISTS (SELECT 1 FROM assignment_outbox WHERE id = ? AND claim_token = ? AND state = 'configuration_required')`)
            .bind(delivery.assignment_id, delivery.kind, delivery.id, claimToken),
        ]);
        configurationRequired += 1;
        continue;
      }
      try {
        const launchUrl = new URL(`/learn/assignments/${encodeURIComponent(delivery.assignment_id)}`, request.url).toString();
        const response = await fetch(providerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerToken}`, 'Idempotency-Key': delivery.id },
          body: JSON.stringify({ id: delivery.id, kind: delivery.kind, recipient: { email: delivery.worker_email, name: delivery.worker_name },
            assignment: { id: delivery.assignment_id, courseId: delivery.course_id, version: delivery.course_version,
              title: delivery.course_title, dueDate: delivery.due_date, launchUrl } }),
        });
        if (!response.ok) throw new Error(`Notification provider returned ${response.status}`);
        const writes = await db.batch([
          db.prepare(`UPDATE assignment_outbox SET state = 'sent', attempts = attempts + 1,
            claim_until = NULL,sent_at = ?,last_error = NULL WHERE id = ? AND claim_token = ? AND state = 'processing'`)
            .bind(now, delivery.id, claimToken),
          db.prepare(`UPDATE assignments SET delivery_state = 'sent',delivered_at = ? WHERE id = ? AND ? = 'assignment'
            AND EXISTS (SELECT 1 FROM assignment_outbox WHERE id = ? AND claim_token = ? AND state = 'sent')`)
            .bind(now, delivery.assignment_id, delivery.kind, delivery.id, claimToken),
          deliveryAudit(db, `audit-delivery-${delivery.id}`, delivery, 'delivery_sent', now,
            { outboxId: delivery.id, kind: delivery.kind }, claimToken, 'sent'),
        ]);
        if (writes[0].meta.changes) sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 200) : 'Notification failed';
        const writes = await db.batch([
          db.prepare(`UPDATE assignment_outbox SET state = 'failed', attempts = attempts + 1,
            claim_until = NULL,last_error = ? WHERE id = ? AND claim_token = ? AND state = 'processing'`)
            .bind(message, delivery.id, claimToken),
          db.prepare(`UPDATE assignments SET delivery_state = 'failed' WHERE id = ? AND ? = 'assignment'
            AND EXISTS (SELECT 1 FROM assignment_outbox WHERE id = ? AND claim_token = ? AND state = 'failed')`)
            .bind(delivery.assignment_id, delivery.kind, delivery.id, claimToken),
          deliveryAudit(db, `audit-delivery-failed-${delivery.id}-${delivery.attempts + 1}`,
            delivery, 'delivery_failed', now, { outboxId: delivery.id, error: message }, claimToken, 'failed'),
        ]);
        if (writes[0].meta.changes) failed += 1;
      }
    }
    return Response.json({ asOf: now, renewed, sent, failed, configurationRequired });
  } catch (error) { return apiErrorResponse(error); }
}
