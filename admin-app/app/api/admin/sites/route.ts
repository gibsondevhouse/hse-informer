import { apiErrorResponse, assertSameOrigin, getAdminContext, permittedSiteIds, readJsonObject, ApiError } from '@/lib/server/context';
import { auditStatement, requiredString, sitePlaceholders } from '@/lib/server/records';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const ids = await permittedSiteIds(context);
    if (!ids.length) return Response.json({ sites: [], asOf: context.asOf });
    const sites = await context.db.prepare(`SELECT * FROM sites WHERE id IN (${sitePlaceholders(ids)}) ORDER BY active DESC,name`).bind(...ids).all();
    return Response.json({ sites: sites.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    if (context.actor.role !== 'admin') throw new ApiError(403, 'Only organization administrators can add sites.');
    const body = await readJsonObject(request);
    const site = {
      id: crypto.randomUUID(),
      name: requiredString(body.name, 'Site name'),
      code: requiredString(body.code, 'Site code', 20).toUpperCase(),
      location: requiredString(body.location, 'Location'),
      active: 1,
    };
    await context.db.batch([
      context.db.prepare('INSERT INTO sites (id,name,code,location,active) VALUES (?,?,?,?,1)').bind(site.id, site.name, site.code, site.location),
      auditStatement(context, 'site', site.id, 'created', site.id, null, null, site),
    ]);
    return Response.json({ site, asOf: context.asOf }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
