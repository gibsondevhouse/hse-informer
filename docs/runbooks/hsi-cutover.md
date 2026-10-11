# HSI historical-data cutover runbook (draft)

**Status: blocked.** This is an operator checklist for a future rehearsal and cutover. It has not been executed. HSI remains authoritative for historical records. Do not run a production import until a real HSI export, a reviewed Moodle importer, two clean rehearsals, and named HSE signoff are available.

## Record before scheduling a freeze

| Item | Required value and evidence |
|---|---|
| Client company and Moodle instance | Exact tenant ID, Moodle base URL, pinned 5.3 patch/build, backup ID, and tested restore result |
| HSI source | Export report/query definition, extraction operator/time, untouched archive path, SHA-256, row count, and retention location |
| Mapping review | HSI field inventory, person/site/course alias review, original date and timezone handling, unmapped-row dispositions, HSE reviewer |
| Import release | Reviewed one-time plugin revision, supported Moodle API path, dry-run report, rollback result, and disabled-after-use plan |
| Freeze window | Start/end in UTC and site time zones, communication owner, and the last HSI write to include |
| Reconciliation signoff | Two consecutive rehearsal report hashes, zero unexplained discrepancies, HSE owner name/date |
| Rollback owner | Person authorized to restore HSI and Moodle/HSE database backups and announce reversal |

An empty item blocks the freeze. Store signed evidence and archives in the client's controlled records repository, not in Git or the synthetic fixture directories.

## Rehearsal sequence

1. Restore a recent **nonproduction** HSI export, Moodle backup, and HSE Informer database snapshot into isolated instances. Confirm the company and site bindings before any row is read or written.
2. Preserve the untouched HSI export, hash it, and create a separately reviewed normalized CSV. Keep original completion/expiry text and timezone alongside each normalized instant. Compare every conversion with the source representation; investigate ambiguity instead of supplying a default.
3. Run the read-only Moodle plugin under `integrations/moodle-local/hsi_import` with its explicit tenant/instance binding. Review every `unmapped`, conflict, invalid, or manual-review row and every unused mapping. Its clean exit is a parser/mapping check, not permission to import.
4. Only after the one-time write path has separate code, security, GPL, and HSE review, rehearse the importer against the disposable Moodle instance. Preserve Moodle course, activity, attempt, grade, criterion, and date semantics; stop if any source field cannot be represented faithfully. Do not edit Moodle core files or core tables directly.
5. Export Moodle completions and HSE provenance, then run `tools/hsi-reconcile/reconcile.py` against the reviewed normalized source and untouched archive. Compare all rows, exact completion instants, original date strings, expiry, archive hash, mapped IDs, and counts by tenant/site/course/person. Preserve the JSON report and hashes.
6. Restore fresh snapshots and repeat the entire import and reconciliation. Require two consecutive reports with zero unexplained discrepancies, plus proof that replay does not duplicate completions. Have the named HSE owner sign both reports.

If a requirement cannot be proved, keep HSI authoritative, document the discrepancy, and revise the importer or mapping before another rehearsal.

## Production change window (only after all gates pass)

1. Announce the approved freeze. Stop new HSI writes or establish an approved capture-and-replay method for writes arriving during the window. Confirm the last included HSI record ID/time and archive it.
2. Take and verify restorable HSI, Moodle, and HSE Informer backups. Record the restore point and operator.
3. Run the same reviewed dry run, importer revision, and row-by-row reconciliation used in the clean rehearsals. Compare the production source count and archive hash with the frozen export. A nonzero discrepancy blocks cutover.
4. Obtain HSE owner signoff on the production report. Switch new enrollment/completion ownership to Moodle only after that signoff, then verify a new synthetic or controlled test record flows from HSE assignment through Moodle and back without granting authorization automatically.
5. Set HSI to read-only and retain access for the HSE-approved retention period. Record the owner, end date, and retrieval procedure. Disable the one-time importer and revoke its elevated credentials.

## Rollback trigger and action

Rollback if the source/archive hash changes unexpectedly, any original date/provenance differs, a company boundary fails, Moodle completion semantics cannot be reproduced, the importer cannot be disabled, or a required reviewer declines signoff. Freeze further imports, preserve diagnostics, restore the verified Moodle/HSE snapshots, return new training activity to HSI under the approved capture plan, and tell affected administrators which records need re-entry. Reconcile the restored systems before reopening writes. Never silently delete or reinterpret the historical source archive.
