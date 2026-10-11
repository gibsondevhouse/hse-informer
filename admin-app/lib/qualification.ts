export const qualificationSteps = [
  'local_instruction',
  'prerequisite',
  'practical_evaluation',
  'authorization',
] as const;
export type QualificationStep = (typeof qualificationSteps)[number];
export type QualificationOutcome = 'satisfied' | 'not_satisfied' | 'revoked';

export type SiteRoleRequirement = {
  id: string;
  siteId: string;
  groupName: string;
  courseId: string;
  courseVersion: string;
  localInstructionRequired: boolean;
  prerequisiteRequired: boolean;
  practicalEvaluationRequired: boolean;
  authorizationRequired: boolean;
  updatedAt: string;
};

export type QualificationEvent = {
  id: string;
  workerId: string;
  siteId: string;
  courseId: string;
  assignmentId: string | null;
  courseVersion: string;
  step: QualificationStep;
  outcome: QualificationOutcome;
  evidenceRef: string;
  referenceVersion: string;
  expiresAt: string | null;
  scope: string;
  restrictions: string;
  actorSub: string;
  actorEmail: string;
  reason: string;
  supersedesId: string | null;
  createdAt: string;
};

export type QualificationWorker = {
  id: string;
  name: string;
  email: string;
  siteId: string;
  groupName: string;
  active: boolean;
};

export type QualificationAssignment = {
  id: string;
  courseId: string;
  reason: string;
  status: 'Not started' | 'In progress' | 'Knowledge Complete' | 'Cancelled';
  workerId: string;
  siteId: string;
  courseVersion: string;
  assignedAt: string;
  dueDate: string;
  deliveryState: string;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type QualificationSnapshot = {
  asOf: string;
  sites: { id: string; name: string; code: string; location: string }[];
  releases: { courseId: string; version: string; title: string }[];
  workers: QualificationWorker[];
  requirements: SiteRoleRequirement[];
  assignments: QualificationAssignment[];
  events: QualificationEvent[];
};

export type QualificationQueue =
  | 'all'
  | 'unassigned'
  | 'overdue'
  | 'site_instruction'
  | 'evaluation'
  | 'expiring'
  | 'failed_delivery';

export const queueLabels: Record<QualificationQueue, string> = {
  all: 'All workers',
  unassigned: 'Unassigned eligible',
  overdue: 'Overdue work',
  site_instruction: 'Site instruction',
  evaluation: 'Practical evaluation',
  expiring: 'Prerequisites due / expired',
  failed_delivery: 'Delivery failures / setup',
};

export function latestEvents(events: QualificationEvent[]) {
  const result = new Map<string, QualificationEvent>();
  for (const event of [...events].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )) {
    result.set(`${event.workerId}:${event.siteId}:${event.courseId}:${event.step}`, event);
  }
  return result;
}

export function isCurrentEvidence(event: QualificationEvent | undefined, today: string) {
  return !!event && event.outcome === 'satisfied' && (!event.expiresAt || event.expiresAt >= today);
}

export function requirementFor(
  requirements: SiteRoleRequirement[],
  worker: QualificationWorker,
  courseId: string,
) {
  return requirements.find((item) =>
    item.siteId === worker.siteId &&
    item.groupName === worker.groupName &&
    item.courseId === courseId,
  );
}

