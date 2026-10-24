import { redirect } from '@sveltejs/kit';
import { logoutDestination } from '../../../lib/server/logout';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const actor = locals.actor;
  cookies.delete('hse_session', { path: '/' });
  cookies.delete('hse_oidc_flow', { path: '/' });
  throw redirect(303, await logoutDestination(actor));
};
