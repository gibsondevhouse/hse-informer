import { randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import type { Role } from './auth';

export const privilegedRoles: Role[] = ['tenant_admin','site_admin','hse_reviewer','evaluator','auditor'];
export interface AccountIdentity { tenantId: string; personId: string; displayName: string; email: string | null; technicalEmail?: boolean; role: Role }
export interface IdentityAdmin {
  issuer: string;
  createAccount(person: AccountIdentity): Promise<string>;
  removeAccount(subject: string): Promise<void>;
  configureAccount(subject: string, enabled: boolean, role: Role): Promise<void>;
  updateProfile(subject: string, displayName: string, email: string | null, technicalEmail?: boolean): Promise<void>;
  invite(subject: string, lifespanSeconds: number): Promise<void>;
  setPassword(subject: string, password: string): Promise<void>;
  logout(subject: string): Promise<void>;
}

/** Service credentials are mandatory. Missing or rejected configuration fails closed. */
export function keycloakAdmin(fetcher: typeof fetch = fetch): IdentityAdmin {
  const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID;
  const secret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!issuer || !clientId || !secret || !origin) throw error(503, 'Account administration is not configured');
  const match = /^(https?:\/\/.+)\/realms\/([^/]+)$/.exec(issuer);
  if (!match) throw error(503, 'Invalid Keycloak issuer configuration');
  const base = `${match[1]}/admin/realms/${encodeURIComponent(match[2])}`;
  let token: string | undefined;
  async function request(path: string, method: string, body?: unknown): Promise<Response> {
    if (!token) {
      const response = await fetcher(`${issuer}/protocol/openid-connect/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId!, client_secret: secret! }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw error(503, 'Identity provider service authentication failed');
      const data = await response.json() as { access_token?: string };
      if (!data.access_token) throw error(503, 'Identity provider returned no service token');
      token = data.access_token;
    }
    const response = await fetcher(`${base}${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw error(503, `Identity provider account operation failed (${response.status})`);
    return response;
  }
  return {
    issuer,
    async createAccount(person) {
      const response = await request('/users', 'POST', {
        username: `hse-${person.personId}`, email: person.email || undefined,
        firstName: person.displayName, enabled: true, emailVerified: false,
        attributes: { hse_person_id: [person.personId], hse_tenant_id: [person.tenantId],
          hse_identity_email_technical: [String(person.technicalEmail === true)] },
        requiredActions: ['UPDATE_PASSWORD', ...(person.email && !person.technicalEmail ? ['VERIFY_EMAIL'] : []),
          ...(privilegedRoles.includes(person.role) ? ['CONFIGURE_TOTP'] : [])]
      });
      const subject = response.headers.get('location')?.split('/').at(-1);
      if (!subject || !/^[a-zA-Z0-9_-]+$/.test(subject)) throw error(503, 'Identity provider returned no account identifier');
      return subject;
    },
    async removeAccount(subject) { await request(`/users/${encodeURIComponent(subject)}`, 'DELETE'); },
    async configureAccount(subject, enabled, role) {
      // PUT merges user fields in Keycloak; do not remove existing required actions.
      const current = await (await request(`/users/${encodeURIComponent(subject)}`, 'GET')).json() as {
        requiredActions?: string[]; totp?: boolean;
      };
      const requiredActions = new Set(current.requiredActions ?? []);
      if (privilegedRoles.includes(role) && !current.totp) requiredActions.add('CONFIGURE_TOTP');
      await request(`/users/${encodeURIComponent(subject)}`, 'PUT', { enabled, requiredActions: [...requiredActions] });
    },
    async updateProfile(subject, displayName, email, technicalEmail = false) {
      const current = await (await request(`/users/${encodeURIComponent(subject)}`, 'GET')).json() as { email?: string };
      await request(`/users/${encodeURIComponent(subject)}`, 'PUT', { firstName: displayName, email: email ?? '',
        ...(current.email !== email || technicalEmail ? { emailVerified: false } : {}) });
    },
    async invite(subject, lifespanSeconds) {
      await request(`/users/${encodeURIComponent(subject)}/execute-actions-email?lifespan=${lifespanSeconds}&client_id=${encodeURIComponent(process.env.OIDC_CLIENT_ID ?? '')}&redirect_uri=${encodeURIComponent(`${origin}/`)}`,
        'PUT', ['UPDATE_PASSWORD']);
    },
    async setPassword(subject, password) {
      await request(`/users/${encodeURIComponent(subject)}/reset-password`, 'PUT', { type: 'password', value: password, temporary: false });
      const current = await (await request(`/users/${encodeURIComponent(subject)}`, 'GET')).json() as { requiredActions?: string[] };
      await request(`/users/${encodeURIComponent(subject)}`, 'PUT', { emailVerified:false,
        requiredActions: (current.requiredActions ?? []).filter(action => action !== 'UPDATE_PASSWORD' && action !== 'VERIFY_EMAIL') });
    },
    async logout(subject) { await request(`/users/${encodeURIComponent(subject)}/logout`, 'POST'); }
  };
}

export function newActivationCode(): string { return randomBytes(24).toString('base64url'); }
