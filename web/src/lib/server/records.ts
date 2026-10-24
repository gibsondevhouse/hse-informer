import { error } from '@sveltejs/kit';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { query, transaction } from './db';
import { requireRole, requireSite, type Actor } from './auth';

const manualSchema = z.strictObject({
  personId: z.uuid(), siteId: z.uuid(), courseVersionId: z.uuid(),
  completedAt: z.iso.datetime({ offset: true }),
  sourceReference: z.string().trim().min(1).max(1000), reason: z.string().trim().min(3).max(2000),
  satisfyAssignment: z.boolean(), assignmentId: z.uuid().nullable().optional()
}).superRefine((value, ctx) => {
  if (value.satisfyAssignment !== Boolean(value.assignmentId)) ctx.addIssue({ code: 'custom',
    message: 'Choose an assignment only when explicitly deciding that this record satisfies it', path: ['assignmentId'] });
});
const filterSchema = z.object({
  search: z.string().trim().max(200).optional(), personId: z.uuid().optional(), siteId: z.uuid().optional(),
  courseVersionId: z.uuid().optional(), source: z.enum(['manual','moodle']).optional(),
  state: z.enum(['effective','superseded','voided','all']).default('effective'),
  from: z.iso.date().optional(), through: z.iso.date().optional()
}).refine((value) => !value.from || !value.through || value.from <= value.through,
  { message: 'Completion date range is reversed' });
export type CompletionFilters = z.infer<typeof filterSchema>;
export interface CompletionRecord {
  id: string; personId: string; personName: string; hseId: string | null;
  siteId: string; siteName: string; courseVersionId: string; courseTitle: string; courseVersion: string;
  assignmentId: string | null; completedAt: string; score: number | null; attempts: number | null;
  source: 'manual' | 'moodle'; sourceReference: string | null;
  reason: string | null; recordedBy: string | null; recordedByName: string | null;
  recordedAt: string; state: 'effective' | 'superseded' | 'voided';
  replacementId: string | null; supersedesId: string | null; snapshot: Record<string, unknown>;
}
interface RecordRow {
  id: string; person_id: string; person_name: string; hse_id: string | null;
  site_id: string; site_name: string; course_version_id: string; course_title: string; course_version: string;
  assignment_id: string | null; completed_at: Date; score: string | number | null; attempts: number | null;
  delivery_source: CompletionRecord['source']; source_reference: string | null; reason: string | null;
  recorded_by: string | null; recorded_by_name: string | null; observed_at: Date; state: CompletionRecord['state'];
  replacement_evidence_id: string | null; supersedes_id: string | null; completion_snapshot: Record<string, unknown>;
}

