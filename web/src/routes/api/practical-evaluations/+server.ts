import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { recordPracticalEvaluation } from '../../../lib/server/compliance';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const id = await recordPracticalEvaluation(requireActor(locals.actor), await request.json());
  return json({ id }, { status: 201 });
};
