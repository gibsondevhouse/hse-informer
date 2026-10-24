import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
export const load: PageServerLoad = ({ locals }) => {
  if (locals.actor?.role === 'learner') throw redirect(303, '/learn');
  return {};
};
