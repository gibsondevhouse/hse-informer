import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { changeDueDate } from '../../../../lib/server/assignments';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const dueAt = await changeDueDate(requireActor(locals.actor), params.id, await request.json());
  return json({ id: params.id, dueAt });
};