function parseFilters(input: unknown): CompletionFilters {
  const cleaned = input && typeof input === 'object' ? Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== '')) : input;
  const parsed = filterSchema.safeParse(cleaned);
  if (!parsed.success) throw error(400, parsed.error.message);
  return parsed.data;
}
function scope(actor: Actor, params: unknown[]): string {
  if (actor.role === 'tenant_admin' || actor.role === 'auditor' || actor.role === 'hse_reviewer') return '';
  params.push(actor.role === 'learner' ? actor.personId : actor.siteIds);
  return actor.role === 'learner' ? ` AND r.person_id = $${params.length}`
    : ` AND r.site_id = ANY($${params.length}::uuid[])`;
}
const recordsCte = `WITH records AS (
  SELECT k.*, COALESCE(m.person_id, a.person_id) AS person_id,
    COALESCE(m.site_id, a.site_id) AS site_id,
    COALESCE(k.completion_snapshot #>> '{person,displayName}', p.display_name) AS person_name,
    COALESCE(k.completion_snapshot #>> '{person,hseId}', p.hse_id::text) AS hse_id,
    COALESCE(k.completion_snapshot #>> '{site,name}', s.name) AS site_name,
    COALESCE(k.completion_snapshot #>> '{course,title}', cv.title, req.title) AS course_title,
    COALESCE(k.completion_snapshot #>> '{course,version}', cv.content_version, cv.deephow_version, rv.version) AS course_version,
    m.source_reference, m.reason, m.recorded_by,
    COALESCE(k.completion_snapshot #>> '{recordingActor,displayName}', rp.display_name, pr.oidc_subject,
      CASE WHEN k.delivery_source = 'moodle' THEN 'Moodle integration' END) AS recorded_by_name,
    CASE e.kind WHEN 'voided' THEN 'voided' WHEN 'corrected' THEN 'superseded' ELSE 'effective' END AS state,
    e.replacement_evidence_id, prior.evidence_id AS supersedes_id
  FROM knowledge_evidence k
  LEFT JOIN assignments a ON a.tenant_id = k.tenant_id AND a.id = k.assignment_id
  LEFT JOIN manual_completion_details m ON m.tenant_id = k.tenant_id AND m.evidence_id = k.id
  JOIN people p ON p.tenant_id = k.tenant_id AND p.id = COALESCE(m.person_id, a.person_id)
  JOIN sites s ON s.tenant_id = k.tenant_id AND s.id = COALESCE(m.site_id, a.site_id)
  JOIN course_versions cv ON cv.tenant_id = k.tenant_id AND cv.id = k.course_version_id
  JOIN requirement_versions rv ON rv.tenant_id = cv.tenant_id AND rv.id = cv.requirement_version_id
  JOIN requirements req ON req.tenant_id = rv.tenant_id AND req.id = rv.requirement_id
  LEFT JOIN principals pr ON pr.tenant_id = m.tenant_id AND pr.id = m.recorded_by
  LEFT JOIN people rp ON rp.tenant_id = pr.tenant_id AND rp.id = pr.person_id
  LEFT JOIN completion_record_events e ON e.tenant_id = k.tenant_id AND e.evidence_id = k.id
  LEFT JOIN completion_record_events prior ON prior.tenant_id = k.tenant_id AND prior.replacement_evidence_id = k.id
)`;
function record(row: RecordRow): CompletionRecord {
  return { id: row.id, personId: row.person_id, personName: row.person_name, hseId: row.hse_id,
    siteId: row.site_id, siteName: row.site_name, courseVersionId: row.course_version_id,
    courseTitle: row.course_title, courseVersion: row.course_version, assignmentId: row.assignment_id,
    completedAt: row.completed_at.toISOString(), score: row.score === null ? null : Number(row.score),
    attempts: row.attempts, source: row.delivery_source, sourceReference: row.source_reference,
    reason: row.reason, recordedBy: row.recorded_by, recordedByName: row.recorded_by_name,
    recordedAt: row.observed_at.toISOString(), state: row.state, replacementId: row.replacement_evidence_id,
    supersedesId: row.supersedes_id, snapshot: row.completion_snapshot };
}

export async function listCompletions(actor: Actor, input: unknown = {}) {
  const filters = parseFilters(input);
  const params: unknown[] = [actor.tenantId];
  let where = `r.tenant_id = $1${scope(actor, params)}`;
  for (const [key, column] of [['personId','person_id'],['siteId','site_id'],['courseVersionId','course_version_id'],
    ['source','delivery_source']] as const) {
    if (filters[key]) { params.push(filters[key]); where += ` AND r.${column} = $${params.length}`; }
  }
  if (filters.state !== 'all') { params.push(filters.state); where += ` AND r.state = $${params.length}`; }
  if (filters.from) { params.push(filters.from); where += ` AND r.completed_at >= ($${params.length}::date::timestamp AT TIME ZONE 'UTC')`; }
  if (filters.through) { params.push(filters.through); where += ` AND r.completed_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'UTC')`; }
  if (filters.search) {
    params.push(`%${filters.search.replace(/[\\%_]/g, '\\$&')}%`);
    where += ` AND (r.person_name ILIKE $${params.length} OR r.course_title ILIKE $${params.length}
      OR r.course_version ILIKE $${params.length} OR r.source_reference ILIKE $${params.length})`;
  }
  const rows = await query<RecordRow>(`${recordsCte} SELECT r.* FROM records r WHERE ${where}
    ORDER BY r.completed_at DESC, r.id DESC`, params);
  const items = rows.map(record);
  return { items, total: items.length, asOf: new Date().toISOString(),
    scope: actor.role === 'learner' ? 'Own transcript' : actor.role === 'site_admin' || actor.role === 'evaluator'
      ? 'Assigned sites' : actor.tenantName, filters,
    counts: { effective: items.filter((item) => item.state === 'effective').length,
      superseded: items.filter((item) => item.state === 'superseded').length,
      voided: items.filter((item) => item.state === 'voided').length } };
}

