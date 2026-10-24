import { error, isHttpError } from '@sveltejs/kit';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { applicabilityDecision, nextDueDate, type ApplicabilityRule,
  type PersonContext } from './domain';
import { requireRole, requireSite, type Actor } from './auth';
import { query, transaction } from './db';

const dimensions = {
  siteIds: z.array(z.uuid()).min(1).optional(),
  personTypes: z.array(z.enum(['employee','contractor','temporary'])).min(1).optional(),
  jobs: z.array(z.string().trim().min(1)).min(1).optional(),
  departments: z.array(z.string().trim().min(1)).min(1).optional(),
  roles: z.array(z.string().trim().min(1)).min(1).optional(),
  tasks: z.array(z.string().trim().min(1)).min(1).optional(),
  equipment: z.array(z.string().trim().min(1)).min(1).optional(),
  chemicals: z.array(z.string().trim().min(1)).min(1).optional(),
  exposureGroups: z.array(z.string().trim().min(1)).min(1).optional()
};
const ruleSchema = z.strictObject(dimensions);
const contextSchema = z.strictObject({
  personType: z.enum(['employee','contractor','temporary']).optional(),
  jobTitle: z.string().trim().min(1).optional(),
  department: z.string().trim().min(1).optional(),
  roles: z.array(z.string().trim().min(1)).optional(),
  tasks: z.array(z.string().trim().min(1)).optional(),
  equipment: z.array(z.string().trim().min(1)).optional(),
  chemicals: z.array(z.string().trim().min(1)).optional(),
  exposureGroups: z.array(z.string().trim().min(1)).optional()
});
const contextInput = z.object({
  personId: z.uuid(), siteId: z.uuid(), effectiveAt: z.iso.datetime({ offset: true }),
  sourceReference: z.string().trim().min(3).max(500), context: contextSchema
});
const eventInput = z.object({
  sourceKey: z.string().trim().min(3).max(120), siteId: z.uuid(), requirementId: z.uuid(),
  eventKind: z.string().regex(/^[a-z][a-z0-9_]*$/).max(80),
  scope: ruleSchema.default({}),
  reason: z.string().trim().min(10).max(500),
  sourceReference: z.string().trim().min(3).max(500),
  occurredAt: z.iso.datetime({ offset: true }),
  effectiveAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true })
}).refine((value) => Date.parse(value.dueAt) >= Date.parse(value.effectiveAt),
  { message: 'Due date must be at or after the change becomes effective', path: ['dueAt'] });
const recurrenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('annual') }),
  z.strictObject({ kind: z.literal('three_year') }),
  z.strictObject({ kind: z.literal('event_only') })
]);
const prerequisitesSchema = z.array(z.enum([
  'knowledge','site','practical','medical','fitTest','externalCredential'
]));

interface Configuration {
  version_id: string;
  review_status: string;
  effective_at: Date | null;
  applicability: unknown;
  recurrence: unknown;
  retraining_triggers: unknown;
  authorization_prerequisites: unknown;
  course_version_id: string | null;
  addendum_version_id: string | null;
}

interface ContextRow { id: string; context: unknown; effective_at: Date }
interface EventRow {
  id: string; tenant_id: string; source_key: string; requirement_id: string;
  requirement_version_id: string; site_id: string; event_kind: string; scope: unknown;
  reason: string; source_reference: string; occurred_at: Date; effective_at: Date;
  due_at: Date; recorded_by: string;
}
interface AudienceRow { person_id: string; context_id: string | null; context: unknown | null;
  context_effective_at: Date | null }

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameEvent(prior: EventRow, value: z.infer<typeof eventInput>, versionId: string): boolean {
  return prior.requirement_id === value.requirementId && prior.site_id === value.siteId
    && prior.requirement_version_id === versionId && prior.event_kind === value.eventKind
    && canonicalJson(prior.scope) === canonicalJson(value.scope)
    && prior.reason === value.reason && prior.source_reference === value.sourceReference
    && prior.occurred_at.toISOString() === new Date(value.occurredAt).toISOString()
    && prior.effective_at.toISOString() === new Date(value.effectiveAt).toISOString()
    && prior.due_at.toISOString() === new Date(value.dueAt).toISOString();
}

