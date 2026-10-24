const [event = 'hse.operation.failed'] = process.argv.slice(2);
const owner = process.env.ALERT_OWNER;
const endpoint = process.env.ALERT_WEBHOOK_URL;
try {
  if (!owner || !endpoint) throw new Error('Missing alert configuration');
  if (new URL(endpoint).protocol !== 'https:') throw new Error('HTTPS is required');
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, owner, at: new Date().toISOString() }),
    signal: AbortSignal.timeout(10_000), redirect: 'error' });
  if (!response.ok) throw new Error('Delivery rejected');
  process.stdout.write(`${JSON.stringify({ event: 'alert.delivered', operation: event, status: response.status })}\n`);
} catch {
  process.stderr.write(`${JSON.stringify({ event: 'alert.delivery_failed', operation: event })}\n`);
  process.exitCode = 2;
}
