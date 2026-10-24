import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { error, redirect, type Cookies } from '@sveltejs/kit';
import { query } from './db';

export function verifiedMfa(payload: Record<string, unknown>): boolean {
  return (Array.isArray(payload.amr) && (payload.amr.includes('mfa')
    || (payload.amr.includes('pwd') && payload.amr.some((method) => method === 'otp' || method === 'hwk'))))
    || (typeof payload.acr === 'string' && /^\d+$/.test(payload.acr) && Number(payload.acr) >= 2);
}
function requiresMfa(actor: Actor): boolean { return actor.role !== 'learner'; }
async function acceptInvitation(actor: Actor): Promise<void> {
  await query(`UPDATE person_account_invitations SET accepted_at=now()
    WHERE tenant_id=$1 AND principal_id=$2 AND accepted_at IS NULL AND expires_at > now()`, [actor.tenantId,actor.id]);
}

export type Role = 'tenant_admin' | 'site_admin' | 'hse_reviewer' | 'evaluator' | 'learner' | 'auditor';
export interface Actor {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSynthetic: boolean;
  personId: string | null;
  displayName: string;
  role: Role;
  siteIds: string[];
  sessionVersion?: number;
  authValidAfter?: string;
}

export function identityTokenCurrent(actor: Actor, issuedAt: unknown): boolean {
  if (typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || !actor.authValidAfter) return false;
  const validAfter = Date.parse(actor.authValidAfter);
  // JWT iat normally has whole-second precision. Requiring the next second
  // prevents a token from earlier in the revocation second being revived,
  // including when PostgreSQL microseconds are truncated by the JS Date parser.
  return Number.isFinite(validAfter) && issuedAt >= Math.floor(validAfter/1000)+1;
}

/** Used on logout and other explicit revocations; the DB trigger sets the cutoff. */
export async function revokePrincipalSessions(actor: Pick<Actor,'id'|'tenantId'>): Promise<void> {
  await query('UPDATE principals SET session_version=session_version+1 WHERE tenant_id=$1 AND id=$2',[actor.tenantId,actor.id]);
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}
let discoveryPromise: Promise<Discovery> | undefined;

function requireOidcConfig() {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!issuer || !clientId || !clientSecret || !origin) throw new Error('OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and APP_ORIGIN are required');
  return { issuer: issuer.replace(/\/$/, ''), clientId, clientSecret, origin };
}

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return new TextEncoder().encode(secret);
}

export function safeReturnTo(value: string, origin: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return '/';
  try {
    const target = new URL(value, origin);
    if (target.origin !== new URL(origin).origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return '/'; }
}

async function discovery(): Promise<Discovery> {
  const { issuer } = requireOidcConfig();
  discoveryPromise ??= fetch(`${issuer}/.well-known/openid-configuration`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`OIDC discovery failed: ${response.status}`);
      const data = await response.json() as Discovery;
      if (data.issuer !== issuer) throw new Error('OIDC issuer mismatch');
      return data;
    }).catch((cause) => {
      discoveryPromise = undefined;
      throw cause;
    });
  return discoveryPromise;
}

