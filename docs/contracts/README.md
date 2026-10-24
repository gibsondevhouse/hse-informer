# Beta contract register

These contracts govern the [beta](../plans/beta/README.md). They describe required behavior, not regulatory approval or proof of deployment.

| Contract | Contents | State |
|---|---|---|
| [Domain and evidence](domain.md) | Ownership, identifiers, permissions, immutable records | Implementation draft |
| [Identity and Moodle](integrations.md) | Sign-in, launch, enrollment, completion synchronization | Live verification pending |
| [Starter requirements](../requirements/starter-records.md) | Draft HSE course families | UNAPPROVED |

## Decisions fixed for implementation — 2026-10-24

1. `web/` uses SvelteKit, TypeScript, Node, PostgreSQL, and versioned migrations.
2. Every beta course runs in Moodle. Moodle owns course content, learning progress, assessments, scores, attempts, and source completions. Each company has its own Moodle instance; site cohorts are organizational metadata, not tenant security boundaries.
3. Keycloak provides individual accounts with separate clients for HSE Informer and Moodle. Verify account linking and deactivation in both systems.
4. HSE Informer owns profiles, permissions, assignment decisions, completion evidence snapshots, manual records, correction/void history, and exports. Knowledge completion never implies workplace authorization.
5. Keep exact course versions and checksums in evidence. Use append-only corrections; profile changes never rewrite training history. Manual records never impersonate a Moodle attempt.
6. Beta scope is admin controls, user learning, profiles, and completion record management. No vendor import or content connector is a prerequisite or a planned milestone.

## Acceptance gates

| Gate | Required proof | State |
|---|---|---|
| Course review | Reviewer and approval for actual HSE claims; labeled practice content can validate mechanics | Pending |
| Moodle delivery | Mapped course, enrollment, assessment, verified completion time, available score/attempt data, version/reset behavior | Synthetic plumbing only; live pilot pending |
| Identity | HSE/Moodle sign-in, stable mapping, disabled-user behavior, privileged MFA | Pending live verification |
| Isolation | Cross-tenant/site reads, writes, launches, and exports denied | Existing synthetic tests; beta additions require coverage |
| Operations | Staging deployment, recovery, security/accessibility checks, focused participant run | Pending |

Synthetic fixtures must never become real participant evidence. See the [implementation ledger](../refactor-001-progress.md) for historical verification.
