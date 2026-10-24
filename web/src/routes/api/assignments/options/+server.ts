import { json } from '@sveltejs/kit';
import { requireActor } from '../../../../lib/server/auth';
import { assignmentCourseOptions } from '../../../../lib/server/assignments';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => json({
  items: await assignmentCourseOptions(requireActor(locals.actor))
});
