# HSI import rehearsal for Moodle 5.3

**Status: archived nonproduction, read-only prototype; outside the product roadmap.** This local plugin has one CLI command that validates a normalized HSI CSV, checks an explicit HSE-to-Moodle ID mapping, reads Moodle users, courses, and course-completion records, and emits a row-by-row JSON report. It contains no import or completion write path. It creates no plugin table and makes no direct core-table edits.


## Input contract

`--input` is a *normalized rehearsal CSV*, with this exact ordered header:

```csv
hsi_record_id,tenant_id,site_id,person_id,course_id,completed_at,expires_at,original_completed_raw,original_expires_raw,original_timezone
```

`--mapping` is a separately reviewed CSV, with this exact ordered header:

```csv
tenant_id,site_id,person_id,moodle_user_id,course_id,moodle_course_id
```

The mapping key is `(tenant_id, site_id, person_id, course_id)`; every part must be reviewed against the actual HSI export and the intended company Moodle instance. Moodle IDs are positive local integer IDs. A Moodle user may map to only one HSE person, a Moodle course to only one HSE course code, and a Moodle user/course pair to only one source mapping key. `completed_at` is required and `expires_at` may be empty; supplied normalized dates must be timezone-aware ISO 8601 strings to the second, such as `2026-01-01T00:00:00Z`. `original_completed_raw` is required source text; `original_expires_raw` and `original_timezone` may be empty if those values were absent from the source. All three raw fields are copied exactly to each report row. When raw date text is itself a timezone-aware ISO timestamp, the CLI compares its epoch to the normalized timestamp and flags a mismatch. An unparseable raw date is marked `manual_review_required`; the CLI cannot prove its interpretation or check any raw field against the untouched archive without a real HSI export mapping. Identifiers are copied as supplied and cannot contain spaces or control characters. Headers, column counts, IDs, dates, duplicates, tenant mismatch, and the 50,000-row prototype limit fail closed. A bad mapping row blocks all Moodle probes.

The normalized format is an **internal rehearsal contract**, not a claim about HSI's real export format. No real HSI sample, field mapping, or provenance validation is available yet. `--source-archive` points to the untouched original export so the report records its SHA-256; the report also hashes the normalized and mapping files. The operator must compare `original_completed_raw`, `original_expires_raw`, and `original_timezone` byte-for-byte to that archive and verify the normalized conversion. The report explicitly sets `raw_fields_verified_against_archive` to `false`. The source archive, normalized file, and mapping file must be separate readable files. The `fixtures/` files are synthetic parser examples and are not historical evidence.

## Nonproduction dry run

Set explicit, local-only values in the disposable Moodle `config.php`:

```php
$CFG->hse_hsi_dryrun_nonproduction = true;
$CFG->hse_hsi_instance_tenant_id = 'synthetic-company';
$CFG->hse_hsi_instance_id = 'synthetic-moodle-01';
```

After installing the plugin, run this from a protected shell; substitute absolute paths to the three files:

```sh
php /path/to/moodle/local/hsi_import/cli/dry_run.php \
  --input=/protected/normalized.csv \
  --mapping=/protected/mapping.csv \
  --source-archive=/protected/raw-hsi-export \
  --tenant-id=synthetic-company \
  --instance-id=synthetic-moodle-01 \
  --ack-nonproduction > /protected/hsi-dry-run-report.json
```

The `--tenant-id` and `--instance-id` values must match their `config.php` bindings. This binding is an operator assertion, **not independent proof** of company ownership. The CLI requires Moodle release 5.3. It writes JSON to stdout only; the shell redirection above is operator-controlled. Protect the inputs and report as personal training data. Exit `0` means the read-only checks found only `ready_for_review` or `already_matching` rows and no unused mappings. Exit `2` means a validation, mapping, or Moodle discrepancy; a technical or input failure is also nonzero. Exit `0` is **not** import authorization or migration acceptance.

Each source row receives a disposition. `ready_for_review` means a mapped active Moodle user and completion-enabled course exist without a completed course record. `already_matching` means the Moodle course completion date equals the normalized timestamp. Other dispositions include `invalid_source`, `blocked_mapping_file`, `unmapped`, `missing_user`, `deleted_user`, `suspended_user`, `privileged_user` (guest or site administrator), `missing_course`, `completion_disabled`, `duplicate_moodle_completion`, and `completion_conflict`. The report lists malformed and unused mappings. An unknown CLI option, including `--apply`, is rejected. No row is written to Moodle.

## Why there is no write switch

Moodle 5.3's [`completion_completion::mark_complete($timecomplete)`](https://raw.githubusercontent.com/moodle/moodle/MOODLE_503_STABLE/public/completion/completion_completion.php) accepts a historical timestamp but marks an **entire course** complete, will not change an existing completion time, emits a `course_completed` event, and sends a learner notification. It does not recreate the corresponding SCORM attempt, grade, activity completion, criterion result, or original source provenance. Moodle's [`completion_info::update_state`](https://raw.githubusercontent.com/moodle/moodle/MOODLE_503_STABLE/public/lib/completionlib.php) updates activity completion with the current time and has no historical timestamp parameter. The [documented web-service function list](https://docs.moodle.org/dev/Web_service_API_functions) does not establish a general historical SCORM/course-completion import endpoint. Using the course-only method here could create a misleading record. This archived prototype has no `--apply` path.

## Tests and current verification

Run the Moodle PHPUnit tests after installation and PHPUnit setup:

```sh
php admin/tool/phpunit/cli/init.php
vendor/bin/phpunit --testsuite local_hsi_import_testsuite
```

The tests cover exact CSV headers, duplicate and cross-tenant source rows, duplicate mappings, strict dates, raw ISO date disagreement, and a valid timestamp reaching the read-only probe. In a disposable Moodle installation, additionally test actual user/course lookup and each completion disposition, both company bindings, unknown `--apply`, production flag absence, and a course completion that conflicts by one second. This workstation has no PHP, Docker, or Moodle instance, so these plugin tests and end-to-end checks have **not run here**. A static review of the files is not a live gate result.
