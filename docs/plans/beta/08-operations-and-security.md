# 08 · Operations and security

**Goal:** a deployed staging environment that real people can use for the test run, with backups, monitoring, and basic security and accessibility checks passed.

## Why

`web/` has never been deployed, and the `admin-app/` pilot services are unprovisioned. Training records are legal records, so losing them during a test run would undermine the test. The `admin-app/` README also notes nine production `npm audit` advisories, six of them high.

## Work

### Environments and deployment

- [ ] Choose hosting for the SvelteKit Node server, managed PostgreSQL 16 or newer, Keycloak, and object storage for media and uploads. Record the choice and its cost.
- [ ] Create a staging environment for the test run. Production can wait until after beta.
- [ ] Deploy from CI on merge to `main`, run migrations as a deploy step, and keep a one-command rollback.
- [ ] Store secrets in the host's secret manager. No secrets in the repository or in client bundles.
- [ ] Run the jobs from `web/scripts/` (`run-jobs.ts`, `run-reassignment.ts`) and the reminder job on a schedule.

### Backups and recovery

- [ ] Turn on daily PostgreSQL backups with point-in-time recovery, and back up Keycloak and uploaded files.
- [ ] Run a restore drill into a separate database and check record counts and one evidence packet. Record the result here.

### Monitoring

- [ ] Add error tracking for server and browser errors.
- [ ] Add structured request and job logs with request IDs and no personal data in log messages.
- [ ] Add uptime checks and alerts for failed jobs, failed notifications, and failed deploys, sent to a named person.

### Security

- [ ] Resolve or formally assess every `npm audit` advisory in `web/`. Archive or fix `admin-app/` per [01](01-platform-decision.md).
- [ ] Add rate limiting on sign-in, invitation, and export endpoints.
- [ ] Set security headers (CSP, HSTS, frame options) and secure cookie flags.
- [ ] Run the cross-tenant and cross-site tests against staging, not only in CI.
- [ ] Run a focused self-review against the OWASP Top 10 and record findings. An external penetration test can wait until after beta.
- [ ] Write a short privacy note for test participants: what is collected, who sees it, how long it is kept, and how to ask for deletion.

### Accessibility

- [ ] Run automated accessibility checks (axe) in the Playwright suite for every beta screen.
- [ ] Do a manual keyboard and screen reader pass (NVDA or VoiceOver) on the learner portal, player, assessment, and evaluator checklist. Fix every blocker.

## Done when

- Staging serves the full beta from a CI deploy, and a rollback has been exercised once.
- A restore drill succeeded and is recorded with its date.
- A forced job failure alerts the named person.
- No high advisories remain unassessed, and accessibility checks pass on every beta screen.