export interface ReassignmentResult { required: number; notRequired: number; needsReview: number; skipped: number }
const emptyResult = (): ReassignmentResult => ({ required: 0, notRequired: 0, needsReview: 0, skipped: 0 });

/** Context is reviewed and append-only; missing dimensions never match by default. */
export async function recordTrainingContext(actor: Actor, input: unknown): Promise<string> {
  requireRole(actor, ['hse_reviewer']);
  const parsed = contextInput.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  requireSite(actor, value.siteId);
  return transaction(async (client) => {
    const member = await client.query(`SELECT 1 FROM people p WHERE p.tenant_id = $1 AND p.id = $2
      AND p.active AND ($5::boolean OR NOT p.synthetic)
      AND EXISTS (SELECT 1 FROM person_site_memberships m
        WHERE m.tenant_id = p.tenant_id AND m.person_id = p.id AND m.site_id = $3
          AND m.effective_at <= $4 AND (m.ended_at IS NULL OR m.ended_at > $4))`,
    [actor.tenantId, value.personId, value.siteId, value.effectiveAt,
      actor.tenantSynthetic]);
    if (!member.rowCount) throw error(409, 'Person must have an active membership at the context effective time');
    const row = await client.query<{ id: string }>(`INSERT INTO person_training_context_versions
      (tenant_id, person_id, site_id, context, effective_at, source_reference, reviewed_by)
      VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id`,
    [actor.tenantId, value.personId, value.siteId, JSON.stringify(value.context),
      value.effectiveAt, value.sourceReference, actor.id]);
    await client.query(`INSERT INTO audit_log
      (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'training_context.reviewed','training_context',$3,$4::jsonb)`,
    [actor.tenantId, actor.id, row.rows[0].id, JSON.stringify({ personId: value.personId,
      siteId: value.siteId, effectiveAt: value.effectiveAt, sourceReference: value.sourceReference })]);
    return row.rows[0].id;
  });
}

async function configuration(client: PoolClient, tenantId: string, siteId: string,
  requirementId: string, at: Date): Promise<Configuration> {
  const rows = await client.query<Configuration>(`SELECT rv.id AS version_id, rv.review_status,
    rv.effective_at, rv.applicability, rv.recurrence, rv.retraining_triggers,
    rv.authorization_prerequisites,
    (SELECT cv.id FROM course_versions cv WHERE cv.tenant_id = r.tenant_id
      AND cv.requirement_version_id = rv.id AND cv.review_status = 'approved'
      AND cv.moodle_course_id IS NOT NULL AND cv.completion_criteria_verified
      AND (cv.effective_at IS NULL OR cv.effective_at <= $4)
      AND (cv.retired_at IS NULL OR cv.retired_at > $4)
      ORDER BY cv.effective_at DESC NULLS LAST, cv.created_at DESC, cv.id DESC LIMIT 1)
      AS course_version_id,
    (SELECT sav.id FROM site_addendum_versions sav WHERE sav.tenant_id = r.tenant_id
      AND sav.requirement_id = r.id AND sav.site_id = $2 AND sav.review_status = 'approved'
      AND (sav.effective_at IS NULL OR sav.effective_at <= $4)
      ORDER BY sav.effective_at DESC NULLS LAST, sav.created_at DESC, sav.id DESC LIMIT 1)
      AS addendum_version_id
    FROM requirements r JOIN requirement_versions rv
      ON rv.tenant_id = r.tenant_id AND rv.id = r.active_version_id
    WHERE r.tenant_id = $1 AND r.id = $3`, [tenantId, siteId, requirementId, at]);
  const row = rows.rows[0];
  if (!row || row.review_status !== 'approved' || (row.effective_at && row.effective_at > at)) {
    throw error(409, 'An effective HSE-approved requirement version is required');
  }
  if (!row.course_version_id) throw error(409, 'An approved, completion-verified Moodle course mapping is required');
  const prerequisites = prerequisitesSchema.safeParse(row.authorization_prerequisites);
  if (!prerequisites.success || prerequisites.data.length === 0) {
    throw error(409, 'Authorization prerequisites need a reviewed, supported definition');
  }
  if (prerequisites.data.includes('site') && !row.addendum_version_id) {
    throw error(409, 'An effective approved site addendum is required');
  }
  return row;
}

