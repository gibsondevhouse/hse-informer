import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { createPerson, listPeople } from '../../../lib/server/people';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const actor = requireActor(locals.actor);
  return json({ items: await listPeople(actor, url.searchParams.get('includeInactive') === 'true') });
};
export const POST: RequestHandler = async ({ locals, request }) =>
  json({ id: await createPerson(requireActor(locals.actor), await request.json()) }, { status: 201 });
