import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = ({ locals }) => ({ sessionActor: locals.actor ? {
  displayName: locals.actor.displayName, role: locals.actor.role
} : null });