export async function recordChangeEvent(actor: Actor, input: unknown): Promise<string> {
  requireRole(actor, ['hse_reviewer']);
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  requireSite(actor, value.siteId);
  return transaction(async (client) => {
    const site = await client.query('SELECT 1 FROM sites WHERE tenant_id = $1 AND id = $2',
      [actor.tenantId, value.siteId]);
    if (!site.rowCount) throw error(404, 'Site not found');
    const config = await configuration(client, actor.tenantId, value.siteId,
      value.requirementId, new Date(value.effectiveAt));
    const triggers = z.array(z.string()).safeParse(config.retraining_triggers);
    if (!triggers.success || !triggers.data.includes(value.eventKind)) {
      throw error(409, 'Event type is not in the approved retraining triggers');
    }
    const existing = await client.query<EventRow>(`SELECT * FROM training_change_events
      WHERE tenant_id = $1 AND source_key = $2 FOR UPDATE`, [actor.tenantId, value.sourceKey]);
    if (existing.rowCount) {
      const prior = existing.rows[0];
      if (!sameEvent(prior, value, config.version_id)) {
        throw error(409, 'Source key is already bound to a different change event');
      }
      return prior.id;
    }
    const event = await client.query<{ id: string }>(`INSERT INTO training_change_events
      (tenant_id, source_key, requirement_id, requirement_version_id, site_id,
       event_kind, scope, reason, source_reference, occurred_at, effective_at, due_at, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (tenant_id, source_key) DO NOTHING RETURNING id`,
    [actor.tenantId, value.sourceKey, value.requirementId, config.version_id, value.siteId,
      value.eventKind, JSON.stringify(value.scope), value.reason, value.sourceReference,
      value.occurredAt, value.effectiveAt, value.dueAt, actor.id]);
    if (!event.rowCount) {
      const raced = await client.query<EventRow>(`SELECT * FROM training_change_events
        WHERE tenant_id = $1 AND source_key = $2 FOR UPDATE`, [actor.tenantId, value.sourceKey]);
      if (!raced.rowCount || !sameEvent(raced.rows[0], value, config.version_id)) {
        throw error(409, 'Source key is already bound to a different change event');
      }
      return raced.rows[0].id;
    }
    await client.query(`INSERT INTO audit_log
      (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'training_event.recorded','training_event',$3,$4::jsonb)`,
    [actor.tenantId, actor.id, event.rows[0].id,
      JSON.stringify({ sourceKey: value.sourceKey, siteId: value.siteId,
        requirementVersionId: config.version_id, eventKind: value.eventKind })]);
    return event.rows[0].id;
  });
}

async function audience(client: PoolClient, tenantId: string, siteId: string,
  at: Date): Promise<AudienceRow[]> {
  const rows = await client.query<AudienceRow>(`SELECT p.id AS person_id,
    ctx.id AS context_id, ctx.context, ctx.effective_at AS context_effective_at
    FROM people p JOIN tenants t ON t.id = p.tenant_id
    LEFT JOIN LATERAL (SELECT c.id, c.context, c.effective_at
      FROM person_training_context_versions c
      WHERE c.tenant_id = p.tenant_id AND c.person_id = p.id
        AND c.site_id = $2 AND c.effective_at <= $3
      ORDER BY c.effective_at DESC, c.recorded_at DESC, c.id DESC LIMIT 1) ctx ON true
    WHERE p.tenant_id = $1 AND p.active AND (t.synthetic OR NOT p.synthetic) AND EXISTS (
      SELECT 1 FROM person_site_memberships m WHERE m.tenant_id = p.tenant_id
        AND m.person_id = p.id AND m.site_id = $2 AND m.effective_at <= $3
        AND (m.ended_at IS NULL OR m.ended_at > $3))
    ORDER BY p.id`, [tenantId, siteId, at]);
  return rows.rows;
}

