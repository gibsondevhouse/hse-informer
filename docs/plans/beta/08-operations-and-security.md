# 08 · Operations and security

> **Focused beta scope — 2026-10-24:** Apply deployment, recovery, security, and accessibility work to the core screens in the beta README. Moodle synchronization/cron and their failure alerts are required. Automated reminder/notification workflows remain deferred. Moodle, its course files, PostgreSQL, and Keycloak need recovery coverage.

**Goal:** a deployed staging environment that real people can use for the test run, with backups, monitoring, and basic security and accessibility checks passed.

## Why

The production images and private stack now start successfully in CI. The owner chose company IT to provide hosting on 2026-10-24; the specific environment, cost and operating owners remain unconfirmed. The [IT handoff](../../runbooks/beta-it-handoff.md) lists what that team needs to supply. Completion history must survive recovery. `admin-app/` remains a visual reference outside the deployed beta image, and its legacy dependency advisories do not describe the `web/` production dependency set.

## Work

### Environments and deployment

- [x] Confirm hosting responsibility: company IT, selected by the owner on 2026-10-24.
- [ ] Confirm IT's actual environment for the SvelteKit Node server, managed PostgreSQL 16 or newer, Keycloak, Moodle, and object storage for media and uploads. Record the topology, operating owners and cost.
- [ ] Create a staging environment for the test run. Production can wait until after beta.
- [ ] Deploy from CI on merge to `main`, run migrations as a deploy step, and keep a one-command rollback.
- [ ] Store secrets in the host's secret manager. No secrets in the repository or in client bundles.
- [ ] Schedule Moodle enrollment, completion reconciliation, and account-state jobs with failure alerts. Advanced reassignment and reminder automation remain deferred by the focused beta scope.

### Backups and recovery

- [ ] Turn on daily PostgreSQL backups with point-in-time recovery, and back up Keycloak, Moodle databases/course files, installed extensions, and uploaded files.
- [ ] Run a restore drill into a separate database and check record counts and one evidence packet. Record the result here.

**Synthetic recovery evidence — 2026-10-24:** [CI run 40132126260](https://github.com/gibsondevhouse/hse-informer/actions/runs/40132126260) passed an encrypted restore into a separate private environment. It verified HSE, Keycloak, and Moodle table counts; 37 HSE tables and the evidence/amendment/audit digest; Moodle code/data and upload paths, content, modes, and owners; restored credentials and Moodle file access; and healthy recovered services. Both private environments and their ephemeral archive/key were removed. This closes the automated rehearsal, while offsite storage, independent key retrieval, the chosen host, and a measured live recovery window remain open.

### Monitoring

- [ ] Add error tracking for server and browser errors.
- [ ] Add structured request and job logs with request IDs and no personal data in log messages.
- [ ] Add uptime checks and alerts for failed jobs, failed notifications, and failed deploys, sent to a named person.

### Security

- [ ] Resolve or formally assess every `npm audit` advisory in `web/`. Archive or fix `admin-app/` per [01](01-platform-decision.md).
- [ ] Add rate limiting on sign-in, invitation, and export endpoints.
- [ ] Set security headers (CSP, HSTS, frame options) and secure cookie flags.
- [ ] Run the cross-tenant and cross-site tests against staging, not only in CI.
- [x] Run a focused self-review against the OWASP Top 10 and record findings: [review and disposition](../../runbooks/beta-security-review.md). Final-commit automated checks and live release gates remain explicit in that record. An external penetration test can wait until after beta.
- [ ] Write a short privacy note for test participants: what is collected, who sees it, how long it is kept, and how to ask for deletion.

### Accessibility

- [ ] Run automated accessibility checks (axe) in the Playwright suite for every beta screen; retain findings and any narrowly verified dispositions in the [accessibility evidence record](../../runbooks/beta-accessibility.md).
- [ ] Do a manual keyboard and screen-reader pass (NVDA or VoiceOver) on the beta learner portal, profiles, administrative records, and Moodle lessons/assessment. Fix every blocker. Evaluator workflows are deferred.

## Done when

- Staging serves the full beta from a CI deploy, and a rollback has been exercised once.
- A restore drill succeeded and is recorded with its date.
- A forced job failure alerts the named person.
- No high advisories remain unassessed, and accessibility checks pass on every beta screen.
