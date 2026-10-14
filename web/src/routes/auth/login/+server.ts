import { redirect } from '@sveltejs/kit';
import { startLogin } from '../../../lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const destination = await startLogin(cookies, url.searchParams.get('returnTo') ?? '/');
  throw redirect(302, destination);
};
