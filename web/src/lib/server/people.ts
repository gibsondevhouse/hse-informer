import { createHash, randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { canAccessSite, requireRole, type Actor, type Role } from './auth';
import { query, transaction } from './db';
import { keycloakAdmin, newActivationCode, type IdentityAdmin } from './keycloak';

export const roles: Role[] = ['tenant_admin','site_admin','hse_reviewer','evaluator','learner','auditor'];
const text = (max: number) => z.string().trim().max(max).nullable();
const fields = {
  displayName: z.string().trim().min(1).max(200), employeeNumber: text(100),
  email: z.union([z.email().max(254), z.literal(''), z.null()]), phone: text(50),
  jobTitle: text(150), department: text(150),
  language: z.string().trim().min(2).max(35).regex(/^[a-zA-Z0-9-]+$/),
  personType: z.enum(['employee','contractor','temporary']),
  startDate: z.union([z.iso.date(), z.literal(''), z.null()]),
  siteIds: z.array(z.uuid()).min(1).max(100), active: z.boolean()
};
const createSchema = z.strictObject({ ...fields,
  employeeNumber: fields.employeeNumber.optional(), email: fields.email.optional(),
  phone: fields.phone.optional(), jobTitle: fields.jobTitle.optional(), department: fields.department.optional(),
  language: fields.language.default('en'), personType: fields.personType.default('employee'),
  startDate: fields.startDate.optional(), active: z.literal(true).default(true),
  reason: z.string().trim().min(5).max(500)
});
const updateSchema = z.strictObject({
  ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.optional()])) as {
    [K in keyof typeof fields]: z.ZodOptional<(typeof fields)[K]>
  }, reason: z.string().trim().min(5).max(500)
});

export interface PersonProfile {
  id: string; displayName: string; employeeNumber: string | null; email: string | null;
  identityEmail: string; identityEmailTechnical: boolean;
  accountAccessLocked: boolean;
  phone: string | null; jobTitle: string | null; department: string | null;
  language: string; personType: 'employee' | 'contractor' | 'temporary'; startDate: string | null;
  active: boolean; siteIds: string[]; updatedAt: string;
}
interface PersonRow {
  id: string; display_name: string; employee_number: string | null; email: string | null;
  identity_email: string; identity_email_technical: boolean;
  account_access_locked: boolean;
  phone: string | null; job_title: string | null; department: string | null;
  language: string; person_type: PersonProfile['personType']; start_date: string | null;
  active: boolean; site_ids: string[]; updated_at: Date;
}
function profile(row: PersonRow): PersonProfile {
  return { id: row.id, displayName: row.display_name, employeeNumber: row.employee_number,
    email: row.email, identityEmail: row.identity_email, identityEmailTechnical: row.identity_email_technical, accountAccessLocked:row.account_access_locked,
    phone: row.phone, jobTitle: row.job_title, department: row.department,
    language: row.language, personType: row.person_type, startDate: row.start_date,
    active: row.active, siteIds: row.site_ids, updatedAt: row.updated_at.toISOString() };
}
function normalize(value: string | null | undefined): string | null { return value?.trim() || null; }
const personSelect = `SELECT p.*, p.start_date::text AS start_date,
  COALESCE((SELECT array_agg(m.site_id ORDER BY m.site_id) FROM person_site_memberships m
    WHERE m.tenant_id = p.tenant_id AND m.person_id = p.id AND m.ended_at IS NULL), ARRAY[]::uuid[]) AS site_ids
  FROM people p`;

