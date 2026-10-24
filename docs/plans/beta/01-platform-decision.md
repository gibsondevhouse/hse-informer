# 01 · Moodle delivery and HSE portal

**Goal:** one administration portal and one course delivery system.

## Decision — 2026-10-24

`web/` (SvelteKit, PostgreSQL, Keycloak) is the HSE portal. Every beta course runs through Moodle. Moodle owns content delivery, learner progress, assessments, scores, attempts, and source completions. HSE Informer manages profiles, assignment decisions, and completion evidence. The React preview is a visual reference, not a second beta delivery path.

## Work

- [ ] Deploy one Moodle instance per pilot company with site cohorts and separate Keycloak clients for HSE Informer and Moodle.
- [ ] Publish an in-house beta course in Moodle with a graded assessment and configured attempt limits.
- [ ] Register immutable course/version/checksum mappings and require review before assignment.
- [ ] Verify user mapping, enrollment, course launch, resume, assessment behavior, completion criteria, and source timestamps against the pinned deployment.
- [ ] Keep enrollment jobs transactional and completion reads idempotent, with retry/drift visibility.
- [ ] Preserve Moodle's source record separately from administrative manual entries, corrections, and voids in HSE Informer.
- [ ] Keep Moodle service credentials server-side and enforce company/site permissions for every request.
- [ ] Run cross-tenant/site tests, including learner launch and completion reads.

## Done when

An administrator assigns a mapped course; the learner launches it in Moodle, resumes, passes its assessment, and the verified completion appears in HSE Informer with exact version, source time, and available score/attempt evidence. No workflow requires the React preview to run. A completion does not grant workplace authorization.

Moodle's standard course-completion REST response lacks a canonical completion timestamp in the pinned synthetic fixture. Do not substitute an activity/criterion time. Verify an authoritative read path before accepting completion evidence; any read-only extension must be reviewed, installed, and included in deployment/recovery coverage without changing Moodle core.
