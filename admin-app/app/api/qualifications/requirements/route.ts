import { courseIds } from '@/lib/training';
import type { SiteRoleRequirement } from '@/lib/qualification';
import {
  ApiError, apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, readJsonObject,
} from '@/lib/server/context';
import { saveRequirement } from '@/lib/server/qualification-store';

function text(value: unknown, label: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new ApiError(400, `${label} is required and must be ${max} characters or fewer.`);
  return value.trim();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const body = await readJsonObject(request);
    const siteId = text(body.siteId, 'Site', 80);
    assertSiteAccess(context, siteId, 'manage');
    const groupName = text(body.groupName, 'Worker role', 120);
    const courseId = text(body.courseId, 'Course', 80);
    if (!courseIds.includes(courseId as (typeof courseIds)[number]))
      throw new ApiError(400, 'Choose a course from the catalog.');
    const courseVersion = text(body.courseVersion, 'Approved course version', 120);
    const release = await context.db.prepare(`SELECT 1 FROM course_releases
      WHERE course_id = ? AND version = ? AND approved_at IS NOT NULL AND deliverable = 1`)
      .bind(courseId, courseVersion).first();
    if (!release) throw new ApiError(400, 'Choose an approved, deliverable course version.');
    const reason = text(body.reason, 'Change reason', 500);
    const flags = [
      'localInstructionRequired', 'prerequisiteRequired',
      'practicalEvaluationRequired', 'authorizationRequired',
    ] as const;
    for (const flag of flags) {
      if (typeof body[flag] !== 'boolean')
        throw new ApiError(400, `${flag} must be true or false.`);
    }
    const existing = await context.db.prepare(
      'SELECT * FROM site_role_requirements WHERE site_id = ? AND group_name = ? AND course_id = ?',
    ).bind(siteId, groupName, courseId).first<{
      id: string; updated_at: string; course_version: string; local_instruction_required: number;
      prerequisite_required: number; practical_evaluation_required: number;
      authorization_required: number;
    }>();
    if (existing && body.expectedUpdatedAt !== existing.updated_at)
      throw new ApiError(409, 'This requirement changed. Refresh and review it before saving.');
    if (!existing && body.expectedUpdatedAt)
      throw new ApiError(409, 'This requirement was removed or changed. Refresh before saving.');
    const before: SiteRoleRequirement | null = existing ? {
      id: existing.id, siteId, groupName, courseId, courseVersion: existing.course_version,
      localInstructionRequired: existing.local_instruction_required === 1,
      prerequisiteRequired: existing.prerequisite_required === 1,
      practicalEvaluationRequired: existing.practical_evaluation_required === 1,
      authorizationRequired: existing.authorization_required === 1,
      updatedAt: existing.updated_at,
    } : null;
    const requirement: SiteRoleRequirement = {
      id: existing?.id ?? crypto.randomUUID(), siteId, groupName, courseId, courseVersion,
      localInstructionRequired: body.localInstructionRequired as boolean,
      prerequisiteRequired: body.prerequisiteRequired as boolean,
      practicalEvaluationRequired: body.practicalEvaluationRequired as boolean,
      authorizationRequired: body.authorizationRequired as boolean,
      updatedAt: existing?.updated_at ?? '',
    };
    const saved = await saveRequirement(context.db, requirement, {
      actorSub: context.actor.sub, actorEmail: context.actor.email, reason, before,
    });
    return Response.json({ requirement: saved }, { status: existing ? 200 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
