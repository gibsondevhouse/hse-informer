import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { query } from '../../../lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const actor = requireActor(locals.actor);
  const restricted = actor.role !== 'tenant_admin' && actor.role !== 'hse_reviewer' && actor.role !== 'auditor';
  const rows = await query<{ id: string; code: string; name: string; state_code: string; time_zone: string | null }>(
    `SELECT id, code, name, state_code, time_zone FROM sites WHERE tenant_id = $1 ${restricted ? 'AND id = ANY($2::uuid[])' : ''} ORDER BY name`,
    restricted ? [actor.tenantId, actor.siteIds] : [actor.tenantId]);
  return json({ items: rows.map((row) => ({ id: row.id, code: row.code, name: row.name,
    stateCode: row.state_code, timeZone: row.time_zone })) });
};
