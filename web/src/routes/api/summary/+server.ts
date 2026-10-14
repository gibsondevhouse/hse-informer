import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { listAssignments, summarize } from '../../../lib/server/assignments';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const now = new Date();
  return json(summarize(await listAssignments(requireActor(locals.actor), now), now));
};
