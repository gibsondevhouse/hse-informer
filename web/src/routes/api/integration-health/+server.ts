import { json } from '@sveltejs/kit';
import { requireActor, requireRole } from '../../../lib/server/auth';
import { query } from '../../../lib/server/db';
import type { RequestHandler } from './$types';

type Counts = { failed: string; aged: string; pending: string; stalled: string };
type Drift = { kind: string; count: string };
type ReassignmentFailures = { count: string };

export const GET: RequestHandler = async ({ locals }) => {
  const actor = requireActor(locals.actor);
  requireRole(actor, ['tenant_admin', 'hse_reviewer', 'auditor']);
  const [jobs, drifts, eventFailures] = await Promise.all([
    query<Counts>(`SELECT
      count(*) FILTER (WHERE state = 'failed')::text AS failed,
      count(*) FILTER (WHERE state IN ('pending', 'failed')
        AND created_at < now() - interval '1 hour')::text AS aged,
      count(*) FILTER (WHERE state = 'pending')::text AS pending,
      count(*) FILTER (WHERE state = 'running'
        AND next_attempt_at < now() - interval '15 minutes')::text AS stalled
      FROM integration_outbox WHERE tenant_id = $1`, [actor.tenantId]),
    query<Drift>(`SELECT kind, count(*)::text AS count FROM integration_drifts
      WHERE tenant_id = $1 AND resolved_at IS NULL GROUP BY kind ORDER BY kind`, [actor.tenantId]),
    query<ReassignmentFailures>(`SELECT count(*)::text AS count
      FROM training_change_event_failures WHERE tenant_id = $1 AND resolved_at IS NULL`, [actor.tenantId])
  ]);
  return json({ asOf: new Date().toISOString(), jobs: {
    failed: Number(jobs[0]?.failed ?? 0), aged: Number(jobs[0]?.aged ?? 0),
    pending: Number(jobs[0]?.pending ?? 0), stalled: Number(jobs[0]?.stalled ?? 0)
  }, unresolvedDrifts: Object.fromEntries(drifts.map((row) => [row.kind, Number(row.count)])),
  reassignmentFailures: Number(eventFailures[0]?.count ?? 0) });
};
