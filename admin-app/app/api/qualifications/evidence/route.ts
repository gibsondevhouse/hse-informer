import {
  qualificationReadiness,
  qualificationSteps,
  type QualificationEvent,
  type QualificationOutcome,
  type QualificationStep,
} from '@/lib/qualification';
import {
  ApiError, apiErrorResponse, assertSameOrigin, assertSiteAccess, getAdminContext, readJsonObject,
} from '@/lib/server/context';
import { appendQualificationEvent, loadQualificationSnapshot } from '@/lib/server/qualification-store';

function bounded(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    throw new ApiError(400, `${label} must be ${required ? 'provided and ' : ''}${max} characters or fewer.`);
  return value.trim();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const context = await getAdminContext(request);
    const body = await readJsonObject(request);
    const siteId = bounded(body.siteId, 'Site', 80, true);
    const workerId = bounded(body.workerId, 'Worker', 80, true);
    const courseId = bounded(body.courseId, 'Course', 80, true);
    const step = body.step as QualificationStep;
    const outcome = body.outcome as QualificationOutcome;
    if (!qualificationSteps.includes(step) || !['satisfied', 'not_satisfied', 'revoked'].includes(outcome))
      throw new ApiError(400, 'Choose a valid qualification step and outcome.');
    assertSiteAccess(context, siteId, step === 'authorization' ? 'manage' : 'evaluate');
    const reason = bounded(body.reason, 'Record reason', 500, true);
    const evidenceRef = bounded(body.evidenceRef ?? '', 'Evidence reference', 500);
    const referenceVersion = bounded(body.referenceVersion ?? '', 'Reference version', 120);
    const scope = bounded(body.scope ?? '', 'Authorization scope', 500);
    const restrictions = bounded(body.restrictions ?? '', 'Restrictions', 500);
    const expiresAt = body.expiresAt === null || body.expiresAt === '' || body.expiresAt === undefined
      ? null : bounded(body.expiresAt, 'Expiry date', 10);
    if (expiresAt) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) ||
        Number.isNaN(Date.parse(`${expiresAt}T12:00:00Z`)) ||
        new Date(`${expiresAt}T12:00:00Z`).toISOString().slice(0, 10) !== expiresAt)
        throw new ApiError(400, 'Expiry date must be a valid YYYY-MM-DD date.');
    }
    const today = context.asOf.slice(0, 10);
    if (outcome === 'satisfied' && expiresAt && expiresAt < today)
      throw new ApiError(400, 'Positive evidence cannot already be expired.');
    if (outcome === 'satisfied' && !evidenceRef)
      throw new ApiError(400, 'Add an evidence reference before recording a satisfied step.');
    if (step === 'authorization' && outcome === 'satisfied' && !scope)
      throw new ApiError(400, 'A task or equipment scope is required for authorization.');
    if (step !== 'authorization' && (scope || restrictions))
      throw new ApiError(400, 'Scope and restrictions apply only to authorization.');
    const snapshot = await loadQualificationSnapshot(context.db, [siteId]);
    const worker = snapshot.workers.find((item) => item.id === workerId);
    if (!worker || !worker.active) throw new ApiError(404, 'Active worker not found at this site.');
    const requirement = snapshot.requirements.find((item) =>
      item.siteId === siteId && item.groupName === worker.groupName && item.courseId === courseId,
    );
    if (!requirement) throw new ApiError(400, 'Configure the site and role requirement first.');
    if (step === 'authorization' && !requirement.authorizationRequired)
      throw new ApiError(400, 'Authorization is not configured for this site and role.');
    const prior = snapshot.events.filter((item) =>
      item.workerId === workerId && item.siteId === siteId &&
      item.courseId === courseId && item.step === step,
    ).at(-1);
    if (prior && body.expectedEventId !== prior.id)
      throw new ApiError(409, 'This evidence changed. Refresh and review it before recording a correction.');
    if (!prior && body.expectedEventId)
      throw new ApiError(409, 'This evidence changed. Refresh before saving.');
    if (step === 'authorization' && outcome === 'satisfied') {
      if (!snapshot.releases.some((release) =>
        release.courseId === courseId && release.version === requirement.courseVersion,
      )) throw new ApiError(409, 'The configured course version is no longer approved and deliverable.');
      const readiness = qualificationReadiness(
        worker, requirement, snapshot.assignments, snapshot.events, today,
      );
      if (readiness.missing.length)
        throw new ApiError(409, `Authorization is blocked: ${readiness.missing.join(', ')}.`);
    }
    const completed = snapshot.assignments.filter((item) =>
      item.workerId === workerId && item.siteId === siteId &&
      item.courseId === courseId && item.courseVersion === requirement.courseVersion &&
      item.status === 'Knowledge Complete' && !item.cancelledAt,
    ).sort((a, b) => a.assignedAt.localeCompare(b.assignedAt) || a.id.localeCompare(b.id)).at(-1);
    const event: QualificationEvent = {
      id: crypto.randomUUID(), workerId, siteId, courseId,
      assignmentId: completed?.id ?? null,
      courseVersion: requirement.courseVersion,
      step, outcome, evidenceRef, referenceVersion, expiresAt, scope, restrictions,
      actorSub: context.actor.sub, actorEmail: context.actor.email,
      reason, supersedesId: prior?.id ?? null, createdAt: context.asOf,
    };
    await appendQualificationEvent(context.db, event);
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
