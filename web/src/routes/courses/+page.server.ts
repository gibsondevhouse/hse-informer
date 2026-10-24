import { requireActor } from '../../lib/server/auth';
import { listCourses } from '../../lib/server/courses';
import { query } from '../../lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const actor = requireActor(locals.actor);
  const courses = await listCourses(actor);
  const requirements = await query<{ id: string; title: string; code: string }>(
    'SELECT id, title, code FROM requirements WHERE tenant_id = $1 ORDER BY title', [actor.tenantId]);
  return { actor: { role: actor.role, displayName: actor.displayName, tenantName: actor.tenantName }, courses, requirements };
};
