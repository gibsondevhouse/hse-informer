import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { SignJWT } from 'jose';
import { handle, handleError } from '../src/hooks.server';
import { query } from '../src/lib/server/db';

vi.mock('../src/lib/server/db', () => ({ query: vi.fn() }));
const issuer = 'https://identity.hse.test/realms/test';
const secret = 'isolated-security-boundary-secret-at-least-32-bytes';
function event(authorization?: string, session?: string): RequestEvent {
  return { url: new URL('https://hse.test/api/me'), route: { id: '/api/me' }, locals: { actor: null },
    request: new Request('https://hse.test/api/me', { headers: authorization ? { Authorization: authorization } : {} }),
    cookies: { get: () => session }, getClientAddress: () => '127.0.0.2' } as unknown as RequestEvent;
}
function protectedResponse(response: Response) {
  expect(response.headers.get('X-Request-Id')).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
  expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  expect(response.headers.get('Permissions-Policy')).toContain('camera=()');
}

beforeEach(() => {
  vi.stubEnv('DEV_AUTH', ''); vi.stubEnv('OIDC_ISSUER', issuer); vi.stubEnv('OIDC_CLIENT_ID', 'security-test');
  vi.stubEnv('OIDC_CLIENT_SECRET', 'not-a-real-secret'); vi.stubEnv('APP_ORIGIN', 'https://hse.test'); vi.stubEnv('SESSION_SECRET', secret);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/certs` })));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('finalized request failures', () => {
  it('rejects a real malformed bearer as401 with request correlation and response protections', async () => {
    const resolve = vi.fn();
    const response = await handle({ event: event('Bearer malformed'), resolve });
    expect(response.status).toBe(401); protectedResponse(response);
    expect(await response.json()).toEqual({ message: 'Sign in required' });
    expect(resolve).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
  it('finalizes typed authentication infrastructure failures without response/log leaks', async () => {
    const sensitive = 'Database password=secret and worker@example.test';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    let infrastructureError: unknown;
    try { error(503, sensitive); } catch (cause) { infrastructureError = cause; }
    vi.mocked(query).mockRejectedValueOnce(infrastructureError);
    const session = await new SignJWT({ sub: 'worker', oidcIssuer: issuer }).setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h').sign(new TextEncoder().encode(secret));
    const response = await handle({ event: event(undefined, session), resolve: vi.fn() });
    expect(response.status).toBe(503); protectedResponse(response);
    expect(await response.text()).not.toContain(sensitive);
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitive);
    expect(JSON.parse(log.mock.calls[0][0]).requestId).toBe(response.headers.get('X-Request-Id'));
  });
  it('finalizes unexpected route failures and preserves immutable redirects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = await handle({ event: event(), resolve: async () => { throw new Error('private payload'); } });
    expect(failure.status).toBe(500); protectedResponse(failure);
    expect(await failure.text()).not.toContain('private payload');
    for (const resolve of [async () => Response.redirect('https://hse.test/learn', 303),
      async () => { throw redirect(303, '/learn'); }]) {
      const response = await handle({ event: event(), resolve });
      expect(response.status).toBe(303); protectedResponse(response);
      expect(response.headers.get('Location')).toContain('/learn');
    }
  });
  it('sanitizes typed framework-rendered5xx errors as well as unknown errors', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await handleError({ event: event(), kind: 'app', error: { status: 503, message: 'secret@example.test' } });
    expect(result).toEqual({ message: 'The request could not be completed. Please try again or contact your administrator.' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret@example.test');
    expect(JSON.parse(log.mock.calls[0][0]).status).toBe(503);
  });
});
