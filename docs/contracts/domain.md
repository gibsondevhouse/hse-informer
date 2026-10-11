# Domain, authorization, and evidence contract

**Status:** implementation draft; regulatory approval pending. See the [contract register](README.md). Tifton, Ocilla, and Vernon are real site labels in the intended rollout, but all fixtures and demonstrations must identify their people and records as synthetic.

## System ownership

| Data | Authoritative owner | HSE Informer handling |
|---|---|---|
| Course content and content revisions | DeepHow | Register immutable source ID, revision, package checksum, effective dates, and the corresponding Moodle course/activity IDs. A replacement is a new mapping, never an update to an old evidence reference. |
| New LMS enrollments, course/activity completion, grades, attempts | The company-specific Moodle instance | Write enrollments through the server; read and snapshot knowledge evidence with Moodle IDs and source timestamps. Detect manual changes by reconciliation. |
| Person, company/site membership, applicability and assignment decisions | HSE Informer PostgreSQL | Version rules and preserve the input snapshot, reason, due date, and triggering event for each decision. |
| Site training, practical checks, external credentials, authorization | HSE Informer PostgreSQL | Keep signed, append-only evidence and explicit restrictions. A Moodle completion cannot write or imply authorization. |
| Historical training before approved cutover | HSI | Preserve HSI as authority. Archive a checksummed export and map records only after a verified import; keep HSI record IDs and original dates. |
| Login credentials and sessions | Self-hosted Keycloak | Persist issuer and subject mappings; never treat email, display name, or mutable employee number as person identity. |
| Confidential medical responses and audiograms | Outside HSE Informer and Moodle | Keep only minimum clearance/fit-test status, effective/expiry dates, issuer, and reference, with restricted access. |

## Stable identifiers and mapping rules

- Generate a UUID `person_id` once in HSE Informer. Every person belongs to exactly one `tenant_id` for v1. A transfer between client companies requires an explicit reviewed identity action; no automatic match on name or email.
- Generate UUID `tenant_id`, `site_id`, `requirement_id`, `requirement_version_id`, `assignment_id`, and `evidence_id`. All rows carrying personal or site evidence carry `tenant_id`; site evidence carries `site_id`.
- Map Keycloak as `(issuer, subject) -> (tenant_id, person_id)`. Keep the issuer so subjects from different realms cannot collide. HSE Informer and Moodle use separate Keycloak clients.
- Map external IDs as `(tenant_id, system, instance_id, external_id) -> internal ID`. The system is `moodle`, `deephow`, `hsi`, or a future connector. Moodle IDs are meaningful only inside the mapped company instance. Keep historical aliases with effective dates instead of overwriting them.
- Map each DeepHow content ID and revision to a Moodle course/activity ID, instance ID, immutable checksum, and approval state. Never infer version from a title.
- Treat `employee_number` and email as optional attributes, not keys. Record their source and validity dates when present.

## Tenant and site permissions

- A company administrator can read and write only rows whose `tenant_id` equals the authenticated tenant. A site administrator is further restricted to explicit site grants. An evaluator also needs a current qualification grant for the relevant checklist and site before signing. A learner sees only their own assignments and evidence.
- Resolve tenant and person from the server-validated Keycloak session. Reject client-supplied tenant/person identifiers that disagree with it. Authorize every query and mutation on the server; hiding a UI control is insufficient.
- The tenant-to-Moodle-instance mapping is one-to-one. Before each Moodle request, resolve the endpoint and credential from server configuration using the authorized `tenant_id`; do not accept a Moodle URL or instance ID from the browser. Tifton, Ocilla, and Vernon are separate cohorts inside the initial company's Moodle instance.
- Deny missing grants by default. Test company-A versus company-B reads, writes, enrollment, course launches, and completion reads, plus site-A versus site-B administration inside a company.
- Log administrative and evaluator mutations with actor `person_id`, tenant, action, target ID, timestamp, and before/after version IDs. Prevent mutation of a published version or captured evidence; use a superseding record for corrections.

