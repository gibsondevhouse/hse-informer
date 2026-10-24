import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { ClientErrorBudget, clientErrorReport } from '../src/lib/client-error-report';
import { receiveClientError } from '../src/lib/server/client-error-reports';

const valid = { route: '/people', errorCode: 'navigation_error', status: 500 };
let address = 0;
function event(body: unknown, overrides: { origin?: string; length?: string; address?: string; raw?: string } = {}) {
  return { request: new Request('https://hse.test/api/client-errors', { method: 'POST',
    headers: { Origin: overrides.origin ?? 'https://hse.test', 'Content-Type': 'application/json',
      ...(overrides.length ? { 'Content-Length': overrides.length } : {}) },
    body: overrides.raw ?? JSON.stringify(body) }), url: new URL('https://hse.test/api/client-errors'),
    locals: { actor: null, requestId: 'server-generated-request-id' },
    getClientAddress: () => overrides.address ?? `synthetic-${address++}` } as Pick<RequestEvent, 'request'|'url'|'locals'|'getClientAddress'>;
}
afterEach(() => { vi.restoreAllMocks(); });

describe('closed browser error reporting boundary', () => {
  it('accepts only fixed beta route/code/status metadata and logs no identity or request input', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await receiveClientError(event(valid));
    expect(response.status).toBe(204);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({ level: 'error', event: 'browser.failed', ...valid,
      requestId: 'server-generated-request-id' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-');
  });
  it('rejects messages, stacks, user IDs, full URLs and unknown metadata without logging them', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const attempts = [ ...['message','stack','userId','email','url','requestId'].map(key => ({ ...valid, [key]: 'person@example.test' })),
      { ...valid, route: '/people/123?email=person@example.test' }, { ...valid, route: 'https://hse.test/people' },
      { ...valid, errorCode: 'private exception' }, { ...valid, status: 200 } ];
    for (const input of attempts) expect((await receiveClientError(event(input))).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });
  it('rejects oversized declared and streamed bodies and requires our origin', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await receiveClientError(event(valid, { length: '257' }))).status).toBe(413);
    expect((await receiveClientError(event(null, { raw: ' '.repeat(257) }))).status).toBe(413);
    expect((await receiveClientError(event(valid, { origin: 'https://foreign.test' }))).status).toBe(403);
  });
  it('bounds report ingestion by trusted socket address even for invalid bodies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (let i = 0; i < 10; i++) expect((await receiveClientError(event({}, { address: 'one-address' }))).status).toBe(400);
    const limited = await receiveClientError(event(valid, { address: 'one-address' }));
    expect(limited.status).toBe(429); expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
  it('caps total telemetry logs even when requests use different addresses', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    const fresh = await import('../src/lib/server/client-error-reports');
    for (let i = 0; i < 100; i++) expect((await fresh.receiveClientError(event(valid))).status).toBe(204);
    expect((await fresh.receiveClientError(event(valid))).status).toBe(429);
  });
  it('uses an in-memory client budget of3 per minute and10 per page lifetime', () => {
    const budget = new ClientErrorBudget();
    for (let i = 0; i < 3; i++) expect(budget.take(0)).toBe(true);
    expect(budget.take(1)).toBe(false);
    for (let i = 1; i <= 7; i++) expect(budget.take(i * 60_000)).toBe(true);
    expect(budget.take(8 * 60_000)).toBe(false);
    expect(clientErrorReport('/people?name=private', 'navigation_error')).toBeNull();
  });
});
