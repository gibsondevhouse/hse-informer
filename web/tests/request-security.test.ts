import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestLimiter, requestLimit, secureResponse } from '../src/lib/server/request-security';

describe('request boundary', () => {
  it('limits bursts, isolates identities, and renews only after expiry', () => {
    const limiter = new RequestLimiter();
    expect(limiter.take('actor-a', 2, 60_000, 0)).toBe(0);
    expect(limiter.take('actor-a', 2, 60_000, 1000)).toBe(0);
    expect(limiter.take('actor-a', 2, 60_000, 2000)).toBe(58);
    expect(limiter.take('actor-b', 2, 60_000, 2000)).toBe(0);
    expect(limiter.take('actor-a', 2, 60_000, 60_000)).toBe(0);
  });
  it('bounds memory and expires old buckets without evicting active protection', () => {
    const limiter = new RequestLimiter(1);
    expect(limiter.take('a', 1, 1000, 0)).toBe(0);
    expect(limiter.take('b', 1, 1000, 0)).toBe(1);
    expect(limiter.take('a', 1, 1000, 0)).toBe(1);
    expect(limiter.take('b', 1, 1000, 1000)).toBe(0);
  });
  it('covers invitations and record exports without throttling normal page reads', () => {
    expect(requestLimit('/api/people/abc/account', 'POST')?.group).toBe('account');
    expect(requestLimit('/api/activate', 'POST')?.group).toBe('activation');
    expect(requestLimit('/api/completions/export', 'GET')?.group).toBe('export');
    expect(requestLimit('/people', 'GET')).toBeNull();
  });
  it('prevents API caching and framing and applies HSTS only over HTTPS', () => {
    const response = secureResponse(new Response('{}'), new URL('https://hse.test/api/people'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Strict-Transport-Security')).toContain('31536000');
    expect(secureResponse(new Response(''), new URL('http://localhost/')).headers.has('Strict-Transport-Security')).toBe(false);
  });
});

describe('runtime identity form redirects', () => {
  const issuer = 'https://identity.example.test:8443/realms/company';
  const origin = 'https://identity.example.test:8443';
  const policy = "default-src 'self'; script-src 'self' 'nonce-retained123'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'";
  const html = (csp = policy, type = 'text/html; charset=utf-8') => new Response('<form method="POST" action="/auth/logout"></form>', {
    headers: { 'Content-Type': type, 'Content-Security-Policy': csp }
  });
  const secure = (response: Response) => secureResponse(response, new URL('https://portal.example.test/people?issuer=https://foreign.test'));
  beforeEach(() => {
    vi.stubEnv('DEV_AUTH', ''); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('OIDC_ISSUER', issuer);
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('allows only the configured identity origin while preserving self, other directives and nonces', () => {
    const response = secure(html());
    const expected = policy.replace("form-action 'self';", `form-action 'self' ${origin};`);
    expect(response.headers.get('Content-Security-Policy')).toBe(expected);
    expect(response.headers.get('Content-Security-Policy')).not.toContain('/realms/company');
    expect(response.headers.get('Content-Security-Policy')).not.toContain('foreign.test');
    expect(response.headers.get('Content-Security-Policy')).not.toContain('*');
    expect(secure(response).headers.get('Content-Security-Policy')).toBe(expected);
  });

  it('extends each enforced policy without changing whitespace or unrelated policy text', () => {
    const original = "script-src 'nonce-kept'; form-action  'self'  ; object-src 'none',form-action 'self'; base-uri 'self'";
    expect(secure(html(original)).headers.get('Content-Security-Policy')).toBe(
      `script-src 'nonce-kept'; form-action  'self' ${origin}  ; object-src 'none',form-action 'self' ${origin}; base-uri 'self'`);
  });

  it.each([
    '', 'not-a-url', '//identity.example.test/realms/company', 'ftp://identity.example.test',
    'data:text/html,identity', 'https://user:password@identity.example.test/realms/company',
    'https://identity.example.test/realms/company?next=https://foreign.test',
    'https://identity.example.test/realms/company#fragment', 'https://*.example.test/realms/company',
    'https://identity.example.test,foreign.test/realms/company',
    'https://identity.example.test;foreign.test/realms/company',
    'https://identity.example.test/realms/company\r\nform-action *',
    ' https://identity.example.test/realms/company', 'http://identity.example.test/realms/company',
    'http://127.0.0.1:8180/realms/company'
  ])('does not broaden the production policy for invalid issuer %j', configured => {
    vi.stubEnv('OIDC_ISSUER', configured);
    expect(secure(html()).headers.get('Content-Security-Policy')).toBe(policy);
  });

  it('leaves the policy restricted with missing configuration or synthetic development auth', () => {
    vi.stubEnv('OIDC_ISSUER', undefined);
    expect(secure(html()).headers.get('Content-Security-Policy')).toBe(policy);
    vi.stubEnv('OIDC_ISSUER', issuer); vi.stubEnv('DEV_AUTH', 'synthetic');
    expect(secure(html()).headers.get('Content-Security-Policy')).toBe(policy);
  });

  it('permits local HTTP development identity only outside production', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('OIDC_ISSUER', 'http://127.0.0.1:8180/realms/test');
    expect(secure(html()).headers.get('Content-Security-Policy')).toBe(
      policy.replace("form-action 'self';", "form-action 'self' http://127.0.0.1:8180;"));
    vi.stubEnv('OIDC_ISSUER', 'http://foreign.test/realms/test');
    expect(secure(html()).headers.get('Content-Security-Policy')).toBe(policy);
  });

  it('changes only an existing HTML self policy and retains explicit deny policies', () => {
    expect(secure(html(policy, 'application/json')).headers.get('Content-Security-Policy')).toBe(policy);
    for (const restricted of ["form-action 'none'", "form-action 'self' 'none'", "default-src 'self'", `form-action ${origin}`]) {
      expect(secure(html(restricted)).headers.get('Content-Security-Policy')).toBe(restricted);
    }
    const response = new Response('HTML', { headers: { 'Content-Type': 'text/html' } });
    expect(secure(response).headers.has('Content-Security-Policy')).toBe(false);
  });
});
