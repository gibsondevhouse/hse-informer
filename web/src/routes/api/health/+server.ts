import { json } from '@sveltejs/kit';
import { query } from '../../../lib/server/db';
import type { RequestHandler } from './$types';

/** Readiness deliberately excludes personal data, service secrets, and database diagnostics. */
export const GET: RequestHandler = async () => {
  try {
    await query('SELECT 1');
    return json({ status: 'ready' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};
