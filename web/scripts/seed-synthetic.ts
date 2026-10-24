import { createHash } from 'node:crypto';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production') throw new Error('Synthetic seed is forbidden in production');
const pool = new Pool({ connectionString: url });
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const requirements = [
  { code: 'respiratory-protection', title: 'Respiratory Protection', legal: 'federal_regulatory',
    applicability: { roles: ['required_respirator_user'] }, recurrence: { kind: 'annual' },
    triggers: ['respirator_change','procedure_change','observed_deficiency'], prerequisites: ['knowledge','site','practical','medical','fitTest'] },
  { code: 'lockout-tagout', title: 'Lockout/Tagout', legal: 'federal_regulatory',
    applicability: { roles: ['authorized_loto_employee'] }, recurrence: { kind: 'event_only' },
    triggers: ['duty_change','machine_change','procedure_change','observed_deficiency'], prerequisites: ['knowledge','site','practical'] },
  { code: 'confined-space', title: 'Confined Space', legal: 'federal_regulatory',
    applicability: { roles: ['confined_space_entrant'] }, recurrence: { kind: 'event_only' },
    triggers: ['duty_change','hazard_change','procedure_change','observed_deficiency'], prerequisites: ['knowledge','site','practical'] },
  { code: 'chemical-hygiene', title: 'Chemical Hygiene', legal: 'employer_program',
    applicability: { roles: ['laboratory_worker'] }, recurrence: { kind: 'event_only' },
    triggers: ['chemical_change','procedure_change','duty_change'], prerequisites: ['knowledge','site'] },
  { code: 'hazard-communication', title: 'Hazard Communication', legal: 'federal_regulatory',
    applicability: { exposureGroups: ['chemical_exposure'] }, recurrence: { kind: 'event_only' },
    triggers: ['new_chemical_hazard','procedure_change','duty_change'], prerequisites: ['knowledge','site'] }
] as const;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenantRows = await client.query<{ id: string }>(`INSERT INTO tenants (slug, name, synthetic)
      VALUES ('synthetic-company-a','Synthetic Company A — demonstration only',true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    const tenantId = tenantRows.rows[0].id;
    const otherRows = await client.query<{ id: string }>(`INSERT INTO tenants (slug, name, synthetic)
      VALUES ('synthetic-company-b','Synthetic Company B — isolation test only',true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`);
    const otherId = otherRows.rows[0].id;
    const siteIds: Record<string, string> = {};
    for (const name of ['Tifton','Ocilla','Vernon']) {
      const row = await client.query<{ id: string }>(`INSERT INTO sites (tenant_id, code, name, state_code, time_zone)
        VALUES ($1,$2,$3,'GA','America/New_York')
        ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name,
          time_zone = EXCLUDED.time_zone RETURNING id`,
        [tenantId, name.toLowerCase(), name]);
      siteIds[name] = row.rows[0].id;
    }
    const otherSite = await client.query<{ id: string }>(`INSERT INTO sites (tenant_id, code, name, state_code, time_zone)
      VALUES ($1,'isolation','Isolation Test Site','GA','America/New_York')
      ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name,
        time_zone = EXCLUDED.time_zone RETURNING id`, [otherId]);
    const adminPerson = await client.query<{ id: string }>(`INSERT INTO people (tenant_id, display_name, email, person_type, synthetic)
      SELECT $1,'Synthetic Admin','synthetic-admin@example.invalid','employee',true
      WHERE NOT EXISTS (SELECT 1 FROM people WHERE tenant_id = $1 AND email = 'synthetic-admin@example.invalid') RETURNING id`, [tenantId]);
    const adminId = adminPerson.rows[0]?.id ?? (await client.query<{ id: string }>(
      `SELECT id FROM people WHERE tenant_id = $1 AND email = 'synthetic-admin@example.invalid'`, [tenantId])).rows[0].id;
    await client.query(`INSERT INTO principals (tenant_id, oidc_issuer, oidc_subject, person_id, role)
      VALUES ($1,'synthetic-dev','synthetic-dev-admin',$2,'tenant_admin')
      ON CONFLICT (tenant_id, oidc_issuer, oidc_subject) DO NOTHING`, [tenantId, adminId]);
    const devIssuer = 'https://auth.localhost:8443/realms/hse-dev';
    const adminSubject = '33333333-3333-4333-8333-333333333333';
    await client.query(`INSERT INTO principals (tenant_id, oidc_issuer, oidc_subject, person_id, role)
      VALUES ($1,$2,$3,$4,'tenant_admin')
      ON CONFLICT (tenant_id, oidc_issuer, oidc_subject) DO NOTHING`,
      [tenantId, devIssuer, adminSubject, adminId]);
    await client.query(`INSERT INTO person_external_ids (tenant_id, person_id, source, external_id)
      VALUES ($1,$2,'oidc',$3) ON CONFLICT DO NOTHING`, [tenantId, adminId, `${devIssuer}|${adminSubject}`]);
    for (const [index, name] of ['Avery Example','Jordan Example','Morgan Example','Taylor Example','Casey Example','Riley Example'].entries()) {
      const email = `learner-${index + 1}@example.invalid`;
      const person = await client.query<{ id: string }>(`INSERT INTO people
        (tenant_id, display_name, email, person_type, job_title, department, synthetic)
        SELECT $1,$2,$3,'employee',$4,'Operations',true
        WHERE NOT EXISTS (SELECT 1 FROM people WHERE tenant_id = $1 AND email = $3) RETURNING id`,
        [tenantId, name, email, index % 2 ? 'Technician' : 'Operator']);
      const personId = person.rows[0]?.id ?? (await client.query<{ id: string }>(
        'SELECT id FROM people WHERE tenant_id = $1 AND email = $2', [tenantId, email])).rows[0].id;
      const siteId = siteIds[['Tifton','Ocilla','Vernon'][index % 3]];
      await client.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id)
        SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM person_site_memberships
          WHERE tenant_id = $1 AND person_id = $2 AND site_id = $3 AND ended_at IS NULL)`, [tenantId, personId, siteId]);
      if (index === 0) {
        const issuer = 'https://auth.localhost:8443/realms/hse-dev';
        const subject = '11111111-1111-4111-8111-111111111111';
        await client.query(`INSERT INTO principals (tenant_id, oidc_issuer, oidc_subject, person_id, role)
          VALUES ($1,$2,$3,$4,'learner') ON CONFLICT (tenant_id, oidc_issuer, oidc_subject) DO NOTHING`,
          [tenantId, issuer, subject, personId]);
        await client.query(`INSERT INTO person_external_ids (tenant_id, person_id, source, external_id)
          VALUES ($1,$2,'oidc',$3) ON CONFLICT DO NOTHING`, [tenantId, personId, `${issuer}|${subject}`]);
      }
    }
    const otherPerson = await client.query<{ id: string }>(`INSERT INTO people
      (tenant_id, display_name, email, person_type, synthetic)
      SELECT $1,'Sam Isolation','learner-b@example.invalid','employee',true
      WHERE NOT EXISTS (SELECT 1 FROM people WHERE tenant_id = $1 AND email = 'learner-b@example.invalid') RETURNING id`, [otherId]);
    const otherPersonId = otherPerson.rows[0]?.id ?? (await client.query<{ id: string }>(
      `SELECT id FROM people WHERE tenant_id = $1 AND email = 'learner-b@example.invalid'`, [otherId])).rows[0].id;
    await client.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id)
      SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM person_site_memberships
        WHERE tenant_id = $1 AND person_id = $2 AND site_id = $3 AND ended_at IS NULL)`,
      [otherId, otherPersonId, otherSite.rows[0].id]);
    const otherIssuer = 'https://auth.localhost:8443/realms/hse-dev';
    const otherSubject = '22222222-2222-4222-8222-222222222222';
    await client.query(`INSERT INTO principals (tenant_id, oidc_issuer, oidc_subject, person_id, role)
      VALUES ($1,$2,$3,$4,'learner') ON CONFLICT (tenant_id, oidc_issuer, oidc_subject) DO NOTHING`,
      [otherId, otherIssuer, otherSubject, otherPersonId]);
    await client.query(`INSERT INTO person_external_ids (tenant_id, person_id, source, external_id)
      VALUES ($1,$2,'oidc',$3) ON CONFLICT DO NOTHING`,
      [otherId, otherPersonId, `${otherIssuer}|${otherSubject}`]);
    for (const req of requirements) {
      const row = await client.query<{ id: string; active_version_id: string | null }>(`INSERT INTO requirements (tenant_id, code, title)
        VALUES ($1,$2,$3) ON CONFLICT (tenant_id, code) DO UPDATE SET title = EXCLUDED.title RETURNING id, active_version_id`,
        [tenantId, req.code, req.title]);
      if (row.rows[0].active_version_id) continue;
      const version = await client.query<{ id: string }>(`INSERT INTO requirement_versions
        (tenant_id, requirement_id, version, legal_status, authority, audience, applicability,
         delivery_constraints, recurrence, retraining_triggers, evidence_requirements,
         site_overlay_requirement, authorization_prerequisites, review_status, content_digest)
        VALUES ($1,$2,'draft-1',$3,'Draft reference only; qualified HSE review pending',
         'Applicability must be evaluated for each worker and site',$4::jsonb,
         '{"language":"understandable_to_worker"}'::jsonb,$5::jsonb,$6::jsonb,
         '{"records":"identity, site, exact versions, dates, evaluator and provenance"}'::jsonb,
         'Site-specific content and approval required',$7::jsonb,'unapproved',$8) RETURNING id`,
        [tenantId, row.rows[0].id, req.legal, JSON.stringify(req.applicability),
          JSON.stringify(req.recurrence), JSON.stringify(req.triggers), JSON.stringify(req.prerequisites), sha(req)]);
      await client.query('UPDATE requirements SET active_version_id = $3 WHERE tenant_id = $1 AND id = $2',
        [tenantId, row.rows[0].id, version.rows[0].id]);
    }
    for (const [index, code] of ['respiratory-protection','lockout-tagout','confined-space','hazard-communication'].entries()) {
      const person = await client.query<{ id: string }>(`SELECT id FROM people WHERE tenant_id = $1 AND email = $2`,
        [tenantId, `learner-${index + 1}@example.invalid`]);
      const requirement = await client.query<{ id: string; active_version_id: string }>(
        `SELECT id, active_version_id FROM requirements WHERE tenant_id = $1 AND code = $2`, [tenantId, code]);
      const siteId = siteIds[['Tifton','Ocilla','Vernon'][index % 3]];
      const dueAt = new Date(Date.now() + (index === 0 ? -1 : index + 1) * 86400000).toISOString();
      await client.query(`INSERT INTO assignments
        (tenant_id, person_id, site_id, requirement_id, requirement_version_id,
         reason, trigger_kind, due_at, created_by)
        VALUES ($1,$2,$3,$4,$5,'SYNTHETIC demonstration record — not production evidence','manual',$6,
          (SELECT id FROM principals WHERE tenant_id = $1 AND oidc_issuer = 'synthetic-dev' AND oidc_subject = 'synthetic-dev-admin'))
        ON CONFLICT (tenant_id, person_id, site_id, requirement_id)
          WHERE closed_at IS NULL AND cancelled_at IS NULL DO NOTHING`,
        [tenantId, person.rows[0].id, siteId, requirement.rows[0].id, requirement.rows[0].active_version_id, dueAt]);
    }
    await client.query('COMMIT');
    process.stdout.write(`Synthetic tenant IDs: ${tenantId} / ${otherId}; other site ${otherSite.rows[0].id}\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

try { await main(); } finally { await pool.end(); }