export async function completionDetail(actor: Actor, id: string) {
  if (!z.uuid().safeParse(id).success) throw error(400, 'Invalid completion id');
  const all = await listCompletions(actor, { state: 'all' });
  const item = all.items.find((row) => row.id === id);
  if (!item) throw error(404, 'Completion not found');
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of all.items) {
      if (ids.has(row.id) || (row.replacementId && ids.has(row.replacementId)) || (row.supersedesId && ids.has(row.supersedesId))) {
        if (!ids.has(row.id)) { ids.add(row.id); changed = true; }
        for (const related of [row.replacementId, row.supersedesId]) if (related && !ids.has(related)) { ids.add(related); changed = true; }
      }
    }
  }
  const events = await query<{ id: string; evidence_id: string; replacement_evidence_id: string | null;
    kind: string; reason: string; recorded_by: string; recorded_at: Date }>(
    `SELECT id, evidence_id, replacement_evidence_id, kind, reason, recorded_by, recorded_at
     FROM completion_record_events WHERE tenant_id = $1 AND evidence_id = ANY($2::uuid[])
     ORDER BY recorded_at, id`, [actor.tenantId, [...ids]]);
  const assessmentSources = await query<{ id: string; attempts: number | null; source_payload: unknown }>(
    `SELECT id, attempts, source_payload FROM knowledge_evidence WHERE tenant_id = $1
      AND id = ANY($2::uuid[]) AND delivery_source = 'moodle' ORDER BY observed_at, id`,
    [actor.tenantId, all.items.filter((row) => ids.has(row.id)).map((row) => row.id)]);
  return { item, history: all.items.filter((row) => ids.has(row.id)), events: events.map((event) => ({
    id: event.id, evidenceId: event.evidence_id, replacementId: event.replacement_evidence_id,
    kind: event.kind, reason: event.reason, recordedBy: event.recorded_by, recordedAt: event.recorded_at.toISOString() })),
    assessmentSources: assessmentSources.map((source) => ({ recordId: source.id,
      attemptCount: source.attempts, sourcePayload: source.source_payload })) };
}

