# 01 · Platform decision

**Goal:** one application stack and one course delivery path for beta.

## Why

The repository has two partial products. `admin-app/` (React/Vinext, Cloudflare D1 and Access) holds the course player, the 34 block types, assessment scoring, attempt limits, and the PBJ presentation. `web/` (SvelteKit, PostgreSQL, Keycloak) holds the compliance data model, tenant isolation, reassignment, and the Moodle adapter, but its learner side is a draft preview. Every feature below would otherwise be built twice or built in the wrong place.

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
- [ ] Move learner progress and assessment attempts from browser storage to PostgreSQL tables tied to the assignment and the exact course version.
- [ ] Add a course package table (course ID, version, checksum, block content as JSON) so courses are data, not TypeScript modules.
- [ ] Port the PBJ-101 sandbox package to prove the path end to end.
- [ ] Keep the Moodle adapter and outbox code behind a disabled per-tenant setting rather than deleting it.
- [ ] Freeze `admin-app/` once the player passes in `web/`, then archive it after the beta test run.

## Done when

- A worker in `web/` opens an assigned course, completes it, and the attempt, score, and completion are stored in PostgreSQL against the course version.
- The ported engine tests and the existing `web/` unit, integration, and browser tests pass in CI.
- No beta workflow needs `admin-app/` to run.
