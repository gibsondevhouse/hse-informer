# Identity and Moodle contracts

**Status:** implementation draft. Function names below are a **candidate allowlist** from Moodle's published [web-service function index](https://docs.moodle.org/dev/Web_service_API_functions). The exact payloads, capabilities, completion fields, and behavior must be checked in the pinned live instance's **Site administration → Server → Web services → API Documentation**, as Moodle [recommends](https://moodledev.io/docs/5.3/apis/subsystems/external). No live integration is claimed here.

## Identity and course launch

Self-hosted Keycloak owns sign-in for workers, including individuals without an employer identity provider. Use an HSE-generated `person_id`, mapped to Keycloak `(issuer, sub)` and the company-specific Moodle user ID. Configure separate OIDC clients for `web/` and each Moodle instance; enable Moodle's built-in OAuth 2 authentication against Keycloak, subject to a live account-linking test. Keycloak may later broker a company's OIDC or SAML provider while preserving the internal person mapping. See [Keycloak's client and brokering guidance](https://www.keycloak.org/docs/26.7.0/server_admin/index.html) and [Moodle's core OAuth 2 service guidance](https://docs.moodle.org/502/en/OAuth_2_services).

The HSE server resolves the authorized company and course mapping, then sends the learner's browser to the known Moodle course URL. Moodle handles the learner session and captures the completion. A return link brings the learner back to HSE Informer for assignments and qualification status. No Moodle service token, Keycloak client secret, direct grade-write payload, or arbitrary browser-selected Moodle URL crosses into client code. Deactivation must disable HSE access and be reconciled with the Moodle account; verify actual Moodle login behavior before launch.

## Moodle interface and boundaries

Each client company has one self-hosted Moodle instance and one server-held service credential. Tifton, Ocilla, and Vernon are site cohorts inside the initial instance. A Moodle instance ID scopes every stored Moodle user, cohort, course, enrollment, activity, and completion ID. HSE Informer never lets a request supply a different instance URL or token.

| Need | Candidate documented function | Verification before use |
|---|---|---|
| Find/provision a mapped user | `core_user_get_users_by_field`, `core_user_create_users` | Exact unique field, OAuth 2 account linking, permissions, duplicate behavior, disabled users. |
| Manage site cohort | `core_cohort_create_cohorts`, `core_cohort_get_cohorts`, `core_cohort_add_cohort_members`, `core_cohort_get_cohort_members` | Cohort IDs, site membership changes, and site access behavior. |
| Enroll learner | `enrol_manual_enrol_users` | Manual-enrollment instance/role, idempotent retry, dates and unenrollment effects. |
| Read enrollment | `core_enrol_get_enrolled_users` or `core_enrol_get_users_courses` | Visibility under integration credential and drift detection. |
| Read course/activity completion | `core_completion_get_course_completion_status`, `core_completion_get_activities_completion_status` | Completion criteria, original timestamp, reset/re-enrollment/version behavior. |
| Read SCORM attempts and tracking, if format fits | `mod_scorm_get_scorm_attempt_count`, `mod_scorm_get_scorm_scoes`, `mod_scorm_get_scorm_sco_tracks` | Score, attempt and answer-history availability; retain raw source IDs. |

Enable only tested functions and minimum required Moodle capabilities for the service account. Moodle is authoritative for new knowledge completion. Do not call a completion-write function to fabricate learner results. Do not change Moodle core files or directly update its core tables.

The Moodle version target is **5.3 LTS**. The disposable CI fixture pins **5.3.0** by archive checksum and exercises synthetic account, cohort, enrollment, and SCORM reads. The [5.3 release documentation](https://moodledev.io/docs/5.3) identifies the series as LTS. That fixture does not accept 5.3.0 as the live pilot patch; the exact deployment revision and its behavior still need Gate B verification.

## Assignment outbox and reconciliation

An HSE transaction commits the assignment decision and an enrollment outbox message together. The message carries `tenant_id`, `assignment_id`, mapped `person_id`/Moodle user ID, Moodle instance/course ID, idempotency key, creation time, and attempt metadata. A worker retries transient Moodle failures with bounded backoff; permanent mapping/permission errors move to operator review. Replaying the same message cannot create a second open assignment. Log success with the Moodle enrollment evidence returned or read back.

The reconciliation job checks expected Moodle enrollments and completions against assignment decisions and previous snapshots, reporting missing or changed records. It does not yet enumerate unexpected manual enrollments. It never silently overwrites an older evidence snapshot. A deployment must schedule the job, alert on aged outbox items, completion-read failures and drift, and provide an operator-visible retry and resolution trail. A verified completion with an authoritative source time may set **Knowledge Complete** but cannot create **Authorized / Qualified**. The synthetic 5.3.0 course-completion response lacked a canonical course timestamp, so the current adapter records SCORM activity/criterion observations for review without promoting them to knowledge evidence.

## Administrative completion records

Administrators may record a clearly labeled manual completion with provenance. Manual entry is not a Moodle assessment attempt and never changes Moodle grades. Corrections and voids append linked records with actor, time, and reason; preserve original evidence and show effective state separately. Profile edits retain stable person IDs and historical snapshots. See the [domain contract](domain.md).
