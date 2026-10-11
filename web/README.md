# HSE Informer web

Svelte 5 and SvelteKit 3 application with a Node adapter and a PostgreSQL record store. This is an implementation foundation for [Refactor 001](../docs/refactor-001.md). The five starter requirements and all bundled people/assignments are **synthetic and unapproved**. A synthetic completion or preview lesson is never production evidence.

## Local setup

Use Node.js 22.17 or later and PostgreSQL. Copy `.env.example` to a local `.env` and set `DATABASE_URL`. On this Mac, Homebrew PostgreSQL 16 tools are under `/opt/homebrew/opt/postgresql@16/bin/` even though `psql` is not on `PATH`. PostgreSQL 16 suffices for the HSE schema; the separate Moodle 5.3 fixture in [`infra/`](../infra/README.md) requires PostgreSQL 17 and Docker Compose.

```sh
cd web
npm ci
/opt/homebrew/opt/postgresql@16/bin/createdb hse_informer_refactor_dev
DATABASE_URL=postgres://localhost:5432/hse_informer_refactor_dev npm run db:migrate
DATABASE_URL=postgres://localhost:5432/hse_informer_refactor_dev npm run db:seed:synthetic
DATABASE_URL=postgres://localhost:5432/hse_informer_refactor_dev DEV_AUTH=synthetic npm run dev
```

`DEV_AUTH=synthetic` signs in as the seeded synthetic Company A administrator for a local UI preview. It is blocked when `NODE_ENV=production`. Remove it to test actual Keycloak sign-in. The development realm in `infra/` uses issuer `http://auth.localhost:8080/realms/hse-dev`, HSE client `hse-web`, and callback `http://localhost:5173/auth/callback`. Set `APP_ORIGIN`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and a 32-character or longer `SESSION_SECRET` server-side. The seeded realm subjects map a Company A administrator and Company A/B workers by **issuer plus subject**; an ambiguous mapping is rejected. The Moodle instances have separate OIDC clients.

Site records have an optional IANA `time_zone`. The synthetic sites explicitly use `America/New_York`; the admin form refuses a new deadline when the site's time zone is missing. A selected date ends at 23:59:59 in that site, including across daylight-saving changes. Real site time zones must be confirmed before date-based scheduling.

The versioned SQL migrator runs each file in `migrations/` once in a transaction. Use a fresh isolated database when re-running a changed development migration; never run the synthetic seed against real data. The seed is also blocked in production.

## Commands

| Command | Purpose |
|---|---|
| `npm run check` | TypeScript and Svelte checks |
| `npm test` | Applicability/status and mocked Moodle service tests |
| `npm run test:integration` | PostgreSQL tenant isolation, immutable evidence, attestation, and reassignment tests; requires `TEST_DATABASE_URL` pointing to a migrated disposable database |
| `npm run test:e2e` | Chromium checks for admin preview parity, cross-browser PostgreSQL persistence, measured learner pagination, and read-only draft lesson behavior; requires a migrated and synthetic-seeded `DATABASE_URL` and Playwright Chromium |
| `npm run build` | Build the Node server with `adapter-node` |
| `npm run db:migrate` | Apply numbered migrations using `DATABASE_URL` |
| `npm run db:seed:synthetic` | Add clearly labeled demonstration tenants and unapproved drafts |
| `npm run jobs:run` | Drain at most 100 due Moodle outbox jobs |
| `npm run jobs:run -- --reconcile` | Queue reconciliation of active non-synthetic assignments, then drain jobs |
| `npm run jobs:reassignment -- --tenant-id UUID` | Process due reviewed change events and recurrence decisions for one tenant; optional `--as-of ISO`, `--limit 1..500`, and `--lead-days 0..90` (default 30) |

The outbox keeps failed enrollment and completion reads for retry. The reconciliation job checks expected enrollments and flags deleted or changed completion evidence without altering the original record. It clears enrollment and completion drift only after a verified recovery. An open completion drift makes current knowledge status **Needs review** (or **Overdue** when the due date has passed) and prevents authorization, even while the old evidence remains in the audit packet. It does **not yet enumerate extra manual Moodle enrollments**, so that part of the integration contract remains open. Run the job on a scheduler in a deployed environment and alert on failed or aged jobs and unresolved `integration_drifts`; tenant administrators can inspect these through `GET /api/integration-health`.

An HSE reviewer can record an append-only person context and change event, then process its affected site audience. Missing or invalid context becomes an immutable **needs review** decision; a matching approved rule creates a new assignment, linked supersession, audit entry, and Moodle enrollment outbox item in one transaction. The recurrence runner starts the next assignment up to 30 days before the exact UTC anniversary of a verified knowledge completion. Its lead window is configurable; the UTC anniversary and operational window are provisional until an HSE reviewer approves site-local policy. Replaying a stable trigger cannot duplicate an assignment. Reconciliation drift and invalid current configuration block reassignment and create review records. A reviewer must explicitly reprocess an event after adding context to resolve an earlier **needs review** result; the scheduled runner scans unprocessed events. Run and monitor `jobs:reassignment` through operations or cron before relying on automation. `GET /api/integration-health` also counts unresolved event failures.

