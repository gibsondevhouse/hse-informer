import { database } from '../src/lib/server/db';
import { enqueueReconciliation, runJobs } from '../src/lib/server/jobs';

try {
  if (process.argv.includes('--reconcile')) process.stdout.write(`Queued ${await enqueueReconciliation()} reconciliation checks\n`);
  const result = await runJobs();
  process.stdout.write(`Moodle jobs: ${result.done} done, ${result.failed} failed\n`);
  if (result.failed) process.exitCode = 1;
} finally { await database().end(); }
