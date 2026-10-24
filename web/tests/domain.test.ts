import { describe, expect, it } from 'vitest';
import { applicabilityDecision, applies, assignmentState, authorizationCurrent, mayAuthorize, nextDueDate } from '../src/lib/server/domain';

describe('training decision rules', () => {
  const now = new Date('2026-10-11T12:00:00.000Z');
  it('keeps knowledge completion separate from authorization', () => {
    const signals = { dueAt: new Date('2026-11-01T00:00:00Z'), enrolled: true,
      knowledgeCompletedAt: new Date('2026-10-10T00:00:00Z'), authorizationDecision: null,
      authorizationExpiresAt: null, needsReview: true } as const;
    expect(assignmentState(signals, now)).toBe('needs_review');
    expect(authorizationCurrent(signals, now)).toBe(false);
    expect(mayAuthorize(['knowledge','site','practical'], {
      knowledge: true, site: false, practical: false, medical: false, fitTest: false, externalCredential: false
    })).toBe(false);
    expect(assignmentState({ ...signals, authorizationDecision: 'authorized' }, now)).toBe('knowledge_complete');
    expect(authorizationCurrent({ ...signals, authorizationDecision: 'authorized' }, now)).toBe(true);
  });

  it('shows overdue before incomplete or review states', () => {
    const dueAt = new Date('2026-10-10T00:00:00Z');
    expect(assignmentState({ dueAt, enrolled: false, knowledgeCompletedAt: null,
      authorizationDecision: null, authorizationExpiresAt: null }, now)).toBe('overdue');
    expect(assignmentState({ dueAt, enrolled: true, knowledgeCompletedAt: now,
      authorizationDecision: null, authorizationExpiresAt: null, needsReview: true }, now)).toBe('overdue');
  });

  it('keeps a knowledge-only completion complete after its deadline', () => {
    expect(assignmentState({ dueAt: new Date('2026-10-01T00:00:00Z'), enrolled: true,
      knowledgeCompletedAt: now, needsReview: false, authorizationDecision: null,
      authorizationExpiresAt: null }, now)).toBe('knowledge_complete');
  });

  it('calculates calendar recurrence, including leap-day completion', () => {
    expect(nextDueDate(new Date('2024-02-29T10:30:00Z'), { kind: 'annual' })?.toISOString())
      .toBe('2025-02-28T10:30:00.000Z');
    expect(nextDueDate(new Date('2024-03-15T00:00:00Z'), { kind: 'three_year' })?.toISOString())
      .toBe('2027-03-15T00:00:00.000Z');
    expect(nextDueDate(now, { kind: 'event_only' })).toBeNull();
  });

  it('assigns only matching site and role contexts', () => {
    const context = { siteId: 'tifton', personType: 'employee' as const, jobTitle: 'Operator',
      department: 'Operations', roles: ['required_respirator_user'], tasks: [], equipment: [],
      chemicals: [], exposureGroups: ['chemical_exposure'] };
    expect(applies({ siteIds: ['tifton'], roles: ['required_respirator_user'] }, context)).toBe(true);
    expect(applies({ siteIds: ['ocilla'], roles: ['required_respirator_user'] }, context)).toBe(false);
    expect(applies({ equipment: ['forklift'] }, context)).toBe(false);
    expect(applicabilityDecision({}, context)).toBe('needs_review');
    expect(applicabilityDecision({ roles: [] }, context)).toBe('needs_review');
    expect(applicabilityDecision({ siteIds: ['tifton'], roles: ['required_respirator_user'] },
      { siteId: 'tifton' })).toBe('needs_review');
    expect(applicabilityDecision({ siteIds: ['ocilla'], roles: ['required_respirator_user'] },
      { siteId: 'tifton' })).toBe('does_not_apply');
  });
});
