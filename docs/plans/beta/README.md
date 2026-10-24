# Beta plan

**State:** Implementation underway. Core portal and record workflows pass automated checks, including synthetic Moodle and identity-provider checks in CI. Online deployment, course approval, and the participant test run remain open.
**Scope confirmed:** 2026-10-24 by the product owner.

## Release goal

A small group of administrators and learners can use one deployed application to administer training, learn, manage user profiles, and maintain accurate completion records.

Use `web/` (SvelteKit, PostgreSQL, Keycloak) as the portal and administration system. Every course runs in Moodle, which owns learning progress, attempts, scores, and completions; PostgreSQL retains mapped completion evidence and administrative records. Moodle is required for beta.

This scope takes precedence over the broader Refactor 001 and B0 proposals. Keep Moodle assignment/enrollment and completion synchronization active. No external content-source or historical import connector is required. Existing compliance protections remain: completion never implies workplace authorization, evidence is append-only, and access is tenant/site scoped.

## Beta exit criteria

1. An administrator can create and edit user profiles, invite and deactivate users, and manage roles and site access through the UI.
2. An administrator can publish a versioned beta course, assign it individually or in bulk, set due dates, and inspect progress.
3. A learner can sign in, view assigned training, complete lessons and an assessment, resume across devices, and see their completion history.
4. Moodle stores progress and assessments. PostgreSQL retains exact course mappings and verified completion evidence, including source time and available score/attempt data.
5. An administrator can search and filter completion records, inspect details, record a manual completion with provenance, and correct or void a record with a reason while retaining its history. Manual records are distinguishable from Moodle completions.
6. Profile changes do not rewrite historical evidence. Cross-tenant/site access is denied, and learners can access only their own records.
7. Staging deployment, backup/restore, basic security and accessibility checks, and the focused test run pass.

## Plans and order

| Plan | Beta responsibility |
|---|---|
| [01 Platform](01-platform-decision.md) | Moodle course mapping, launch, and verified evidence; do first |
| [02 Content](02-content-and-hse-review.md) | One versioned course and assessment |
| [03 People](03-identity-people-roles.md) | Profiles, accounts, permissions, roster import |
| [04 Learning](04-learner-experience.md) | Assignments, player, assessment, history |
| [05 Administration](05-admin-and-compliance-workflows.md) | Assignment and completion record management |
| [07 Records and reports](07-reporting-and-evidence.md) | Search, details, CSV, audit history |
| [08 Operations](08-operations-and-security.md) | Staging, recovery, isolation, accessibility |
| [09 Test run](09-test-run.md) | Verify the four core workflows |
| [06 Notifications](06-notifications.md) | Deferred automation; account invitations remain in 03 |

After 01, content, people, and operations can proceed alongside learning and administration as their dependencies become available. Implementation evidence is recorded below; a local test does not close a live release gate.

## Later versions

Practical evaluator and workplace authorization workflows; medical/fit-test and external credential workflows; instructor-led scheduling and toolbox talks; advanced applicability/recurrence rule editors; automated email/SMS reminders and escalation; full training matrix and evidence PDF packets; expanded localization and shared-device QR access; billing, federation, HRIS, and other commercial integrations.

An in-house practice course in Moodle can validate beta mechanics. Any HSE course or requirement used for real safety claims still needs qualified HSE approval. Beta records are labeled as test records and are not workplace authorization.

## Implementation evidence and open release gates

| Area | Current evidence | Still required |
|---|---|---|
| Profiles and accounts | `/people`, roster dry run/import, roles/sites, deactivation, expiring one-time activation, stable contact/sign-in separation; unit/PostgreSQL tests and synthetic Keycloak password/MFA browser checks | Real invitation mail delivery and account/learning verification against the deployed services |
| Course administration | `/courses`, reviewed mappings, publish/retire, immutable versions, concurrent mapping protection; [practice course source](../../../content/beta-practice/1.0.0/README.md) prepared | Review and install the pilot course in Moodle; verify its real assessment, resume, and version/reset behavior |
| Learner portal | `/learn`, scoped assignments, mapped launch URLs, transcript, cross-user denials | End-to-end course learning across devices in the deployed Moodle instance |
| Completion records | `/records`, manual provenance, linked correction/void history, CSV, immutable snapshots; database/browser tests and synthetic Moodle SCORM completion with stable canonical source time | Verify completion synchronization for the approved course on the deployed Moodle site |
| Recovery and operations | Production images and private stack startup verified in CI; scheduled Moodle jobs, failure alerts, PostgreSQL-only restore evidence under `infra/beta/`; full-service recovery drill added to CI | Successful full-service recovery drill, real alert recipient, offsite backup/key retrieval, rollback, and staging accessibility/security checks |
| Participant beta | [Focused scenarios](09-test-run.md) defined | Real participants, privacy/retention agreement, all scenarios and owner acceptance |

The development identity realm and Moodle fixture include runnable verification probes in CI. These are synthetic checks; no real deployment or participant test run is claimed. Full beta completion requires the open gates above.
