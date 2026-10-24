# 04 · User learning

**Implementation:** the portal, source progress adapter and history have unit, PostgreSQL and browser coverage. Synthetic Moodle CI exercises native lesson/answer resume, failed and passed attempts, canonical completions and account revocation. The joined account-to-course probe exercises these services together. Company IT deployment and human acceptance remain open.

**Goal:** a learner signs in, takes assigned courses in Moodle, and sees accurate completion history in HSE Informer.

- [x] Show My Training with assigned, in-progress, due-soon, overdue, and completed courses, reasons, and site-local due dates.
- [x] Launch the server-resolved mapped Moodle course with the learner's individual Keycloak identity; never expose service credentials.
- [x] Use Moodle's server-owned progress and cross-device resume. Keep answers, attempts, scores, and attempt/pass/remediation rules in Moodle.
- [x] Read verified completion evidence back into PostgreSQL with original time, exact course version, and available score/attempt data; retry safely and expose sync failures.
- [x] Show completion and transcript details without implying workplace authorization.
- [ ] Make the portal and Moodle course flow usable on phones and with keyboard/screen reader access.
- [ ] Verify sign-out and account deactivation prevent further access in both systems.

Enrollment alone does not establish learning activity. Reconciliation retains a separate latest Moodle observation with source/read times, course/version, user and instance identity. The portal distinguishes confirmed activity, confirmed no-start and unavailable progress; it does not invent a completion. Failed reads retain the last observation and expose the job failure. Due soon means today through seven calendar days ahead in the assignment site's time zone. Completion evidence remains immutable and takes precedence over these progress observations.

Automated accessibility, keyboard and synthetic revocation checks are in CI. The unchecked items require the chosen environment and a manual screen-reader pass. The disposable identity fixture may request credentials again when entering Moodle; it does not establish seamless single-prompt sign-in on the eventual host.

**Done when:** a learner starts on one device, resumes on another, fails/retries within the configured rules, passes, and sees the verified completion in their HSE history. Other learners' records remain inaccessible.

PDF certificates, expanded localization, QR/shared-device modes, and trainer-question routing are later work. Beta test records do not grant workplace authorization.
