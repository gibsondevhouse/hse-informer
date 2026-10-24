# 05 · Admin and completion record management

**Implementation:** UI/API and synthetic verification are complete; live beta acceptance remains open.

**Goal:** administrators control assignments and maintain accurate completion records through the UI.

## Assignments

- [x] Create individual and bulk assignments with recipient review, an explicitly selected published course version, reason, and due date. Save the reviewed version without substituting a newer mapping; reject retired, stale or mismatched selections.
- [x] Edit deadlines, cancel, and reassign with a mandatory reason and audit history; prevent duplicate open assignments.
- [x] Show not started, progress not confirmed, in progress, Knowledge Complete, due soon and overdue separately from workplace qualification. Moodle source activity establishes progress; enrollment alone does not.

## Completion records

- [x] Search and filter by person, site, course/version, source, completion date, and record state.
- [x] Inspect course version, completion time, score, attempt history, source, and recording actor.
- [x] Record a manual completion for an existing user and course version with original completion date, source/reference, recording actor/time, and reason. Label it `manual`; never manufacture an assessment attempt or passing score.
- [x] Correct or void a completion through a linked superseding record with actor, timestamp, and mandatory reason. Preserve the original and show both the current effective view and full history.
- [x] Define and test whether a manual entry satisfies an assignment: require explicit assignment linkage, matching person/course version, and an authorized administrator's decision. Voiding evidence re-evaluates assignment status without erasing attempts or silently creating new assignments.
- [x] Audit every assignment and record mutation. Learners cannot edit completions.

An effective manual record explicitly linked by an authorized administrator satisfies the matching assignment's knowledge step even when the Moodle feed has an unresolved completion discrepancy. The discrepancy stays visible and is not silently resolved. Existing workplace authorization guards continue to block on unresolved completion discrepancies. Voiding the manual record removes its knowledge credit and re-evaluates status using the remaining effective evidence.

**Done when:** an administrator assigns a course, inspects its Moodle completion, adds a clearly labeled manual record, corrects it, and voids it without losing history. Unauthorized roles and other sites/tenants cannot perform these actions.

Practical evaluation, authorization issuance/revocation, clearance, external credentials, site addenda, and instructor-led session workflows are deferred. Existing authorization guards remain intact.
