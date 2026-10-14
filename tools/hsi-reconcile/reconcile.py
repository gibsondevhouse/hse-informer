#!/usr/bin/env python3
"""Compare a normalized HSI export with actual Moodle and provenance exports.

This tool never imports records. A zero exit status is one rehearsal check, not
approval to cut over from HSI.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


SOURCE_FIELDS = (
    "hsi_record_id",
    "tenant_id",
    "site_id",
    "person_id",
    "course_id",
    "completed_at",
    "expires_at",
    "original_completed_raw",
    "original_expires_raw",
    "original_timezone",
)
PROVENANCE_FIELDS = SOURCE_FIELDS + (
    "moodle_completion_id",
    "moodle_user_id",
    "moodle_course_id",
    "source_export_sha256",
    "import_batch_id",
)
MOODLE_FIELDS = (
    "moodle_completion_id",
    "moodle_user_id",
    "moodle_course_id",
    "completed_at",
)


class InputError(Exception):
    pass


def read_rows(path: Path, required: tuple[str, ...]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not reader.fieldnames:
            raise InputError(f"{path}: missing CSV header")
        missing = sorted(set(required) - set(reader.fieldnames))
        if missing:
            raise InputError(f"{path}: missing columns: {', '.join(missing)}")
        rows = []
        for line, raw in enumerate(reader, start=2):
            if None in raw:
                raise InputError(f"{path}:{line}: extra CSV columns")
            row = {key: (value or "") if key.endswith("_raw") else (value or "").strip()
                   for key, value in raw.items()}
            for key in required:
                if key not in ("expires_at", "original_expires_raw", "original_timezone") and not row[key].strip():
                    raise InputError(f"{path}:{line}: blank {key}")
            rows.append(row)
    if not rows:
        raise InputError(f"{path}: no data rows; an empty export cannot prove a migration")
    return rows


def instant(value: str, label: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InputError(f"{label}: expected ISO 8601 timestamp: {value!r}") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise InputError(f"{label}: timestamp must include a timezone: {value!r}")
    if parsed.microsecond:
        raise InputError(f"{label}: subsecond precision cannot be compared to Moodle: {value!r}")
    return parsed.astimezone(timezone.utc)


def keyed(rows: list[dict[str, str]], field: str, label: str, issues: list[str]) -> dict[str, dict[str, str]]:
    output = {}
    for row in rows:
        key = row[field]
        if key in output:
            issues.append(f"{label}: duplicate {field}={key}")
        else:
            output[key] = row
    return output


def compare(
    source_rows: list[dict[str, str]],
    provenance_rows: list[dict[str, str]],
    moodle_rows: list[dict[str, str]],
    source_sha256: str,
) -> dict[str, object]:
    issues: list[str] = []
    source = keyed(source_rows, "hsi_record_id", "HSI", issues)
    provenance = keyed(provenance_rows, "hsi_record_id", "provenance", issues)
    keyed(provenance_rows, "moodle_completion_id", "provenance", issues)
    moodle = keyed(moodle_rows, "moodle_completion_id", "Moodle", issues)

    # Moodle course completion is one record per user/course. Two HSI events
    # cannot be reconciled as distinct course completions merely by assigning
    # them different IDs in a fabricated Moodle export.
    targets: dict[tuple[str, str], str] = {}
    for row in provenance_rows:
        target = (row["moodle_user_id"], row["moodle_course_id"])
        first = targets.get(target)
        if first is not None:
            issues.append(
                f"provenance: Moodle user/course target {target[0]}/{target[1]} "
                f"is claimed by HSI records {first} and {row['hsi_record_id']}"
            )
        else:
            targets[target] = row["hsi_record_id"]

    for record_id, original in source.items():
        imported = provenance.get(record_id)
        if imported is None:
            issues.append(f"{record_id}: missing provenance")
            continue
        for field in SOURCE_FIELDS[1:]:
            if field in ("completed_at", "expires_at"):
                original_value = instant(original[field], f"HSI {record_id} {field}")
                imported_value = instant(imported[field], f"provenance {record_id} {field}")
            else:
                original_value = original[field]
                imported_value = imported[field]
            if original_value != imported_value:
                issues.append(f"{record_id}: provenance {field} differs from HSI")
        if imported["source_export_sha256"].lower() != source_sha256:
            issues.append(f"{record_id}: source export checksum differs")
        moodle_id = imported["moodle_completion_id"]
        completion = moodle.get(moodle_id)
        if completion is None:
            issues.append(f"{record_id}: Moodle completion {moodle_id} missing")
            continue
        for field in ("moodle_user_id", "moodle_course_id"):
            if imported[field] != completion[field]:
                issues.append(f"{record_id}: Moodle {field} differs from provenance")
        if instant(original["completed_at"], f"HSI {record_id} completed_at") != instant(
            completion["completed_at"], f"Moodle {moodle_id} completed_at"
        ):
            issues.append(f"{record_id}: Moodle completion time differs from HSI")

    for record_id in provenance.keys() - source.keys():
        issues.append(f"{record_id}: provenance has no HSI source record")
    referenced = {row["moodle_completion_id"] for row in provenance_rows}
    for completion_id in moodle.keys() - referenced:
        issues.append(f"{completion_id}: Moodle completion has no provenance")

    dimensions = ("tenant_id", "site_id", "course_id", "person_id")
    counts = {}
    for field in dimensions:
        expected = Counter(row[field] for row in source_rows)
        actual = Counter(row[field] for row in provenance_rows)
        for value in expected.keys() | actual.keys():
            if expected[value] != actual[value]:
                issues.append(
                    f"{field}={value}: HSI count {expected[value]} != provenance count {actual[value]}"
                )
        counts[field] = {key: expected[key] for key in sorted(expected)}

    return {
        "passed": not issues,
        "source_sha256": source_sha256,
        "source_count": len(source_rows),
        "provenance_count": len(provenance_rows),
        "moodle_count": len(moodle_rows),
        "counts": counts,
        "discrepancy_count": len(issues),
        "discrepancies": sorted(issues),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True, help="normalized HSI CSV")
    parser.add_argument("--source-archive", type=Path, required=True, help="original HSI export used for checksum")
    parser.add_argument("--provenance", type=Path, required=True, help="PostgreSQL import provenance CSV")
    parser.add_argument("--moodle", type=Path, required=True, help="actual Moodle completion CSV")
    parser.add_argument("--report", type=Path, help="optional JSON output path")
    args = parser.parse_args(argv)
    try:
        checksum = hashlib.sha256(args.source_archive.read_bytes()).hexdigest()
        result = compare(
            read_rows(args.source, SOURCE_FIELDS),
            read_rows(args.provenance, PROVENANCE_FIELDS),
            read_rows(args.moodle, MOODLE_FIELDS),
            checksum,
        )
    except (InputError, OSError) as exc:
        print(f"input error: {exc}", file=sys.stderr)
        return 2
    output = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
