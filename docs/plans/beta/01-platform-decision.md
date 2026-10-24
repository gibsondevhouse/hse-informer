# 01 · Platform decision

**Goal:** one application stack and one course delivery path for beta.

## Why

The repository has two partial products. `admin-app/` (React/Vinext, Cloudflare D1 and Access) holds the course player, the 34 block types, assessment scoring, attempt limits, the PBJ presentation, and an unprovisioned server-side learner path that persists recorded progress to D1. `web/` (SvelteKit, PostgreSQL, Keycloak) holds the compliance data model, tenant isolation, reassignment, and the Moodle adapter, but its learner side is a draft preview. Every feature below would otherwise be built twice or built in the wrong place.

The [Refactor 001 roadmap](../../refactor-001.md) also plans one self-hosted Moodle instance per customer. For beta that adds a PHP LMS to deploy, patch, and back up, and it leaves Gates A and B open. The ported player already covers what beta needs from Moodle.

## Decisions

| Decision | Recommendation | If the other option is chosen |
|---|---|---|
| Product stack | `web/` | If `admin-app/` is kept instead, plans 03 to 08 must be rewritten against D1 and Cloudflare Access, and the PostgreSQL compliance model must be ported the other way. |
| Beta course delivery | Ported HSE Informer player, server-recorded progress and attempts | If Moodle is kept, beta also needs Gates A and B closed, a hosted Moodle per company, Keycloak account linking in Moodle, and Moodle in the backup and monitoring plan. |

Record the outcome and date in this file and in the [contract register](../../contracts/README.md) "Decisions fixed for implementation" list, because decision 4 there names Moodle as the delivery path.

## Work

- [ ] Record both decisions above with the date and who made them.
- [ ] Port `admin-app/lib/lms/` (schema, engine, scoring) into `web/src/lib/lms/` as framework-free TypeScript, and keep the existing unit tests passing there.
- [ ] Rebuild the block renderer and course player (`admin-app/components/lms/`) as Svelte components, using the shared tokens in `ui/tokens.css`.
- [ ] Store learner progress and assessment attempts in PostgreSQL, tied to the assignment and the exact course version. Use the protected recorded learner path in `admin-app/app/api/learner/assignments/[id]/route.ts` as the reference: it replays each action on the server (`lib/lms/recorded-actions.ts`) and rejects stale writes with a revision check. Keep both safeguards. The browser-local progress in the previews is not the reference.
- [ ] Add a course package table (course ID, version, checksum, block content as JSON) so courses are data, not TypeScript modules.
- [ ] Port the PBJ-101 sandbox package to prove the path end to end.
- [ ] Remove the Moodle dependency from the compliance path. Disabling the adapter alone is not enough, because the schema and server code assume Moodle:
  - `web/migrations/001_foundation.sql` requires `moodle_course_id` before a course version can be approved, and `knowledge_evidence` requires `moodle_course_id`, `moodle_user_id`, and `moodle_timecompleted`.
  - `web/src/lib/server/reassignment.ts` requires a verified Moodle course mapping before it assigns, queues a `moodle_enrol` outbox job, and reads knowledge evidence by `moodle_timecompleted`.
  - `web/src/lib/server/compliance.ts` reads that same knowledge evidence for authorization.
- [ ] Add a migration that gives course versions and knowledge evidence a delivery source (`native` or `moodle`), makes the Moodle columns required only for `moodle`, and records native completions as knowledge evidence with source attempt ID, completion time, score, and course version.
- [ ] Update the [domain contract](../../contracts/domain.md) "Knowledge Complete" guard and the [integration contract](../../contracts/integrations.md) to describe native delivery, and update reassignment and compliance queries to use the source-neutral columns.
- [ ] Keep the Moodle adapter and outbox code behind a disabled per-tenant setting rather than deleting it.
- [ ] Freeze `admin-app/` once the player passes in `web/`, then archive it after the beta test run.

## Done when

- With Moodle disabled for the tenant, a worker in `web/` is assigned a course, completes it, and the attempt, score, and completion are stored in PostgreSQL against the course version as knowledge evidence.
- That native knowledge evidence counts toward authorization in `compliance.ts`, shown by an integration test that runs with no Moodle connection configured.
- The ported engine tests and the existing `web/` unit, integration, and browser tests pass in CI.
- No beta workflow needs `admin-app/` to run.
