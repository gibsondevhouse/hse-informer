import csv
import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("reconcile.py")


def write_csv(path, fieldnames, rows):
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


class ReconcileTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        directory = Path(self.temp.name)
        self.source = directory / "normalized.csv"
        self.archive = directory / "original.csv"
        self.provenance = directory / "provenance.csv"
        self.moodle = directory / "moodle.csv"
        self.archive.write_text("original HSI export bytes\n", encoding="utf-8")
        self.original = {
            "hsi_record_id": "HSI-1",
            "tenant_id": "tenant-a",
            "site_id": "tifton",
            "person_id": "person-1",
            "course_id": "respiratory",
            "completed_at": "2025-03-01T09:00:00-05:00",
            "expires_at": "2026-03-01T14:00:00Z",
            "original_completed_raw": "03/01/2025 09:00 EST",
            "original_expires_raw": "03/01/2026 09:00 EST",
            "original_timezone": "America/New_York",
        }
        self.prov = {
            **self.original,
            "moodle_completion_id": "101",
            "moodle_user_id": "501",
            "moodle_course_id": "701",
            "source_export_sha256": hashlib.sha256(self.archive.read_bytes()).hexdigest(),
            "import_batch_id": "batch-1",
        }
        self.completion = {
            "moodle_completion_id": "101",
            "moodle_user_id": "501",
            "moodle_course_id": "701",
            "completed_at": "2025-03-01T14:00:00Z",
        }

    def run_check(self, source_rows=None, provenance_rows=None):
        write_csv(self.source, self.original.keys(), source_rows or [self.original])
        write_csv(self.provenance, self.prov.keys(), provenance_rows or [self.prov])
        write_csv(self.moodle, self.completion.keys(), [self.completion])
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                "--source", str(self.source),
                "--source-archive", str(self.archive),
                "--provenance", str(self.provenance),
                "--moodle", str(self.moodle),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_matching_records_pass(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('"discrepancy_count": 0', result.stdout)

    def test_wrong_moodle_date_fails(self):
        self.completion["completed_at"] = "2025-03-02T14:00:00Z"
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("Moodle completion time differs", result.stdout)

    def test_bad_archive_checksum_fails(self):
        self.prov["source_export_sha256"] = "0" * 64
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("source export checksum differs", result.stdout)

    def test_missing_completion_fails(self):
        self.completion["moodle_completion_id"] = "999"
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("Moodle completion 101 missing", result.stdout)

    def test_naive_timestamp_is_invalid_input(self):
        self.original["completed_at"] = "2025-03-01T09:00:00"
        result = self.run_check()
        self.assertEqual(result.returncode, 2)
        self.assertIn("must include a timezone", result.stderr)

    def test_original_date_representation_must_match(self):
        self.prov["original_completed_raw"] = "2025-03-01T14:00:00Z"
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("original_completed_raw differs", result.stdout)

    def test_two_source_records_cannot_share_one_moodle_completion(self):
        second_source = {**self.original, "hsi_record_id": "HSI-2"}
        second_provenance = {**self.prov, "hsi_record_id": "HSI-2"}
        result = self.run_check(
            source_rows=[self.original, second_source],
            provenance_rows=[self.prov, second_provenance],
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("provenance: duplicate moodle_completion_id=101", result.stdout)


if __name__ == "__main__":
    unittest.main()