export function mayReadPerson(actor: Actor, person: Pick<PersonProfile,'id'|'siteIds'>): boolean {
  if (actor.role === 'learner') return actor.personId === person.id;
  return ['tenant_admin','hse_reviewer','auditor'].includes(actor.role)
    || person.siteIds.some((id) => canAccessSite(actor, id));
}
export function requireManagePerson(actor: Actor, person: Pick<PersonProfile,'siteIds'>): void {
  requireRole(actor, ['tenant_admin','site_admin']);
  if (actor.role !== 'tenant_admin' && (!person.siteIds.length
    || person.siteIds.some((id) => !actor.siteIds.includes(id)))) throw error(403, 'All profile sites must be in your administrative scope');
}
async function getPerson(client: Pick<PoolClient,'query'>, actor: Actor, id: string, lock = false): Promise<PersonProfile> {
  if (!z.uuid().safeParse(id).success) throw error(404, 'Profile not found');
  const result = await client.query<PersonRow>(`${personSelect} WHERE p.tenant_id = $1 AND p.id = $2 ${lock ? 'FOR UPDATE OF p' : ''}`, [actor.tenantId, id]);
  if (!result.rows[0]) throw error(404, 'Profile not found');
  const value = profile(result.rows[0]);
  if (!mayReadPerson(actor, value)) throw error(404, 'Profile not found');
  return value;
}
async function validateSites(client: PoolClient, actor: Actor, ids: string[]): Promise<void> {
  if (new Set(ids).size !== ids.length) throw error(400, 'Duplicate sites');
  for (const id of ids) if (!canAccessSite(actor, id)) throw error(403, 'Site access denied');
  const found = await client.query('SELECT id FROM sites WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [actor.tenantId, ids]);
  if (found.rowCount !== ids.length) throw error(404, 'Site not found');
}
async function audit(client: PoolClient, actor: Actor, action: string, id: string,
  before: unknown, after: unknown, reason: string): Promise<void> {
  await client.query(`INSERT INTO audit_log (tenant_id, actor_principal_id, action, entity_type, entity_id, before_value, after_value)
    VALUES ($1,$2,$3,'person',$4,$5::jsonb,$6::jsonb)`,
  [actor.tenantId, actor.id, action, id, JSON.stringify(before), JSON.stringify({ value: after, reason })]);
}

export async function listPeople(actor: Actor, includeInactive = false): Promise<PersonProfile[]> {
  if (includeInactive) requireRole(actor, ['tenant_admin','site_admin','hse_reviewer','auditor']);
  const rows = await query<PersonRow>(`${personSelect} WHERE p.tenant_id = $1 ${includeInactive ? '' : 'AND p.active'}
    AND ($2::boolean OR p.id = $3::uuid OR ($4::boolean AND EXISTS (
      SELECT 1 FROM person_site_memberships m WHERE m.tenant_id = p.tenant_id AND m.person_id = p.id
        AND m.ended_at IS NULL AND m.site_id = ANY($5::uuid[])))) ORDER BY lower(p.display_name), p.id`,
  [actor.tenantId, ['tenant_admin','hse_reviewer','auditor'].includes(actor.role),
    actor.role === 'learner' ? actor.personId : null, actor.role !== 'learner', actor.siteIds]);
  return rows.map(profile);
}

export async function personDetail(actor: Actor, id: string) {
  const person = await transaction((client) => getPerson(client, actor, id));
  const unrestricted = ['tenant_admin','hse_reviewer','auditor'].includes(actor.role) || actor.role === 'learner';
  const assignments = await query(`SELECT a.id, a.site_id AS "siteId", r.title, a.due_at AS "dueAt", a.closed_at AS "closedAt",
    a.cancelled_at AS "cancelledAt", e.id AS "completionId", e.completed_at AS "completedAt", e.delivery_source AS "deliverySource"
    FROM assignments a JOIN requirements r ON r.tenant_id = a.tenant_id AND r.id = a.requirement_id
    LEFT JOIN LATERAL (SELECT ke.* FROM effective_knowledge_evidence ke
      WHERE ke.tenant_id = a.tenant_id AND ke.assignment_id = a.id ORDER BY ke.completed_at DESC LIMIT 1) e ON true
    WHERE a.tenant_id = $1 AND a.person_id = $2 AND ($3::boolean OR a.site_id = ANY($4::uuid[]))
    ORDER BY a.assigned_at DESC LIMIT 500`, [actor.tenantId, id, unrestricted, actor.siteIds]);
  const accounts = actor.role === 'tenant_admin' || actor.role === 'site_admin'
    ? await query(`SELECT p.id, p.role, p.active, p.oidc_issuer AS issuer,
      COALESCE((SELECT array_agg(site_id ORDER BY site_id) FROM principal_site_access a
        WHERE a.tenant_id = p.tenant_id AND a.principal_id = p.id), ARRAY[]::uuid[]) AS "siteIds",
      i.expires_at AS "invitationExpiresAt", i.accepted_at AS "invitationAcceptedAt"
      FROM principals p LEFT JOIN person_account_invitations i ON i.tenant_id = p.tenant_id AND i.principal_id = p.id
      WHERE p.tenant_id = $1 AND p.person_id = $2`, [actor.tenantId, id]) : [];
  const contextChanges = await query(`SELECT id, occurred_at AS "occurredAt", reason,
    before_value AS "before", after_value AS "after" FROM person_context_changes
    WHERE tenant_id=$1 AND person_id=$2 ORDER BY occurred_at DESC LIMIT 20`,[actor.tenantId,id]);
  const moodleAccountSync = await query(`SELECT state, last_error AS "lastError", completed_at AS "completedAt"
    FROM integration_outbox WHERE tenant_id=$1 AND kind='moodle_user_state' AND aggregate_id=$2`,[actor.tenantId,id]);
  return { person, assignments, accounts, contextChanges, moodleAccountSync: moodleAccountSync[0] ?? null };
}

async function insertPerson(client: PoolClient, actor: Actor, value: z.infer<typeof createSchema>, id = randomUUID()): Promise<string> {
  requireRole(actor, ['tenant_admin','site_admin']);
  await validateSites(client, actor, value.siteIds);
  await client.query(`INSERT INTO people (id, tenant_id, display_name, employee_number, email, phone, person_type,
    job_title, department, language, start_date, synthetic) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
  [id, actor.tenantId, value.displayName, normalize(value.employeeNumber), normalize(value.email), normalize(value.phone),
    value.personType, normalize(value.jobTitle), normalize(value.department), value.language, normalize(value.startDate), actor.tenantSynthetic]);
  for (const siteId of value.siteIds) await client.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id) VALUES ($1,$2,$3)`, [actor.tenantId, id, siteId]);
  await audit(client, actor, 'person.created', id, null, { ...value, id }, value.reason);
  return id;
}
export async function createPerson(actor: Actor, input: unknown): Promise<string> {
  requireRole(actor, ['tenant_admin','site_admin']);
  const value = createSchema.safeParse(input);
  if (!value.success) throw error(400, value.error.message);
  try { return await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor.tenantId}:people`]);
    return insertPerson(client, actor, value.data);
  }); }
  catch (cause) { if ((cause as { code?: string }).code === '23505') throw error(409, 'Employee number already belongs to a profile'); throw cause; }
}

async function updatePerson(client: PoolClient, actor: Actor, id: string,
  value: z.infer<typeof updateSchema>, identity?: IdentityAdmin): Promise<PersonProfile> {
  const before = await getPerson(client, actor, id, true);
  const admin = ['tenant_admin','site_admin'].includes(actor.role);
  if (admin) requireManagePerson(actor, before);
  else if (actor.personId !== id || Object.keys(value).some((key) => !['email','phone','language','reason'].includes(key))) {
    throw error(403, 'You may update only your contact details and language');
  }
  const after: PersonProfile = { ...before, ...value, email: value.email === undefined ? before.email : normalize(value.email),
    startDate: value.startDate === undefined ? before.startDate : normalize(value.startDate),
    employeeNumber: value.employeeNumber === undefined ? before.employeeNumber : normalize(value.employeeNumber),
    phone: value.phone === undefined ? before.phone : normalize(value.phone),
    jobTitle: value.jobTitle === undefined ? before.jobTitle : normalize(value.jobTitle),
    department: value.department === undefined ? before.department : normalize(value.department) };
  await validateSites(client, actor, after.siteIds);
  if (!after.active && actor.personId === id) throw error(409, 'You cannot deactivate your own profile');
  const principals = await client.query<{ id: string; oidc_subject: string; oidc_issuer: string; role: Role }>(
    'SELECT id, oidc_subject, oidc_issuer, role FROM principals WHERE tenant_id = $1 AND person_id = $2 FOR UPDATE', [actor.tenantId, id]);
  if (before.displayName !== after.displayName && principals.rows.length) {
    const provider = identity ?? keycloakAdmin();
    for (const principal of principals.rows) {
      if (principal.oidc_issuer !== provider.issuer) throw error(409, 'Account belongs to a different identity provider');
      await provider.updateProfile(principal.oidc_subject, after.displayName, after.identityEmail, after.identityEmailTechnical);
    }
  }
  if (before.active !== after.active && principals.rows.length) {
    if (actor.role !== 'tenant_admin' && principals.rows.some((p) => p.role !== 'learner')) throw error(403, 'Only a tenant administrator may change privileged account state');
    if (!after.active && principals.rows.some((p) => p.role === 'tenant_admin')) await requireOtherAdmin(client, actor, id);
    const provider = identity ?? keycloakAdmin();
    for (const principal of principals.rows) {
      if (principal.oidc_issuer !== provider.issuer) throw error(409, 'Account belongs to a different identity provider');
      await provider.configureAccount(principal.oidc_subject, after.active && !after.accountAccessLocked, principal.role);
      if (!after.active) await provider.logout(principal.oidc_subject);
    }
    await client.query('UPDATE principals SET active = $3,session_version=session_version+1 WHERE tenant_id = $1 AND person_id = $2', [actor.tenantId, id, after.active && !after.accountAccessLocked]);
  }
  const updated = await client.query<{updated_at:Date}>(`UPDATE people SET display_name=$3, employee_number=$4, email=$5, phone=$6,
    person_type=$7, job_title=$8, department=$9, language=$10, start_date=$11, active=$12, updated_at=now()
    WHERE tenant_id=$1 AND id=$2 RETURNING updated_at`, [actor.tenantId, id, after.displayName, after.employeeNumber, after.email,
    after.phone, after.personType, after.jobTitle, after.department, after.language, after.startDate, after.active]);
  after.updatedAt=updated.rows[0].updated_at.toISOString();
  if(before.active!==after.active)await client.query(`INSERT INTO integration_outbox (tenant_id,kind,aggregate_id)
    VALUES ($1,'moodle_user_state',$2) ON CONFLICT (tenant_id,kind,aggregate_id) DO UPDATE SET
    state='pending',attempt_count=0,next_attempt_at=now(),last_error=NULL,completed_at=NULL`,[actor.tenantId,id]);
  const removed = before.siteIds.filter((site) => !after.siteIds.includes(site));
  if (removed.length) await client.query(`UPDATE person_site_memberships SET ended_at=now() WHERE tenant_id=$1
    AND person_id=$2 AND site_id=ANY($3::uuid[]) AND ended_at IS NULL`, [actor.tenantId, id, removed]);
  for (const site of after.siteIds.filter((site) => !before.siteIds.includes(site))) {
    await client.query('INSERT INTO person_site_memberships (tenant_id,person_id,site_id) VALUES ($1,$2,$3)', [actor.tenantId, id, site]);
  }
  if (before.jobTitle !== after.jobTitle || before.department !== after.department || before.personType !== after.personType
    || [...before.siteIds].sort().join() !== [...after.siteIds].sort().join()) {
    await client.query(`INSERT INTO person_context_changes (tenant_id,person_id,actor_principal_id,before_value,after_value,reason)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)`, [actor.tenantId,id,actor.id,JSON.stringify(before),JSON.stringify(after),value.reason]);
    // Existing evidence and reviewed training contexts remain immutable. A changed
    // profile is an explicit review task instead of silently extending prior approval.
  }
  await audit(client, actor, 'person.updated', id, before, after, value.reason);
  return after;
}
export async function editPerson(actor: Actor, id: string, input: unknown, identity?: IdentityAdmin): Promise<PersonProfile> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  try { return await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor.tenantId}:people`]);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor.tenantId}:accounts`]);
    return updatePerson(client, actor, id, parsed.data, identity);
  }); } catch (cause) { if ((cause as { code?: string }).code === '23505') throw error(409, 'Employee number already belongs to a profile'); throw cause; }
}
async function requireOtherAdmin(client: PoolClient, actor: Actor, excludedPersonId: string): Promise<void> {
  const other = await client.query(`SELECT 1 FROM principals p LEFT JOIN people pe ON pe.tenant_id=p.tenant_id AND pe.id=p.person_id
    WHERE p.tenant_id=$1 AND p.role='tenant_admin' AND p.active AND (pe.id IS NULL OR pe.active)
      AND p.person_id IS DISTINCT FROM $2::uuid LIMIT 1`, [actor.tenantId, excludedPersonId]);
  if (!other.rowCount) throw error(409, 'The tenant must keep an active administrator');
}

const accountSchema = z.strictObject({ action: z.enum(['invite','printed','reset','grants']),
  role: z.enum(['tenant_admin','site_admin','hse_reviewer','evaluator','learner','auditor']).default('learner'),
  siteIds: z.array(z.uuid()).max(100).default([]), reason: z.string().trim().min(5).max(500) });
export async function manageAccount(actor: Actor, id: string, input: unknown, provider?: IdentityAdmin) {
  requireRole(actor, ['tenant_admin','site_admin']);
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  if (actor.role !== 'tenant_admin' && (value.role !== 'learner' || value.action === 'grants')) throw error(403, 'Only a tenant administrator may grant account access');
  const identity = provider ?? keycloakAdmin();
  let created: string | undefined;
  try { return await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${actor.tenantId}:accounts`]);
    const person = await getPerson(client, actor, id, true);
    requireManagePerson(actor, person);
    if(value.action==='printed'&&actor.personId===id)throw error(409,'Use your account password settings for self-service password changes');
    if (!person.active) throw error(409, 'Activate the profile before managing its account');
    await validateSites(client, actor, value.siteIds);
    const existing = await client.query<{ id: string; oidc_subject: string; role: Role; active:boolean; site_ids: string[] }>(`SELECT p.*,
      COALESCE((SELECT array_agg(site_id) FROM principal_site_access a WHERE a.tenant_id=p.tenant_id AND a.principal_id=p.id),ARRAY[]::uuid[]) AS site_ids
      FROM principals p WHERE p.tenant_id=$1 AND p.person_id=$2 AND p.oidc_issuer=$3 FOR UPDATE OF p`, [actor.tenantId,id,identity.issuer]);
    const prior = existing.rows[0];
    if (actor.role !== 'tenant_admin' && prior && prior.role !== 'learner') throw error(403, 'Only a tenant administrator may manage privileged accounts');
    if (value.action === 'grants' && !prior) throw error(409, 'Invite this person before granting access');
    if (value.action === 'reset' && !prior) throw error(409, 'No account exists');
    if (value.action !== 'grants' && person.identityEmailTechnical && value.action !== 'printed') throw error(400, 'This account uses a technical login identifier. Use printed one-time access; email invitations and resets are disabled.');
    const role = value.action === 'grants' ? value.role : (prior?.role ?? value.role);
    if (value.action === 'grants' && prior?.role === 'tenant_admin' && role !== 'tenant_admin') await requireOtherAdmin(client, actor, id);
    if ((value.action === 'grants' || !prior) && ['site_admin','evaluator'].includes(role) && !value.siteIds.length) throw error(400, 'This role requires at least one site grant');
    const subject = prior?.oidc_subject ?? await identity.createAccount({ tenantId: actor.tenantId, personId:id, displayName:person.displayName,
      email:person.identityEmail, technicalEmail:person.identityEmailTechnical, role });
    if (!prior) created = subject;
    const principalId = prior?.id ?? randomUUID();
    const enabled = value.action === 'printed' ? false : value.action === 'grants' ? (prior?.active ?? true) : true;
    await identity.configureAccount(subject, enabled, role);
    if (prior && value.action !== 'grants') await identity.updateProfile(subject,person.displayName,person.identityEmail,person.identityEmailTechnical);
    if (!prior) await client.query(`INSERT INTO principals (id,tenant_id,person_id,oidc_issuer,oidc_subject,role,active) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [principalId,actor.tenantId,id,identity.issuer,subject,role,enabled]);
    let activationCode: string | undefined;
    const expiresAt = new Date(Date.now() + 30*60*1000).toISOString();
    if (value.action === 'grants') {
      await client.query('UPDATE principals SET role=$3,session_version=session_version+1 WHERE tenant_id=$1 AND id=$2', [actor.tenantId,principalId,role]);
      await client.query('DELETE FROM principal_site_access WHERE tenant_id=$1 AND principal_id=$2', [actor.tenantId,principalId]);
      for (const site of value.siteIds) await client.query('INSERT INTO principal_site_access (tenant_id,principal_id,site_id) VALUES ($1,$2,$3)', [actor.tenantId,principalId,site]);
      await identity.logout(subject);
    } else {
      if (value.action === 'printed') {
        activationCode=newActivationCode();
        await identity.logout(subject);
      } else { await identity.invite(subject,1800); if(prior)await identity.logout(subject); }
      await client.query('UPDATE principals SET active=$3,session_version=session_version+1 WHERE tenant_id=$1 AND id=$2',[actor.tenantId,principalId,enabled]);
      await client.query('UPDATE people SET account_access_locked=$3,updated_at=now() WHERE tenant_id=$1 AND id=$2',[actor.tenantId,id,value.action==='printed']);
      await queueMoodleAccountState(client,actor.tenantId,id);
      const invitation = await client.query<{ accepted_at: Date | null }>('SELECT accepted_at FROM person_account_invitations WHERE tenant_id=$1 AND principal_id=$2',[actor.tenantId,principalId]);
      const acceptedAt = value.action==='printed'?null:invitation.rows[0]?.accepted_at ?? (prior && !invitation.rowCount ? new Date() : null);
      await client.query(`INSERT INTO person_account_invitations (tenant_id,principal_id,expires_at,delivery,accepted_at,activation_code_sha256)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (tenant_id,principal_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,
        accepted_at=EXCLUDED.accepted_at,activation_code_sha256=EXCLUDED.activation_code_sha256,delivery=EXCLUDED.delivery,invited_at=now()`, [actor.tenantId,principalId,expiresAt,value.action==='printed'?'printed':'email',acceptedAt,
          activationCode?createHash('sha256').update(activationCode).digest('hex'):null]);
      if (!prior) for (const site of value.siteIds) await client.query('INSERT INTO principal_site_access (tenant_id,principal_id,site_id) VALUES ($1,$2,$3)', [actor.tenantId,principalId,site]);
    }
    await audit(client, actor, `person.account.${value.action}`, id, prior ? { role:prior.role,siteIds:prior.site_ids } : null,
      { principalId,role,siteIds:value.action==='grants'||!prior?value.siteIds:prior.site_ids, expiresAt:value.action==='grants'?null:expiresAt },value.reason);
    return { principalId, role, delivered: value.action==='grants'?'updated':value.action==='printed'?'printed':'email',
      ...(activationCode ? { username:`hse-${id}`,activationCode,activationUrl:`${process.env.APP_ORIGIN||''}/activate` } : {}), ...(value.action==='grants'?{}:{ expiresAt }) };
  }); } catch (cause) {
    if (created) {
      try { await identity.removeAccount(created); }
      catch { throw error(503, 'Account setup failed and the identity provider account could not be removed. An operator must reconcile it before retrying.'); }
    }
    throw cause;
  }
}

async function queueMoodleAccountState(client:PoolClient,tenantId:string,personId:string):Promise<void>{
  await client.query(`INSERT INTO integration_outbox (tenant_id,kind,aggregate_id) VALUES ($1,'moodle_user_state',$2)
    ON CONFLICT (tenant_id,kind,aggregate_id) DO UPDATE SET state='pending',attempt_count=0,next_attempt_at=now(),last_error=NULL,completed_at=NULL`,[tenantId,personId]);
}

/** A printed code authorizes password selection once. It is never a usable IdP password. */
export async function activateAccount(input:unknown,provider?:IdentityAdmin):Promise<{activated:true}> {
  const parsed=z.strictObject({code:z.string().trim().regex(/^[A-Za-z0-9_-]{32}$/),password:z.string().min(12).max(128)}).safeParse(input);
  if(!parsed.success)throw error(400,'Enter the activation code and a password of 12–128 characters');
  const digest=createHash('sha256').update(parsed.data.code).digest('hex');
  const lookup=await query<{tenant_id:string}>(`SELECT tenant_id FROM person_account_invitations WHERE activation_code_sha256=$1`,[digest]);
  if(!lookup[0])throw error(400,'Activation code is invalid, expired, or already used');
  const identity=provider??keycloakAdmin();
  return transaction(async client=>{
    const tenantId=lookup[0].tenant_id;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:people`]);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:accounts`]);
    const result=await client.query<{principal_id:string;person_id:string;oidc_issuer:string;oidc_subject:string;role:Role}>(`SELECT p.id AS principal_id,p.person_id,p.oidc_issuer,p.oidc_subject,p.role
      FROM person_account_invitations i JOIN principals p ON p.tenant_id=i.tenant_id AND p.id=i.principal_id
      JOIN people pe ON pe.tenant_id=p.tenant_id AND pe.id=p.person_id
      WHERE i.tenant_id=$1 AND i.activation_code_sha256=$2 AND i.delivery='printed' AND i.accepted_at IS NULL
        AND i.expires_at>now() AND pe.active AND pe.account_access_locked
      FOR UPDATE OF i,p,pe`,[tenantId,digest]);
    const account=result.rows[0];if(!account)throw error(400,'Activation code is invalid, expired, or already used');
    if(account.oidc_issuer!==identity.issuer)throw error(409,'Activation belongs to a different identity provider');
    await identity.setPassword(account.oidc_subject,parsed.data.password);
    await identity.configureAccount(account.oidc_subject,true,account.role);
    await client.query('UPDATE principals SET active=true WHERE tenant_id=$1 AND id=$2',[tenantId,account.principal_id]);
    await client.query('UPDATE people SET account_access_locked=false,updated_at=now() WHERE tenant_id=$1 AND id=$2',[tenantId,account.person_id]);
    await client.query('UPDATE person_account_invitations SET activation_code_sha256=NULL,accepted_at=now() WHERE tenant_id=$1 AND principal_id=$2',[tenantId,account.principal_id]);
    await queueMoodleAccountState(client,tenantId,account.person_id);
    await client.query(`INSERT INTO audit_log (tenant_id,action,entity_type,entity_id,after_value)
      VALUES ($1,'person.account.activated','person',$2,$3::jsonb)`,[tenantId,account.person_id,JSON.stringify({principalId:account.principal_id,source:'one-time printed activation code',requiresOidcSignIn:true})]);
    return {activated:true};
  });
}

export const rosterTemplate = 'personId,employeeNumber,displayName,email,phone,siteCode,department,jobTitle,supervisor,startDate,language,contractor\n,EMP-001,Example Worker,worker@example.com,,site-code,Operations,Operator,,2026-10-01,en,false\n';
export function parseRosterCsv(csv: string): Record<string,string>[] {
  if (csv.length > 1_000_000) throw error(400,'Roster exceeds 1 MB');
  const rows: string[][]=[]; let row:string[]=[]; let field=''; let quoted=false; let closed=false;
  csv=csv.replace(/^\uFEFF/,'');
  for (let i=0;i<csv.length;i++) {
    const c=csv[i];
    if (quoted) { if(c==='"' && csv[i+1]==='"'){field+='"';i++;} else if(c==='"'){quoted=false;closed=true;} else field+=c; }
    else if(c==='"' && field==='' && !closed) quoted=true;
    else if(c==='"')throw error(400,'Unexpected quote in unquoted CSV field');
    else if(c===',' || c==='\n' || c==='\r') {
      row.push(field.trim());field='';closed=false;
      if(c!==','){if(c==='\r'&&csv[i+1]==='\n')i++;if(row.some(Boolean))rows.push(row);row=[];}
    } else { if(closed && c.trim()) throw error(400,'Unexpected text after quoted CSV field'); field+=c; }
  }
  if(quoted)throw error(400,'Unclosed quoted CSV field');
  row.push(field.trim());if(row.some(Boolean))rows.push(row);
  const header=rows.shift();
  const allowed=rosterTemplate.split('\n')[0].split(',');
  if(!header || new Set(header).size!==header.length || header.some(h=>!allowed.includes(h))
    || !['displayName','siteCode'].every(h=>header.includes(h)) || !header.some(h=>['employeeNumber','personId'].includes(h))) throw error(400,'Use the roster CSV template headers');
  if(rows.length>500 || rows.length===0)throw error(400,'A roster must contain 1–500 people');
  return rows.map((values,index)=>{if(values.length!==header.length)throw error(400,`CSV row ${index+2} has the wrong number of fields`);return Object.fromEntries(header.map((h,i)=>[h,values[i]]));});
}
type RosterRow = { row:number; status:'new'|'changed'|'unchanged'|'rejected'; personId?:string; displayName:string; errors:string[]; value?:z.infer<typeof createSchema> };
async function planRoster(client:PoolClient,actor:Actor,csv:string) {
  const input=parseRosterCsv(csv);
  const existing=(await client.query<PersonRow>(`${personSelect} WHERE p.tenant_id=$1 ORDER BY p.id`,[actor.tenantId])).rows.map(profile);
  const sites=await client.query<{id:string;code:string}>('SELECT id,code FROM sites WHERE tenant_id=$1',[actor.tenantId]);
  const seen=new Set<string>();const planned:RosterRow[]=[];const matched=new Set<string>();
  for(const [index,row] of input.entries()) {
    const errors:string[]=[];
    const key=row.personId||row.employeeNumber?.toLowerCase();
    if(!key)errors.push('Person ID or employee number is required');
    if(key&&seen.has(key))errors.push('Duplicate person identifier in roster');if(key)seen.add(key);
    let person=row.personId?existing.find(p=>p.id===row.personId):existing.find(p=>p.employeeNumber?.toLowerCase()===row.employeeNumber?.toLowerCase());
    if(row.personId&&!person)errors.push('Person ID was not found in this tenant');
    if(person) { if(matched.has(person.id))errors.push('Profile appears more than once in roster');matched.add(person.id); try {requireManagePerson(actor,person);}catch{errors.push('Profile is outside your administrative sites');person=undefined;} }
    if(row.employeeNumber && existing.some(p=>p.id!==person?.id && p.employeeNumber?.toLowerCase()===row.employeeNumber.toLowerCase()))errors.push('Employee number is already in use');
    const site=sites.rows.find(s=>s.code===row.siteCode);
    if(!site || !canAccessSite(actor,site.id))errors.push('Site code is not in your administrative scope');
    if(row.contractor && !['true','false'].includes(row.contractor.toLowerCase()))errors.push('Contractor must be true or false');
    if(row.supervisor)errors.push('Supervisor relationships are deferred; leave supervisor blank');
    if(person&&!person.active)errors.push('Inactive profile must be reactivated separately');
    const parsed=createSchema.safeParse({displayName:row.displayName,employeeNumber:row.employeeNumber||person?.employeeNumber||null,
      email:row.email||null,phone:row.phone||null,siteIds:site?[site.id]:[],department:row.department||null,jobTitle:row.jobTitle||null,
      startDate:row.startDate||null,language:row.language||'en',personType:row.contractor?.toLowerCase()==='true'?'contractor':'employee',reason:'Roster import profile update'});
    if(!parsed.success)errors.push(...parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`));
    const value=parsed.success?parsed.data:undefined;
    let status:RosterRow['status']='new';
    if(errors.length)status='rejected';
    else if(person&&value)status=Object.entries(value).filter(([k])=>k!=='reason').every(([k,v])=>JSON.stringify(k==='siteIds'?[...v as string[]].sort():v)===JSON.stringify(k==='siteIds'?[...person.siteIds].sort():person[k as keyof PersonProfile]))?'unchanged':'changed';
    planned.push({row:index+2,status,personId:person?.id,displayName:row.displayName,errors,value});
  }
  const missing=existing.filter(p=>p.active&&!matched.has(p.id)&&mayReadPerson(actor,p)
    && (actor.role==='tenant_admin'||p.siteIds.every(id=>actor.siteIds.includes(id)))).map(p=>({id:p.id,displayName:p.displayName}));
  const hash=createHash('sha256').update(JSON.stringify({csv,actor:actor.id,planned,existing,sites:sites.rows})).digest('hex');
  return {hash,rows:planned,missing,counts:Object.fromEntries(['new','changed','unchanged','rejected'].map(status=>[status,planned.filter(p=>p.status===status).length]))};
}
export async function importRoster(actor:Actor,input:unknown) {
  requireRole(actor,['tenant_admin','site_admin']);
  const parsed=z.strictObject({csv:z.string(),dryRun:z.boolean().default(true),previewHash:z.string().optional(),reason:z.string().trim().min(5).max(500).default('Roster import profile update')}).safeParse(input);
  if(!parsed.success)throw error(400,parsed.error.message);
  return transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${actor.tenantId}:people`]);
    const plan=await planRoster(client,actor,parsed.data.csv);
    if(!parsed.data.dryRun) {
      if(!parsed.data.previewHash||parsed.data.previewHash!==plan.hash)throw error(409,'Roster or profiles changed; run the dry run again');
      if(plan.rows.some(row=>row.status==='rejected'))throw error(400,'Resolve rejected rows before importing');
      for(const row of plan.rows) {
        const value={...row.value!,reason:parsed.data.reason};
        if(row.status==='new')row.personId=await insertPerson(client,actor,value);
        if(row.status==='changed'&&row.personId)await updatePerson(client,actor,row.personId,value);
      }
    }
    return {dryRun:parsed.data.dryRun,previewHash:plan.hash,counts:plan.counts,missing:plan.missing,
      rows:plan.rows.map(({value,...row})=>row),note:'Missing rows are reported only. No profiles are deleted or deactivated.'};
  });
}
