import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const owner = process.env.ALERT_OWNER;
const endpoint = process.env.ALERT_WEBHOOK_URL;
if (!owner || !endpoint) throw new Error('ALERT_OWNER and ALERT_WEBHOOK_URL are required');
const url = new URL(endpoint);
if (url.protocol !== 'https:' && !(process.env.ALLOW_LOCAL_ALERT_TEST === 'yes'
  && url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname))) {
  throw new Error('The alert webhook must use HTTPS');
}
const interval = Number(process.env.BETA_JOB_INTERVAL_SECONDS || 300);
if (!Number.isFinite(interval) || interval < 30) throw new Error('Job interval must be at least 30 seconds');
const log = (event, detail = {}) => process.stdout.write(`${JSON.stringify({ event, at: new Date().toISOString(), ...detail })}\n`);
const webDirectory = fileURLToPath(new URL('../../web/', import.meta.url));
const run = (script, args = [], runId) => new Promise((resolve) => {
  // SQL/provider diagnostics remain in restricted application state or a manual
  // diagnostic run. Do not forward raw exception payloads into host log streams.
  const child = spawn('node_modules/.bin/tsx', [script, ...args], { cwd: webDirectory, stdio: 'ignore' });
  let completed = false;
  const finish = (code) => {
    if (completed) return;
    completed = true;
    log('job.finished', { runId, job: 'moodle_outbox', exitCode: code });
    resolve(code);
  };
  child.on('error', () => finish(127));
  child.on('close', (code) => finish(code ?? 1));
});
async function alert(event, runId, exitCodes) {
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, owner, runId, exitCodes, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok) throw new Error('Alert endpoint rejected the event');
    log('alert.delivered', { runId, status: response.status });
    return true;
  } catch {
    log('alert.delivery_failed', { runId });
    return false;
  }
}
let previouslyFailed = false;
do {
  const runId = randomUUID();
  const exits = process.argv.includes('--probe-failure') ? [1] : [
    await run('scripts/run-jobs.ts', ['--reconcile'], runId)
  ];
  const failed = exits.some((code) => code !== 0);
  log(failed ? 'jobs.failed' : 'jobs.completed', { runId, exitCodes: exits });
  let delivered = true;
  if (failed || previouslyFailed) delivered = await alert(failed ? 'hse.jobs.failed' : 'hse.jobs.recovered', runId, exits);
  previouslyFailed = failed;
  if (process.argv.includes('--once') || process.argv.includes('--probe-failure')) {
    process.exitCode = delivered ? (failed ? 1 : 0) : 2;
    break;
  }
  await delay(interval * 1000);
} while (true);
