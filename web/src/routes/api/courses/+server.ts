import { json } from '@sveltejs/kit';
import { requireActor } from '../../../lib/server/auth';
import { createCourse, listCourses } from '../../../lib/server/courses';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const items = await listCourses(requireActor(locals.actor));
  return json({ items, total: items.length });
};
export const POST: RequestHandler = async ({ locals, request }) => {
  return json({ id: await createCourse(requireActor(locals.actor), await request.json()) }, { status: 201 });
};
