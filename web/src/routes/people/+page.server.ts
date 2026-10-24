import { requireActor } from '../../lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  const actor = requireActor(locals.actor);
  const issuer = process.env.OIDC_ISSUER;
  return { actor, accountUrl: issuer ? `${issuer.replace(/\/$/, '')}/account/` : null };
};
