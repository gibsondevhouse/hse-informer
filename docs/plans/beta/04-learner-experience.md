# 04 · Learner experience

**Goal:** a worker can sign in, see what they owe, take a course and its assessment, and understand their status.

## Why

`web/` has only the draft Respiratory preview at `/preview/respiratory-protection`. The player and scoring engine exist in `admin-app/`. Its previews keep progress in the browser, but its protected recorded learner path (`app/api/learner/assignments/[id]/route.ts`) already replays actions on the server and saves progress to D1 with revision checks. It is unprovisioned and limited to the PBJ practice package, and it is the reference to port. There are no certificates.

## Work

### Learner portal

- [ ] Add a My Training page: assigned, in progress, due soon, overdue, and completed, with due dates in the site's local time (`web/src/lib/site-date.ts`).
- [ ] Explain each assignment's reason in plain language ("Assigned because you work in the paint line at Tifton").
- [ ] Show the assignment label (Not started, In progress, Knowledge Complete, Overdue) separately from the independent evidence milestones in the [domain contract](../../contracts/domain.md#milestones-and-displayed-status), and list what is still missing ("Knowledge complete. Waiting on practical evaluation."). Never show a single "Certified" status.
- [ ] Add a transcript of completed training with course version, language, date, and score.

### Course player and assessments

- [ ] Use the player ported in [01](01-platform-decision.md) for assigned courses, with resume from the last position.
- [ ] Save every response, attempt, and score on the server, replaying actions server-side and rejecting stale writes by revision, as the recorded learner path does. A refresh or a second device continues the same attempt.
- [ ] Enforce the pass mark, attempt limit, and remediation rule set in [02](02-content-and-hse-review.md). A failed final attempt notifies the site admin.
- [ ] Keep exam answers and correct responses server-side until an attempt is submitted.
- [ ] Record the employee attestation at the end of a course with identity re-confirmation and the exact wording shown.
- [ ] Provide a way to ask a knowledgeable person a question during a course, at minimum a "Ask a question" form routed to the site admin. OSHA expects timely access to a qualified trainer for online training.

### Certificates

- [ ] Generate a completion certificate as PDF with worker, course, version, language, date, and score.
- [ ] Word it as a knowledge completion record. It must not say "certified," "qualified," or "authorized," following [phases.txt §6](../../vision/phases.txt).
- [ ] Add a verification code or QR link that shows the current record to a signed-in authorized viewer.

### Shop-floor access

- [ ] Check every learner screen at phone width and on a shared tablet.
- [ ] Add a shared-device mode: sign-in by one-time code or QR, automatic sign-out after inactivity, and no cached personal data after sign-out.
- [ ] Check playback on a slow connection, and provide transcripts so a course works without video.

## Done when

- A worker completes the approved pilot course on a phone, fails and retries the assessment within the rules, passes, and downloads a correctly worded certificate.
- The same worker sees "Knowledge Complete, not authorized" and the remaining steps.
- Browser tests cover resume across devices, attempt limits, and shared-device sign-out.
