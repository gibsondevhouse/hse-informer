import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../../lib/server/auth';
import { auditPacket } from '../../../../../lib/server/compliance';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) =>
  json(await auditPacket(requireActor(locals.actor), params.personId, params.requirementId));
