import { env } from 'cloudflare:workers';
import { verifyAccessToken } from './access-token';
import { hasSitePermission, type Permission, type Role } from './permissions';

export type AdminRole = Role;
export type AdminActor = {
  sub: string;
  email: string;
  role: AdminRole;
  siteIds: string[];
};
export type AdminContext = { db: D1Database; actor: AdminActor; asOf: string };
export type LearnerContext = {
  db: D1Database;
  worker: { id: string; name: string; email: string; siteId: string; group: string };
  actor: { sub: string; email: string };
  asOf: string;
};

type RuntimeEnv = {
  DB?: D1Database;
  HSE_ACCESS_TEAM_DOMAIN?: string;
  HSE_ACCESS_AUD?: string;
  HSE_JOB_TOKEN?: string;
  HSE_NOTIFICATION_WEBHOOK?: string;
  HSE_NOTIFICATION_TOKEN?: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function runtimeEnv(): RuntimeEnv {
  return env as unknown as RuntimeEnv;
}

export function getDatabase(): D1Database {
  const db = runtimeEnv().DB;
  if (!db || typeof db.prepare !== 'function') {
    throw new ApiError(503, 'Shared records are not configured. Set up the DB binding.');
  }
  return db;
}

async function getIdentity(request: Request) {
  const config = runtimeEnv();
  const teamDomain = config.HSE_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const audience = config.HSE_ACCESS_AUD?.trim();
  if (!teamDomain || !audience || !/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(teamDomain)) {
    throw new ApiError(503, 'Cloudflare Access identity is not configured.');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new ApiError(401, 'Sign in through Cloudflare Access.');
  try {
    return await verifyAccessToken(token, `https://${teamDomain}`, audience);
  } catch {
    throw new ApiError(401, 'Your Access session could not be verified.');
  }
}

export async function getAdminContext(request: Request): Promise<AdminContext> {
  const db = getDatabase();
  const identity = await getIdentity(request);
  const user = await db
    .prepare('SELECT sub, email, role FROM users WHERE sub = ? AND email = ? AND active = 1')
    .bind(identity.sub, identity.email)
    .first<{ sub: string; email: string; role: AdminRole }>();
  if (!user) throw new ApiError(403, 'This account has no administrator access.');
  const grants = await db
    .prepare('SELECT site_id FROM user_sites WHERE user_sub = ?')
    .bind(user.sub)
    .all<{ site_id: string }>();
  return {
    db,
    actor: { sub: user.sub, email: user.email, role: user.role, siteIds: grants.results.map((grant) => grant.site_id) },
    asOf: new Date().toISOString(),
  };
}

export async function getLearnerContext(request: Request): Promise<LearnerContext> {
  const db = getDatabase();
  const identity = await getIdentity(request);
  const worker = await db
    .prepare(`SELECT w.id,w.name,w.email,w.site_id,w.group_name FROM workers w
      JOIN sites s ON s.id = w.site_id AND s.active = 1 WHERE w.email = ? AND w.active = 1`)
    .bind(identity.email)
    .first<{ id: string; name: string; email: string; site_id: string; group_name: string }>();
  if (!worker) throw new ApiError(403, 'This account is not on the active worker roster.');
  return {
    db,
    worker: { id: worker.id, name: worker.name, email: worker.email, siteId: worker.site_id, group: worker.group_name },
    actor: identity,
    asOf: new Date().toISOString(),
  };
}

export function assertSiteAccess(
  context: AdminContext,
  siteId: string,
  permission: Permission = 'read',
): void {
  if (!hasSitePermission(context.actor, siteId, permission)) {
    throw new ApiError(403, 'Your role cannot perform this action.');
  }
}

export async function permittedSiteIds(context: AdminContext): Promise<string[]> {
  if (context.actor.role !== 'admin') return context.actor.siteIds;
  const result = await context.db.prepare('SELECT id FROM sites').all<{ id: string }>();
  return result.results.map((site) => site.id);
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && /UNIQUE constraint failed|constraint violation/i.test(error.message)) {
    return Response.json({ error: 'A record with this identifier already exists or is still open.' }, { status: 409 });
  }
  if (error instanceof Error && /no such table/i.test(error.message)) {
    return Response.json({ error: 'Shared records need database migrations before use.' }, { status: 503 });
  }
  console.error('Admin API error', error);
  return Response.json({ error: 'The request could not be completed.' }, { status: 500 });
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 65_536) throw new ApiError(413, 'Request body is too large.');
    value = JSON.parse(raw);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Request body must be JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'Request body must be an object.');
  }
  return value as Record<string, unknown>;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new ApiError(403, 'This action must come from this workspace.');
  }
}
