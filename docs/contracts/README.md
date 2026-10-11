# Refactor 001: contract register

These contracts implement the documentation portion of [Refactor 001](../refactor-001.md). They are design inputs for the synthetic pilot, **not regulatory approval or evidence of a live integration**.

| Contract | Contents | State |
|---|---|---|
| [Domain and evidence](domain.md) | Ownership, identifiers, tenant permissions, applicability, status transitions, immutable evidence | Draft for implementation; HSE review pending |
| [Integrations and migration](integrations.md) | Keycloak, Moodle, DeepHow, outbox/reconciliation, HSI field-inventory template | Draft; live verification pending |
| [Five starter requirements](../requirements/starter-records.md) | The preview's five course families with proposed assignment inputs and evidence | **UNAPPROVED**; disabled for production assignment |

## Decisions fixed for implementation

1. The replacement lives in `web/`: Svelte 5, SvelteKit, TypeScript, Node adapter, PostgreSQL, versioned migrations. A minimal server and schema are Phase 1 prerequisites, not Phase 2 tasks.
2. Each client company gets a separate self-hosted Moodle instance. Site cohorts within that instance represent Tifton, Ocilla, and Vernon for the initial company. Cohort membership is organizational metadata, not a tenant security boundary.
3. Self-hosted Keycloak issues individual worker accounts, including workers without company logins. HSE Informer and Moodle are separate OIDC clients; later company federation may be configured without changing HSE person IDs.
4. Learners launch a branded Moodle course page from HSE Informer. Moodle records new enrollment and knowledge completion; HSE Informer records assignment, recurrence, site/practical evidence, and authorization. The browser never receives Moodle service credentials.
5. A reviewed one-time historical importer may be deployed as an isolated Moodle extension if needed. Moodle core files and core tables are never edited directly. The importer remains unusable for cutover until it preserves original HSI dates and passes reconciliation.

## Gates and current evidence

| Gate | Proof required | Current state |
|---|---|---|
| HSE approval | Named qualified reviewer approves each authority, legal-status label, applicability/recurrence rule, and course claim | **Pending**; no reviewer named |
| DeepHow delivery | Real export, format, version ID, checksum, and replayed package/launch test | **Pending**; no export supplied |
| Moodle pilot | Exact 5.3 LTS patch pinned and tested for account creation, site cohorts, enrollment, completion/score/attempt reads, version replacement, and cross-company isolation | **Pending**. CI runs two disposable Moodle 5.3.0 instances and verifies synthetic provisioning, cohorts, enrollment, SCORM tracking, and service-token isolation. The real DeepHow course, version/reset behavior, learner UI isolation, and live patch acceptance are unverified. |
| Identity | Keycloak-to-HSE and Keycloak-to-Moodle login, user mapping, and disabled-user behavior tested | **Pending**. CI checks synthetic realm and issuer isolation; Moodle browser account linking and disabled-user behavior remain unverified. |
| HSI inventory | Every mapped field traced to a real HSI export column, including dates, provenance and unmapped cases | **Pending**; [template only](integrations.md#hsi-field-inventory-template) |
| HSI cutover | Reviewed importer, two clean full reconciliations, 100% original date/provenance equality, rollback rehearsal, HSE signoff | **Blocked** until real export and Moodle are available |
| Production launch | Security/isolation tests and regulatory, licensing, trademark, operational reviews | **Pending** |

No checked box or passing synthetic test substitutes for one of these live proofs. The fictional React preview records must never enter production tables, exports, or audit packets.
