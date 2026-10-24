# Beta identity and people administration

The `/people` screen manages profiles, accounts, role and site grants, roster imports, and links to completion records. Learners can read their own profile and update their contact details and language. Tenant administrators manage account roles; site administrators can manage learner profiles only when every active site membership is in their scope. Deactivation retains the person's stable ID and historical evidence.

## Service configuration

Set the existing OIDC and application session variables plus `KEYCLOAK_ADMIN_CLIENT_ID` and `KEYCLOAK_ADMIN_CLIENT_SECRET` in the server environment. The service client belongs to the same realm as `OIDC_ISSUER`. Give its service account only `realm-management` roles `manage-users`, `view-users`, and `query-users`. Interactive login and direct password grants must be disabled for this client. Keep credentials out of browser bundles and logs.

The development fixture includes `hse-account-admin`, whose secret comes from `HSE_ADMIN_CLIENT_SECRET` in `infra/.env`. Copy that value to the web server's `KEYCLOAK_ADMIN_CLIENT_SECRET`. Configure Keycloak SMTP before using email invitations or password reset. The adapter reports a failed identity-provider request as a failed operation; it never substitutes a successful invitation message.

The realm's user profile must permit workers without email and make `hse_person_id` and `hse_tenant_id` administrator-only attributes. The development realm includes that configuration. Keep identity profile fields under HSE Informer's control to prevent account-console edits from diverging from the personnel record.

## Initial tenant

Copy `web/scripts/tenant.example.json` to a private local file. Set the approved company slug/name, site codes, site time zones, administrator email, and reason. From `web/`, run:

```sh
npm run db:migrate
npm run tenant:bootstrap -- /absolute/path/tenant.json
```

The command creates the tenant, sites, administrator profile, memberships and role grants in one database transaction, creates the Keycloak account with its stable HSE person ID, and asks Keycloak to deliver a 30-minute invitation. It prints IDs and delivery state, never a password or service token. Failed delivery rolls back the new tenant and attempts to delete the new remote identity. A cleanup failure is reported for operator reconciliation before retrying.

## MFA

Every role other than `learner` requires MFA. HSE Informer accepts a verified identity token proving `amr: ["pwd", "otp"]`, password plus hardware authentication, `amr: ["mfa"]`, or a configured numeric assurance level `acr >= 2`. A claim must describe completed authentication; do not add a static mapper that marks every sign-in as MFA. Existing HSE sessions are checked against current role and active profile on every request.

The development realm's browser flow always validates a fresh password and requires OTP when the user has an OTP credential. Its AMR mapper reads the completed password and OTP executions. The synthetic administrator has a development-only OTP seed supplied by `DEV_ADMIN_OTP_SECRET`; ordinary synthetic workers have no OTP credential and may sign in with a password. New privileged accounts require OTP enrollment. If enrollment returns a token without completed MFA, sign in again to complete the OTP challenge. The account-settings link in `/people` opens Keycloak's password and authenticator settings.

This setup follows Keycloak's [authentication flow and AMR documentation](https://www.keycloak.org/docs/26.7.0/server_admin/). Realm imports apply only when the realm is first created; operators must explicitly migrate existing realm configuration.

Validate configuration locally:

```sh
python3 infra/scripts/verify-keycloak-isolation.py --config-only
```

With the development stack running, `web/` dependencies installed, Playwright Chromium installed, and the fixture environment loaded, run:

```sh
node infra/scripts/verify-hse-identity.cjs
```

The browser probe completes real password and OTP challenges, verifies signed ID tokens and exact AMR claims, checks password-only worker login, and proves the account service can read users while being denied client administration. It also creates a temporary technical-identity worker, requires first-login password replacement, verifies the identifier stays unverified without an email challenge, then deletes that test account. It does not print tokens, passwords, or OTP values. Configuration tests do not replace this live probe.

## Workers without email

Create the profile with a phone number and use **Create printed activation code**. Profiles created without email receive a stable technical login identifier of the form `person-uuid@tenant-uuid.login.invalid`, stored in `identity_email` with `identity_email_technical=true`. This identifier links HSE and Moodle accounts; it is not a mailbox or a verified contact address. Contact information remains in `people.email` and `people.phone` and can change without changing the login identifier. Profiles created with a contact email retain that initial address as their stable login email, also separately displayed in account access.

Hand the displayed username, activation-page address, and activation code directly to the worker. HSE stores only the code's SHA-256 digest; the raw code appears only in the response and print screen. `/activate` accepts that code once within 30 minutes, lets the worker choose a password, and then requires ordinary OIDC sign-in, including MFA for privileged roles. The code is never an identity-provider password. Until activation, the Keycloak account and HSE principal are disabled, HSE access is locked, and Moodle suspension is queued. An expired or consumed code cannot set a password or enable the account. Dismiss or close the print screen after handing it over.

Issuing a printed code for an existing account immediately revokes HSE access, disables the Keycloak account, ends its sessions, and queues Moodle suspension until successful activation. Issuing a replacement code invalidates its predecessor. The public redemption endpoint is rate limited. Profile deactivation prevents activation. A failed provider operation leaves the account locked and the code available for retry while it remains unexpired. Email invitations and email password reset are disabled for technical identifiers, even if a contact email is subsequently added. Text-message delivery is not implemented.

Printed activation is an alternative to an email invitation for profiles with a real login email too. It removes the pending password-change and email-verification actions while preserving MFA enrollment requirements. The account's email remains unverified; redemption proves possession of the administrator-issued code, not ownership of that mailbox.

Keycloak leaves technical identifiers unverified and does not require an email-verification action. Moodle receives the same stable identifier and its email notifications are suppressed before enrollment, including for an existing mapped technical account. Live OAuth account linking and delivery suppression still need the deployed integration/browser probe; a successful printed HSE login alone does not prove the worker can launch Moodle.

## Roster and profile changes

Download the CSV template from `/api/people/roster`. Use tenant site codes. A dry run reports new, changed, unchanged and rejected rows, plus existing people absent from the file. Import requires the returned preview hash and revalidates current profiles; a changed file or profile requires another dry run. All rows must pass validation before the import writes anything. Missing rows are never deleted or deactivated.

Site, department, worker-type and job changes create immutable pending training-context review records. Administrators review applicable training and adjust assignments manually in this beta. The roster never changes completed evidence snapshots or claims that an unreviewed applicability input has HSE approval. Supervisor relationships and automated reviewed context reevaluation are later-version work.

## Deactivation and synchronization

Deactivation disables the Keycloak account, ends Keycloak sessions, marks the HSE profile/principals inactive, and queues `moodle_user_state`. The HSE session check immediately denies access after the database commit. The Moodle worker suspends its mapped account and confirms the state. Until its outbox state is `done`, `/people` explicitly shows that Moodle suspension has not been confirmed and an existing Moodle session may still work. Missing or failed Moodle configuration remains visible and retries through the normal outbox. Reactivation queues the current active state through the same path.

If a provider update succeeds but a later database operation fails, reconcile the remote account against the saved personnel state before retrying. The application keeps its database and identity-provider failure visible; it does not claim a distributed transaction across both systems.
