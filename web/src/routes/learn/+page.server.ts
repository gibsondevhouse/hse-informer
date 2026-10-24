import { requireActor, requireRole } from '../../lib/server/auth';
import { listAssignments } from '../../lib/server/assignments';
import { listCompletions } from '../../lib/server/records';
import { query } from '../../lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const actor = requireActor(locals.actor);
  requireRole(actor, ['learner']);
  const [assignments, history, sites] = await Promise.all([
    listAssignments(actor), listCompletions(actor),
    query<{ id: string; time_zone: string | null }>('SELECT id,time_zone FROM sites WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [actor.tenantId, actor.siteIds])
  ]);
  return { actor, assignments, history, siteZones: Object.fromEntries(sites.map(s => [s.id, s.time_zone])) };
};
