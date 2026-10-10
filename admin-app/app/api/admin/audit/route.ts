import { apiErrorResponse, assertSiteAccess, getAdminContext, permittedSiteIds, ApiError } from '@/lib/server/context';
import { sitePlaceholders } from '@/lib/server/records';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const query = new URL(request.url).searchParams;
    const entityType = query.get('entityType');
    const entityId = query.get('entityId');
    const siteId = query.get('siteId');
    if ((entityType && !entityId) || (!entityType && entityId)) throw new ApiError(400, 'Provide both entityType and entityId.');
    if (entityType === 'release') {
      if (context.actor.role !== 'admin') throw new ApiError(403, 'Only organization administrators can view release audits.');
      const result = await context.db.prepare(`SELECT * FROM audit_events WHERE entity_type = 'release' AND entity_id = ?
        ORDER BY created_at DESC,id DESC LIMIT 500`).bind(entityId).all();
      return Response.json({ events: result.results, asOf: context.asOf });
    }
    if (siteId) assertSiteAccess(context, siteId);
    const ids = siteId ? [siteId] : await permittedSiteIds(context);
    if (!ids.length) return Response.json({ events: [], asOf: context.asOf });
    const where = [`site_id IN (${sitePlaceholders(ids)})`];
    const values: string[] = [...ids];
    if (entityType && entityId) {
      where.push('entity_type = ?', 'entity_id = ?');
      values.push(entityType, entityId);
    }
    const result = await context.db.prepare(`SELECT * FROM audit_events WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT 500`)
      .bind(...values).all();
    return Response.json({ events: result.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}
