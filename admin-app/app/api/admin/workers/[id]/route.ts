import { apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, readJsonObject, ApiError } from '@/lib/server/context';
import { auditStatement, requiredString } from '@/lib/server/records';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, route: RouteContext) {
  try {
    const context = await getAdminContext(request);
    const id = (await route.params).id;
    const worker = await context.db.prepare('SELECT * FROM workers WHERE id = ?').bind(id).first<{ site_id: string }>();
    if (!worker) throw new ApiError(404, 'Worker not found.');
    assertSiteAccess(context, worker.site_id);
    const [assignments, audit] = await Promise.all([
      context.db.prepare('SELECT * FROM assignments WHERE worker_id = ? ORDER BY assigned_at DESC, id DESC').bind(id).all(),
      context.db.prepare(`SELECT * FROM audit_events WHERE entity_type = 'worker' AND entity_id = ? ORDER BY created_at DESC`).bind(id).all(),
    ]);
    return Response.json({ worker, assignments: assignments.results, audit: audit.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, route: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const id = (await route.params).id;
    const existing = await context.db.prepare('SELECT * FROM workers WHERE id = ?').bind(id).first<{
      id: string; name: string; email: string; site_id: string; group_name: string; active: number;
    }>();
    if (!existing) throw new ApiError(404, 'Worker not found.');
    assertSiteAccess(context, existing.site_id, 'manage');
    const body = await readJsonObject(request);
    const reason = requiredString(body.reason, 'Change reason', 500);
    const siteId = body.siteId == null ? existing.site_id : requiredString(body.siteId, 'Site');
    assertSiteAccess(context, siteId, 'manage');
    if (siteId !== existing.site_id || body.active === false) {
      const open = await context.db.prepare(`SELECT id FROM assignments WHERE worker_id = ? AND status IN ('Not started','In progress') LIMIT 1`)
        .bind(id).first();
      if (open) throw new ApiError(409, 'Resolve open assignments before moving or deactivating this worker.');
    }
    const updated = {
      ...existing,
      name: body.name == null ? existing.name : requiredString(body.name, 'Worker name'),
      email: body.email == null ? existing.email : requiredString(body.email, 'Worker email').toLowerCase(),
      site_id: siteId,
      group_name: body.group == null ? existing.group_name : requiredString(body.group, 'Role or group'),
      active: body.active == null ? existing.active : body.active === true ? 1 : body.active === false ? 0 : -1,
      updated_at: context.asOf,
    };
    if (updated.active === -1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email)) throw new ApiError(400, 'Invalid worker details.');
    if (updated.active === 1) {
      const activeSite = await context.db.prepare('SELECT id FROM sites WHERE id = ? AND active = 1').bind(siteId).first();
      if (!activeSite) throw new ApiError(400, 'Active workers must belong to an active site.');
    }
    await context.db.batch([
      context.db.prepare('UPDATE workers SET name = ?, email = ?, site_id = ?, group_name = ?, active = ?, updated_at = ? WHERE id = ?')
        .bind(updated.name, updated.email, updated.site_id, updated.group_name, updated.active, updated.updated_at, id),
      auditStatement(context, 'worker', id, 'updated', siteId, reason, existing, updated),
    ]);
    return Response.json({ worker: updated, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}
