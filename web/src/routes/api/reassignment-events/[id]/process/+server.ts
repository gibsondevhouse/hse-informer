import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../../lib/server/auth';
import { processChangeEvent } from '../../../../../lib/server/reassignment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
  const result = await processChangeEvent(requireActor(locals.actor), params.id);
  return json(result);
};
