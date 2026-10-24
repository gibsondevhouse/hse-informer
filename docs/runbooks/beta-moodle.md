# Beta Moodle delivery and evidence

Moodle delivers every beta course. HSE Informer manages people, assignment decisions, reviewed mappings, and the completion evidence copied from Moodle. A course completion does not grant workplace authorization.

## Configure each company

Use one Moodle instance per tenant. Configure `MOODLE_CONNECTIONS_JSON` on the HSE server with its tenant UUID, stable instance UUID, HTTPS base URL, dedicated service token, learner role ID, and tested external authentication method. Keep the token out of browser pages and source control. Site cohort mappings and active worker identity mappings belong to that instance.

Install [the HSE evidence and sign-out plugin](../../integrations/moodle-local/hse_evidence/README.md) in Moodle's `public/local/hse_evidence` directory and run Moodle's supported upgrade command. Add its declared `local_hse_evidence_get_completion` and `local_hse_evidence_end_user_sessions` functions to the HSE external service, then set that connection's `completionEvidence` to `local_hse_evidence`. Completion evidence is read-only; ending worker sessions is an explicitly authorized authentication-state write. This adds a local extension while leaving Moodle core unmodified.

The service needs the tested core user lookup/provisioning, enrollment, cohort, completion, and relevant SCORM functions listed in `web/src/lib/server/moodle.ts`. Course verification uses `core_course_get_courses_by_field`. Account deactivation uses `core_user_update_users` and reads the suspension state back. The evidence plugin enforces `report/completion:view` and `moodle/grade:viewall` in the course, active enrollment, and Moodle context/group checks. Grant capabilities to the dedicated service role at the narrowest working contexts; test each call using that actual role rather than an administrator token.

For coordinated sign-out, explicitly grant the dedicated role `local/hse_evidence:endsessions` at system context. HSE resolves only its authenticated person's validated Moodle mapping, ends that worker's Moodle sessions through the supported session manager, and performs identity-provider logout. Privileged Moodle targets are rejected. Clearing the HSE cookie alone is not an end-to-end sign-out result; verify the previously open Moodle tab and the identity-provider session in a real browser.

Core Moodle's course-completion response exposes criterion timestamps without the canonical course time. The plugin reads the existing `completion_completion` record through Moodle's completion API. Missing plugins, permissions, identity mismatches, or invalid timestamps fail reconciliation; HSE never substitutes the synchronization time. Course grades are numeric course totals normalized to percentages, not an assertion about a particular quiz. [Moodle completion service source](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/completion/classes/external.php), [canonical completion API](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/completion/completion_completion.php).

## Publish a version

1. Author or upload the course in Moodle and configure its assessment, pass mark, attempt limit, remediation, resume behavior, and automatic course-completion criteria. For assessments whose answer keys must remain on the server, use Moodle's server assessment facilities; a self-contained SCORM package contains its own browser code and data.
2. Retain the reviewed package/content archive and its SHA-256. Create a distinct Moodle course for a revised version, preserving the original course for its pinned assignments.
3. In HSE **Courses**, add the source content ID, exact version, checksum, language, requirement, and Moodle IDs. New mappings are drafts. Practice content is explicitly labeled and uses a separate practice requirement.
4. A named HSE reviewer approves real content and its requirement. A tenant administrator may publish practice content. Test actual fail, retry, attempt exhaustion, remediation, resume on another device, pass, and synchronization; record the configuration and evidence location using **Verify Moodle completion**. The server additionally inspects the mapped Moodle course and requires visible content and enabled completion tracking.
5. Publish the mapping and assign it through HSE. Retire obsolete mappings to prevent new assignments while retaining their existing records. Changes to published content or verification require a new version.

Run `npm run jobs:run` regularly and monitor failures, stalled jobs, and completion drift. The learner's **Sync completion status** queues a reconciliation request; scheduled workers perform the read. Completion timestamps, identity/site/course snapshots, and raw source evidence are append-only. Corrections and voids use the completion record workflow.

## Establish the learner's real Moodle login

Creating a Moodle user with `auth=oauth2` does not itself create an OAuth linked login. The repository's Keycloak accounts and Moodle provisioning also use different generated usernames, and development realms have different subjects. Neither username similarity nor a shared email is proof of the intended identity link.

For workers with real email, configure Moodle's core OAuth 2 service for the correct tenant's trusted issuer and exact callback, enable OAuth authentication, and test the linked login in the browser. Moodle supports first-login account creation or linking to an existing account with the same email, according to issuer confirmation policy. Verify the actual Linked logins entry before using the account. [Moodle OAuth authentication](https://docs.moodle.org/503/en/OAuth_2_authentication), [issuer configuration](https://docs.moodle.org/503/en/OAuth_2_services).

A supported administrative alternative to assuming REST provisioning linked the account is:

1. Have the worker complete a real first login through the intended company's issuer, following the configured confirmation flow.
2. In Moodle administration, confirm that account's linked login and identity. Set its **ID number** to the exact HSE-generated `people.hse_id`; do not substitute a person's row UUID or a subject from another realm.
3. Confirm that ID number occurs only once on this Moodle instance. Retry the HSE enrollment job. The existing core user lookup discovers this explicit ID number and stores the resulting tenant/instance-scoped external ID mapping.
4. Demonstrate the same worker opening the assigned course, and a worker from the other tenant being denied access. Keep the evidence with the beta test run.

This procedure is a documented setup path, not a claim that browser linking has passed on the deployment.

## Workers without email

HSE can issue printed credentials without a contact email. Moodle 5.3 rejects OAuth user information without a username and email before looking up linked logins, so printed credentials alone do not establish the Moodle path. [OAuth implementation](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/auth/oauth2/classes/auth.php).

The beta identity path retains an explicitly managed, unique technical login address per person separately from contact information and supplies it consistently to Keycloak and Moodle. It is a login identifier, not the worker's mailbox, and remains email-unverified. Contact email stays blank. Printed/admin workflows handle invitations and password recovery; email actions reject technical addresses. Profile synchronization preserves the separate identifier.

The adapter sets `emailstop=1` through `core_user_update_user_preferences` before technical accounts are enrolled, then requires `core_message_get_user_notification_preferences` to confirm the same user's `disableall=1`. The dedicated service role needs `moodle/user:editmessageprofile` for those users. A silent permission no-op fails enrollment. Account creation sets `createpassword=0` and does not request a password email. [Moodle user service](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/user/externallib.php), [notification preference readback](https://github.com/moodle/moodle/blob/MOODLE_503_STABLE/public/message/classes/output/preferences/notification_list.php).

Before releasing this path, lock the technical identifier against user edits, review the trusted issuer's confirmation policy so it does not send confirmation mail to that identifier, and demonstrate the complete phone-only sign-in, recovery, and no-mail behavior on the deployed Keycloak/Moodle pair. Do not mark a technical address verified merely to bypass confirmation. Mocked provisioning tests do not prove those deployment settings.

## Verification still required on the deployed stack

Local PostgreSQL integration tests prove mapping review, version immutability, canonical response validation, copied completion snapshots, and repeat synchronization. The disposable Compose stack mounts the evidence plugin and its SCORM read verifier checks canonical identity, time, and repeat-read stability. PHP/Moodle plugin tests must run in the exact Moodle installation; a mocked adapter test does not prove plugin execution or OAuth sign-in.

Beta acceptance still requires the real tenant service role, browser account linking, phone-only identity solution, failure/retry/pass and cross-device behavior, account suspension terminating an existing Moodle session, another tenant's access denial, and retained completion evidence after a new course version. No live training claim follows from the synthetic SCORM probe.
