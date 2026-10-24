# Beta plan

| | |
|---|---|
| **Target** | Beta: the first multi-user test run |
| **State** | Planning. Nothing in this folder is started unless its plan says so. |
| **Source** | LMS gap analysis of `main` at `9fb009c` (2026-10-24) |

## What beta means

Beta is the build in which a small, named group of people use HSE Informer at the same time, on real accounts, against a deployed environment, and the records they create stay correct. It is a test run, not a production launch. Nobody relies on a beta record as workplace authorization, and the product is not used outside the test run until beta passes.

The test run uses one pilot company with two sites, about 5 administrators or site managers, 2 evaluators, 1 auditor, and 20 to 50 workers. The [test run plan](09-test-run.md) defines who takes part, which scenarios they run, and what counts as a pass.

## Beta exit criteria

Beta is done when all of these are true and recorded in [09-test-run.md](09-test-run.md):

1. One application stack serves administrators, evaluators, auditors, and learners from a deployed staging environment ([01](01-platform-decision.md), [08](08-operations-and-security.md)).
2. At least one HSE course is approved by the named HSE reviewer and delivered with a graded, server-recorded assessment ([02](02-content-and-hse-review.md), [04](04-learner-experience.md)).
3. Real people sign in with individual accounts, are imported from a roster, and see only their permitted company, sites, and records ([03](03-identity-people-roles.md)).
4. Administrators assign training, evaluators record practical signoff, and approvers issue and revoke authorizations through the UI, with no SQL or API calls by hand ([05](05-admin-and-compliance-workflows.md)).
5. Assignment, due-soon, overdue, and evaluator-task notices reach people and show delivery status ([06](06-notifications.md)).
6. A site manager works from a training matrix and standard reports, and an auditor exports one worker's evidence packet as PDF and CSV ([07](07-reporting-and-evidence.md)).
7. Backups restore, failures alert someone, and the security and accessibility checks in [08](08-operations-and-security.md) pass.
8. Every scenario in [09](09-test-run.md) passes with the test group, and critical defects are closed.

## Plans

| # | Plan | Covers | Depends on |
|---|---|---|---|
| 01 | [Platform decision](01-platform-decision.md) | One stack, the delivery path, porting the player | Nothing. Do this first. |
| 02 | [Content and HSE review](02-content-and-hse-review.md) | HSE owner, pilot course, review workflow, authoring or import, Spanish | 01 for the content format |
| 03 | [Identity, people, and roles](03-identity-people-roles.md) | Accounts, invitations, roster import, supervisors, tenant setup | 01 |
| 04 | [Learner experience](04-learner-experience.md) | Learner portal, player, assessments, certificates, shop-floor access | 01, 02, 03 |
| 05 | [Admin and compliance workflows](05-admin-and-compliance-workflows.md) | Assignment rules, instructor-led sessions, evaluations, authorizations, addenda | 03 |
| 06 | [Notifications](06-notifications.md) | Email and SMS, reminders, escalation, delivery status | 03, 05 |
| 07 | [Reporting and evidence](07-reporting-and-evidence.md) | Training matrix, standard reports, evidence exports | 05 |
| 08 | [Operations and security](08-operations-and-security.md) | Deployment, backups, monitoring, security, accessibility | 01; runs alongside everything else |
| 09 | [Test run](09-test-run.md) | Participants, scenarios, data handling, go/no-go | All of the above |

Suggested order: 01 first; then 02, 03, and 08 in parallel; then 04 and 05; then 06 and 07; then 09. Content review (02) has the longest lead time because it depends on people outside the codebase, so it should start in the same week as 01.

## Decisions needed before work starts

| Decision | Plan | Recommendation |
|---|---|---|
| Which stack is the product? | 01 | `web/` (SvelteKit, PostgreSQL, Keycloak). Port the React player into it and archive `admin-app/` afterwards. |
| Does Moodle deliver courses in beta? | 01 | Own delivery with the ported player for beta. Keep Moodle as a later connector only if a customer requires it. |
| Who is the named HSE owner and reviewer? | 02 | Name them before content work starts. Beta can't pass without their approval. |
| Which pilot company and two sites? | 09 | Tifton and Ocilla in the first company, matching the existing synthetic fixtures. |
| Which course is the pilot course? | 02 | Respiratory Protection, the furthest along and the best test of knowledge vs. authorization. |

## Out of scope for beta

These are real needs for a commercial launch, and they belong in a later version's plans: billing and licensing, tenant self-signup, SAML or SCIM federation with employer identity providers, HRIS connectors, LTI and xAPI, SCORM 2004 import, HSI migration and cutover (Refactor 001 Phase 4), contractor orientation, scheduled report delivery, incident-system integration, offline evaluator app, gamification, and a general report builder.
