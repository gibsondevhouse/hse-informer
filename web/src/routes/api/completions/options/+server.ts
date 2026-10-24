import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { completionOptions } from '../../../../lib/server/records';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => json({ items: await completionOptions(requireActor(locals.actor)) });
