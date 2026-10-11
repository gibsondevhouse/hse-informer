import { processDueChangeEvents, processDueRecurrences } from '../src/lib/server/reassignment';
import { database } from '../src/lib/server/db';

const args = process.argv.slice(2);
function option(name: string): string | undefined {
  const at = args.indexOf(name);
  return at < 0 ? undefined : args[at + 1];
}
const tenantId = option('--tenant-id');
const at = option('--as-of');
const limitValue = option('--limit');
const leadValue = option('--lead-days');
if (!tenantId || (at && !Number.isFinite(Date.parse(at)))) {
  throw new Error('Usage: npm run jobs:reassignment -- --tenant-id UUID [--as-of ISO] [--limit 1..500] [--lead-days 0..90]');
}
const asOf = at ? new Date(at) : new Date();
const limit = limitValue ? Number(limitValue) : 100;
const leadDays = leadValue ? Number(leadValue) : 30;
try {
  const events = await processDueChangeEvents(tenantId, asOf, limit);
  const recurrences = await processDueRecurrences(tenantId, asOf, limit, leadDays);
  process.stdout.write(`${JSON.stringify({ tenantId, asOf: asOf.toISOString(), leadDays, events, recurrences })}\n`);
  if (events.failures) process.exitCode = 1;
} finally { await database().end(); }
