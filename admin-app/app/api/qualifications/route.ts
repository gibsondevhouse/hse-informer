import {
  ApiError,
  apiErrorResponse,
  assertSiteAccess,
  getAdminContext,
  permittedSiteIds,
} from '@/lib/server/context';
import { loadQualificationSnapshot } from '@/lib/server/qualification-store';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const site = new URL(request.url).searchParams.get('site');
    const allowed = await permittedSiteIds(context);
    if (site && site !== 'all') {
      assertSiteAccess(context, site);
      if (!allowed.includes(site)) throw new ApiError(404, 'Site not found in your permitted scope.');
    }
    const siteIds = site && site !== 'all' ? [site] : allowed;
    return Response.json({
      ...(await loadQualificationSnapshot(context.db, siteIds)),
      role: context.actor.role,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
