# 04 · User learning

**Goal:** a learner signs in, takes assigned courses in Moodle, and sees accurate completion history in HSE Informer.

- [ ] Show My Training with assigned, in-progress, due-soon, overdue, and completed courses, reasons, and site-local due dates.
- [ ] Launch the server-resolved mapped Moodle course with the learner's individual Keycloak identity; never expose service credentials.
- [ ] Use Moodle's server-owned progress and cross-device resume. Keep answers, attempts, scores, and attempt/pass/remediation rules in Moodle.
- [ ] Read verified completion evidence back into PostgreSQL with original time, exact course version, and available score/attempt data; retry safely and expose sync failures.
- [ ] Show completion and transcript details without implying workplace authorization.
- [ ] Make the portal and Moodle course flow usable on phones and with keyboard/screen reader access.
- [ ] Verify sign-out and account deactivation prevent further access in both systems.

**Done when:** a learner starts on one device, resumes on another, fails/retries within the configured rules, passes, and sees the verified completion in their HSE history. Other learners' records remain inaccessible.

PDF certificates, expanded localization, QR/shared-device modes, and trainer-question routing are later work. Beta test records do not grant workplace authorization.
