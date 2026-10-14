import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { createAssignments, listAssignments } from '../../../lib/server/assignments';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const items = await listAssignments(requireActor(locals.actor));
  return json({ items, total: items.length });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const result = await createAssignments(requireActor(locals.actor), await request.json());
  return json(result, { status: 201 });
};
