# Identity, LMS, content, and migration contracts

**Status:** implementation draft. Function names below are a **candidate allowlist** from Moodle's published [web-service function index](https://docs.moodle.org/dev/Web_service_API_functions). The exact payloads, capabilities, completion fields, and behavior must be checked in the pinned live instance's **Site administration → Server → Web services → API Documentation**, as Moodle [recommends](https://moodledev.io/docs/5.3/apis/subsystems/external). No live integration is claimed here.

## Identity and course launch

Self-hosted Keycloak owns sign-in for workers, including individuals without an employer identity provider. Use an HSE-generated `person_id`, mapped to Keycloak `(issuer, sub)` and the company-specific Moodle user ID. Configure separate OIDC clients for `web/` and each Moodle instance; enable Moodle's built-in OAuth 2 authentication against Keycloak, subject to a live account-linking test. Keycloak may later broker a company's OIDC or SAML provider while preserving the internal person mapping. See [Keycloak's client and brokering guidance](https://www.keycloak.org/docs/26.7.0/server_admin/index.html) and [Moodle's core OAuth 2 service guidance](https://docs.moodle.org/502/en/OAuth_2_services).

The HSE server resolves the authorized company and course mapping, then sends the learner's browser to the known Moodle course URL. Moodle handles the learner session and captures the completion. A return link brings the learner back to HSE Informer for assignments and qualification status. No Moodle service token, Keycloak client secret, direct grade-write payload, or arbitrary browser-selected Moodle URL crosses into client code. Deactivation must disable HSE access and be reconciled with the Moodle account; verify actual Moodle login behavior before launch.

## Moodle interface and boundaries

Each client company has one self-hosted Moodle instance and one server-held service credential. Tifton, Ocilla, and Vernon are site cohorts inside the initial instance. A Moodle instance ID scopes every stored Moodle user, cohort, course, enrollment, activity, and completion ID. HSE Informer never lets a request supply a different instance URL or token.

| Need | Candidate documented function | Verification before use |
|---|---|---|
| Find/provision a mapped user | `core_user_get_users_by_field`, `core_user_create_users` | Exact unique field, OAuth 2 account linking, permissions, duplicate behavior, disabled users. |
| Manage site cohort | `core_cohort_get_cohorts`, `core_cohort_add_cohort_members` | Cohort IDs, site membership changes, and site access behavior. |
| Enroll learner | `enrol_manual_enrol_users` | Manual-enrollment instance/role, idempotent retry, dates and unenrollment effects. |
| Read enrollment | `core_enrol_get_enrolled_users` or `core_enrol_get_users_courses` | Visibility under integration credential and drift detection. |
| Read course/activity completion | `core_completion_get_course_completion_status`, `core_completion_get_activities_completion_status` | Completion criteria, original timestamp, reset/re-enrollment/version behavior. |
| Read SCORM attempts and tracking, if format fits | `mod_scorm_get_scorm_attempt_count`, `mod_scorm_get_scorm_sco_tracks` | Score, attempt and answer-history availability; retain raw source IDs. |

Enable only tested functions and minimum required Moodle capabilities for the service account. Moodle is authoritative for new knowledge completion. There is no generic historical-date completion write in this contract: Moodle's [function index](https://docs.moodle.org/dev/Web_service_API_functions) lists specific completion functions with different purposes, so Gate C must test the chosen importer on the pinned release. Do not call a completion-write function to fabricate learner results. Do not change Moodle core files or directly update its core tables.

The Moodle version target is **5.3 LTS**, with an exact patch/revision pinned only after integration testing. The [5.3 release documentation](https://moodledev.io/docs/5.3) identifies it as LTS. A version label in a deployment manifest alone does not pass the pilot gate.

## DeepHow content intake

Treat the export as an opaque, externally supplied artifact until a real sample is received. Required intake record: DeepHow tenant/content ID, source revision or immutable version identifier, exported-at time, export format, checksum, rights/approval, language and translation revision, and any launch URL or package reference. Record ingestion operator and result. A changed checksum under an existing version ID is a conflict for review; it never silently replaces published content.

Gate A must establish the actual format and launch method. Moodle's native [SCORM FAQ](https://docs.moodle.org/500/en/SCORM_FAQ) says SCORM 1.2 is supported and SCORM 2004 is not fully supported. A synthetic SCORM 1.2 package can prove the plumbing, but it cannot prove DeepHow interoperability. If the real export is an LTI link, video, xAPI/cmi5, or another format, document the supported delivery and authoritative completion source before publishing a course. A staff-reviewed mapping binds a DeepHow revision to one Moodle course/activity and the package checksum. Publishing a new revision creates a new immutable mapping.

## Assignment outbox and reconciliation

An HSE transaction commits the assignment decision and an enrollment outbox message together. The message carries `tenant_id`, `assignment_id`, mapped `person_id`/Moodle user ID, Moodle instance/course ID, idempotency key, creation time, and attempt metadata. A worker retries transient Moodle failures with bounded backoff; permanent mapping/permission errors move to operator review. Replaying the same message cannot create a second open assignment. Log success with the Moodle enrollment evidence returned or read back.

A scheduled job reads Moodle enrollments and completions for each company instance, compares them with assignment decisions and previous snapshots, and reports missing, unexpected, or changed records. It never silently overwrites an older evidence snapshot. Alert on an aged outbox item, completion-read failure, or reconciliation drift; provide an operator-visible retry and resolution trail. Completion arrival alone may set **Knowledge Complete** but cannot create **Authorized / Qualified**.

## HSI field-inventory template

**Awaiting a real HSI export.** The following is a mapping worksheet, not a claim that HSI exposes these fields. For each row, record the literal source file and column, type/example with personal data redacted, conversion, target field, and disposition (`mapped`, `missing`, `requires_review`, `not_applicable`). Never invent a missing date or infer it from an import timestamp.

| Candidate field to investigate | Source file/column | Target or disposition | Required proof |
|---|---|---|---|
| HSI record/completion ID | **TBD from export** | External record mapping | Stable unique key or documented composite key |
| Person/employee ID and aliases | **TBD from export** | `person_id` mapping | Collision and duplicate review |
| Employer, site, department, job/role | **TBD from export** | Historical context snapshot | Values at training time if available |
| Course ID/title and historical content/materials version | **TBD from export** | Course/version mapping | Exact revision or explicit unavailable state |
| Original completion date/time and timezone | **TBD from export** | Historical completion evidence | Full precision and source representation preserved |
| Original expiry/due date | **TBD from export** | Historical validity context | Preserve source value, do not recompute silently |
| Score, attempt, assessment answers, duration, language | **TBD from export** | Knowledge evidence | Field availability and null meanings |
| Trainer/evaluator identity and qualifications | **TBD from export** | Practical/trainer evidence | Source identity and provenance |
| Site procedure/equipment and authorization/restrictions | **TBD from export** | Site/authorization history | Do not fabricate authorization from completion |
| Provider/certificate/materials references | **TBD from export** | External credential/materials evidence | Document location and checksum where available |

Archive the full source export with checksum, extraction timestamp, operator, HSI query/report definition, and record count. Preserve every unmapped row with a reason. The [reconciliation CLI](../../tools/hsi-reconcile/README.md) operates on **normalized CSVs after reviewed mapping**:

| Input | Required normalized CSV columns |
|---|---|
| HSI | `hsi_record_id,tenant_id,site_id,person_id,course_id,completed_at,expires_at` |
| PostgreSQL provenance | HSI columns plus `moodle_completion_id,moodle_user_id,moodle_course_id,source_export_sha256,import_batch_id` |
| Moodle completions | `moodle_completion_id,moodle_user_id,moodle_course_id,completed_at` |

Dates are timezone-aware ISO 8601 timestamps with second precision; `source_export_sha256` is the hash of the untouched original export supplied to the CLI with `--source-archive`. This normalized shape is a **rehearsal interface**, not a proven HSI parser, Moodle importer, or acceptance of a real HSI format. Gate C additionally requires a reviewed one-time Moodle importer, two clean rehearsals, 100% equality of original completion dates and provenance, rollback proof, and HSE signoff. Until then, HSI remains authoritative and read-only cutover is blocked.
