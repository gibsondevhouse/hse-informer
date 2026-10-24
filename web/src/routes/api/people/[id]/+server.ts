import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { editPerson, personDetail } from '../../../../lib/server/people';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => json(await personDetail(requireActor(locals.actor), params.id));
export const PATCH: RequestHandler = async ({ locals, params, request }) => json({ person: await editPerson(requireActor(locals.actor), params.id, await request.json()) });
