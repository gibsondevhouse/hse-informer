import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { assignmentCourseOptions, createAssignments, createBulkAssignments } from '../src/lib/server/assignments';
import type { Actor } from '../src/lib/server/auth';
import { database } from '../src/lib/server/db';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('multi-site manual assignments', () => {
  const ids = {
    tenant: randomUUID(), foreignTenant: randomUUID(), siteEast: randomUUID(), siteWest: randomUUID(),
    foreignSite: randomUUID(), bothSites: randomUUID(), westOnly: randomUUID(), foreignPerson: randomUUID(),
    admin: randomUUID(), siteAdmin: randomUUID(), requirement: randomUUID(), version: randomUUID(),
    course: randomUUID(), newerCourse: randomUUID(), foreignCourse: randomUUID(), foreignRequirement: randomUUID(), foreignVersion: randomUUID()
  };
  const tenantAdmin: Actor = { id: ids.admin, tenantId: ids.tenant, tenantName: 'Synthetic batch test',
    tenantSynthetic: true, personId: null, displayName: 'Synthetic admin', role: 'tenant_admin', siteIds: [] };
  const restrictedAdmin: Actor = { ...tenantAdmin, id: ids.siteAdmin, role: 'site_admin', siteIds: [ids.siteEast] };
  const recipients = [
    { personId: ids.bothSites, siteId: ids.siteEast },
    { personId: ids.bothSites, siteId: ids.siteWest },
    { personId: ids.westOnly, siteId: ids.siteWest }
  ];
  const request = { recipients, requirementId: ids.requirement, courseVersionId: ids.course,
    dueDate: '2026-10-11', reason: 'Synthetic cross-site test only' };

  beforeAll(async () => {
    const db = database();
    await db.query(`INSERT INTO tenants (id, slug, name, synthetic)
      VALUES ($1,$2,'Synthetic batch test',true),($3,$4,'Foreign synthetic batch test',true)`,
      [ids.tenant, `bulk-${ids.tenant}`, ids.foreignTenant, `bulk-${ids.foreignTenant}`]);
    await db.query(`INSERT INTO sites (id, tenant_id, code, name, state_code, time_zone)
      VALUES ($1,$4,'east','East test','GA','America/New_York'),
        ($2,$4,'west','West test','CA','America/Los_Angeles'),
        ($3,$5,'foreign','Foreign test','GA','America/New_York')`,
      [ids.siteEast, ids.siteWest, ids.foreignSite, ids.tenant, ids.foreignTenant]);
    await db.query(`INSERT INTO people (id, tenant_id, display_name, person_type, synthetic)
      VALUES ($1,$4,'Both sites','employee',true),($2,$4,'West only','employee',true),
        ($3,$5,'Foreign','employee',true)`,
      [ids.bothSites, ids.westOnly, ids.foreignPerson, ids.tenant, ids.foreignTenant]);
    await db.query(`INSERT INTO person_site_memberships (tenant_id, person_id, site_id)
      VALUES ($1,$2,$3),($1,$2,$4),($1,$5,$4),($6,$7,$8)`,
      [ids.tenant, ids.bothSites, ids.siteEast, ids.siteWest, ids.westOnly,
        ids.foreignTenant, ids.foreignPerson, ids.foreignSite]);
    await db.query(`INSERT INTO principals (id, tenant_id, oidc_issuer, oidc_subject, role)
      VALUES ($1,$3,'synthetic-test',$4,'tenant_admin'),($2,$3,'synthetic-test',$5,'site_admin')`,
      [ids.admin, ids.siteAdmin, ids.tenant, ids.admin, ids.siteAdmin]);
    await db.query(`INSERT INTO principal_site_access (tenant_id, principal_id, site_id)
      VALUES ($1,$2,$3)`, [ids.tenant, ids.siteAdmin, ids.siteEast]);
    await db.query(`INSERT INTO requirements (id, tenant_id, code, title)
      VALUES ($1,$2,$3,'Synthetic batch requirement')`,
      [ids.requirement, ids.tenant, `bulk-${ids.requirement}`]);
    await db.query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version,
      legal_status, authority, audience, site_overlay_requirement, content_digest,
      authorization_prerequisites)
      VALUES ($1,$2,$3,'draft','general_awareness','Synthetic test only',
        'Synthetic people','None',repeat('a',64),'["knowledge"]')`,
      [ids.version, ids.tenant, ids.requirement]);
    await db.query(`UPDATE requirements SET active_version_id = $3 WHERE tenant_id = $1 AND id = $2`,
      [ids.tenant, ids.requirement, ids.version]);
    await db.query(`INSERT INTO course_versions (id, tenant_id, requirement_version_id,
      deephow_content_id, deephow_version, package_sha256, export_format,
      moodle_course_id, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'synthetic',repeat('b',64),'scorm_1_2',42,
        'approved','Synthetic test reviewer',now())`,
      [ids.course, ids.tenant, ids.version, `synthetic-${ids.course}`]);
    await db.query(`INSERT INTO requirements (id,tenant_id,code,title)
      VALUES ($1,$2,'foreign','Foreign course requirement')`, [ids.foreignRequirement,ids.foreignTenant]);
    await db.query(`INSERT INTO requirement_versions (id,tenant_id,requirement_id,version,legal_status,authority,audience,site_overlay_requirement,content_digest,
      review_status,reviewed_by,reviewed_at)
      VALUES ($1,$2,$3,'foreign','general_awareness','Synthetic test only','Synthetic','None',repeat('e',64),'approved','Synthetic reviewer',now())`,
    [ids.foreignVersion,ids.foreignTenant,ids.foreignRequirement]);
    await db.query(`UPDATE requirements SET active_version_id=$2 WHERE id=$1`, [ids.foreignRequirement,ids.foreignVersion]);
    await db.query(`INSERT INTO course_versions (id,tenant_id,requirement_version_id,content_id,content_version,package_sha256,export_format,moodle_course_id,
      review_status,reviewed_by,reviewed_at)
      VALUES ($1,$2,$3,'foreign','foreign',repeat('e',64),'url',44,'approved','Synthetic reviewer',now())`,
    [ids.foreignCourse,ids.foreignTenant,ids.foreignVersion]);
  });

  it('blocks the entire batch until the requirement has HSE approval', async () => {
    await expect(createBulkAssignments(tenantAdmin, request)).rejects.toMatchObject({ status: 409 });
    const rows = await database().query('SELECT id FROM assignments WHERE tenant_id = $1', [ids.tenant]);
    expect(rows.rowCount).toBe(0);
    await database().query(`UPDATE requirement_versions
      SET review_status = 'approved', reviewed_by = 'Synthetic test reviewer', reviewed_at = now()
      WHERE tenant_id = $1 AND id = $2`, [ids.tenant, ids.version]);
  });

  it('rejects unauthorized sites and cross-company people without a partial save', async () => {
    await expect(createBulkAssignments(restrictedAdmin, request)).rejects.toMatchObject({ status: 403 });
    await expect(createBulkAssignments(tenantAdmin, { ...request,
      recipients: [...recipients, { personId: ids.foreignPerson, siteId: ids.siteWest }] }))
      .rejects.toMatchObject({ status: 400 });
    const rows = await database().query('SELECT id FROM assignments WHERE tenant_id = $1', [ids.tenant]);
    expect(rows.rowCount).toBe(0);
  });

  it('requires an explicitly reviewed published course for individual and bulk requests', async () => {
    const { courseVersionId: _course, ...withoutVersion } = request;
    await expect(createBulkAssignments(tenantAdmin, withoutVersion)).rejects.toMatchObject({ status: 400 });
    const individual = { personIds: [ids.bothSites], siteId: ids.siteEast, requirementId: ids.requirement,
      dueAt: '2027-06-15T23:59:59Z', reason: request.reason };
    await expect(createAssignments(tenantAdmin, individual)).rejects.toMatchObject({ status: 400 });
    await expect(createAssignments(tenantAdmin, { ...individual, courseVersionId: ids.foreignCourse }))
      .rejects.toMatchObject({ status: 409 });
    await expect(createBulkAssignments(tenantAdmin, { ...request, courseVersionId: ids.foreignCourse }))
      .rejects.toMatchObject({ status: 409 });
    await expect(assignmentCourseOptions({ ...tenantAdmin, role: 'learner', personId: ids.bothSites }))
      .rejects.toMatchObject({ status: 403 });
    await database().query(`INSERT INTO course_versions (id,tenant_id,requirement_version_id,
      content_id,content_version,title,package_sha256,export_format,moodle_course_id,
      review_status,reviewed_by,reviewed_at,effective_at)
      VALUES ($1,$2,$3,'newer','v2','Newer course',repeat('c',64),'url',43,'unapproved',NULL,NULL,now())`,
    [ids.newerCourse,ids.tenant,ids.version]);
    await expect(createBulkAssignments(tenantAdmin, { ...request, courseVersionId: ids.newerCourse }))
      .rejects.toMatchObject({ status: 409 });
    expect((await assignmentCourseOptions(tenantAdmin)).map((course) => course.id)).toEqual([ids.course]);
    await database().query(`UPDATE course_versions SET review_status='approved',reviewed_by='Synthetic reviewer',reviewed_at=now()
      WHERE tenant_id=$1 AND id=$2`, [ids.tenant,ids.newerCourse]);
    expect((await assignmentCourseOptions(tenantAdmin)).map((course) => course.id))
      .toEqual([ids.newerCourse,ids.course]);
    expect((await assignmentCourseOptions(restrictedAdmin)).map((course) => course.id))
      .toEqual([ids.newerCourse,ids.course]);
  });

  it('creates the exact reviewed version even after a newer version is published', async () => {
    const individual = await createAssignments(tenantAdmin, { personIds: [ids.bothSites], siteId: ids.siteEast,
      requirementId: ids.requirement, courseVersionId: ids.course,
      dueAt: '2026-10-12T03:59:59Z', reason: request.reason });
    expect(individual.created).toHaveLength(1);
    expect(individual.skipped).toEqual([]);
    const first = await createBulkAssignments(tenantAdmin, { ...request,
      recipients: [...recipients, recipients[0]] });
    expect(first.created).toHaveLength(2);
    expect(first.skipped).toEqual([recipients[0]]);
    const rows = await database().query<{ person_id: string; site_id: string; due_at: Date; course_version_id: string }>(
      `SELECT person_id, site_id, due_at, course_version_id FROM assignments
       WHERE tenant_id = $1 AND requirement_id = $2 ORDER BY site_id, person_id`,
      [ids.tenant, ids.requirement]);
    expect(rows.rowCount).toBe(3);
    expect(rows.rows.every((row) => row.course_version_id === ids.course)).toBe(true);
    expect(rows.rows.find((row) => row.site_id === ids.siteEast)?.due_at.toISOString())
      .toBe('2026-10-12T03:59:59.000Z');
    expect(rows.rows.find((row) => row.site_id === ids.siteWest)?.due_at.toISOString())
      .toBe('2026-10-12T06:59:59.000Z');
    const outbox = await database().query(`SELECT id FROM integration_outbox
      WHERE tenant_id = $1 AND kind = 'moodle_enrol'`, [ids.tenant]);
    expect(outbox.rowCount).toBe(3);
    const audit = await database().query(`SELECT after_value FROM audit_log
      WHERE tenant_id=$1 AND action='assignment.created'`, [ids.tenant]);
    expect(audit.rows).toHaveLength(3);
    expect(audit.rows.every((row) => row.after_value.courseVersionId === ids.course && row.after_value.moodleCourseId === '42')).toBe(true);

    const repeated = await createBulkAssignments(tenantAdmin, request);
    expect(repeated.created).toEqual([]);
    expect(repeated.skipped).toEqual(recipients);
    expect((await database().query('SELECT id FROM assignments WHERE tenant_id = $1', [ids.tenant])).rowCount).toBe(3);
  });

  it('rejects a version retired after recipient review without creating a partial batch', async () => {
    await database().query(`UPDATE course_versions SET review_status='retired',retired_at=now()
      WHERE tenant_id=$1 AND id=$2`, [ids.tenant,ids.newerCourse]);
    await expect(createBulkAssignments(tenantAdmin, { ...request, courseVersionId: ids.newerCourse }))
      .rejects.toMatchObject({ status: 409 });
    expect((await assignmentCourseOptions(tenantAdmin)).map((course) => course.id)).toEqual([ids.course]);
    expect((await database().query('SELECT id FROM assignments WHERE tenant_id=$1', [ids.tenant])).rowCount).toBe(3);
  });

  it('rejects a stale active-requirement mapping without replacing open manual assignments', async () => {
    const nextVersion = randomUUID();
    const nextCourse = randomUUID();
    await database().query(`INSERT INTO requirement_versions (id, tenant_id, requirement_id, version,
      legal_status, authority, audience, site_overlay_requirement, content_digest,
      authorization_prerequisites, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,'v2','general_awareness','Synthetic test only',
        'Synthetic people','None',repeat('c',64),'["knowledge"]',
        'approved','Synthetic test reviewer',now())`,
      [nextVersion, ids.tenant, ids.requirement]);
    await database().query(`INSERT INTO course_versions (id, tenant_id, requirement_version_id,
      deephow_content_id, deephow_version, package_sha256, export_format,
      moodle_course_id, review_status, reviewed_by, reviewed_at)
      VALUES ($1,$2,$3,$4,'synthetic-v2',repeat('d',64),'scorm_1_2',43,
        'approved','Synthetic test reviewer',now())`,
      [nextCourse, ids.tenant, nextVersion, `synthetic-${nextCourse}`]);
    await database().query(`UPDATE requirements SET active_version_id = $3
      WHERE tenant_id = $1 AND id = $2`, [ids.tenant, ids.requirement, nextVersion]);
    await expect(createBulkAssignments(tenantAdmin, request)).rejects.toMatchObject({ status: 409 });
    const result = await createBulkAssignments(tenantAdmin, { ...request, courseVersionId: nextCourse });
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual(recipients);
    const rows = await database().query<{ cancelled_at: Date | null; requirement_version_id: string }>(
      `SELECT cancelled_at, requirement_version_id FROM assignments
       WHERE tenant_id = $1 AND requirement_id = $2`, [ids.tenant, ids.requirement]);
    expect(rows.rowCount).toBe(3);
    expect(rows.rows.every((row) => row.cancelled_at === null && row.requirement_version_id === ids.version))
      .toBe(true);
  });
});
