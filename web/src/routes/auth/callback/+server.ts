import { error, redirect } from '@sveltejs/kit';
import { finishLogin } from '../../../lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) throw error(400, 'Missing sign-in callback parameters');
  throw redirect(303, await finishLogin(cookies, code, state));
};
