# Archived synthetic reconciliation utility

This existing read-only utility compares normalized CSV inputs. It is retained with its synthetic tests as a historical development artifact and is outside the product roadmap. It does not import records or write Moodle completions.

The inputs are a normalized source CSV, a PostgreSQL provenance CSV, and a Moodle completion CSV describing the same scope. `reconcile.py` defines the required headers and validation. Original source date text and timezone are preserved alongside normalized instants; the source archive checksum identifies the unchanged original input.

```sh
python3 tools/hsi-reconcile/reconcile.py \
  --source normalized-source.csv \
  --source-archive original-source.csv \
  --provenance postgres-provenance.csv \
  --moodle moodle-completions.csv \
  --report comparison-report.json
```

Exit code 0 means the supplied rows match, 1 means discrepancies, and 2 means invalid input. Empty inputs, duplicate identities, and ambiguous completion mappings are rejected. A passing comparison is not authorization to import data. Keep personal records and reports out of Git.

Run the existing synthetic checks with `python3 -m unittest discover -s tools/hsi-reconcile -p 'test_*.py'`.
