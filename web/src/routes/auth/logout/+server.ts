import { redirect } from '@sveltejs/kit';
import { logoutDestination } from '../../../lib/server/logout';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const actor = locals.actor;
  cookies.delete('hse_session', { path: '/' });
  cookies.delete('hse_oidc_flow', { path: '/' });
  const destination = await logoutDestination(actor);
  const external = destination.startsWith('/') ? [] : [new URL(process.env.OIDC_ISSUER!).origin];
  throw redirect(303, destination, { external });
};
