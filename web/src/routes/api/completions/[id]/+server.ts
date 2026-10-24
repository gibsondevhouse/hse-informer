import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { amendCompletion, completionDetail } from '../../../../lib/server/records';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => json(await completionDetail(requireActor(locals.actor), params.id));
export const POST: RequestHandler = async ({ locals, params, request }) => json(await amendCompletion(
  requireActor(locals.actor), params.id, await request.json()));
