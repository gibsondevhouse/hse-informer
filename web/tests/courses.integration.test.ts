import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createCourse, changeCourse, listCourses } from '../src/lib/server/courses';
import { database } from '../src/lib/server/db';
import type { Actor } from '../src/lib/server/auth';

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), inspectQuiz: vi.fn() }));
vi.mock('../src/lib/server/moodle', () => ({
  inspectMoodleCourse: mocks.inspect,
  inspectMoodleQuiz: mocks.inspectQuiz,
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
    mocks.inspectQuiz.mockResolvedValue(undefined);
  });

  it('creates an unapproved Moodle mapping with neutral source fields and no vendor ID', async () => {
    practiceId = await createCourse(admin, input);
    const rows = await database().query('SELECT deephow_content_id, content_id, review_status FROM course_versions WHERE id = $1', [practiceId]);
    expect(rows.rows[0]).toEqual({ deephow_content_id: null, content_id: input.sourceContentId, review_status: 'unapproved' });
    const courses = await listCourses(admin);
    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ id: practiceId, practiceOnly: true, requirementReviewStatus: 'approved', completionVerified: false,
      moodleActivityId: null, moodleScormId: null, moodleQuizId: null });
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

  it('creates and verifies a native quiz mapping, then freezes the published quiz identity', async () => {
    const id = await createCourse(admin, { ...input, code: 'NATIVE-QUIZ-TEST', sourceContentId: 'NATIVE-QUIZ-TEST',
      exportFormat: 'url', moodleCourseId: 46, moodleActivityId: 260, moodleQuizId: 19 });
    expect((await listCourses(admin)).find((course) => course.id === id)).toMatchObject({
      exportFormat: 'url', moodleCourseId: 46, moodleActivityId: 260, moodleQuizId: 19, moodleScormId: null,
      completionVerified: false, reviewStatus: 'unapproved'
    });
    await changeCourse(admin, id, { action: 'verify', note: 'Native quiz failed, retried and passed at 80 percent; three-attempt limit verified.' });
    expect(mocks.inspectQuiz).toHaveBeenCalledWith(tenant, 46, 19, 260);
    const verified = (await listCourses(admin)).find((course) => course.id === id);
    expect(verified?.verificationNote).toContain('Native Moodle quiz 19 and activity module 260 confirmed');
    await changeCourse(admin, id, { action: 'approve' });
    for (const statement of [
      'UPDATE course_versions SET moodle_quiz_id=20 WHERE id=$1',
      'UPDATE course_versions SET moodle_activity_id=261 WHERE id=$1',
      'UPDATE course_versions SET moodle_quiz_id=NULL,moodle_scorm_id=20 WHERE id=$1'
    ]) await expect(database().query(statement, [id])).rejects.toThrow(/reviewed versions cannot be changed/);
    expect((await listCourses(admin)).find((course) => course.id === id)).toMatchObject({
      reviewStatus: 'approved', moodleActivityId: 260, moodleQuizId: 19, moodleScormId: null
    });
  });

  it('rejects mixed assessments and every incomplete activity-instance pair', async () => {
    for (const mapping of [
      { moodleActivityId: 260 }, { moodleQuizId: 19 }, { moodleScormId: 17 },
      { moodleActivityId: 260, moodleQuizId: 19, moodleScormId: 17 },
      { moodleActivityId: null, moodleQuizId: 19, moodleScormId: 17 }
    ]) await expect(createCourse(admin, { ...input, ...mapping })).rejects.toMatchObject({ status: 400 });
  });

  it('fails native quiz verification before saving when the course or exact assessment cannot be confirmed', async () => {
    const id = await createCourse(admin, { ...input, code: 'NATIVE-QUIZ-REJECT', sourceContentId: 'NATIVE-QUIZ-REJECT',
      exportFormat: 'url', moodleCourseId: 47, moodleActivityId: 270, moodleQuizId: 29 });
    const verify = { action: 'verify', note: 'Native quiz inspection must confirm the exact course, activity and instance.' };
    mocks.inspectQuiz.mockClear();
    for (const observed of [
      { id: 47, title: 'Practice course', visible: false, completionEnabled: true },
      { id: 47, title: 'Practice course', visible: true, completionEnabled: false }
    ]) {
      mocks.inspect.mockResolvedValueOnce(observed);
      await expect(changeCourse(admin, id, verify)).rejects.toMatchObject({ status: 409 });
      expect(mocks.inspectQuiz).not.toHaveBeenCalled();
    }
    for (const message of ['Quiz belongs to another course', 'Activity is not a quiz', 'Quiz instance does not match the activity']) {
      mocks.inspectQuiz.mockRejectedValueOnce(new Error(message));
      await expect(changeCourse(admin, id, verify)).rejects.toThrow(message);
      expect((await listCourses(admin)).find((course) => course.id === id)).toMatchObject({
        completionVerified: false, verificationNote: null, reviewStatus: 'unapproved'
      });
    }
  });

  it('preserves the existing SCORM pair without invoking native quiz inspection', async () => {
    const id = await createCourse(admin, { ...input, code: 'SCORM-PAIR-TEST', sourceContentId: 'SCORM-PAIR-TEST',
      moodleCourseId: 48, moodleActivityId: 280, moodleScormId: 30 });
    mocks.inspectQuiz.mockClear();
    await changeCourse(admin, id, { action: 'verify', note: 'Existing SCORM assessment and course completion behavior tested with a learner.' });
    expect(mocks.inspectQuiz).not.toHaveBeenCalled();
    expect((await listCourses(admin)).find((course) => course.id === id)).toMatchObject({
      exportFormat: 'scorm_1_2', moodleActivityId: 280, moodleScormId: 30, moodleQuizId: null, completionVerified: true
    });
  });
});
