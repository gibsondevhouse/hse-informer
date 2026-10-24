import importlib.util
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("beta_recovery", Path(__file__).with_name("recovery.py"))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoverySafetyTests(unittest.TestCase):
    def test_connection_keeps_credentials_out_of_arguments_and_checks_ssl_options(self):
        env, identity = recovery.connection("postgres://test_user:p%40ss@example.invalid:5433/beta?sslmode=require")
        self.assertEqual(env["PGPASSWORD"], "p@ss")
        self.assertEqual(env["PGSSLMODE"], "require")
        self.assertNotIn("p@ss", identity)
        with self.assertRaisesRegex(ValueError, "Unsupported"):
            recovery.connection("postgres://example.invalid/beta?options=unsafe")

    def test_source_identity_excludes_credentials_but_rejects_same_restore_database(self):
        _, source = recovery.connection("postgres://admin:secret@db.invalid/source")
        with self.assertRaisesRegex(ValueError, "matches a source"):
            recovery.validate_target("postgres://restore:other@db.invalid/source", {source})

    def test_nonempty_restore_is_rejected(self):
        with patch.object(recovery, "sql", return_value="1"):
            with self.assertRaisesRegex(ValueError, "empty isolated"):
                recovery.validate_target("postgres://db.invalid/target", set())

    def test_archive_path_traversal_and_links_are_rejected(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            archive = root / "bad.tar"
            for name, kind in [("../outside", tarfile.REGTYPE), ("linked", tarfile.SYMTYPE)]:
                with tarfile.open(archive, "w") as output:
                    member = tarfile.TarInfo(name)
                    member.type = kind
                    output.addfile(member)
                with self.assertRaisesRegex(ValueError, "Unsafe"):
                    recovery.extract(archive, root / "target")
            self.assertFalse((root / "outside").exists())


if __name__ == "__main__":
    unittest.main()
