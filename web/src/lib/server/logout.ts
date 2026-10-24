import type { Actor } from './auth';
import { query } from './db';
import { endMoodleUserSessions, findMoodleUserByHseId, moodleConnection } from './moodle';

/** End only the authenticated person's mapped sessions; never accept a target user or URL from the browser. */
export async function logoutDestination(actor: Actor | null): Promise<string> {
  const status = new URLSearchParams();
  if (actor && !actor.tenantSynthetic) {
    try {
      await query('UPDATE principals SET session_version=session_version+1 WHERE tenant_id=$1 AND id=$2', [actor.tenantId, actor.id]);
    } catch { status.set('portal', 'unconfirmed'); }
  }
  if (actor?.personId && !actor.tenantSynthetic) {
    try {
      const connection = moodleConnection(actor.tenantId);
      if (!connection) throw new Error('Moodle logout is not configured');
      const people = await query<{ hse_id: string }>('SELECT hse_id FROM people WHERE tenant_id=$1 AND id=$2', [actor.tenantId, actor.personId]);
      const ids = await query<{ external_id: string }>(`SELECT external_id FROM person_external_ids
        WHERE tenant_id=$1 AND person_id=$2 AND source='moodle' AND instance_key=$3 AND superseded_at IS NULL`,
        [actor.tenantId, actor.personId, connection.instanceId]);
      if (ids.length > 1 || !people[0]) throw new Error('Moodle identity is ambiguous');
      const userId = ids[0] ? Number(ids[0].external_id) : await findMoodleUserByHseId(actor.tenantId, people[0].hse_id);
      if (userId !== null) await endMoodleUserSessions(actor.tenantId, userId);
    } catch { status.set('moodle', 'unconfirmed'); }
  }
  const localPath = () => '/signed-out' + (status.size ? '?' + status.toString() : '');
  // The development preview never contacts a real identity provider.
  if (process.env.DEV_AUTH === 'synthetic') return localPath();
  try {
    const issuer = process.env.OIDC_ISSUER?.replace(/\/$/, '');
    const clientId = process.env.OIDC_CLIENT_ID;
    const origin = process.env.APP_ORIGIN;
    if (!issuer || !clientId || !origin) throw new Error('Identity logout is not configured');
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Identity discovery failed');
    const discovery = await response.json();
    if (discovery.issuer !== issuer || typeof discovery.end_session_endpoint !== 'string') throw new Error('Missing logout endpoint');
    const target = new URL(discovery.end_session_endpoint);
    if (target.origin !== new URL(issuer).origin || (process.env.NODE_ENV === 'production' && target.protocol !== 'https:')) throw new Error('Invalid logout endpoint');
    target.searchParams.set('client_id', clientId);
    target.searchParams.set('post_logout_redirect_uri', new URL(localPath(), origin).toString());
    return target.toString();
  } catch { status.set('identity', 'unconfirmed'); return localPath(); }
}
