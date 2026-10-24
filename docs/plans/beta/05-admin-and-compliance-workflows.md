# 05 · Admin and compliance workflows

**Goal:** administrators, evaluators, and approvers do their whole job in the UI.

## Why

`web/` has APIs for practical evaluations, attestations, authorizations, training contexts, and change events, but the UI is a single dashboard page (`web/src/routes/+page.svelte`). Instructor-led training and toolbox talks, the most common HSE training records, have no support at all.

## Work

### Assignments

- [ ] Finish preview parity for manual and bulk assignment, deadline edits, cancellation, and reassignment with a reason, using the [admin-app README](../../../admin-app/README.md) checklist.
- [ ] Add a rule editor: audience by site, department, role or job, task, and contractor flag, with a dry-run recipient count before activation.
- [ ] Show each rule's source requirement, owner, effective date, and last review.
- [ ] Add a form to record an observed deficiency or a procedure change, which creates a change event for the existing reassignment engine.

### Instructor-led sessions and toolbox talks

- [ ] Add sessions: topic or course version, trainer, site, date, start and end time, location, and capacity.
- [ ] Take attendance from the roster on a tablet, with each attendee's signature or a trainer attestation.
- [ ] Support a quick toolbox talk: topic, short notes, attendees, done in under two minutes on a phone.
- [ ] Upload a scanned paper sign-in sheet as supporting evidence.
- [ ] Count a session as site training evidence when the requirement allows it.

### Evaluations and authorizations

- [ ] Add an evaluator worklist: who is waiting for a practical evaluation, at which site, for which checklist version.
- [ ] Add a mobile checklist screen: each item pass or fail, comments, restrictions, evaluator and employee attestations.
- [ ] Reject signoff from an evaluator without a current qualification for that checklist. The server rule exists; show the reason in the UI.
- [ ] Add an approver screen to issue, restrict, and revoke an authorization, showing every prerequisite and its evidence. Issuing is blocked while any prerequisite is missing.
- [ ] Add clearance status entry (medical clearance and fit test, status and date only) and external credential upload with verification.

### Site addenda and evaluator qualifications

- [ ] Add screens to create and version site addenda and attach them to a requirement.
- [ ] Add screens to record evaluator qualifications with scope and expiry.

## Done when

- The Phase 3 exit scenarios in the [roadmap](../../refactor-001.md) run through the UI, not only the tests: an unqualified evaluator is rejected, a procedure change at Ocilla reassigns exactly the affected people, and a worker becomes Authorized only after a qualified signoff.
- A trainer records a 10-person toolbox talk on a phone in under two minutes.
- Every admin action above writes an audit event, and browser tests cover each screen.