async function insertManual(client: PoolClient, actor: Actor, input: unknown): Promise<string> {
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const value = parsed.data;
  if (new Date(value.completedAt).valueOf() > Date.now()) throw error(400, 'Completion time cannot be in the future');
  requireSite(actor, value.siteId);
  const subjects = await client.query<{ display_name: string; hse_id: string; site_name: string }>(
    `SELECT p.display_name, p.hse_id, s.name AS site_name FROM people p
     JOIN person_site_memberships m ON m.tenant_id = p.tenant_id AND m.person_id = p.id
     JOIN sites s ON s.tenant_id = m.tenant_id AND s.id = m.site_id
     JOIN tenants t ON t.id = p.tenant_id
     WHERE p.tenant_id = $1 AND p.id = $2 AND s.id = $3
       AND (t.synthetic OR NOT p.synthetic)
     ORDER BY m.effective_at DESC LIMIT 1`, [actor.tenantId, value.personId, value.siteId]);
  if (!subjects.rowCount) throw error(404, 'Person and site membership not found');
  const courses = await client.query<{ title: string; version: string; requirement_id: string; practice_only: boolean }>(
    `SELECT COALESCE(cv.title, r.title) AS title, COALESCE(cv.content_version, cv.deephow_version, rv.version) AS version,
       r.id AS requirement_id, cv.practice_only
     FROM course_versions cv JOIN requirement_versions rv ON rv.tenant_id = cv.tenant_id AND rv.id = cv.requirement_version_id
     JOIN requirements r ON r.tenant_id = rv.tenant_id AND r.id = rv.requirement_id
     WHERE cv.tenant_id = $1 AND cv.id = $2`, [actor.tenantId, value.courseVersionId]);
  if (!courses.rowCount) throw error(404, 'Course version not found');
  if (value.satisfyAssignment) {
    if (courses.rows[0].practice_only) throw error(409, 'Practice content cannot satisfy a training assignment');
    const assignment = await client.query(`SELECT id FROM assignments
      WHERE tenant_id = $1 AND id = $2 AND person_id = $3 AND site_id = $4 AND course_version_id = $5
        AND cancelled_at IS NULL AND closed_at IS NULL FOR UPDATE`,
    [actor.tenantId, value.assignmentId, value.personId, value.siteId, value.courseVersionId]);
    if (!assignment.rowCount) throw error(409, 'Assignment must be open and match the person, site, and exact course version');
  }
  const subject = subjects.rows[0], course = courses.rows[0];
  const snapshot = { person: { id: value.personId, displayName: subject.display_name, hseId: subject.hse_id },
    site: { id: value.siteId, name: subject.site_name },
    course: { id: value.courseVersionId, title: course.title, version: course.version },
    recordingActor: { id: actor.id, displayName: actor.displayName },
    manual: { sourceReference: value.sourceReference, reason: value.reason,
      satisfyAssignment: value.satisfyAssignment, assignmentId: value.assignmentId ?? null },
    boundary: 'Manual training completion; no assessment score or workplace authorization is implied.' };
  const inserted = await client.query<{ id: string }>(`INSERT INTO knowledge_evidence
    (tenant_id, assignment_id, course_version_id, delivery_source, completed_at, delivery_method,
      source_payload, completion_snapshot)
    VALUES ($1,$2,$3,'manual',$4,'manual_record',$5::jsonb,$6::jsonb) RETURNING id`,
  [actor.tenantId, value.assignmentId ?? null, value.courseVersionId, value.completedAt,
    JSON.stringify({ sourceReference: value.sourceReference }), JSON.stringify(snapshot)]);
  const id = inserted.rows[0].id;
  await client.query(`INSERT INTO manual_completion_details
    (tenant_id,evidence_id,person_id,site_id,source_reference,reason,recorded_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [actor.tenantId, id, value.personId, value.siteId,
    value.sourceReference, value.reason, actor.id]);
  await client.query(`INSERT INTO audit_log (tenant_id,actor_principal_id,action,entity_type,entity_id,after_value)
    VALUES ($1,$2,'completion.manual_recorded','knowledge_evidence',$3,$4::jsonb)`,
  [actor.tenantId, actor.id, id, JSON.stringify({ ...value, source: 'manual' })]);
  return id;
}

export async function recordManualCompletion(actor: Actor, input: unknown) {
  requireRole(actor, ['tenant_admin','site_admin']);
  return transaction((client) => insertManual(client, actor, input));
}

export async function amendCompletion(actor: Actor, id: string, input: unknown) {
  requireRole(actor, ['tenant_admin','site_admin']);
  const parsed = z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('voided'), reason: z.string().trim().min(3).max(2000) }),
    z.strictObject({ kind: z.literal('corrected'), reason: z.string().trim().min(3).max(2000), replacement: manualSchema })
  ]).safeParse(input);
  if (!parsed.success) throw error(400, parsed.error.message);
  const original = (await completionDetail(actor, id)).item;
  requireSite(actor, original.siteId);
  const value = parsed.data;
  if (value.kind === 'corrected' && (value.replacement.personId !== original.personId || value.replacement.siteId !== original.siteId)) {
    throw error(400, 'A correction must retain the original person and site; void a record entered for the wrong person or site');
  }
  return transaction(async (client) => {
    await client.query('SELECT id FROM knowledge_evidence WHERE tenant_id = $1 AND id = $2 FOR UPDATE', [actor.tenantId, id]);
    const previous = await client.query('SELECT 1 FROM completion_record_events WHERE tenant_id = $1 AND evidence_id = $2', [actor.tenantId, id]);
    if (previous.rowCount) throw error(409, 'This record was already superseded or voided; open its current replacement');
    const replacementId = value.kind === 'corrected' ? await insertManual(client, actor, value.replacement) : null;
    await client.query(`INSERT INTO completion_record_events
      (tenant_id,evidence_id,replacement_evidence_id,kind,reason,recorded_by) VALUES ($1,$2,$3,$4,$5,$6)`,
    [actor.tenantId, id, replacementId, value.kind, value.reason, actor.id]);
    await client.query(`INSERT INTO audit_log (tenant_id,actor_principal_id,action,entity_type,entity_id,before_value,after_value)
      VALUES ($1,$2,$3,'knowledge_evidence',$4,$5::jsonb,$6::jsonb)`,
    [actor.tenantId, actor.id, `completion.${value.kind}`, id, JSON.stringify(original),
      JSON.stringify({ kind: value.kind, replacementId, reason: value.reason })]);
    return { id, replacementId, state: value.kind === 'corrected' ? 'superseded' : 'voided' };
  });
}

export function completionsCsv(items: CompletionRecord[]): string {
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows: unknown[][] = [['Record ID','Person','HSE ID','Site','Course','Course version','Completed at (UTC)',
    'Score','Source','Source reference','Record state','Assignment ID','Recorded by','Recorded at (UTC)','Record use']];
  for (const item of items) rows.push([item.id,item.personName,item.hseId,item.siteName,item.courseTitle,
    item.courseVersion,item.completedAt,item.score,item.source,item.sourceReference,item.state,
    item.assignmentId,item.recordedByName ?? item.recordedBy,item.recordedAt,'Beta test record']);
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function exportCompletions(actor: Actor, input: unknown) {
  const result = await listCompletions(actor, input);
  await query(`INSERT INTO audit_log (tenant_id,actor_principal_id,action,entity_type,entity_id,after_value)
    VALUES ($1,$2,'completion.exported','completion_export',$2,$3::jsonb)`,
  [actor.tenantId, actor.id, JSON.stringify({ filters: result.filters, count: result.total,
    recordIds: result.items.map((item) => item.id), asOf: result.asOf, scope: result.scope })]);
  return completionsCsv(result.items);
}

export async function completionOptions(actor: Actor) {
  requireRole(actor, ['tenant_admin','site_admin']);
  const rows = await query<{ id: string; title: string; version: string; review_status: string }>(
    `SELECT cv.id, COALESCE(cv.title, r.title) AS title, COALESCE(cv.content_version, cv.deephow_version, rv.version) AS version, cv.review_status
     FROM course_versions cv JOIN requirement_versions rv ON rv.tenant_id = cv.tenant_id AND rv.id = cv.requirement_version_id
     JOIN requirements r ON r.tenant_id = rv.tenant_id AND r.id = rv.requirement_id
     WHERE cv.tenant_id = $1 ORDER BY r.title, cv.created_at DESC`, [actor.tenantId]);
  return rows.map((row) => ({ id: row.id, title: row.title, version: row.version, reviewStatus: row.review_status }));
}
