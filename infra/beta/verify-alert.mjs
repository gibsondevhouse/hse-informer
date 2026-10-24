import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

let received = [];
let reject = false;
const server = createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  received.push(JSON.parse(body));
  response.writeHead(reject ? 503 : 204).end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const script = fileURLToPath(new URL('./run-jobs.mjs', import.meta.url));
const run = (args) => new Promise((resolve, failure) => {
  const child = spawn(process.execPath, [script, ...args], {
    env: { ...process.env, ALERT_OWNER: 'Synthetic operations test recipient',
      ALERT_WEBHOOK_URL: `http://127.0.0.1:${port}`, ALLOW_LOCAL_ALERT_TEST: 'yes',
      DATABASE_URL: 'postgres://127.0.0.1:1/isolated_alert_failure' },
    stdio: ['ignore','pipe','pipe']
  });
  child.on('error', failure);
  child.on('close', resolve);
});
try {
  assert.equal(await run(['--once']), 1);
  assert.equal(received[0].event, 'hse.jobs.failed');
  assert.equal(received[0].owner, 'Synthetic operations test recipient');
  assert.deepEqual(received[0].exitCodes, [1]);
  reject = true;
  assert.equal(await run(['--probe-failure']), 2);
  assert.equal(received.length, 2);
  console.log(JSON.stringify({ event: 'alert-probe.verified', delivery: true, rejectionFails: true,
    forcedChildFailure: true, verifiedAt: new Date().toISOString(),
    scope: 'local synthetic webhook; production recipient remains unverified' }));
} finally { await new Promise((resolve) => server.close(resolve)); }
