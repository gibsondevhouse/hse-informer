import {
  ApiError, apiErrorResponse, getAdminContext, permittedSiteIds,
} from '@/lib/server/context';
import { loadQualificationSnapshot, loadScopedAudit } from '@/lib/server/qualification-store';

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const workerId = new URL(request.url).searchParams.get('worker');
    if (!workerId) throw new ApiError(400, 'Choose a worker.');
    const siteIds = await permittedSiteIds(context);
    const snapshot = await loadQualificationSnapshot(context.db, siteIds);
    const worker = snapshot.workers.find((item) => item.id === workerId);
    if (!worker) throw new ApiError(404, 'Worker not found in your permitted sites.');
    const assignments = snapshot.assignments.filter((item) => item.workerId === workerId);
    const events = snapshot.events.filter((item) => item.workerId === workerId);
    const requirements = snapshot.requirements.filter((item) =>
      item.siteId === worker.siteId && item.groupName === worker.groupName,
    );
    const entityIds = new Set([
      workerId, ...assignments.map((item) => item.id),
      ...events.map((item) => item.id), ...requirements.map((item) => item.id),
    ]);
    const audit = (await loadScopedAudit(context.db, siteIds))
      .filter((item) => entityIds.has(item.entity_id));
    return Response.json({ worker, assignments, events, audit, asOf: context.asOf }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
