import { describe, expect, it } from 'vitest';
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
