import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../../lib/server/auth';
import { manageAccount } from '../../../../../lib/server/people';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const result = await manageAccount(requireActor(locals.actor), params.id, await request.json());
  return json(result, { headers: { 'Cache-Control': 'no-store' } });
};
