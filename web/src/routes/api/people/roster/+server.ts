import { json } from '@sveltejs/kit';
import { requireActor, requireRole } from '../../../../lib/server/auth';
import { importRoster, rosterTemplate } from '../../../../lib/server/people';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
  requireRole(requireActor(locals.actor), ['tenant_admin','site_admin']);
  return new Response(rosterTemplate, { headers: { 'Content-Type':'text/csv; charset=utf-8', 'Content-Disposition':'attachment; filename="hse-roster-template.csv"' } });
};
export const POST: RequestHandler = async ({ locals, request }) => json(await importRoster(requireActor(locals.actor), await request.json()));
