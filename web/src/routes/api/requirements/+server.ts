import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { query } from '../../../lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const actor = requireActor(locals.actor);
  const rows = await query<{ id: string; code: string; title: string; version: string; review_status: string;
    legal_status: string; recurrence: unknown }>(`SELECT r.id, r.code, r.title, v.version, v.review_status, v.legal_status, v.recurrence
    FROM requirements r JOIN requirement_versions v ON v.tenant_id = r.tenant_id AND v.id = r.active_version_id
    WHERE r.tenant_id = $1 ORDER BY r.title`, [actor.tenantId]);
  return json({ items: rows.map((row) => ({ id: row.id, code: row.code, title: row.title,
    version: row.version, reviewStatus: row.review_status, legalStatus: row.legal_status, recurrence: row.recurrence })) });
};
