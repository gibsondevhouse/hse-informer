import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { listCompletions, recordManualCompletion } from '../../../lib/server/records';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => json(await listCompletions(
  requireActor(locals.actor), Object.fromEntries(url.searchParams)));

export const POST: RequestHandler = async ({ locals, request }) => json({ id: await recordManualCompletion(
  requireActor(locals.actor), await request.json()) }, { status: 201 });
