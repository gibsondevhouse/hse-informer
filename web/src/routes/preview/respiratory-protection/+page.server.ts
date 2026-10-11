import type { PageServerLoad } from './$types';
import { requireActor, requireRole } from '../../../lib/server/auth';

export const load: PageServerLoad = ({ locals }) => {
  const actor = requireActor(locals.actor);
  requireRole(actor, ['tenant_admin', 'hse_reviewer']);
  return {};
};
