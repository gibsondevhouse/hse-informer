export type AssignmentState = 'not_started' | 'in_progress' | 'knowledge_complete' | 'overdue' | 'needs_review' | 'closed';
export type DeliveryState = 'draft' | 'queued' | 'enrolled';

export interface AssignmentSignals {
  dueAt: Date;
  closedAt?: Date | null;
  enrolled: boolean;
  knowledgeCompletedAt: Date | null;
  authorizationDecision: 'authorized' | 'restricted' | 'revoked' | null;
  authorizationExpiresAt: Date | null;
  prerequisitesCurrent?: boolean;
  needsReview?: boolean;
  hasBlockingDrift?: boolean;
}

export function authorizationCurrent(signals: Pick<AssignmentSignals,
  'authorizationDecision' | 'authorizationExpiresAt' | 'prerequisitesCurrent'>, now: Date): boolean {
  return (signals.authorizationDecision === 'authorized' || signals.authorizationDecision === 'restricted')
    && signals.prerequisitesCurrent !== false
    && (!signals.authorizationExpiresAt || signals.authorizationExpiresAt > now);
}

export function assignmentState(signals: AssignmentSignals, now: Date): AssignmentState {
  if (signals.closedAt) return 'closed';
  if (signals.dueAt < now && (!signals.knowledgeCompletedAt || signals.needsReview) && !authorizationCurrent(signals, now)) return 'overdue';
  if (signals.hasBlockingDrift) return 'needs_review';
  if (signals.knowledgeCompletedAt && signals.needsReview && !authorizationCurrent(signals, now)) return 'needs_review';
  if (signals.knowledgeCompletedAt) return 'knowledge_complete';
  if (signals.enrolled) return 'in_progress';
  return 'not_started';
}

export type Recurrence = { kind: 'event_only' } | { kind: 'annual' } | { kind: 'three_year' };

export function nextDueDate(completedAt: Date, recurrence: Recurrence): Date | null {
  if (recurrence.kind === 'event_only') return null;
  const next = new Date(completedAt);
  const years = recurrence.kind === 'annual' ? 1 : 3;
  // Calendar recurrence: Feb 29 becomes Feb 28 in non-leap years.
  const month = next.getUTCMonth();
  const date = next.getUTCDate();
  next.setUTCFullYear(next.getUTCFullYear() + years);
  if (next.getUTCMonth() !== month && date === 29) next.setUTCDate(0);
  return next;
}

export interface ApplicabilityRule {
  siteIds?: string[];
  personTypes?: Array<'employee' | 'contractor' | 'temporary'>;
  jobs?: string[];
  departments?: string[];
  roles?: string[];
  tasks?: string[];
  equipment?: string[];
  chemicals?: string[];
  exposureGroups?: string[];
}
export interface PersonContext {
  siteId?: string;
  personType?: 'employee' | 'contractor' | 'temporary';
  jobTitle?: string;
  department?: string;
  roles?: string[];
  tasks?: string[];
  equipment?: string[];
  chemicals?: string[];
  exposureGroups?: string[];
}

export type ApplicabilityDecision = 'applies' | 'does_not_apply' | 'needs_review';

export function applicabilityDecision(rule: ApplicabilityRule, context: PersonContext): ApplicabilityDecision {
  const dimensions: Array<[string[] | undefined, string | string[] | undefined]> = [
    [rule.siteIds, context.siteId], [rule.personTypes, context.personType],
    [rule.jobs, context.jobTitle], [rule.departments, context.department],
    [rule.roles, context.roles], [rule.tasks, context.tasks], [rule.equipment, context.equipment],
    [rule.chemicals, context.chemicals], [rule.exposureGroups, context.exposureGroups]
  ];
  const targets = dimensions.filter(([allowed]) => allowed !== undefined);
  if (!targets.length || targets.some(([allowed]) => !allowed?.length)) return 'needs_review';
  let unknown = false;
  for (const [allowed, actual] of targets) {
    if (actual === undefined || actual === '') { unknown = true; continue; }
    const values = Array.isArray(actual) ? actual : [actual];
    if (!allowed?.some((value) => values.includes(value))) return 'does_not_apply';
  }
  return unknown ? 'needs_review' : 'applies';
}

export function applies(rule: ApplicabilityRule, context: PersonContext): boolean {
  return applicabilityDecision(rule, context) === 'applies';
}

export function mayAuthorize(required: string[], evidence: {
  knowledge: boolean; site: boolean; practical: boolean; medical: boolean; fitTest: boolean; externalCredential: boolean;
}): boolean {
  const allowed = new Set(['knowledge','site','practical','medical','fitTest','externalCredential']);
  if (required.some((item) => !allowed.has(item))) return false;
  return required.every((item) => evidence[item as keyof typeof evidence]);
}

/** An authorization signs the exact immutable evidence rows, not merely a set of booleans. */
export function evidenceSnapshotCurrent(required: string[], recorded: unknown,
  current: Record<string, string | null>): boolean {
  if (!required.length || !recorded || typeof recorded !== 'object' || Array.isArray(recorded)) return false;
  const snapshot = recorded as Record<string, unknown>;
  if (Object.keys(snapshot).length !== new Set(required).size) return false;
  return required.every((key) => typeof current[key] === 'string' && current[key] === snapshot[key]);
}