function evaluate(ruleValue: unknown, scopeValue: unknown, siteId: string,
  contextValue: unknown): { decision: 'required' | 'not_required' | 'needs_review'; reason: string;
  context: PersonContext | null } {
  const rule = ruleSchema.safeParse(ruleValue);
  const scope = ruleSchema.safeParse(scopeValue);
  const context = contextSchema.safeParse(contextValue);
  if (!rule.success || !Object.keys(rule.data).length) {
    return { decision: 'needs_review', reason: 'Unrecognized or empty approved applicability rule', context: null };
  }
  if (!scope.success) return { decision: 'needs_review', reason: 'Unrecognized event scope', context: null };
  if (!context.success) return { decision: 'needs_review', reason: 'Missing or invalid reviewed person context', context: null };
  const actual: PersonContext = { siteId, ...context.data };
  const requirementDecision = applicabilityDecision(rule.data as ApplicabilityRule, actual);
  const scopeDecision = Object.keys(scope.data).length
    ? applicabilityDecision(scope.data as ApplicabilityRule, actual) : 'applies';
  if (requirementDecision === 'does_not_apply' || scopeDecision === 'does_not_apply') {
    return { decision: 'not_required', reason: 'Reviewed context falls outside the approved scope', context: actual };
  }
  if (requirementDecision === 'needs_review' || scopeDecision === 'needs_review') {
    return { decision: 'needs_review', reason: 'A required applicability input is missing', context: actual };
  }
  return { decision: 'required', reason: 'Reviewed context matches the approved scope', context: actual };
}

interface DecisionInput {
  tenantId: string; personId: string; siteId: string; requirementId: string;
  config: Configuration; contextRow: AudienceRow; scope: unknown; triggerKind: 'event' | 'recurrence';
  triggerId: string; reason: string; dueAt: Date; eventId?: string; sourceAssignmentId?: string;
  actorPrincipalId: string | null; effectiveAt: Date; completionEvidenceId?: string | null;
  blockingDrift?: boolean;
}

