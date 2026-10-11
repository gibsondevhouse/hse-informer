export type Role = 'admin' | 'site_manager' | 'evaluator' | 'auditor';
export type Permission = 'read' | 'manage' | 'evaluate' | 'admin';

export function hasSitePermission(
  actor: { role: Role; siteIds: string[] },
  siteId: string,
  permission: Permission,
): boolean {
  if (actor.role === 'admin') return true;
  if (!actor.siteIds.includes(siteId)) return false;
  if (permission === 'read') return true;
  if (permission === 'manage') return actor.role === 'site_manager';
  if (permission === 'evaluate') return actor.role === 'evaluator' || actor.role === 'site_manager';
  return false;
}
