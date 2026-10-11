import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
  const actor = requireActor(locals.actor);
  return json({ actor: { id: actor.id, tenantId: actor.tenantId, role: actor.role, siteIds: actor.siteIds,
    displayName: actor.displayName }, tenant: { id: actor.tenantId, name: actor.tenantName, synthetic: actor.tenantSynthetic } });
};
