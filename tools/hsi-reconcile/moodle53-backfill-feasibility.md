# Moodle 5.3 historical completion backfill: feasibility decision

**Decision (2026-10-11): keep the importer read-only. Gate C remains open.**
This review uses Moodle's tagged `v5.3.0` source, matching the current synthetic
fixture. It is a code-path assessment, not an installation test or approval of
that patch for production. No real HSI export or field inventory is available.

## Supported paths examined

| Path | What the 5.3.0 code does | Consequence for HSI history |
|---|---|---|
| [`completion_completion::mark_complete($timecomplete)`](https://raw.githubusercontent.com/moodle/moodle/v5.3.0/public/completion/completion_completion.php) | Accepts a caller-supplied Unix timestamp for a **course** completion, refuses to change an existing completion time, emits `course_completed`, and sends a learner notification. | A matching course date alone would imply a Moodle completion without proving the original activity, attempt, assessment, or criterion. It also sends a notification during import. We cannot use it as a general HSI importer. |
| [`completion_criteria_completion::mark_complete($timecompleted)`](https://raw.githubusercontent.com/moodle/moodle/v5.3.0/public/completion/completion_criteria_completion.php) | Accepts a timestamp for one criterion and marks the course in progress. | It does not create the underlying SCORM attempt or activity completion that an activity criterion refers to. |
| [`completion_info::update_state(...)`](https://raw.githubusercontent.com/moodle/moodle/v5.3.0/public/lib/completionlib.php) | Recomputes an activity completion and assigns `time()` when the state changes. Its public parameters have no historical timestamp. | Calling it after a historical SCORM replay would date the Moodle activity completion at import time. |
| [`mod_scorm_insert_scorm_tracks`](https://raw.githubusercontent.com/moodle/moodle/v5.3.0/public/mod/scorm/classes/external.php) and [`scorm_insert_track`](https://raw.githubusercontent.com/moodle/moodle/v5.3.0/public/mod/scorm/locallib.php) | The web service takes a SCO, attempt number, and element/value pairs for the current web-service user; it has no user or historical timestamp parameter. The module writes `timemodified = time()` for tracking values and may update grades and emit status/score events. The API warns that an existing attempt can be overwritten. | It cannot faithfully reconstruct an arbitrary worker's original SCORM track date or safely replay historical attempts. Passing a date as a SCORM element would not change Moodle's own track timestamp. |
| [Documented web-service function list](https://docs.moodle.org/dev/Web_service_API_functions) | Lists completion status reads, manual/override activity updates, self completion, and SCORM track writes. | It does not supply a general historical completion import with source dates and provenance. |

## Why a write plugin is deferred

The current normalized CSV contains a completion and optional expiry, but the
real HSI format may also contain attempts, scores, instructors, source course
versions, materials, and site-specific evidence. A course-only write would
silently discard or imply those facts. Even if an HSI row contains only a
course date, the intended Moodle course may require a SCORM activity and
criteria whose timestamps would disagree with that date. The existing
`integrations/moodle-local/hsi_import` dry run therefore has no `--apply`
switch. It checks mappings and existing Moodle state without modifying it.

The new reconciliation check rejects two source records mapped to the same
Moodle user/course pair, even if a fabricated export gives them distinct
completion IDs. Moodle's `completion_completion::fetch()` is keyed by that
user/course pair; repeated historical completions need a reviewed course
version or other explicit representation, not duplicate course rows.

## Conditions to reconsider

1. Obtain the untouched real HSI export, its extraction specification, and an
   HSE-reviewed field inventory. Preserve original text, timezone, source ID,
   score, attempt, and course/version fields before normalization.
2. For each source record, choose and review the exact Moodle representation
   and prove its activity, criterion, grade, attempt, course date, and
   notification behavior on a disposable instance of the pinned patch.
3. If the supported APIs cannot preserve those facts, keep the historical
   record in an immutable provenance archive and HSI authoritative. Do not
   write directly to Moodle core tables or fake SCORM activity.
4. Only after a faithful write path is implemented and reviewed, perform two
   fresh rehearsals, restore tests, row-by-row reconciliation, isolation tests,
   and named HSE signoff before considering cutover.

The synthetic fixtures and a clean read-only reconciliation are never proof
of a real HSI import.
