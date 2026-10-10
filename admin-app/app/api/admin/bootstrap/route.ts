import { apiErrorResponse, getAdminContext, permittedSiteIds } from '@/lib/server/context';
import { sitePlaceholders, type AssignmentRow } from '@/lib/server/records';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const ids = await permittedSiteIds(context);
    if (ids.length === 0) {
      return Response.json({ actor: context.actor, asOf: context.asOf, sites: [], workers: [], assignments: [], releases: [] });
    }
    const filter = sitePlaceholders(ids);
    const [siteResult, workerResult, assignmentResult, releaseResult] = await Promise.all([
      context.db.prepare(`SELECT * FROM sites WHERE id IN (${filter}) ORDER BY active DESC,name`).bind(...ids).all(),
      context.db.prepare(`SELECT * FROM workers WHERE site_id IN (${filter}) ORDER BY name`).bind(...ids).all(),
      context.db.prepare(`SELECT * FROM assignments WHERE site_id IN (${filter}) ORDER BY assigned_at DESC, id DESC`).bind(...ids).all<AssignmentRow>(),
      context.db.prepare('SELECT * FROM course_releases WHERE approved_at IS NOT NULL ORDER BY title, version').all(),
    ]);
    return Response.json({ actor: context.actor, asOf: context.asOf, sites: siteResult.results, workers: workerResult.results, assignments: assignmentResult.results, releases: releaseResult.results });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