`MOODLE_CONNECTIONS_JSON` is a server-only JSON object keyed by tenant UUID. Each connection requires a stable UUID `instanceId`, `baseUrl`, a dedicated web-service `token`, and numeric `learnerRoleId`. The same instance ID or base URL cannot serve two tenants. `instanceId` is stored in `person_external_ids.instance_key` and `site_moodle_cohorts.instance_key`, so a later URL change does not orphan mappings. An operator must map each site to its actual Moodle cohort ID in `site_moodle_cohorts` for that same instance ID before enrollment; the job fails and retries when the mapping is absent. Its cohort membership call precedes manual course enrollment. These mappings and service permissions still require verification against the pinned installation.

User provisioning additionally needs an explicit, **verified** Moodle `authMethod` and a worker email; accounts without email require a reviewed provisioning path. The adapter uses documented REST web services to look up users by HSE ID, optionally create users, enroll them, read course completion, and check enrollment. It fails closed on duplicate HSE IDs or ambiguous active IDs for an instance. Historical HSI aliases can coexist for a person; superseded mappings stay in the database. Tokens and credentials never go to the browser.

Moodle 5.3's `core_completion_get_course_completion_status` reports whether course criteria are complete and timestamps for individual criteria, but **does not provide a canonical course completion timestamp**. The adapter does not treat a criterion timestamp as course completion, so its live response has `completedAt: null`. `course_versions.completion_criteria_verified` is a reserved gate for a reviewed course and SCORM success policy; setting it alone does not overcome the missing timestamp. The reconciliation job records `completion_timestamp_unverified` and does not create knowledge evidence from this response. A documented, tested exact activity completion read or equivalent canonical source, mapped to the pinned `moodle_activity_id` and course version, is required before this gate can pass. Score remains `null`; SCORM `attemptscount` is read only when configured. These live behaviors remain unverified until the pinned Moodle fixture and real export are tested.

## Server routes

| Route | Purpose |
|---|---|
| `/auth/login`, `/auth/callback`, `/auth/logout` | OIDC authorization code flow and signed session |
| `GET /api/me`, `/api/sites`, `/api/people`, `/api/requirements` | Tenant and role scoped context |
| `GET /api/assignments`, `POST /api/assignments`, `PATCH /api/assignments/:id` | Assignment list, approved assignment creation, audited due date edit |
| `GET /api/summary` | Counts, courses, and sites; knowledge completion and authorization are independent |
| `GET /api/integration-health` | Tenant-scoped failed or aged outbox jobs, unresolved drift, and reassignment failure counts for administrators |
| `POST /api/training-contexts`, `POST /api/reassignment-events` | HSE-reviewed person context and site change-event records |
| `POST /api/reassignment-events/:id/process` | Re-evaluate an effective event after reviewed context changes |
| `POST /api/site-training`, `POST /api/practical-evaluations` | Administrative site record and qualified evaluator signoff |
| `GET /api/attestations/targets/:kind/:id`, `POST /api/attestations` | Assigned worker reviews and acknowledges the exact site or practical record |
| `POST /api/authorizations`, `GET /api/audit/:personId/:requirementId` | Separate prerequisite-checked decision and immutable evidence packet, including reassignment decisions |

Cookie-authenticated writes require a matching `Origin`. Learners see only their own people/assignments and member sites. Site administrators and evaluators are site scoped. An assignment requires an HSE-approved requirement version and an approved Moodle course mapping; draft records stay visible for planning but cannot be issued by the API. Synthetic people cannot be assigned in a non-synthetic tenant or sent to Moodle. An authorization requires approved prerequisites and separately authenticated employee acknowledgement where site or practical evidence is required. Published version content and evidence records cannot be edited or deleted.

The draft Respiratory Protection lesson at `/preview/respiratory-protection` is restricted to HSE reviewers and tenant administrators. It measures and packs lesson blocks into the available reading area, including smaller viewports; page navigation waits for reflow before advancing a section. Its interaction state is in memory; only the theme preference uses device storage. The preview cannot create a Moodle completion, assignment, evidence record, or authorization.

## Pending live gates

- A qualified HSE reviewer and owner must approve regulatory content, applicability, recurrence, addenda, and course mappings.
- A real DeepHow export and exact format are needed for Gate A. The synthetic SCORM package under `infra/` tests plumbing only.
- Moodle 5.3.0 is pinned in `infra/`, but its web-service payloads/permissions, Keycloak account linking, site cohorts, exact completion timing, score/attempt behavior, and two-instance isolation still need a running Moodle/Keycloak fixture and a real pilot for Gate B. Docker is unavailable on this machine. Current course-completion reads intentionally stop at review drift because the response lacks a canonical timestamp.
- Reviewed context entry is API-only; a production event source, scheduled invocation and alerting, approved site-local recurrence policy, manual-enrollment discovery, full Phase 2 browser parity, and Phase 3 practical flow demonstration remain unfinished. The tested runner is a foundation, not an approved live reassignment service.
- A real HSI sample, a reviewed one-time Moodle importer, row-by-row reconciliations, two clean rehearsals, and HSE signoff are needed for Gate C. HSI remains authoritative for historical records; no cutover or production deployment is authorized by this foundation.
