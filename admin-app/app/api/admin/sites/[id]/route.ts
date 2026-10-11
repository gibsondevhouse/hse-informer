import { ApiError, apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, readJsonObject } from '@/lib/server/context';
import { auditStatement, requiredString } from '@/lib/server/records';

type RouteContext = { params: Promise<{ id: string }> };
type Site = { id: string; name: string; code: string; location: string; active: number };

export async function GET(request: Request, route: RouteContext) {
  try {
    const context = await getAdminContext(request);
    const id = (await route.params).id;
    assertSiteAccess(context, id);
    const site = await context.db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<Site>();
    if (!site) throw new ApiError(404, 'Site not found.');
    const [workers, assignments] = await Promise.all([
      context.db.prepare('SELECT * FROM workers WHERE site_id = ? ORDER BY name').bind(id).all(),
      context.db.prepare('SELECT * FROM assignments WHERE site_id = ? ORDER BY assigned_at DESC').bind(id).all(),
    ]);
    return Response.json({ site, workers: workers.results, assignments: assignments.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function PATCH(request: Request, route: RouteContext) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const id = (await route.params).id;
    assertSiteAccess(context, id, 'manage');
    const before = await context.db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<Site>();
    if (!before) throw new ApiError(404, 'Site not found.');
    const body = await readJsonObject(request);
    const reason = requiredString(body.reason, 'Change reason', 500);
    const active = body.active == null ? before.active : body.active === true ? 1 : body.active === false ? 0 : -1;
    if (active < 0) throw new ApiError(400, 'Active must be true or false.');
    if (body.active != null && context.actor.role !== 'admin') throw new ApiError(403, 'Only organization administrators can change site activity.');
    if (active === 0 && before.active !== 0) {
      const worker = await context.db.prepare('SELECT id FROM workers WHERE site_id = ? AND active = 1 LIMIT 1').bind(id).first();
      if (worker) throw new ApiError(409, 'Move or deactivate active workers before deactivating this site.');
    }
    const after: Site = {
      id,
      name: body.name == null ? before.name : requiredString(body.name, 'Site name'),
      code: body.code == null ? before.code : requiredString(body.code, 'Site code', 20).toUpperCase(),
      location: body.location == null ? before.location : requiredString(body.location, 'Location'),
      active,
    };
    await context.db.batch([
      context.db.prepare('UPDATE sites SET name = ?,code = ?,location = ?,active = ? WHERE id = ?')
        .bind(after.name, after.code, after.location, after.active, id),
      auditStatement(context, 'site', id, 'updated', id, reason, before, after),
    ]);
    return Response.json({ site: after, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}
