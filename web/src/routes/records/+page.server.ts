import { requireActor } from '../../lib/server/auth';
import { listCompletions } from '../../lib/server/records';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const actor = requireActor(locals.actor);
  const filterOptions = await listCompletions(actor, { state: 'all' });
  return { actor: { role: actor.role, displayName: actor.displayName, tenantName: actor.tenantName },
    filterOptions: {
      people: [...new Map(filterOptions.items.map((r) => [r.personId, r.personName])).entries()],
      sites: [...new Map(filterOptions.items.map((r) => [r.siteId, r.siteName])).entries()],
      courses: [...new Map(filterOptions.items.map((r) => [r.courseVersionId, `${r.courseTitle} · ${r.courseVersion}`])).entries()]
    },
    records: await listCompletions(actor, Object.fromEntries(url.searchParams)) };
};