async function decide(client: PoolClient, input: DecisionInput): Promise<keyof ReassignmentResult> {
  const key = `${input.tenantId}:${input.personId}:${input.siteId}:${input.requirementId}`;
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
  const basisKey = `${input.contextRow.context_id ?? 'missing'}:${input.blockingDrift ? 'drift' : 'clear'}`;
  const priorDecision = await client.query<{ decision: string }>(`SELECT decision FROM reassignment_decisions
    WHERE tenant_id = $1 AND person_id = $2 AND requirement_version_id = $3
      AND trigger_kind = $4 AND trigger_id = $5 AND basis_key = $6`,
  [input.tenantId, input.personId, input.config.version_id, input.triggerKind,
    input.triggerId, basisKey]);
  if (priorDecision.rowCount) return 'skipped';
  const alreadyRequired = await client.query(`SELECT 1 FROM reassignment_decisions
    WHERE tenant_id = $1 AND person_id = $2 AND requirement_version_id = $3
      AND trigger_kind = $4 AND trigger_id = $5 AND decision = 'required'`,
  [input.tenantId, input.personId, input.config.version_id, input.triggerKind, input.triggerId]);
  if (alreadyRequired.rowCount) return 'skipped';

  const evaluated = evaluate(input.config.applicability, input.scope,
    input.siteId, input.contextRow.context);
  const result = input.blockingDrift && evaluated.decision === 'required'
    ? { decision: 'needs_review' as const, reason: 'Completion reconciliation drift blocks recurrence',
      context: evaluated.context } : evaluated;
  let assignmentId: string | null = null;
  let supersedes: string | null = null;
  if (result.decision === 'required') {
    const prior = await client.query<{ id: string }>(`SELECT id FROM assignments
      WHERE tenant_id = $1 AND person_id = $2 AND site_id = $3 AND requirement_id = $4
        AND closed_at IS NULL AND cancelled_at IS NULL
      ORDER BY assigned_at DESC, id DESC LIMIT 1 FOR UPDATE`,
    [input.tenantId, input.personId, input.siteId, input.requirementId]);
    supersedes = prior.rows[0]?.id ?? input.sourceAssignmentId ?? null;
    if (prior.rowCount) {
      await client.query(`UPDATE assignments SET cancelled_at = now()
        WHERE tenant_id = $1 AND id = $2`, [input.tenantId, supersedes]);
    }
    const inserted = await client.query<{ id: string }>(`INSERT INTO assignments
      (tenant_id, person_id, site_id, requirement_id, requirement_version_id,
       course_version_id, site_addendum_version_id, reason, trigger_kind, trigger_ref,
       due_at, created_by, supersedes_assignment_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [input.tenantId, input.personId, input.siteId, input.requirementId,
      input.config.version_id, input.config.course_version_id, input.config.addendum_version_id,
      input.reason, input.triggerKind, input.triggerId, input.dueAt,
      input.actorPrincipalId, supersedes]);
    assignmentId = inserted.rows[0].id;
    await client.query(`INSERT INTO integration_outbox (tenant_id, kind, aggregate_id)
      VALUES ($1,'moodle_enrol',$2)`, [input.tenantId, assignmentId]);
    if (supersedes) {
      await client.query(`INSERT INTO audit_log
        (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
        VALUES ($1,$2,'assignment.superseded','assignment',$3,$4::jsonb)`,
      [input.tenantId, input.actorPrincipalId, supersedes,
        JSON.stringify({ replacementAssignmentId: assignmentId, triggerId: input.triggerId })]);
    }
    await client.query(`INSERT INTO audit_log
      (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
      VALUES ($1,$2,'assignment.created_by_reassignment','assignment',$3,$4::jsonb)`,
    [input.tenantId, input.actorPrincipalId, assignmentId,
      JSON.stringify({ triggerKind: input.triggerKind, triggerId: input.triggerId,
        supersedesAssignmentId: supersedes, dueAt: input.dueAt.toISOString() })]);
  }
  const snapshot = { contextVersionId: input.contextRow.context_id,
    contextEffectiveAt: input.contextRow.context_effective_at?.toISOString() ?? null,
    context: result.context, applicability: input.config.applicability, scope: input.scope,
    requirementVersionId: input.config.version_id, courseVersionId: input.config.course_version_id,
    siteAddendumVersionId: input.config.addendum_version_id,
    effectiveAt: input.effectiveAt.toISOString(), dueAt: input.dueAt.toISOString(),
    completionEvidenceId: input.completionEvidenceId ?? null,
    sourceAssignmentId: input.sourceAssignmentId ?? null };
  const decision = await client.query<{ id: string }>(`INSERT INTO reassignment_decisions
    (tenant_id, person_id, site_id, requirement_id, requirement_version_id,
     context_version_id, event_id, source_assignment_id, assignment_id,
     trigger_kind, trigger_id, basis_key, decision, reason, input_snapshot)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb) RETURNING id`,
  [input.tenantId, input.personId, input.siteId, input.requirementId,
    input.config.version_id, input.contextRow.context_id, input.eventId ?? null,
    input.sourceAssignmentId ?? null, assignmentId, input.triggerKind,
    input.triggerId, basisKey, result.decision, result.reason, JSON.stringify(snapshot)]);
  await client.query(`INSERT INTO audit_log
    (tenant_id, actor_principal_id, action, entity_type, entity_id, after_value)
    VALUES ($1,$2,'applicability.decided','reassignment_decision',$3,$4::jsonb)`,
  [input.tenantId, input.actorPrincipalId, decision.rows[0].id,
    JSON.stringify({ decision: result.decision, personId: input.personId,
      triggerId: input.triggerId, assignmentId })]);
  return result.decision === 'required' ? 'required'
    : result.decision === 'not_required' ? 'notRequired' : 'needsReview';
}

/** Process an HSE-reviewed change for the affected active site audience. */
export async function processChangeEvent(actor: Actor, eventId: string,
  asOf = new Date()): Promise<ReassignmentResult> {
  requireRole(actor, ['hse_reviewer']);
  if (!z.uuid().safeParse(eventId).success) throw error(400, 'Invalid event ID');
  return transaction(async (client) => {
    const events = await client.query<EventRow>(`SELECT * FROM training_change_events
      WHERE tenant_id = $1 AND id = $2 FOR UPDATE`, [actor.tenantId, eventId]);
    if (!events.rowCount) throw error(404, 'Change event not found');
    const event = events.rows[0];
    requireSite(actor, event.site_id);
    if (event.effective_at > asOf) throw error(409, 'Change event is not effective yet');
    const config = await configuration(client, actor.tenantId, event.site_id,
      event.requirement_id, asOf);
    if (config.version_id !== event.requirement_version_id) {
      throw error(409, 'Active requirement version changed; review and record a new event');
    }
    const triggers = z.array(z.string()).safeParse(config.retraining_triggers);
    if (!triggers.success || !triggers.data.includes(event.event_kind)) {
      throw error(409, 'Event type is no longer an approved retraining trigger');
    }
    const result = emptyResult();
    for (const person of await audience(client, actor.tenantId, event.site_id, asOf)) {
      const outcome = await decide(client, {
        tenantId: actor.tenantId, personId: person.person_id, siteId: event.site_id,
        requirementId: event.requirement_id, config, contextRow: person, scope: event.scope,
        triggerKind: 'event', triggerId: `event:${event.id}`,
        reason: event.reason, dueAt: event.due_at, eventId: event.id,
        actorPrincipalId: actor.id, effectiveAt: event.effective_at
      });
      result[outcome]++;
    }
    await client.query(`INSERT INTO training_change_event_runs
      (tenant_id, event_id, processed_at, result)
      VALUES ($1,$2,$3,$4::jsonb)
      ON CONFLICT (tenant_id, event_id) DO UPDATE SET
        processed_at = EXCLUDED.processed_at, result = EXCLUDED.result`,
    [actor.tenantId, event.id, asOf, JSON.stringify(result)]);
    await client.query(`UPDATE training_change_event_failures SET resolved_at = now()
      WHERE tenant_id = $1 AND event_id = $2 AND resolved_at IS NULL`,
    [actor.tenantId, event.id]);
    return result;
  });
}

/** Pick due, unprocessed events. Each event and all its decisions commit atomically. */
export async function processDueChangeEvents(tenantId: string, asOf = new Date(),
  limit = 100): Promise<{ events: number; failures: number; decisions: ReassignmentResult }> {
  if (!z.uuid().safeParse(tenantId).success || !Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw error(400, 'Invalid event scope or batch size');
  }
  const tenant = await query<{ synthetic: boolean }>('SELECT synthetic FROM tenants WHERE id = $1', [tenantId]);
  if (!tenant.length) throw error(404, 'Tenant not found');
  if (!tenant[0].synthetic && asOf > new Date()) throw error(400, 'Future production processing is forbidden');
  const combined = emptyResult();
  let events = 0;
  let failures = 0;
  let cursorAt: Date | null = null;
  let cursorId: string | null = null;
  while (events < limit) {
    const rows: Array<{ id: string; effective_at: Date; recorded_by: string; tenant_name: string;
      synthetic: boolean; reviewer_name: string; reviewer_active: boolean; reviewer_role: string }> =
      await query(`SELECT e.id, e.effective_at, e.recorded_by, t.name AS tenant_name, t.synthetic,
      p.oidc_subject AS reviewer_name, p.active AS reviewer_active, p.role AS reviewer_role
     FROM training_change_events e JOIN tenants t ON t.id = e.tenant_id
     JOIN principals p ON p.tenant_id = e.tenant_id AND p.id = e.recorded_by
     WHERE e.tenant_id = $1 AND e.effective_at <= $2
       AND ($4::timestamptz IS NULL OR (e.effective_at, e.id) > ($4::timestamptz, $5::uuid))
       AND NOT EXISTS (SELECT 1 FROM training_change_event_runs run
         WHERE run.tenant_id = e.tenant_id AND run.event_id = e.id)
     ORDER BY e.effective_at, e.id LIMIT $3`, [tenantId, asOf, 250, cursorAt, cursorId]);
    if (!rows.length) break;
    for (const row of rows) {
      cursorAt = row.effective_at;
      cursorId = row.id;
      try {
        if (!row.reviewer_active || row.reviewer_role !== 'hse_reviewer') {
          throw error(409, 'Event reviewer is no longer an active HSE reviewer');
        }
        const actor: Actor = { id: row.recorded_by, tenantId, tenantName: row.tenant_name,
          tenantSynthetic: row.synthetic, personId: null, displayName: row.reviewer_name,
          role: 'hse_reviewer', siteIds: [] };
        const result = await processChangeEvent(actor, row.id, asOf);
        for (const key of Object.keys(combined) as Array<keyof ReassignmentResult>) {
          combined[key] += result[key];
        }
        events++;
      } catch (cause) {
        if (!isHttpError(cause) || cause.status !== 409) throw cause;
        failures++;
        await query(`INSERT INTO training_change_event_failures
          (tenant_id, event_id, error_message)
          VALUES ($1,$2,$3)
          ON CONFLICT (tenant_id, event_id) DO UPDATE SET
            error_message = EXCLUDED.error_message, last_seen_at = now(),
            attempt_count = training_change_event_failures.attempt_count + 1,
            resolved_at = NULL`, [tenantId, row.id, cause.body.message]);
      }
      if (events >= limit) break;
    }
    if (rows.length < 250) break;
  }
  return { events, failures, decisions: combined };
}

interface RecurrenceSource {
  id: string; tenant_id: string; person_id: string; site_id: string; requirement_id: string;
  course_version_id: string | null; completed_at: Date | null; completion_evidence_id: string | null;
  blocking_drift: boolean;
}

/** Called by an internal scheduler for each tenant; never manufactures completion evidence. */
export async function processDueRecurrences(tenantId: string, asOf = new Date(),
  limit = 100, leadDays = 30): Promise<ReassignmentResult> {
  if (!z.uuid().safeParse(tenantId).success || !Number.isInteger(limit) || limit < 1 || limit > 500
    || !Number.isInteger(leadDays) || leadDays < 0 || leadDays > 90
    || !Number.isFinite(asOf.getTime())) {
    throw error(400, 'Invalid recurrence scope, lead window, or batch size');
  }
  const tenant = await query<{ synthetic: boolean }>('SELECT synthetic FROM tenants WHERE id = $1', [tenantId]);
  if (!tenant.length) throw error(404, 'Tenant not found');
  if (!tenant[0].synthetic && asOf > new Date()) throw error(400, 'Future production processing is forbidden');
  const lookAhead = new Date(asOf.getTime() + leadDays * 24 * 60 * 60 * 1000);
  const result = emptyResult();
  let actionable = 0;
  let cursorAt: Date | null = null;
  let cursorId: string | null = null;
  // Keyset pagination continues past future and already-decided records. A
  // fixed LIMIT before checking their due dates can starve later due records.
  while (actionable < limit) {
    const candidates: Array<{ id: string; assigned_at: Date }> = await query<{ id: string; assigned_at: Date }>(`SELECT a.id, a.assigned_at
      FROM assignments a JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
      JOIN tenants t ON t.id = a.tenant_id
      WHERE a.tenant_id = $1 AND a.cancelled_at IS NULL AND p.active
        AND (t.synthetic OR NOT p.synthetic)
        AND a.course_version_id IS NOT NULL
        AND ($3::timestamptz IS NULL OR (a.assigned_at, a.id) > ($3::timestamptz, $4::uuid))
        AND NOT EXISTS (SELECT 1 FROM assignments successor
          WHERE successor.tenant_id = a.tenant_id AND successor.supersedes_assignment_id = a.id)
        AND EXISTS (SELECT 1 FROM effective_knowledge_evidence ke
          WHERE ke.tenant_id = a.tenant_id AND ke.assignment_id = a.id
            AND ke.course_version_id = a.course_version_id AND ke.completed_at <= $2)
      ORDER BY a.assigned_at, a.id LIMIT 250`, [tenantId, asOf, cursorAt, cursorId]);
    if (!candidates.length) break;
    for (const candidate of candidates) {
      cursorAt = candidate.assigned_at;
      cursorId = candidate.id;
      let outcome: keyof ReassignmentResult | null;
      try { outcome = await transaction(async (client): Promise<keyof ReassignmentResult | null> => {
      const row = await client.query<RecurrenceSource>(`SELECT a.id, a.tenant_id, a.person_id,
        a.site_id, a.requirement_id, a.course_version_id,
        ke.completed_at AS completed_at, ke.id AS completion_evidence_id,
        EXISTS (SELECT 1 FROM integration_drifts d
          WHERE d.tenant_id = a.tenant_id AND d.assignment_id = a.id
            AND d.resolved_at IS NULL AND d.kind LIKE 'completion_%') AS blocking_drift
        FROM assignments a JOIN people p ON p.tenant_id = a.tenant_id AND p.id = a.person_id
        JOIN tenants t ON t.id = a.tenant_id
        LEFT JOIN LATERAL (SELECT id, completed_at FROM effective_knowledge_evidence ke
          WHERE ke.tenant_id = a.tenant_id AND ke.assignment_id = a.id
            AND ke.course_version_id = a.course_version_id AND ke.completed_at <= $3
          ORDER BY completed_at DESC, observed_at DESC, id DESC LIMIT 1) ke ON true
        WHERE a.tenant_id = $1 AND a.id = $2 AND a.cancelled_at IS NULL
          AND p.active AND (t.synthetic OR NOT p.synthetic)
          AND NOT EXISTS (SELECT 1 FROM assignments successor
            WHERE successor.tenant_id = a.tenant_id AND successor.supersedes_assignment_id = a.id)
        FOR UPDATE OF a`, [tenantId, candidate.id, asOf]);
      const source = row.rows[0];
      if (!source?.completed_at || !source.course_version_id) return null;
      const config = await configuration(client, tenantId, source.site_id,
        source.requirement_id, asOf);
      const parsedRecurrence = recurrenceSchema.safeParse(config.recurrence);
      if (!parsedRecurrence.success) throw error(409, 'Approved recurrence rule is unrecognized');
      await client.query(`UPDATE integration_drifts SET resolved_at = now()
        WHERE tenant_id = $1 AND assignment_id = $2
          AND kind = 'reassignment_configuration_blocked' AND resolved_at IS NULL`,
      [tenantId, source.id]);
      const dueAt = nextDueDate(source.completed_at, parsedRecurrence.data);
      if (!dueAt || dueAt > lookAhead) return null;
      const people = await audience(client, tenantId, source.site_id, asOf);
      const person = people.find((item) => item.person_id === source.person_id)
        ?? { person_id: source.person_id, context_id: null, context: null,
          context_effective_at: null };
      const triggerId = `recurrence:${source.id}:${dueAt.toISOString()}`;
      return decide(client, { tenantId, personId: source.person_id,
        siteId: source.site_id, requirementId: source.requirement_id,
        config, contextRow: person, scope: {}, triggerKind: 'recurrence', triggerId,
        reason: `Approved ${parsedRecurrence.data.kind} reassignment after verified completion`,
        dueAt, sourceAssignmentId: source.id, actorPrincipalId: null,
        effectiveAt: asOf, completionEvidenceId: source.completion_evidence_id,
        blockingDrift: source.blocking_drift });
      }); } catch (cause) {
        if (!isHttpError(cause) || cause.status !== 409) throw cause;
        const blocked = await query<{ id: string }>(`INSERT INTO integration_drifts
          (tenant_id, assignment_id, kind, details)
          VALUES ($1,$2,'reassignment_configuration_blocked',$3::jsonb)
          ON CONFLICT (tenant_id, assignment_id, kind) WHERE resolved_at IS NULL
          DO NOTHING RETURNING id`,
        [tenantId, candidate.id, JSON.stringify({ error: cause.body.message,
          asOf: asOf.toISOString() })]);
        outcome = blocked.length ? 'needsReview' : 'skipped';
      }
      if (outcome) {
        result[outcome]++;
        if (outcome !== 'skipped') actionable++;
      }
      if (actionable >= limit) break;
    }
    if (candidates.length < 250) break;
  }
  return result;
}
