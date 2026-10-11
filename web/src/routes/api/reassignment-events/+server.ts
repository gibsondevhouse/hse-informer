import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { query } from '../../../lib/server/db';
import { processChangeEvent, recordChangeEvent } from '../../../lib/server/reassignment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
  const actor = requireActor(locals.actor);
  const id = await recordChangeEvent(actor, await request.json());
  const effective = await query<{ effective_at: Date }>(
    'SELECT effective_at FROM training_change_events WHERE tenant_id = $1 AND id = $2',
    [actor.tenantId, id]);
  const now = new Date();
  if (effective[0].effective_at > now) return json({ id, queued: true }, { status: 202 });
  const result = await processChangeEvent(actor, id, now);
  return json({ id, queued: false, result }, { status: 201 });
};
