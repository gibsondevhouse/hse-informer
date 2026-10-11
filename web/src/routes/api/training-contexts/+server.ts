import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { recordTrainingContext } from '../../../lib/server/reassignment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const id = await recordTrainingContext(requireActor(locals.actor), await request.json());
  return json({ id }, { status: 201 });
};