export function qualificationReadiness(
  worker: QualificationWorker,
  requirement: SiteRoleRequirement,
  assignments: QualificationAssignment[],
  events: QualificationEvent[],
  today: string,
) {
  const matching = assignments.filter((item) =>
    item.workerId === worker.id &&
    item.siteId === worker.siteId &&
    item.courseId === requirement.courseId &&
    !item.cancelledAt,
  );
  const latest = [...matching].sort((a, b) =>
    a.assignedAt.localeCompare(b.assignedAt) || a.id.localeCompare(b.id),
  ).at(-1);
  const knowledge = latest?.status === 'Knowledge Complete' &&
    !!latest.completedAt && latest.courseVersion === requirement.courseVersion;
  const current = latestEvents(events);
  const eventFor = (step: QualificationStep) =>
    current.get(`${worker.id}:${worker.siteId}:${requirement.courseId}:${step}`);
  const missing: string[] = [];
  if (!knowledge) missing.push('Knowledge completion');
  if (requirement.localInstructionRequired && (
    eventFor('local_instruction')?.courseVersion !== requirement.courseVersion ||
    !isCurrentEvidence(eventFor('local_instruction'), today)
  ))
    missing.push('Site instruction');
  // External prerequisite records (for example, fit-test status) retain their own
  // reference version and expiry. A course release change does not invalidate them.
  if (requirement.prerequisiteRequired && !isCurrentEvidence(eventFor('prerequisite'), today))
    missing.push('Prerequisite');
  if (requirement.practicalEvaluationRequired && (
    eventFor('practical_evaluation')?.courseVersion !== requirement.courseVersion ||
    !isCurrentEvidence(eventFor('practical_evaluation'), today)
  ))
    missing.push('Practical evaluation');
  const authorization = eventFor('authorization');
  return {
    knowledge,
    missing,
    authorization,
    authorized: requirement.authorizationRequired && missing.length === 0 &&
      authorization?.courseVersion === requirement.courseVersion &&
      isCurrentEvidence(authorization, today),
  };
}

export function queueRows(snapshot: QualificationSnapshot, queue: QualificationQueue) {
  const today = snapshot.asOf.slice(0, 10);
  const soon = new Date(`${today}T12:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + 30);
  const soonDate = soon.toISOString().slice(0, 10);
  const current = latestEvents(snapshot.events);
  return snapshot.workers.flatMap((worker) => {
    if (!worker.active) return [];
    const requirements = snapshot.requirements.filter((item) =>
      item.siteId === worker.siteId && item.groupName === worker.groupName,
    );
    for (const assignment of snapshot.assignments.filter((item) =>
      item.workerId === worker.id && item.siteId === worker.siteId && !item.cancelledAt,
    )) {
      if (requirements.some((item) => item.courseId === assignment.courseId)) continue;
      requirements.push({
        id: `unconfigured:${worker.id}:${assignment.courseId}`,
        siteId: worker.siteId, groupName: worker.groupName,
        courseId: assignment.courseId, courseVersion: assignment.courseVersion,
        localInstructionRequired: false, prerequisiteRequired: false,
        practicalEvaluationRequired: false, authorizationRequired: false,
        updatedAt: '',
      });
    }
    return requirements.flatMap((requirement) => {
      const assignments = snapshot.assignments.filter((item) =>
        item.workerId === worker.id && item.courseId === requirement.courseId &&
        item.siteId === worker.siteId && item.courseVersion === requirement.courseVersion &&
        !item.cancelledAt,
      );
      const readiness = qualificationReadiness(
        worker, requirement, snapshot.assignments, snapshot.events, today,
      );
      const currentPrerequisite = current.get(
        `${worker.id}:${worker.siteId}:${requirement.courseId}:prerequisite`,
      );
      const flags = {
        unassigned: assignments.length === 0,
        overdue: assignments.some((item) =>
          item.status !== 'Knowledge Complete' && item.dueDate < today,
        ),
        site_instruction: readiness.knowledge && requirement.localInstructionRequired &&
          readiness.missing.includes('Site instruction'),
        evaluation: readiness.knowledge && requirement.practicalEvaluationRequired &&
          readiness.missing.includes('Practical evaluation'),
        expiring: !!currentPrerequisite && currentPrerequisite.outcome === 'satisfied' &&
          !!currentPrerequisite.expiresAt && currentPrerequisite.expiresAt <= soonDate,
        failed_delivery: assignments.some((item) =>
          item.deliveryState === 'failed' || item.deliveryState === 'configuration_required',
        ),
      };
      if (queue !== 'all' && !flags[queue]) return [];
      return [{ worker, requirement, assignments, readiness, flags }];
    });
  });
}

export function escapeCsv(value: string | number | boolean | null | undefined): string {
  const raw = value == null ? '' : String(value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