export async function startLogin(cookies: Cookies, returnTo: string): Promise<string> {
  const { clientId, origin } = requireOidcConfig();
  const config = await discovery();
  const state = randomBytes(24).toString('base64url');
  const nonce = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const safeReturn = safeReturnTo(returnTo, origin);
  const payload = await new SignJWT({ state, nonce, verifier, returnTo: safeReturn })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(sessionKey());
  cookies.set('hse_oidc_flow', payload, { path: '/', httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https://'), maxAge: 600 });
  const url = new URL(config.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${origin}/auth/callback`);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function finishLogin(cookies: Cookies, code: string, state: string): Promise<string> {
  const flow = cookies.get('hse_oidc_flow');
  cookies.delete('hse_oidc_flow', { path: '/' });
  if (!flow) throw error(400, 'Missing sign-in flow');
  const verifiedFlow = await jwtVerify(flow, sessionKey(), { algorithms: ['HS256'] });
  const expected = verifiedFlow.payload;
  if (expected.state !== state || typeof expected.verifier !== 'string' || typeof expected.nonce !== 'string') throw error(400, 'Invalid sign-in state');

  const { clientId, clientSecret, origin } = requireOidcConfig();
  const config = await discovery();
  const body = new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: `${origin}/auth/callback`,
    client_id: clientId, client_secret: clientSecret, code_verifier: expected.verifier
  });
  const response = await fetch(config.token_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) throw error(401, 'Sign-in token exchange failed');
  const tokens = await response.json() as { id_token?: string };
  if (!tokens.id_token) throw error(401, 'Missing identity token');
  const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(config.jwks_uri)), {
    issuer: config.issuer, audience: clientId, algorithms: ['RS256', 'ES256']
  });
  if (payload.nonce !== expected.nonce || !payload.sub) throw error(401, 'Invalid identity token');
  const actor = await actorForSubject(config.issuer, payload.sub);
  if (!actor) throw error(403, 'Account has no HSE Informer access');
  if (!identityTokenCurrent(actor,payload.iat)) throw error(401,'Sign in again after the account access change');
  const mfa = verifiedMfa(payload);
  if (requiresMfa(actor) && !mfa) throw error(403, 'Multi-factor sign-in is required for this role. Configure MFA in your identity account and sign in again.');
  await acceptInvitation(actor);
  const session = await new SignJWT({ sub: payload.sub, oidcIssuer: config.issuer,
    principalId: actor.id, tenantId: actor.tenantId, mfa, sessionVersion:actor.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('12h').sign(sessionKey());
  cookies.set('hse_session', session, { path: '/', httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https://'), maxAge: 43200 });
  return typeof expected.returnTo === 'string' ? safeReturnTo(expected.returnTo, origin) : '/';
}

export async function actorForSubject(issuer: string, subject: string): Promise<Actor | null> {
  const rows = await query<{
    id: string; tenant_id: string; tenant_name: string; synthetic: boolean; person_id: string | null;
    display_name: string | null; role: Role; site_ids: string[]; session_version:number; auth_valid_after:Date;
  }>(`SELECT p.id, p.tenant_id, t.name AS tenant_name, t.synthetic, p.person_id,
      COALESCE(pe.display_name, p.oidc_subject) AS display_name, p.role, p.session_version,p.auth_valid_after,
      CASE WHEN p.role = 'learner'
        THEN COALESCE(array_agg(DISTINCT m.site_id) FILTER (WHERE m.site_id IS NOT NULL), ARRAY[]::uuid[])
        ELSE COALESCE(array_agg(DISTINCT a.site_id) FILTER (WHERE a.site_id IS NOT NULL), ARRAY[]::uuid[])
      END AS site_ids
     FROM principals p JOIN tenants t ON t.id = p.tenant_id
     LEFT JOIN people pe ON pe.tenant_id = p.tenant_id AND pe.id = p.person_id
     LEFT JOIN principal_site_access a ON a.tenant_id = p.tenant_id AND a.principal_id = p.id
     LEFT JOIN person_site_memberships m ON m.tenant_id = p.tenant_id
       AND m.person_id = p.person_id AND m.ended_at IS NULL
     WHERE p.oidc_issuer = $1 AND p.oidc_subject = $2 AND p.active AND (pe.id IS NULL OR (pe.active AND NOT pe.account_access_locked))
       AND NOT EXISTS (SELECT 1 FROM person_account_invitations i WHERE i.tenant_id=p.tenant_id
         AND i.principal_id=p.id AND i.accepted_at IS NULL AND i.expires_at <= now())
     GROUP BY p.id, t.name, t.synthetic, pe.display_name`, [issuer, subject]);
  if (rows.length !== 1) return null;
  const row = rows[0];
  return { id: row.id, tenantId: row.tenant_id, tenantName: row.tenant_name,
    tenantSynthetic: row.synthetic, personId: row.person_id,
    displayName: row.display_name ?? 'User', role: row.role, siteIds: row.site_ids,
    sessionVersion:row.session_version,authValidAfter:row.auth_valid_after.toISOString() };
}

export async function actorFromRequest(cookies: Cookies, bearer?: string): Promise<Actor | null> {
  if (process.env.DEV_AUTH === 'synthetic') {
    if (process.env.NODE_ENV === 'production') throw new Error('DEV_AUTH is forbidden in production');
    const synthetic = await actorForSubject('synthetic-dev', 'synthetic-dev-admin');
    if (synthetic) return synthetic;
  }
  let subject: string | undefined;
  let issuer: string | undefined;
  let sessionPrincipalId: string | undefined;
  let sessionTenantId: string | undefined;
  let sessionVersion: number | undefined;
  let identityIssuedAt: unknown;
  let mfa = false;
  if (bearer) {
    const config = await discovery();
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(bearer, createRemoteJWKSet(new URL(config.jwks_uri)), {
        issuer: config.issuer, audience: requireOidcConfig().clientId, algorithms: ['RS256', 'ES256']
      }));
    } catch (cause) {
      if (cause instanceof joseErrors.JWTInvalid || cause instanceof joseErrors.JWSInvalid
        || cause instanceof joseErrors.JWTExpired || cause instanceof joseErrors.JWTClaimValidationFailed
        || cause instanceof joseErrors.JWSSignatureVerificationFailed || cause instanceof joseErrors.JOSEAlgNotAllowed
        || cause instanceof joseErrors.JOSENotSupported || cause instanceof joseErrors.JWKSNoMatchingKey) {
        throw error(401, 'Sign in required');
      }
      // Network, key-service and configuration failures remain infrastructure
      // errors; never relabel an unavailable identity service as bad credentials.
      throw cause;
    }
    subject = payload.sub;
    issuer = config.issuer;
    mfa = verifiedMfa(payload);
    identityIssuedAt=payload.iat;
  } else {
    const session = cookies.get('hse_session');
    if (!session) return null;
    try {
      const { payload } = await jwtVerify(session, sessionKey(), { algorithms: ['HS256'] });
      subject = payload.sub;
      issuer = typeof payload.oidcIssuer === 'string' ? payload.oidcIssuer : undefined;
      sessionPrincipalId = typeof payload.principalId === 'string' ? payload.principalId : undefined;
      sessionTenantId = typeof payload.tenantId === 'string' ? payload.tenantId : undefined;
      sessionVersion=typeof payload.sessionVersion==='number'&&Number.isSafeInteger(payload.sessionVersion)&&payload.sessionVersion>=0?payload.sessionVersion:undefined;
      mfa = payload.mfa === true;
      if (issuer !== requireOidcConfig().issuer) return null;
    } catch { return null; }
  }
  const actor = subject && issuer ? await actorForSubject(issuer, subject) : null;
  if(actor && bearer && !identityTokenCurrent(actor,identityIssuedAt))return null;
  if (actor && !bearer && (!sessionPrincipalId || !sessionTenantId || sessionVersion===undefined
    || actor.id!==sessionPrincipalId || actor.tenantId!==sessionTenantId || actor.sessionVersion!==sessionVersion)) return null;
  if (actor && requiresMfa(actor) && !mfa) return null;
  if (actor && bearer) await acceptInvitation(actor);
  return actor;
}

export function requireActor(actor: Actor | null): Actor {
  if (!actor) throw error(401, 'Sign in required');
  return actor;
}

export function requireRole(actor: Actor, roles: Role[]): void {
  if (!roles.includes(actor.role)) throw error(403, 'Insufficient permission');
}

export function canAccessSite(actor: Actor, siteId: string): boolean {
  return actor.role === 'tenant_admin' || actor.role === 'auditor' || actor.role === 'hse_reviewer' || actor.siteIds.includes(siteId);
}

export function requireSite(actor: Actor, siteId: string): void {
  if (!canAccessSite(actor, siteId)) throw error(403, 'Site access denied');
}
