import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { GET as login } from '../src/routes/auth/login/+server';
import { POST as logout } from '../src/routes/auth/logout/+server';

const mocks = vi.hoisted(() => ({ start: vi.fn(), end: vi.fn() }));
vi.mock('../src/lib/server/auth', () => ({ startLogin: mocks.start }));
vi.mock('../src/lib/server/logout', () => ({ logoutDestination: mocks.end }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const capture = async (call: () => unknown) => { try { return await call(); } catch (cause) { return cause; } };

describe('actual SvelteKit identity redirect policy', () => {
  const issuer = 'https://identity.example.test/realms/company';
  const event = () => ({ cookies: { delete: vi.fn() }, locals: { actor: null },
    url: new URL('https://portal.example.test/auth/login?returnTo=/learn') });

  it('permits the configured identity origin for sign-in without widening the allowlist', async () => {
    vi.stubEnv('OIDC_ISSUER', issuer);
    const destination = `${issuer}/protocol/openid-connect/auth?state=synthetic`;
    mocks.start.mockResolvedValue(destination);
    const result = await capture(() => login(event() as never));
    expect(isRedirect(result)).toBe(true);
    expect(result).toMatchObject({ status: 302, location: destination });
    mocks.start.mockResolvedValue('https://foreign.example.test/sign-in');
    const rejected = await capture(() => login(event() as never));
    expect(isRedirect(rejected)).toBe(false);
    expect(rejected).toBeInstanceOf(Error);
  });

  it('clears portal cookies and permits only the configured identity sign-out origin', async () => {
    vi.stubEnv('OIDC_ISSUER', issuer);
    const destination = `${issuer}/protocol/openid-connect/logout?client_id=hse`;
    mocks.end.mockResolvedValue(destination);
    const request = event();
    const result = await capture(() => logout(request as never));
    expect(isRedirect(result)).toBe(true);
    expect(result).toMatchObject({ status: 303, location: destination });
    expect(request.cookies.delete.mock.calls).toEqual([
      ['hse_session', { path: '/' }], ['hse_oidc_flow', { path: '/' }]
    ]);
    mocks.end.mockResolvedValue('https://foreign.example.test/sign-out');
    const rejected = await capture(() => logout(event() as never));
    expect(isRedirect(rejected)).toBe(false);
    expect(rejected).toBeInstanceOf(Error);
  });

  it.each(['', 'invalid-issuer'])('keeps local sign-out usable with unavailable identity config (%s)', async issuer => {
    vi.stubEnv('OIDC_ISSUER', issuer);
    mocks.end.mockResolvedValue('/signed-out?identity=unconfirmed');
    const result = await capture(() => logout(event() as never));
    expect(isRedirect(result)).toBe(true);
    expect(result).toMatchObject({ status: 303, location: '/signed-out?identity=unconfirmed' });
  });
});
