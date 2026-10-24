# 07 · Completion records and basic reporting

**Implementation:** UI/API and synthetic verification are complete; live beta acceptance remains open.

**Goal:** administrators find training gaps and inspect/export accurate completion records.

- [x] Provide scoped assignment/progress and completion lists filtered by site, person, course/version, date, source, and record state.
- [x] Open each count or row into its underlying records; show scope and as-of time.
- [x] Show Moodle completions separately from manual records and retain correction/void history.
- [x] Export the filtered completion list to CSV with person, course/version, completion time, score when available, source, and effective record state. Enforce the same permissions as the UI and log exports.
- [x] Keep a learner's own transcript accessible to that learner.

**Done when:** UI counts and CSV rows match database records and permissions, including corrected and voided records. A profile edit does not change the historical completion snapshot.

A full training matrix, qualification reports, integration drift reports, and PDF evidence packets are deferred.
