import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createCourse, changeCourse, listCourses } from '../src/lib/server/courses';
import { database } from '../src/lib/server/db';
import type { Actor } from '../src/lib/server/auth';

const mocks = vi.hoisted(() => ({ inspect: vi.fn() }));
vi.mock('../src/lib/server/moodle', () => ({
  inspectMoodleCourse: mocks.inspect,
  moodleConnection: () => ({ completionEvidence: 'local_hse_evidence' }),
  moodleCourseUrl: (_tenant: string, id: number) => `https://moodle.example.test/course/view.php?id=${id}`
}));
const enabled = Boolean(process.env.TEST_DATABASE_URL);
if (enabled) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)('Moodle course version lifecycle', () => {
  const tenant = randomUUID();
  const admin: Actor = { id: randomUUID(), tenantId: tenant, tenantName: 'Course test', tenantSynthetic: true,
    personId: null, displayName: 'Course administrator', role: 'tenant_admin', siteIds: [] };
  const reviewer: Actor = { ...admin, id: randomUUID(), displayName: 'Named HSE reviewer', role: 'hse_reviewer' };
  const input = { code: 'PBJ-COURSE-TEST', title: 'Practice course', sourceContentId: 'PBJ-COURSE-TEST', version: '1.0',
    packageSha256: 'a'.repeat(64), exportFormat: 'scorm_1_2', moodleCourseId: 42, practiceOnly: true };
  let practiceId: string;

  beforeAll(async () => {
    await database().query(`INSERT INTO tenants (id, slug, name, synthetic) VALUES ($1,$2,'Course lifecycle test',true)`, [tenant, `courses-${tenant}`]);
    for (const actor of [admin, reviewer]) await database().query(`INSERT INTO principals
      (id, tenant_id, oidc_issuer, oidc_subject, role) VALUES ($1,$2,'test',$4,$3)`, [actor.id, tenant, actor.role, actor.id]);
    mocks.inspect.mockImplementation(async (_tenant: string, id: number) => ({ id, title: 'Practice course', visible: true, completionEnabled: true }));
  });

  it('creates an unapproved Moodle mapping with neutral source fields and no vendor ID', async () => {
    practiceId = await createCourse(admin, input);
    const rows = await database().query('SELECT deephow_content_id, content_id, review_status FROM course_versions WHERE id = $1', [practiceId]);
    expect(rows.rows[0]).toEqual({ deephow_content_id: null, content_id: input.sourceContentId, review_status: 'unapproved' });
    const courses = await listCourses(admin);
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ id: practiceId, practiceOnly: true, requirementReviewStatus: 'approved', completionVerified: false });
    await expect(changeCourse(admin, practiceId, { action: 'approve' })).rejects.toMatchObject({ status: 409 });
  });

  it('inspects and verifies Moodle before publishing, then freezes the content and verification', async () => {
    await changeCourse(admin, practiceId, { action: 'verify', note: 'Test learner passed after failing and retrying. Two attempts; pass mark 80%; evidence test://pilot.' });
    expect(mocks.inspect).toHaveBeenCalledWith(tenant, 42);
    await changeCourse(admin, practiceId, { action: 'approve' });
    const course = (await listCourses(admin))[0];
    expect(course).toMatchObject({ reviewStatus: 'approved', completionVerified: true, reviewedBy: admin.displayName });
    await expect(database().query('UPDATE course_versions SET package_sha256 = repeat($2,64) WHERE id = $1', [practiceId, 'b']))
      .rejects.toThrow(/reviewed versions cannot be changed/);
    await expect(changeCourse(admin, practiceId, { action: 'verify', note: 'Trying to overwrite a reviewed mapping' }))
      .rejects.toMatchObject({ status: 409 });
  });

  it('requires a new version for changed content, preserves the predecessor, and retires it without editing evidence', async () => {
    const original = (await listCourses(admin))[0];
    await expect(createCourse(admin, { ...input, requirementId: original.requirementId, packageSha256: 'b'.repeat(64) }))
      .rejects.toMatchObject({ status: 409 });
    const next = await createCourse(admin, { ...input, requirementId: original.requirementId, version: '2.0', moodleCourseId: 43, packageSha256: 'b'.repeat(64) });
    expect(next).not.toBe(practiceId);
    await changeCourse(admin, practiceId, { action: 'retire' });
    const previous = (await listCourses(admin)).find((course) => course.id === practiceId);
    expect(previous).toMatchObject({ reviewStatus: 'retired', version: '1.0', packageSha256: input.packageSha256 });
    await expect(database().query(`UPDATE course_versions SET review_status = 'approved' WHERE id = $1`, [practiceId]))
      .rejects.toThrow(/reviewed versions cannot be changed/);
  });

  it('requires a named HSE reviewer for real content and records separate requirement approval', async () => {
    const id = await createCourse(admin, { ...input, code: 'SAFETY-COURSE-TEST', sourceContentId: 'SAFETY-COURSE-TEST', moodleCourseId: 44, practiceOnly: false });
    await expect(changeCourse(admin, id, { action: 'approve-requirement' })).rejects.toMatchObject({ status: 403 });
    await changeCourse(reviewer, id, { action: 'approve-requirement' });
    await changeCourse(admin, id, { action: 'verify', note: 'Actual reviewed test result and configured Moodle remediation evidence: test://course-42.' });
    await expect(changeCourse(admin, id, { action: 'approve' })).rejects.toMatchObject({ status: 403 });
    await changeCourse(reviewer, id, { action: 'approve' });
    expect((await listCourses(admin)).find((course) => course.id === id)).toMatchObject({ reviewStatus: 'approved', reviewedBy: reviewer.displayName });
  });

  it('hides foreign courses and denies course writes from learners or site administrators', async () => {
    const foreign: Actor = { ...admin, tenantId: randomUUID() };
    expect(await listCourses(foreign)).toEqual([]);
    await expect(changeCourse(foreign, practiceId, { action: 'retire' })).rejects.toMatchObject({ status: 404 });
    await expect(createCourse({ ...admin, role: 'learner' }, input)).rejects.toMatchObject({ status: 403 });
    await expect(createCourse({ ...admin, role: 'site_admin' }, input)).rejects.toMatchObject({ status: 403 });
    await expect(listCourses({ ...admin, role: 'learner' })).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a mapping with only half of its SCORM identifiers', async () => {
    await expect(createCourse(admin, { ...input, moodleScormId: 17 })).rejects.toMatchObject({ status: 400 });
  });

  it('serializes concurrent mappings so a Moodle course cannot represent two distinct versions', async () => {
    const results = await Promise.allSettled(['concurrent-a', 'concurrent-b'].map((suffix) => createCourse(admin, {
      ...input, code: `COURSE-${suffix}`, sourceContentId: suffix, moodleCourseId: 45
    })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ status: 409 });
    const mapped = await database().query('SELECT id FROM course_versions WHERE tenant_id = $1 AND moodle_course_id = 45', [tenant]);
    expect(mapped.rowCount).toBe(1);
    const requirements = await database().query(`SELECT id FROM requirements WHERE tenant_id = $1 AND code LIKE 'COURSE-concurrent-%'`, [tenant]);
    expect(requirements.rowCount).toBe(1);
  });
});
