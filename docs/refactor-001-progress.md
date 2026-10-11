# Refactor 001 implementation ledger

This ledger distinguishes checked-in groundwork from the exit criteria in [Refactor 001](refactor-001.md). Only evidence actually observed is marked verified. All people and records used in local tests are synthetic.

| Milestone | Implemented in this branch | Exit gate still open |
|---|---|---|
| 0 · Contracts | Five starter requirement records, domain/evidence and integration contracts; all starter content is **UNAPPROVED**. | A named qualified HSE owner must approve legal status, applicability, recurrence, content and site overlays. A real HSI sample is needed for field mapping. |
| 1 · Integration foundation | SvelteKit Node server, versioned PostgreSQL schema, tenant/site identity model, Keycloak development realms and two-Moodle stack definition pinned to a 5.3.0 source archive, synthetic SCORM 1.2 package, server-only Moodle adapter, enrollment outbox and reconciliation job. | Docker stack has not run on this machine, so the pinned Moodle build is not yet a **tested** patch. Keycloak/Moodle account linking, SCORM import/completion behavior, and the real DeepHow export are unverified. Moodle 5.3 course-completion web service does not expose the canonical course completion time assumed in an early mock; knowledge evidence is held for review until Gate B proves a documented source. Gates A and B are open. |
| 2 · Replacement | Tenant-scoped admin dashboard, assignments and deadline edits in PostgreSQL, learner draft preview, responsive views, server permissions, and synthetic Tifton/Ocilla/Vernon fixtures. Three Chromium checks cover draft program review, site filtering, deadline persistence across browser contexts, and preview activity making no training-record write. React preview remains runnable. | Full browser parity and live Moodle enrollment are not yet demonstrated. The preview's measured lesson-block pagination is not ported. |
| 3 · Compliance | Immutable/versioned schema for addenda, checklists, evidence and authorizations; separate evidence/signoff endpoints, audit packet, applicability and recurrence rule helpers. | No approved addendum, qualified evaluator, real pilot demonstration, event-driven reassignment, or HSE approval exists. Phase 3 exit tests have not passed. |
| 4 · HSI migration | Normalized CSV reconciliation utility with synthetic row-by-row tests, read-only Moodle local-plugin dry run, HSI field inventory template, and [draft cutover runbook](runbooks/hsi-cutover.md). | No real HSI export, reviewed **write** importer, Moodle backfill, two clean rehearsals, or HSE signoff exists. HSI remains authoritative; cutover is blocked. |

## Verification observed locally

- `web`: Svelte/TypeScript check, unit tests, and Node adapter build pass. The PostgreSQL migration, synthetic seed, and tenant/evidence integration tests passed against a local Homebrew PostgreSQL 16 instance. Moodle 5.3's development stack requires PostgreSQL 17; that stack was not started locally.
- `admin-app`: the frozen preview's Node tests and build pass.
- `infra/scorm`: the synthetic package structure test passes. This verifies the package, not Moodle import or tracking.
- `tools/hsi-reconcile`: seven synthetic unit tests pass, including duplicate Moodle-target rejection. No real HSI row was compared. The Moodle local-plugin test suite has not run because PHP and Moodle are absent locally.
- The compiled SvelteKit dashboard and draft Respiratory learner preview were inspected in a local browser with synthetic data. Three Chromium browser tests pass, including a draft-preview check that makes no training-record write.

The CI workflow is configured but has not yet run on a hosted runner for this branch. The Moodle/Keycloak services, SCORM behavior, and cross-company Moodle UI boundary must be verified there and in the pilot before any release claim.
