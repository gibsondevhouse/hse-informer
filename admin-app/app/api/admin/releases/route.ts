import { getRecordedCoursePackage, isPracticePackage } from '@/lib/lms/recorded-courses';
import { ApiError, apiErrorResponse, assertSameOrigin, getAdminContext, readJsonObject } from '@/lib/server/context';
import { auditStatement, requiredString } from '@/lib/server/records';

type Release = {
  course_id: string; version: string; title: string; launch_path: string;
  approved_at: string | null; deliverable: number;
};

export async function GET(request: Request) {
  try {
    const context = await getAdminContext(request);
    const releases = await context.db.prepare('SELECT * FROM course_releases ORDER BY title,version').all<Release>();
    return Response.json({ releases: releases.results, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    if (context.actor.role !== 'admin') throw new ApiError(403, 'Only organization administrators can approve course releases.');
    const body = await readJsonObject(request);
    const courseId = requiredString(body.courseId, 'Course ID', 100);
    const version = requiredString(body.version, 'Version', 100);
    const action = requiredString(body.action, 'Action', 20);
    const reason = requiredString(body.reason, 'Approval reason', 500);
    if (action !== 'approve' && action !== 'revoke') throw new ApiError(400, 'Action must be approve or revoke.');
    const key = `${courseId}@${version}`;
    const before = await context.db.prepare('SELECT * FROM course_releases WHERE course_id = ? AND version = ?')
      .bind(courseId, version).first<Release>();
    if (action === 'approve') {
      const course = getRecordedCoursePackage(courseId, version);
      if (!course) throw new ApiError(409, 'This course version is not packaged with this build.');
      if (before?.deliverable === 1) throw new ApiError(409, 'This course version is already approved.');
      const after: Release = {
        course_id: courseId, version, title: course.title,
        launch_path: '/learn/assignments', approved_at: context.asOf, deliverable: 1,
      };
      await context.db.batch([
        context.db.prepare(`INSERT INTO course_releases
          (course_id,version,title,launch_path,approved_at,deliverable)
          VALUES (?,?,?,?,?,1)
          ON CONFLICT(course_id,version) DO UPDATE SET title=excluded.title,launch_path=excluded.launch_path,
            approved_at=excluded.approved_at,deliverable=1`)
          .bind(courseId, version, after.title, after.launch_path, after.approved_at),
        auditStatement(context, 'release', key, isPracticePackage(courseId) ? 'practice_approved' : 'approved', null, reason, before, after),
      ]);
      return Response.json({ release: after, practiceOnly: isPracticePackage(courseId), asOf: context.asOf }, { status: 201 });
    }
    if (!before) throw new ApiError(404, 'Course release not found.');
    if (before.deliverable === 0) throw new ApiError(409, 'This release is already revoked.');
    const after = { ...before, deliverable: 0 };
    await context.db.batch([
      context.db.prepare('UPDATE course_releases SET deliverable = 0 WHERE course_id = ? AND version = ?').bind(courseId, version),
      context.db.prepare(`UPDATE assignment_outbox SET state = 'failed',last_error = 'Course release revoked'
        WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id = ? AND course_version = ?
          AND status IN ('Not started','In progress'))
          AND state IN ('pending','configuration_required','processing')`).bind(courseId, version),
      context.db.prepare(`UPDATE assignments SET delivery_state = 'failed'
        WHERE course_id = ? AND course_version = ? AND status IN ('Not started','In progress')
          AND delivery_state IN ('pending','configuration_required')`).bind(courseId, version),
      auditStatement(context, 'release', key, 'revoked', null, reason, before, after),
    ]);
    return Response.json({ release: after, asOf: context.asOf });
  } catch (error) { return apiErrorResponse(error); }
}
