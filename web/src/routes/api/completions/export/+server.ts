import { requireActor } from '../../../../lib/server/auth';
import { exportCompletions } from '../../../../lib/server/records';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => new Response(await exportCompletions(
  requireActor(locals.actor), Object.fromEntries(url.searchParams)), {
  headers: { 'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="completion-records.csv"', 'Cache-Control': 'no-store' }
});
