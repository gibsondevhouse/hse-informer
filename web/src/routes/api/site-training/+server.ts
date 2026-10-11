import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { recordSiteTraining } from '../../../lib/server/compliance';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const id = await recordSiteTraining(requireActor(locals.actor), await request.json());
  return json({ id }, { status: 201 });
};
