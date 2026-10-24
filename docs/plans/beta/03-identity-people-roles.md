# 03 · Identity, people, and roles

**Goal:** real people get individual accounts from a roster, and each sees only what their role and sites allow.

## Why

A multi-user test run needs onboarding that doesn't depend on a developer, individual profiles, and explicit account access. Supervisor relationships remain a later-version feature.

## What exists

- Keycloak OIDC login in `web/src/lib/server/auth.ts`, with development realms in `infra/keycloak/`.
- Six roles in `web/migrations/001_foundation.sql`: `tenant_admin`, `site_admin`, `hse_reviewer`, `evaluator`, `learner`, `auditor`.
- Site grants (`principal_site_access`) and cross-tenant tests in CI.

## Work

### Tenant and admin setup

- [x] Add an operator command that creates a tenant, its sites, and the first `tenant_admin`, and sends that admin an invitation. No SQL by hand.
- [x] Add a settings screen where a `tenant_admin` grants roles and sites to other people.
- [x] Log every role and site grant change in `audit_log` with actor, time, before and after values, and reason.

### User profiles

- [x] Create, view, and edit profiles in the UI: name, employee number, contact details, active status, site, department/job, and language preference. Keep `person_id` stable.
- [x] Let a learner view their own profile; restrict role, site, and account-state changes to authorized administrators.
- [x] Audit changes with actor, time, before/after values, and reason for consequential changes. Profile edits never rewrite completed evidence snapshots.
- [x] Link each profile to its assignments and completion history. Deactivation preserves records.

### Accounts

- [x] Create Keycloak accounts from HSE Informer through the Keycloak admin API, mapped by HSE `person_id`.
- [x] Send invitation links with expiry. Workers without company email receive a printed one-time activation code. The account stays disabled until the worker redeems an unexpired code and chooses a password. SMTP and live mail delivery remain deployment gates.
- [x] Disable the Keycloak account when a person is deactivated, reject existing HSE sessions, and queue Moodle suspension with visible synchronization status.
- [x] Add password reset and self-service MFA for administrators, evaluators, and auditors. Require verified MFA claims for those roles. The development realm includes conditional OTP and an AMR mapper; live browser verification remains a deployment gate.

### Roster import

- [x] Define a CSV template: person ID or employee number, name, email or phone, site code, department, job, start date, language, contractor flag. The reserved supervisor column must remain blank until supervisor relationships are supported.
- [x] Build an import with dry run: show new, changed, unchanged, and rejected rows before anything is written. Reject stale previews and imports containing rejected rows.
- [x] Record a site or work change on re-import as an immutable training-context change, visibly pending manual training review. Roster data does not silently become HSE-reviewed applicability evidence. Automated reviewed reevaluation is deferred with advanced applicability workflows.
- [x] Never delete people on import. A missing row is reported, and deactivation is a separate, explicit action.

### Supervisors (later version)

- [ ] Add a reports-to relationship with effective dates.
- [ ] Give supervisors a read-only view of their direct reports' assignments and qualifications. Decide whether supervisor is a new role or a scope on `site_admin`, and record it in the [domain contract](../../contracts/domain.md).

## Done when

- An administrator creates and edits a profile, views its completion history, and deactivates it without losing records.
- A tenant admin is created by the operator command and invites everyone else through the UI.
- A 50-row roster CSV imports with a correct dry run, and re-importing it with one site change creates a visible pending training review. The administrator updates assignments after review.
- A deactivated worker can't sign in.
- Cross-tenant and cross-site tests cover the new screens and the import, and pass in CI.

## Implementation and remaining live verification

`/people` provides profile editing, roster import, account actions, role/site grants, and completion-history links. `npm run tenant:bootstrap -- tenant.json` creates the initial tenant and sends its first administrator's expiring invitation. See [beta identity operations](../../runbooks/beta-identity.md) for configuration, MFA, printed access, and failure handling.

Unit and PostgreSQL integration coverage includes the 50-row roster, unchanged re-import, site-change review, stale previews, tenant/site isolation, self-service restrictions, printed invitation expiry, deactivation, audit secrecy, and successful/failed operator bootstrap. Before admitting real workers, run the live identity browser probe, confirm SMTP delivery, and verify Moodle suspension with the deployed service account.