## Applicability and assignment decision

Only an **approved** requirement version may create production assignments. Its rule may consider jurisdiction/state plan, establishment and site, work area, employee/contractor status, job and role, task, equipment, chemical/exposure group, written program, permit, emergency posture, and facility status. Missing required input yields `needs_review`, not an assignment to everyone.

For each evaluation, preserve the rule version, matched inputs and their effective dates, decision (`required`, `not_required`, or `needs_review`), decision time, reviewer/actor, and reason. A required decision creates at most one open assignment for `(tenant_id, person_id, requirement_version_id, trigger_id)`. A revised requirement or triggering event creates a new assignment linked to the prior one; it does not rewrite history. Recurrence belongs to this engine, not Moodle course settings.

## Milestones and displayed status

The five positive milestones from [product direction](../vision/phases.txt) are independent evidence states, not a single mutually exclusive column:

| Milestone | Evidence source and transition guard |
|---|---|
| **Knowledge Complete** | Moodle's completion read proves the mapped course/activity, person, exact content version, and source time. The HSE server stores a snapshot; an admin cannot mark it manually. |
| **Site Training Complete** | Approved site addendum/version is delivered and acknowledged for the person's site; store attestations and source time. |
| **Practical Evaluation Passed** | A current qualified evaluator signs a versioned checklist with observed result, scope, and any restrictions. |
| **External Credential Verified** | An authorized verifier records provider, credential type/reference, validity, and evidence checksum. Used only where a requirement needs it. |
| **Authorized / Qualified** | HSE Informer records an explicit decision after all requirement-version prerequisites are current, including any medical/fit-test status and site/practical evidence. Store approver, scope, restrictions, effective and expiry dates. Never derive solely from Moodle completion. |

Administrative assignment labels are separate: `Not started`, `In progress`, `Knowledge Complete`, `Overdue`, `Needs review`, and `Closed`. `Overdue` wins over `Not started` and `In progress` when due date is past and required evidence is incomplete. `Authorized / Qualified` is a separate eligibility result, not a synonym for `Knowledge Complete`. Revocation, expiration, or a new trigger creates a new decision/event; it does not erase past evidence.

## Minimum immutable evidence envelope

Each evidence record carries `evidence_id`, `tenant_id`, `person_id`, `site_id`, `assignment_id` or a documented external origin, `requirement_version_id`, type, source system/instance/source record ID, event time, observed time, recorded time, actor/issuer, schema version, and a content checksum or immutable archive reference. `supersedes_evidence_id` records corrections. Use UTC instants and retain the original source timezone/date representation for migration.

The evidence payload must be able to capture the following when the requirement calls for it:

| Context | Fields to retain |
|---|---|
| Person and assignment | Employer, site, department, job/role at training time; assignment reason, rule/trigger, due date, applicable authority or employer program. |
| Course | DeepHow content ID/version/checksum; Moodle instance, course/activity ID, course version, delivery method, language/translation, start/completion date, duration, score, attempt and retained answer-history reference where available. Missing vendor fields are explicit `unavailable`, never invented. |
| Site instruction | Site addendum/version, procedure/plan version, equipment/process/chemical/space or respirator scope, trainer, delivery and comprehension evidence, employee attestation. |
| Practical and credential | Checklist/version, evaluator identity and qualification/version, result, restrictions, employee/evaluator attestations; or external provider, credential type, validity, and document checksum. |
| Authorization | Decision, scope, prerequisite evidence IDs, approving person, effective/expiry date, restrictions and revocation/supersession reason. |
| Migration | HSI record ID, export file checksum, import batch/operator, original completion and expiry values and timezone, mapped Moodle record ID, reconciliation result. |

Do not store medical questionnaires or audiograms in this evidence store. Clearance status and date may be referenced only when required for an authorization decision. Published course/addendum versions and evidence are append-only; corrections are linked superseding records, and audit packets reproduce the original version and source values.
