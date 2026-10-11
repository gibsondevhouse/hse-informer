import { apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, permittedSiteIds, readJsonObject, ApiError } from '@/lib/server/context';
import { auditStatement, requiredString, sitePlaceholders } from '@/lib/server/records';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const ids = await permittedSiteIds(context);
    if (!ids.length) return Response.json({ workers: [], asOf: context.asOf });
    const workers = await context.db.prepare(`SELECT * FROM workers WHERE site_id IN (${sitePlaceholders(ids)}) ORDER BY name`).bind(...ids).all();
    return Response.json({ workers: workers.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const body = await readJsonObject(request);
    const siteId = requiredString(body.siteId, 'Site');
    assertSiteAccess(context, siteId, 'manage');
    const site = await context.db.prepare('SELECT id FROM sites WHERE id = ? AND active = 1').bind(siteId).first();
    if (!site) throw new ApiError(400, 'Choose an active site.');
    const worker = {
      id: crypto.randomUUID(),
      name: requiredString(body.name, 'Worker name'),
      email: requiredString(body.email, 'Worker email').toLowerCase(),
      site_id: siteId,
      group_name: requiredString(body.group, 'Role or group'),
      active: 1,
      created_at: context.asOf,
      updated_at: context.asOf,
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(worker.email)) throw new ApiError(400, 'Enter a valid worker email.');
    await context.db.batch([
      context.db.prepare('INSERT INTO workers (id,name,email,site_id,group_name,active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
        .bind(worker.id, worker.name, worker.email, siteId, worker.group_name, context.asOf, context.asOf),
      auditStatement(context, 'worker', worker.id, 'created', siteId, null, null, worker),
    ]);
    return Response.json({ worker, asOf: context.asOf }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
