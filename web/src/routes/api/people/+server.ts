import { json } from '@sveltejs/kit';
import { requireActor, requireRole } from '../../../lib/server/auth';
import { query } from '../../../lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const actor = requireActor(locals.actor);
  requireRole(actor, ['tenant_admin','site_admin','hse_reviewer','evaluator','learner','auditor']);
  const learner = actor.role === 'learner';
  const restricted = actor.role !== 'tenant_admin' && actor.role !== 'hse_reviewer' && actor.role !== 'auditor';
  const rows = await query<{ id: string; display_name: string; job_title: string | null; department: string | null; site_ids: string[] }>(
    `SELECT p.id, p.display_name, p.job_title, p.department, array_agg(m.site_id) AS site_ids
     FROM people p JOIN person_site_memberships m ON m.tenant_id = p.tenant_id AND m.person_id = p.id AND m.ended_at IS NULL
     WHERE p.tenant_id = $1 AND p.active ${learner ? 'AND p.id = $2' : restricted ? 'AND m.site_id = ANY($2::uuid[])' : ''}
     GROUP BY p.id ORDER BY p.display_name`, learner ? [actor.tenantId, actor.personId]
      : restricted ? [actor.tenantId, actor.siteIds] : [actor.tenantId]);
  return json({ items: rows.map((row) => ({ id: row.id, displayName: row.display_name,
    jobTitle: row.job_title, department: row.department, siteIds: row.site_ids })) });
};
