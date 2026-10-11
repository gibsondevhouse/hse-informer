# HSI rehearsal reconciliation

`reconcile.py` checks a **normalized** HSI export against a PostgreSQL
provenance export and an actual Moodle course-completion export. It does not
import or change any records. Its synthetic tests do not satisfy Gate C in
`docs/refactor-001.md`.

All three CSVs must describe the same import scope. Required columns:

| CSV | Columns |
|---|---|
| Normalized HSI | `hsi_record_id,tenant_id,site_id,person_id,course_id,completed_at,expires_at,original_completed_raw,original_expires_raw,original_timezone` |
| PostgreSQL provenance | All normalized HSI columns plus `moodle_completion_id,moodle_user_id,moodle_course_id,source_export_sha256,import_batch_id` |
| Moodle completions | `moodle_completion_id,moodle_user_id,moodle_course_id,completed_at` |

`expires_at`, `original_expires_raw`, and `original_timezone` may be blank;
every other field is required. `original_completed_raw` and `original_expires_raw`
retain the exact source date text, and the reconciliation compares those values
byte for byte after CSV decoding. The normalized timestamps must be timezone-aware
ISO 8601 with whole-second precision. The provenance checksum
must be the SHA-256 of the **original HSI export**, passed as
`--source-archive`. This prevents a normalized or edited staging file from
masquerading as the original archive.

```sh
python3 tools/hsi-reconcile/reconcile.py \
  --source normalized-hsi.csv \
  --source-archive original-hsi-export.csv \
  --provenance postgres-provenance.csv \
  --moodle moodle-completions.csv \
  --report rehearsal-report.json
```

Exit code 0 means every supplied row and count matched; 1 means discrepancies;
2 means invalid input. A passing report is one input to the two-rehearsal and
HSE approval gate, not an authorization to cut over. Keep real exports and
reports out of Git because they contain employee records.
The comparison rejects duplicate HSI records, duplicate Moodle completions,
two provenance rows that claim the same Moodle completion ID, and distinct
completions mapped to the same Moodle user/course pair. Empty exports fail
closed. See the [Moodle 5.3 backfill feasibility decision](moodle53-backfill-feasibility.md)
for why there is no historical write importer yet.

Run synthetic tests with `python3 -m unittest discover -s tools/hsi-reconcile -p 'test_*.py'`.
