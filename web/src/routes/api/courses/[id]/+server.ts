import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { changeCourse } from '../../../../lib/server/courses';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  await changeCourse(requireActor(locals.actor), params.id, await request.json());
  return json({ updated: true });
};
