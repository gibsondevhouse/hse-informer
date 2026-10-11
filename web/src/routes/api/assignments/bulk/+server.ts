import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { createBulkAssignments } from '../../../../lib/server/assignments';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const result = await createBulkAssignments(requireActor(locals.actor), await request.json());
  return json(result, { status: 201 });
};
