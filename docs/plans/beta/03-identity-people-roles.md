# 03 · Identity, people, and roles

**Goal:** real people get individual accounts from a roster, and each sees only what their role and sites allow.

## Why

Today people come from a synthetic seed, the first admin is added by SQL, and there is no supervisor relationship. A multi-user test run needs onboarding that doesn't depend on a developer, and a manager view needs to know who reports to whom.

## What exists

- Keycloak OIDC login in `web/src/lib/server/auth.ts`, with development realms in `infra/keycloak/`.
- Six roles in `web/migrations/001_foundation.sql`: `tenant_admin`, `site_admin`, `hse_reviewer`, `evaluator`, `learner`, `auditor`.
- Site grants (`principal_site_access`) and cross-tenant tests in CI.

## Work

### Tenant and admin setup

- [ ] Add an operator command that creates a tenant, its sites, and the first `tenant_admin`, and sends that admin an invitation. No SQL by hand.
- [ ] Add a settings screen where a `tenant_admin` grants roles and sites to other people.
- [ ] Log every role and site grant change in `audit_log` with actor, time, before and after values, and reason.

### Accounts

- [ ] Create Keycloak accounts from HSE Informer through the Keycloak admin API, mapped by HSE `person_id`.
- [ ] Send invitation links with expiry. Support workers without company email by using a phone number or a printed one-time code.
- [ ] Disable the Keycloak account when a person is deactivated, and check that their session stops working.
- [ ] Add password reset and self-service MFA for administrators, evaluators, and auditors. Require MFA for those roles.

### Roster import

- [ ] Define a CSV template: person ID or employee number, name, email or phone, site, department, job or role, supervisor, start date, language, contractor flag.
- [ ] Build an import with dry run: show new, changed, unchanged, and rejected rows before anything is written.
- [ ] Treat a site or role change on re-import as a training-context change, so the reassignment engine in `web/src/lib/server/reassignment.ts` runs.
- [ ] Never delete people on import. A missing row is reported, and deactivation is a separate, explicit action.

### Supervisors

- [ ] Add a reports-to relationship with effective dates.
- [ ] Give supervisors a read-only view of their direct reports' assignments and qualifications. Decide whether supervisor is a new role or a scope on `site_admin`, and record it in the [domain contract](../../contracts/domain.md).

## Done when

- A tenant admin is created by the operator command and invites everyone else through the UI.
- A 50-row roster CSV imports with a correct dry run, and re-importing it with one site change triggers the right reassignment.
- A deactivated worker can't sign in.
- Cross-tenant and cross-site tests cover the new screens and the import, and pass in CI.
