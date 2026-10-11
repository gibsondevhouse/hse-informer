import { error, json } from '@sveltejs/kit';
import { requireActor } from '../../../../../../lib/server/auth';
import { attestationTarget } from '../../../../../../lib/server/compliance';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (params.kind !== 'site_training' && params.kind !== 'practical_evaluation') throw error(404, 'Evidence type not found');
  return json(await attestationTarget(requireActor(locals.actor), params.kind, params.id));
};
